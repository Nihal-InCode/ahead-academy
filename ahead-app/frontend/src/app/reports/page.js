"use client";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import {
  getClasses,
  getSubjects,
  getStudents,
  getDailyReport,
  getDailyAttendanceDetails,
  updateDailyAttendance,
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
  const [activeReportTab, setActiveReportTab] = useState("");

  // Common data
  const [classes, setClasses] = useState([]);
  const [allStudents, setAllStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // 1. Daily Report state
  const [selectedDailyDate, setSelectedDailyDate] = useState(getIstDateString());
  const [dailyData, setDailyData] = useState([]);
  const [loadingDaily, setLoadingDaily] = useState(false);
  const [expandedDailyClass, setExpandedDailyClass] = useState("");
  const [selectedDailySession, setSelectedDailySession] = useState(null);
  const [loadingDailySession, setLoadingDailySession] = useState(false);
  const [loadingDailySessionKey, setLoadingDailySessionKey] = useState("");
  const [savingDailySession, setSavingDailySession] = useState(false);
  const [dailySaveMessage, setDailySaveMessage] = useState("");
  const [copyingAbsenteesFor, setCopyingAbsenteesFor] = useState("");
  const [copiedAbsenteesFor, setCopiedAbsenteesFor] = useState("");

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
  const studentHistoryRequestRef = useRef(0);

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

  useEffect(() => {
    const showReportsHome = () => {
      setActiveReportTab("");
      window.scrollTo({ top: 0, behavior: "smooth" });
    };
    window.addEventListener("ahead:reports-home", showReportsHome);
    return () => window.removeEventListener("ahead:reports-home", showReportsHome);
  }, []);

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

  const toggleDailyClass = (className) => {
    setExpandedDailyClass((current) => current === className ? "" : className);
    setSelectedDailySession(null);
    setDailySaveMessage("");
  };

  const openDailySession = async (className, subject) => {
    if (selectedDailySession?.className === className && selectedDailySession?.subject === subject) {
      setSelectedDailySession(null);
      setDailySaveMessage("");
      return;
    }
    const sessionKey = `${className}::${subject}`;
    setLoadingDailySession(true);
    setLoadingDailySessionKey(sessionKey);
    setSelectedDailySession(null);
    setError("");
    setDailySaveMessage("");
    try {
      const res = await getDailyAttendanceDetails(className, subject, selectedDailyDate);
      const records = Array.isArray(res) ? res : res?.data || [];
      setSelectedDailySession({
        className,
        subject,
        records: records.map((record) => ({
          ...record,
          status: record.status === "P"
            ? record.learningMode === "Online" ? "present_online" : "present_offline"
            : "absent",
        })),
      });
    } catch (err) {
      setError(err.message || `Failed to load ${subject} attendance.`);
    } finally {
      setLoadingDailySession(false);
      setLoadingDailySessionKey("");
    }
  };

  const setDailyStudentStatus = (studentId, status) => {
    setSelectedDailySession((current) => current ? ({
      ...current,
      records: current.records.map((record) =>
        record.studentId === studentId ? { ...record, status } : record
      ),
    }) : current);
  };

  const handleSaveDailySession = async () => {
    if (!selectedDailySession || selectedDailySession.records.length === 0) return;
    setSavingDailySession(true);
    setError("");
    setDailySaveMessage("");
    try {
      await updateDailyAttendance(
        selectedDailySession.className,
        selectedDailySession.subject,
        selectedDailyDate,
        selectedDailySession.records
      );
      setDailySaveMessage("Attendance changes saved.");
      setSelectedDailySession(null);
      await fetchDailyData(selectedDailyDate);
    } catch (err) {
      setError(err.message || "Failed to update attendance.");
    } finally {
      setSavingDailySession(false);
    }
  };

  const handleCopyAbsentees = async (className, subjectSummaries) => {
    if (!subjectSummaries?.length) return;
    setCopyingAbsenteesFor(className);
    setCopiedAbsenteesFor("");
    setError("");
    try {
      const subjectResults = await Promise.all(subjectSummaries.map(async (subject) => {
        const response = await getDailyAttendanceDetails(className, subject.name, selectedDailyDate);
        const records = Array.isArray(response) ? response : response?.data || [];
        return {
          name: subject.name,
          absentees: records.filter((record) => record.status !== "P"),
        };
      }));
      const message = [
        `*${className} — Absentees*`,
        `*${formatDisplayDate(selectedDailyDate)}*`,
        ...subjectResults.map(({ name, absentees }) => [
          `*${name}*`,
          absentees.length
            ? absentees.map((student) => `• ${student.name}${student.rollNo ? ` (${student.rollNo})` : ""}`).join("\n")
            : "_No absentees_",
        ].join("\n")),
      ].join("\n\n");

      let copied = false;
      if (navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(message);
          copied = true;
        } catch {
          // Some phones block clipboard access on a local network address.
        }
      }
      if (!copied) {
        const textarea = document.createElement("textarea");
        textarea.value = message;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        textarea.setSelectionRange(0, message.length);
        copied = document.execCommand("copy");
        textarea.remove();
        if (!copied) throw new Error("Clipboard access is unavailable in this browser.");
      }

      setCopiedAbsenteesFor(className);
      window.setTimeout(() => setCopiedAbsenteesFor((current) => current === className ? "" : current), 2000);
    } catch (err) {
      setError(err.message || "Could not copy the absent student list.");
    } finally {
      setCopyingAbsenteesFor("");
    }
  };

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
    const requestId = studentHistoryRequestRef.current + 1;
    studentHistoryRequestRef.current = requestId;
    setSelectedStudent(student);
    setSearchQuery(`${student.rollNo} - ${student.name}`);
    setLoadingStudent(true);
    setError("");
    try {
      const res = await getStudentHistory(student.rollNo);
      if (studentHistoryRequestRef.current === requestId) {
        setStudentHistoryData(res?.data || res || null);
      }
    } catch (err) {
      if (studentHistoryRequestRef.current === requestId) {
        setError("Failed to load records for " + student.name);
      }
    } finally {
      if (studentHistoryRequestRef.current === requestId) {
        setLoadingStudent(false);
      }
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
      return { held: 0 };
    }
    const held = batchData.heldSessions ?? batchData.students[0]?.total ?? 0;
    return { held };
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
        title={
          activeReportTab === "daily"
            ? "Overview"
            : activeReportTab === "register"
              ? "Register"
              : activeReportTab === "student"
                ? "Student History"
                : "Reports"
        }
        subtitle={
          activeReportTab === "daily"
            ? "Daily attendance"
            : activeReportTab === "register"
              ? "Class attendance register"
              : activeReportTab === "student"
                ? "Student attendance records"
                : isGuest
            ? user?.guest_name
              ? `Guest: ${user.guest_name}`
              : "Student Portal"
            : "Registers & Analytics"
        }
        showBack={Boolean(activeReportTab) || !isGuest}
        onBack={() => activeReportTab ? setActiveReportTab("") : router.push("/")}
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

        {!activeReportTab && (
          <section className="space-y-4 animate-in fade-in duration-200">
            <div className="rounded-2xl border border-slate-200/90 bg-white p-4 text-center shadow-xs sm:p-5">
              <h2 className="text-base font-black text-slate-900">Reports</h2>
              <p className="mt-1 text-xs text-slate-500">Choose a report to view.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                {
                  id: "daily",
                  title: "Overview",
                  icon: (
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  ),
                  tone: "bg-emerald-50 text-emerald-700 ring-emerald-100",
                  cardTone: "border-emerald-100 bg-gradient-to-br from-emerald-50/80 to-white hover:border-emerald-200",
                },
                {
                  id: "register",
                  title: "Register",
                  icon: (
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                    </svg>
                  ),
                  tone: "bg-blue-50 text-blue-700 ring-blue-100",
                  cardTone: "border-blue-100 bg-gradient-to-br from-blue-50/80 to-white hover:border-blue-200",
                },
                {
                  id: "student",
                  title: "Student History",
                  icon: (
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  ),
                  tone: "bg-violet-50 text-violet-700 ring-violet-100",
                  cardTone: "border-violet-100 bg-gradient-to-br from-violet-50/80 to-white hover:border-violet-200",
                },
              ].map((report) => (
                <button
                  key={report.id}
                  type="button"
                  onClick={() => setActiveReportTab(report.id)}
                  className={`group flex min-h-24 items-center gap-2.5 rounded-2xl border p-3 text-left shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 sm:min-h-28 sm:gap-3 sm:p-4 ${report.cardTone}`}
                >
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ring-1 sm:h-10 sm:w-10 ${report.tone}`}>
                    {report.icon}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-black leading-tight text-slate-900 sm:text-sm">{report.title}</span>
                  </span>
                  <span className="shrink-0 text-sm text-slate-300 transition-colors group-hover:text-slate-600" aria-hidden="true">→</span>
                </button>
              ))}
            </div>
          </section>
        )}

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
                  onChange={(e) => {
                    setSelectedDailyDate(e.target.value);
                    setExpandedDailyClass("");
                    setSelectedDailySession(null);
                    setDailySaveMessage("");
                  }}
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
                const subjectSummaries = entry?.subjects || [];
                const isClassExpanded = expandedDailyClass === cls.name;
                const classStudents = allStudents.filter(
                  (s) => s.class === cls.name && s.isActive
                );
                const enrolledCount = classStudents.length;
                const marked = entry ? entry.marked : 0;
                const present = entry ? entry.present : 0;
                const absent = marked > present ? marked - present : 0;
                const pct =
                  marked > 0
                    ? Math.round((present / marked) * 100)
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
                          {present} P
                        </span>
                        <span className="text-slate-300">•</span>
                        <span className="text-rose-600 flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                          {absent} A
                        </span>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {isMarked && (
                          <button
                            type="button"
                            onClick={() => handleCopyAbsentees(cls.name, subjectSummaries)}
                            disabled={copyingAbsenteesFor === cls.name}
                            aria-label={`Copy absent students for ${cls.name}`}
                            title="Copy absentees for WhatsApp"
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] font-bold text-slate-600 shadow-xs transition-colors hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700 disabled:opacity-50"
                          >
                            {copiedAbsenteesFor === cls.name ? (
                              <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" d="M16.704 5.29a1 1 0 010 1.415l-7.01 7.01a1 1 0 01-1.414 0l-3.01-3.01a1 1 0 011.414-1.414l2.303 2.302 6.303-6.303a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                            ) : (
                              <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><rect x="7" y="6" width="9" height="11" rx="1.5" /><path d="M13 6V4.5A1.5 1.5 0 0011.5 3h-7A1.5 1.5 0 003 4.5v9A1.5 1.5 0 004.5 15H7" /></svg>
                            )}
                            <span>{copyingAbsenteesFor === cls.name ? "…" : copiedAbsenteesFor === cls.name ? "Copied" : "Copy"}</span>
                          </button>
                        )}
                        <span className="text-[11px] font-semibold text-slate-400">{marked} Recorded</span>
                      </div>
                    </div>

                    {/* Daily attendance split */}
                    <div
                      role="img"
                      aria-label={`${present} present and ${absent} absent`}
                      className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100 ring-1 ring-inset ring-slate-200/80"
                    >
                      {isMarked && (
                        <div className="flex h-full w-full gap-0.5">
                          {present > 0 && (
                            <div
                              style={{ width: `${(present / marked) * 100}%` }}
                              className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-[width] duration-500 ease-out"
                            />
                          )}
                          {absent > 0 && (
                            <div
                              style={{ width: `${(absent / marked) * 100}%` }}
                              className="h-full rounded-full bg-gradient-to-r from-rose-400 to-rose-300 transition-[width] duration-500 ease-out"
                            />
                          )}
                        </div>
                      )}
                    </div>

                    {subjectSummaries.length > 0 && (
                      <div className="border-t border-slate-100 pt-2.5">
                        <button
                          type="button"
                          onClick={() => toggleDailyClass(cls.name)}
                          aria-expanded={isClassExpanded}
                          className="flex w-full items-center justify-between gap-2 text-left"
                        >
                          <span className="text-xs font-bold text-slate-700">
                            {isClassExpanded ? "Hide" : "View"} subjects marked ({subjectSummaries.length})
                          </span>
                          <svg className={`h-4 w-4 text-slate-400 transition-transform ${isClassExpanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m6 9 6 6 6-6" />
                          </svg>
                        </button>

                        {isClassExpanded && (
                          <div className="mt-2.5 space-y-2">
                            {subjectSummaries.map((subjectSummary) => {
                              const isSelected = selectedDailySession?.className === cls.name && selectedDailySession?.subject === subjectSummary.name;
                              const presentCount = subjectSummary.present || 0;
                              const absentCount = subjectSummary.absent || 0;
                              return (
                                <div key={subjectSummary.name} className="rounded-xl border border-slate-200 bg-slate-50/70 p-2.5">
                                  <button
                                    type="button"
                                    onClick={() => openDailySession(cls.name, subjectSummary.name)}
                                    className="flex w-full items-center justify-between gap-3 text-left"
                                  >
                                    <span className="min-w-0">
                                      <span className="block truncate text-xs font-bold text-slate-800">{subjectSummary.name}</span>
                                      <span className="mt-0.5 block text-[10px] font-medium text-slate-500">
                                        {presentCount} present · {absentCount} absent · {subjectSummary.marked} recorded
                                      </span>
                                    </span>
                                    <span className="shrink-0 rounded-lg border border-blue-100 bg-blue-50 px-2.5 py-1 text-[10px] font-bold text-blue-700">
                                      {loadingDailySessionKey === `${cls.name}::${subjectSummary.name}` ? "Loading…" : isSelected ? "Close" : isGuest ? "View" : "Edit"}
                                    </span>
                                  </button>

                                  {isSelected && (
                                    <div className="mt-3 space-y-2 border-t border-slate-200 pt-2.5">
                                      {selectedDailySession.records.length === 0 ? (
                                        <p className="text-xs text-slate-500">No attendance records found for this subject.</p>
                                      ) : (
                                        selectedDailySession.records.map((record) => (
                                          <div key={record.studentId} className="flex flex-col gap-2 rounded-lg bg-white px-2.5 py-2 sm:flex-row sm:items-center sm:justify-between">
                                            <span className="min-w-0 truncate text-xs font-semibold text-slate-800">
                                              <span className="mr-2 font-mono text-[10px] text-slate-500">{record.rollNo}</span>
                                              {record.name}
                                            </span>
                                            {isGuest ? (
                                              <span className="shrink-0 text-[10px] font-semibold text-slate-600">
                                                {{
                                                  present_online: "Present · Online",
                                                  present_offline: "Present · Offline",
                                                  absent: "Absent",
                                                }[record.status] || "Absent"}
                                              </span>
                                            ) : (
                                              <div role="group" aria-label={`Attendance for ${record.name}`} className="grid shrink-0 grid-cols-3 rounded-lg border border-slate-200 bg-slate-50 p-0.5">
                                                {[
                                                  { value: "present_online", label: "Online", active: "bg-blue-600 text-white shadow-sm" },
                                                  { value: "present_offline", label: "Offline", active: "bg-emerald-600 text-white shadow-sm" },
                                                  { value: "absent", label: "Absent", active: "bg-rose-600 text-white shadow-sm" },
                                                ].map((option) => (
                                                  <button
                                                    key={option.value}
                                                    type="button"
                                                    aria-pressed={record.status === option.value}
                                                    onClick={() => setDailyStudentStatus(record.studentId, option.value)}
                                                    className={`rounded-md px-2.5 py-1.5 text-[10px] font-semibold transition-colors ${
                                                      record.status === option.value
                                                        ? option.active
                                                        : "text-slate-500 hover:bg-white hover:text-slate-700"
                                                    }`}
                                                  >
                                                    {option.label}
                                                  </button>
                                                ))}
                                              </div>
                                            )}
                                          </div>
                                        ))
                                      )}
                                      {!isGuest && selectedDailySession.records.length > 0 && (
                                        <div className="flex items-center justify-between gap-2 pt-1">
                                          <span className="text-[11px] font-semibold text-emerald-700">{dailySaveMessage}</span>
                                          <button
                                            type="button"
                                            onClick={handleSaveDailySession}
                                            disabled={savingDailySession}
                                            className="rounded-lg bg-teal-600 px-3 py-1.5 text-[11px] font-bold text-white transition-colors hover:bg-teal-700 disabled:opacity-50"
                                          >
                                            {savingDailySession ? "Saving…" : "Save changes"}
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
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
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
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
                          <th className="py-3 px-4">Name</th>
                          <th className="py-3 px-4 text-center w-36">
                            Total
                          </th>
                          <th className="py-3 px-4 w-40 text-center">
                            Percentage
                          </th>
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
                                <span className="text-emerald-700">{student.attended || 0}</span>
                                <span className="text-slate-300 mx-1">/</span>
                                <span className="text-slate-500">{student.total || 0}</span>
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
                                {student.attended || 0} of {student.total || 0} classes
                              </p>
                            </div>
                          </div>

                          <div className="shrink-0 text-right">
                            <p className="mb-0.5 text-[9px] font-semibold text-slate-400">Attendance Rate</p>
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
                  onChange={(e) => {
                    studentHistoryRequestRef.current += 1;
                    setSearchQuery(e.target.value);
                    setSelectedStudent(null);
                    setStudentHistoryData(null);
                    setLoadingStudent(false);
                  }}
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
                      studentHistoryRequestRef.current += 1;
                      setSearchQuery("");
                      setSelectedStudent(null);
                      setStudentHistoryData(null);
                      setLoadingStudent(false);
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
