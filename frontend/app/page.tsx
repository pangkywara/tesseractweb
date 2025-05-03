"use client"

import type React from "react"
import { useState, useRef, useEffect, useMemo } from "react"
import {AlertCircle, Loader2} from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import TopBar from '@/components/ocr/TopBar'
import UploadCard from '@/components/ocr/UploadCard'
import ResultsDisplay from '@/components/ocr/ResultsDisplay'
import CopiedToast from '@/components/ocr/CopiedToast'
import type { OcrApiResponse, Point} from '@/lib/types' // Import from shared types

// Interface for DB result
interface DbResult {
    id: number;
    file_name: string | null;
    extracted_text: string | null;
    processed_at: string; // Keep as string for simplicity, format later
}

export default function ImageToTextConverter() {
  const { t, i18n } = useTranslation();
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string>("")
  const [ocrResult, setOcrResult] = useState<OcrApiResponse | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [copiedWord, setCopiedWord] = useState<string | null>(null)
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>(["eng", "ind"]) // Default languages
  const [saveResult, setSaveResult] = useState<boolean>(true) // Default to saving

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
  useEffect(() => {
    setIsMounted(true);
  }, []);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
  const uploadUrl = `${apiUrl}/ocr/upload`;
  const resultsUrl = `${apiUrl}/ocr/results`; // URL for fetching results

  // Moved useEffect for ResizeObserver before the conditional return
  useEffect(() => {
    // The effect hook itself runs on every render after the first,
    // but the logic inside can depend on state/props.
    const currentRef = imageContainerRef.current;
    if (imagePreviewUrl && currentRef) {
        const resizeObserver = new ResizeObserver(entries => {
            for (let entry of entries) {
                const { width, height } = entry.contentRect;
                // Only update if dimensions actually change to avoid loops
                // Use functional update for setDisplayDimensions if it depends on previous state
                setDisplayDimensions(prevDims => {
                    if (!prevDims || prevDims.width !== width || prevDims.height !== height) {
                        console.log(`Image container resized to: ${width}x${height}`);
                        return { width, height };
                    }
                    return prevDims; // No change
                });
            }
        });
        resizeObserver.observe(currentRef);

        // Set initial dimensions if needed
        const { offsetWidth, offsetHeight } = currentRef;
        // Use functional update here too for consistency
        setDisplayDimensions(prevDims => {
             if (offsetWidth > 0 && offsetHeight > 0 && (!prevDims || prevDims.width !== offsetWidth || prevDims.height !== offsetHeight)) {
                console.log(`Initial Image container dimensions: ${offsetWidth}x${offsetHeight}`);
                return { width: offsetWidth, height: offsetHeight };
            }
            return prevDims; // No change or invalid initial dimensions
        });

        // Cleanup function
        return () => resizeObserver.disconnect();
    } else {
        // Clear dimensions when image is removed or ref is not available
        setDisplayDimensions(null);
    }
  }, [imagePreviewUrl]); // Dependency array remains the same

  // Check for readiness: Wait for mount AND i18n initialization
  if (!isMounted || !i18n.isInitialized) {
    // Render loading indicator until ready to prevent hydration mismatch
    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
            <Loader2 className="h-8 w-8 animate-spin text-gray-500 dark:text-gray-400" />
            {/* Optional: Add a subtle loading text */}
            {/* <span className="ml-2 text-gray-500 dark:text-gray-400">Loading UI...</span> */}
        </div>
    );
  }

  // Calculate params here because they are needed for the ResultsDisplay props
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

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    resetAll();
    setError(null); 

    const validTypes = ["image/jpeg", "image/png", "image/jpg"];
    if (!validTypes.includes(file.type)) {
      setError(t('invalidFileType'));
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
  }

  const handleLanguageChange = (language: string, checked: boolean | string) => {
    setSelectedLanguages(prev =>
      checked
        ? [...prev, language]
        : prev.filter(lang => lang !== language)
    );
  };

  const extractTextFromImage = async () => {
    if (!imageFile) {
      setError(t('uploadFirst'))
      return
    }
    if (selectedLanguages.length === 0) {
        setError(t('selectLangFirst'))
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

    console.log("Sending form data:", Object.fromEntries(formData));

    try {
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
          errorMsg = await response.text();
        }
        if (errorMsg.includes("Tesseract is not installed")) {
            errorMsg = t('tesseractNotFound');
        } else if (errorMsg.includes("Failed to init API")) {
             errorMsg = t('tessdataNotFound');
        }
        throw new Error(errorMsg);
      }

      const data: OcrApiResponse = await response.json();

      if (!data.words || data.words.length === 0) {
          if (data.full_text) {
              console.log("API returned full_text but no word data.")
              setOcrResult(data);
          } else {
              setError(t('noTextDetected'))
              setOcrResult(null)
          }
      } else {
          setOcrResult(data)
      }
    } catch (err: any) {
      setError(err.message || t('apiError'))
      console.error("API call failed:", err)
      setOcrResult(null)
    } finally {
      setIsLoading(false)
    }
  }

  const handleWordClick = (text: string) => {
    // Check if this call is for the multi-word selection
    if (text === selectedText && selectedText !== "") {
      console.log(`Copying selected text: "${text}"`);
    }
    navigator.clipboard.writeText(text).then(() => {
        console.log(`Copied: ${text}`);
        setCopiedWord(text);
        setTimeout(() => setCopiedWord(null), 1500);
    }).catch(err => {
        console.error('Failed to copy text: ', err);
        setError(t('copyFail'))
    });
  };

  const resetAll = () => {
    setImageFile(null)
    setImagePreviewUrl(null)
    setFileName("")
    setOcrResult(null)
    setError(null) // Clear error on reset
    setDisplayDimensions(null)
    setNaturalDimensions(null)
    setCopiedWord(null)
    // Clear selection states
    setIsDragging(false);
    setSelectionStart(null);
    setSelectionEnd(null);
    setSelectedText("");
    setSelectedWordIndices([]);
    // Don't reset language/save preferences on simple reset
    // setSelectedLanguages(["eng", "ind"])
    // setSaveResult(true)
    const fileInput = document.getElementById("file-upload") as HTMLInputElement | null
    if (fileInput) {
      fileInput.value = ""
    }
  }

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4 md:p-8 bg-gray-100 dark:bg-gray-900">
      <div className="w-full max-w-4xl space-y-6">
        {/* Use TopBar component */}
        <TopBar
          isMounted={isMounted}
          i18n={i18n}
          t={t}
          changeLanguage={changeLanguage}
        />

        {/* Main Title */}
        <h1 className="text-3xl font-bold text-center mb-8 text-gray-800 dark:text-gray-200">
            {t('mainTitle')}
        </h1>

        {/* Use UploadCard component */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <UploadCard
            t={t}
            imagePreviewUrl={imagePreviewUrl}
            fileName={fileName}
            selectedLanguages={selectedLanguages}
            handleLanguageChange={handleLanguageChange}
            saveResult={saveResult}
            setSaveResult={setSaveResult}
            handleImageUpload={handleImageUpload}
            resetAll={resetAll}
            extractTextFromImage={extractTextFromImage}
            isLoading={isLoading}
            ocrResult={ocrResult}
            imageFile={imageFile}
          />
        </motion.div>

        {/* Error Alert (remains here) */}
        {error && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
            <Alert variant="destructive" className="bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-700/50">
              <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
              <AlertTitle className="text-red-800 dark:text-red-300">{t('errorTitle')}</AlertTitle>
              <AlertDescription className="text-red-700 dark:text-red-400">{error}</AlertDescription>
          </Alert>
          </motion.div>
        )}

        {/* Use ResultsDisplay component (conditionally rendered) */}
        {(imagePreviewUrl || ocrResult) && (
            <ResultsDisplay
                t={t}
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

        {/* Use CopiedToast component */}
        <CopiedToast t={t} copiedWord={copiedWord} selectedText={selectedText} />

      </div>
    </main>
  )
}
