# Placeholder for OCR Pydantic models 
from pydantic import BaseModel, Field
import uuid
from datetime import datetime
from typing import Union, List, Optional

class WordData(BaseModel):
    text: str
    left: int
    top: int
    width: int
    height: int
    confidence: Optional[float] = None # Make confidence optional

    class Config:
        populate_by_name = True # Allow using alias 'conf'
        # Allow from_attributes if needed later, though we build from dict here
        # from_attributes = True

class OcrResultWithBoxes(BaseModel):
    processed_image_width: int
    processed_image_height: int
    words: List[WordData]
    full_text: str
    # We might not need to save the full text to DB anymore, 
    # but keeping the overall structure similar for now.
    # We could add a field here later if we want to save the DB record ID.
    # db_record_id: Union[uuid.UUID, None] = None

# Keep the old one for reference or specific use cases if needed, 
# but the main endpoint will use OcrResultWithBoxes
class OcrResultResponse(BaseModel):
    message: str
    file_name: Optional[str] = None
    text_length: Optional[int] = None

# Model for a single row fetched from the ocr_results table
class DbOcrResult(BaseModel):
    id: uuid.UUID
    file_name: Optional[str] = None
    extracted_text: Optional[str] = None
    processed_at: datetime

    class Config:
        orm_mode = True # Enable ORM mode for compatibility if needed 