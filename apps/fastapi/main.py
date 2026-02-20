import os
import json
import re
import tempfile
from typing import Any, Dict, List, Tuple

import httpx
import pandas as pd
import pdfplumber
import requests
from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from openai import OpenAI

load_dotenv()

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
if not OPENAI_API_KEY:
    raise RuntimeError("Missing OPENAI_API_KEY inside .env")

# Configure OpenAI client with explicit HTTPX timeout
# Timeout should be a tuple: (connect_timeout, read_timeout) or a single float for both
openai_timeout_seconds = float(os.getenv("OPENAI_TIMEOUT_SECONDS", "300"))  # Default 5 minutes
openai_timeout = httpx.Timeout(
    connect=10.0,  # 10 seconds to establish connection
    read=openai_timeout_seconds,  # 5 minutes to read response
    write=30.0,  # 30 seconds to write request
    pool=10.0,  # 10 seconds to get connection from pool
)
openai_client = OpenAI(
    api_key=OPENAI_API_KEY,
    timeout=openai_timeout,
)
print(f"[FastAPI] OpenAI client initialized with timeout: connect=10s, read={openai_timeout_seconds}s")

app = FastAPI(title="PO Extraction API", version="2.0")

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


PO_EXTRACTION_SCHEMA: Dict[str, Any] = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "po": {
            "type": "object",
            "additionalProperties": False,
            "properties": {
                "poNumber": {"type": "string"},
                "poDate": {"type": "string"},
                "clientName": {"type": "string"},
                "totalItems": {"type": "integer", "minimum": 0},
                "incompleteItems": {"type": "integer", "minimum": 0},
                "totalValue": {"type": "number", "minimum": 0},
                "status": {"type": "string", "enum": ["PENDING"]},
            },
            "required": [
                "poNumber",
                "poDate",
                "clientName",
                "totalItems",
                "incompleteItems",
                "totalValue",
                "status",
            ],
        },
        "items": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "isIncomplete": {"type": "boolean"},
                    "vendorStyleCode": {"type": "string"},
                    "itemRefNo": {"type": "string"},
                    "itemPoNo": {"type": "string"},
                    "orderQty": {"type": "number", "minimum": 0},
                    "metal": {
                        "type": "string",
                        "enum": ["14K", "18K", "PLATINUM", ""],
                    },
                    "tone": {
                        "type": "string",
                        "enum": ["YELLOW", "WHITE", "ROSE", ""],
                    },
                    "category": {"type": "string"},
                    "stockType": {"type": ["string", "null"]},
                    "makeType": {"type": ["string", "null"]},
                    "customerProductionInstruction": {
                        "type": ["string", "null"]
                    },
                    "specialRemarks": {"type": ["string", "null"]},
                    "designProductionInstruction": {
                        "type": ["string", "null"]
                    },
                    "stampInstruction": {"type": ["string", "null"]},
                    "itemSize": {"type": ["string", "null"]},
                    "deadlineDate": {"type": ["string", "null"]},
                    "shippingDate": {"type": ["string", "null"]},
                    "invoiceNumber": {"type": "string"},
                },
                "required": [
                    "isIncomplete",
                    "vendorStyleCode",
                    "itemRefNo",
                    "itemPoNo",
                    "orderQty",
                    "metal",
                    "tone",
                    "category",
                    "stockType",
                    "makeType",
                    "customerProductionInstruction",
                    "specialRemarks",
                    "designProductionInstruction",
                    "stampInstruction",
                    "itemSize",
                    "deadlineDate",
                    "shippingDate",
                    "invoiceNumber",
                ],
            },
        },
    },
    "required": ["po", "items"],
}


