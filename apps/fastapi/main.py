
import os, json, re, tempfile
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import google.generativeai as genai
from dotenv import load_dotenv

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

PROMPT = """
Extract all invoice/PO items in structured JSON.

IMPORTANT: This Purchase Order is FROM a client TO Chandra Jewels Pvt Limited.
The client_name should be the sender/buyer (the client who is placing the order), NOT Chandra Jewels.
Chandra Jewels is the recipient/vendor, not the client.

VENDOR INFORMATION:
- The vendor is Chandra Jewels
- For all items, there will be two codes:
  1. VendorStyleCode: This is the vendor's (Chandra Jewels) style code
  2. ItemRefNo: This is the client's item reference number

Item fields:
- VendorStyleCode (vendor's style code from Chandra Jewels)
- Category
- ItemSize
- OrderQty
- Metal
- Tone
- ItemPoNo
- ItemRefNo (client's item reference number)
- StockType
- MakeType
- CustomerProductionInstruction
- SpecialRemarks
- DesignProductionInstruction
- StampInstruction

Global fields:
- total_value
- client_name (MUST be the buyer/client name, NOT Chandra Jewels)
- invoice_number
- total_entries
- invoice_date

Return ONLY valid JSON.
"""

@app.get("/health")
async def health_check():
    """Health check endpoint for Render"""
    return {"status": "healthy", "service": "FastAPI Invoice Extraction"}

@app.get("/")
def home():
    return {"status": "Invoice API running 🚀", "version": "1.0"}

@app.post("/extract-invoice")
async def extract_invoice(file: UploadFile = File(...)):
    tmp_path = None
    gfile = None
    start_time = os.times().elapsed if hasattr(os.times(), 'elapsed') else None
    
    try:
        print(f"[FastAPI] Starting extraction for file: {file.filename} (size: {file.size} bytes)")
        
        if not file.filename:
            raise HTTPException(status_code=400, detail="No filename provided")
        
        suffix = os.path.splitext(file.filename)[-1]
        if suffix.lower() != '.pdf':
            print(f"[FastAPI] Warning: File extension is {suffix}, expected .pdf")

        # Read file content
        file_content = await file.read()
        file_size = len(file_content)
        print(f"[FastAPI] File read successfully: {file_size} bytes")

        # Save to temporary file
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp.write(file_content)
            tmp_path = tmp.name
        
        print(f"[FastAPI] Temporary file created: {tmp_path}")

        # Upload to Gemini
        print(f"[FastAPI] Uploading file to Gemini...")
        model = genai.GenerativeModel("gemini-2.5-flash")
        gfile = genai.upload_file(tmp_path)
        print(f"[FastAPI] File uploaded to Gemini: {gfile.name}")

        # Generate content
        print(f"[FastAPI] Generating content with Gemini...")
        response = model.generate_content([PROMPT, gfile])
        raw = response.text.strip()
        print(f"[FastAPI] Content generated successfully (length: {len(raw)} chars)")

        # Parse JSON
        match = re.search(r"\{[\s\S]*}", raw)
        json_text = match.group(0) if match else raw
        
        try:
            data = json.loads(json_text)
        except json.JSONDecodeError as json_error:
            print(f"[FastAPI] JSON parsing error: {json_error}")
            print(f"[FastAPI] Raw response (first 500 chars): {raw[:500]}")
            raise HTTPException(status_code=500, detail=f"Failed to parse JSON response: {str(json_error)}")

        # Ensure items array exists (rename lines to items if present)
        if "lines" in data and "items" not in data:
            data["items"] = data.pop("lines")
        data.setdefault("items", [])
        data.setdefault("total_entries", len(data["items"]))

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
