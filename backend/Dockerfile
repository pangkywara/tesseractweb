FROM python:3.11-slim

# Set environment variables to non-interactive (avoids prompts during build)
ENV DEBIAN_FRONTEND=noninteractive

# Install system dependencies
# - Tesseract OCR core engine
# - libgl1-mesa-glx: Required by OpenCV (cv2) for libGL.so.1
# REMOVED language packs tesseract-ocr-eng and tesseract-ocr-ind from here
RUN apt-get update && \
    apt-get install --no-install-recommends -y \
        tesseract-ocr \
        libgl1-mesa-glx \
    && apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Set the working directory
WORKDIR /app

# Copy requirements first to leverage Docker cache
COPY requirements.txt requirements.txt

# Install Python dependencies
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application code (including the local tessdata folder)
COPY . .

# Explicitly copy the local tessdata contents into the system's expected directory
# This ensures the .traineddata files are definitely in the location TESSDATA_PREFIX points to.
COPY tessdata/ /usr/share/tessdata/

# Expose the port the app runs on (Render typically uses 10000 or provides $PORT)
# Gunicorn will bind to the $PORT variable provided by Render
EXPOSE ${PORT:-8000}

# --- Environment Variables --- #
# TESSDATA_PREFIX: Tell Tesseract where to find language data
# This MUST match the location where we COPY the tessdata files above.
ENV TESSDATA_PREFIX=/usr/share/tessdata

# Command to run the application using Gunicorn with Uvicorn workers
# ... (CMD remains the same) ...
CMD sh -c "exec gunicorn --bind 0.0.0.0:${PORT:-8000} --workers 1 --worker-class uvicorn.workers.UvicornWorker --timeout 180 main:app"
