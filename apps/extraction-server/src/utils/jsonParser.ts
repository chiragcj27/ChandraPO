/**
 * Robust JSON parsing utilities to handle various formatting issues
 * from OpenAI responses (markdown fences, trailing commas, etc.)
 */

export function extractJson(text: string): string {
  let cleaned = stripFences(text);
  cleaned = cleanControlChars(cleaned);
  cleaned = closeUnterminatedStrings(cleaned);
  cleaned = quoteUnquotedKeys(cleaned);
  cleaned = fixMissingCommasInJson(cleaned);
  const balanced = extractBalancedJson(cleaned);
  return removeTrailingCommas(balanced).trim();
}

function stripFences(text: string): string {
  let cleaned = text.trim();
  // Remove opening markdown code fences
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '');
  // Remove closing markdown code fences
  cleaned = cleaned.replace(/\s*```$/m, '');
  return cleaned.trim();
}

function extractBalancedJson(text: string): string {
  // Find first '{' and parse until matching brace depth returns to 0
  const start = text.indexOf('{');
  if (start === -1) {
    return text;
  }

  let depth = 0;
  for (let idx = start; idx < text.length; idx++) {
    const ch = text[idx];
    if (ch === '{') {
      depth += 1;
    } else if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        return text.substring(start, idx + 1);
      }
    }
  }

  return text.substring(start);
}

function removeTrailingCommas(text: string): string {
  // Remove trailing commas before } or ]
  return text.replace(/,(\s*[}\]])/g, '$1');
}

function fixMissingCommasInJson(text: string): string {
  let result = text;
  // Fix: } followed by " (missing comma between objects)
  result = result.replace(/}\s+"/g, '}, "');
  // Fix: ] followed by " (missing comma between array elements)
  result = result.replace(/]\s+"/g, '], "');
  // Fix: " followed by { (missing comma between string and object)
  result = result.replace(/"\s+{/g, '", {');
  // Fix: " followed by [ (missing comma between string and array)
  result = result.replace(/"\s+\[/g, '", [');
  // Fix: number followed by " (missing comma between number and string)
  result = result.replace(/(\d)\s+"/g, '$1, "');
  // Fix: " followed by number (missing comma between string and number)
  result = result.replace(/"\s+(\d)/g, '", $1');
  // Fix: true/false/null followed by " (missing comma)
  result = result.replace(/(true|false|null)\s+"/g, '$1, "');
  // Fix: " followed by true/false/null (missing comma)
  result = result.replace(/"\s+(true|false|null)/g, '", $1');
  // Fix: } followed by { (missing comma between objects)
  result = result.replace(/}\s+{/g, '}, {');
  // Fix: ] followed by [ (missing comma between arrays)
  result = result.replace(/]\s+\[/g, '], [');
  return result;
}

function cleanControlChars(text: string): string {
  // Remove control characters except newlines, carriage returns, and tabs
  return text
    .split('')
    .map((ch) => {
      const code = ch.charCodeAt(0);
      return code >= 32 || ch === '\r' || ch === '\n' || ch === '\t' ? ch : '';
    })
    .join('');
}

function quoteUnquotedKeys(text: string): string {
  // Add quotes around object keys that are unquoted (best-effort)
  return text.replace(/([{\[,]\s*)([A-Za-z0-9_]+)\s*:/g, '$1"$2":');
}

function closeUnterminatedStrings(text: string): string {
  // Best-effort fix for unterminated strings by closing them at line breaks or end of text
  const out: string[] = [];
  let inStr = false;
  let escape = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '\n' && inStr) {
      out.push('"'); // close before newline
      inStr = false;
    }
    out.push(ch);
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === '\\') {
      escape = true;
      continue;
    }
    if (ch === '"') {
      inStr = !inStr;
    }
  }

  if (inStr) {
    out.push('"');
  }

  return out.join('');
}

export function parseJsonWithFallback(jsonText: string): any {
  try {
    return JSON.parse(jsonText);
  } catch (error) {
    // Enhanced fallback: try multiple repair strategies
    console.log(`[Extraction] First JSON parse attempt failed: ${error instanceof Error ? error.message : 'Unknown error'}`);

    const fallbackStrategies = [
      // Strategy 1: Apply missing comma fixes again
      (t: string) => fixMissingCommasInJson(t),
      // Strategy 2: Remove double commas and fix trailing commas
      (t: string) => t.replace(/,\s*,/g, ',').replace(/,(\s*[}\]])/g, '$1'),
      // Strategy 3: Fix common issues in arrays and objects
      (t: string) => t.replace(/(\])\s*(\[)/g, '$1,$2'),
      // Strategy 4: Try to fix at error position (if available)
      (t: string) => {
        const errorPos = (error as any)?.pos;
        if (errorPos && errorPos < t.length) {
          const lastBracket = t.lastIndexOf('[', errorPos);
          if (lastBracket !== -1) {
            const lastComma = t.lastIndexOf(',', lastBracket, errorPos);
            const lastQuote = t.lastIndexOf('"', lastBracket, errorPos);
            if (lastQuote > lastComma && errorPos < t.length && ['"', '{', '['].includes(t[errorPos])) {
              return t.substring(0, errorPos) + ',' + t.substring(errorPos);
            }
          }
        }
        return t;
      },
    ];

    for (const strategy of fallbackStrategies) {
      try {
        const repaired = strategy(jsonText);
        return JSON.parse(repaired);
      } catch {
        // Try next strategy
        continue;
      }
    }

    // If all strategies fail, throw original error
    throw error;
  }
}
