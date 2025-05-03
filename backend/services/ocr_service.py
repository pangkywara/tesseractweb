# Placeholder for OCR service logic

import pytesseract
from PIL import Image
import io
import os
from supabase import Client
from fastapi import HTTPException, UploadFile
import cv2 # Import OpenCV
import numpy as np # Import numpy for array handling
from pathlib import Path # Import Path
from typing import Union, List, Dict, Any, Optional # Added List, Dict, Any, Optional
import pandas as pd # Import pandas
from pydantic import BaseModel
from datetime import datetime, timezone

# --- Constants --- #
MIN_OCR_CONFIDENCE = 50 # Minimum confidence level to include a word (adjust as needed)
TARGET_HEIGHT = 1000 # Target height for rescaling heuristic
DEFAULT_PSM = 3 # Define default PSM here

# --- Pydantic Models (Data Structures) ---
# Model ini mendefinisikan struktur data untuk sebuah kata hasil OCR.
# Ini adalah contoh Enkapsulasi: data (text, left, top, dll.) dan validasinya
# dibundel menjadi satu unit (kelas WordData).
class WordData(BaseModel):
    text: str
    left: int
    top: int
    width: int
    height: int
    confidence: float

# Model ini mendefinisikan struktur data untuk respons API secara keseluruhan.
# Ini juga contoh Enkapsulasi dan Abstraksi: menyembunyikan detail internal
# tentang bagaimana data OCR dihasilkan dan hanya mengekspos struktur yang relevan.
class OcrResultWithBoxes(BaseModel):
    processed_image_width: int
    processed_image_height: int
    words: List[WordData]
    full_text: str # Add field for concatenated text

# --- Image Preprocessing Function ---
# Fungsi ini mengimplementasikan langkah-langkah preprocessing.
# Ini adalah contoh Abstraksi: menyembunyikan kompleksitas pemrosesan gambar
# dari fungsi OCR utama.
def preprocess_image(image_bytes: bytes) -> np.ndarray:
    """Reads image bytes, converts to grayscale, rescales, and applies thresholding."""
    try:
        nparr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            raise ValueError("Could not decode image from bytes.")

        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        height, width = gray.shape
        if height > 0 and (height < TARGET_HEIGHT / 1.5 or height > TARGET_HEIGHT * 1.5):
             if height < 200 and TARGET_HEIGHT > 500:
                 scale_factor = 1.0
             else:
                scale_factor = TARGET_HEIGHT / height
             if scale_factor > 0:
                 new_width = int(width * scale_factor)
                 new_height = int(height * scale_factor)
                 interpolation = cv2.INTER_LANCZOS4 if scale_factor < 1.0 else cv2.INTER_CUBIC
                 gray = cv2.resize(gray, (new_width, new_height), interpolation=interpolation)
                 print(f"Rescaled image from {width}x{height} to {new_width}x{new_height}")

        _, thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        print("Image preprocessing complete (Grayscale, Rescale heuristic, Otsu Threshold)")
        return thresh
    except Exception as e:
        print(f"Error during image preprocessing: {e}")
        raise HTTPException(status_code=400, detail=f"Image preprocessing failed: {e}")

