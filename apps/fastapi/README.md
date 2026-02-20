# Invoice Extraction API (FastAPI)

Supports two extraction backends (switch via env):

- **OpenAI (default)** – `gpt-4o`, uses `OPENAI_API_KEY`
- **Gemini** – `gemini-2.5-flash`, uses `GOOGLE_API_KEY`

Set `EXTRACTION_PROVIDER=gemini` to use Gemini; omit or set `EXTRACTION_PROVIDER=openai` for OpenAI gpt-4o. In both cases the full PDF is sent to the model for extraction (no local text extraction).

## 🚀 Deployment on Render

1. Push these files to GitHub.
2. Create new Web Service on Render.
3. Render scans `render.yaml`.
4. Add environment variables:
   - **OpenAI (default):** `OPENAI_API_KEY=your_openai_key`
   - **Gemini:** `EXTRACTION_PROVIDER=gemini` and `GOOGLE_API_KEY=your_google_key`
5. Deploy.

## 📡 API Endpoints

- GET / → Status (includes active extraction provider)
- GET /health → Health check
- POST /extract-invoice → Upload invoice PDF or Excel → JSON output

## 🧪 Local Run

```bash
pip install -r requirements.txt
# .env: OPENAI_API_KEY=... (for OpenAI) or EXTRACTION_PROVIDER=gemini and GOOGLE_API_KEY=... (for Gemini)
uvicorn main:app --reload
```
