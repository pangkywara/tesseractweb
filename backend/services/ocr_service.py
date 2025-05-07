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
import uuid # Added for generating unique filenames
from ..models.ocr_models import OcrResultUpdateRequest # Import the new model

# --- Constants --- #
MIN_OCR_CONFIDENCE = 35 # Balanced confidence
OCR_IMAGES_BUCKET = "ocr-images" # Define bucket name
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
    extracted_text: str,
    image_url: Optional[str] = None # Added image_url parameter
):
    """Menyimpan hasil OCR ke database Supabase di background."""
    if not extracted_text and not image_url: # Also check image_url
        print("Background task: Skipping Supabase save - No text extracted and no image URL.")
        return
    try:
        # Use timezone.utc for consistency
        processed_time = datetime.now(timezone.utc).isoformat()
        db_entry = {
            'file_name': filename or 'unknown',
            'extracted_text': extracted_text,
            'processed_at': processed_time
        }
        if image_url:
            db_entry['image_url'] = image_url
            
        print(f"Background task: Attempting to save result for {filename} at {processed_time} with image_url: {image_url}")
        # Re-applying fix: execute() is not awaitable for insert in supabase-py v1
        response = supabase_client.table('ocr_results').insert(db_entry).execute()
        if hasattr(response, 'data') and response.data:
            print(f"Background task: Successfully saved result for {filename}. Response data: {response.data}")
        else:
            print(f"Background task: Save operation for {filename} completed. Full response: {response}")
    except Exception as db_error:
        print(f"Background task: Error saving to Supabase for {filename}: {db_error}")
        traceback.print_exc() # Log detailed error

# --- Helper Function to Delete Image from Storage ---
async def delete_image_from_storage(
    supabase_client: Client,
    bucket_name: str,
    image_path: str # This should be the path within the bucket (e.g., UUID.png)
):
    """Deletes an image from Supabase Storage."""
    if not image_path:
        print("No image path provided, skipping deletion from storage.")
        return
    try:
        print(f"Attempting to delete image '{image_path}' from bucket '{bucket_name}'...")
        # The path used here must be exactly what was used to upload/identify the file in storage.
        # Supabase storage often uses the filename itself as the path if not in a folder.
        response = await run_in_threadpool(supabase_client.storage.from_(bucket_name).remove, [image_path])
        print(f"Supabase storage delete response for '{image_path}': {response}")
        # Add more robust error checking based on Supabase client's response for delete operations
        # For example, check if response indicates success or if any items in response have errors
        # This is a basic check; you might need to inspect the response structure more closely.
        if response and isinstance(response, list) and response[0].get('error'):
             print(f"Error reported by Supabase deleting '{image_path}': {response[0]['error']}")
        elif not response:
             print(f"Warning: Supabase delete response for '{image_path}' was empty or unexpected.")

    except Exception as storage_error:
        print(f"Error deleting image '{image_path}' from Supabase Storage: {storage_error}")
        traceback.print_exc()
        # Do not raise HTTPException here as this is a helper; let calling function decide error handling

