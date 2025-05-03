    # Start from a Python base image
    FROM python:3.9-slim

    # Set environment variables to avoid interactive prompts during package installation
    ENV DEBIAN_FRONTEND=noninteractive

    # Install system dependencies: Tesseract, language packs, OpenCV libs, git
    # Using Tesseract 4 which is common in Debian repositories. If 5 is needed, the source might differ.
    RUN apt-get update && apt-get install -y --no-install-recommends \
        tesseract-ocr \
        tesseract-ocr-eng \
        tesseract-ocr-ind \
        libgl1-mesa-glx \
        libglib2.0-0 \
        git \
        && apt-get clean \
        && rm -rf /var/lib/apt/lists/*

    # Set Tesseract data path (this path is typical for Debian/Ubuntu installs of Tesseract 4)
    # Verify this path if build fails or Tesseract can't find languages
    ENV TESSDATA_PREFIX=/usr/share/tesseract-ocr/4.00/tessdata

    # Set the working directory inside the container
    WORKDIR /code

    # Copy the requirements file first and install dependencies
    # This leverages Docker layer caching
    COPY ./requirements.txt /code/requirements.txt
    RUN pip install --no-cache-dir --upgrade pip && \
        pip install --no-cache-dir -r /code/requirements.txt

    # Copy the rest of the backend application code
    # Ensure all your backend files are in the root of the git repo when you copy
    COPY . /code/

    # Expose the port the app will run on (Hugging Face prefers 7860 for Docker Spaces)
    EXPOSE 7860

    # Command to run the FastAPI application using gunicorn
    # Using port 7860, referencing the 'app' instance in 'main.py'
    CMD ["gunicorn", "-k", "uvicorn.workers.UvicornWorker", "-w", "2", "-b", "0.0.0.0:7860", "main:app"]