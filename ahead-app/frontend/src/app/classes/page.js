"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import {
  getClasses,
  addClass,
  editClass,
  setClassActive,
  getStudents,
  updateStudent,
  addStudent,
  deactivateStudent,
} from "@/lib/api";
import { useLoading } from "@/context/LoadingContext";
import AppHeader from "@/components/AppHeader";
import PencilLoader from "@/components/PencilLoader";

function getRollSuggestions(className, allStudents = [], count = 3) {
  if (!className) return [];
  const classStudents = (allStudents || []).filter(
    (s) => (s.class === className || s.className === className) && (s.rollNo || s.roll_no)
  );
  let prefix = "";
  let maxNum = 0;
  let padLen = 3;

  if (classStudents.length > 0) {
    classStudents.forEach((s) => {
      const rollStr = String(s.rollNo || s.roll_no).trim();
      const match = rollStr.match(/^(.*?)([-_])?(\d+)$/);
      if (match) {
        const numStr = match[3];
        const num = parseInt(numStr, 10);
        if (!isNaN(num)) {
          if (!prefix && (match[1] || match[2])) {
            prefix = match[1] + (match[2] || "-");
          }
          if (num > maxNum) {
            maxNum = num;
            padLen = Math.max(padLen, numStr.length);
          }
        }
      }
    });
  }

  if (!prefix) {
    const stripped = className.replace(/^(class|grade|standard|std)\s*/i, "").trim();
    prefix = (stripped || className.trim() || "1") + "-";
  }

  if (!prefix.endsWith("-") && !prefix.endsWith("_")) {
    prefix = prefix + "-";
  }

  const suggestions = [];
  for (let i = 1; i <= count; i++) {
    const nextNum = maxNum + i;
    const formattedNum = String(nextNum).padStart(Math.max(3, padLen), "0");
    suggestions.push(prefix + formattedNum);
  }
  return suggestions;
}