# --- Function to Update OCR Result (Text and optionally Image) ---
async def update_ocr_result(
    supabase_client: Client,
    result_id: str,
    update_data: OcrResultUpdateRequest, # Pydantic model for update payload
    new_file: Optional[UploadFile] = None
) -> Dict[str, Any]: # Return the updated record or a success message
    """Updates an OCR result in the database, and optionally its image in storage."""
    try:
        # Re-applying fix: Select all columns initially
        print(f"Fetching current OCR result for ID: {result_id} before update.")
        current_result_response = await run_in_threadpool(
            supabase_client.table('ocr_results').select('*').eq('id', result_id).maybe_single().execute
        )
        current_result_data = None
        if hasattr(current_result_response, 'data') and current_result_response.data:
            current_result_data = current_result_response.data
        if not current_result_data:
            raise HTTPException(status_code=404, detail=f"OCR Result with ID {result_id} not found.")

        old_image_url = current_result_data.get('image_url')
        new_image_url_for_db: Optional[str] = old_image_url
        
        # 2. If a new file is provided, upload it and delete the old one
        if new_file:
            if not new_file.content_type or not new_file.content_type.startswith("image/"):
                raise HTTPException(status_code=400, detail="Invalid new file type. Please upload an image.")

            # Delete old image from storage if it exists
            if old_image_url:
                # Extract path from URL (this might need to be more robust depending on URL structure)
                # Assuming URL is like: .../bucket_name/image_file_name.ext
                old_image_path = old_image_url.split(f"/{OCR_IMAGES_BUCKET}/")[-1]
                if old_image_path and old_image_path != old_image_url: # Basic check
                    print(f"Old image URL found: {old_image_url}. Extracted path: {old_image_path}")
                    await delete_image_from_storage(supabase_client, OCR_IMAGES_BUCKET, old_image_path)
                else:
                    print(f"Could not reliably extract path from old image URL: {old_image_url}")
            
            # Upload new image
            new_image_bytes = await new_file.read()
            if not new_image_bytes:
                 raise HTTPException(status_code=400, detail="Empty new file uploaded for update.")

            file_extension = Path(new_file.filename).suffix if new_file.filename else ".png"
            unique_new_image_name = f"{uuid.uuid4()}{file_extension}"
            
            print(f"Uploading new image {unique_new_image_name} to bucket {OCR_IMAGES_BUCKET} for update...")
            await run_in_threadpool(
                supabase_client.storage.from_(OCR_IMAGES_BUCKET).upload,
                path=unique_new_image_name,
                file=new_image_bytes,
                file_options={'content-type': new_file.content_type or 'image/png'}
            )
            public_url_response = supabase_client.storage.from_(OCR_IMAGES_BUCKET).get_public_url(unique_new_image_name)
            if isinstance(public_url_response, str):
                new_image_url_for_db = public_url_response
                print(f"New image uploaded successfully. Public URL: {new_image_url_for_db}")
            else:
                print(f"Warning: Could not retrieve public URL for new image: {public_url_response}")
                # Decide handling: proceed without new URL, or raise error?
                # For now, if new file was intended, and URL fails, this is an issue.
                raise HTTPException(status_code=500, detail="Failed to get public URL for new image after upload.")

        # 3. Prepare data for database update
        update_payload: Dict[str, Any] = {}
        if update_data.extracted_text is not None:
            update_payload['extracted_text'] = update_data.extracted_text
        if update_data.file_name is not None:
            update_payload['file_name'] = update_data.file_name
        if new_file and new_image_url_for_db:
             update_payload['image_url'] = new_image_url_for_db
        elif new_file and not new_image_url_for_db: # New file provided but URL failed
            # This case should ideally be caught above, but as a safeguard:
            print("Error: New file provided for update, but its URL could not be obtained.")
            # Depending on strictness, could raise error or skip image_url update

        # Re-applying fix: Return full initial data if no changes
        if not update_payload:
            print(f"No changes to apply for OCR result ID: {result_id}. Returning current data.")
            return current_result_data 

        print(f"Updating OCR result ID: {result_id} with payload: {update_payload}")
        update_response = await run_in_threadpool(
            supabase_client.table('ocr_results').update(update_payload).eq('id', result_id).execute
        )
        
        # Re-applying fix: Check update response and fetch full record again
        if hasattr(update_response, 'data') and not update_response.data:
            print(f"Warning: Update operation for ID {result_id} returned empty data. Assuming ID not found or no change needed.")
            # Even if update returned empty, try fetching data to be sure

        print(f"Update operation completed for {result_id}. Fetching updated record...")
        # Fetch the full updated record directly (removed run_in_threadpool here previously, let's keep it off)
        try:
            fetch_updated_response = supabase_client.table('ocr_results').select('*').eq('id', result_id).maybe_single().execute()
        except Exception as fetch_err:
             print(f"Error directly fetching updated record for ID {result_id}: {fetch_err}")
             raise HTTPException(status_code=500, detail=f"Failed to retrieve updated OCR result after potential update for ID {result_id}.")

        if hasattr(fetch_updated_response, 'data') and fetch_updated_response.data:
            print(f"Successfully fetched updated OCR result ID: {result_id}")
            return fetch_updated_response.data # Return the full, validated record
        else:
            print(f"Error: Failed to fetch the updated record for ID {result_id} after update. Response: {fetch_updated_response}")
            raise HTTPException(status_code=500, detail=f"Failed to retrieve updated OCR result after update for ID {result_id}.")

    except HTTPException as e:
        raise e
    except Exception as e:
        print(f"Unexpected error updating OCR result ID {result_id}: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Unexpected error updating OCR result: {e}")

