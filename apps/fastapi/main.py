
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

@app.post("/extract-invoice")
async def extract_invoice(file: UploadFile = File(...)):
    tmp_path = None
    try:
        suffix = os.path.splitext(file.filename)[-1]

        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp.write(await file.read())
            tmp_path = tmp.name

        model = genai.GenerativeModel("gemini-2.5-flash")
        gfile = genai.upload_file(tmp_path)

        response = model.generate_content([PROMPT, gfile])
        raw = response.text.strip()

        match = re.search(r"\{[\s\S]*}", raw)
        json_text = match.group(0) if match else raw

        data = json.loads(json_text)
        # Ensure items array exists (rename lines to items if present)
        if "lines" in data and "items" not in data:
            data["items"] = data.pop("lines")
        data.setdefault("items", [])
        data.setdefault("total_entries", len(data["items"]))

        return JSONResponse(content=data)

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        # Clean up temporary file
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.unlink(tmp_path)
            except Exception as cleanup_error:
                print(f"Warning: Failed to clean up temp file {tmp_path}: {cleanup_error}")

@app.get("/")
def home():
    return {"status": "Invoice API running 🚀"}
