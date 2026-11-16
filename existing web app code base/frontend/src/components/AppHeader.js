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
      className="anim-header relative z-20 border-b border-white/10 px-4 py-4 sm:px-6 rounded-b-3xl"
      style={{
        background: "linear-gradient(135deg, #082231 0%, #063a43 100%)",
        boxShadow: "0 8px 24px rgba(8,34,49,0.18)",
      }}
    >
      <div className="mx-auto flex max-w-4xl items-center justify-between gap-3">
        {/* Left Section: Back button + Logo + Title */}
        <div className="flex min-w-0 items-center gap-3">
          {showBack && (
            <button
              onClick={handleBack}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white hover:bg-white/20 active:scale-95 transition-all border border-white/15"
              title="Go Back"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
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

          <div
            onClick={() => router.push(isGuest ? "/reports" : "/")}
            className="flex h-12 w-12 sm:h-14 sm:w-14 shrink-0 items-center justify-center rounded-2xl bg-white p-1.5 shadow-md shadow-black/25 ring-2 ring-white/20 overflow-hidden cursor-pointer active:scale-95 transition-transform"
          >
            <img
              src="/logo.png"
              alt="Ahead Academy"
              className="h-full w-full object-contain"
            />
          </div>

          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-black leading-tight tracking-tight text-white truncate">
              {title}
            </h1>
            <div className="mt-0.5 flex flex-wrap items-center gap-2">
              <p className="truncate text-[11px] font-bold text-teal-200/90 max-w-[130px] sm:max-w-none">
                {subtitle || user?.name || "Teacher"}
              </p>
              {user?.role && (
                <span className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-2.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-teal-100 backdrop-blur-sm">
                  {user.role}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right Section: Restyled Professional Calendar Date Box + Actions + Logout */}
        <div className="flex items-center gap-2 shrink-0">
          {date && (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white/[0.08] border border-white/15 shadow-xs backdrop-blur-md">
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
              <span className="text-[11px] font-extrabold tracking-tight text-white whitespace-nowrap">
                {date}
              </span>
            </div>
          )}

          {rightContent}

          {user?.role === "admin" && (
            <button
              onClick={() => router.push("/settings")}
              className="p-2 rounded-xl text-teal-200 hover:text-white bg-white/10 hover:bg-white/20 border border-white/15 transition-all active:scale-95"
              title="Admin Settings"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          )}

          {showLogout && (
            <button
              onClick={logout}
              className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-bold text-red-300 hover:text-white bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 transition-all active:scale-95"
              title="Logout"
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
