# Placeholder for FastAPI app 
from fastapi import FastAPI
from .routers import ocr_routes
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import os

# Basic FastAPI app setup
app = FastAPI(
    title="Tesseract OCR API",
    description="API to perform OCR on images using Tesseract and store results.",
    version="0.1.0"
)

# CORS Configuration
# Read the frontend URL from environment variable, default to localhost for development
frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:3000")
pangkywara_domain = "https://pangkywara.xyz"

origins = [
    frontend_url, # From environment variable (Render)
    "http://localhost:3000", # Local Next.js dev server
    pangkywara_domain # Explicitly add your domain
]
# Remove duplicates if frontend_url is one of the others
origins = list(set(origins))

print(f"Allowed CORS origins: {origins}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"], # Allows all methods (GET, POST, etc.)
    allow_headers=["*"] # Allows all headers
)

# Include routers
app.include_router(ocr_routes.router, prefix="/ocr", tags=["OCR"])

@app.get("/", tags=["Root"])
def read_root():
    return {"message": "Welcome to the Tesseract OCR API"}

# --- How to Run --- #
# 1. Ensure you are in the 'backend' directory in your terminal.
# 2. Make sure your virtual environment (.venv) is activated.
# 3. Make sure you have created the .env file with SUPABASE_URL, SUPABASE_ANON_KEY, and TESSERACT_CMD.
# 4. Run with Uvicorn: uvicorn main:app --reload
#    - The API will be available at http://127.0.0.1:8000
#    - The --reload flag automatically restarts the server when code changes.

# Example to run programmatically (useful for some deployment scenarios, but uvicorn command is typical for dev)
# if __name__ == "__main__":
#     port = int(os.getenv("PORT", 8000)) # Default to 8000 if PORT env var not set
#     uvicorn.run(app, host="0.0.0.0", port=port) 