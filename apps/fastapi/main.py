import os
import json
import re
import tempfile
from fastapi import FastAPI, File, UploadFile, HTTPException, Form
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import pandas as pd

load_dotenv()

# Extraction provider: "openai" (gpt-4o-mini) or "gemini" (gemini-2.5-flash). Switch via EXTRACTION_PROVIDER env.
EXTRACTION_PROVIDER = os.getenv("EXTRACTION_PROVIDER", "openai").strip().lower()
if EXTRACTION_PROVIDER not in ("openai", "gemini"):
    EXTRACTION_PROVIDER = "openai"

if EXTRACTION_PROVIDER == "gemini":
    import google.generativeai as genai
    API_KEY = os.getenv("GOOGLE_API_KEY")
    if not API_KEY:
        raise RuntimeError("EXTRACTION_PROVIDER=gemini requires GOOGLE_API_KEY in .env")
    genai.configure(api_key=API_KEY)
else:
    from openai import OpenAI
    OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
    if not OPENAI_API_KEY:
        raise RuntimeError("EXTRACTION_PROVIDER=openai requires OPENAI_API_KEY in .env")
    openai_client = OpenAI(api_key=OPENAI_API_KEY)

app = FastAPI(title="Invoice Extraction API", version="1.0")

# CORS configuration - allow specific origins or all in development
cors_origins = os.getenv("CORS_ORIGIN", "*")
if cors_origins == "*":
    allowed_origins = ["*"]
else:
    allowed_origins = [origin.strip() for origin in cors_origins.split(",")]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)

PROMPT_BASE = """
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
"""

def _pdf_to_text(path: str) -> str:
    """Extract text from PDF for OpenAI path (no file upload)."""
    from pypdf import PdfReader
    reader = PdfReader(path)
    parts = []
    for page in reader.pages:
        parts.append(page.extract_text() or "")
    return "\n\n".join(parts)


def _run_extraction_openai(full_prompt: str) -> str:
    """Run extraction using OpenAI gpt-4o-mini. Prompt should contain document text (PDF extracted or Excel)."""
    resp = openai_client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": full_prompt}],
        temperature=0.1,
        response_format={"type": "json_object"},
    )
    return (resp.choices[0].message.content or "").strip()


def _run_extraction_gemini(full_prompt: str, genai_file) -> str:
    """Run extraction using Gemini. genai_file is None for Excel (text-only)."""
    model = genai.GenerativeModel("gemini-2.5-flash")
    if genai_file is None:
        response = model.generate_content(
            full_prompt,
            generation_config={"response_mime_type": "application/json"},
        )
    else:
        response = model.generate_content(
            [full_prompt, genai_file],
            generation_config={
                "response_mime_type": "application/json",
                "temperature": 0.1,
            },
        )
    return response.text.strip()


def build_prompt(client_name_hint: str | None, mapping_text: str | None, expected_items: int | None) -> str:
    prompt_parts = [PROMPT_BASE.strip()]
    if client_name_hint:
        prompt_parts.append(
            f"Client name hint: {client_name_hint}. Use this as client_name if it matches the PO header."
        )
    if expected_items is not None:
        prompt_parts.append(
            f"CRITICAL: This PO contains exactly {expected_items} items. "
            f'Your "items" array MUST have exactly {expected_items} entries. '
            f'Set "total_entries" to {expected_items}. Count carefully and match this number exactly.'
        )
    if mapping_text:
        prompt_parts.append(
            "Client mapping (apply these rules to populate the canonical fields above):\n"
            f"{mapping_text.strip()}"
        )
    prompt_parts.append("Respond with JSON only, no markdown or explanations.")
    return "\n\n".join(prompt_parts)

@app.get("/health")
async def health_check():
    """Health check endpoint for Render"""
    return {"status": "healthy", "service": "FastAPI Invoice Extraction"}

@app.get("/")
def home():
    return {
        "status": "Invoice API running 🚀",
        "version": "1.0",
        "extraction_provider": EXTRACTION_PROVIDER,
        "model": "gpt-4o-mini" if EXTRACTION_PROVIDER == "openai" else "gemini-2.5-flash",
    }

