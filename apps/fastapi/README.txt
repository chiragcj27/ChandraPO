INVOICE EXTRACTION API (Gemini 1.5 Pro)

FILES INCLUDED:
- main.py            → FastAPI backend
- requirements.txt   → Install dependencies
- .env.example       → Place your Google API key here
- README.txt         → Instructions

HOW TO RUN:
1. pip install -r requirements.txt
2. Create a .env file and paste:
   GOOGLE_API_KEY=your_key_here
3. Start server:
   uvicorn main:app --reload
4. Visit Swagger UI:
   http://127.0.0.1:8000/docs
