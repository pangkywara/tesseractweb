"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { Copy, Save } from "lucide-react";
import type { TFunction } from 'i18next';

interface CopiedToastProps {
    t: TFunction<"translation", undefined>;
    copiedWord: string | null;
    selectedText: string; // To differentiate between single word and selection copy
}

const CopiedToast: React.FC<CopiedToastProps> = ({ t, copiedWord, selectedText }) => {
    if (!copiedWord) {
        return null;
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-5 right-5 bg-green-100 dark:bg-green-900 border border-green-400 dark:border-green-600 text-green-700 dark:text-green-300 px-4 py-2 rounded-md shadow-lg z-50 flex items-center gap-2"
        >
            {selectedText && copiedWord === selectedText ? <Copy className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {t('copiedToast', { text: copiedWord.length > 50 ? copiedWord.substring(0, 47) + '...' : copiedWord })}
        </motion.div>
    );
};

export default CopiedToast; 