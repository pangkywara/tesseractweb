# Placeholder for OCR service logic

import pytesseract
from PIL import Image
import io
import os
from supabase import Client
from fastapi import HTTPException, UploadFile, BackgroundTasks # Added BackgroundTasks
from fastapi.concurrency import run_in_threadpool # Import run_in_threadpool
import cv2 # Import OpenCV
import numpy as np # Import numpy for array handling
from pathlib import Path # Import Path
from typing import Union, List, Dict, Any, Optional # Added List, Dict, Any, Optional
import pandas as pd # Import pandas
from pydantic import BaseModel
from datetime import datetime, timezone
import traceback # For better error printing

# --- Constants --- #
MIN_OCR_CONFIDENCE = 35 # Balanced confidence
# PSM defaults will be set based on image_type

# --- Pydantic Models (Data Structures) ---
# Konsep OOP: Enkapsulasi
# Pydantic models (seperti WordData, OcrResultWithBoxes) membungkus data
# (atribut seperti text, left, top) beserta tipe data dan validasinya
# menjadi satu unit/objek.
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

# --- Image Preprocessing Functions ---
# Konsep OOP: Abstraksi
# Fungsi-fungsi ini menyembunyikan detail kompleks dari langkah-langkah
# pemrosesan gambar (grayscale, thresholding, blur) di balik interface fungsi yang sederhana.

