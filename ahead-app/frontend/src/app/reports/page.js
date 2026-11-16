"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import {
  getClasses,
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
  const [batchDateRange, setBatchDateRange] = useState({ from: "", to: "" });
  const [batchData, setBatchData] = useState(null);
  const [loadingBatch, setLoadingBatch] = useState(false);

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
      const classList = Array.isArray(classesRes) ? classesRes.filter((c) => c.is_active !== false) : [];
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
      const data = Array.isArray(res) ? res : (res?.data || []);
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

  // Load Batch Report
  const fetchBatchData = useCallback(async () => {
    if (!selectedBatchClass) return;
    setLoadingBatch(true);
    setError("");
    try {
      const range = {};
      if (batchDateRange.from) range.from = batchDateRange.from;
      if (batchDateRange.to) range.to = batchDateRange.to;
      const res = await getBatchReport(selectedBatchClass, range);
      setBatchData(res?.data || res || null);
    } catch (err) {
      setError("Failed to load class register.");
    } finally {
      setLoadingBatch(false);
    }
  }, [selectedBatchClass, batchDateRange]);

  useEffect(() => {
    if (activeReportTab === "register" && selectedBatchClass) {
      fetchBatchData();
    }
  }, [activeReportTab, selectedBatchClass, fetchBatchData]);

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

    const rows = batchData.students.map((s, index) => ({
      "SL No": index + 1,
      "Roll No": s.rollNo || "",
      "Student Name": s.name || "",
      "Class": selectedBatchClass,
      "Total Marked Classes": s.total || 0,
      "Present Classes": s.attended || 0,
      "Absent Classes": s.absent || 0,
      "Attendance %": `${s.percent || 0}%`,
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, selectedBatchClass);

    const colWidths = [
      { wch: 8 },
      { wch: 14 },
      { wch: 26 },
      { wch: 14 },
      { wch: 22 },
      { wch: 18 },
      { wch: 16 },
      { wch: 16 },
    ];
    worksheet["!cols"] = colWidths;

    const fileName = `Ahead_Academy_${selectedBatchClass.replace(/\s+/g, "_")}_Attendance_Report.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  // Compute Daily Aggregates
  const totalDailyStudents = allStudents.filter((s) => s.isActive).length;
  const totalDailyMarked = dailyData.reduce((sum, d) => sum + (d.marked || 0), 0);
  const totalDailyPresent = dailyData.reduce((sum, d) => sum + (d.present || 0), 0);
  const totalDailyAbsent = totalDailyMarked - totalDailyPresent;
  const overallDailyPct = totalDailyMarked > 0 ? ((totalDailyPresent / totalDailyMarked) * 100).toFixed(1) : 0;

  // Filtered student search matches
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

  const isGuest = user?.role === "Guest" || String(user?.username || "").toLowerCase() === "guest";

  if (loading && classes.length === 0) return <PencilLoader />;

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-28">
      {/* ── UNIFIED APP HEADER ── */}
      <AppHeader
        title="Reports"
        subtitle={isGuest ? (user?.guest_name ? `Guest: ${user.guest_name}` : "Student Portal") : "Registers & Analytics"}
        showBack={!isGuest}
        onBack={() => router.push("/")}
        showLogout={true}
        date={formatDisplayDate(getIstDateString())}
      />

      <main className="max-w-md mx-auto px-3.5 py-3.5 space-y-3.5">
        {error && (
          <div className="p-3 bg-rose-50 text-rose-700 rounded-2xl text-xs font-bold border border-rose-200 flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError("")} className="p-1 text-rose-400">✕</button>
          </div>
        )}

        {/* ── MOBILE-FRIENDLY SEGMENTED TAB SWITCHER ── */}
        <div className="bg-white rounded-2xl p-1 border border-slate-200/80 shadow-xs grid grid-cols-3 gap-1">
          {[
            { id: "daily", label: "Daily" },
            { id: "register", label: "Register" },
            { id: "student", label: "Student" },
          ].map((tab) => {
            const active = activeReportTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveReportTab(tab.id)}
                className={`py-2 rounded-xl text-xs font-black transition-all text-center ${
                  active
                    ? "bg-blue-600 text-white shadow-xs"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* ─────────────────────────────────────────────────────────────
            1. DAILY OVERVIEW TAB
        ────────────────────────────────────────────────────────────── */}
        {activeReportTab === "daily" && (
          <div className="space-y-3 animate-in fade-in">
            {/* Date Bar */}
            <div className="bg-white rounded-2xl p-3 border border-slate-200/80 shadow-xs flex items-center justify-between gap-2">
              <span className="text-xs font-black text-slate-800">
                Attendance Date
              </span>
              <input
                type="date"
                value={selectedDailyDate}
                max={getIstDateString()}
                onChange={(e) => setSelectedDailyDate(e.target.value)}
                className="bg-slate-100 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:outline-none"
              />
            </div>

            {/* Daily Metric Cards */}
            <div className="grid grid-cols-4 gap-2">
              <div className="bg-white border border-slate-200/80 rounded-2xl p-2.5 text-center shadow-xs">
                <p className="text-lg font-black text-slate-900">{totalDailyStudents}</p>
                <p className="text-[8px] font-black uppercase text-slate-400 mt-0.5">Enrolled</p>
              </div>
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-2.5 text-center shadow-xs">
                <p className="text-lg font-black text-emerald-700">{totalDailyPresent}</p>
                <p className="text-[8px] font-black uppercase text-emerald-600 mt-0.5">Present</p>
              </div>
              <div className="bg-rose-50 border border-rose-200 rounded-2xl p-2.5 text-center shadow-xs">
                <p className="text-lg font-black text-rose-600">{totalDailyAbsent}</p>
                <p className="text-[8px] font-black uppercase text-rose-500 mt-0.5">Absent</p>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-2.5 text-center shadow-xs">
                <p className="text-lg font-black text-blue-700">{overallDailyPct}%</p>
                <p className="text-[8px] font-black uppercase text-blue-600 mt-0.5">Rate</p>
              </div>
            </div>

            {/* Classes Daily Cards */}
            <div className="space-y-2.5">
              {classes.map((cls) => {
                const entry = dailyData.find((d) => d.class === cls.name);
                const classStudents = allStudents.filter((s) => s.class === cls.name && s.isActive);
                const enrolledCount = classStudents.length;
                const marked = entry ? entry.marked : 0;
                const present = entry ? entry.present : 0;
                const absent = marked > present ? marked - present : 0;
                const pct = enrolledCount > 0 ? Math.round((present / enrolledCount) * 100) : 0;
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
                    className="bg-white rounded-2xl border border-slate-200/80 p-3.5 shadow-xs space-y-2.5"
                  >
                    {/* Top Row: Class Name, Enrolled count, and Attendance % */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-black text-slate-900 text-sm sm:text-base truncate">
                          {cls.name}
                        </span>
                        <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full shrink-0">
                          {enrolledCount} Students
                        </span>
                      </div>

                      <span className={`px-2.5 py-0.5 rounded-xl text-xs font-black border shrink-0 ${pctColor}`}>
                        {isMarked ? `${pct}%` : "Not Marked"}
                      </span>
                    </div>

                    {/* Middle Row: Metrics Breakdown */}
                    <div className="flex items-center justify-between text-xs font-bold pt-0.5">
                      <div className="flex items-center gap-3">
                        <span className="text-emerald-700">
                          {present} Present
                        </span>
                        <span className="text-slate-300">•</span>
                        <span className="text-rose-600">
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
                      <span className="text-[10px] text-slate-400 font-semibold">
                        {marked}/{enrolledCount} Recorded
                      </span>
                    </div>

                    {/* Bottom Row: Visual Progress Fill Bar */}
                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden flex">
                      {isMarked && (
                        <>
                          <div
                            style={{ width: `${pct}%` }}
                            className="bg-emerald-500 h-full transition-all duration-300"
                          />
                          {absent > 0 && (
                            <div
                              style={{ width: `${(absent / enrolledCount) * 100}%` }}
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
            2. CLASS BATCH REGISTER (EXCEL EXPORT)
        ────────────────────────────────────────────────────────────── */}
        {activeReportTab === "register" && (
          <div className="space-y-3 animate-in fade-in">
            {/* Class & Date Controls */}
            <div className="bg-white rounded-2xl p-3 border border-slate-200/80 shadow-xs space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <select
                  value={selectedBatchClass}
                  onChange={(e) => setSelectedBatchClass(e.target.value)}
                  className="flex-1 bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 text-xs font-black text-slate-800 focus:outline-none"
                >
                  {classes.map((c) => (
                    <option key={c.name} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>

                <button
                  onClick={handleExportExcel}
                  disabled={!batchData?.students?.length}
                  className="px-3.5 py-2 rounded-xl font-bold text-xs text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 transition-all flex items-center gap-1.5 shrink-0 shadow-sm shadow-emerald-200"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span>Excel</span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[9px] font-black uppercase text-slate-400 block mb-0.5">From</label>
                  <input
                    type="date"
                    value={batchDateRange.from}
                    onChange={(e) => setBatchDateRange((p) => ({ ...p, from: e.target.value }))}
                    className="w-full bg-slate-100 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-800"
                  />
                </div>
                <div>
                  <label className="text-[9px] font-black uppercase text-slate-400 block mb-0.5">To</label>
                  <input
                    type="date"
                    value={batchDateRange.to}
                    onChange={(e) => setBatchDateRange((p) => ({ ...p, to: e.target.value }))}
                    className="w-full bg-slate-100 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-800"
                  />
                </div>
              </div>
            </div>

            {/* Students Attendance Register List */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
              <div className="px-3.5 py-2.5 border-b border-slate-100 flex items-center justify-between">
                <span className="font-black text-slate-900 text-xs uppercase tracking-wider">
                  {selectedBatchClass} Register
                </span>
                <span className="text-[10px] font-bold text-slate-400">
                  {batchData?.students ? `${batchData.students.length} Students` : ""}
                </span>
              </div>

              {loadingBatch ? (
                <div className="p-6 text-center text-slate-400 text-xs font-bold">
                  Loading {selectedBatchClass} register...
                </div>
              ) : !batchData?.students?.length ? (
                <div className="p-6 text-center text-slate-400 text-xs font-bold">
                  No attendance records found for this class and date range.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
                  {batchData.students.map((student) => {
                    const pct = Number(student.percent || 0);
                    const pctColor =
                      pct >= 75
                        ? "text-emerald-700 bg-emerald-50 border-emerald-200"
                        : pct >= 60
                        ? "text-amber-700 bg-amber-50 border-amber-200"
                        : "text-rose-700 bg-rose-50 border-rose-200";

                    return (
                      <div key={student.rollNo} className="p-3 flex items-center justify-between gap-2.5">
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <span className="font-mono text-xs font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200 whitespace-nowrap shrink-0">
                            {student.rollNo}
                          </span>
                          <span className="font-black text-slate-900 text-xs truncate">
                            {student.name}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[11px] font-bold text-slate-500">
                            <span className="text-emerald-600">{student.attended}</span>/
                            <span className="text-slate-400">{student.total}</span>
                          </span>
                          <span className={`px-2 py-0.5 rounded-lg text-xs font-black border ${pctColor}`}>
                            {pct}%
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────
            3. STUDENT LOOKUP & HISTORY
        ────────────────────────────────────────────────────────────── */}
        {activeReportTab === "student" && (
          <div className="space-y-3 animate-in fade-in">
            {/* Search Box */}
            <div className="bg-white rounded-2xl p-3 border border-slate-200/80 shadow-xs relative">
              <input
                type="text"
                placeholder="Search student name or roll no (e.g. 10-001)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />

              {/* Autocomplete matches */}
              {filteredSearchStudents.length > 0 && !selectedStudent && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-2xl shadow-xl z-30 divide-y divide-slate-100 overflow-hidden">
                  {filteredSearchStudents.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => handleSelectStudent(s)}
                      className="w-full text-left px-3.5 py-2.5 hover:bg-slate-50 flex items-center justify-between text-xs transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-lg">
                          {s.rollNo}
                        </span>
                        <span className="font-bold text-slate-900">{s.name}</span>
                      </div>
                      <span className="text-[10px] font-bold text-slate-400">{s.class}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Student Attendance Stats & History Card */}
            {loadingStudent ? (
              <div className="bg-white rounded-2xl p-6 text-center text-slate-400 text-xs font-bold border border-slate-200/80">
                Loading student records...
              </div>
            ) : studentHistoryData ? (
              <div className="space-y-3">
                {/* Profile card */}
                <div
                  className="rounded-2xl p-4 text-white shadow-md relative overflow-hidden"
                  style={{
                    background: "linear-gradient(135deg, #082231 0%, #063a43 100%)",
                  }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="text-base font-black truncate">{studentHistoryData.name}</h3>
                      <p className="text-teal-200/80 text-[11px] font-bold mt-0.5">
                        {studentHistoryData.rollNo} • {studentHistoryData.class}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-3xl font-black tracking-tight">
                        {studentHistoryData.stats?.percent ?? 0}%
                      </span>
                      <p className="text-[9px] font-black uppercase text-teal-300">Attendance</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-white/10 text-center">
                    <div className="bg-white/10 rounded-xl p-2 backdrop-blur-sm">
                      <p className="text-base font-black">{studentHistoryData.stats?.total || 0}</p>
                      <p className="text-[8px] font-black uppercase text-teal-200">Total</p>
                    </div>
                    <div className="bg-white/10 rounded-xl p-2 backdrop-blur-sm">
                      <p className="text-base font-black text-emerald-300">{studentHistoryData.stats?.attended || 0}</p>
                      <p className="text-[8px] font-black uppercase text-teal-200">Present</p>
                    </div>
                    <div className="bg-white/10 rounded-xl p-2 backdrop-blur-sm">
                      <p className="text-base font-black text-rose-300">
                        {(studentHistoryData.stats?.total || 0) - (studentHistoryData.stats?.attended || 0)}
                      </p>
                      <p className="text-[8px] font-black uppercase text-teal-200">Absent</p>
                    </div>
                  </div>
                </div>

                {/* History Log */}
                <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
                  <div className="px-3.5 py-2.5 border-b border-slate-100 flex items-center justify-between">
                    <span className="font-black text-slate-900 text-xs uppercase tracking-wider">
                      History Log
                    </span>
                    <span className="text-[10px] font-bold text-slate-400">
                      {studentHistoryData.log ? `${studentHistoryData.log.length} Records` : ""}
                    </span>
                  </div>

                  {studentHistoryData.log?.length ? (
                    <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
                      {studentHistoryData.log.map((entry, idx) => {
                        const isPresent = entry.status === "P" || entry.status === "present";
                        return (
                          <div key={idx} className="px-3.5 py-2 flex items-center justify-between text-xs">
                            <span className="font-bold text-slate-800">{formatDisplayDate(entry.date)}</span>
                            <span
                              className={`px-2 py-0.5 rounded-md font-black text-[10px] uppercase border ${
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
                    <div className="p-4 text-center text-slate-400 text-xs font-bold">
                      No records found for this student.
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-2xl p-6 text-center text-slate-400 text-xs font-bold border border-slate-200/80">
                Search and select a student above to inspect their records.
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
