# Placeholder for OCR routes

from fastapi import APIRouter, File, UploadFile, HTTPException, Depends, Form, BackgroundTasks
from typing import List, Optional
from supabase import Client
from ..services import ocr_service
from ..dependencies import get_supabase_client
from ..models.ocr_models import OcrResultResponse, DbOcrResult
import traceback

# Router ini tidak perlu prefix sendiri karena prefix sudah ditambahkan di main.py saat include_router
router = APIRouter(
    # prefix="/ocr", # Hapus prefix ini
    tags=["ocr"], # Tag untuk dokumentasi API (Swagger UI)
)

@router.post("/upload", response_model=ocr_service.OcrResultWithBoxes)
async def upload_image_for_ocr(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    languages: Optional[List[str]] = Form(None),
    save_result: bool = Form(True),
    image_type: str = Form("default"),
    supabase_client: Client = Depends(get_supabase_client)
):
    """
    Menerima file gambar, melakukan OCR dengan bahasa terpilih,
    secara opsional menyimpan hasil lengkap di background, dan mengembalikan data tingkat kata.
    Bahasa: 'languages=eng&languages=ind'
    Tipe Gambar: 'image_type=default' atau 'image_type=chat'
    """
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Tipe file tidak valid. Harap unggah gambar.")

    if not languages:
        selected_languages = ["eng", "ind"]
    else:
        selected_languages = [lang.strip().lower() for lang in languages if lang.strip()]
        if not selected_languages:
             selected_languages = ["eng", "ind"]

    print(f"Menerima bahasa: {languages}, Tipe Gambar: {image_type}, Simpan hasil: {save_result}")

    try:
        # Call service without psm/whitelist
        ocr_result = await ocr_service.perform_ocr(
            file=file,
            languages=selected_languages,
            save_to_db_flag=save_result,
            background_tasks=background_tasks,
            supabase_client=supabase_client,
            image_type=image_type
        )
        return ocr_result
    except HTTPException as e:
        raise e
    except Exception as e:
        traceback.print_exc()
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

@router.delete("/results/{result_id}", status_code=204) # 204 No Content is typical for successful DELETE
async def delete_ocr_result(
    result_id: int,
    supabase_client: Client = Depends(get_supabase_client)
):
    """
    Menghapus hasil OCR dari database berdasarkan ID.
    Mengembalikan status 204 jika berhasil.
    """
    try:
        await ocr_service.delete_result_from_db(supabase_client, result_id)
        # No need to return content on 204
        return None # Return None explicitly for clarity with 204
    except HTTPException as e:
        # Re-raise HTTPExceptions (e.g., 404 Not Found or 500 from service)
        raise e
    except Exception as e:
        # Catch unexpected errors during the delete process
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Terjadi kesalahan tak terduga saat menghapus hasil: {e}") 
