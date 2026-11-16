"use client";
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { playSound } from '@/lib/sound';
import PencilLoader from '@/components/PencilLoader';

const LoadingContext = createContext();

export function LoadingProvider({ children }) {
    const [loading, setLoading] = useState(false);
    const [fading, setFading] = useState(false); // New state for fading
    const [loadingText, setLoadingText] = useState("Loading...");

    // Refs (not state) so showLoader/hideLoader keep stable identities —
    // otherwise every call re-creates hideLoader and can cause render loops
    // in components that depend on these functions in useEffect.
    const startTimeRef = useRef(null);
    const optionsRef = useRef({});

    const showLoader = useCallback((text = "Loading...", opts = {}) => {
        setFading(false); // Ensure fading is false when showing
        setLoadingText(text);
        optionsRef.current = opts;
        setLoading(true);
        startTimeRef.current = Date.now();
    }, []);

    const hideLoader = useCallback(() => {
        const MIN_TIME = 500; // Requirement: Minimum Display Time
        const FADE_OUT_DELAY = 300; // Delay for fade-out animation
        const elapsed = Date.now() - (startTimeRef.current || Date.now());
        const remaining = Math.max(0, MIN_TIME - elapsed);
        const options = optionsRef.current;

        setTimeout(() => {
            setFading(true); // Start fading out
            setTimeout(() => {
                setLoading(false);
                setFading(false); // Reset fading state after animation

                // Play success sound/vibration if requested in options
                if (options.playSuccessSound) {
                    playSound('attendanceSuccess'); // Default success sound
                }
                if (options.vibrate && typeof navigator !== 'undefined' && navigator.vibrate) {
                    navigator.vibrate(100);
                }
            }, FADE_OUT_DELAY); // Wait for fade-out animation to complete
        }, remaining);
    }, []);

    return (
        <LoadingContext.Provider value={{ showLoader, hideLoader }}>
            {children}
            {loading && (
                <PencilLoader
                    text={loadingText}
                    isFadingOut={fading}
                />
            )}
        </LoadingContext.Provider>
    );
}

export const useLoading = () => useContext(LoadingContext);
