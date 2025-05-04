"use client";

import React, { useRef, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Copy } from "lucide-react";
import Image from "next/image";
import type { OcrApiResponse, WordData, Point, SelectionRect } from '@/lib/types'; // Import from shared types

interface ResultsDisplayProps {
    imagePreviewUrl: string | null;
    ocrResult: OcrApiResponse | null;
    imageContainerRef: React.RefObject<HTMLDivElement>;
    fileName: string;
    setNaturalDimensions: React.Dispatch<React.SetStateAction<{ width: number; height: number; } | null>>;
    setDisplayDimensions: React.Dispatch<React.SetStateAction<{ width: number; height: number; } | null>>;
    isDragging: boolean;
    selectionStart: Point | null;
    selectionEnd: Point | null;
    displayDimensions: { width: number; height: number; } | null;
    naturalDimensions: { width: number; height: number; } | null;
    selectedWordIndices: number[];
    copiedWord: string | null;
    offsetX: number;
    offsetY: number;
    scaleX: number;
    scaleY: number;
    handleWordClick: (text: string) => void;
    selectedText: string;
    setIsDragging: React.Dispatch<React.SetStateAction<boolean>>;
    setSelectionStart: React.Dispatch<React.SetStateAction<Point | null>>;
    setSelectionEnd: React.Dispatch<React.SetStateAction<Point | null>>;
    setSelectedText: React.Dispatch<React.SetStateAction<string>>;
    setSelectedWordIndices: React.Dispatch<React.SetStateAction<number[]>>;
    setCopiedWord: React.Dispatch<React.SetStateAction<string | null>>;
}

