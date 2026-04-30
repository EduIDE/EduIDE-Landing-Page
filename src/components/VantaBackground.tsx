import { useEffect, useRef, useState } from 'react';

import { useTheme } from '../contexts/ThemeContext';

interface VantaBackgroundProps {
    children: React.ReactNode;
}

declare global {
    interface Window {
        THREE: any;
        VANTA: any;
    }
}

export const VantaBackground: React.FC<VantaBackgroundProps> = ({ children }) => {
    // eslint-disable-next-line no-null/no-null
    const vantaRef = useRef<HTMLDivElement>(null);
    const [vantaEffect, setVantaEffect] = useState<any>(undefined);
    const { theme } = useTheme();

    // Helper function to get CSS variable value and convert to hex
    const getCSSVariableAsHex = (variableName: string): number => {
        const value = getComputedStyle(document.documentElement).getPropertyValue(variableName).trim();

        // Convert #rrggbb to 0xrrggbb
        if (value.startsWith('#')) {
            return parseInt(value.slice(1), 16);
        }

        // Fallback to default values
        return 0x2a2a40;
    };

    // Initialize Vanta effect on mount and theme change
    useEffect(() => {
        // Cleanup existing effect if any
        if (vantaEffect) {
            vantaEffect.destroy();
            setVantaEffect(undefined);
        }

        const initializeVanta = (): void => {
            // Check if VANTA and THREE are loaded globally
            if (window.VANTA && window.THREE && vantaRef.current) {
                try {
                    // Get colors from CSS variables
                    const backgroundColor = getCSSVariableAsHex('--vanta-bg');
                    const color1 = getCSSVariableAsHex('--vanta-color1');
                    const color2 = getCSSVariableAsHex('--vanta-color2');

                    const effect = window.VANTA.BIRDS({
                        el: vantaRef.current,
                        mouseControls: false,
                        touchControls: false,
                        gyroControls: false,
                        minHeight: 200.0,
                        minWidth: 200.0,
                        scale: 1.0,
                        scaleMobile: 1.0,
                        backgroundColor: backgroundColor,
                        color1: color1,
                        color2: color2,
                        birdSize: 1.5,
                        wingSpan: 10.0,
                        speedLimit: 1.0,
                        separation: 40.0,
                        alignment: 35.0,
                        cohesion: 45.0,
                        quantity: 1.0
                    });

                    if (effect) {
                        setVantaEffect(effect);
                    }
                } catch (error) {
                    console.error('Failed to initialize Vanta effect:', error);
                    // Fallback: set background to match VantaJS backgroundColor
                    if (vantaRef.current) {
                        const fallbackBg = getComputedStyle(document.documentElement).getPropertyValue('--vanta-bg').trim() || '#2a2a40';
                        vantaRef.current.style.background = fallbackBg;
                    }
                }
            } else if (!window.VANTA || !window.THREE) {
                // Retry after a short delay if scripts aren't loaded yet
                setTimeout(initializeVanta, 500);
            }
        };

        // Add a small delay to ensure the scripts are loaded
        const timer = setTimeout(initializeVanta, 100);

        return () => {
            clearTimeout(timer);
            if (vantaEffect) {
                vantaEffect.destroy();
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [theme]);

    // Handle window resize
    useEffect(() => {
        const handleResize = (): void => {
            if (vantaEffect) {
                vantaEffect.resize();
            }
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [vantaEffect]);

    return (
        <div style={{ position: 'relative', width: '100%', flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div
                ref={vantaRef}
                style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    zIndex: -1,
                    background: 'var(--vanta-bg, #2a2a40)' // Fallback background matching VantaJS backgroundColor
                }}
            />
            {children}
        </div>
    );
};
