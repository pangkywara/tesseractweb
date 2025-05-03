"use client";

import React from 'react';
import { Button } from "@/components/ui/button";
import { History } from "lucide-react";
import Link from "next/link";
import type { TFunction } from 'i18next';
import type { i18n as i18nInstance } from 'i18next';

interface TopBarProps {
    isMounted: boolean;
    i18n: i18nInstance;
    t: TFunction<"translation", undefined>;
    changeLanguage: (lng: string) => void;
}

const TopBar: React.FC<TopBarProps> = ({ isMounted, i18n, t, changeLanguage }) => {
    if (!isMounted) {
        // Render placeholder or null during server render/hydration mismatch prevention phase
        // Keep the height consistent to avoid layout shifts
        return <div className="h-9 mb-4"></div>;
    }

    return (
        <div className="flex justify-end items-center space-x-2 mb-4 h-9">
            {/* Language Buttons */}
            <Button variant={i18n.language === 'en' ? "secondary" : "ghost"} size="sm" onClick={() => changeLanguage('en')}>EN</Button>
            <Button variant={i18n.language === 'id' ? "secondary" : "ghost"} size="sm" onClick={() => changeLanguage('id')}>ID</Button>

            {/* History Link Button */}
            <Button variant="outline" size="sm" asChild>
                <Link href="/history" className="flex items-center gap-1">
                    <History className="w-4 h-4" />
                    {t('viewHistoryButton')}
                </Link>
            </Button>
        </div>
    );
};

export default TopBar; 