OPENAI_SYSTEM_PROMPT = """
You extract purchase order (PO) data from raw document text (PDF or Excel that has been converted to text).

Your job is to produce JSON that is READY TO INSERT into the following MongoDB schemas, without any extra keys:

PO Schema (top-level "po" field):
{
  poNumber: String (required),
  poDate: Date (string, required),
  clientName: String (required),
  totalItems: Number (required),
  incompleteItems: Number (required),
  totalValue: Number (required),
  status: String (required, always "PENDING")
}

PO Item Schema (array "items"):
{
  isIncomplete: Boolean (default true),
  vendorStyleCode: String,
  itemRefNo: String,
  itemPoNo: String,
  orderQty: Number,
  metal: String,
  tone: String,
  category: String,
  stockType: String | null,
  makeType: String | null,
  customerProductionInstruction: String | null,
  specialRemarks: String | null,
  designProductionInstruction: String | null,
  stampInstruction: String | null,
  itemSize: String | null,
  deadlineDate: Date | null (string or null),
  shippingDate: Date | null (string or null),
  invoiceNumber: String,
  isIncomplete: Boolean
}

You must return JSON with this EXACT structure (no extra keys):
{
  "po": {
    "poNumber": "",
    "poDate": "",
    "clientName": "",
    "totalItems": 0,
    "incompleteItems": 0,
    "totalValue": 0,
    "status": "PENDING"
  },
  "items": [
    {
      "vendorStyleCode": "",
      "itemRefNo": "",
      "itemPoNo": "",
      "orderQty": 0,
      "metal": "",
      "tone": "",
      "category": "",
      "stockType": null,
      "makeType": null,
      "customerProductionInstruction": null,
      "specialRemarks": null,
      "designProductionInstruction": null,
      "stampInstruction": null,
      "itemSize": null,
      "deadlineDate": null,
      "shippingDate": null,
      "invoiceNumber": "",
      "isIncomplete": true
    }
  ]
}

FIELD MAPPING RULES (CRITICAL):
- "PO number" in the document -> po.poNumber
- "Order date" / "PO date" in the document -> po.poDate (string)
- "Buyer" / "Client" in the header -> po.clientName
- "Grand total" / "Total" monetary value -> po.totalValue
- Number of line items -> po.totalItems (must equal items.length)
- po.incompleteItems = count of items where isIncomplete = true
- po.status must ALWAYS be "PENDING"

For items:
- "Vendor Item #", "Style Code", "Style#", etc. -> vendorStyleCode
- "Serial", "Ref", "Job #", etc. -> itemRefNo
- Per-line PO number, if present -> itemPoNo
- Quantity column -> orderQty
- Extract metal from description or dedicated column:
    - metal must be one of: "14K", "18K", "PLATINUM", "".
    - Look for 14K, 18K, or words like "PLATINUM" / "PT".
    - If metal is not clearly present, use "" (empty string) and do NOT guess.
- Derive tone from description:
    - tone must be one of: "YELLOW", "WHITE", "ROSE", "".
    - Map "14KY", "YEL", "Yellow" -> "YELLOW".
    - Map "14KW", "White" -> "WHITE".
    - Map "14KR", "Rose" -> "ROSE".
    - If unclear, set tone to "".
- Category:
    - Infer from clear keywords only: "Ring", "Bracelet", "Pendant", "Earring".
    - If not clearly one of these, use "" (empty string).
- Size columns -> itemSize.
- Special instructions / comments -> specialRemarks.
- Stamping text -> stampInstruction.

DEFAULTS AND SAFETY RULES:
- isIncomplete = true for all items by default.
- invoiceNumber (per item) = "" unless clearly present.
- stockType and makeType are null unless they are EXPLICITLY named.
- deadlineDate and shippingDate are null unless an explicit date is clearly linked to that line item.
- NEVER guess missing data.
- Do NOT fabricate invoice numbers.
- Do NOT invent metals or tones; use "" when unsure.
- Do NOT merge rows.
- Do NOT change quantities unless clearly visible.
- If a field is unclear or ambiguous, use null (for nullable fields) or "" (for strings) rather than guessing.

You receive ONLY cleaned text, not the raw PDF/Excel. Use headings, tables, and context to find the correct fields.
Return JSON only, no prose or comments.
"""


