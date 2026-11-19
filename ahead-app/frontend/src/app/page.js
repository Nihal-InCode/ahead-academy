"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import {
  getClasses,
  getStudents,
  getDailyReport,
} from "@/lib/api";
import { useLoading } from "@/context/LoadingContext";
import PencilLoader from "@/components/PencilLoader";
import AppHeader from "@/components/AppHeader";

const getIstDateString = () => {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(new Date());
  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;
  return `${year}-${month}-${day}`;
};

const formatDate = (dateStr) => {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
    });
  } catch (e) {
    return dateStr;
  }
};

export default function DashboardPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { showLoader, hideLoader } = useLoading();

  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [dailyReport, setDailyReport] = useState([]);
  const [today, setToday] = useState(getIstDateString());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    try {
      showLoader("Loading dashboard...");
      const [classesRes, studentsRes, reportRes] = await Promise.all([
        getClasses(),
        getStudents(),
        getDailyReport(today),
      ]);

      const rawClasses = Array.isArray(classesRes) ? classesRes : (classesRes?.data || []);
      const rawStudents = Array.isArray(studentsRes) ? studentsRes : (studentsRes?.data || []);
      const rawReport = Array.isArray(reportRes) ? reportRes : (reportRes?.data || []);

      const activeClasses = rawClasses.filter((c) => c.is_active !== false);
      const classNames = activeClasses.map((c) => c.name);
      const activeStudents = classNames.length > 0
        ? rawStudents.filter((s) => classNames.includes(s.class))
        : rawStudents;

      setClasses(rawClasses);
      setStudents(activeStudents);
      setDailyReport(rawReport);
    } catch (err) {
      setError("Failed to load dashboard. Please try again.");
      console.error(err);
    } finally {
      setLoading(false);
      hideLoader();
    }
  }, [today, showLoader, hideLoader]);

  useEffect(() => {
    if (user && (user.role === "Guest" || String(user.username || "").toLowerCase() === "guest")) {
      router.replace("/reports");
    }
  }, [user, router]);

  useEffect(() => {
    fetchDashboard();

    const handleRefresh = () => {
      fetchDashboard();
    };

    window.addEventListener("focus", handleRefresh);
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        fetchDashboard();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.removeEventListener("focus", handleRefresh);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [fetchDashboard]);

  if (loading) return <PencilLoader />;

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 text-center max-w-sm mx-auto">
          <h2 className="font-black text-gray-900 text-base mb-1">Unable to load dashboard</h2>
          <p className="text-xs text-gray-500 mb-4">{error}</p>
          <button
            onClick={() => { setError(""); fetchDashboard(); }}
            className="w-full py-2.5 rounded-xl font-bold text-xs text-white bg-blue-600 hover:bg-blue-700 transition-all"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Compute live stats
  const todayPresent = dailyReport.reduce((sum, entry) => sum + (entry.present || 0), 0);
  const todayMarked = dailyReport.reduce((sum, entry) => sum + (entry.marked || 0), 0);
  const todayAbsent = Math.max(0, todayMarked - todayPresent);

  const todayOnline = dailyReport.reduce((sum, entry) => sum + (entry.online || 0), 0);
  const todayOffline = dailyReport.reduce((sum, entry) => sum + (entry.offline || 0), 0);

  const enrolledOnline = students.filter((s) => (s.learningMode || s.learning_mode) === "Online").length;
  const enrolledOffline = students.filter((s) => (s.learningMode || s.learning_mode) === "Offline").length;

  const displayOnline = todayMarked > 0 ? todayOnline : enrolledOnline;
  const displayOffline = todayMarked > 0 ? todayOffline : enrolledOffline;

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-16">
      {/* ── UNIFIED APP HEADER ── */}
      <AppHeader
        title="AHEAD"
        subtitle={user?.name || "Teacher Portal"}
        date={formatDate(today)}
        showLogout={true}
        maxWidth="max-w-2xl sm:max-w-3xl"
      />

      <div className="w-full max-w-2xl sm:max-w-3xl mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">
        {/* ── 2x2 STATS GRID ── */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <StatCard
            label="Present Today"
            value={todayPresent}
            cfg={{ text: "text-emerald-700", bg: "bg-emerald-50/90", border: "border-emerald-200/80" }}
          />
          <StatCard
            label="Absent Today"
            value={todayAbsent}
            cfg={{ text: "text-rose-600", bg: "bg-rose-50/90", border: "border-rose-200/80" }}
          />
          <StatCard
            label="Online Mode"
            value={displayOnline}
            cfg={{ text: "text-blue-700", bg: "bg-blue-50/90", border: "border-blue-200/80" }}
          />
          <StatCard
            label="Offline Mode"
            value={displayOffline}
            cfg={{ text: "text-teal-700", bg: "bg-teal-50/90", border: "border-teal-200/80" }}
          />
        </div>

        {/* ── HERO ACTION CARD: MARK ATTENDANCE ── */}
        <button
          onClick={() => router.push("/attendance")}
          className="w-full relative overflow-hidden rounded-3xl p-5 text-left text-white shadow-lg transition-all active:scale-[0.98] group"
          style={{
            background: "linear-gradient(135deg, #0e5066 0%, #082231 100%)",
            boxShadow: "0 10px 25px -5px rgba(8, 34, 49, 0.35)",
          }}
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-teal-400/10 rounded-full blur-2xl -mr-8 -mt-8 pointer-events-none" />
          <div className="flex items-center justify-between relative z-10">
            <div className="space-y-0.5">
              <h2 className="text-xl font-black tracking-tight text-white">
                Mark Attendance
              </h2>
              <p className="text-xs text-teal-100/80 font-medium">
                Tap to record today&apos;s student attendance
              </p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-sm border border-white/20 flex items-center justify-center text-xl shrink-0 group-hover:scale-105 transition-transform">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </div>
          </div>
        </button>
      </div>
    </div>
  );
}

function StatCard({ label, value, cfg }) {
  return (
    <div className={`${cfg.bg} ${cfg.border} border rounded-2xl p-3.5 shadow-sm`}>
      <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-0.5">
        {label}
      </p>
      <p className={`text-2xl font-black ${cfg.text}`}>{value}</p>
    </div>
  );
}
