"use client";
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

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      router.push(isGuest ? "/reports" : "/");
    }
  };

  return (
    <header
      className="anim-header sticky top-0 z-30 border-b border-white/10 px-3.5 sm:px-6 py-2.5 sm:py-3 backdrop-blur-xl shadow-md transition-all"
      style={{
        background: "linear-gradient(135deg, #071f2c 0%, #083742 50%, #064048 100%)",
        boxShadow: "0 4px 20px -2px rgba(8,34,49,0.25)",
      }}
    >
      <div className={`mx-auto flex ${maxWidth} items-center justify-between gap-3`}>
        {/* Left Section: Back button + Logo + Title / Subtitle */}
        <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
          {showBack && (
            <button
              onClick={handleBack}
              className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 text-white transition-all border border-white/15 shadow-xs"
              title="Go Back"
              aria-label="Go Back"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4.5 w-4.5 sm:h-5 sm:w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2.5}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>
          )}

          {/* Logo badge */}
          <div
            onClick={() => router.push(isGuest ? "/reports" : "/")}
            className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl bg-white/15 p-1 border border-white/20 backdrop-blur-sm shadow-xs cursor-pointer active:scale-95 transition-transform"
            title="Ahead Academy"
          >
            <img
              src="/logo.png"
              alt="Ahead Academy"
              className="h-full w-full object-contain"
            />
          </div>

          {/* Title & Context */}
          <div className="min-w-0 flex-1">
            <h1 className="text-base sm:text-lg font-bold tracking-tight text-white leading-tight truncate">
              {title}
            </h1>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-semibold text-teal-200/90 truncate max-w-[140px] sm:max-w-none">
                {subtitle || user?.name || "Teacher Portal"}
              </span>
              {user?.role && (
                <span className="hidden xs:inline-flex items-center rounded-full border border-teal-400/30 bg-teal-500/15 px-2 py-0.5 text-[10px] font-semibold tracking-normal text-teal-100">
                  {user.role}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right Section: Date Badge + Custom Action + Settings + Logout */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {date && (
            <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white/10 border border-white/15 shadow-xs backdrop-blur-md text-white">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-3.5 w-3.5 text-teal-300 shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              <span className="text-[11px] font-bold tracking-tight whitespace-nowrap text-teal-50">
                {date}
              </span>
            </div>
          )}

          {rightContent}

          {user?.role === "admin" && (
            <button
              onClick={() => router.push("/settings")}
              className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl text-teal-200 hover:text-white bg-white/10 hover:bg-white/20 border border-white/15 transition-all active:scale-95 shadow-xs"
              title="Admin Settings"
              aria-label="Admin Settings"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 sm:h-4.5 sm:w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          )}

          {showLogout && (
            <button
              onClick={logout}
              className="flex items-center gap-1.5 h-9 sm:h-10 px-2.5 sm:px-3 rounded-xl text-xs font-bold text-rose-200 hover:text-white bg-rose-500/15 hover:bg-rose-500/25 border border-rose-400/25 transition-all active:scale-95 shadow-xs"
              title="Logout"
              aria-label="Logout"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
              <span className="hidden sm:inline">Logout</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