def clean_pdf_text(path: str) -> str:
    """
    Extract text from a PDF using pdfplumber and remove repeated headers/footers.
    """
    pages_text: List[List[str]] = []
    with pdfplumber.open(path) as pdf:
        for page in pdf.pages:
            text = page.extract_text() or ""
            lines = [line.strip() for line in text.splitlines() if line.strip()]
            pages_text.append(lines)

    # Identify lines that appear on most pages (likely headers/footers)
    line_frequency: Dict[str, int] = {}
    for lines in pages_text:
        unique_lines = set(lines)
        for line in unique_lines:
            line_frequency[line] = line_frequency.get(line, 0) + 1

    total_pages = max(len(pages_text), 1)
    header_footer_candidates = {
        line
        for line, count in line_frequency.items()
        if count / total_pages >= 0.8 and len(line) < 200
    }

    cleaned_lines: List[str] = []
    for lines in pages_text:
        for line in lines:
            if line in header_footer_candidates:
                continue
            cleaned_lines.append(line)

    # Remove consecutive duplicate lines
    deduped_lines: List[str] = []
    last_line = None
    for line in cleaned_lines:
        if line != last_line:
            deduped_lines.append(line)
        last_line = line

    return "\n".join(deduped_lines)


def extract_excel_text(path: str) -> str:
    """
    Convert Excel file into CSV-like text for LLM consumption.
    """
    excel_content = ""
    excel_file = pd.ExcelFile(path)
    for sheet_name in excel_file.sheet_names:
        df = pd.read_excel(excel_file, sheet_name=sheet_name)
        excel_content += f"\n\n=== Sheet: {sheet_name} ===\n"
        excel_content += df.to_csv(index=False, na_rep="")
    return excel_content


def validate_extraction(result: Dict[str, Any]) -> List[str]:
    """
    Validate extracted PO against business rules.
    Returns a list of human-readable error messages (empty if valid).
    """
    errors: List[str] = []

    po = result.get("po") or {}
    items = result.get("items") or []

    if not po.get("poNumber"):
        errors.append("po.poNumber is required")
    if not po.get("poDate"):
        errors.append("po.poDate is required")
    if not po.get("clientName"):
        errors.append("po.clientName is required")

    total_items = po.get("totalItems")
    if isinstance(total_items, int):
        if total_items != len(items):
            errors.append(
                f"po.totalItems ({total_items}) does not match number of items ({len(items)})"
            )
    else:
        errors.append("po.totalItems must be an integer")

    total_value = po.get("totalValue")
    if total_value is None:
        errors.append("po.totalValue is missing")
    elif isinstance(total_value, (int, float)) and total_value < 0:
        errors.append("po.totalValue cannot be negative")

    # Order quantity and duplicates
    seen_keys = set()
    for idx, item in enumerate(items):
        qty = item.get("orderQty")
        if qty is None:
            errors.append(f"items[{idx}].orderQty is missing")
        elif isinstance(qty, (int, float)) and qty < 0:
            errors.append(f"items[{idx}].orderQty cannot be negative")

        key = (item.get("vendorStyleCode") or "", item.get("itemRefNo") or "")
        if key != ("", ""):
            if key in seen_keys:
                errors.append(
                    f"Duplicate item with vendorStyleCode+itemRefNo = {key!r}"
                )
            else:
                seen_keys.add(key)

    return errors


def compute_confidence(result: Dict[str, Any]) -> Tuple[float, bool]:
    """
    Compute confidence score and needsReview flag based on heuristics.
    """
    po = result.get("po") or {}
    items = result.get("items") or []

    confidence = 1.0

    # 0.3 if item count mismatch
    total_items = po.get("totalItems")
    if not isinstance(total_items, int) or total_items != len(items):
        confidence -= 0.3

    # 0.2 if totalValue missing
    if "totalValue" not in po or po.get("totalValue") is None:
        confidence -= 0.2

    # 0.1 if >20% items have missing critical fields
    if items:
        critical_missing = 0
        for item in items:
            if not item.get("vendorStyleCode") or item.get("orderQty", 0) == 0:
                critical_missing += 1
        if critical_missing / len(items) > 0.2:
            confidence -= 0.1

    # 0.1 if duplicate items
    seen_keys = set()
    has_duplicates = False
    for item in items:
        key = (item.get("vendorStyleCode") or "", item.get("itemRefNo") or "")
        if key != ("", ""):
            if key in seen_keys:
                has_duplicates = True
                break
            seen_keys.add(key)
    if has_duplicates:
        confidence -= 0.1

    confidence = max(0.0, min(1.0, confidence))
    needs_review = confidence < 0.8
    return confidence, needs_review


