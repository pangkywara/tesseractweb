from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import ocr_routes # Corrected import (no backend.)
import os
from dotenv import load_dotenv 