"use client";

import React, { useState } from 'react';
import { Upload, FileText, Languages, Save, Loader2, Type } from "lucide-react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { OcrApiResponse } from '@/lib/types';

export type ImageType = 'default' | 'chat';

interface UploadCardProps {
    imagePreviewUrl: string | null;
    fileName: string;
    selectedLanguages: string[];
    handleLanguageChange: (language: string, checked: boolean | string) => void;
    saveResult: boolean;
    setSaveResult: (value: boolean) => void;
    imageType: ImageType;
    setImageType: (type: ImageType) => void;
    handleImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
    resetAll: () => void;
    extractTextFromImage: () => void;
    isLoading: boolean;
    ocrResult: OcrApiResponse | null;
    imageFile: File | null;
    onFileDrop: (file: File) => void;
}

const UploadCard: React.FC<UploadCardProps> = ({
    imagePreviewUrl,
    fileName,
    selectedLanguages,
    handleLanguageChange,
    saveResult,
    setSaveResult,
    imageType,
    setImageType,
    handleImageUpload,
    resetAll,
    extractTextFromImage,
    isLoading,
    ocrResult,
    imageFile,
    onFileDrop
}) => {
    const [isDraggingOver, setIsDraggingOver] = useState(false);

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
            if (e.dataTransfer.items[0].kind === 'file') {
                 setIsDraggingOver(true);
            }
        }
    };

    const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDraggingOver(false);
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDraggingOver(false);

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const file = e.dataTransfer.files[0];
            const validTypes = ["image/jpeg", "image/png", "image/jpg"];
            if (validTypes.includes(file.type)) {
                onFileDrop(file);
            } else {
                console.warn("Invalid file type dropped:", file.type);
            }
            e.dataTransfer.clearData();
        }
    };

    return (
        <Card className="bg-white dark:bg-gray-800 shadow-lg rounded-lg overflow-hidden">
            <CardHeader>
                <CardTitle>Unggah Gambar</CardTitle>
                <CardDescription>Pilih atau jatuhkan berkas gambar (JPG, PNG) di bawah ini.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Image Upload Area */}
                <div className="space-y-4">
                    <Label htmlFor="file-upload" className="text-gray-700 dark:text-gray-300">Image File</Label>
                    {!imagePreviewUrl ? (
                        <div
                            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex flex-col items-center justify-center h-48 ${
                                isDraggingOver
                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                                : 'border-gray-300 dark:border-gray-600'
                            }`}
                            onClick={() => document.getElementById("file-upload")?.click()}
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                        >
                            <Upload className="h-10 w-10 mx-auto mb-3 text-gray-400 dark:text-gray-500" />
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                {isDraggingOver ? "Jatuhkan gambar di sini" : "Seret & jatuhkan gambar di sini, atau klik untuk memilih berkas"}
                            </p>
                            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">PNG, JPG accepted</p>
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
                    <Label className="flex items-center gap-2 text-gray-700 dark:text-gray-300"><Languages className="w-4 h-4" /> Bahasa OCR</Label>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-2 sm:space-y-0 sm:space-x-4">
                        <div className="flex items-center">
                            <Checkbox id="lang-eng" checked={selectedLanguages.includes('eng')} onCheckedChange={(checked) => handleLanguageChange('eng', checked)} />
                            <Label htmlFor="lang-eng" className="ml-2 font-normal text-gray-600 dark:text-gray-400">English</Label>
                        </div>
                        <div className="flex items-center">
                            <Checkbox id="lang-ind" checked={selectedLanguages.includes('ind')} onCheckedChange={(checked) => handleLanguageChange('ind', checked)} />
                            <Label htmlFor="lang-ind" className="ml-2 font-normal text-gray-600 dark:text-gray-400">Indonesian</Label>
                        </div>
                    </div>
                    <div>
                        <Label className="flex items-center gap-2 text-gray-700 dark:text-gray-300 mb-2"><Type className="w-4 h-4" /> Tipe Konten Gambar</Label>
                        <RadioGroup
                            value={imageType}
                            onValueChange={(value) => setImageType(value as ImageType)}
                            className="flex flex-col space-y-1"
                         >
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="default" id="type-default" />
                                <Label htmlFor="type-default" className="font-normal text-gray-600 dark:text-gray-400">Dokumen / Poster (Default)</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="chat" id="type-chat" />
                                <Label htmlFor="type-chat" className="font-normal text-gray-600 dark:text-gray-400">Chat / Teks Rapi</Label>
                            </div>
                        </RadioGroup>
                    </div>
                    <div className="flex items-center space-x-2 pt-2">
                        <Checkbox id="save-result" checked={saveResult} onCheckedChange={(checked) => setSaveResult(Boolean(checked))} />
                        <Label htmlFor="save-result" className="flex items-center gap-1 font-normal text-gray-600 dark:text-gray-400">
                            <Save className="w-3 h-3" /> Simpan Hasil ke DB
                        </Label>
                    </div>
                </div>
            </CardContent>
            <CardFooter className="flex flex-col sm:flex-row justify-between gap-3 sm:gap-0 bg-gray-50 dark:bg-gray-700 p-4">
                <Button variant="outline" onClick={resetAll} disabled={isLoading || (!imagePreviewUrl && !ocrResult)} className="w-full sm:w-auto">
                    Clear
                </Button>
                <Button onClick={extractTextFromImage} disabled={isLoading || !imageFile || selectedLanguages.length === 0} className="flex items-center gap-2 w-full sm:w-auto">
                    {isLoading ? (
                        <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Processing...
                        </>
                    ) : (
                        <>
                            <FileText className="h-4 w-4" />
                            Extract Text
                        </>
                    )}
                </Button>
            </CardFooter>
        </Card>
    );
};

export default UploadCard; 