def normalize_extraction_shape(raw: Dict[str, Any]) -> Dict[str, Any]:
    """
    Ensure the extraction strictly follows the target shape with defaults applied.
    """
    po_raw = raw.get("po") or {}
    items_raw = raw.get("items") or []

    po: Dict[str, Any] = {
        "poNumber": str(po_raw.get("poNumber") or "").strip(),
        "poDate": str(po_raw.get("poDate") or "").strip(),
        "clientName": str(po_raw.get("clientName") or "").strip(),
        "totalItems": int(po_raw.get("totalItems") or len(items_raw)),
        "incompleteItems": int(po_raw.get("incompleteItems") or len(items_raw)),
        "totalValue": float(po_raw.get("totalValue") or 0),
        "status": "PENDING",
    }

    normalized_items: List[Dict[str, Any]] = []
    for item in items_raw:
        normalized_items.append(
            {
                "vendorStyleCode": str(item.get("vendorStyleCode") or "").strip(),
                "itemRefNo": str(item.get("itemRefNo") or "").strip(),
                "itemPoNo": str(item.get("itemPoNo") or "").strip(),
                "orderQty": float(item.get("orderQty") or 0),
                "metal": item.get("metal") or "",
                "tone": item.get("tone") or "",
                "category": str(item.get("category") or "").strip(),
                "stockType": item.get("stockType"),
                "makeType": item.get("makeType"),
                "customerProductionInstruction": item.get(
                    "customerProductionInstruction"
                ),
                "specialRemarks": item.get("specialRemarks"),
                "designProductionInstruction": item.get(
                    "designProductionInstruction"
                ),
                "stampInstruction": item.get("stampInstruction"),
                "itemSize": item.get("itemSize"),
                "deadlineDate": item.get("deadlineDate"),
                "shippingDate": item.get("shippingDate"),
                "invoiceNumber": str(item.get("invoiceNumber") or "").strip(),
                "isIncomplete": bool(
                    item.get("isIncomplete")
                    if isinstance(item.get("isIncomplete"), bool)
                    else True
                ),
            }
        )

    # Recompute totals from normalized items
    po["totalItems"] = len(normalized_items)
    po["incompleteItems"] = sum(
        1 for item in normalized_items if item.get("isIncomplete", True)
    )

    return {"po": po, "items": normalized_items}


def build_user_prompt(clean_text: str) -> str:
    # Limit text size to avoid API timeouts (OpenAI has token limits)
    # Keep last 200k chars to preserve most recent/relevant data (usually items are at the end)
    MAX_TEXT_LENGTH = 200000
    if len(clean_text) > MAX_TEXT_LENGTH:
        print(f"[FastAPI] Warning: Text too long ({len(clean_text)} chars), truncating to last {MAX_TEXT_LENGTH} chars")
        clean_text = clean_text[-MAX_TEXT_LENGTH:]
    
    return (
        "You are given the following cleaned text content of a purchase order.\n"
        "Extract the PO and its line items according to the instructions.\n\n"
        "DOCUMENT TEXT START\n"
        f"{clean_text}\n"
        "DOCUMENT TEXT END\n"
    )


