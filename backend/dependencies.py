import os
from supabase import create_client, Client
from dotenv import load_dotenv
from fastapi import HTTPException
from pathlib import Path
import logging
from typing import Union, Optional

# --- Define Paths --- #
# Path to the directory containing this file
current_dir = Path(__file__).parent
# Path to the backend directory (where .env is located)
backend_dir = current_dir
# Path to the project root directory (one level up from backend)
project_root = backend_dir.parent
# Path to the .env file inside the backend directory
dotenv_path = backend_dir / '.env'
# Path to the tessdata directory in the project root
tessdata_dir = project_root / 'tessdata'

# --- Load Environment Variables --- #
print(f"Loading .env from: {dotenv_path}")
load_dotenv(dotenv_path=dotenv_path)

# --- Set TESSDATA_PREFIX --- #
# Set the TESSDATA_PREFIX environment variable for the current process
# This tells pytesseract/Tesseract where to find the language files
# Use the value from .env if available, otherwise use the calculated path
tessdata_prefix_env = os.environ.get('TESSDATA_PREFIX')
if tessdata_prefix_env:
    print(f"Using TESSDATA_PREFIX from environment: {tessdata_prefix_env}")
else:
    os.environ['TESSDATA_PREFIX'] = str(tessdata_dir)
    print(f"Set TESSDATA_PREFIX to calculated path: {os.environ['TESSDATA_PREFIX']}")

# --- Load Supabase Config --- #
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_ANON_KEY")

# Basic check to ensure variables are loaded
if not SUPABASE_URL:
    # Use logging instead of raising an error immediately
    # Raise error only if client creation fails later
    logging.warning("SUPABASE_URL environment variable not set.")
    # raise RuntimeError("SUPABASE_URL environment variable not set.")
if not SUPABASE_KEY:
    logging.warning("SUPABASE_ANON_KEY environment variable not set.")
    # raise RuntimeError("SUPABASE_KEY environment variable not set.")

# Initialize Supabase client globally
supabase: Optional[Client] = None
try:
    if SUPABASE_URL and SUPABASE_KEY:
        supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
        print("Supabase client created successfully.")
    else:
        print("Supabase client creation skipped due to missing URL or Key.")
except Exception as e:
    logging.error(f"Failed to create Supabase client: {e}")
    # Optionally re-raise or handle appropriately
    # raise e # Re-raise if critical

def get_supabase_client() -> Client:
    """Dependency function to get the Supabase client."""
    if supabase is None:
        # This handles the case where client creation failed earlier
        # or was skipped due to missing env vars.
        raise RuntimeError("Supabase client is not initialized. Check environment variables and logs.")
    return supabase 