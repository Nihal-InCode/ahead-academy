"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import {
  getClasses,
  getSubjects,
  getStudents,
  markAttendance,
  trackEvent,
} from "@/lib/api";
import { useLoading } from "@/context/LoadingContext";
import { playSound } from "@/lib/sound";
import PencilLoader from "@/components/PencilLoader";
import AppHeader from "@/components/AppHeader";

const getIstToday = () => {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(new Date());
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const d = parts.find((p) => p.type === "day")?.value;
  return `${y}-${m}-${d}`;
};

const formatDisplayDate = (dateStr) => {
  try {
    const [y, m, dd] = dateStr.split("-").map(Number);
    const date = new Date(y, m - 1, dd);
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

// 3-state toggle: Online → Offline → Absent
const STATUS_CYCLE = ["present_online", "present_offline", "absent"];

const statusConfig = {
  present_online: {
    label: "Online",
    color: "bg-blue-600",
    text: "text-blue-700",
    bg: "bg-blue-50",
    border: "border-blue-200",
    tagBg: "bg-blue-600 text-white shadow-sm shadow-blue-200",
  },
  present_offline: {
    label: "Offline",
    color: "bg-emerald-600",
    text: "text-emerald-700",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    tagBg: "bg-emerald-600 text-white shadow-sm shadow-emerald-200",
  },
  absent: {
    label: "Absent",
    color: "bg-rose-600",
    text: "text-rose-600",
    bg: "bg-rose-50",
    border: "border-rose-200",
    tagBg: "bg-rose-500 text-white shadow-sm shadow-rose-200",
  },
};

function ConfirmationModal({ className, subject, date, students, attendance, onGoHome, onClose }) {
  const groups = { present_online: [], present_offline: [], absent: [] };
  students.forEach((s) => {
    const defaultMode = s.learningMode === "Online" || s.learning_mode === "Online" ? "present_online" : "present_offline";
    const st = attendance[s.id] || defaultMode;
    if (groups[st]) groups[st].push(s);
  });

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget && onClose) onClose();
      }}
      className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200"
    >
      <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[85vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
        {/* Header with Title and Close (✕) Button */}
        <div
          className="p-5 flex-shrink-0 relative overflow-hidden text-white"
          style={{ background: "linear-gradient(135deg, #082231 0%, #063a43 100%)" }}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <span className="text-emerald-400 font-bold text-xs uppercase tracking-wider block mb-1">
                Saved Successfully
              </span>
              <h2 className="text-xl font-black text-white">
                {className} • {subject}
              </h2>
              <p className="text-xs text-teal-200/80 font-medium mt-0.5">
                {formatDisplayDate(date)} • {students.length} Students Enrolled
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 text-white flex items-center justify-center transition-all shrink-0 text-sm font-bold"
              title="Close popup"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Scrollable Summary List */}
        <div className="overflow-y-auto flex-1 p-4 space-y-3">
          {[
            { key: "present_online", label: "Online", ...statusConfig.present_online },
            { key: "present_offline", label: "Offline", ...statusConfig.present_offline },
            { key: "absent", label: "Absent", ...statusConfig.absent },
          ].map(({ key, label, bg, text, border }) =>
            groups[key].length > 0 ? (
              <div key={key} className="space-y-1.5">
                <div className="flex items-center justify-between px-1">
                  <span className={`text-[11px] font-black uppercase tracking-wider ${text}`}>
                    {label}
                  </span>
                  <span className={`text-xs font-black ${text}`}>
                    {groups[key].length}
                  </span>
                </div>
                <div className={`${bg} ${border} border rounded-2xl overflow-hidden divide-y divide-black/5`}>
                  {groups[key].map((s, i) => (
                    <div key={i} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="font-mono text-xs font-bold text-slate-800 bg-white px-2 py-0.5 rounded-lg border border-black/5 shadow-2xs whitespace-nowrap shrink-0">
                          {s.rollNo}
                        </span>
                        <p className="font-bold text-slate-900 text-xs sm:text-sm truncate">
                          {s.name}
                        </p>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${text}`}>
                        {label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null
          )}
        </div>

        {/* Action Button: Above BottomNav with Safe Padding */}
        <div className="p-4 pb-6 sm:pb-4 border-t border-slate-100 flex-shrink-0 bg-slate-50">
          <button
            onClick={onGoHome}
            className="w-full py-3.5 rounded-2xl font-black text-sm bg-teal-600 text-white hover:bg-teal-700 transition-all active:scale-95 shadow-md shadow-teal-200"
          >
            Done • Return to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AttendancePage() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showLoader, hideLoader } = useLoading();

  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [subjects, setSubjects] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState("");
  const [subjectsLoading, setSubjectsLoading] = useState(false);
  const [students, setStudents] = useState([]);
  const [date, setDate] = useState(getIstToday());
  const [attendance, setAttendance] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (user && (user.role === "Guest" || String(user.username || "").toLowerCase() === "guest")) {
      router.replace("/reports");
      return;
    }
    if (user && user.role !== "admin" && (user.is_teacher === 0 || user.is_teacher === false)) {
      router.push("/");
    }
  }, [user, router]);

  const loadSubjectsForClass = useCallback(async (className) => {
    if (!className) {
      setSubjects([]);
      setSelectedSubject("");
      setStudents([]);
      setAttendance({});
      return [];
    }
    setSubjectsLoading(true);
    try {
      const res = await getSubjects(className);
      const list = Array.isArray(res) ? res : (res?.data || []);
      const seen = new Set();
      const uniqueList = [];
      for (const s of list) {
        const name = (typeof s === "string" ? s : s?.name || s?.id || "").trim();
        if (name && !seen.has(name.toLowerCase())) {
          seen.add(name.toLowerCase());
          uniqueList.push({ id: s?.id || name, name });
        }
      }
      setSubjects(uniqueList);
      return uniqueList;
    } catch {
      setSubjects([]);
      return [];
    } finally {
      setSubjectsLoading(false);
    }
  }, []);

  const fetchStudents = useCallback(async (className, subjectName, forDate) => {
    if (!className || !subjectName) {
      setStudents([]);
      setAttendance({});
      return;
    }
    setLoading(true);
    setError("");
    try {
      showLoader(`Loading ${subjectName} students...`);
      const data = await getStudents(className, subjectName, forDate || date);
      const studentList = Array.isArray(data) ? data : (data?.data || []);
      setStudents(studentList);

      // Default attendance: follow student's current learningMode or Offline
      const initial = {};
      studentList.forEach((s) => {
        initial[s.id] = (s.learningMode === "Online" || s.learning_mode === "Online")
          ? "present_online"
          : "present_offline";
      });
      setAttendance(initial);
    } catch {
      setError(`Failed to load students for ${className} • ${subjectName}`);
    } finally {
      setLoading(false);
      hideLoader();
    }
  }, [date, showLoader, hideLoader]);

  const loadClasses = useCallback(async () => {
    try {
      setLoading(true);
      showLoader("Loading classes...");
      const res = await getClasses();
      const rawList = Array.isArray(res) ? res : (res?.data || []);
      const list = rawList.filter((c) => c.is_active !== false);
      setClasses(list);

      // Check if URL params passed
      const urlClassId = searchParams?.get("classId");
      const urlSubject = searchParams?.get("subject");
      const urlDate = searchParams?.get("date");
      if (urlDate) setDate(urlDate);

      if (urlClassId) {
        const found = list.find((c) => c.name === urlClassId);
        if (found) {
          setSelectedClass(found.name);
          const subjList = await loadSubjectsForClass(found.name);
          if (urlSubject && subjList.some((s) => s.name.toLowerCase() === urlSubject.toLowerCase())) {
            const matchedSubj = subjList.find((s) => s.name.toLowerCase() === urlSubject.toLowerCase());
            setSelectedSubject(matchedSubj.name);
            await fetchStudents(found.name, matchedSubj.name, urlDate || date);
          }
        }
      } else {
        setSelectedClass("");
        setSelectedSubject("");
        setStudents([]);
        setAttendance({});
      }
    } catch {
      setError("Failed to load classes.");
    } finally {
      setLoading(false);
      hideLoader();
    }
  }, [searchParams, date, loadSubjectsForClass, fetchStudents, showLoader, hideLoader]);

  useEffect(() => {
    loadClasses();
  }, [loadClasses]);

  const handleClassChange = async (clsName) => {
    setSelectedClass(clsName);
    setSelectedSubject("");
    setStudents([]);
    setAttendance({});
    if (clsName) {
      await loadSubjectsForClass(clsName);
    } else {
      setSubjects([]);
    }
  };

  const handleSubjectChange = async (subjName) => {
    setSelectedSubject(subjName);
    if (selectedClass && subjName) {
      await fetchStudents(selectedClass, subjName, date);
    } else {
      setStudents([]);
      setAttendance({});
    }
  };

  // Toggle student between Online -> Offline -> Absent
  const toggleStatus = (studentId) => {
    setAttendance((prev) => {
      const current = prev[studentId] || "present_offline";
      const nextIndex = (STATUS_CYCLE.indexOf(current) + 1) % STATUS_CYCLE.length;
      return { ...prev, [studentId]: STATUS_CYCLE[nextIndex] };
    });
  };

  // Batch action: Set all students to a specific status
  const setAllStatus = (targetStatus) => {
    const updated = {};
    students.forEach((s) => {
      updated[s.id] = targetStatus;
    });
    setAttendance(updated);
  };

  const handleSubmit = async () => {
    if (!selectedClass || !selectedSubject || students.length === 0) return;
    setSubmitting(true);
    showLoader(`Saving ${selectedSubject} attendance...`, { vibrate: true });
    setError("");
    try {
      const records = students.map((s) => {
        const defaultMode = (s.learningMode === "Online" || s.learning_mode === "Online")
          ? "present_online"
          : "present_offline";
        const st = attendance[s.id] || defaultMode;
        const isAbsent = st === "absent";
        return {
          studentId: s.id,
          status: isAbsent ? "absent" : (st === "present_online" ? "present_online" : "present_offline"),
          learningMode: isAbsent ? "" : (st === "present_online" ? "Online" : "Offline"),
        };
      });

      const result = await markAttendance({
        classId: selectedClass,
        subject: selectedSubject,
        date,
        records,
      });

      if (result.success) {
        trackEvent("Marked attendance", `${selectedClass} - ${selectedSubject}`);
        playSound("attendanceSuccess");
        setShowConfirm(true);
      } else {
        playSound("attendanceError");
        setError(result.error || result.message || "Failed to mark attendance.");
      }
    } catch (err) {
      setError("Error: " + err.message);
    } finally {
      setSubmitting(false);
      hideLoader();
    }
  };

  // Summary counts
  const counts = { present_online: 0, present_offline: 0, absent: 0 };
  students.forEach((s) => {
    const defaultMode = (s.learningMode === "Online" || s.learning_mode === "Online")
      ? "present_online"
      : "present_offline";
    const st = attendance[s.id] || defaultMode;
    if (counts[st] !== undefined) counts[st]++;
  });

  if (loading && classes.length === 0) return <PencilLoader />;

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-32">
      {/* ── UNIFIED APP HEADER ── */}
      <AppHeader
        title="Attendance"
        subtitle={
          selectedClass && selectedSubject
            ? `${selectedClass} • ${selectedSubject}`
            : selectedClass
            ? selectedClass
            : "AHEAD"
        }
        showBack={true}
        onBack={() => router.push("/")}
        date={formatDisplayDate(date)}
        maxWidth="max-w-2xl sm:max-w-3xl"
      />

      <div className="w-full max-w-2xl sm:max-w-3xl mx-auto px-3.5 sm:px-6 py-4 space-y-4">
        {error && (
          <div className="p-3.5 bg-rose-50 text-rose-700 rounded-2xl text-xs font-bold border border-rose-200 flex items-center justify-between animate-in fade-in">
            <span>{error}</span>
            <button onClick={() => setError("")} className="p-1 text-rose-400 hover:text-rose-600">✕</button>
          </div>
        )}

        {/* ── CLASS, SUBJECT & DATE SELECTION CARD ── */}
        <div className="bg-white rounded-2xl p-3.5 sm:p-4 border border-slate-200/80 shadow-xs">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
            {/* 1. Class Batch */}
            <div>
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1">
                1. Select Class
              </label>
              <select
                value={selectedClass}
                onChange={(e) => handleClassChange(e.target.value)}
                className="w-full bg-slate-100/70 hover:bg-slate-100 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all cursor-pointer"
              >
                <option value="">Select Class</option>
                {classes.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* 2. Subject Dropdown (DROPDOWN SELECTION ONLY - NO CHIPS/DUPLICATES) */}
            <div>
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1">
                2. Select Subject
              </label>
              <select
                value={selectedSubject}
                disabled={!selectedClass || subjectsLoading}
                onChange={(e) => handleSubjectChange(e.target.value)}
                className="w-full bg-slate-100/70 hover:bg-slate-100 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
              >
                <option value="">
                  {!selectedClass
                    ? "← Select Class first"
                    : subjectsLoading
                    ? "Loading subjects..."
                    : "Select Subject"}
                </option>
                {subjects.map((s) => (
                  <option key={s.id || s.name} value={s.name}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            {/* 3. Attendance Date */}
            <div>
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1">
                3. Attendance Date
              </label>
              <input
                type="date"
                value={date}
                max={getIstToday()}
                onChange={(e) => {
                  const newDate = e.target.value;
                  setDate(newDate);
                  if (selectedClass && selectedSubject) {
                    fetchStudents(selectedClass, selectedSubject, newDate);
                  }
                }}
                className="w-full bg-slate-100/70 hover:bg-slate-100 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* ── EMPTY STATES ── */}
        {!selectedClass ? (
          <div className="bg-white rounded-2xl p-8 text-center border border-slate-200/80 shadow-xs space-y-2">
            <div className="w-12 h-12 bg-teal-50 text-teal-700 rounded-2xl flex items-center justify-center mx-auto">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <h3 className="font-black text-slate-800 text-sm">Select Class & Subject</h3>
            <p className="text-xs text-slate-400 max-w-xs mx-auto">
              Please choose a class and subject above to view the enrolled students and mark attendance.
            </p>
          </div>
        ) : !selectedSubject ? (
          <div className="bg-white rounded-2xl p-8 text-center border border-slate-200/80 shadow-xs space-y-2">
            <div className="w-12 h-12 bg-teal-50 text-teal-700 rounded-2xl flex items-center justify-center mx-auto">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <h3 className="font-black text-slate-800 text-sm">
              Select a Subject from the Dropdown
            </h3>
            <p className="text-xs text-slate-400 max-w-xs mx-auto">
              Please choose a subject in the dropdown above to load the student roster for {selectedClass}.
            </p>
          </div>
        ) : (
          <>
            {/* ── ENROLLED HEADER & 3-PART KPI COUNTER STRIP ── */}
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-black text-slate-700">
                {selectedSubject} Roster
              </span>
              <span className="text-[11px] font-bold text-teal-700 bg-teal-50 px-2.5 py-0.5 rounded-full border border-teal-200">
                {students.length} Enrolled
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="bg-blue-50/90 border border-blue-200/80 rounded-2xl p-2.5 text-center shadow-xs">
                <p className="text-xl font-black text-blue-700 leading-none">{counts.present_online}</p>
                <p className="text-[9px] font-black uppercase tracking-wider text-blue-600/80 mt-1">Online</p>
              </div>
              <div className="bg-emerald-50/90 border border-emerald-200/80 rounded-2xl p-2.5 text-center shadow-xs">
                <p className="text-xl font-black text-emerald-700 leading-none">{counts.present_offline}</p>
                <p className="text-[9px] font-black uppercase tracking-wider text-emerald-600/80 mt-1">Offline</p>
              </div>
              <div className="bg-rose-50/90 border border-rose-200/80 rounded-2xl p-2.5 text-center shadow-xs">
                <p className="text-xl font-black text-rose-600 leading-none">{counts.absent}</p>
                <p className="text-[9px] font-black uppercase tracking-wider text-rose-500/80 mt-1">Absent</p>
              </div>
            </div>

            {/* ── QUICK BATCH TOGGLE ACTIONS ── */}
            <div className="flex items-center justify-between gap-1.5 px-0.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                Quick Fill:
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setAllStatus("present_online")}
                  className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-all active:scale-95"
                >
                  All Online
                </button>
                <button
                  onClick={() => setAllStatus("present_offline")}
                  className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-all active:scale-95"
                >
                  All Offline
                </button>
                <button
                  onClick={() => setAllStatus("absent")}
                  className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 transition-all active:scale-95"
                >
                  All Absent
                </button>
              </div>
            </div>

            {/* ── STUDENT ATTENDANCE LIST ── */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden divide-y divide-slate-100">
              {students.length === 0 ? (
                <div className="p-8 text-center text-slate-400 font-bold text-xs">
                  No students enrolled in {selectedSubject} for {selectedClass}.
                </div>
              ) : (
                students.map((student) => {
                  const defaultMode = (student.learningMode === "Online" || student.learning_mode === "Online")
                    ? "present_online"
                    : "present_offline";
                  const st = attendance[student.id] || defaultMode;
                  const cfg = statusConfig[st] || statusConfig.present_offline;
                  return (
                    <div
                      key={student.id}
                      className={`p-3 flex items-center justify-between gap-2.5 transition-colors ${
                        st === "absent" ? "bg-rose-50/20" : ""
                      }`}
                    >
                      {/* Left: Roll No + Student Name */}
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <span className="font-mono text-xs font-bold text-slate-800 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200/80 whitespace-nowrap shrink-0">
                          {student.rollNo}
                        </span>
                        <p className="font-black text-slate-900 text-xs sm:text-sm truncate">
                          {student.name}
                        </p>
                      </div>

                      {/* Right: Single Interactive Toggle Pill */}
                      <button
                        onClick={() => toggleStatus(student.id)}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all active:scale-90 shrink-0 ${cfg.tagBg}`}
                      >
                        {cfg.label}
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            {/* ── PROMINENT SUBMISSION BUTTON ── */}
            {students.length > 0 && (
              <div className="pt-2">
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className={`w-full py-4 rounded-2xl text-sm font-black transition-all active:scale-[0.98] shadow-lg ${
                    submitting
                      ? "bg-slate-300 text-slate-500 shadow-none cursor-not-allowed"
                      : "bg-teal-600 hover:bg-teal-700 text-white shadow-teal-200"
                  }`}
                >
                  {submitting
                    ? "Saving Records..."
                    : `Submit Attendance • ${selectedSubject} (${students.length})`}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Confirmation Modal */}
      {showConfirm && (
        <ConfirmationModal
          className={selectedClass}
          subject={selectedSubject}
          date={date}
          students={students}
          attendance={attendance}
          onGoHome={() => router.push("/")}
          onClose={() => setShowConfirm(false)}
        />
      )}
    </div>
  );
}