def call_openai_with_schema(clean_text: str, previous_errors: List[str] | None = None) -> Dict[str, Any]:
    """
    Call OpenAI with json_schema structured output to extract PO data.
    """
    user_prompt = build_user_prompt(clean_text)
    if previous_errors:
        error_block = (
            "\n\nYou previously returned JSON that failed validation.\n"
            "Errors:\n"
            + "\n".join(f"- {e}" for e in previous_errors)
            + "\n\nFix only the invalid parts. Do not remove valid items. "
              "Return corrected JSON only."
        )
        user_prompt += error_block

    try:
        # Log before API call for debugging
        prompt_length = len(user_prompt)
        print(f"[FastAPI] Calling OpenAI API: prompt_length={prompt_length} chars, model=gpt-4o-mini")
        print(f"[FastAPI] System prompt length: {len(OPENAI_SYSTEM_PROMPT)} chars")
        
        # Use Chat Completions API with structured outputs (JSON Schema).
        # The Responses API doesn't support response_format, so we use chat.completions instead.
        import time
        start_time = time.time()
        
        # Try with structured outputs first
        try:
            print("[FastAPI] Attempting API call with json_schema structured output...")
            print(f"[FastAPI] Timeout configured: (10.0, {openai_timeout_seconds})")
            
            # Make the API call with explicit timeout
            response = openai_client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {
                        "role": "system",
                        "content": OPENAI_SYSTEM_PROMPT.strip(),
                    },
                    {
                        "role": "user",
                        "content": user_prompt,
                    },
                ],
                temperature=0,
                response_format={
                    "type": "json_schema",
                    "json_schema": {
                        "name": "po_extraction",
                        "schema": PO_EXTRACTION_SCHEMA,
                        "strict": True,
                    },
                },
                timeout=openai_timeout,  # Use configured timeout
            )
            print("[FastAPI] API call with structured output succeeded")
        except Exception as structured_error:
            error_type = type(structured_error).__name__
            error_msg = str(structured_error)
            print(f"[FastAPI] Structured output failed ({error_type}): {error_msg}")
            print("[FastAPI] Falling back to regular JSON mode...")
            
            # Fallback: use JSON mode without strict schema
            response = openai_client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {
                        "role": "system",
                        "content": OPENAI_SYSTEM_PROMPT.strip() + "\n\nIMPORTANT: You must return ONLY valid JSON matching the schema. No markdown, no code fences, just pure JSON.",
                    },
                    {
                        "role": "user",
                        "content": user_prompt,
                    },
                ],
                temperature=0,
                response_format={"type": "json_object"},
                timeout=openai_timeout,  # Use configured timeout
            )
            print("[FastAPI] Fallback API call succeeded")
        
        elapsed = time.time() - start_time
        print(f"[FastAPI] OpenAI API call completed in {elapsed:.2f}s")
        
    except Exception as e:
        error_type = type(e).__name__
        error_msg = str(e)
        print(f"[FastAPI] OpenAI API call failed: {error_type}: {error_msg}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500, detail=f"OpenAI extraction failed: {error_type}: {error_msg}"
        )

    try:
        # With structured outputs using response_format, JSON is in message.content
        if not response.choices or len(response.choices) == 0:
            raise ValueError("OpenAI response has no choices")
        
        message = response.choices[0].message
        print(f"[FastAPI] Processing response: finish_reason={getattr(message, 'finish_reason', 'unknown')}")
        
        # Check for refusal
        if hasattr(message, "refusal") and message.refusal:
            raise ValueError(f"OpenAI refused to generate content: {message.refusal}")
        
        # Get content (should be valid JSON with structured outputs or json_object mode)
        content = message.content
        if not content:
            raise ValueError("Empty OpenAI response content")
        
        print(f"[FastAPI] Received response content (length={len(content)} chars)")
        print(f"[FastAPI] Content preview (first 500 chars): {content[:500]}")
        print(f"[FastAPI] Content preview (last 500 chars): {content[-500:]}")
        
        # Clean content: remove markdown code fences if present
        cleaned_content = content.strip()
        if cleaned_content.startswith("```"):
            # Remove ```json or ``` prefix
            first_newline = cleaned_content.find("\n")
            if first_newline != -1:
                cleaned_content = cleaned_content[first_newline + 1 :]
            cleaned_content = cleaned_content.strip()
            if cleaned_content.endswith("```"):
                cleaned_content = cleaned_content[: -3].strip()
        
        # Check if JSON looks complete (ends with } or ])
        if not (cleaned_content.rstrip().endswith("}") or cleaned_content.rstrip().endswith("]")):
            print(f"[FastAPI] WARNING: JSON may be incomplete. Last 100 chars: {cleaned_content[-100:]}")
        
        # Parse JSON from content
        try:
            parsed_json = json.loads(cleaned_content)
            print(f"[FastAPI] Successfully parsed JSON: po keys={list(parsed_json.get('po', {}).keys())}, items count={len(parsed_json.get('items', []))}")
            return parsed_json
        except json.JSONDecodeError as json_err:
            print(f"[FastAPI] JSON decode error at line {json_err.lineno}, col {json_err.colno}, pos {json_err.pos}: {json_err.msg}")
            error_start = max(0, json_err.pos - 200)
            error_end = min(len(cleaned_content), json_err.pos + 200)
            print(f"[FastAPI] Problematic content around error (chars {error_start}:{error_end}):")
            print(f"[FastAPI] {cleaned_content[error_start:error_end]}")
            print(f"[FastAPI] Full content length: {len(cleaned_content)}")
            raise HTTPException(
                status_code=500,
                detail=f"Failed to parse OpenAI JSON response: {json_err.msg} at line {json_err.lineno}, column {json_err.colno}",
            )
    except HTTPException:
        raise
    except Exception as e:
        error_type = type(e).__name__
        error_msg = str(e)
        print(f"[FastAPI] Unexpected error parsing response: {error_type}: {error_msg}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to parse OpenAI structured output: {error_type}: {error_msg}",
        )

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "FastAPI PO Extraction"}