# --- Function to Delete Result from DB (Modified) ---
async def delete_result_from_db(
    supabase_client: Client,
    result_id: str
):
    """Menghapus hasil OCR dari database Supabase berdasarkan ID, dan juga gambarnya dari storage."""
    try:
        # 1. Fetch the record to get image_url before deleting from DB
        print(f"Fetching OCR result for ID: {result_id} before deletion to get image_url.")
        record_to_delete_response = await run_in_threadpool(
            supabase_client.table('ocr_results').select('image_url').eq('id', result_id).maybe_single().execute
        )

        record_to_delete_data = None
        if hasattr(record_to_delete_response, 'data') and record_to_delete_response.data:
            record_to_delete_data = record_to_delete_response.data

        image_url_to_delete = None
        if record_to_delete_data:
            image_url_to_delete = record_to_delete_data.get('image_url')
        else:
            # If record doesn't exist, we might not need to raise 404 yet, 
            # as the delete operation on DB will handle it. But good to log.
            print(f"Warning: OCR Result with ID {result_id} not found when trying to fetch for image deletion.")

        # 2. Delete from Database
        print(f"Attempting to delete result with ID: {result_id} from database.")
        db_delete_response = await run_in_threadpool(
            supabase_client.table('ocr_results').delete().eq('id', result_id).execute
        )
        
        print(f"Supabase DB delete response for ID {result_id}: {db_delete_response}")

        # Check if any row was actually deleted
        deleted_from_db = False
        if hasattr(db_delete_response, 'data') and db_delete_response.data:
            print(f"Successfully deleted result ID: {result_id} from database. Response data: {db_delete_response.data}")
            deleted_from_db = True
        elif hasattr(db_delete_response, 'data') and not db_delete_response.data:
             print(f"Warning: No result found in database with ID {result_id} to delete (data attribute empty). Attempting image deletion if URL was found.")
        else:
             print(f"Database delete for ID: {result_id} completed. Response structure might differ or operation had no effect. Attempting image deletion if URL was found.")
        
        # If the record was not found in the DB initially (record_to_delete_data is None) 
        # AND the delete operation also found nothing (not deleted_from_db essentially), then it is a 404.
        if not record_to_delete_data and not (hasattr(db_delete_response, 'data') and db_delete_response.data):
            raise HTTPException(status_code=404, detail=f"Result with ID {result_id} not found to delete.")

        # 3. Delete Image from Storage if URL exists
        if image_url_to_delete:
            image_path_to_delete = image_url_to_delete.split(f"/{OCR_IMAGES_BUCKET}/")[-1]
            if image_path_to_delete and image_path_to_delete != image_url_to_delete:
                await delete_image_from_storage(supabase_client, OCR_IMAGES_BUCKET, image_path_to_delete)
            else:
                print(f"Could not reliably extract path from image URL for deletion: {image_url_to_delete}")
        else:
            print(f"No image_url found for result ID {result_id}, skipping storage deletion.")

    except HTTPException as e:
        raise e # Re-raise HTTPExceptions directly
    except Exception as e:
        print(f"Error deleting result ID {result_id}: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error processing deletion for result {result_id}: {e}")

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
        await file.seek(0) # Reset file pointer if reading again or passing to other functions
        
        if not image_bytes:
            raise HTTPException(status_code=400, detail="Empty file uploaded.")

        image_url_for_db: Optional[str] = None

        if save_to_db_flag and supabase_client:
            # Generate a unique name for the image file in storage
            file_extension = Path(file.filename).suffix if file.filename else ".png" # Default to .png if no suffix
            unique_image_name = f"{uuid.uuid4()}{file_extension}"
            
            try:
                print(f"Uploading {unique_image_name} to Supabase bucket {OCR_IMAGES_BUCKET}...")
                # Ensure file pointer is at the beginning for upload
                await file.seek(0)
                response = await run_in_threadpool(
                    supabase_client.storage.from_(OCR_IMAGES_BUCKET).upload,
                    path=unique_image_name,
                    file=image_bytes, # Send bytes directly
                    file_options={'content-type': file.content_type or 'image/png'}
                )
                print(f"Supabase upload response: {response}")

                # Check for upload errors (Supabase client specific)
                # The actual response format might vary. This is a common pattern.
                # if response.get("error"): # Older versions might use this
                #     raise Exception(f"Supabase storage error: {response['error']}")
                # For supabase-py v2, a successful upload typically doesn't throw an error,
                # but an error response (e.g., status code >= 400) would raise an APIError.
                # We will get the public URL after successful upload.

                # Get public URL
                # The path in get_public_url should match the 'path' used in upload
                public_url_response = supabase_client.storage.from_(OCR_IMAGES_BUCKET).get_public_url(unique_image_name)
                
                # supabase-py v2 returns the URL directly
                if isinstance(public_url_response, str):
                    image_url_for_db = public_url_response
                    print(f"Image uploaded successfully. Public URL: {image_url_for_db}")
                else:
                    # Handle unexpected response format for public URL
                    print(f"Warning: Could not retrieve public URL or unexpected format: {public_url_response}")
                    # image_url_for_db remains None or handle as an error

            except Exception as storage_error:
                print(f"Error uploading image to Supabase Storage: {storage_error}")
                traceback.print_exc()
                # Decide if this should be a fatal error or just a warning
                # For now, let's make it non-fatal for OCR processing to continue, but log it.
                # If image storage is critical, you might raise an HTTPException here.
                image_url_for_db = None # Ensure it's None if upload fails

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
            # Konsep OOP: Polymorphism (Background Task)
            # Menggunakan BackgroundTasks untuk menjalankan save_result_to_db secara
            # asinkron adalah bentuk abstraksi yang memungkinkan tugas utama (respons API)
            # tidak diblokir oleh operasi I/O database.
            background_tasks.add_task(
                save_result_to_db, 
                supabase_client, 
                file.filename, 
                extracted_text,
                image_url_for_db # Pass the image URL
            )
            print(f"Background task untuk menyimpan hasil ditambahkan untuk {file.filename} dengan image URL: {image_url_for_db}")
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
