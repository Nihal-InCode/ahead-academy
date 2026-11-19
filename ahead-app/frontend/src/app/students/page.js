"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import {
  getStudents,
  addStudent,
  updateStudent,
  deactivateStudent,
  getClasses,
} from "@/lib/api";
import { useLoading } from "@/context/LoadingContext";
import AppHeader from "@/components/AppHeader";
import PencilLoader from "@/components/PencilLoader";

const LEARNING_MODES = ["Offline", "Online"];

export default function StudentsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { showLoader, hideLoader } = useLoading();

  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [search, setSearch] = useState("");

  // Add student form
  const [adding, setAdding] = useState(false);
  const [newStudent, setNewStudent] = useState({
    rollNo: "",
    name: "",
    class: "",
    learningMode: "Offline",
  });

  // Edit student form (inline)
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({});

  const loadStudents = useCallback(async () => {
    setLoading(true);
    try {
      showLoader("Loading students...");
      const res = await getStudents(null, null, null, "1");
      setStudents(Array.isArray(res) ? res : []);
    } catch (err) {
      setError("Failed to load students.");
      console.error(err);
    } finally {
      setLoading(false);
      hideLoader();
    }
  }, [showLoader, hideLoader]);

  const loadClasses = async () => {
    try {
      const res = await getClasses();
      setClasses(Array.isArray(res) ? res : []);
    } catch (err) {
      console.error("Failed to load classes:", err);
    }
  };

  useEffect(() => {
    loadStudents();
    loadClasses();
  }, [loadStudents]);

  const filtered = students.filter((s) => {
    if (classFilter && s.class !== classFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        (s.name || "").toLowerCase().includes(q) ||
        (s.rollNo || "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleAddStudent = async (e) => {
    e.preventDefault();
    const { rollNo, name, class: sclass, learningMode } = newStudent;
    if (!rollNo || !name || !sclass) {
      setError("Roll number, name and class are required.");
      return;
    }
    setAdding(true);
    setError("");
    try {
      const res = await addStudent({
        rollNo,
        name,
        class: sclass,
        learningMode,
      });
      if (res.success) {
        setNewStudent({ rollNo: "", name: "", class: "", learningMode: "Offline" });
        await loadStudents();
      } else {
        setError(res.error || "Failed to add student.");
      }
    } catch (err) {
      setError(err.message || "Failed to add student.");
    } finally {
      setAdding(false);
    }
  };

  const openEdit = (s) => {
    setEditData({
      id: s.id,
      name: s.name || "",
      class: s.class || "",
      learningMode: s.learningMode || "Offline",
      rollNo: s.rollNo || "",
    });
    setEditingId(s.id);
  };

  const handleUpdateStudent = async () => {
    setError("");
    try {
      const res = await updateStudent(editingId, {
        name: editData.name,
        rollNo: editData.rollNo,
        class: editData.class,
        learningMode: editData.learningMode,
      });
      if (res.success) {
        setEditingId(null);
        await loadStudents();
      } else {
        setError(res.error || "Failed to update student.");
      }
    } catch (err) {
      setError(err.message || "Failed to update student.");
    }
  };

  const handleToggleActive = async (s) => {
    try {
      const res = await deactivateStudent(s.id, !s.isActive);
      if (res.success) {
        await loadStudents();
      } else {
        setError(res.error || "Failed to update student.");
      }
    } catch (err) {
      setError(err.message || "Failed to update student.");
    }
  };

  if (loading && students.length === 0) return <PencilLoader />;

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-28">
      {/* ── UNIFIED APP HEADER ── */}
      <AppHeader
        title="Student Directory"
        subtitle="All Academy Students"
        showBack={true}
        onBack={() => router.push("/")}
        maxWidth="max-w-2xl sm:max-w-3xl"
        rightContent={
          <span className="text-[10px] font-bold text-teal-100 bg-white/10 px-2.5 py-1 rounded-full border border-white/15 backdrop-blur-sm">
            {students.length} Total
          </span>
        }
      />

      <div className="w-full max-w-2xl sm:max-w-3xl mx-auto px-3.5 sm:px-6 py-4 space-y-4">
        {error && (
          <div className="p-3 bg-rose-50 text-rose-700 rounded-2xl text-xs font-bold border border-rose-200 flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError("")} className="p-1 text-rose-400">✕</button>
          </div>
        )}

        {/* ── FILTERS ── */}
        <div className="bg-white rounded-2xl p-3 border border-slate-200/80 shadow-xs flex items-center gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search student or roll no..."
            className="flex-1 bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-none"
          />
          <select
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
            className="bg-slate-100 border border-slate-200 rounded-xl px-2.5 py-2 text-xs font-black text-slate-800 focus:outline-none w-28 shrink-0"
          >
            <option value="">All Classes</option>
            {classes.map((c) => (
              <option key={c.name} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {/* ── ADD STUDENT ACCORDION / BOX ── */}
        <details className="bg-white rounded-2xl border border-slate-200/80 p-3 shadow-xs">
          <summary className="text-xs font-black text-blue-600 cursor-pointer select-none">
            + Quick Add Student
          </summary>
          <form onSubmit={handleAddStudent} className="space-y-2.5 pt-3 border-t border-slate-100 mt-2">
            <input
              value={newStudent.name}
              onChange={(e) => setNewStudent({ ...newStudent, name: e.target.value })}
              placeholder="Student full name"
              className="w-full bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                value={newStudent.rollNo}
                onChange={(e) => setNewStudent({ ...newStudent, rollNo: e.target.value })}
                placeholder="Roll No (e.g. 10-045)"
                className="w-full bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none"
              />
              <select
                value={newStudent.class}
                onChange={(e) => setNewStudent({ ...newStudent, class: e.target.value })}
                className="w-full bg-slate-100 border border-slate-200 rounded-xl px-2 py-2 text-xs font-bold text-slate-800 focus:outline-none"
              >
                <option value="">Class</option>
                {classes.filter((c) => c.is_active !== false).map((c) => (
                  <option key={c.name} value={c.name}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {LEARNING_MODES.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setNewStudent({ ...newStudent, learningMode: m })}
                  className={`py-1.5 rounded-xl text-xs font-bold border transition-all ${
                    newStudent.learningMode === m
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-slate-100 text-slate-700 border-slate-200"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
            <button
              disabled={adding}
              className="w-full py-2.5 rounded-xl font-black text-xs text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-all shadow-sm shadow-blue-200"
            >
              {adding ? "Adding..." : "Add to Academy"}
            </button>
          </form>
        </details>

        {/* ── STUDENT ROSTER ── */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden divide-y divide-slate-100">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-slate-400 font-bold text-xs">
              No students found.
            </div>
          ) : (
            filtered.map((s) => {
              const isEditing = editingId === s.id;
              return (
                <div
                  key={s.id}
                  className={`p-3 flex items-center justify-between gap-2.5 ${
                    !s.isActive ? "opacity-50" : ""
                  }`}
                >
                  {isEditing ? (
                    <div className="flex-1 space-y-2">
                      <input
                        value={editData.name}
                        onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                        className="w-full bg-slate-100 border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={handleUpdateStudent}
                          className="px-3 py-1 rounded-lg text-xs font-bold bg-blue-600 text-white"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="px-3 py-1 rounded-lg text-xs font-bold text-slate-600 bg-slate-100"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <span className="font-mono text-xs font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200 whitespace-nowrap shrink-0">
                          {s.rollNo}
                        </span>
                        <div className="min-w-0">
                          <p className="font-black text-slate-900 text-xs sm:text-sm truncate">
                            {s.name}
                          </p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[10px] font-bold text-slate-400">{s.class}</span>
                            <span>•</span>
                            <span className="text-[10px] font-bold text-blue-600">{s.learningMode}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => openEdit(s)}
                          className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg hover:bg-blue-100"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleToggleActive(s)}
                          className={`text-[10px] font-bold px-2 py-1 rounded-lg ${
                            s.isActive
                              ? "text-rose-600 bg-rose-50 hover:bg-rose-100"
                              : "text-emerald-600 bg-emerald-50 hover:bg-emerald-100"
                          }`}
                        >
                          {s.isActive ? "✕" : "✓"}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
