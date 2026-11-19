"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import {
  getClasses,
  getSubjects,
  getStudents,
  getDailyReport,
  getBatchReport,
  getStudentHistory,
} from "@/lib/api";
import { useLoading } from "@/context/LoadingContext";
import * as XLSX from "xlsx";
import AppHeader from "@/components/AppHeader";
import PencilLoader from "@/components/PencilLoader";

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

const formatDisplayDate = (dateStr) => {
  if (!dateStr) return "";
  try {
    const [y, m, d] = dateStr.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "Asia/Kolkata",
    });
  } catch {
    return dateStr;
  }
};

export default function ReportsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { showLoader, hideLoader } = useLoading();

  // Active view: "daily" | "register" | "student"
  const [activeReportTab, setActiveReportTab] = useState("daily");

  // Common data
  const [classes, setClasses] = useState([]);
  const [allStudents, setAllStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // 1. Daily Report state
  const [selectedDailyDate, setSelectedDailyDate] = useState(getIstDateString());
  const [dailyData, setDailyData] = useState([]);
  const [loadingDaily, setLoadingDaily] = useState(false);

  // 2. Class Batch Register state
  const [selectedBatchClass, setSelectedBatchClass] = useState("");
  const [batchSubjects, setBatchSubjects] = useState([]);
  const [selectedBatchSubject, setSelectedBatchSubject] = useState("All");
  const [batchDateRange, setBatchDateRange] = useState({ from: "", to: "" });
  const [batchData, setBatchData] = useState(null);
  const [loadingBatch, setLoadingBatch] = useState(false);
  const [registerSearch, setRegisterSearch] = useState("");

  // 3. Student History Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [studentHistoryData, setStudentHistoryData] = useState(null);
  const [loadingStudent, setLoadingStudent] = useState(false);

  // Initial Load: classes & students list
  const loadInitialData = useCallback(async () => {
    setLoading(true);
    try {
      showLoader("Loading reports...");
      const [classesRes, studentsRes] = await Promise.all([
        getClasses(),
        getStudents(null, null, null, "1"),
      ]);
      const classList = Array.isArray(classesRes)
        ? classesRes.filter((c) => c.is_active !== false)
        : [];
      setClasses(classList);
      setAllStudents(Array.isArray(studentsRes) ? studentsRes : []);

      if (classList.length > 0) {
        setSelectedBatchClass(classList[0].name);
      }
    } catch (err) {
      setError("Failed to load report data.");
    } finally {
      setLoading(false);
      hideLoader();
    }
  }, [showLoader, hideLoader]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Load Daily Report
  const fetchDailyData = useCallback(async (date) => {
    if (!date) return;
    setLoadingDaily(true);
    setError("");
    try {
      const res = await getDailyReport(date);
      const data = Array.isArray(res) ? res : res?.data || [];
      setDailyData(data);
    } catch (err) {
      setError("Failed to fetch daily report.");
    } finally {
      setLoadingDaily(false);
    }
  }, []);

  useEffect(() => {
    if (activeReportTab === "daily") {
      fetchDailyData(selectedDailyDate);
    }
  }, [activeReportTab, selectedDailyDate, fetchDailyData]);

  // Fetch subjects whenever the selected class changes
  useEffect(() => {
    if (!selectedBatchClass) return;
    let isMounted = true;
    getSubjects(selectedBatchClass)
      .then((res) => {
        if (!isMounted) return;
        const list = Array.isArray(res) ? res : res?.data || [];
        setBatchSubjects(list);
      })
      .catch(() => {
        if (isMounted) setBatchSubjects([]);
      });
    return () => {
      isMounted = false;
    };
  }, [selectedBatchClass]);

  // Load Batch Report
  const fetchBatchData = useCallback(async () => {
    if (!selectedBatchClass) return;
    setLoadingBatch(true);
    setError("");
    try {
      const range = {};
      if (batchDateRange.from) range.from = batchDateRange.from;
      if (batchDateRange.to) range.to = batchDateRange.to;
      const res = await getBatchReport(
        selectedBatchClass,
        range,
        selectedBatchSubject
      );
      setBatchData(res?.data || res || null);
    } catch (err) {
      setError("Failed to load class register.");
    } finally {
      setLoadingBatch(false);
    }
  }, [selectedBatchClass, batchDateRange, selectedBatchSubject]);

  useEffect(() => {
    if (activeReportTab === "register" && selectedBatchClass) {
      fetchBatchData();
    }
  }, [activeReportTab, selectedBatchClass, selectedBatchSubject, fetchBatchData]);

  // Search & Load Student History
  const handleSelectStudent = async (student) => {
    setSelectedStudent(student);
    setSearchQuery(`${student.rollNo} - ${student.name}`);
    setLoadingStudent(true);
    setError("");
    try {
      const res = await getStudentHistory(student.rollNo);
      setStudentHistoryData(res?.data || res || null);
    } catch (err) {
      setError("Failed to load records for " + student.name);
    } finally {
      setLoadingStudent(false);
    }
  };

  // Export Batch Register to Excel
  const handleExportExcel = () => {
    if (!batchData || !batchData.students || batchData.students.length === 0) {
      alert("No attendance data available to export.");
      return;
    }

    const currentSubject =
      selectedBatchSubject === "All" ? "All Subjects" : selectedBatchSubject;
    const rows = batchData.students.map((s, index) => ({
      "SL No": index + 1,
      "Roll No": s.rollNo || "",
      "Student Name": s.name || "",
      Class: selectedBatchClass,
      Subject: currentSubject,
      "Total Marked Classes": s.total || 0,
      "Present Classes": s.attended || 0,
      "Absent Classes": s.absent || 0,
      "Attendance %": `${s.percent || 0}%`,
      Status:
        Number(s.total || 0) === 0
          ? "No Data"
          : Number(s.percent || 0) >= 75
          ? "Regular"
          : Number(s.percent || 0) >= 60
          ? "Warning"
          : "Shortage",
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    const sheetName = (
      selectedBatchSubject && selectedBatchSubject !== "All"
        ? `${selectedBatchClass}-${selectedBatchSubject}`
        : selectedBatchClass
    ).substring(0, 31);
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

    const colWidths = [
      { wch: 8 },
      { wch: 14 },
      { wch: 26 },
      { wch: 14 },
      { wch: 18 },
      { wch: 22 },
      { wch: 18 },
      { wch: 16 },
      { wch: 16 },
      { wch: 14 },
    ];
    worksheet["!cols"] = colWidths;

    const fileName = `Ahead_Academy_${selectedBatchClass.replace(
      /\s+/g,
      "_"
    )}_${currentSubject.replace(/\s+/g, "_")}_Attendance_Report.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  // Filtered Register Students for In-Table Search
  const filteredRegisterStudents = useMemo(() => {
    if (!batchData?.students) return [];
    if (!registerSearch.trim()) return batchData.students;
    const q = registerSearch.toLowerCase().trim();
    return batchData.students.filter(
      (s) =>
        (s.name || "").toLowerCase().includes(q) ||
        (s.rollNo || "").toLowerCase().includes(q)
    );
  }, [batchData?.students, registerSearch]);

  // Batch stats summary calculations
  const batchStatsSummary = useMemo(() => {
    if (!batchData?.students?.length) {
      return { regularCount: 0, regularPct: 0, held: 0 };
    }
    const regular = batchData.students.filter(
      (s) => Number(s.total) > 0 && Number(s.percent) >= 75
    ).length;
    const pct = Math.round((regular / batchData.students.length) * 100);
    const held = batchData.students[0]?.total || 0;
    return { regularCount: regular, regularPct: pct, held };
  }, [batchData]);

  // Compute Daily Aggregates
  const totalDailyStudents = allStudents.filter((s) => s.isActive).length;
  const totalDailyMarked = dailyData.reduce(
    (sum, d) => sum + (d.marked || 0),
    0
  );
  const totalDailyPresent = dailyData.reduce(
    (sum, d) => sum + (d.present || 0),
    0
  );
  const totalDailyAbsent = totalDailyMarked - totalDailyPresent;
  const overallDailyPct =
    totalDailyMarked > 0
      ? ((totalDailyPresent / totalDailyMarked) * 100).toFixed(1)
      : 0;

  // Filtered student search matches for Student tab
  const filteredSearchStudents = searchQuery.trim()
    ? allStudents
        .filter((s) => {
          const q = searchQuery.toLowerCase();
          return (
            (s.name || "").toLowerCase().includes(q) ||
            (s.rollNo || "").toLowerCase().includes(q)
          );
        })
        .slice(0, 5)
    : [];

  const isGuest =
    user?.role === "Guest" ||
    String(user?.username || "").toLowerCase() === "guest";

  if (loading && classes.length === 0) return <PencilLoader />;

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-16">
      {/* ── UNIFIED ENTERPRISE APP HEADER ── */}
      <AppHeader
        title="Reports"
        subtitle={
          isGuest
            ? user?.guest_name
              ? `Guest: ${user.guest_name}`
              : "Student Portal"
            : "Registers & Analytics"
        }
        showBack={!isGuest}
        onBack={() => router.push("/")}
        showLogout={true}
        date={formatDisplayDate(getIstDateString())}
        maxWidth="max-w-4xl sm:max-w-5xl"
      />

      {/* ── RESPONSIVE PAGE CONTAINER (ALIGNED WITH HEADER) ── */}
      <div className="w-full max-w-4xl sm:max-w-5xl mx-auto px-3.5 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">
        {error && (
          <div className="p-3.5 bg-rose-50 text-rose-700 rounded-2xl text-xs font-bold border border-rose-200 flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4 text-rose-500 shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span>{error}</span>
            </div>
            <button
              onClick={() => setError("")}
              className="p-1 text-rose-400 hover:text-rose-600 transition-colors"
            >
              ✕
            </button>
          </div>
        )}

        {/* ── PROFESSIONAL SEGMENTED NAVIGATION TABS ── */}
        <div className="bg-white rounded-2xl p-1.5 border border-slate-200/90 shadow-sm grid grid-cols-3 gap-1">
          {[
            {
              id: "daily",
              label: "Daily Overview",
              shortLabel: "Daily",
              icon: (
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
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
              ),
            },
            {
              id: "register",
              label: "Class Register",
              shortLabel: "Register",
              icon: (
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
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
                  />
                </svg>
              ),
            },
            {
              id: "student",
              label: "Student History",
              shortLabel: "Student",
              icon: (
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
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
              ),
            },
          ].map((tab) => {
            const active = activeReportTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveReportTab(tab.id)}
                className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-black transition-all text-center ${
                  active
                    ? "bg-slate-900 text-white shadow-sm"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/80"
                }`}
              >
                {tab.icon}
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="inline sm:hidden">{tab.shortLabel}</span>
              </button>
            );
          })}
        </div>

        {/* ─────────────────────────────────────────────────────────────
            1. DAILY OVERVIEW TAB
        ────────────────────────────────────────────────────────────── */}
        {activeReportTab === "daily" && (
          <div className="space-y-4 animate-in fade-in duration-200">
            {/* Date Bar */}
            <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-black text-slate-900">
                  Daily Attendance Summary
                </h2>
                <p className="text-xs text-slate-500 font-medium">
                  Inspect recorded metrics across all classes for a specific date
                </p>
              </div>
              <div className="flex items-center gap-2 self-start sm:self-auto">
                <label className="text-xs font-bold text-slate-600 shrink-0">
                  Date:
                </label>
                <input
                  type="date"
                  value={selectedDailyDate}
                  max={getIstDateString()}
                  onChange={(e) => setSelectedDailyDate(e.target.value)}
                  className="bg-slate-100 hover:bg-slate-100/80 border border-slate-300/80 rounded-xl px-3 py-1.5 text-xs font-black text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                />
              </div>
            </div>

            {/* Daily Metric Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-white border border-slate-200/90 rounded-2xl p-3.5 text-center shadow-xs">
                <p className="text-2xl font-black text-slate-900">
                  {totalDailyStudents}
                </p>
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mt-1">
                  Enrolled Students
                </p>
              </div>
              <div className="bg-emerald-50/80 border border-emerald-200/80 rounded-2xl p-3.5 text-center shadow-xs">
                <p className="text-2xl font-black text-emerald-700">
                  {totalDailyPresent}
                </p>
                <p className="text-[10px] font-black uppercase tracking-wider text-emerald-600 mt-1">
                  Total Present
                </p>
              </div>
              <div className="bg-rose-50/80 border border-rose-200/80 rounded-2xl p-3.5 text-center shadow-xs">
                <p className="text-2xl font-black text-rose-600">
                  {totalDailyAbsent}
                </p>
                <p className="text-[10px] font-black uppercase tracking-wider text-rose-500 mt-1">
                  Total Absent
                </p>
              </div>
              <div className="bg-blue-50/80 border border-blue-200/80 rounded-2xl p-3.5 text-center shadow-xs">
                <p className="text-2xl font-black text-blue-700">
                  {overallDailyPct}%
                </p>
                <p className="text-[10px] font-black uppercase tracking-wider text-blue-600 mt-1">
                  Attendance Rate
                </p>
              </div>
            </div>

            {/* Classes Daily Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {classes.map((cls) => {
                const entry = dailyData.find((d) => d.class === cls.name);
                const classStudents = allStudents.filter(
                  (s) => s.class === cls.name && s.isActive
                );
                const enrolledCount = classStudents.length;
                const marked = entry ? entry.marked : 0;
                const present = entry ? entry.present : 0;
                const absent = marked > present ? marked - present : 0;
                const pct =
                  enrolledCount > 0
                    ? Math.round((present / enrolledCount) * 100)
                    : 0;
                const isMarked = marked > 0;

                const pctColor = !isMarked
                  ? "bg-slate-100 text-slate-500 border-slate-200"
                  : pct >= 75
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : pct >= 60
                  ? "bg-amber-50 text-amber-700 border-amber-200"
                  : "bg-rose-50 text-rose-700 border-rose-200";

                return (
                  <div
                    key={cls.name}
                    className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs space-y-3 hover:border-slate-300 transition-colors"
                  >
                    {/* Top Row: Class Name, Enrolled count, and Attendance % */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-black text-slate-900 text-sm sm:text-base truncate">
                          {cls.name}
                        </span>
                        <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full shrink-0">
                          {enrolledCount} Enrolled
                        </span>
                      </div>

                      <span
                        className={`px-2.5 py-0.5 rounded-xl text-xs font-black border shrink-0 ${pctColor}`}
                      >
                        {isMarked ? `${pct}% Rate` : "Not Marked"}
                      </span>
                    </div>

                    {/* Middle Row: Metrics Breakdown */}
                    <div className="flex items-center justify-between text-xs font-bold pt-0.5">
                      <div className="flex items-center gap-2.5">
                        <span className="text-emerald-700 flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                          {present} Present
                        </span>
                        <span className="text-slate-300">•</span>
                        <span className="text-rose-600 flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                          {absent} Absent
                        </span>
                        {enrolledCount - marked > 0 && isMarked && (
                          <>
                            <span className="text-slate-300">•</span>
                            <span className="text-slate-400">
                              {enrolledCount - marked} Unmarked
                            </span>
                          </>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-400 font-semibold">
                        {marked}/{enrolledCount} Recorded
                      </span>
                    </div>

                    {/* Bottom Row: Visual Progress Fill Bar */}
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden flex">
                      {isMarked && (
                        <>
                          <div
                            style={{ width: `${pct}%` }}
                            className="bg-emerald-500 h-full transition-all duration-300"
                          />
                          {absent > 0 && (
                            <div
                              style={{
                                width: `${(absent / enrolledCount) * 100}%`,
                              }}
                              className="bg-rose-400 h-full transition-all duration-300"
                            />
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────
            2. CLASS BATCH REGISTER (WITH CLASS & SUBJECT FILTER & EXCEL)
        ────────────────────────────────────────────────────────────── */}
        {activeReportTab === "register" && (
          <div className="space-y-4 animate-in fade-in duration-200">
            {/* Filter & Action Card */}
            <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                <div>
                  <h2 className="text-sm font-black text-slate-900">
                    Attendance Register Filter
                  </h2>
                  <p className="text-xs text-slate-500 font-medium">
                    Filter by class, subject, and date range to inspect or export
                    student records
                  </p>
                </div>

                {/* Export Button */}
                <button
                  onClick={handleExportExcel}
                  disabled={!batchData?.students?.length}
                  className="px-4 py-2 rounded-xl font-bold text-xs text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shrink-0 shadow-sm shadow-emerald-200 self-start sm:self-auto"
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
                      d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  <span>Export to Excel</span>
                </button>
              </div>

              {/* Class, Subject, and Date Range Selectors */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* 1. Class Dropdown */}
                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                    1. Select Class
                  </label>
                  <select
                    value={selectedBatchClass}
                    onChange={(e) => {
                      setSelectedBatchClass(e.target.value);
                      setSelectedBatchSubject("All");
                    }}
                    className="w-full bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 text-xs font-black text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all cursor-pointer"
                  >
                    {classes.map((c) => (
                      <option key={c.name} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 2. Subject Dropdown */}
                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                    2. Select Subject
                  </label>
                  <select
                    value={selectedBatchSubject}
                    onChange={(e) => setSelectedBatchSubject(e.target.value)}
                    className="w-full bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 text-xs font-black text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all cursor-pointer"
                  >
                    <option value="All">All Subjects (Aggregate)</option>
                    {batchSubjects.map((s) => (
                      <option key={s.id || s.name} value={s.name || s.id}>
                        {s.name || s.id}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 3. From Date */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                      3. From Date
                    </label>
                    {batchDateRange.from && (
                      <button
                        type="button"
                        onClick={() =>
                          setBatchDateRange((p) => ({ ...p, from: "" }))
                        }
                        className="text-[9px] font-bold text-rose-500 hover:underline"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  <input
                    type="date"
                    value={batchDateRange.from}
                    onChange={(e) =>
                      setBatchDateRange((p) => ({ ...p, from: e.target.value }))
                    }
                    className="w-full bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/20 transition-all"
                  />
                </div>

                {/* 4. To Date */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                      4. To Date
                    </label>
                    {batchDateRange.to && (
                      <button
                        type="button"
                        onClick={() =>
                          setBatchDateRange((p) => ({ ...p, to: "" }))
                        }
                        className="text-[9px] font-bold text-rose-500 hover:underline"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  <input
                    type="date"
                    value={batchDateRange.to}
                    onChange={(e) =>
                      setBatchDateRange((p) => ({ ...p, to: e.target.value }))
                    }
                    className="w-full bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/20 transition-all"
                  />
                </div>
              </div>

              {/* Scope & Date Range Badge */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-black text-slate-800">Scope:</span>
                  <span className="font-bold text-teal-800 bg-teal-50 border border-teal-200/80 px-2.5 py-0.5 rounded-lg text-[11px]">
                    {selectedBatchClass}
                  </span>
                  <span className="font-bold text-blue-800 bg-blue-50 border border-blue-200/80 px-2.5 py-0.5 rounded-lg text-[11px]">
                    {selectedBatchSubject === "All"
                      ? "All Subjects"
                      : selectedBatchSubject}
                  </span>
                </div>

                {batchData?.from && batchData?.to && (
                  <div className="text-[11px] text-slate-500 font-semibold flex items-center gap-1.5">
                    <span>Recorded Span:</span>
                    <span className="font-black text-slate-700">
                      {formatDisplayDate(batchData.from)} –{" "}
                      {formatDisplayDate(batchData.to)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Batch Register Metric Summary Cards */}
            {batchData?.students?.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-white border border-slate-200/90 rounded-2xl p-3.5 text-center shadow-xs">
                  <p className="text-2xl font-black text-slate-900">
                    {batchData.students.length}
                  </p>
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mt-1">
                    Enrolled Students
                  </p>
                </div>
                <div className="bg-blue-50/80 border border-blue-200/80 rounded-2xl p-3.5 text-center shadow-xs">
                  <p className="text-2xl font-black text-blue-700">
                    {batchStatsSummary.held}
                  </p>
                  <p className="text-[10px] font-black uppercase tracking-wider text-blue-600 mt-1">
                    Marked Sessions
                  </p>
                </div>
                <div className="bg-emerald-50/80 border border-emerald-200/80 rounded-2xl p-3.5 text-center shadow-xs">
                  <p className="text-2xl font-black text-emerald-700">
                    {batchData.classAverage !== undefined
                      ? `${batchData.classAverage}%`
                      : "—"}
                  </p>
                  <p className="text-[10px] font-black uppercase tracking-wider text-emerald-600 mt-1">
                    Batch Average %
                  </p>
                </div>
                <div className="bg-teal-50/80 border border-teal-200/80 rounded-2xl p-3.5 text-center shadow-xs">
                  <p className="text-2xl font-black text-teal-800">
                    {batchStatsSummary.regularCount}
                    <span className="text-xs font-bold text-teal-600 ml-1">
                      ({batchStatsSummary.regularPct}%)
                    </span>
                  </p>
                  <p className="text-[10px] font-black uppercase tracking-wider text-teal-600 mt-1">
                    Regular (≥75%)
                  </p>
                </div>
              </div>
            )}

            {/* Students Attendance Register Table / Cards */}
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
              {/* Header Bar with Quick In-Table Search */}
              <div className="p-3.5 sm:p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="font-black text-slate-900 text-xs sm:text-sm uppercase tracking-wider">
                    {selectedBatchClass} •{" "}
                    {selectedBatchSubject === "All"
                      ? "All Subjects"
                      : selectedBatchSubject}{" "}
                    Register
                  </span>
                  <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                    {filteredRegisterStudents.length}{" "}
                    {filteredRegisterStudents.length === 1
                      ? "Student"
                      : "Students"}
                  </span>
                </div>

                {/* Instant Search in Register */}
                <div className="relative w-full sm:w-64">
                  <input
                    type="text"
                    placeholder="Search student or roll no..."
                    value={registerSearch}
                    onChange={(e) => setRegisterSearch(e.target.value)}
                    className="w-full bg-slate-100 hover:bg-slate-100/80 border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                  />
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                  {registerSearch && (
                    <button
                      onClick={() => setRegisterSearch("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {loadingBatch ? (
                <div className="p-12 text-center text-slate-400 text-xs font-bold flex flex-col items-center justify-center gap-2">
                  <div className="w-6 h-6 border-2 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
                  <span>Loading {selectedBatchClass} attendance register...</span>
                </div>
              ) : !filteredRegisterStudents.length ? (
                <div className="p-12 text-center text-slate-400 text-xs font-bold">
                  {registerSearch
                    ? `No students found matching "${registerSearch}"`
                    : "No students or attendance records found for this class & subject."}
                </div>
              ) : (
                <>
                  {/* DESKTOP / TABLET DATA TABLE */}
                  <div className="hidden sm:block overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50/80 text-[10px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-100">
                          <th className="py-3 px-4 w-12 text-center">#</th>
                          <th className="py-3 px-4 w-28">Roll No</th>
                          <th className="py-3 px-4">Student Name</th>
                          <th className="py-3 px-4 text-center w-36">
                            Marked Classes
                          </th>
                          <th className="py-3 px-4 w-40 text-center">
                            Attendance Rate
                          </th>
                          <th className="py-3 px-4 text-center w-28">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs">
                        {filteredRegisterStudents.map((student, idx) => {
                          const isMarked = Number(student.total || 0) > 0;
                          const pct = Number(student.percent || 0);

                          const pctColor = !isMarked
                            ? "text-slate-500 bg-slate-100 border-slate-200"
                            : pct >= 75
                            ? "text-emerald-700 bg-emerald-50 border-emerald-200"
                            : pct >= 60
                            ? "text-amber-700 bg-amber-50 border-amber-200"
                            : "text-rose-700 bg-rose-50 border-rose-200";

                          const statusBadge = !isMarked ? (
                            <span className="text-[10px] font-bold text-slate-400">
                              No Data
                            </span>
                          ) : pct >= 75 ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800">
                              Regular
                            </span>
                          ) : pct >= 60 ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-800">
                              Warning
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-100 text-rose-800">
                              Shortage
                            </span>
                          );

                          return (
                            <tr
                              key={student.rollNo}
                              className="hover:bg-slate-50/80 transition-colors"
                            >
                              <td className="py-3 px-4 text-center text-slate-400 font-mono text-[11px]">
                                {idx + 1}
                              </td>
                              <td className="py-3 px-4">
                                <span className="font-mono text-xs font-bold text-slate-800 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
                                  {student.rollNo}
                                </span>
                              </td>
                              <td className="py-3 px-4 font-black text-slate-900">
                                {student.name}
                              </td>
                              <td className="py-3 px-4 text-center font-bold">
                                <span className="text-emerald-700">
                                  {student.attended || 0}
                                </span>
                                <span className="text-slate-300 mx-1">/</span>
                                <span className="text-slate-500">
                                  {student.total || 0}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-center">
                                <div className="flex items-center justify-center gap-2">
                                  <div className="w-16 h-2 bg-slate-100 rounded-full overflow-hidden hidden md:block">
                                    <div
                                      style={{ width: `${pct}%` }}
                                      className={`h-full ${
                                        pct >= 75
                                          ? "bg-emerald-500"
                                          : pct >= 60
                                          ? "bg-amber-500"
                                          : "bg-rose-500"
                                      }`}
                                    />
                                  </div>
                                  <span
                                    className={`px-2 py-0.5 rounded-lg text-xs font-black border ${pctColor}`}
                                  >
                                    {isMarked ? `${pct}%` : "—"}
                                  </span>
                                </div>
                              </td>
                              <td className="py-3 px-4 text-center">
                                {statusBadge}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* MOBILE ADAPTIVE LIST */}
                  <div className="block sm:hidden divide-y divide-slate-100 max-h-[30rem] overflow-y-auto">
                    {filteredRegisterStudents.map((student) => {
                      const isMarked = Number(student.total || 0) > 0;
                      const pct = Number(student.percent || 0);
                      const pctColor = !isMarked
                        ? "text-slate-500 bg-slate-100 border-slate-200"
                        : pct >= 75
                        ? "text-emerald-700 bg-emerald-50 border-emerald-200"
                        : pct >= 60
                        ? "text-amber-700 bg-amber-50 border-amber-200"
                        : "text-rose-700 bg-rose-50 border-rose-200";

                      return (
                        <div
                          key={student.rollNo}
                          className="p-3.5 flex items-center justify-between gap-3 hover:bg-slate-50/80 transition-colors"
                        >
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <span className="font-mono text-xs font-bold text-slate-800 bg-slate-100 px-2 py-1 rounded-lg border border-slate-200 whitespace-nowrap shrink-0">
                              {student.rollNo}
                            </span>
                            <div className="min-w-0">
                              <p className="font-black text-slate-900 text-xs truncate">
                                {student.name}
                              </p>
                              <p className="text-[10px] text-slate-400 font-bold mt-0.5">
                                {student.attended || 0} of {student.total || 0}{" "}
                                classes
                              </p>
                            </div>
                          </div>

                          <div className="shrink-0 text-right">
                            <span
                              className={`px-2.5 py-1 rounded-lg text-xs font-black border ${pctColor}`}
                            >
                              {isMarked ? `${pct}%` : "—"}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────
            3. STUDENT LOOKUP & HISTORY
        ────────────────────────────────────────────────────────────── */}
        {activeReportTab === "student" && (
          <div className="space-y-4 animate-in fade-in duration-200">
            {/* Search Box */}
            <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-xs relative">
              <label className="text-xs font-black text-slate-900 block mb-1.5">
                Search Student Records
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Type student name or roll number (e.g. 12-001)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-100 hover:bg-slate-100/80 border border-slate-200 rounded-xl pl-9 pr-8 py-2.5 text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                />
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                {searchQuery && (
                  <button
                    onClick={() => {
                      setSearchQuery("");
                      setSelectedStudent(null);
                      setStudentHistoryData(null);
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Autocomplete matches */}
              {filteredSearchStudents.length > 0 && !selectedStudent && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-2xl shadow-xl z-30 divide-y divide-slate-100 overflow-hidden">
                  {filteredSearchStudents.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => handleSelectStudent(s)}
                      className="w-full text-left px-4 py-3 hover:bg-slate-50 flex items-center justify-between text-xs transition-colors"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="font-mono font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200">
                          {s.rollNo}
                        </span>
                        <span className="font-bold text-slate-900">
                          {s.name}
                        </span>
                      </div>
                      <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                        {s.class}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Student Attendance Stats & History Card */}
            {loadingStudent ? (
              <div className="bg-white rounded-2xl p-12 text-center text-slate-400 text-xs font-bold border border-slate-200/90 flex flex-col items-center justify-center gap-2">
                <div className="w-6 h-6 border-2 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
                <span>Loading student attendance records...</span>
              </div>
            ) : studentHistoryData ? (
              <div className="space-y-4">
                {/* Profile card */}
                <div
                  className="rounded-2xl p-5 text-white shadow-md relative overflow-hidden"
                  style={{
                    background:
                      "linear-gradient(135deg, #071f2c 0%, #083742 50%, #064048 100%)",
                  }}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <span className="inline-block px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-teal-400/20 text-teal-200 border border-teal-400/30 mb-1">
                        Student Record
                      </span>
                      <h3 className="text-lg sm:text-xl font-black truncate">
                        {studentHistoryData.name}
                      </h3>
                      <p className="text-teal-200/80 text-xs font-bold mt-0.5">
                        {studentHistoryData.rollNo} • {studentHistoryData.class}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-3xl sm:text-4xl font-black tracking-tight">
                        {studentHistoryData.stats?.percent ?? 0}%
                      </span>
                      <p className="text-[9px] font-black uppercase tracking-wider text-teal-300">
                        Attendance Rate
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2.5 mt-4 pt-4 border-t border-white/10 text-center">
                    <div className="bg-white/10 rounded-xl p-2.5 backdrop-blur-sm">
                      <p className="text-lg font-black">
                        {studentHistoryData.stats?.total || 0}
                      </p>
                      <p className="text-[9px] font-black uppercase text-teal-200">
                        Total Marked
                      </p>
                    </div>
                    <div className="bg-white/10 rounded-xl p-2.5 backdrop-blur-sm">
                      <p className="text-lg font-black text-emerald-300">
                        {studentHistoryData.stats?.attended || 0}
                      </p>
                      <p className="text-[9px] font-black uppercase text-teal-200">
                        Present
                      </p>
                    </div>
                    <div className="bg-white/10 rounded-xl p-2.5 backdrop-blur-sm">
                      <p className="text-lg font-black text-rose-300">
                        {(studentHistoryData.stats?.total || 0) -
                          (studentHistoryData.stats?.attended || 0)}
                      </p>
                      <p className="text-[9px] font-black uppercase text-teal-200">
                        Absent
                      </p>
                    </div>
                  </div>
                </div>

                {/* History Log */}
                <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                    <span className="font-black text-slate-900 text-xs uppercase tracking-wider">
                      Attendance History Log
                    </span>
                    <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                      {studentHistoryData.log
                        ? `${studentHistoryData.log.length} Records`
                        : "0 Records"}
                    </span>
                  </div>

                  {studentHistoryData.log?.length ? (
                    <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
                      {studentHistoryData.log.map((entry, idx) => {
                        const isPresent =
                          entry.status === "P" || entry.status === "present";
                        return (
                          <div
                            key={idx}
                            className="px-4 py-2.5 flex items-center justify-between text-xs hover:bg-slate-50/80 transition-colors"
                          >
                            <div className="flex items-center gap-2.5">
                              <span className="font-bold text-slate-800">
                                {formatDisplayDate(entry.date)}
                              </span>
                              {entry.subject && (
                                <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                                  {entry.subject}
                                </span>
                              )}
                            </div>
                            <span
                              className={`px-2.5 py-0.5 rounded-md font-black text-[10px] uppercase border ${
                                isPresent
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                  : "bg-rose-50 text-rose-700 border-rose-200"
                              }`}
                            >
                              {isPresent ? "Present" : "Absent"}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-8 text-center text-slate-400 text-xs font-bold">
                      No attendance records found for this student.
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-2xl p-12 text-center text-slate-400 text-xs font-bold border border-slate-200/90">
                Search and select a student above to inspect their attendance
                history.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
