
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

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

PROMPT = """
Extract all invoice/PO items in structured JSON.

Item fields:
- StyleCode
- Category
- ItemSize
- OrderQty
- Metal
- Tone
- ItemPoNo
- ItemRefNo
- StockType
- MakeType
- CustomerProductionInstruction
- SpecialRemarks
- DesignProductionInstruction
- StampInstruction

Global fields:
- total_value
- client_name
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
        data.setdefault("lines", [])
        data.setdefault("total_entries", len(data["lines"]))

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
