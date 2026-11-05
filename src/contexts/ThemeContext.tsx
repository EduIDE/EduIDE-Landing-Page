import React, { useEffect, useState } from 'react';

import { type Theme, ThemeContext } from './theme-context';

interface ThemeProviderProps {
    children: React.ReactNode;
}

// Browsers that block site data throw on any storage access, and the theme is not worth a blank page.
function readSavedTheme(): Theme | undefined {
    try {
        const saved = localStorage.getItem('theme');
        return saved === 'light' || saved === 'dark' ? saved : undefined;
    } catch {
        return undefined;
    }
}

function saveTheme(theme: Theme): void {
    try {
        localStorage.setItem('theme', theme);
    } catch {
        // The choice just lasts until the next reload.
    }
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
    const [theme, setTheme] = useState<Theme>(() => {
        // Check localStorage first, then system preference
        const savedTheme = readSavedTheme();
        if (savedTheme) {
            return savedTheme;
        }

        // Check system preference
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            return 'dark';
        }

        return 'light';
    });

    const toggleTheme = (): void => {
        setTheme(prevTheme => {
            const newTheme = prevTheme === 'light' ? 'dark' : 'light';
            saveTheme(newTheme);
            return newTheme;
        });
    };

    useEffect(() => {
        // Set data-theme attribute for CSS selectors - CSS handles the rest!
        const root = document.documentElement;
        root.setAttribute('data-theme', theme);
    }, [theme]);

    return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>;
};
