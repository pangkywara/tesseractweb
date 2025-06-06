# Kelompok 3 - Aplikasi Web Tesseract OCR!

[![Demo](https://img.shields.io/badge/Demo-Kunjungi%20Aplikasi%20Langsung-blue?style=for-the-badge&logo=vercel)](https://pangkywara.xyz)

Proyek ini adalah aplikasi web yang melakukan Pengenalan Karakter Optik (OCR) pada gambar yang diunggah menggunakan Tesseract. Aplikasi ini memiliki frontend Next.js dan backend FastAPI, dengan hasil yang secara opsional dapat disimpan ke database Supabase beserta gambar aslinya yang disimpan di Supabase Storage (mohon untuk berhati-hati terhadap penggunaan RLS, karena ini hanya untuk diperuntukan uji coba tugas saja).

## Fitur

*   **Unggah Gambar:** Unggah gambar JPEG/PNG melalui seret dan lepas (drag-and-drop) atau pemilih file.
*   **OCR Multi-bahasa:** Mendukung pengenalan teks bahasa Inggris (`eng`) dan Indonesia (`ind`).
*   **Tampilan Kotak Pembatas (Bounding Box):** Menampilkan kata-kata yang dikenali di atas gambar yang telah diproses pada halaman utama.
*   **Ekstraksi Teks:** Menyediakan teks lengkap yang diekstraksi dan memungkinkan penyalinan kata per kata.
*   **Integrasi Database & Storage (Opsional):** Opsi untuk menyimpan hasil teks yang diekstraksi dan URL gambar asli ke database Supabase, dengan gambar disimpan di Supabase Storage.
*   **Riwayat Hasil:** Menampilkan riwayat hasil OCR yang tersimpan (termasuk gambar) pada halaman terpisah (`/history`).
*   **Edit Hasil:** Memungkinkan pengeditan teks hasil ekstraksi, nama file, dan penggantian gambar terkait melalui halaman riwayat.
*   **Hapus Hasil Lengkap:** Menghapus data hasil OCR dari database beserta gambar terkait dari Supabase Storage.
*   **Backend dalam Docker:** Backend dikemas dalam kontainer Docker untuk konsistensi deployment.
*   **Deteksi Jenis Gambar:** Memungkinkan penentuan apakah gambar adalah dokumen umum atau tangkapan layar obrolan (chat) untuk pengaturan pra-pemrosesan/PSM yang mungkin berbeda.

## Tumpukan Teknologi (Technology Stack)

*   **Frontend:** Next.js, React, TypeScript, Tailwind CSS, shadcn/ui
*   **Backend:** FastAPI, Python, Pytesseract, OpenCV-Python, Uvicorn, Gunicorn, Supabase-py
*   **Database:** Supabase (PostgreSQL)
*   **Storage:** Supabase Storage
*   **Deployment:** Docker, Render (atau platform serupa), Vercel

## Penyiapan dan Instalasi

### Prasyarat

*   Node.js (direkomendasikan v18 atau lebih baru)
*   npm atau pnpm atau yarn
*   Python (direkomendasikan v3.11)
*   pip
*   Git
*   Docker (untuk membangun/menjalankan kontainer backend)
*   Akun Supabase (opsional, diperlukan untuk penyimpanan database dan gambar)
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
    # Tambahkan URL Supabase dan Kunci Anon Anda jika menggunakan fitur DB & Storage.
    # Jika menjalankan backend secara lokal (tanpa Docker) dan Tesseract tidak ada di PATH sistem Anda,
    # tambahkan juga path ke executable Tesseract.
    # Contoh .env:
    SUPABASE_URL="url_supabase_anda"
    SUPABASE_ANON_KEY="kunci_anon_supabase_anda"
    ALLOWED_ORIGINS="http://localhost:3000,https://domain-frontend-anda.com" # Tambahkan URL frontend Anda untuk CORS
    # TESSERACT_CMD="C:\\Program Files\\Tesseract-OCR\\tesseract.exe" # Contoh untuk Windows, sesuaikan path jika perlu (Perhatikan double backslash)

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
    NEXT_PUBLIC_API_URL="http://127.0.0.1:8000" # Backend lokal
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
        # Pastikan file .env ada di direktori backend
        docker run -p 8000:8000 --env-file .env pbo-tesseract-backend
        ```
    *   **Secara Lokal (Membutuhkan Tesseract terinstal):**
        *   Pastikan Tesseract terinstal di sistem Anda dan dapat diakses.
        *   Jika Tesseract tidak berada di PATH sistem, pastikan Anda telah menambahkan variabel `TESSERACT_CMD` ke file `.env` di direktori `backend`.
        ```bash
        # Buka terminal BARU atau pastikan Anda berada di DIREKTORI ROOT PROYEK (D:\@PBO-tesseract)
        # Aktifkan lingkungan virtual backend
        # Di Windows:
        .\backend\.venv\Scripts\activate 
        # Di macOS/Linux:
        # source backend/.venv/bin/activate
        
        # Jalankan dari root proyek, menunjuk ke aplikasi di dalam folder backend
        uvicorn backend.main:app --reload --port 8000
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
    *   **Variabel Lingkungan:** Pastikan `SUPABASE_URL`, `SUPABASE_ANON_KEY` (diperlukan untuk database dan storage), `ALLOWED_ORIGINS` (atur ke URL frontend yang di-deploy), dan `PORT` (biasanya disediakan oleh platform) dikonfigurasi di lingkungan deployment.
    *   `TESSDATA_PREFIX` diatur di dalam Dockerfile.
    *   Pastikan Storage Bucket (`ocr-images`) dan kebijakannya juga diatur di Supabase.
*   **Frontend:** Frontend Next.js dapat di-deploy ke platform seperti Vercel atau Render (sebagai Situs Statis atau Layanan Web).
    *   **Variabel Lingkungan:** Pastikan `NEXT_PUBLIC_API_URL` diatur ke URL backend yang di-deploy selama proses build.

## Penyiapan Supabase (Opsional)

Jika Anda ingin menggunakan fitur untuk menyimpan hasil OCR dan gambar, Anda perlu menyiapkan proyek Supabase, membuat tabel database, dan membuat bucket penyimpanan.

1.  Buat proyek baru di [Supabase](https://supabase.com/).
2.  **Database Setup:**
    *   Navigasi ke bagian "SQL Editor" di dasbor proyek Supabase Anda.
    *   Jalankan perintah SQL berikut untuk membuat tabel `ocr_results`:
    ```sql
    CREATE TABLE public.ocr_results (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY, -- Menggunakan UUID sebagai primary key
      file_name TEXT NULL,
      extracted_text TEXT NULL,
      image_url TEXT NULL, -- Kolom baru untuk URL gambar
      processed_at TIMESTAMPTZ DEFAULT now() NULL
      -- Kolom created_at sebelumnya mungkin tidak diperlukan jika processed_at cukup
    );

    -- Opsional tapi direkomendasikan: Aktifkan Keamanan Tingkat Baris (RLS) pada tabel
    ALTER TABLE public.ocr_results ENABLE ROW LEVEL SECURITY;

    -- Contoh Kebijakan RLS untuk tabel (sesuaikan sesuai kebutuhan):
    -- Memungkinkan semua pengguna (termasuk anonim) untuk membaca semua hasil
    CREATE POLICY "Izinkan akses baca publik untuk hasil" ON public.ocr_results
    FOR SELECT USING (true);

    -- Memungkinkan pengguna anonim/backend (menggunakan kunci anon) untuk memasukkan hasil baru
    CREATE POLICY "Izinkan penyisipan anonim untuk hasil" ON public.ocr_results
    FOR INSERT WITH CHECK (auth.role() = 'anon');

    -- Memungkinkan pengguna anonim/backend untuk memperbarui hasil mereka sendiri (jika ada kolom user_id)
    -- Atau, jika pembaruan selalu melalui backend service:
    CREATE POLICY "Izinkan pembaruan anonim untuk hasil" ON public.ocr_results
    FOR UPDATE USING (auth.role() = 'anon') WITH CHECK (auth.role() = 'anon');

    -- Memungkinkan pengguna anonim/backend untuk menghapus hasil
    CREATE POLICY "Izinkan penghapusan anonim untuk hasil" ON public.ocr_results
    FOR DELETE USING (auth.role() = 'anon');
    ```
3.  **Storage Setup:**
    *   Navigasi ke bagian **Storage** di dasbor Supabase Anda.
    *   Buat **Bucket** baru dengan nama persis `ocr-images`.
    *   **PENTING:** Setelah membuat bucket, klik pada bucket tersebut (atau ikon tiga titik ...) dan masuk ke pengaturannya. Aktifkan opsi **"Public bucket"**. Ini diperlukan agar URL gambar dapat diakses langsung oleh tag `<img>` di frontend.
    *   Pergi ke bagian **Policies** untuk bucket `ocr-images`.
    *   Tambahkan (atau pastikan ada) kebijakan berikut:
        *   **Kebijakan untuk Upload (INSERT):**
            *   Nama: `Allow anonymous uploads` (atau nama deskriptif lainnya)
            *   Allowed operation(s): `INSERT`
            *   Target role(s): `anon`
            *   USING expression / Policy definition: `bucket_id = 'ocr-images'`
        *   **Kebijakan untuk Read (SELECT):**
            *   Nama: `Allow anonymous reads` (atau nama deskriptif lainnya)
            *   Allowed operation(s): `SELECT`
            *   Target role(s): `anon`
            *   USING expression / Policy definition: `bucket_id = 'ocr-images'`
        *   **Kebijakan untuk Delete (DELETE):** (Diperlukan agar backend dapat menghapus gambar saat entri riwayat dihapus)
            *   Nama: `Allow anonymous deletes` (atau nama deskriptif lainnya)
            *   Allowed operation(s): `DELETE`
            *   Target role(s): `anon`
            *   USING expression / Policy definition: `bucket_id = 'ocr-images'`
    *   *Catatan: Mengizinkan operasi `anon` seperti ini nyaman untuk pengembangan, tetapi untuk produksi, pertimbangkan untuk menggunakan kunci `service_role` di backend Anda untuk keamanan yang lebih baik saat melakukan operasi tulis/hapus pada storage.*

4.  Dapatkan **URL** dan **kunci anon** proyek Anda dari pengaturan proyek Supabase (bagian API).
5.  Tambahkan kunci-kunci ini ke file `.env` backend Anda:
    ```
    SUPABASE_URL="url_supabase_anda"
    SUPABASE_ANON_KEY="kunci_anon_supabase_anda"
    ```

## Demo Langsung

Lihat versi langsung yang di-deploy di: **[pangkywara.xyz](https://pangkywara.xyz)** 
