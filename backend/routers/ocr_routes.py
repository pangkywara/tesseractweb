# Placeholder for OCR routes

from fastapi import APIRouter, File, UploadFile, HTTPException, Depends, Form
from typing import List, Optional # Import List and Optional
from supabase import Client
from ..services import ocr_service
from ..dependencies import get_supabase_client
from ..models.ocr_models import OcrResultResponse, DbOcrResult # Import DbOcrResult
import traceback # Keep traceback import

# Router ini tidak perlu prefix sendiri karena prefix sudah ditambahkan di main.py saat include_router
router = APIRouter(
    # prefix="/ocr", # Hapus prefix ini
    tags=["ocr"], # Tag untuk dokumentasi API (Swagger UI)
)

@router.post("/upload", response_model=ocr_service.OcrResultWithBoxes)
async def upload_image_for_ocr(
    file: UploadFile = File(...),
    languages: Optional[List[str]] = Form(None), # Terima daftar bahasa dari form data
    save_result: bool = Form(True), # Opsi untuk menyimpan teks ke DB
    supabase_client: Client = Depends(get_supabase_client) # Dependency Injection
):
    """
    Menerima file gambar, melakukan OCR dengan bahasa terpilih,
    secara opsional menyimpan hasil lengkap, dan mengembalikan data tingkat kata.
    Bahasa harus diberikan sebagai beberapa field form dengan nama yang sama 'languages',
    contoh: languages=eng&languages=ind
    """
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Tipe file tidak valid. Harap unggah gambar.")

    selected_psm = 3 # Hardcode default PSM

    # Bahasa default jika tidak ada yang diberikan
    if not languages:
        selected_languages = ["eng", "ind"]
    else:
        # Validasi/sanitasi dasar (opsional: pastikan kode bahasa valid)
        selected_languages = [lang.strip().lower() for lang in languages if lang.strip()]
        if not selected_languages:
             selected_languages = ["eng", "ind"] # Fallback jika daftar kosong

    print(f"Menerima bahasa: {languages}, Menggunakan: {selected_languages}, PSM: {selected_psm}, Simpan hasil: {save_result}")

    try:
        # Teruskan bahasa, PSM (hardcoded), dan flag simpan ke fungsi service
        ocr_result = await ocr_service.perform_ocr(
            file=file,
            languages=selected_languages,
            save_to_db=save_result,
            supabase_client=supabase_client
        )
        return ocr_result # Pydantic model (OcrResultWithBoxes) melakukan validasi & serialisasi (Enkapsulasi data)
    except HTTPException as e:
        # Lempar ulang HTTP exceptions dari service layer
        raise e
    except Exception as e:
        # Log error untuk debugging
        traceback.print_exc()
        # Kembalikan error server generik
        raise HTTPException(status_code=500, detail=f"Terjadi kesalahan tak terduga: {e}")

@router.get("/results", response_model=List[DbOcrResult])
async def get_ocr_results(
    supabase_client: Client = Depends(get_supabase_client)
):
    """
    Mengambil semua hasil OCR yang tersimpan dari database Supabase,
    diurutkan berdasarkan waktu pemrosesan terbaru.
    """
    try:
        response = supabase_client.table('ocr_results') \
                                .select('*') \
                                .order('processed_at', desc=True) \
                                .execute()
        
        # supabase-py v1 returns data directly in response.data
        # supabase-py v2 returns data in response.data
        # Let's assume v2 structure for now based on common usage
        if hasattr(response, 'data'):
             # Validate data with Pydantic
            results = [DbOcrResult.model_validate(item) for item in response.data]
            return results
        else:
             print("Supabase response structure unexpected:", response)
             raise HTTPException(status_code=500, detail="Gagal memproses data dari database.")

    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Gagal mengambil hasil dari database: {e}") 