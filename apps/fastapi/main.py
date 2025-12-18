
import os, json, re, tempfile
from fastapi import FastAPI, File, UploadFile, HTTPException, Form
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import google.generativeai as genai
from dotenv import load_dotenv
import pandas as pd

load_dotenv()
API_KEY = os.getenv("GOOGLE_API_KEY")
if not API_KEY:
    raise RuntimeError("Missing GOOGLE_API_KEY inside .env")

genai.configure(api_key=API_KEY)

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
      "ItemRefNo": string,              // client's item reference
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

General guidance:
- For PDF files: Identify the buyer/client name from the PO header (not Chandra Jewels). Extract the PO/Order/Invoice number from the header as invoice_number. Extract the PO/Order date if present; else leave "". Items are presented with serial numbers; extract every serial-numbered row. The count of items MUST match the serial-numbered rows, with no missing or extra items.
- For Excel files: Read all worksheets if multiple exist. Look for header rows that contain column names. Identify the buyer/client name from the first sheet or header rows. Extract the PO/Order/Invoice number from header cells or a dedicated row. Extract the PO/Order date if present. Extract all data rows (skip empty rows and header rows). Each row represents an item. The count of items MUST match the number of data rows, with no missing or extra items.
- Preserve the serial order of rows in the items array.
- Do not hallucinate or infer extra items; only output what exists.
- Return ONLY valid JSON following the schema; do not include prose or markdown.
"""

def build_prompt(client_name_hint: str | None, mapping_text: str | None) -> str:
    prompt_parts = [PROMPT_BASE.strip()]
    if client_name_hint:
        prompt_parts.append(
            f"Client name hint: {client_name_hint}. Use this as client_name if it matches the PO header."
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
    return {"status": "Invoice API running 🚀", "version": "1.0"}

@app.post("/extract-invoice")
async def extract_invoice(
    file: UploadFile = File(...),
    client_name: str | None = Form(None),
    mapping_text: str | None = Form(None),
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

        model = genai.GenerativeModel("gemini-2.5-flash")
        prompt = build_prompt(client_name, mapping_text)
        
        # Handle Excel files differently - convert to text and include in prompt
        if suffix == '.xlsx' or suffix == '.xls':
            print(f"[FastAPI] Converting Excel file to text format...")
            excel_content = ""
            try:
                # Read all sheets from the Excel file
                excel_file = pd.ExcelFile(tmp_path)
                sheet_names = excel_file.sheet_names
                
                for sheet_name in sheet_names:
                    df = pd.read_excel(excel_file, sheet_name=sheet_name)
                    excel_content += f"\n\n=== Sheet: {sheet_name} ===\n"
                    # Convert DataFrame to CSV-like text representation
                    excel_content += df.to_csv(index=False, na_rep="")
                
                print(f"[FastAPI] Excel file converted to text (length: {len(excel_content)} chars)")
                
                # Add Excel content to prompt
                file_type_context = "\n\nIMPORTANT: This is an Excel file. The file content is provided below as text. Read all worksheets, identify header rows, and extract all data rows as items. Pay special attention to column names and map them according to the mapping rules provided."
                full_prompt = prompt + file_type_context + "\n\nExcel File Content:\n" + excel_content
                
                # Generate content without file upload
                print(f"[FastAPI] Generating content with Gemini...")
                response = model.generate_content(
                    full_prompt,
                    generation_config={
                        # Ask the model to emit strict JSON
                        "response_mime_type": "application/json",
                    },
                )
            except Exception as excel_error:
                print(f"[FastAPI] Error reading Excel file: {excel_error}")
                raise HTTPException(status_code=400, detail=f"Failed to read Excel file: {str(excel_error)}")
        else:
            # For PDF files, upload to Gemini
            print(f"[FastAPI] Uploading file to Gemini...")
            gfile = genai.upload_file(tmp_path)
            print(f"[FastAPI] File uploaded to Gemini: {gfile.name}")
            
            file_type_context = "\n\nIMPORTANT: This is a PDF file. Extract text and tables carefully, identifying the client name, PO number, date, and all item rows."
            full_prompt = prompt + file_type_context
            
            # Generate content
            print(f"[FastAPI] Generating content with Gemini...")
            response = model.generate_content(
                [full_prompt, gfile],
                generation_config={
                    # Ask the model to emit strict JSON
                    "response_mime_type": "application/json",
                },
            )
        raw = response.text.strip()
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
            balanced = extract_balanced_json(cleaned)
            balanced = remove_trailing_commas(balanced)
            return balanced.strip()

        json_text = extract_json(raw)

        try:
            data = json.loads(json_text)
        except json.JSONDecodeError as json_error:
            # Second chance: aggressively quote keys and remove double-commas, then retry
            fallback = quote_unquoted_keys(json_text)
            fallback = re.sub(r",\s*,", ",", fallback)
            fallback = remove_trailing_commas(fallback)
            try:
                data = json.loads(fallback)
                json_text = fallback
            except Exception:
                print(f"[FastAPI] JSON parsing error: {json_error}")
                print(f"[FastAPI] Raw response (first 500 chars): {raw[:500]}")
                raise HTTPException(status_code=500, detail=f"Failed to parse JSON response: {str(json_error)}")

        # Ensure items array exists (rename lines to items if present)
        if "lines" in data and "items" not in data:
            data["items"] = data.pop("lines")
        data.setdefault("items", [])
        data.setdefault("total_entries", len(data["items"]))
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
        
        # Clean up Gemini uploaded file if it exists
        if gfile:
            try:
                genai.delete_file(gfile.name)
                print(f"[FastAPI] Gemini file deleted: {gfile.name}")
            except Exception as cleanup_error:
                print(f"[FastAPI] Warning: Failed to delete Gemini file {gfile.name}: {cleanup_error}")
