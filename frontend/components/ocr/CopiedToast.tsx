"use client";

import React from 'react';
// import { motion } from 'framer-motion'; // Removed framer-motion import
import { Copy, Save, CheckCircle } from "lucide-react";
// import type { TFunction } from 'i18next'; // Removed i18n type

interface CopiedToastProps {
    // Removed t prop
    // t: TFunction<"translation", undefined>;
    copiedWord: string | null;
    selectedText: string; // To differentiate between single word and selection copy
}

const CopiedToast: React.FC<CopiedToastProps> = ({ /* Removed t */ copiedWord, selectedText }) => {
    
    const getToastMessage = () => {
        if (!copiedWord) return null;
        if (copiedWord === selectedText && selectedText !== "") {
            return `Teks terpilih disalin!`; // Indonesian
        }
        return `Kata "${copiedWord}" disalin!`; // Indonesian
    };

    const message = getToastMessage();

    if (!message) {
        return null;
    }

    return (
        // Removed motion.div wrapper
        // <motion.div
        //     initial={{ opacity: 0, y: 10 }}
        //     animate={{ opacity: 1, y: 0 }}
        //     exit={{ opacity: 0, y: 10 }}
        //     transition={{ duration: 0.2 }}
        //     className="fixed bottom-5 right-5 bg-green-100 dark:bg-green-900 border border-green-400 dark:border-green-600 text-green-700 dark:text-green-300 px-4 py-2 rounded-md shadow-lg z-50 flex items-center gap-2"
        // >
        <div 
            className={`fixed bottom-5 right-5 bg-green-100 dark:bg-green-900 border border-green-300 dark:border-green-700 text-green-800 dark:text-green-200 px-4 py-2 rounded-md shadow-lg flex items-center space-x-2 transition-opacity duration-300 ${copiedWord ? 'opacity-100' : 'opacity-0'}`}
            role="alert"
        >
            <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
            <span>{message}</span>
        </div>
        // </motion.div>
    );
};

export default CopiedToast; 