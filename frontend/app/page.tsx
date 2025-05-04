"use client"

import type React from "react"
import { useState, useRef, useEffect, useMemo, useCallback } from "react"
import {AlertCircle, Loader2, Upload} from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import TopBar from '@/components/ocr/TopBar'
import UploadCard, { ImageType } from '@/components/ocr/UploadCard'
import ResultsDisplay from '@/components/ocr/ResultsDisplay'
import CopiedToast from '@/components/ocr/CopiedToast'
import type { OcrApiResponse, Point} from '@/lib/types' // Import from shared types

// Interface for DB result (Moved to history page)

export default function ImageToTextConverter() {
  // Removed mock t function and i18n object

  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string>("")
  const [ocrResult, setOcrResult] = useState<OcrApiResponse | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [copiedWord, setCopiedWord] = useState<string | null>(null)
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>(["eng", "ind"]) // Default languages
  const [saveResult, setSaveResult] = useState<boolean>(true) // Default to saving
  const [imageType, setImageType] = useState<ImageType>('default') // Re-add imageType state

  const imageContainerRef = useRef<HTMLDivElement>(null);
  const [displayDimensions, setDisplayDimensions] = useState<{width: number, height: number} | null>(null);
  const [naturalDimensions, setNaturalDimensions] = useState<{width: number, height: number} | null>(null);

  // State for drag selection
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [selectionStart, setSelectionStart] = useState<Point | null>(null);
  const [selectionEnd, setSelectionEnd] = useState<Point | null>(null);
  const [selectedText, setSelectedText] = useState<string>("");
  const [selectedWordIndices, setSelectedWordIndices] = useState<number[]>([]);

  // State to track client-side mounting
  const [isMounted, setIsMounted] = useState(false);
  const [isDraggingOverWindow, setIsDraggingOverWindow] = useState(false);
  const dragCounter = useRef(0); // Ref to handle nested drag enter/leave events

  // --- Memo Hooks ---
  const { scaleX, scaleY, offsetX, offsetY } = useMemo(() => {
    let calcScaleX = 1;
    let calcScaleY = 1;
    let calcOffsetX = 0;
    let calcOffsetY = 0;
    if (ocrResult && displayDimensions && naturalDimensions && displayDimensions.width > 0 && displayDimensions.height > 0 && naturalDimensions.width > 0 && naturalDimensions.height > 0) {
        const containerWidth = displayDimensions.width;
        const containerHeight = displayDimensions.height;
        const imageNaturalWidth = naturalDimensions.width;
        const imageNaturalHeight = naturalDimensions.height;
        const containerRatio = containerWidth / containerHeight;
        const imageRatio = imageNaturalWidth / imageNaturalHeight;
        let renderedWidth = containerWidth;
        let renderedHeight = containerHeight;
        if (imageRatio > containerRatio) {
            renderedHeight = containerWidth / imageRatio;
        } else {
            renderedWidth = containerHeight * imageRatio;
        }
        calcOffsetX = (containerWidth - renderedWidth) / 2;
        calcOffsetY = (containerHeight - renderedHeight) / 2;
        if (ocrResult.processed_image_width > 0) {
            calcScaleX = renderedWidth / ocrResult.processed_image_width;
        }
        if (ocrResult.processed_image_height > 0) {
            calcScaleY = renderedHeight / ocrResult.processed_image_height;
        }
    }
    return { scaleX: calcScaleX, scaleY: calcScaleY, offsetX: calcOffsetX, offsetY: calcOffsetY };
  }, [ocrResult, displayDimensions, naturalDimensions]);
  // --- End scaling parameter calculation ---

  // Define resetAll first as it might be used in processSelectedFile's dependencies if needed
  const resetAll = useCallback(() => { // Wrap in useCallback if it relies on setters
    setImageFile(null)
    setImagePreviewUrl(null)
    setFileName("")
    setOcrResult(null)
    setError(null)
    setDisplayDimensions(null)
    setNaturalDimensions(null)
    setCopiedWord(null)
    setIsDragging(false);
    setSelectionStart(null);
    setSelectionEnd(null);
    setSelectedText("");
    setSelectedWordIndices([]);
    const fileInput = document.getElementById("file-upload") as HTMLInputElement | null
    if (fileInput) {
      fileInput.value = ""
    }
    setImageType('default'); // Reset image type
  }, []); // Empty dependencies as it only uses setters

  // Define processSelectedFile using useCallback
  const processSelectedFile = useCallback((file: File) => {
    resetAll(); // Call the memoized version
    setError(null);

    const validTypes = ["image/jpeg", "image/png", "image/jpg"];
    if (!validTypes.includes(file.type)) {
      setError('Jenis berkas tidak valid. Silakan unggah JPEG atau PNG.');
      const fileInput = document.getElementById("file-upload") as HTMLInputElement | null;
      if (fileInput) fileInput.value = "";
      return;
    }

    setImageFile(file);
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = () => {
      const previewUrl = reader.result as string;
      setImagePreviewUrl(previewUrl);
    }
    reader.readAsDataURL(file);
  }, [resetAll]); // Add resetAll as dependency

  // Define other handlers (can be simple const if not passed as prop or needing useCallback)
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    processSelectedFile(file);
  }

  const handleFileDrop = (file: File) => {
    if (!file) return
    processSelectedFile(file);
  }

  const handleLanguageChange = (language: string, checked: boolean | string) => {
    setSelectedLanguages(prev =>
      checked
        ? [...prev, language]
        : prev.filter(lang => lang !== language)
    );
  };

  const handleWordClick = (text: string) => {
    if (text === selectedText && selectedText !== "") {
    }
    navigator.clipboard.writeText(text).then(() => {
        setCopiedWord(text);
        setTimeout(() => setCopiedWord(null), 1500);
    }).catch(err => {
        console.error('Failed to copy text: ', err);
        setError('Gagal menyalin teks.') // Indonesian
    });
  };

  // Define extractTextFromImage (async function)
  const extractTextFromImage = async () => {
    if (!imageFile) {
      setError('Silakan unggah gambar terlebih dahulu.')
      return
    }
    if (selectedLanguages.length === 0) {
        setError('Silakan pilih setidaknya satu bahasa.')
        return
    }

    setIsLoading(true)
    setError(null)
    setOcrResult(null)
    setCopiedWord(null)

    const formData = new FormData()
    formData.append('file', imageFile)
    selectedLanguages.forEach(lang => {
        formData.append('languages', lang);
    });
    formData.append('save_result', String(saveResult));
    formData.append('image_type', imageType); // Send the selected image type

    try {
      console.log("Sending request FormData:", Object.fromEntries(formData));
      const response = await fetch(uploadUrl, {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        let errorMsg = `API Error: ${response.status} ${response.statusText}`;
        try {
          const errorData = await response.json();
          errorMsg = errorData.detail || JSON.stringify(errorData);
        } catch (e) {
          console.error("Could not parse error response:", e);
          // Avoid reading text() if json() failed, read original response if needed
          // errorMsg = await response.text(); // This causes the 'already read' error
        }
        if (errorMsg.includes("Tesseract is not installed")) {
            errorMsg = 'Tesseract tidak terpasang atau tidak ditemukan di PATH server.'; // Indonesian
        } else if (errorMsg.includes("Failed to init API")) {
             errorMsg = 'Gagal menginisialisasi Tesseract. Pastikan data bahasa (tessdata) benar.'; // Indonesian
        }
        throw new Error(errorMsg);
      }

      const data: OcrApiResponse = await response.json();

      if (!data.words || data.words.length === 0) {
          if (data.full_text) {
              setOcrResult(data);
          } else {
              setError('Tidak ada teks yang terdeteksi.') // Indonesian
              setOcrResult(null)
          }
      } else {
          setOcrResult(data)
      }
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan saat menghubungi API.') // Indonesian
      console.error("API call failed:", err)
      setOcrResult(null)
    } finally {
      setIsLoading(false)
    }
  }

  // --- Effect Hooks ---
  useEffect(() => {
    setIsMounted(true);

    // --- Fullscreen Drag Handlers ---
    const handleWindowDragEnter = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounter.current++;
      // Show overlay when files enter the window
      if (e.dataTransfer?.items && e.dataTransfer.items.length > 0) {
          setIsDraggingOverWindow(true);
      }
    };

    const handleWindowDragLeave = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounter.current--;
      // Hide overlay only when the drag truly leaves the window
      if (dragCounter.current <= 0) {
          setIsDraggingOverWindow(false);
          dragCounter.current = 0;
      }
    };

    const handleWindowDragOver = (e: DragEvent) => {
      e.preventDefault(); // Crucial to allow dropping
      e.stopPropagation();
       if (e.dataTransfer) {
         e.dataTransfer.dropEffect = 'copy';
      }
      // No longer setting state to true here - rely on dragenter
    };

    const handleWindowDrop = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      // Ensure state is reset immediately on drop
      setIsDraggingOverWindow(false);
      dragCounter.current = 0;

      if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        const file = e.dataTransfer.files[0];
        e.dataTransfer.clearData();
        processSelectedFile(file);
      }
    };

    // Re-add dragend handler as a failsafe cleanup
    const handleWindowDragEnd = (e: DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        // Force reset state and counter when drag operation ends completely
        setIsDraggingOverWindow(false);
        dragCounter.current = 0;
    };

    // Add listeners
    window.addEventListener('dragenter', handleWindowDragEnter);
    window.addEventListener('dragleave', handleWindowDragLeave);
    window.addEventListener('dragover', handleWindowDragOver);
    window.addEventListener('drop', handleWindowDrop);
    window.addEventListener('dragend', handleWindowDragEnd); // Added dragend listener

    // Cleanup listeners on component unmount
    return () => {
      window.removeEventListener('dragenter', handleWindowDragEnter);
      window.removeEventListener('dragleave', handleWindowDragLeave);
      window.removeEventListener('dragover', handleWindowDragOver);
      window.removeEventListener('drop', handleWindowDrop);
      window.removeEventListener('dragend', handleWindowDragEnd); // Cleanup dragend listener
    };
  }, [processSelectedFile]);

  // useEffect for ResizeObserver
  useEffect(() => {
    const currentRef = imageContainerRef.current;
    if (imagePreviewUrl && currentRef) {
        const resizeObserver = new ResizeObserver(entries => {
            for (let entry of entries) {
                const { width, height } = entry.contentRect;
                setDisplayDimensions(prevDims => {
                    if (!prevDims || prevDims.width !== width || prevDims.height !== height) {
                        return { width, height };
                    }
                    return prevDims;
                });
            }
        });
        resizeObserver.observe(currentRef);

        const { offsetWidth, offsetHeight } = currentRef;
        setDisplayDimensions(prevDims => {
             if (offsetWidth > 0 && offsetHeight > 0 && (!prevDims || prevDims.width !== offsetWidth || prevDims.height !== offsetHeight)) {
                return { width: offsetWidth, height: offsetHeight };
            }
            return prevDims;
        });

        return () => resizeObserver.disconnect();
    } else {
        setDisplayDimensions(null);
    }
  }, [imagePreviewUrl]);

  // Check for readiness: Wait for mount
  if (!isMounted) {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
            <Loader2 className="h-8 w-8 animate-spin text-gray-500 dark:text-gray-400" />
        </div>
    );
  }

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
  const uploadUrl = `${apiUrl}/ocr/upload`;
  // resultsUrl moved to history page

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4 md:p-8 bg-gray-100 dark:bg-gray-900 relative">
      {/* Fullscreen Drop Overlay */} 
      {isDraggingOverWindow && (
        <div className="fixed inset-0 bg-white/80 dark:bg-black/70 z-50 flex flex-col items-center justify-center pointer-events-none">
          <Upload className="h-24 w-24 text-blue-500 dark:text-blue-400 mb-4" />
          <p className="text-2xl font-semibold text-blue-700 dark:text-blue-300">
            Jatuhkan gambar di mana saja untuk unggah
          </p>
        </div>
      )}

      <div className="w-full max-w-4xl space-y-6 relative z-10">
        <TopBar isMounted={isMounted} />

        <h1 className="text-3xl font-bold text-center mb-8 text-gray-800 dark:text-gray-200">
            Kelompok 3 OCR
        </h1>

        <UploadCard
          imagePreviewUrl={imagePreviewUrl}
          fileName={fileName}
          selectedLanguages={selectedLanguages}
          handleLanguageChange={handleLanguageChange}
          saveResult={saveResult}
          setSaveResult={setSaveResult}
          imageType={imageType}
          setImageType={setImageType}
          handleImageUpload={handleImageUpload}
          resetAll={resetAll}
          extractTextFromImage={extractTextFromImage}
          isLoading={isLoading}
          ocrResult={ocrResult}
          imageFile={imageFile}
          onFileDrop={handleFileDrop}
        />

        {error && (
          <Alert variant="destructive" className="bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-700/50">
            <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
            <AlertTitle>Kesalahan</AlertTitle> {/* Indonesian */}
            <AlertDescription className="text-red-700 dark:text-red-400">{error}</AlertDescription>
          </Alert>
        )}

        {(imagePreviewUrl || ocrResult) && (
            <ResultsDisplay
                imagePreviewUrl={imagePreviewUrl}
                ocrResult={ocrResult}
                imageContainerRef={imageContainerRef}
                fileName={fileName}
                setNaturalDimensions={setNaturalDimensions}
                setDisplayDimensions={setDisplayDimensions}
                isDragging={isDragging}
                selectionStart={selectionStart}
                selectionEnd={selectionEnd}
                displayDimensions={displayDimensions}
                naturalDimensions={naturalDimensions}
                selectedWordIndices={selectedWordIndices}
                copiedWord={copiedWord}
                offsetX={offsetX}
                offsetY={offsetY}
                scaleX={scaleX}
                scaleY={scaleY}
                handleWordClick={handleWordClick}
                selectedText={selectedText}
                setIsDragging={setIsDragging}
                setSelectionStart={setSelectionStart}
                setSelectionEnd={setSelectionEnd}
                setSelectedText={setSelectedText}
                setSelectedWordIndices={setSelectedWordIndices}
                setCopiedWord={setCopiedWord}
            />
        )}

        <CopiedToast
            copiedWord={copiedWord}
            selectedText={selectedText}
         />

      </div>
    </main>
  )
}