const ResultsDisplay: React.FC<ResultsDisplayProps> = ({
    imagePreviewUrl,
    ocrResult,
    imageContainerRef,
    fileName,
    setNaturalDimensions,
    setDisplayDimensions,
    isDragging,
    selectionStart,
    selectionEnd,
    displayDimensions,
    naturalDimensions,
    selectedWordIndices,
    copiedWord,
    offsetX,
    offsetY,
    scaleX,
    scaleY,
    handleWordClick,
    selectedText,
    setIsDragging,
    setSelectionStart,
    setSelectionEnd,
    setSelectedText,
    setSelectedWordIndices,
    setCopiedWord
}) => {
    const imageRef = useRef<HTMLImageElement>(null);

    // Effect to get natural dimensions once image loads
    useEffect(() => {
        const img = imageRef.current;
        if (img && img.complete) { // Check if image is already loaded (e.g., from cache)
            handleImageLoad();
        }
        
        function handleImageLoad() {
            if (img) {
                const { naturalWidth, naturalHeight } = img;
                if (naturalWidth > 0 && naturalHeight > 0) {
                    // console.log(`Natural image dimensions: ${naturalWidth}x${naturalHeight}`);
                    setNaturalDimensions({ width: naturalWidth, height: naturalHeight });
                } else {
                    // console.warn("Natural dimensions are zero, possibly image not loaded correctly.");
                    setNaturalDimensions(null); // Reset if dimensions are invalid
                }
            }
        }

        if (img) {
            img.addEventListener('load', handleImageLoad);
            return () => img.removeEventListener('load', handleImageLoad); // Cleanup
        } else {
             setNaturalDimensions(null); // Clear if no image ref
        }

    }, [imagePreviewUrl, setNaturalDimensions]); // Re-run if preview URL changes

    // Conditionally render based on props passed from the parent
    if (!imagePreviewUrl && !ocrResult) {
        return null;
    }

    // --- Original JSX and Logic Restored ---
    
    // --- Moved Logic from page.tsx --- 

    // --- Coordinate Transformation Logic --- 
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
    // Calculate params directly inside component if needed, or rely on passed props if calculated in parent
    // const { scaleX, scaleY, offsetX, offsetY } = calculateOverlayParams(); 
    // NOTE: We are using the offsetX, offsetY, scaleX, scaleY passed as props from the parent (page.tsx) 
    // as they are calculated there based on state also needed in the parent.
    // If these were *only* needed here, calculateOverlayParams could be called here.

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
        const container = imageContainerRef.current; // Use the ref passed as prop
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
        // const { scaleX, scaleY, offsetX, offsetY } = calculateOverlayParams(); // Calculate if needed here
        if (!naturalDimensions || !ocrResult) return;
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

    // --- End of Moved Logic ---

    return (
        <Card className="bg-white dark:bg-gray-800 shadow-lg rounded-lg overflow-hidden">
            <CardHeader>
                <CardTitle className="text-gray-900 dark:text-gray-100">Pratinjau & Hasil</CardTitle>
                <CardDescription>Teks yang diekstrak dari: {fileName || 'gambar yang diunggah'}</CardDescription>
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
                                // console.log(`Image natural dimensions: ${target.naturalWidth}x${target.naturalHeight}`);
                                if (target.naturalWidth > 0 && target.naturalHeight > 0) {
                                    setNaturalDimensions({ width: target.naturalWidth, height: target.naturalHeight });
                                }
                                // Use functional update for setDisplayDimensions on load
                                setDisplayDimensions(prevDims => {
                                    if (imageContainerRef.current) {
                                        const { offsetWidth, offsetHeight } = imageContainerRef.current;
                                        // console.log(`Image container dimensions on load: ${offsetWidth}x${offsetHeight}`);
                                        if (offsetWidth > 0 && offsetHeight > 0 && (!prevDims || prevDims.width !== offsetWidth || prevDims.height !== offsetHeight)) {
                                            return { width: offsetWidth, height: offsetHeight };
                                        }
                                    }
                                    return prevDims; // No change or ref not ready
                                });
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
                            // Reverted style calculations to use left, top, width, height
                            const style: React.CSSProperties = {
                                left: `${offsetX + word.left * scaleX}px`,
                                top: `${offsetY + word.top * scaleY}px`,
                                width: `${Math.max(2, word.width * scaleX)}px`,
                                height: `${Math.max(2, word.height * scaleY)}px`,
                                pointerEvents: isDragging ? 'none' : 'auto' 
                            };
                            // Reverted key to use left, top
                            const key = `${index}-${word.left}-${word.top}`;

                            return (
                                <div
                                    key={key}
                                    title={`Teks: ${word.text}\nConf: ${confidenceText}%`} // Indonesian
                                    className={`absolute border transition-all duration-100 cursor-pointer
                                    ${isSelected ? 'border-green-500 bg-green-500/30 ring-1 ring-green-600' : 'border-blue-600/70 hover:bg-blue-500/30'}
                                    ${isCopied ? 'bg-green-500/40 ring-2 ring-green-500' : isSelected ? '' : 'bg-transparent'}`}
                                    style={style}
                                    onClick={() => !isDragging && handleWordClick(word.text)}
                                />
                            );
                        })}
                    </div>
                )}

                {selectedText && (
                    <div className="mt-4 p-3 bg-gray-100 dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600">
                        <Label className="text-sm font-medium text-gray-600 dark:text-gray-300 block mb-1">Selected Text:</Label>
                        <p className="text-sm text-gray-800 dark:text-gray-200 mb-2 whitespace-pre-wrap break-words">{selectedText}</p>
                        <Button size="sm" variant="outline" onClick={() => handleWordClick(selectedText)} className="flex items-center gap-1">
                            <Copy className="w-3 h-3" /> Salin Pilihan
                        </Button>
                    </div>
                )}

                {ocrResult && ocrResult.full_text && !selectedText && (
                    <div>
                        <Label htmlFor="full-text-output" className="text-gray-700 dark:text-gray-300">Teks Lengkap Hasil Ekstraksi:</Label>
                        <Textarea
                            id="full-text-output"
                            readOnly
                            value={ocrResult.full_text}
                            className="mt-1 w-full h-32 bg-gray-50 dark:bg-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-600"
                            placeholder="Teks lengkap akan muncul di sini..."
                        />
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

export default ResultsDisplay; 