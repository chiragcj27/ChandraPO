export const PROMPT_BASE = `
You are transforming a client's Purchase Order document (PDF or Excel) into my factory's canonical JSON schema.
The PO is FROM the client TO Chandra Jewels (vendor). The buyer/client is the sender placing the order.

Goal: emit JSON only, matching the exact schema below and using the provided client-to-factory column mapping.

Output schema (use these exact keys):
{
  "total_value": number | null,
  "client_name": string,                // buyer name from the PO header
  "invoice_number": string,             // PO/Order number from header
  "invoice_date": string,               // ISO or yyyy-mm-dd if available, else ""
  "total_entries": number,              // count of items array
  "items": [
    {
      "VendorStyleCode": string,        // our vendor style (Chandra) code
      "Category": string,
      "ItemSize": string | null,
      "OrderQty": number,
      "Metal": string,
      "Tone": string,
      "ItemPoNo": string,
      "ItemRefNo": string,              // client's item reference leave empty if not present
      "StockType": string | null,
      "MakeType": string | null,
      "CustomerProductionInstruction": string | null, 
      "SpecialRemarks": string | null,
      "DesignProductionInstruction": string | null,
      "StampInstruction": string | null
    }
  ]
}

Mapping rules (very important):
- You will receive a client-specific mapping text. Each line looks like "ClientField -> OurField (instruction)".
- Use those rules to fill OUR canonical fields above. Ignore client columns that are not mapped.
- If a rule says to derive from description or convert to an enum, follow it verbatim.
- If a target field is not mapped or not present, set "" for strings or null for nullable fields, never invent data.
- Preserve numeric quantities as numbers (no commas). Treat missing numeric as 0.

Enum field constraints (CRITICAL - these enum values MUST be extracted primarily from Description field and matched to exact options):
- Category: MUST extract from Description field or dedicated Category column if present. Look for jewelry type keywords. Must be one of: "Ring", "Band", "Pendant", "Necklace", "Bracelet", "Earring", "Bangle". Match extracted values case-insensitively to these exact options (e.g., "ring" -> "Ring", "EARRING" or "EARRINGS" -> "Earring", "bangle" -> "Bangle"). If no match is found, use the extracted value as-is or "" if not present.
- Metal: MUST extract from Description field (or Category if available). Must be one of: "G09KT", "G10KT", "G14KT", "G18KT", "PT950", "S925". Look for metal information in descriptions (e.g., "9KT", "10KT", "14K", "18K", "Platinum", "PT950", "Silver", "925"). Map variations: "9KT" -> "G09KT", "10KT" -> "G10KT", "14K" -> "G14KT", "18K" -> "G18KT", "Platinum" or "PT950" or "950" -> "PT950", "Silver" or "925" or "SV925" -> "S925". If no match is found, use the extracted value as-is.
- Tone: MUST extract from Description field (or Category if available). Must be one of: "Y", "R", "W", "YW", "RW", "RY". Look for tone/color information in descriptions. Match case-insensitively: "Yellow" or "Y" -> "Y", "Rose" or "R" -> "R", "White" or "W" -> "W", "Yellow White" or "YW" or "Y/W" -> "YW", "Rose White" or "RW" or "R/W" -> "RW", "Rose Yellow" or "RY" or "R/Y" -> "RY". If no match is found, use the extracted value as-is or "" if not present.
- StockType: MUST extract from Description field (or Category if available). Look for keywords like "Studded", "Plain", "Gold", "Platinum", "Silver", "Semi Mount", "Mount", "Combination", "Normal" in descriptions. Must be one of: "Normal", "Studded Gold Jewellery IC", "Studded Platinum Jewellery IC", "Plain Gold Jewellery IC", "Plain Platinum Jewellery IC", "Studded Semi Mount Gold Jewellery IC", "Studded Silver Jewellery IC", "Plain Silver Jewellery IC", "Studded Semi Mount Platinum Jewellery IC", "Gold Mount Jewellery IC", "Studded Combination Jewellery IC". Match extracted values to the closest option based on keywords (e.g., "Studded" + "Gold" -> "Studded Gold Jewellery IC", "Plain" + "Platinum" -> "Plain Platinum Jewellery IC", "Normal" -> "Normal"). If no match is found, use null.
- MakeType: MUST extract from Description field (or Category if available). Look for keywords like "CNC", "HOLLOW", "TUBING", "CAST", "MULTI", "HIP HOP", "1 PC", "2 PC" in descriptions. Must be one of: "CNC", "HOLLOW TUBING", "1 PC CAST", "2 PC CAST", "MULTI CAST", "HIP HOP". Match extracted values case-insensitively to these exact options. If no match is found, use null.

General guidance:
- For PDF files: Identify the buyer/client name from the PO header (not Chandra Jewels). Extract the PO/Order/Invoice number from the header as invoice_number. Extract the PO/Order date if present; else leave "". Items are presented with serial numbers; extract every serial-numbered row. The count of items MUST match the serial-numbered rows, with no missing or extra items.
- For Excel files: Read all worksheets if multiple exist. Look for header rows that contain column names. Identify the buyer/client name from the first sheet or header rows. Extract the PO/Order/Invoice number from header cells or a dedicated row. Extract the PO/Order date if present. Extract all data rows (skip empty rows and header rows). Each row represents an item. The count of items MUST match the number of data rows, with no missing or extra items.
- CRITICAL: For ALL enum fields (Metal, Tone, StockType, MakeType), the values MUST be extracted primarily from the Description field. These enum values are almost always embedded within item descriptions rather than in dedicated columns. Actively search through Description, Category, and all available text fields in each item row. Parse descriptions carefully to identify metal type, tone/color, stock type, and make type information. Match extracted values to the exact enum options provided above.
- Preserve the serial order of rows in the items array.
- Do not hallucinate or infer extra items; only output what exists.
- Return ONLY valid JSON following the schema; do not include prose or markdown.
- No of items will always be equal to maximum serial number.

STRICT COUNTING PROCEDURE (VERY IMPORTANT):
1) First, scan the document and identify all item rows by their serial numbers (Sr No, S.No, etc.).
   - Collect these serial numbers in an internal array called "_debug_serials" (e.g. [1, 2, 3, ...]).
   - Do NOT invent serial numbers that are not visible in the document.
2) Then, build the "items" array with EXACTLY one item per serial number in "_debug_serials".
   - The length of "items" MUST be exactly equal to the length of "_debug_serials".
   - If you realize a serial number is missing or duplicated, re-scan and fix BEFORE you output JSON.
3) Set "total_entries" to the length of the "items" array.

Output:
- Return a single JSON object matching the schema, plus an optional "_debug_serials" array at the top level.
- Do NOT include any markdown, explanation, or extra top-level keys other than the schema and optional "_debug_serials".
`;

export function buildPrompt(
  clientName?: string | null,
  mappingText?: string | null,
  expectedItems?: number | null
): string {
  const promptParts = [PROMPT_BASE.trim()];

  if (clientName) {
    promptParts.push(
      `Client name hint: ${clientName}. Use this as client_name if it matches the PO header.`
    );
  }

  if (expectedItems !== null && expectedItems !== undefined) {
    promptParts.push(
      `CRITICAL: This PO contains exactly ${expectedItems} items. ` +
        `Your "items" array MUST have exactly ${expectedItems} entries. ` +
        `Set "total_entries" to ${expectedItems}. Count carefully and match this number exactly.`
    );
  }

  if (mappingText) {
    promptParts.push(
      `Client mapping (apply these rules to populate the canonical fields above):\n${mappingText.trim()}`
    );
  }

  promptParts.push('Respond with JSON only, no markdown or explanations.');

  return promptParts.join('\n\n');
}