# --- Main OCR Service Function ---
# Fungsi ini bertindak sebagai service utama, mengorkestrasi preprocessing, OCR, dan penyimpanan DB.
# Ini adalah contoh Abstraksi tingkat tinggi.
# Konsep Inheritance (Pewarisan) dan Polymorphism (Polimorfisme) tidak secara langsung
# diterapkan di sini karena kita tidak menggunakan hierarki kelas yang kompleks.
# Jika kita memiliki beberapa metode OCR (misalnya, Tesseract vs EasyOCR) yang diimplementasikan
# sebagai kelas yang berbeda dengan metode `recognize` yang sama, kita bisa menggunakan
# polimorfisme untuk memanggil metode yang sesuai berdasarkan pilihan pengguna.
async def perform_ocr(
    file: UploadFile,
    languages: List[str],
    save_to_db: bool,
    supabase_client: Optional[Client] = None
) -> OcrResultWithBoxes:
    """Performs OCR on the uploaded image file using specified languages."""
    try:
        image_bytes = await file.read()
        if not image_bytes:
            raise HTTPException(status_code=400, detail="Empty file uploaded.")

        # Panggil fungsi preprocessing (Abstraksi)
        processed_img = preprocess_image(image_bytes)
        processed_height, processed_width = processed_img.shape[:2]
        pil_img = Image.fromarray(processed_img)

        # Bangun string bahasa untuk Tesseract (contoh: 'eng+ind')
        lang_str = "+".join(languages)
        # Gunakan PSM default yang sudah ditentukan (DEFAULT_PSM = 3)
        custom_config = f'-l {lang_str} --psm {DEFAULT_PSM}'
        print(f"Running Tesseract with config: {custom_config}")

        # Lakukan OCR menggunakan Pytesseract
        ocr_data: pd.DataFrame = pytesseract.image_to_data(
            pil_img,
            config=custom_config,
            output_type=pytesseract.Output.DATAFRAME
        )

        # Proses hasil OCR
        ocr_data = ocr_data[ocr_data.conf > MIN_OCR_CONFIDENCE]
        ocr_data = ocr_data.dropna(subset=['text'])
        ocr_data = ocr_data[ocr_data.text.astype(str).str.strip() != '']

        print(f"OCR processing complete. Found {len(ocr_data)} words above {MIN_OCR_CONFIDENCE}% confidence.")

        word_list: List[WordData] = []
        full_text_list = []
        for index, row in ocr_data.iterrows():
            try:
                confidence_val = float(row['conf'])
            except (ValueError, TypeError):
                confidence_val = -1.0

            # Buat instance WordData (Enkapsulasi data kata)
            word_list.append(
                WordData(
                    text=str(row['text']),
                    left=int(row['left']),
                    top=int(row['top']),
                    width=int(row['width']),
                    height=int(row['height']),
                    confidence=confidence_val
                )
            )
            full_text_list.append(str(row['text']))

        extracted_text = " ".join(full_text_list).strip()

        # --- Interaksi Database (Opsional) ---
        if save_to_db and supabase_client and extracted_text:
            try:
                # Abstraksi: detail query insert disembunyikan di sini
                data, count = supabase_client.table('ocr_results').insert({
                    'file_name': file.filename or 'unknown',
                    'extracted_text': extracted_text,
                    'processed_at': datetime.now(timezone.utc).isoformat()
                }).execute()
                print(f"Successfully saved result for {file.filename} to Supabase.")
            except Exception as db_error:
                print(f"Error saving to Supabase: {db_error}")
        elif not save_to_db:
            print("Skipping Supabase save: User opted out.")
        elif not extracted_text:
             print("Skipping Supabase save: No text extracted.")
        else:
            print("Skipping Supabase save: Client not available.")
        # ---------------------------------------

        # Kembalikan hasil dalam struktur yang ditentukan (Enkapsulasi & Abstraksi)
        return OcrResultWithBoxes(
            processed_image_width=processed_width,
            processed_image_height=processed_height,
            words=word_list,
            full_text=extracted_text
        )

    except pytesseract.TesseractNotFoundError as e:
         print(f"Tesseract Error: {e}")
         raise HTTPException(status_code=500, detail="Tesseract executable not found. Check installation and PATH/TESSDATA_PREFIX.")
    except FileNotFoundError as e:
         missing_lang = "unknown"
         if hasattr(e, 'filename') and e.filename:
             if f"{lang_str}.traineddata" in e.filename:
                  missing_lang = lang_str
         tessdata_path_info = os.environ.get('TESSDATA_PREFIX', 'Default Path')
         error_detail = f"Tesseract language data ('{missing_lang}.traineddata') not found. Ensure it's installed and in TESSDATA_PREFIX ({tessdata_path_info})."
         print(f"File Error: {e}")
         raise HTTPException(status_code=500, detail=error_detail)
    except HTTPException as http_exc:
        raise http_exc
    except Exception as e:
        print(f"An unexpected error occurred during OCR: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred during OCR processing: {e}")