// ... existing code ...
2.  **Penyiapan Backend:**
    ```bash
    cd backend

    # Buat dan aktifkan lingkungan virtual (direkomendasikan)
    python -m venv .venv
    # Di Windows
    .\.venv\Scripts\activate
    # Di macOS/Linux
    # source .venv/bin/activate

    # Instal dependensi Python
    pip install -r requirements.txt

    # Buat file .env dari .env.example (jika disediakan) atau secara manual
    # Tambahkan URL Supabase dan Kunci Anon Anda jika menggunakan fitur DB.
    # Jika menjalankan backend secara lokal (tanpa Docker) dan Tesseract tidak ada di PATH sistem Anda,
    # tambahkan juga path ke executable Tesseract.
    # Contoh .env:
    # SUPABASE_URL="url_supabase_anda"
    # SUPABASE_ANON_KEY="kunci_anon_supabase_anda"
    # ALLOWED_ORIGINS="http://localhost:3000,https://domain-frontend-anda.com" # Tambahkan URL frontend Anda untuk CORS
    # TESSERACT_CMD="C:\Program Files\Tesseract-OCR\tesseract.exe" # Contoh untuk Windows, sesuaikan path jika perlu

    cd ..
    ```
// ... existing code ...
1.  **Jalankan Backend:**
    *   **Menggunakan Docker (Direkomendasikan untuk konsistensi):**
        ```bash
// ... existing code ...
        docker run -p 8000:8000 --env-file .env pbo-tesseract-backend
        ```
    *   **Secara Lokal (Membutuhkan Tesseract terinstal):**
        *   Pastikan Tesseract terinstal di sistem Anda dan dapat diakses.
        *   Jika Tesseract tidak berada di PATH sistem, pastikan Anda telah menambahkan variabel `TESSERACT_CMD` ke file `.env` di direktori `backend`, menunjuk ke lokasi tesseract executable (lihat contoh di bagian Penyiapan Backend).
        ```bash
        cd backend
        # Pastikan lingkungan virtual aktif
        # Pastikan file .env sudah dikonfigurasi (termasuk TESSERACT_CMD jika perlu)
        uvicorn main:app --reload --port 8000
        ```
    API backend akan berjalan di `http://127.0.0.1:8000`.
// ... existing code ...