export default function ClassesPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { showLoader, hideLoader } = useLoading();

  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Add Class state
  const [newClassName, setNewClassName] = useState("");
  const [addingClass, setAddingClass] = useState(false);

  // Expanded class accordion
  const [expandedClasses, setExpandedClasses] = useState({});
  const [studentSearch, setStudentSearch] = useState({});

  // Modals
  const [renameModal, setRenameModal] = useState({
    isOpen: false,
    currentName: "",
    newName: "",
    saving: false,
  });

  const [editStudentModal, setEditStudentModal] = useState({
    isOpen: false,
    studentId: null,
    rollNo: "",
    name: "",
    className: "",
    learningMode: "Offline",
    saving: false,
  });

  const [addStudentModal, setAddStudentModal] = useState({
    isOpen: false,
    className: "",
    rollNo: "",
    suggestions: [],
    name: "",
    learningMode: "Offline",
    saving: false,
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      showLoader("Loading classes...");
      const [classesRes, studentsRes] = await Promise.all([
        getClasses(),
        getStudents(null, null, null, "1"),
      ]);
      setClasses(Array.isArray(classesRes) ? classesRes : (classesRes?.data || []));
      setStudents(Array.isArray(studentsRes) ? studentsRes : (studentsRes?.data || []));
    } catch (err) {
      setError("Failed to load classes and student data.");
      console.error(err);
    } finally {
      setLoading(false);
      hideLoader();
    }
  }, [showLoader, hideLoader]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (user && (user.role === "Guest" || String(user.username || "").toLowerCase() === "guest")) {
      router.replace("/reports");
    }
  }, [user, router]);

  const showNotification = (msg) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(""), 3500);
  };

  const toggleExpand = (className) => {
    setExpandedClasses((prev) => ({
      ...prev,
      [className]: !prev[className],
    }));
  };

  // Add class
  const handleAddClass = async (e) => {
    e.preventDefault();
    const name = newClassName.trim();
    if (!name) return;
    setAddingClass(true);
    setError("");
    try {
      const res = await addClass({ name });
      if (res.success) {
        setNewClassName("");
        showNotification(`Class "${name}" added.`);
        await loadData();
      } else {
        setError(res.error || "Failed to add class.");
      }
    } catch (err) {
      setError(err.message || "Failed to add class.");
    } finally {
      setAddingClass(false);
    }
  };

  // Rename class
  const openRenameModal = (className) => {
    setRenameModal({
      isOpen: true,
      currentName: className,
      newName: className,
      saving: false,
    });
  };

  const handleSaveRename = async (e) => {
    e.preventDefault();
    const { currentName, newName } = renameModal;
    const trimmed = newName.trim();
    if (!trimmed || trimmed === currentName) {
      setRenameModal({ isOpen: false, currentName: "", newName: "", saving: false });
      return;
    }
    setRenameModal((prev) => ({ ...prev, saving: true }));
    setError("");
    try {
      const res = await editClass(currentName, { newName: trimmed });
      if (res.success) {
        showNotification(`Class renamed to "${trimmed}".`);
        setExpandedClasses((prev) => {
          const next = { ...prev };
          if (next[currentName]) {
            delete next[currentName];
            next[trimmed] = true;
          }
          return next;
        });
        setRenameModal({ isOpen: false, currentName: "", newName: "", saving: false });
        await loadData();
      } else {
        setError(res.error || "Failed to rename class.");
        setRenameModal((prev) => ({ ...prev, saving: false }));
      }
    } catch (err) {
      setError(err.message || "Failed to rename class.");
      setRenameModal((prev) => ({ ...prev, saving: false }));
    }
  };

  // Toggle active class
  const handleToggleClassActive = async (cls, newActiveState) => {
    const action = newActiveState ? "activate" : "deactivate";
    if (!window.confirm(`Are you sure you want to ${action} ${cls.name}?`)) return;
    try {
      const res = await setClassActive(cls.name, newActiveState);
      if (res.success) {
        showNotification(`Class "${cls.name}" ${action}d.`);
        await loadData();
      } else {
        setError(res.error || `Failed to ${action} class.`);
      }
    } catch (err) {
      setError(err.message || `Failed to ${action} class.`);
    }
  };

  // Edit student
  const openEditStudentModal = (student) => {
    setEditStudentModal({
      isOpen: true,
      studentId: student.id,
      rollNo: student.rollNo || "",
      name: student.name || "",
      className: student.class || "",
      learningMode: student.learningMode || "Offline",
      saving: false,
    });
  };

  const handleSaveStudent = async (e) => {
    e.preventDefault();
    const { studentId, rollNo, name, className, learningMode } = editStudentModal;
    if (!name.trim() || !rollNo.trim()) {
      setError("Name and roll number are required.");
      return;
    }
    setEditStudentModal((prev) => ({ ...prev, saving: true }));
    setError("");
    try {
      const res = await updateStudent(studentId, {
        name: name.trim(),
        rollNo: rollNo.trim(),
        class: className,
        learningMode,
      });
      if (res.success) {
        showNotification(`Student "${name.trim()}" updated.`);
        setEditStudentModal({ isOpen: false, studentId: null, rollNo: "", name: "", className: "", learningMode: "Offline", saving: false });
        await loadData();
      } else {
        setError(res.error || "Failed to update student.");
        setEditStudentModal((prev) => ({ ...prev, saving: false }));
      }
    } catch (err) {
      setError(err.message || "Failed to update student.");
      setEditStudentModal((prev) => ({ ...prev, saving: false }));
    }
  };

  // Add student
  const openAddStudentModal = (className) => {
    const suggestions = getRollSuggestions(className, students);
    setAddStudentModal({
      isOpen: true,
      className,
      rollNo: suggestions[0] || "",
      suggestions,
      name: "",
      learningMode: "Offline",
      saving: false,
    });
  };

  const handleSaveAddStudent = async (e) => {
    e.preventDefault();
    const { className, rollNo, name, learningMode } = addStudentModal;
    if (!name.trim() || !rollNo.trim()) {
      setError("Name and roll number are required.");
      return;
    }
    setAddStudentModal((prev) => ({ ...prev, saving: true }));
    setError("");
    try {
      const res = await addStudent({
        class: className,
        rollNo: rollNo.trim(),
        name: name.trim(),
        learningMode,
      });
      if (res.success) {
        showNotification(`Student added to ${className}.`);
        setAddStudentModal({
          isOpen: false,
          className: "",
          rollNo: "",
          suggestions: [],
          name: "",
          learningMode: "Offline",
          saving: false,
        });
        await loadData();
      } else {
        setError(res.error || "Failed to add student.");
        setAddStudentModal((prev) => ({ ...prev, saving: false }));
      }
    } catch (err) {
      setError(err.message || "Failed to add student.");
      setAddStudentModal((prev) => ({ ...prev, saving: false }));
    }
  };

  // Toggle student active
  const handleToggleStudentActive = async (student, newActiveState) => {
    const action = newActiveState ? "activate" : "deactivate";
    if (!window.confirm(`Are you sure you want to ${action} ${student.name}?`)) return;
    try {
      const res = await deactivateStudent(student.id, newActiveState);
      if (res.success) {
        showNotification(`Student ${action}d.`);
        await loadData();
      } else {
        setError(res.error || `Failed to ${action} student.`);
      }
    } catch (err) {
      setError(err.message || `Failed to ${action} student.`);
    }
  };

  if (loading && classes.length === 0) return <PencilLoader />;

  const activeClasses = classes.filter((c) => c.is_active !== false);
  const inactiveClasses = classes.filter((c) => c.is_active === false);

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-28">
      {/* ── UNIFIED APP HEADER ── */}
      <AppHeader
        title="Manage Classes"
        subtitle="Roster & Students"
        showBack={true}
        onBack={() => router.push("/")}
        maxWidth="max-w-2xl sm:max-w-3xl"
        rightContent={
          <span className="text-[10px] font-bold text-teal-100 bg-white/10 px-2.5 py-1 rounded-full border border-white/15 backdrop-blur-sm">
            {activeClasses.length} Active
          </span>
        }
      />

      <div className="w-full max-w-2xl sm:max-w-3xl mx-auto px-3.5 sm:px-6 py-4 space-y-4">
        {/* Error notification */}
        {error && (
          <div className="p-3 bg-rose-50 text-rose-700 rounded-2xl text-xs font-bold border border-rose-200 flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError("")} className="p-1 text-rose-400">✕</button>
          </div>
        )}

        {/* Success notification */}
        {successMsg && (
          <div className="p-3 bg-emerald-50 text-emerald-700 rounded-2xl text-xs font-bold border border-emerald-200 flex items-center justify-between">
            <span>{successMsg}</span>
            <button onClick={() => setSuccessMsg("")} className="p-1 text-emerald-400">✕</button>
          </div>
        )}

        {/* ── ADD CLASS INPUT ── */}
        <div className="bg-white rounded-2xl p-3 border border-slate-200/80 shadow-xs">
          <form onSubmit={handleAddClass} className="flex gap-2">
            <input
              type="text"
              value={newClassName}
              onChange={(e) => setNewClassName(e.target.value)}
              placeholder="New class name (e.g. Class 10)..."
              className="flex-1 bg-slate-100/70 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
            <button
              type="submit"
              disabled={addingClass || !newClassName.trim()}
              className="px-4 py-2 rounded-xl text-xs font-black text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-all shrink-0 active:scale-95 shadow-sm shadow-blue-200"
            >
              {addingClass ? "Adding..." : "+ Add"}
            </button>
          </form>
        </div>

        {/* ── ACTIVE CLASSES ACCORDION ── */}
        <div className="space-y-2.5">
          {activeClasses.length === 0 ? (
            <div className="bg-white rounded-2xl p-6 text-center text-slate-400 font-bold text-xs border border-slate-200/80">
              No active classes found. Add your first class above.
            </div>
          ) : (
            activeClasses.map((cls) => {
              const classStudents = students.filter((s) => s.class === cls.name);
              const activeCount = classStudents.filter((s) => s.isActive).length;
              const isExpanded = !!expandedClasses[cls.name];
              const searchQ = (studentSearch[cls.name] || "").toLowerCase();
              const filteredStudents = classStudents.filter((s) => {
                if (!searchQ) return true;
                return (
                  (s.name || "").toLowerCase().includes(searchQ) ||
                  (s.rollNo || "").toLowerCase().includes(searchQ)
                );
              });

              return (
                <div
                  key={cls.name}
                  className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden transition-all"
                >
                  {/* Class Header Bar */}
                  <div className="p-3.5 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-black text-slate-900 text-sm sm:text-base truncate">
                          {cls.name}
                        </span>
                        <span className="text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-full shrink-0">
                          {activeCount} students
                        </span>
                      </div>

                      <button
                        onClick={() => toggleExpand(cls.name)}
                        className={`text-xs font-bold px-3 py-1.5 rounded-xl border transition-all flex items-center gap-1.5 shrink-0 ${
                          isExpanded
                            ? "bg-blue-600 text-white border-blue-600"
                            : "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200"
                        }`}
                      >
                        <span>{isExpanded ? "Hide" : "Students"}</span>
                        <svg
                          className={`w-3.5 h-3.5 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    </div>

                    {/* Class Action Bar */}
                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100">
                      <button
                        onClick={() => openAddStudentModal(cls.name)}
                        className="text-[11px] font-bold text-blue-600 hover:text-blue-800 transition-colors flex items-center gap-1"
                      >
                        <span>+ Add Student</span>
                      </button>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => openRenameModal(cls.name)}
                          className="text-[11px] font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-lg transition-all"
                        >
                          Rename
                        </button>
                        <button
                          onClick={() => handleToggleClassActive(cls, false)}
                          className="text-[11px] font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 px-2.5 py-1 rounded-lg transition-all"
                        >
                          Deactivate
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* ── Expanded Student Section ── */}
                  {isExpanded && (
                    <div className="bg-slate-50/80 p-3 border-t border-slate-100 space-y-2">
                      {/* Search in class */}
                      <input
                        type="text"
                        value={studentSearch[cls.name] || ""}
                        onChange={(e) =>
                          setStudentSearch((prev) => ({
                            ...prev,
                            [cls.name]: e.target.value,
                          }))
                        }
                        placeholder={`Search ${cls.name} students...`}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      />

                      {/* Student rows */}
                      <div className="space-y-1.5 max-h-72 overflow-y-auto">
                        {filteredStudents.length === 0 ? (
                          <div className="p-4 text-center text-slate-400 text-xs font-bold">
                            No students match your filter.
                          </div>
                        ) : (
                          filteredStudents.map((student) => (
                            <div
                              key={student.id}
                              className={`p-2.5 bg-white rounded-xl border border-slate-200/70 flex items-center justify-between gap-2 ${
                                !student.isActive ? "opacity-50" : ""
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                <span className="font-mono text-xs font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200 whitespace-nowrap shrink-0">
                                  {student.rollNo}
                                </span>
                                <span className="font-black text-slate-900 text-xs truncate">
                                  {student.name}
                                </span>
                                <span
                                  className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md uppercase tracking-wider shrink-0 ${
                                    student.learningMode === "Online"
                                      ? "bg-blue-50 text-blue-700"
                                      : "bg-emerald-50 text-emerald-700"
                                  }`}
                                >
                                  {student.learningMode || "Offline"}
                                </span>
                              </div>

                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  onClick={() => openEditStudentModal(student)}
                                  className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-md hover:bg-blue-100 transition-colors"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => handleToggleStudentActive(student, !student.isActive)}
                                  className={`text-[10px] font-bold px-2 py-1 rounded-md transition-colors ${
                                    student.isActive
                                      ? "text-rose-600 bg-rose-50 hover:bg-rose-100"
                                      : "text-emerald-600 bg-emerald-50 hover:bg-emerald-100"
                                  }`}
                                >
                                  {student.isActive ? "✕" : "✓"}
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* ── INACTIVE CLASSES COLLAPSIBLE (IF ANY) ── */}
        {inactiveClasses.length > 0 && (
          <div className="pt-2">
            <details className="bg-white rounded-2xl border border-slate-200/80 p-3 text-xs">
              <summary className="font-bold text-slate-500 cursor-pointer select-none">
                Inactive Classes ({inactiveClasses.length})
              </summary>
              <div className="mt-2 space-y-1.5 pt-2 border-t border-slate-100">
                {inactiveClasses.map((cls) => (
                  <div key={cls.name} className="flex items-center justify-between p-2 bg-slate-50 rounded-xl">
                    <span className="font-bold text-slate-600">{cls.name}</span>
                    <button
                      onClick={() => handleToggleClassActive(cls, true)}
                      className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg"
                    >
                      Reactivate
                    </button>
                  </div>
                ))}
              </div>
            </details>
          </div>
        )}
      </div>

      {/* ── RENAME CLASS MODAL ── */}
      {renameModal.isOpen && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in">
          <div className="bg-white w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl p-5 pb-8 sm:pb-5 shadow-2xl space-y-4">
            <h3 className="font-black text-slate-900 text-base">Rename Class</h3>
            <form onSubmit={handleSaveRename} className="space-y-3">
              <input
                type="text"
                autoFocus
                value={renameModal.newName}
                onChange={(e) => setRenameModal((prev) => ({ ...prev, newName: e.target.value }))}
                className="w-full bg-slate-100 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setRenameModal({ isOpen: false, currentName: "", newName: "", saving: false })}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={renameModal.saving || !renameModal.newName.trim()}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 shadow-sm shadow-blue-200"
                >
                  {renameModal.saving ? "Saving..." : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── EDIT STUDENT MODAL ── */}
      {editStudentModal.isOpen && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in">
          <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-5 pb-8 sm:pb-5 shadow-2xl space-y-3.5 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="font-black text-slate-900 text-base">Edit Student</h3>
              <button
                onClick={() => setEditStudentModal({ isOpen: false, studentId: null, rollNo: "", name: "", className: "", learningMode: "Offline", saving: false })}
                className="text-slate-400 p-1 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveStudent} className="space-y-3">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={editStudentModal.name}
                  onChange={(e) => setEditStudentModal((prev) => ({ ...prev, name: e.target.value }))}
                  className="w-full bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                    Roll No
                  </label>
                  <input
                    type="text"
                    value={editStudentModal.rollNo}
                    onChange={(e) => setEditStudentModal((prev) => ({ ...prev, rollNo: e.target.value }))}
                    className="w-full bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                    Class
                  </label>
                  <select
                    value={editStudentModal.className}
                    onChange={(e) => setEditStudentModal((prev) => ({ ...prev, className: e.target.value }))}
                    className="w-full bg-slate-100 border border-slate-200 rounded-xl px-2 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  >
                    {classes.map((c) => (
                      <option key={c.name} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                  Learning Mode
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {["Offline", "Online"].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setEditStudentModal((prev) => ({ ...prev, learningMode: m }))}
                      className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                        editStudentModal.learningMode === m
                          ? m === "Online"
                            ? "bg-blue-600 text-white border-blue-600"
                            : "bg-emerald-600 text-white border-emerald-600"
                          : "bg-slate-100 text-slate-700 border-slate-200"
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditStudentModal({ isOpen: false, studentId: null, rollNo: "", name: "", className: "", learningMode: "Offline", saving: false })}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editStudentModal.saving}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 shadow-sm shadow-blue-200"
                >
                  {editStudentModal.saving ? "Saving..." : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── ADD STUDENT MODAL ── */}
      {addStudentModal.isOpen && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in">
          <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-5 pb-8 sm:pb-5 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div>
                <h3 className="font-black text-slate-900 text-base">Add Student</h3>
                <p className="text-[11px] font-semibold text-slate-400">
                  Adding to <span className="text-teal-700 font-bold">{addStudentModal.className}</span>
                </p>
              </div>
              <button
                onClick={() =>
                  setAddStudentModal({
                    isOpen: false,
                    className: "",
                    rollNo: "",
                    suggestions: [],
                    name: "",
                    learningMode: "Offline",
                    saving: false,
                  })
                }
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveAddStudent} className="space-y-3.5">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                  Student Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Rahul Sharma"
                  value={addStudentModal.name}
                  onChange={(e) => setAddStudentModal((prev) => ({ ...prev, name: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
                  required
                  autoFocus
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                    Roll Number
                  </label>
                  <span className="text-[10px] font-bold text-teal-600">Auto-suggested</span>
                </div>
                <input
                  type="text"
                  placeholder="e.g. 10-030"
                  value={addStudentModal.rollNo}
                  onChange={(e) => setAddStudentModal((prev) => ({ ...prev, rollNo: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 font-mono text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
                  required
                />

                {/* Quick Select Suggestion Pills */}
                {addStudentModal.suggestions && addStudentModal.suggestions.length > 0 && (
                  <div className="mt-2 p-2.5 bg-slate-50 rounded-xl border border-slate-200/80">
                    <span className="block text-[10px] font-bold text-slate-400 mb-1.5 uppercase tracking-wider">
                      Select next number:
                    </span>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {addStudentModal.suggestions.map((sug) => {
                        const isSelected = addStudentModal.rollNo === sug;
                        return (
                          <button
                            key={sug}
                            type="button"
                            onClick={() => setAddStudentModal((prev) => ({ ...prev, rollNo: sug }))}
                            className={`font-mono text-xs font-bold px-2.5 py-1 rounded-lg border transition-all flex items-center gap-1 ${
                              isSelected
                                ? "bg-teal-600 text-white border-teal-600 shadow-sm shadow-teal-200"
                                : "bg-white text-slate-700 border-slate-200 hover:border-teal-400 hover:text-teal-700"
                            }`}
                          >
                            <span>{sug}</span>
                            {isSelected && <span className="text-[10px] font-sans font-bold">✓</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                  Learning Mode
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {["Offline", "Online"].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setAddStudentModal((prev) => ({ ...prev, learningMode: m }))}
                      className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                        addStudentModal.learningMode === m
                          ? m === "Online"
                            ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                            : "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                          : "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200"
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() =>
                    setAddStudentModal({
                      isOpen: false,
                      className: "",
                      rollNo: "",
                      suggestions: [],
                      name: "",
                      learningMode: "Offline",
                      saving: false,
                    })
                  }
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addStudentModal.saving}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 disabled:opacity-50 shadow-sm shadow-teal-200 transition-all flex items-center gap-1.5"
                >
                  {addStudentModal.saving ? "Adding..." : "+ Add Student"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
