"use client";

import { useState, useEffect } from "react";
import Image from "next/image";

export default function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [showIosModal, setShowIosModal] = useState(false);

  useEffect(() => {
    // 1. Check if already installed / running in standalone mode
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true;

    if (isStandalone) {
      return;
    }

    // 2. Check dismissal cooldown (7 days)
    const dismissedUntil = localStorage.getItem("ahead_pwa_dismissed_until");
    if (dismissedUntil && Date.now() < parseInt(dismissedUntil, 10)) {
      return;
    }

    // 3. Detect iOS device
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIos(isIosDevice);

    if (isIosDevice) {
      // Show prompt after a short delay for iOS Safari
      const timer = setTimeout(() => setShowPrompt(true), 3000);
      return () => clearTimeout(timer);
    }

    // 4. Capture Chromium beforeinstallprompt event
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowPrompt(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (isIos) {
      setShowIosModal(true);
      return;
    }

    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setShowPrompt(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    // Dismiss for 7 days
    const nextWeek = Date.now() + 7 * 24 * 60 * 60 * 1000;
    localStorage.setItem("ahead_pwa_dismissed_until", nextWeek.toString());
  };

  if (!showPrompt) return null;

  return (
    <>
      {/* Floating PWA Install Banner */}
      <div className="fixed bottom-20 left-4 right-4 z-50 mx-auto max-w-md animate-in fade-in slide-in-from-bottom-4 duration-300 sm:bottom-6">
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-teal-500/30 bg-[#082231]/95 p-3.5 shadow-2xl backdrop-blur-xl sm:p-4">
          <div className="flex items-center gap-3">
            <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-slate-800 shadow-md">
              <Image
                src="/icon-192.png"
                alt="Ahead Academy"
                fill
                sizes="44px"
                className="object-contain p-1"
              />
            </div>
            <div>
              <h4 className="text-xs font-black tracking-wide text-white sm:text-sm">
                Install Ahead Academy
              </h4>
              <p className="text-[10px] font-medium text-slate-300 sm:text-xs">
                {isIos ? "Add to home screen for instant access" : "Fast, full-screen app experience"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleInstallClick}
              className="rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 px-3.5 py-1.5 text-xs font-black tracking-wide text-white shadow-md shadow-teal-500/20 transition-all hover:scale-105 hover:from-teal-400 hover:to-emerald-400 active:scale-95 sm:px-4 sm:py-2"
            >
              Install
            </button>
            <button
              onClick={handleDismiss}
              aria-label="Dismiss install banner"
              className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-white"
            >
              ✕
            </button>
          </div>
        </div>
      </div>

      {/* iOS Safari Installation Guide Modal */}
      {showIosModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 backdrop-blur-sm sm:items-center">
          <div className="w-full max-w-sm animate-in fade-in zoom-in-95 rounded-3xl border border-white/10 bg-[#082231] p-5 text-white shadow-2xl">
            <div className="flex items-center justify-between pb-3">
              <h3 className="text-sm font-black tracking-wide text-white">
                Add Ahead Academy to Home Screen
              </h3>
              <button
                onClick={() => setShowIosModal(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <p className="text-xs leading-relaxed text-slate-300">
              Install Ahead Academy on your iPhone or iPad for a full-screen, native app experience:
            </p>

            <div className="my-4 space-y-3 rounded-2xl bg-white/5 p-3.5 text-xs">
              <div className="flex items-center gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-teal-500/20 text-xs font-bold text-teal-400">
                  1
                </span>
                <span>
                  Tap the <strong className="text-teal-400">Share</strong> button in Safari's bottom toolbar.
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-teal-500/20 text-xs font-bold text-teal-400">
                  2
                </span>
                <span>
                  Scroll down and tap <strong className="text-teal-400">Add to Home Screen</strong>.
                </span>
              </div>
            </div>

            <button
              onClick={() => {
                setShowIosModal(false);
                setShowPrompt(false);
              }}
              className="w-full rounded-xl bg-teal-500 py-2.5 text-center text-xs font-bold text-white shadow-md hover:bg-teal-400"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
}
