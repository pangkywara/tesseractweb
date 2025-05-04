# Kelompok 3 - Tesseract OCR Web App

[![Demo](https://img.shields.io/badge/Demo-Visit%20Live%20App-blue?style=for-the-badge&logo=vercel)](https://pangkywara.xyz)

This project is a web application that performs Optical Character Recognition (OCR) on uploaded images using Tesseract. It features a Next.js frontend and a FastAPI backend, with results optionally saved to a Supabase database.

## Features

*   **Image Upload:** Upload JPEG/PNG images via drag-and-drop or file selector.
*   **Multi-language OCR:** Supports English (`eng`) and Indonesian (`ind`) text recognition.
*   **Bounding Box Display:** Shows recognized words overlaid on the processed image.
*   **Text Extraction:** Provides the full extracted text and allows copying individual words.
*   **Database Integration (Optional):** Option to save extracted text results to Supabase.
*   **Dockerized Backend:** Backend is containerized with Docker for deployment consistency.
*   **Image Type Detection:** Allows specifying if the image is a general document or a chat screenshot for potentially different preprocessing/PSM settings.

## Technology Stack

*   **Frontend:** Next.js, React, TypeScript, Tailwind CSS, shadcn/ui
*   **Backend:** FastAPI, Python, Pytesseract, OpenCV-Python, Uvicorn, Gunicorn
*   **Database:** Supabase (PostgreSQL)
*   **Deployment:** Docker, Render (or similar platform)

## Setup and Installation

### Prerequisites

*   Node.js (v18 or later recommended)
*   npm or pnpm or yarn
*   Python (v3.11 recommended)
*   pip
*   Git
*   Docker (for building/running the backend container)
*   Supabase Account (optional, for database saving)
*   Tesseract Installation (for local backend development - see [Tesseract Docs](https://tesseract-ocr.github.io/tessdoc/Installation.html))

### Installation Steps

1.  **Clone the repository:**
    ```bash
    git clone <your-repository-url>
    cd <repository-folder>
    ```

2.  **Backend Setup:**
    ```bash
    cd backend

    # Create and activate a virtual environment (recommended)
    python -m venv .venv
    # On Windows
    .\.venv\Scripts\activate
    # On macOS/Linux
    # source .venv/bin/activate

    # Install Python dependencies
    pip install -r requirements.txt

    # Create a .env file from .env.example (if provided) or manually
    # Add your Supabase URL and Anon Key if using the DB feature
    # Example .env:
    # SUPABASE_URL="your_supabase_url"
    # SUPABASE_ANON_KEY="your_supabase_anon_key"
    # ALLOWED_ORIGINS="http://localhost:3000,https://your-frontend-domain.com" # Add your frontend URL for CORS

    cd ..
    ```
    *Note: For local backend development without Docker, ensure Tesseract is installed and its `tessdata` folder (containing `eng.traineddata` and `ind.traineddata`) is accessible. You might need to set the `TESSDATA_PREFIX` environment variable locally.* 

3.  **Frontend Setup:**
    ```bash
    cd frontend

    # Install Node.js dependencies
    npm install
    # or pnpm install or yarn install

    # Create a .env.local file
    # Add your backend API URL
    # Example .env.local:
    # NEXT_PUBLIC_API_URL="http://127.0.0.1:8000" # Local backend
    # Or use your deployed backend URL: NEXT_PUBLIC_API_URL="https://your-backend.onrender.com"

    cd ..
    ```

## Running the Application

1.  **Run the Backend:**
    *   **Using Docker (Recommended for consistency):**
        ```bash
        cd backend
        # Build the Docker image (only needed once or after changes)
        docker build -t pbo-tesseract-backend .
        # Run the Docker container
        docker run -p 8000:8000 --env-file .env pbo-tesseract-backend
        ```
    *   **Locally (Requires Tesseract installed):**
        ```bash
        cd backend
        # Ensure virtual environment is active
        # Ensure .env file is configured
        uvicorn main:app --reload --port 8000
        ```
    The backend API will be running at `http://127.0.0.1:8000`.

2.  **Run the Frontend:**
    ```bash
    cd frontend
    # Ensure .env.local points to the correct backend URL
    npm run dev
    # or pnpm dev or yarn dev
    ```
    The frontend development server will be running at `http://localhost:3000`.

## Deployment

*   **Backend:** The backend is designed to be deployed as a Docker container (see `backend/Dockerfile`). Platforms like Render can build and deploy directly from this Dockerfile.
    *   **Environment Variables:** Ensure `SUPABASE_URL`, `SUPABASE_ANON_KEY` (if used), `ALLOWED_ORIGINS` (set to your deployed frontend URL), and `PORT` (usually provided by the platform) are configured in the deployment environment.
    *   `TESSDATA_PREFIX` is set within the Dockerfile.
*   **Frontend:** The Next.js frontend can be deployed to platforms like Vercel or Render (as a Static Site or Web Service).
    *   **Environment Variables:** Ensure `NEXT_PUBLIC_API_URL` is set to the deployed backend URL during the build process.

## Live Demo

Check out the live version deployed at: **[pangkywara.xyz](https://pangkywara.xyz)** 