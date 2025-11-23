
# Invoice Extraction API (FastAPI + Gemini)

## 🚀 Deployment on Render

1. Push these files to GitHub.
2. Create new Web Service on Render.
3. Render scans `render.yaml`.
4. Add environment variable:
   GOOGLE_API_KEY=your_key_here
5. Deploy.

## 📡 API Endpoints
- GET / → Status
- POST /extract-invoice → Upload invoice PDF → JSON output

## 🧪 Local Run
pip install -r requirements.txt
uvicorn main:app --reload
