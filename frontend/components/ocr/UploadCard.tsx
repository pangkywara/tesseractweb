"use client";

import React from 'react';
import { Upload, FileText, Languages, Save, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import type { TFunction } from 'i18next';
import type { OcrApiResponse } from '@/lib/types'; // Import from shared types

interface UploadCardProps {
    t: TFunction<"translation", undefined>;
    imagePreviewUrl: string | null;
    fileName: string;
    selectedLanguages: string[];
    handleLanguageChange: (language: string, checked: boolean | string) => void;
    saveResult: boolean;
    setSaveResult: (value: boolean) => void;
    handleImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
    resetAll: () => void;
    extractTextFromImage: () => void;
    isLoading: boolean;
    ocrResult: OcrApiResponse | null;
    imageFile: File | null; // Needed to enable/disable extract button
}

const UploadCard: React.FC<UploadCardProps> = ({
    t,
    imagePreviewUrl,
    fileName,
    selectedLanguages,
    handleLanguageChange,
    saveResult,
    setSaveResult,
    handleImageUpload,
    resetAll,
    extractTextFromImage,
    isLoading,
    ocrResult,
    imageFile
}) => {
    return (
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
                    <Label className="flex items-center gap-2 text-gray-700 dark:text-gray-300"><Languages className="w-4 h-4" /> {t('ocrLangLabel')}</Label>
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
                            <Save className="w-3 h-3" /> {t('saveResultLabel')}
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
    );
};

export default UploadCard; 