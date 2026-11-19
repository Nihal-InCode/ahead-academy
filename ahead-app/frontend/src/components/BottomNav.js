"use client";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();

  // Hide on login / transition screens, when not logged in, or for Guest users
  const isGuest = user?.role === "Guest" || String(user?.username || "").toLowerCase() === "guest";
  if (!user || pathname === "/login" || pathname === "/login-transition" || isGuest) {
    return null;
  }

  const tabs = [
    {
      id: "dashboard",
      path: "/",
      label: "Home",
      icon: (
        <img
          src="/home.png"
          alt="Home"
          className="h-5 w-5 object-contain"
        />
      ),
    },
    {
      id: "attendance",
      path: "/attendance",
      label: "Attendance",
      icon: (
        <img
          src="/attendance.png?v=2"
          alt="Attendance"
          className="h-5 w-5 object-contain"
        />
      ),
    },
    {
      id: "classes",
      path: "/classes",
      label: "Classes",
      icon: (
        <img
          src="/class.png?v=2"
          alt="Classes"
          className="h-5 w-5 object-contain"
        />
      ),
    },
    {
      id: "reports",
      path: "/reports",
      label: "Reports",
      icon: (
        <img
          src="/report.png"
          alt="Reports"
          className="h-5 w-5 object-contain"
        />
      ),
    },
  ];

  return (
    <nav
      className="anim-tab-bar fixed bottom-0 inset-x-0 z-50 rounded-t-3xl"
      style={{
        background: "linear-gradient(135deg, #0c3242 0%, #0a505c 100%)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderTop: "1px solid rgba(255,255,255,0.08)",
        boxShadow: "0 -4px 32px rgba(8,34,49,0.25)",
        paddingBottom: "env(safe-area-inset-bottom, 8px)",
        minHeight: "var(--bottom-nav-height, 80px)",
      }}
    >
      <div className="mx-auto flex max-w-md sm:max-w-xl md:max-w-2xl items-center justify-around px-2 pt-2 pb-1">
        {tabs.map(({ id, path, label, icon }) => {
          const selected = pathname === path;
          return (
            <button
              key={id}
              onClick={() => router.push(path)}
              className="flex flex-col items-center gap-1 px-3 py-1.5 rounded-2xl transition-all active:scale-90"
              style={{ color: selected ? "#ffffff" : "rgba(255,255,255,0.45)" }}
            >
              <div
                className={`transition-all duration-200 flex items-center justify-center h-5 w-5 ${
                  selected ? "scale-110 text-white opacity-100" : "scale-100 text-white/50 opacity-60"
                }`}
              >
                {icon}
              </div>
              <span className="text-[9px] font-black uppercase tracking-widest text-center">
                {label}
              </span>
              {selected && (
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: "#5eead4" }} />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