@app.post("/extract-invoice")
async def extract_invoice(
    file: UploadFile = File(...),
    client_name: str | None = Form(None),
    mapping_text: str | None = Form(None),
    expected_items: int | None = Form(None),
):
    tmp_path = None
    gfile = None
    start_time = os.times().elapsed if hasattr(os.times(), 'elapsed') else None
    
    try:
        print(f"[FastAPI] Starting extraction for file: {file.filename} (size: {file.size} bytes)")
        
        if not file.filename:
            raise HTTPException(status_code=400, detail="No filename provided")
        
        suffix = os.path.splitext(file.filename)[-1].lower()
        supported_extensions = ['.pdf', '.xlsx', '.xls']
        if suffix not in supported_extensions:
            raise HTTPException(
                status_code=400, 
                detail=f"Unsupported file type: {suffix}. Supported types: {', '.join(supported_extensions)}"
            )
        print(f"[FastAPI] Processing {suffix.upper()} file: {file.filename}")

        # Read file content
        file_content = await file.read()
        file_size = len(file_content)
        print(f"[FastAPI] File read successfully: {file_size} bytes")

        # Save to temporary file
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp.write(file_content)
            tmp_path = tmp.name
        
        print(f"[FastAPI] Temporary file created: {tmp_path}")

        prompt = build_prompt(client_name, mapping_text, expected_items)

        # Handle Excel: convert to text and include in prompt (same for both providers)
        if suffix == ".xlsx" or suffix == ".xls":
            print(f"[FastAPI] Converting Excel file to text format...")
            excel_content = ""
            try:
                excel_file = pd.ExcelFile(tmp_path)
                for sheet_name in excel_file.sheet_names:
                    df = pd.read_excel(excel_file, sheet_name=sheet_name)
                    excel_content += f"\n\n=== Sheet: {sheet_name} ===\n"
                    excel_content += df.to_csv(index=False, na_rep="")
                print(f"[FastAPI] Excel file converted to text (length: {len(excel_content)} chars)")
            except Exception as excel_error:
                print(f"[FastAPI] Error reading Excel file: {excel_error}")
                raise HTTPException(status_code=400, detail=f"Failed to read Excel file: {str(excel_error)}")

            file_type_context = "\n\nIMPORTANT: This is an Excel file. The file content is provided below as text. Read all worksheets, identify header rows, and extract all data rows as items. Pay special attention to column names and map them according to the mapping rules provided."
            full_prompt = prompt + file_type_context + "\n\nExcel File Content:\n" + excel_content

            if EXTRACTION_PROVIDER == "openai":
                print(f"[FastAPI] Generating content with OpenAI gpt-4o-mini...")
                raw = _run_extraction_openai(full_prompt)
            else:
                print(f"[FastAPI] Generating content with Gemini...")
                raw = _run_extraction_gemini(full_prompt, None)
        else:
            # PDF
            file_type_context = "\n\nIMPORTANT: This is a PDF file. Extract text and tables carefully, identifying the client name, PO number, date, and all item rows."
            if EXTRACTION_PROVIDER == "openai":
                print(f"[FastAPI] Extracting PDF text for OpenAI...")
                pdf_text = _pdf_to_text(tmp_path)
                full_prompt = prompt + file_type_context + "\n\nPDF content (extracted text):\n" + pdf_text
                print(f"[FastAPI] Generating content with OpenAI gpt-4o-mini...")
                raw = _run_extraction_openai(full_prompt)
            else:
                print(f"[FastAPI] Uploading file to Gemini...")
                gfile = genai.upload_file(tmp_path)
                print(f"[FastAPI] File uploaded to Gemini: {gfile.name}")
                full_prompt = prompt + file_type_context
                print(f"[FastAPI] Generating content with Gemini...")
                raw = _run_extraction_gemini(full_prompt, gfile)
        print(f"[FastAPI] Content generated successfully (length: {len(raw)} chars)")

        # Parse JSON with resilience to markdown/code fences and common formatting issues
        def strip_fences(text: str) -> str:
            cleaned = text.strip()
            cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned, flags=re.IGNORECASE | re.MULTILINE)
            cleaned = re.sub(r"\s*```$", "", cleaned, flags=re.MULTILINE)
            return cleaned

        def extract_balanced_json(text: str) -> str:
            # Find first '{' and parse until matching brace depth returns to 0
            start = text.find("{")
            if start == -1:
                return text
            depth = 0
            for idx in range(start, len(text)):
                ch = text[idx]
                if ch == "{":
                    depth += 1
                elif ch == "}":
                    depth -= 1
                    if depth == 0:
                        return text[start : idx + 1]
            return text[start:]

        def remove_trailing_commas(text: str) -> str:
            # Remove trailing commas before } or ]
            return re.sub(r",(\s*[}\]])", r"\1", text)
        
        def fix_missing_commas_in_json(text: str) -> str:
            """Fix missing commas in JSON structure, especially in arrays and objects"""
            # Fix missing commas between array/object elements
            # Pattern: }" or ]" or }" or number" or true" or false" or null" followed by new value
            result = text
            # Fix: } followed by " (missing comma between objects)
            result = re.sub(r'}\s+"', r'}, "', result)
            # Fix: ] followed by " (missing comma between array elements)
            result = re.sub(r']\s+"', r'], "', result)
            # Fix: " followed by { (missing comma between string and object)
            result = re.sub(r'"\s+{', r'", {', result)
            # Fix: " followed by [ (missing comma between string and array)
            result = re.sub(r'"\s+\[', r'", [', result)
            # Fix: number followed by " (missing comma between number and string)
            result = re.sub(r'(\d)\s+"', r'\1, "', result)
            # Fix: " followed by number (missing comma between string and number)
            result = re.sub(r'"\s+(\d)', r'", \1', result)
            # Fix: true/false/null followed by " (missing comma)
            result = re.sub(r'(true|false|null)\s+"', r'\1, "', result)
            # Fix: " followed by true/false/null (missing comma)
            result = re.sub(r'"\s+(true|false|null)', r'", \1', result)
            # Fix: } followed by { (missing comma between objects)
            result = re.sub(r'}\s+{', r'}, {', result)
            # Fix: ] followed by [ (missing comma between arrays)
            result = re.sub(r']\s+\[', r'], [', result)
            return result

        def clean_control_chars(text: str) -> str:
            return "".join(ch for ch in text if ord(ch) >= 32 or ch in "\r\n\t")

        def quote_unquoted_keys(text: str) -> str:
            # Add quotes around object keys that are unquoted (best-effort)
            pattern = r'([{\[,]\s*)([A-Za-z0-9_]+)\s*:'
            return re.sub(pattern, r'\1"\2":', text)

        def close_unterminated_strings(text: str) -> str:
            # Best-effort fix for unterminated strings by closing them at line breaks or end of text
            out = []
            in_str = False
            escape = False
            for ch in text:
                if ch == "\n" and in_str:
                    out.append('"')  # close before newline
                    in_str = False
                out.append(ch)
                if escape:
                    escape = False
                    continue
                if ch == "\\":
                    escape = True
                    continue
                if ch == '"':
                    in_str = not in_str
            if in_str:
                out.append('"')
            return "".join(out)


        def extract_json(text: str) -> str:
            cleaned = strip_fences(text)
            cleaned = clean_control_chars(cleaned)
            cleaned = close_unterminated_strings(cleaned)
            cleaned = quote_unquoted_keys(cleaned)
            cleaned = fix_missing_commas_in_json(cleaned)
            balanced = extract_balanced_json(cleaned)
            balanced = remove_trailing_commas(balanced)
            return balanced.strip()

        json_text = extract_json(raw)

        try:
            data = json.loads(json_text)
        except json.JSONDecodeError as json_error:
            # Enhanced fallback: try multiple repair strategies
            print(f"[FastAPI] First JSON parse attempt failed: {json_error}")
            print(f"[FastAPI] Error at position: {json_error.pos if hasattr(json_error, 'pos') else 'unknown'}")
            
            def fix_at_error_position(text: str, error_pos: int) -> str:
                """Try to fix JSON at the specific error position"""
                if error_pos >= len(text):
                    return text
                # Look backwards from error position to find where to insert comma
                last_bracket = text.rfind('[', 0, error_pos)
                if last_bracket != -1:
                    # Find the last comma or opening bracket before error
                    last_comma = text.rfind(',', last_bracket, error_pos)
                    last_quote = text.rfind('"', last_bracket, error_pos)
                    if last_quote > last_comma and error_pos < len(text) and text[error_pos] in ['"', '{', '[']:
                        # Insert comma before the next element
                        return text[:error_pos] + ',' + text[error_pos:]
                return text
            
            fallback_strategies = [
                # Strategy 1: Apply missing comma fixes again
                lambda t: fix_missing_commas_in_json(t),
                # Strategy 2: Remove double commas and fix trailing commas
                lambda t: re.sub(r",\s*,", ",", remove_trailing_commas(t)),
                # Strategy 3: Fix common issues in arrays and objects
                lambda t: re.sub(r'(\])\s*(\[)', r'\1,\2', t),  # Missing comma between arrays
                lambda t: re.sub(r'(\})\s*(\{)', r'\1,\2', t),  # Missing comma between objects
                # Strategy 4: Try to fix at the specific error location if available
                lambda t: fix_at_error_position(t, json_error.pos) if hasattr(json_error, 'pos') else t,
            ]
            
            for i, strategy in enumerate(fallback_strategies):
                try:
                    fallback = strategy(json_text)
                    if fallback != json_text:  # Only try if strategy made changes
                        data = json.loads(fallback)
                        json_text = fallback
                        print(f"[FastAPI] JSON parsing succeeded with strategy {i+1}")
                        break
                except Exception as e:
                    if i == len(fallback_strategies) - 1:  # Last strategy failed
                        print(f"[FastAPI] All JSON repair strategies failed")
                        print(f"[FastAPI] JSON parsing error: {json_error}")
                        print(f"[FastAPI] Error position: {json_error.pos if hasattr(json_error, 'pos') else 'unknown'}")
                        # Print context around error
                        if hasattr(json_error, 'pos') and json_error.pos < len(json_text):
                            start = max(0, json_error.pos - 100)
                            end = min(len(json_text), json_error.pos + 100)
                            print(f"[FastAPI] Context around error: {json_text[start:end]}")
                        print(f"[FastAPI] Raw response length: {len(raw)} chars")
                        raise HTTPException(status_code=500, detail=f"Failed to parse JSON response: {str(json_error)}")
                    continue
            else:
                # If no strategy worked, raise the original error
                print(f"[FastAPI] JSON parsing error: {json_error}")
                print(f"[FastAPI] Raw response (first 500 chars): {raw[:500]}")
                raise HTTPException(status_code=500, detail=f"Failed to parse JSON response: {str(json_error)}")

        # Ensure items array exists (rename lines to items if present)
        if "lines" in data and "items" not in data:
            data["items"] = data.pop("lines")
        data.setdefault("items", [])

        # Force total_entries to match actual items length, taking expected_items into account if provided
        actual_items = len(data["items"])
        data["total_entries"] = actual_items
        if expected_items is not None and expected_items > 0 and actual_items != expected_items:
            data["_item_count_mismatch"] = {
                "expected": expected_items,
                "actual": actual_items,
            }

        if client_name:
            data["client_name"] = client_name

        print(f"[FastAPI] Extraction completed successfully: {data.get('total_entries', 0)} items found")
        return JSONResponse(content=data)

    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
    except Exception as e:
        error_msg = str(e)
        error_type = type(e).__name__
        print(f"[FastAPI] Error during extraction: {error_type}: {error_msg}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Extraction failed: {error_type}: {error_msg}")
    finally:
        # Clean up temporary file
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.unlink(tmp_path)
                print(f"[FastAPI] Temporary file deleted: {tmp_path}")
            except Exception as cleanup_error:
                print(f"[FastAPI] Warning: Failed to clean up temp file {tmp_path}: {cleanup_error}")
        
        # Clean up Gemini uploaded file if it exists (only when using Gemini provider)
        if gfile and EXTRACTION_PROVIDER == "gemini":
            try:
                genai.delete_file(gfile.name)
                print(f"[FastAPI] Gemini file deleted: {gfile.name}")
            except Exception as cleanup_error:
                print(f"[FastAPI] Warning: Failed to delete Gemini file {gfile.name}: {cleanup_error}")