@app.get("/test-openai")
async def test_openai():
    """Test OpenAI API connection"""
    try:
        import time
        start = time.time()
        print("[FastAPI] Testing OpenAI connection...")
        
        response = openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": "Say 'OK'"}],
            max_tokens=10,
            timeout=openai_timeout,
        )
        
        elapsed = time.time() - start
        content = response.choices[0].message.content if response.choices else "No response"
        return {
            "status": "success",
            "response": content,
            "time_elapsed": f"{elapsed:.2f}s",
            "timeout_configured": True,
        }
    except Exception as e:
        return {
            "status": "error",
            "error": str(e),
            "error_type": type(e).__name__,
        }

@app.get("/")
def home():
    return {"status": "PO Extraction API running 🚀", "version": "2.0"}

def _run_extraction_pipeline(file_path: str, suffix: str) -> Dict[str, Any]:
    """
    Shared extraction pipeline for both direct upload and S3-based endpoints.
    """
    if suffix in [".xlsx", ".xls"]:
        print("[FastAPI] Converting Excel file to text...")
        clean_text = extract_excel_text(file_path)
    elif suffix == ".pdf":
        print("[FastAPI] Extracting and cleaning PDF text...")
        clean_text = clean_pdf_text(file_path)
    else:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {suffix}. Supported types: .pdf, .xlsx, .xls",
        )

    # Call OpenAI with validation + repair loop
    attempts = 0
    max_attempts = 3
    last_result: Dict[str, Any] | None = None
    last_errors: List[str] = []

    while attempts < max_attempts:
        print(f"[FastAPI] Calling OpenAI (attempt {attempts + 1}/{max_attempts})...")
        try:
            raw_result = call_openai_with_schema(
                clean_text, previous_errors=last_errors if attempts > 0 else None
            )
            print(f"[FastAPI] Raw result received: po keys={list(raw_result.get('po', {}).keys())}, items count={len(raw_result.get('items', []))}")
            
            normalized = normalize_extraction_shape(raw_result)
            print(f"[FastAPI] Normalized result: po keys={list(normalized.get('po', {}).keys())}, items count={len(normalized.get('items', []))}")
            
            errors = validate_extraction(normalized)
            print(f"[FastAPI] Validation errors: {len(errors)} errors")
            if errors:
                print(f"[FastAPI] Validation error details: {errors[:5]}")  # Show first 5 errors
            
            last_result = normalized
            last_errors = errors

            if not errors:
                break
        except Exception as e:
            error_type = type(e).__name__
            error_msg = str(e)
            print(f"[FastAPI] Error in extraction attempt {attempts + 1}: {error_type}: {error_msg}")
            import traceback
            traceback.print_exc()
            # If this is the last attempt, re-raise
            if attempts == max_attempts - 1:
                raise HTTPException(
                    status_code=500,
                    detail=f"Extraction failed after {max_attempts} attempts: {error_type}: {error_msg}",
                )
            # Otherwise, continue to next attempt
            attempts += 1
            continue

        attempts += 1

    if last_result is None:
        raise HTTPException(
            status_code=500, detail="Extraction failed: no result from OpenAI"
        )

    confidence, needs_review = compute_confidence(last_result)
    if last_errors:
        needs_review = True

    return {
        "po": last_result["po"],
        "items": last_result["items"],
        "confidence": confidence,
        "needsReview": needs_review,
    }


