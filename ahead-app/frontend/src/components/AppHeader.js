"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export default function AppHeader({
  title = "AHEAD",
  subtitle,
  showBack = false,
  onBack,
  date,
  rightContent,
  showLogout = false,
  maxWidth = "max-w-5xl",
}) {
  const router = useRouter();
  const { user, logout } = useAuth();
  const isGuest = user?.role === "Guest" || String(user?.username || "").toLowerCase() === "guest";
  const showSettings = user?.role === "admin";
  const showMenu = showSettings || showLogout;
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const closeOnOutsidePress = (event) => {
      if (!menuRef.current?.contains(event.target)) setMenuOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsidePress);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePress);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [menuOpen]);

  const handleBack = () => {
    if (onBack) onBack();
    else router.push(isGuest ? "/reports" : "/");
  };

  return (
    <header
      className="anim-header sticky top-0 z-30 border-b border-white/10 px-3.5 py-2.5 shadow-md backdrop-blur-xl transition-all sm:px-6 sm:py-3"
      style={{
        background: "linear-gradient(135deg, #071f2c 0%, #083742 50%, #064048 100%)",
        boxShadow: "0 4px 20px -2px rgba(8,34,49,0.25)",
      }}
    >
      <div className={`mx-auto flex ${maxWidth} items-center justify-between gap-3`}>
        <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
          {showBack && (
            <button
              type="button"
              onClick={handleBack}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/10 text-white shadow-xs transition-all hover:bg-white/20 active:scale-95 sm:h-10 sm:w-10"
              title="Go Back"
              aria-label="Go Back"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4.5 w-4.5 sm:h-5 sm:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}

          <button
            type="button"
            onClick={() => router.push(isGuest ? "/reports" : "/")}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/20 bg-white/15 p-1 shadow-xs backdrop-blur-sm transition-transform active:scale-95 sm:h-10 sm:w-10"
            title="Ahead Academy"
          >
            <img src="/logo.png" alt="Ahead Academy" className="h-full w-full object-contain" />
          </button>

          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-bold leading-tight tracking-tight text-white sm:text-lg">{title}</h1>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="max-w-[140px] truncate text-[11px] font-semibold text-teal-200/90 sm:max-w-none">
                {subtitle || user?.name || "Teacher Portal"}
              </span>
              {user?.role && (
                <span className="hidden items-center rounded-full border border-teal-400/30 bg-teal-500/15 px-2 py-0.5 text-[10px] font-semibold tracking-normal text-teal-100 xs:inline-flex">
                  {user.role}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          {date && (
            <div className="hidden items-center gap-1.5 rounded-xl border border-white/15 bg-white/10 px-2.5 py-1.5 text-white shadow-xs backdrop-blur-md md:flex">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 shrink-0 text-teal-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="whitespace-nowrap text-[11px] font-bold tracking-tight text-teal-50">{date}</span>
            </div>
          )}
          {rightContent}

          {showMenu && (
            <div ref={menuRef} className="relative shrink-0">
              <button
                type="button"
                aria-label={menuOpen ? "Close menu" : "Open menu"}
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((open) => !open)}
                className="hamburger relative z-[60] flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/10 text-white/70 transition-all hover:bg-white/15 hover:text-white sm:h-12 sm:w-12"
                title="Menu"
              >
                <svg viewBox="0 0 32 32" aria-hidden="true">
                  <path className="line line-top-bottom" d="M27 10H13C10.8 10 9 8.2 9 6S10.8 2 13 2H20" />
                  <path className="line" d="M7 16H27" />
                  <path className="line line-top-bottom" d="M27 22H13C10.8 22 9 23.8 9 26S10.8 30 13 30H20" />
                </svg>
              </button>

              <div
                className={`fixed inset-0 z-[59] transition-opacity duration-200 ${menuOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"}`}
                onClick={() => setMenuOpen(false)}
                aria-hidden="true"
              />
              <div className={`bubble-menu absolute right-0 top-11 z-[60] w-56 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-xl shadow-gray-200/40 sm:top-12 ${menuOpen ? "bubble-menu-open" : "bubble-menu-closed"}`}>
                {showSettings && (
                  <button
                    type="button"
                    onClick={() => { router.push("/settings"); setMenuOpen(false); }}
                    className="flex w-full items-center gap-3 px-4 py-3 text-sm font-bold text-gray-700 transition-all hover:bg-gray-50"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-[18px] w-[18px] text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426-1.756-2.924-1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-1.543 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Settings
                  </button>
                )}
                {showSettings && showLogout && <div className="border-t border-gray-100" />}
                {showLogout && (
                  <button
                    type="button"
                    onClick={() => { setMenuOpen(false); logout(); }}
                    className="flex w-full items-center gap-3 px-4 py-3 text-sm font-bold text-red-600 transition-all hover:bg-red-50"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Log out
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
