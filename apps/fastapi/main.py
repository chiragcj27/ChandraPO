import os, json, re, tempfile
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import google.generativeai as genai
from dotenv import load_dotenv

# Load API key
load_dotenv()
API_KEY = os.getenv("GOOGLE_API_KEY")
if not API_KEY:
    raise RuntimeError("Missing GOOGLE_API_KEY in .env file")

# Configure Gemini
genai.configure(api_key=API_KEY)

# Initialize FastAPI
app = FastAPI(title="Invoice Extraction API", version="1.0")

# Allow frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---- Extraction Prompt ----
PROMPT = """
You are an expert Purchase Order & Invoice parser.

Extract ALL line items from the input PDF or Excel table and return ONLY valid JSON.
Every item must strictly follow this schema:

{
  "StyleCode": "string",
  "Category": "Enum",
  "ItemSize": number,
  "OrderQty": number,
  "Metal": "Enum",
  "Tone": "Enum",
  "ItemPoNo": "string",
  "ItemRefNo": "string",
  "StockType": "Enum",
  "MakeType": "Enum",
  "CustomerProductionInstruction": "string",
  "SpecialRemarks": "string",
  "DesignProductionInstruction": "string",
  "StampInstruction": "string"
}

Your final output MUST be:

{
  "lines": [ ...ITEM_OBJECTS... ],
  "total_value": number,
  "client_name": "string",
  "invoice_number": "string",
  "total_entries": number,
  "invoice_date": "YYYY-MM-DD"
}

RULES & MAPPINGS:
- DO NOT change field names.
- If a field is missing: return "" for strings or 0 for numbers.
- “Style No” → StyleCode
- “Category” → Category
- “Size” → ItemSize
- “Qty” → OrderQty
- “Metal” → Metal (18KT → G18KT)
- “Color” → Tone (Y, R, W, YPT etc.)
- “Item PoNo” → ItemPoNo
- “Item Ref No” → ItemRefNo
- “Design Production Instruction” → DesignProductionInstruction
- “Customer Production Instruction” → CustomerProductionInstruction
- “Special Remarks” → SpecialRemarks
- “Stamp Instruction” → StampInstruction
- “Make Type” → MakeType
- “Stock Type” → StockType
- Extract invoice metadata from header.
- total_value = sum of “Total Price” fields.
- total_entries = count of items.
Return ONLY valid JSON.
"""

@app.post("/extract-invoice")
async def extract_invoice(file: UploadFile = File(...)):
    try:
        # Save uploaded file temporarily
        suffix = os.path.splitext(file.filename)[-1]
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp.write(await file.read())
            tmp_path = tmp.name

        model = genai.GenerativeModel("gemini-2.5-pro")
        gfile = genai.upload_file(tmp_path)

        response = model.generate_content([PROMPT, gfile])
        raw = response.text.strip()

        # Extract JSON from response
        match = re.search(r"\{[\s\S]*\}", raw)
        json_text = match.group(0) if match else raw
        data = json.loads(json_text)

        # Defaults
        data.setdefault("lines", [])
        data.setdefault("total_value", 0)
        data.setdefault("client_name", "")
        data.setdefault("invoice_number", "")
        data.setdefault("invoice_date", "")
        data.setdefault("total_entries", len(data["lines"]))

        return JSONResponse(content=data)

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Extraction failed: {e}")

    finally:
        if 'tmp_path' in locals() and os.path.exists(tmp_path):
            os.remove(tmp_path)

@app.get("/")
def home():
    return {"message": "Invoice Extraction API is running 🚀"}
