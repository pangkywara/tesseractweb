# Kelompok 3 - Aplikasi Web Tesseract OCR

[![Demo](https://img.shields.io/badge/Demo-Kunjungi%20Aplikasi%20Langsung-blue?style=for-the-badge&logo=vercel)](https://pangkywara.xyz)

Proyek ini adalah aplikasi web yang melakukan Pengenalan Karakter Optik (OCR) pada gambar yang diunggah menggunakan Tesseract. Aplikasi ini memiliki frontend Next.js dan backend FastAPI, dengan hasil yang secara opsional dapat disimpan ke database Supabase.

## Fitur

*   **Unggah Gambar:** Unggah gambar JPEG/PNG melalui seret dan lepas (drag-and-drop) atau pemilih file.
*   **OCR Multi-bahasa:** Mendukung pengenalan teks bahasa Inggris (`eng`) dan Indonesia (`ind`).
*   **Tampilan Kotak Pembatas (Bounding Box):** Menampilkan kata-kata yang dikenali di atas gambar yang telah diproses.
*   **Ekstraksi Teks:** Menyediakan teks lengkap yang diekstraksi dan memungkinkan penyalinan kata per kata.
*   **Integrasi Database (Opsional):** Opsi untuk menyimpan hasil teks yang diekstraksi ke Supabase.
*   **Backend dalam Docker:** Backend dikemas dalam kontainer Docker untuk konsistensi deployment.
*   **Deteksi Jenis Gambar:** Memungkinkan penentuan apakah gambar adalah dokumen umum atau tangkapan layar obrolan (chat) untuk pengaturan pra-pemrosesan/PSM yang mungkin berbeda.

## Tumpukan Teknologi (Technology Stack)

*   **Frontend:** Next.js, React, TypeScript, Tailwind CSS, shadcn/ui
*   **Backend:** FastAPI, Python, Pytesseract, OpenCV-Python, Uvicorn, Gunicorn
*   **Database:** Supabase (PostgreSQL)
*   **Deployment:** Docker, Render (atau platform serupa)

## Penyiapan dan Instalasi

### Prasyarat

*   Node.js (direkomendasikan v18 atau lebih baru)
*   npm atau pnpm atau yarn
*   Python (direkomendasikan v3.11)
*   pip
*   Git
*   Docker (untuk membangun/menjalankan kontainer backend)
*   Akun Supabase (opsional, untuk penyimpanan database)
*   Instalasi Tesseract (untuk pengembangan backend lokal - lihat [Dokumentasi Tesseract](https://tesseract-ocr.github.io/tessdoc/Installation.html))

### Langkah Instalasi

1.  **Kloning repositori:**
    ```bash
    git clone <url-repositori-anda>
    cd <folder-repositori>
    ```

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
    # Tambahkan URL Supabase dan Kunci Anon Anda jika menggunakan fitur DB
    # Contoh .env:
    # SUPABASE_URL="url_supabase_anda"
    # SUPABASE_ANON_KEY="kunci_anon_supabase_anda"
    # ALLOWED_ORIGINS="http://localhost:3000,https://domain-frontend-anda.com" # Tambahkan URL frontend Anda untuk CORS

    cd ..
    ```
    *Catatan: Untuk pengembangan backend lokal tanpa Docker, pastikan Tesseract terinstal dan folder `tessdata`-nya (berisi `eng.traineddata` dan `ind.traineddata`) dapat diakses. Anda mungkin perlu mengatur variabel lingkungan `TESSDATA_PREFIX` secara lokal.*

3.  **Penyiapan Frontend:**
    ```bash
    cd frontend

    # Instal dependensi Node.js
    npm install
    # atau pnpm install atau yarn install

    # Buat file .env.local
    # Tambahkan URL API backend Anda
    # Contoh .env.local:
    # NEXT_PUBLIC_API_URL="http://127.0.0.1:8000" # Backend lokal
    # Atau gunakan URL backend yang sudah di-deploy: NEXT_PUBLIC_API_URL="https://backend-anda.onrender.com"

    cd ..
    ```

## Menjalankan Aplikasi

1.  **Jalankan Backend:**
    *   **Menggunakan Docker (Direkomendasikan untuk konsistensi):**
        ```bash
        cd backend
        # Bangun image Docker (hanya diperlukan sekali atau setelah ada perubahan)
        docker build -t pbo-tesseract-backend .
        # Jalankan kontainer Docker
        docker run -p 8000:8000 --env-file .env pbo-tesseract-backend
        ```
    *   **Secara Lokal (Membutuhkan Tesseract terinstal):**
        ```bash
        cd backend
        # Pastikan lingkungan virtual aktif
        # Pastikan file .env sudah dikonfigurasi
        uvicorn main:app --reload --port 8000
        ```
    API backend akan berjalan di `http://127.0.0.1:8000`.

2.  **Jalankan Frontend:**
    ```bash
    cd frontend
    # Pastikan .env.local menunjuk ke URL backend yang benar
    npm run dev
    # atau pnpm dev atau yarn dev
    ```
    Server pengembangan frontend akan berjalan di `http://localhost:3000`.

## Deployment

*   **Backend:** Backend dirancang untuk di-deploy sebagai kontainer Docker (lihat `backend/Dockerfile`). Platform seperti Render dapat membangun dan men-deploy langsung dari Dockerfile ini.
    *   **Variabel Lingkungan:** Pastikan `SUPABASE_URL`, `SUPABASE_ANON_KEY` (jika digunakan), `ALLOWED_ORIGINS` (atur ke URL frontend yang di-deploy), dan `PORT` (biasanya disediakan oleh platform) dikonfigurasi di lingkungan deployment.
    *   `TESSDATA_PREFIX` diatur di dalam Dockerfile.
*   **Frontend:** Frontend Next.js dapat di-deploy ke platform seperti Vercel atau Render (sebagai Situs Statis atau Layanan Web).
    *   **Variabel Lingkungan:** Pastikan `NEXT_PUBLIC_API_URL` diatur ke URL backend yang di-deploy selama proses build.

## Penyiapan Supabase (Opsional)

Jika Anda ingin menggunakan fitur untuk menyimpan hasil OCR ke database, Anda perlu menyiapkan proyek Supabase dan membuat tabel yang diperlukan.

1.  Buat proyek baru di [Supabase](https://supabase.com/).
2.  Navigasi ke bagian "SQL Editor" di dasbor proyek Supabase Anda.
3.  Jalankan perintah SQL berikut untuk membuat tabel `ocr_results`:

```sql
CREATE TABLE public.ocr_results (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  file_name TEXT NULL,
  extracted_text TEXT NULL,
  processed_at TIMESTAMPTZ DEFAULT now() NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Opsional: Aktifkan Keamanan Tingkat Baris (Row Level Security - Direkomendasikan)
ALTER TABLE public.ocr_results ENABLE ROW LEVEL SECURITY;

-- Opsional: Buat kebijakan (Contoh: Izinkan akses baca publik)
-- Sesuaikan kebijakan berdasarkan kebutuhan aplikasi Anda.
-- CREATE POLICY "Izinkan akses baca publik" ON public.ocr_results
-- FOR SELECT USING (true);

-- CREATE POLICY "Izinkan penyisipan terotentikasi" ON public.ocr_results
-- FOR INSERT TO authenticated WITH CHECK (true);
```

4.  Dapatkan **URL** dan **kunci anon** proyek Anda dari pengaturan proyek Supabase (bagian API).
5.  Tambahkan kunci-kunci ini ke file `.env` backend Anda:
    ```
    SUPABASE_URL="url_supabase_anda"
    SUPABASE_ANON_KEY="kunci_anon_supabase_anda"
    ```

## Demo Langsung

Lihat versi langsung yang di-deploy di: **[pangkywara.xyz](https://pangkywara.xyz)**
