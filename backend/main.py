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
# Read allowed origins from environment variable (comma-separated string)
# Default to localhost for development if not set
allowed_origins_str = os.environ.get("ALLOWED_ORIGINS", "http://localhost:3000")

# Split the comma-separated string into a list
# Remove any leading/trailing whitespace from each origin
origins = [origin.strip() for origin in allowed_origins_str.split(',') if origin.strip()]

# Ensure localhost is present for local dev if using default
if allowed_origins_str == "http://localhost:3000" and "http://localhost:3000" not in origins:
    origins.append("http://localhost:3000")

# Remove potential duplicates just in case
origins = sorted(list(set(origins)))

print(f"Configuring CORS for origins: {origins}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins, # Use the dynamically generated list
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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