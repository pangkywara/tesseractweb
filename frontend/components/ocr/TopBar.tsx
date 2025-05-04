"use client";

import React from 'react';
import { Button } from "@/components/ui/button";
import { History } from "lucide-react";
import Link from "next/link";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

interface TopBarProps {
    isMounted: boolean;
}

const TopBar: React.FC<TopBarProps> = ({ isMounted }) => {
    const { setTheme, theme } = useTheme();

    if (!isMounted) {
        // Render placeholder or null during server render/hydration mismatch prevention phase
        // Keep the height consistent to avoid layout shifts
        return <div className="h-9 mb-4"></div>;
    }

    return (
        <div className="w-full flex justify-between items-center p-2 bg-white dark:bg-gray-800 rounded-md shadow-sm mb-4">
            <div>
                {/* Link to History Page */}
                <Button variant="outline" size="sm" asChild>
                    <Link href="/history">
                        Riwayat
                    </Link>
                </Button>
            </div>
            
            <div className="flex items-center space-x-2">
                {/* Language Selector (Placeholder/Removed) */}
                {/* If you need language selection back, re-implement here */}

                {/* Theme Toggle */}
                <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setTheme(theme === "light" ? "dark" : "light")}
                    title={theme === 'light' ? 'Ubah ke Mode Gelap' : 'Ubah ke Mode Terang'}
                >
                    <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                    <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                    <span className="sr-only">Ubah Tema</span>
                </Button>
            </div>
        </div>
    );
};

export default TopBar; 