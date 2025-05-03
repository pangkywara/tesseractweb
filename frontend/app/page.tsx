"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import { Upload, FileText, AlertCircle, Loader2, Copy, Languages, Save, RefreshCw, History } from "lucide-react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"
import Image from "next/image"
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"

// Interface for the word data structure
interface WordData {
  text: string;
  left: number;
  top: number;
  width: number;
  height: number;
  confidence: number;
}

// Interface for the API response structure (now includes full_text)
interface OcrApiResponse {
  processed_image_width: number;
  processed_image_height: number;
  words: WordData[];
  full_text: string; // Added field
}

// Interface for selection rectangle coordinates
interface Point { x: number; y: number; }
interface SelectionRect {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

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

  // State for DB results
  const [dbResults, setDbResults] = useState<DbResult[] | null>(null);
  const [isFetchingResults, setIsFetchingResults] = useState<boolean>(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // State to track client-side mounting
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
  const uploadUrl = `${apiUrl}/ocr/upload`;
  const resultsUrl = `${apiUrl}/ocr/results`; // URL for fetching results

  // Add a check for initialization
  if (isMounted && !i18n.isInitialized) {
    return null;
  }

  // --- Coordinate Transformation Logic --- (defined outside component or memoized if needed)
  const calculateOverlayParams = () => {
    let scaleX = 1;
    let scaleY = 1;
    let offsetX = 0;
    let offsetY = 0;
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
      offsetX = (containerWidth - renderedWidth) / 2;
      offsetY = (containerHeight - renderedHeight) / 2;
      if (ocrResult.processed_image_width > 0) {
        scaleX = renderedWidth / ocrResult.processed_image_width;
      }
      if (ocrResult.processed_image_height > 0) {
        scaleY = renderedHeight / ocrResult.processed_image_height;
      }
    }
    return { scaleX, scaleY, offsetX, offsetY };
  }
  const { scaleX, scaleY, offsetX, offsetY } = calculateOverlayParams(); // Calculate once per render

  const mapCoordsToProcessed = (containerX: number, containerY: number): Point | null => {
    if (scaleX === 0 || scaleY === 0) return null; // Avoid division by zero
    const processedX = (containerX - offsetX) / scaleX;
    const processedY = (containerY - offsetY) / scaleY;
    return { x: processedX, y: processedY };
  };

  // Helper function to check rectangle intersection
  const checkIntersection = (rectA: DOMRect | SelectionRect, rectB: WordData): boolean => {
      // Convert rectA if it's SelectionRect (relative coords)
      let selLeft = 0, selTop = 0, selRight = 0, selBottom = 0;
      if ('startX' in rectA) { // Check if it's SelectionRect
          selLeft = Math.min(rectA.startX, rectA.endX);
          selTop = Math.min(rectA.startY, rectA.endY);
          selRight = Math.max(rectA.startX, rectA.endX);
          selBottom = Math.max(rectA.startY, rectA.endY);
      } else { // Assume DOMRect like structure
          selLeft = rectA.left;
          selTop = rectA.top;
          selRight = rectA.right;
          selBottom = rectA.bottom;
      }

      const wordLeft = rectB.left;
      const wordTop = rectB.top;
      const wordRight = rectB.left + rectB.width;
      const wordBottom = rectB.top + rectB.height;

      // Check for non-overlap
      if (selRight < wordLeft || selLeft > wordRight || selBottom < wordTop || selTop > wordBottom) {
          return false;
      }
      return true; // Overlap detected
  };

  // --- Event Handlers for Drag Selection ---
  const getCoordsInContainer = (e: React.MouseEvent<HTMLDivElement>): Point | null => {
      const container = imageContainerRef.current;
      if (!container) return null;
      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      return { x, y };
  }

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
      // Only start drag if OCR results exist and click is inside the image bounds (considering offset)
      if (!ocrResult || !ocrResult.words || !displayDimensions) return;
      const coords = getCoordsInContainer(e);
      if (!coords) return;