def preprocess_general(image_bytes: bytes) -> np.ndarray:
    """Preprocessing untuk dokumen/poster umum: Grayscale + Otsu Threshold."""
    print("Menerapkan preprocessing umum (Otsu)...")
    try:
        nparr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_GRAYSCALE)
        if img is None: raise ValueError("Tidak dapat mendekode gambar.")

        # Simple Otsu Thresholding - Often good for high-contrast documents/posters
        _, processed_img = cv2.threshold(img, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        print("Applied Otsu Thresholding.")

        print("General preprocessing finished.")
        return processed_img
    except Exception as e:
        print(f"Error saat preprocessing umum: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=400, detail=f"Preprocessing gambar gagal: {e}")

def preprocess_chat(image_bytes: bytes) -> np.ndarray:
    """Preprocessing untuk chat/teks rapi: Grayscale, Otsu Threshold."""
    print("Menerapkan preprocessing chat...")
    try:
        nparr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_GRAYSCALE)
        if img is None: raise ValueError("Tidak dapat mendekode gambar.")
        _, processed_img = cv2.threshold(img, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        print("Chat preprocessing finished.")
        return processed_img
    except Exception as e:
        print(f"Error saat preprocessing chat: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=400, detail=f"Preprocessing gambar gagal: {e}")

# --- Background Task for Database Saving ---
# Konsep OOP: Abstraksi
# Fungsi ini menyembunyikan detail interaksi dengan database (query insert)
# dari logika utama OCR.
async def save_result_to_db(
    supabase_client: Client,
    filename: Optional[str],
    extracted_text: str
):
    """Menyimpan hasil OCR ke database Supabase di background."""
    if not extracted_text:
        print("Background task: Skipping Supabase save - No text extracted.")
        return
    try:
        # Use timezone.utc for consistency
        processed_time = datetime.now(timezone.utc).isoformat()
        print(f"Background task: Attempting to save result for {filename} at {processed_time}")
        data, count = await supabase_client.table('ocr_results').insert({
            'file_name': filename or 'unknown',
            'extracted_text': extracted_text,
            'processed_at': processed_time
        }).execute()
        # Note: Supabase Python client v1 might not be fully async here,
        # but running in BackgroundTask prevents blocking the main response.
        # For true async DB operations with v2 or other libs, the structure would change.
        print(f"Background task: Successfully saved result for {filename}. Response: {data}") # Log response data
    except Exception as db_error:
        print(f"Background task: Error saving to Supabase for {filename}: {db_error}")
        traceback.print_exc() # Log detailed error

# --- Main OCR Service Function (Uses image_type) ---
# Konsep OOP: Abstraksi
# Fungsi perform_ocr bertindak sebagai interface utama service layer.
# Ia mengorkestrasi langkah-langkah (preprocessing, pemanggilan library OCR, background task)
# dan menyembunyikan kompleksitas internal dari pemanggilnya (router).
# Penggunaan library eksternal seperti pytesseract dan cv2 juga merupakan bentuk abstraksi.
async def perform_ocr(
    file: UploadFile,
    languages: List[str],
    save_to_db_flag: bool,
    background_tasks: BackgroundTasks,
    supabase_client: Optional[Client] = None,
    image_type: str = "default" # Add image_type param
) -> OcrResultWithBoxes:
    """Melakukan OCR menggunakan preprocessing dan PSM berdasarkan image_type."""
    try:
        start_time = datetime.now()
        image_bytes = await file.read()
        if not image_bytes:
            raise HTTPException(status_code=400, detail="Empty file uploaded.")

        # --- Memilih Preprocessing dan PSM berdasarkan image_type ---
        selected_psm: int
        processed_img: np.ndarray

        # Konsep OOP: Polymorphism (Implisit/Duck Typing)
        # Meskipun tidak menggunakan inheritance kelas secara eksplisit, pemilihan
        # fungsi preprocessing (preprocess_chat vs preprocess_general) berdasarkan
        # image_type dapat dilihat sebagai bentuk polymorphism, di mana perilaku
        # preprocessing berubah tergantung 'tipe' input.
        if image_type == 'chat':
            print(f"Tipe gambar terdeteksi: {image_type}")
            processed_img = preprocess_chat(image_bytes)
            selected_psm = 11 # Sparse text
        else: # Kasus default (dokumen, poster, dll.)
             print(f"Tipe gambar terdeteksi: {image_type} (menggunakan default/umum)")
             processed_img = preprocess_general(image_bytes)
             selected_psm = 3 # Gunakan PSM 3 (Auto Page Segmentation) untuk default
        # --------------------------------------------------------

        print(f"Memulai proses OCR untuk {file.filename} pada {start_time} menggunakan PSM={selected_psm}")

        processed_height, processed_width = processed_img.shape[:2]
        pil_img = Image.fromarray(processed_img)

        # Bangun konfigurasi Tesseract
        lang_str = "+".join(languages)
        custom_config = f'-l {lang_str} --psm {selected_psm}'
        print(f"Menjalankan Tesseract dengan config: {custom_config}")

        # Lakukan OCR dalam thread pool untuk memastikan tidak memblokir event loop
        # Konsep OOP: Abstraksi (Penggunaan Library)
        # Memanggil pytesseract.image_to_data menyembunyikan detail implementasi Tesseract.
        try:
            ocr_data: pd.DataFrame = await run_in_threadpool(
                pytesseract.image_to_data,
                pil_img,
                config=custom_config,
                output_type=pytesseract.Output.DATAFRAME
            )
        except Exception as tess_err: # Tangkap error spesifik dari Tesseract
            print(f"Error saat menjalankan Tesseract via thread pool: {tess_err}")
            traceback.print_exc()
            # Periksa apakah ini TesseractNotFoundError atau FileNotFoundError spesifik
            if isinstance(tess_err, pytesseract.TesseractNotFoundError):
                raise HTTPException(status_code=500, detail="Tesseract executable not found.")
            elif isinstance(tess_err, FileNotFoundError) and '.traineddata' in str(tess_err):
                tessdata_path_info = os.environ.get('TESSDATA_PREFIX', 'Not Set/Default')
                error_detail = f"Tesseract language data not found. Ensure it's installed and TESSDATA_PREFIX is correct ({tessdata_path_info})."
                raise HTTPException(status_code=500, detail=error_detail)
            else:
                # Error lain dari Tesseract
                raise HTTPException(status_code=500, detail=f"Error selama eksekusi Tesseract: {tess_err}")

        # Proses hasil OCR
        ocr_data = ocr_data[ocr_data.conf > MIN_OCR_CONFIDENCE]
        ocr_data = ocr_data.dropna(subset=['text'])
        ocr_data = ocr_data[ocr_data.text.astype(str).str.strip() != '']
        print(f"Pemrosesan mentah OCR selesai. Ditemukan {len(ocr_data)} kata di atas {MIN_OCR_CONFIDENCE}% confidence.")

        word_list: List[WordData] = []
        full_text_list = []
        for index, row in ocr_data.iterrows():
            try:
                # Konsep OOP: Enkapsulasi (Pembuatan Objek WordData)
                # Membuat instance dari model WordData.
                word_list.append(
                    WordData(
                        text=str(row['text']),
                        left=int(row['left']),
                        top=int(row['top']),
                        width=int(row['width']),
                        height=int(row['height']),
                        confidence=float(row['conf'])
                    )
                )
                full_text_list.append(str(row['text']))
            except (ValueError, TypeError, KeyError) as e:
                 print(f"Peringatan: Melewati baris karena error data: {row} - Error: {e}")
                 continue

        extracted_text = " ".join(full_text_list).strip()
        print(f"Panjang teks akhir yang diekstrak: {len(extracted_text)}")

        # Tambahkan penyimpanan database ke background task jika diminta
        if save_to_db_flag and supabase_client:
            # Konsep OOP: Abstraksi (Pemanggilan Fungsi Background)
            # Menyembunyikan detail eksekusi asinkron tugas penyimpanan DB.
            background_tasks.add_task(
                save_result_to_db,
                supabase_client=supabase_client,
                filename=file.filename,
                extracted_text=extracted_text
            )
            print(f"Menambahkan tugas simpan Supabase ke background untuk {file.filename}")
        elif not save_to_db_flag:
             print("Melewati penyimpanan Supabase: Pilihan pengguna.")
        else:
             print("Melewati penyimpanan Supabase: Klien DB tidak tersedia.")

        end_time = datetime.now()
        duration = end_time - start_time
        print(f"Selesai proses OCR untuk {file.filename} pada {end_time} (Durasi: {duration})")

        # Konsep OOP: Enkapsulasi (Pembuatan Objek Respon)
        # Mengembalikan hasil dalam struktur OcrResultWithBoxes.
        return OcrResultWithBoxes(
            processed_image_width=processed_width,
            processed_image_height=processed_height,
            words=word_list,
            full_text=extracted_text
        )

    # --- Exception Handling ---
    except pytesseract.TesseractNotFoundError as e:
         # Ini seharusnya tidak tercapai lagi, tapi biarkan sebagai fallback
         print(f"Tesseract Error (fallback handler): {e}")
         raise HTTPException(status_code=500, detail="Tesseract executable not found. Check installation and PATH/TESSDATA_PREFIX.")
    except FileNotFoundError as e:
         # Ini seharusnya tidak tercapai lagi, tapi biarkan sebagai fallback
         tessdata_path_info = os.environ.get('TESSDATA_PREFIX', 'Not Set/Default')
         error_detail = f"Tesseract language data not found (fallback handler). TESSDATA_PREFIX={tessdata_path_info}. Error: {e}"
         print(f"File Error (fallback handler): {e} - Detail: {error_detail}")
         raise HTTPException(status_code=500, detail=error_detail)
    except HTTPException as http_exc:
        # Re-raise specific HTTPExceptions (like from preprocessing)
        raise http_exc
    except Exception as e:
        # Catch-all for other unexpected errors during processing
        print(f"Terjadi error tak terduga saat OCR untuk file {file.filename if file else 'N/A'}: {e}")
        traceback.print_exc() # Print full traceback for debugging
        raise HTTPException(status_code=500, detail=f"Terjadi error tak terduga saat pemrosesan OCR: {e}")