@app.post("/extract-invoice")
async def extract_invoice(
    file: UploadFile = File(...),
    client_name: str | None = Form(None),  # Kept for backward compatibility, not used
    mapping_text: str | None = Form(None),  # Kept for backward compatibility, not used
    expected_items: int | None = Form(None),  # Kept for backward compatibility, not used
):
    tmp_path = None

    try:
        print(
            f"[FastAPI] Starting PO extraction for file: {file.filename} (size: {file.size} bytes)"
        )

        if not file.filename:
            raise HTTPException(status_code=400, detail="No filename provided")

        suffix = os.path.splitext(file.filename)[-1].lower()
        supported_extensions = [".pdf", ".xlsx", ".xls"]
        if suffix not in supported_extensions:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file type: {suffix}. Supported types: {', '.join(supported_extensions)}",
            )

        file_content = await file.read()
        file_size = len(file_content)
        print(f"[FastAPI] File read successfully: {file_size} bytes")

        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp.write(file_content)
            tmp_path = tmp.name

        print(f"[FastAPI] Temporary file created: {tmp_path}")

        result = _run_extraction_pipeline(tmp_path, suffix)
        print(
            f"[FastAPI] Extraction completed successfully: items={len(result['items'])}, confidence={result['confidence']:.2f}, needsReview={result['needsReview']}"
        )
        return JSONResponse(content=result)

    except HTTPException:
        raise
    except Exception as e:
        error_msg = str(e)
        error_type = type(e).__name__
        print(f"[FastAPI] Error during extraction: {error_type}: {error_msg}")
        import traceback

        traceback.print_exc()
        raise HTTPException(
            status_code=500, detail=f"Extraction failed: {error_type}: {error_msg}"
        )
    finally:
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.unlink(tmp_path)
                print(f"[FastAPI] Temporary file deleted: {tmp_path}")
            except Exception as cleanup_error:
                print(
                    f"[FastAPI] Warning: Failed to clean up temp file {tmp_path}: {cleanup_error}"
                )


@app.post("/extract-invoice-from-s3")
async def extract_invoice_from_s3(
    s3_url: str = Form(...),
    filename: str = Form(...),
    client_name: str | None = Form(None),  # Backward compatibility, not used
    mapping_text: str | None = Form(None),  # Backward compatibility, not used
    expected_items: int | None = Form(None),  # Backward compatibility, not used
):
    """
    Extract PO data from a file stored in S3 using a signed URL.
    This endpoint downloads the file from S3 and processes it the same way as /extract-invoice.
    """
    tmp_path = None

    try:
        print(f"[FastAPI] Starting extraction from S3 URL: {filename}")

        if not filename:
            raise HTTPException(status_code=400, detail="No filename provided")

        suffix = os.path.splitext(filename)[-1].lower()
        supported_extensions = [".pdf", ".xlsx", ".xls"]
        if suffix not in supported_extensions:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file type: {suffix}. Supported types: {', '.join(supported_extensions)}",
            )

        print(f"[FastAPI] Downloading file from S3 URL...")
        try:
            response = requests.get(s3_url, timeout=60, stream=True)
            response.raise_for_status()
            file_content = response.content
            file_size = len(file_content)
            print(f"[FastAPI] File downloaded successfully: {file_size} bytes")
        except requests.RequestException as download_error:
            print(f"[FastAPI] Error downloading file from S3: {download_error}")
            raise HTTPException(
                status_code=400,
                detail=f"Failed to download file from S3: {str(download_error)}",
            )

        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp.write(file_content)
            tmp_path = tmp.name

        print(f"[FastAPI] Temporary file created: {tmp_path}")

        result = _run_extraction_pipeline(tmp_path, suffix)
        print(
            f"[FastAPI] Extraction from S3 completed successfully: items={len(result['items'])}, confidence={result['confidence']:.2f}, needsReview={result['needsReview']}"
        )
        return JSONResponse(content=result)

    except HTTPException:
        raise
    except Exception as e:
        error_msg = str(e)
        error_type = type(e).__name__
        print(f"[FastAPI] Error during extraction from S3: {error_type}: {error_msg}")
        import traceback

        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Extraction from S3 failed: {error_type}: {error_msg}",
        )
    finally:
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.unlink(tmp_path)
                print(f"[FastAPI] Temporary file deleted: {tmp_path}")
            except Exception as cleanup_error:
                print(
                    f"[FastAPI] Warning: Failed to clean up temp file {tmp_path}: {cleanup_error}"
                )