      // Check if click is within the rendered image area
      const { scaleX, scaleY, offsetX, offsetY } = calculateOverlayParams();
      const renderedWidth = ocrResult.processed_image_width * scaleX;
      const renderedHeight = ocrResult.processed_image_height * scaleY;
      if (coords.x < offsetX || coords.x > offsetX + renderedWidth || coords.y < offsetY || coords.y > offsetY + renderedHeight) {
          return; // Click outside image bounds
      }

      setIsDragging(true);
      setSelectionStart(coords);
      setSelectionEnd(coords); // Initialize end to start
      setSelectedText("");
      setSelectedWordIndices([]);
      setCopiedWord(null); // Clear single word copy state
      e.preventDefault(); // Prevent default drag behavior (like image ghosting)
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
      if (!isDragging || !selectionStart || !ocrResult || !ocrResult.words) return;
      const currentCoords = getCoordsInContainer(e);
      if (!currentCoords) return;

      setSelectionEnd(currentCoords);

      // Map selection to processed image coordinates
      const procStart = mapCoordsToProcessed(selectionStart.x, selectionStart.y);
      const procEnd = mapCoordsToProcessed(currentCoords.x, currentCoords.y);

      if (procStart && procEnd) {
          const selectionRectProc: SelectionRect = {
              startX: procStart.x,
              startY: procStart.y,
              endX: procEnd.x,
              endY: procEnd.y,
          };

          // Find intersecting words during drag for visual feedback
          const intersectingIndices = ocrResult.words.reduce((indices, word, index) => {
              if (checkIntersection(selectionRectProc, word)) {
                  indices.push(index);
              }
              return indices;
          }, [] as number[]);
          setSelectedWordIndices(intersectingIndices);
      }
  };

  const handleMouseUpOrLeave = (e: React.MouseEvent<HTMLDivElement>) => {
      if (!isDragging || !selectionStart || !selectionEnd || !ocrResult || !ocrResult.words) {
          if (isDragging) setIsDragging(false); // Ensure dragging stops if started incorrectly
          return;
      }

      // Finalize selection coordinates based on event type if needed
      const finalEndCoords = getCoordsInContainer(e) || selectionEnd;

      // Map final selection to processed image coordinates
      const procStart = mapCoordsToProcessed(selectionStart.x, selectionStart.y);
      const procEnd = mapCoordsToProcessed(finalEndCoords.x, finalEndCoords.y);

      let finalSelectedText = "";
      let finalSelectedIndices: number[] = [];

      if (procStart && procEnd) {
            const finalRectProc: SelectionRect = {
              startX: procStart.x,
              startY: procStart.y,
              endX: procEnd.x,
              endY: procEnd.y,
            };

            const intersectingWords = ocrResult.words.filter((word, index) => {
                if (checkIntersection(finalRectProc, word)) {
                    finalSelectedIndices.push(index);
                    return true;
                }
                return false;
            });

            // Basic joining - assumes left-to-right, top-to-bottom reading order
            // A more sophisticated approach would sort by coordinates
            // Sort by top first, then left for reading order
             intersectingWords.sort((a, b) => {
                if (Math.abs(a.top - b.top) < (Math.max(a.height, b.height) / 2)) { // Treat as same line if vertical overlap/close
                    return a.left - b.left; // Sort by left coordinate
                } else {
                    return a.top - b.top; // Sort by top coordinate
                }
             });

             finalSelectedText = intersectingWords.map(word => word.text).join(" ");
      }

      setIsDragging(false);
      setSelectedText(finalSelectedText);
      setSelectedWordIndices(finalSelectedIndices); // Set final indices
      // Keep selection rectangle visible by not resetting start/end until next mousedown
      // setSelectionStart(null);
      // setSelectionEnd(null);
  };

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

  useEffect(() => {
    const currentRef = imageContainerRef.current;
    if (imagePreviewUrl && currentRef) {
      const resizeObserver = new ResizeObserver(entries => {
        for (let entry of entries) {
          const { width, height } = entry.contentRect;
          if (!displayDimensions || displayDimensions.width !== width || displayDimensions.height !== height) {
            console.log(`Image container resized to: ${width}x${height}`);
            setDisplayDimensions({ width, height });
          }
        }
      });
      resizeObserver.observe(currentRef);

      const { offsetWidth, offsetHeight } = currentRef;
      if (offsetWidth > 0 && offsetHeight > 0 && (!displayDimensions || displayDimensions.width !== offsetWidth || displayDimensions.height !== offsetHeight) ){
          console.log(`Initial Image container dimensions: ${offsetWidth}x${offsetHeight}`);
          setDisplayDimensions({ width: offsetWidth, height: offsetHeight });
      }

      return () => resizeObserver.disconnect();
    } else {
        setDisplayDimensions(null);
    }
  }, [imagePreviewUrl, displayDimensions]); // Added displayDimensions dependency

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

  // Function to fetch results from the backend
  const fetchResults = async () => {
    setIsFetchingResults(true);
    setFetchError(null);
    try {
      console.log(`Fetching results from: ${resultsUrl}`);
      const response = await fetch(resultsUrl);
      if (!response.ok) {
        let errorMsg = `API Error: ${response.status} ${response.statusText}`;
        try {
          const errorData = await response.json();
          errorMsg = errorData.detail || JSON.stringify(errorData);
        } catch (e) {
          console.error("Could not parse error response:", e);
          errorMsg = await response.text();
        }
        throw new Error(errorMsg);
      }
      const data: DbResult[] = await response.json();
      setDbResults(data);
    } catch (err: any) {
      console.error("Failed to fetch results:", err);
      setFetchError(err.message || t('fetchDbError')); // Add translation key
      setDbResults(null);
    } finally {
      setIsFetchingResults(false);
    }
  };

  // Fetch results on mount and when OCR result is set (and save was true)
  useEffect(() => {
    if (isMounted) { // Fetch only after mounting
        fetchResults();
    }
  }, [isMounted]); // Depend on isMounted

  // Refetch if saveResult was true and ocrResult changed successfully
   useEffect(() => {
    // Ensure isMounted check is also here if fetchResults could be called early
    if (isMounted && saveResult && ocrResult && !isLoading && !error) {
        console.log("OCR successful and save enabled, refetching DB results...");
        fetchResults();
    }
  }, [ocrResult, saveResult, isLoading, error, isMounted]); // Add isMounted dependency

  // Format date utility
  const formatDate = (dateString: string) => {
      try {
          return new Date(dateString).toLocaleString(i18n.language); // Format based on current UI lang
      } catch (e) {
          return dateString; // Fallback
      }
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4 md:p-8 bg-gray-100 dark:bg-gray-900">
      <div className="w-full max-w-4xl space-y-6">
        {/* Top Bar: Language Switcher & History Button */} 
        <div className="flex justify-end items-center space-x-2 mb-4 h-9">
          {isMounted && (
              <>
                  {/* Language Buttons */} 
                  <Button variant={i18n.language === 'en' ? "secondary" : "ghost"} size="sm" onClick={() => changeLanguage('en')}>EN</Button>
                  <Button variant={i18n.language === 'id' ? "secondary" : "ghost"} size="sm" onClick={() => changeLanguage('id')}>ID</Button>
                  
                  {/* History Sheet Trigger */} 
                  <Sheet>
                      <SheetTrigger asChild>
                          <Button variant="outline" size="sm" className="flex items-center gap-1">
                              <History className="w-4 h-4" />
                              {t('viewHistoryButton')} 
                          </Button>
                      </SheetTrigger>
                      <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto"> {/* Adjust width and add scroll */} 
                          <SheetHeader>
                              <SheetTitle>{t('dbResultsTitle')}</SheetTitle>
                              <SheetDescription>{t('dbResultsDescription')}</SheetDescription>
                          </SheetHeader>
                          <div className="py-4">
                              {/* Content moved from the Card */} 
                              <div className="flex justify-end mb-2">
                                 <Button variant="ghost" size="sm" onClick={fetchResults} disabled={isFetchingResults} title={t('refreshDbButtonTooltip') ?? 'Refresh Table'} className="flex items-center gap-1">
                                    <RefreshCw className={`h-4 w-4 ${isFetchingResults ? 'animate-spin' : ''}`} />
                                     {t('refreshDbButton') ?? 'Refresh'}
                                </Button>
                              </div>
                              {/* Loading State */}
                              {isFetchingResults && (
                                  <div className="flex justify-center items-center py-6">
                                      <Loader2 className="h-6 w-6 animate-spin text-gray-500 dark:text-gray-400" />
                                      <p className="ml-2 text-gray-500 dark:text-gray-400">{t('loadingDbResults')}</p>
                                  </div>
                              )}
                              {/* Error State */}
                              {fetchError && !isFetchingResults && (
                                  <Alert variant="destructive" className="my-4">
                                      <AlertCircle className="h-4 w-4" />
                                      <AlertTitle>{t('errorTitle')}</AlertTitle>
                                      <AlertDescription>{fetchError}</AlertDescription>
                                  </Alert>
                              )}
                              {/* Table Display */}
                              {!isFetchingResults && !fetchError && dbResults && dbResults.length > 0 && (
                                  <Table>
                                      <TableHeader>
                                           <TableRow>
                                              <TableHead className="w-[50px]">{t('dbHeaderId')}</TableHead>
                                              <TableHead>{t('dbHeaderFileName')}</TableHead>
                                              <TableHead>{t('dbHeaderExtractedText')}</TableHead>
                                              <TableHead className="text-right">{t('dbHeaderProcessedAt')}</TableHead>
                                          </TableRow>
                                      </TableHeader>
                                      <TableBody>
                                          {dbResults.map((result) => (
                                              <TableRow key={result.id}>
                                                   <TableCell className="font-medium">{result.id.toString().substring(0, 8)}</TableCell> {/* Show truncated UUID */}
                                                   <TableCell className="max-w-[100px] truncate" title={result.file_name ?? undefined}>{result.file_name || '-'}</TableCell>
                                                   <TableCell className="max-w-[150px] truncate" title={result.extracted_text ?? undefined}>
                                                       {result.extracted_text ? `${result.extracted_text.substring(0, 30)}...` : '-'}
                                                   </TableCell>
                                                   <TableCell className="text-right text-xs">{formatDate(result.processed_at)}</TableCell>
                                               </TableRow>
                                          ))}
                                      </TableBody>
                                  </Table>
                              )}
                              {/* Empty State */}
                              {!isFetchingResults && !fetchError && (!dbResults || dbResults.length === 0) && (
                                  <p className="text-center text-gray-500 dark:text-gray-400 py-6">{t('noDbResults')}</p>
                              )}
                          </div>
                      </SheetContent>
                  </Sheet>
              </>
          )}
        </div>

        {/* Ensure main title only renders translatable content when ready */}
        <h1 className="text-3xl font-bold text-center mb-8 text-gray-800 dark:text-gray-200">
            {isMounted ? t('mainTitle') : 'Kelompok 3 OCR'} {/* Fallback title before mount */}
        </h1>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <Card className="bg-white dark:bg-gray-800 shadow-lg rounded-lg overflow-hidden">
          <CardHeader>
              <CardTitle className="text-gray-900 dark:text-gray-100">{t('uploadCardTitle')}</CardTitle>
              <CardDescription className="text-gray-600 dark:text-gray-400">{t('uploadCardDescription')}</CardDescription>
          </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Image Upload Area */}
              <div className="space-y-4">
                <Label htmlFor="file-upload" className="text-gray-700 dark:text-gray-300">{t('imageFileLabel')}</Label>
                {!imagePreviewUrl ? (
                  <div
                    className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex flex-col items-center justify-center h-48"
                onClick={() => document.getElementById("file-upload")?.click()}
              >
                    <Upload className="h-10 w-10 mx-auto mb-3 text-gray-400 dark:text-gray-500" />
                    <p className="text-sm text-gray-500 dark:text-gray-400">{t('uploadArea')}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{t('uploadHint')}</p>
                <input
                  id="file-upload"
                  type="file"
                  accept="image/jpeg,image/png,image/jpg"
                  className="hidden"
                  onChange={handleImageUpload}
                />
              </div>
            ) : (
                  <p className="text-sm text-center text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 p-2 rounded">{fileName}</p>
                )}
              </div>

              {/* OCR Options */}
              <div className="space-y-6">
                <Label className="flex items-center gap-2 text-gray-700 dark:text-gray-300"><Languages className="w-4 h-4"/> {t('ocrLangLabel')}</Label>
                <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-2 sm:space-y-0 sm:space-x-4">
                  <div className="flex items-center">
                    <Checkbox id="lang-eng" checked={selectedLanguages.includes('eng')} onCheckedChange={(checked) => handleLanguageChange('eng', checked)} />
                    <Label htmlFor="lang-eng" className="ml-2 font-normal text-gray-600 dark:text-gray-400">{t('langEnglish')}</Label>
                  </div>
                  <div className="flex items-center">
                    <Checkbox id="lang-ind" checked={selectedLanguages.includes('ind')} onCheckedChange={(checked) => handleLanguageChange('ind', checked)} />
                    <Label htmlFor="lang-ind" className="ml-2 font-normal text-gray-600 dark:text-gray-400">{t('langIndonesian')}</Label>
                  </div>
                </div>
                <div className="flex items-center space-x-2 pt-2">
                  <Checkbox id="save-result" checked={saveResult} onCheckedChange={(checked) => setSaveResult(Boolean(checked))} />
                  <Label htmlFor="save-result" className="flex items-center gap-1 font-normal text-gray-600 dark:text-gray-400">
                    <Save className="w-3 h-3"/> {t('saveResultLabel')}
                  </Label>
                </div>
              </div>
          </CardContent>
            <CardFooter className="flex flex-col sm:flex-row justify-between gap-3 sm:gap-0 bg-gray-50 dark:bg-gray-700 p-4">
              <Button variant="outline" onClick={resetAll} disabled={isLoading || (!imagePreviewUrl && !ocrResult)} className="w-full sm:w-auto">
                {t('clearButton')}
            </Button>
              <Button onClick={extractTextFromImage} disabled={isLoading || !imageFile || selectedLanguages.length === 0} className="flex items-center gap-2 w-full sm:w-auto">
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                    {t('processingButton')}
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4" />
                    {t('extractButton')}
                </>
              )}
            </Button>
          </CardFooter>
        </Card>
        </motion.div>

        {error && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
            <Alert variant="destructive" className="bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-700/50">
              <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
              <AlertTitle className="text-red-800 dark:text-red-300">{t('errorTitle')}</AlertTitle>
              <AlertDescription className="text-red-700 dark:text-red-400">{error}</AlertDescription>
          </Alert>
          </motion.div>
        )}

        {/* Image Preview and Results Area */}
        {(imagePreviewUrl || ocrResult) && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}>
            <Card className="bg-white dark:bg-gray-800 shadow-lg rounded-lg overflow-hidden">
            <CardHeader>
                <CardTitle className="text-gray-900 dark:text-gray-100">{t('previewCardTitle')}</CardTitle>
            </CardHeader>
              <CardContent className="space-y-4">
                {imagePreviewUrl && (
                    <div
                        ref={imageContainerRef}
                        className="relative w-full overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700 min-h-[200px] aspect-video bg-gray-100 dark:bg-gray-700 cursor-crosshair select-none"
                        onMouseDown={handleMouseDown}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUpOrLeave}
                        onMouseLeave={handleMouseUpOrLeave}
                    >
                    <Image
                        src={imagePreviewUrl}
                        alt={fileName || "Uploaded image"}
                        fill
                        className="object-contain pointer-events-none"
                        priority
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 60vw"
                        onLoad={(e) => {
                            const target = e.target as HTMLImageElement;
                            console.log(`Image natural dimensions: ${target.naturalWidth}x${target.naturalHeight}`);
                            if (target.naturalWidth > 0 && target.naturalHeight > 0) {
                                setNaturalDimensions({ width: target.naturalWidth, height: target.naturalHeight });
                            }
                            if (imageContainerRef.current) {
                                const { offsetWidth, offsetHeight } = imageContainerRef.current;
                                console.log(`Image container dimensions on load: ${offsetWidth}x${offsetHeight}`);
                                if (offsetWidth > 0 && offsetHeight > 0) {
                                    setDisplayDimensions({ width: offsetWidth, height: offsetHeight });
                                }
                            }
                        }}
                    />

                    {isDragging && selectionStart && selectionEnd && (
                        <div
                            className="absolute border border-dashed border-blue-500 bg-blue-500/10 pointer-events-none"
                            style={{
                                left: `${Math.min(selectionStart.x, selectionEnd.x)}px`,
                                top: `${Math.min(selectionStart.y, selectionEnd.y)}px`,
                                width: `${Math.abs(selectionEnd.x - selectionStart.x)}px`,
                                height: `${Math.abs(selectionEnd.y - selectionStart.y)}px`,
                            }}
                         />
                    )}

                    {ocrResult && ocrResult.words && displayDimensions && naturalDimensions && ocrResult.words.map((word, index) => {
                        const confidenceText = typeof word.confidence === 'number' ? word.confidence.toFixed(1) : 'N/A';
                        const isSelected = selectedWordIndices.includes(index);
                        const isCopied = copiedWord === word.text;
                        return (
                            <div
                            key={`${index}-${word.text}-${word.left}-${word.top}`}
                            title={`Text: ${word.text}\nConf: ${confidenceText}%`}
                            className={`absolute border transition-all duration-100 cursor-pointer
                                        ${isSelected ? 'border-green-500 bg-green-500/30 ring-1 ring-green-600' : 'border-blue-600/70 hover:bg-blue-500/30'}
                                        ${isCopied ? 'bg-green-500/40 ring-2 ring-green-500' : isSelected ? '' : 'bg-transparent'}`}
                            style={{
                                left: `${offsetX + word.left * scaleX}px`,
                                top: `${offsetY + word.top * scaleY}px`,
                                width: `${Math.max(2, word.width * scaleX)}px`,
                                height: `${Math.max(2, word.height * scaleY)}px`,
                                pointerEvents: isDragging ? 'none' : 'auto'
                            }}
                            onClick={() => !isDragging && handleWordClick(word.text)}
                            />
                        );
                    })}
                    </div>
                )}

                {selectedText && (
                    <div className="mt-4 p-3 bg-gray-100 dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600">
                        <Label className="text-sm font-medium text-gray-600 dark:text-gray-300 block mb-1">{t('selectedTextLabel')}</Label>
                        <p className="text-sm text-gray-800 dark:text-gray-200 mb-2 whitespace-pre-wrap break-words">{selectedText}</p>
                        <Button size="sm" variant="outline" onClick={() => handleWordClick(selectedText)} className="flex items-center gap-1">
                            <Copy className="w-3 h-3"/> {t('copySelectionButton')}
                        </Button>
                    </div>
                )}

                {ocrResult && ocrResult.full_text && !selectedText && (
                     <div>
                        <Label htmlFor="full-text-output" className="text-gray-700 dark:text-gray-300">{t('fullTextLabel')}</Label>
                        <Textarea
                            id="full-text-output"
                            readOnly
                            value={ocrResult.full_text}
                            className="mt-1 w-full h-32 bg-gray-50 dark:bg-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-600"
                            placeholder={t('fullTextPlaceholder')}
                        />
              </div>
                )}
            </CardContent>
          </Card>
          </motion.div>
        )}

        {copiedWord && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} transition={{ duration: 0.2 }}>
            <div className="fixed bottom-5 right-5 bg-green-100 dark:bg-green-900 border border-green-400 dark:border-green-600 text-green-700 dark:text-green-300 px-4 py-2 rounded-md shadow-lg z-50 flex items-center gap-2">
              {selectedText && copiedWord === selectedText ? <Copy className="w-4 h-4"/> : <Save className="w-4 h-4"/>}
              {t('copiedToast', { text: copiedWord.length > 50 ? copiedWord.substring(0, 47) + '...' : copiedWord })}
            </div>
          </motion.div>
        )}
      </div>
    </main>
  )
}
