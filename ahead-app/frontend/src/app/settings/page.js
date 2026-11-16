"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import {
  getAdminTeachers,
  createAdminTeacher,
  updateAdminTeacher,
  deleteAdminTeacher,
  updateAdminPassword,
  getGuestPortalSetting,
  updateGuestPortalSetting,
  getSubjects,
} from "@/lib/api";
import { useLoading } from "@/context/LoadingContext";
import { playSound } from "@/lib/sound";
import AppHeader from "@/components/AppHeader";
import PencilLoader from "@/components/PencilLoader";

export default function SettingsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { showLoader, hideLoader } = useLoading();

  const [teachers, setTeachers] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [guestPortalEnabled, setGuestPortalEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState(null);
  const [deletingTeacher, setDeletingTeacher] = useState(null);
  const [showPasswords, setShowPasswords] = useState({});

  // Add teacher form
  const [newTeacher, setNewTeacher] = useState({
    name: "",
    username: "",
    password: "",
    subject: "Maths",
    role: "Faculty",
  });

  // Admin password change form
  const [newAdminPass, setNewAdminPass] = useState("");
  const [savingPass, setSavingPass] = useState(false);

  // Security access: Admin only
  useEffect(() => {
    if (user && user.role !== "admin") {
      router.replace(user?.role === "Guest" || String(user?.username || "").toLowerCase() === "guest" ? "/reports" : "/");
    }
  }, [user, router]);

  const loadData = useCallback(async () => {
    setLoading(true);
    showLoader("Loading settings & faculty...");
    try {
      const [teachersRes, subjectsRes, guestRes] = await Promise.all([
        getAdminTeachers(),
        getSubjects(),
        getGuestPortalSetting().catch(() => ({ enabled: false })),
      ]);

      setTeachers(Array.isArray(teachersRes) ? teachersRes : (teachersRes?.data || []));
      setSubjects(Array.isArray(subjectsRes) ? subjectsRes : (subjectsRes?.data || []));
      setGuestPortalEnabled(Boolean(guestRes?.enabled));
    } catch (err) {
      setError("Failed to load settings data: " + err.message);
    } finally {
      setLoading(false);
      hideLoader();
    }
  }, [showLoader, hideLoader]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Flash message helper
  const notify = (msg, isErr = false) => {
    if (isErr) {
      setError(msg);
      setSuccessMsg("");
      playSound("attendanceError");
    } else {
      setSuccessMsg(msg);
      setError("");
      playSound("attendanceSuccess");
    }
    setTimeout(() => {
      setError("");
      setSuccessMsg("");
    }, 4000);
  };

  // Add Teacher
  const handleCreateTeacher = async (e) => {
    e.preventDefault();
    if (!newTeacher.name.trim() || !newTeacher.username.trim() || !newTeacher.password.trim()) {
      notify("Please fill in all required fields (Name, Username, Password).", true);
      return;
    }

    try {
      showLoader("Creating teacher account...");
      const res = await createAdminTeacher({
        name: newTeacher.name.trim(),
        username: newTeacher.username.trim().toLowerCase(),
        password: newTeacher.password.trim(),
        subject: newTeacher.subject,
        role: newTeacher.role,
        is_teacher: 1,
      });

      if (res.success) {
        notify(`Teacher "${newTeacher.name}" created successfully!`);
        setShowAddModal(false);
        setNewTeacher({ name: "", username: "", password: "", subject: "Maths", role: "Faculty" });
        await loadData();
      } else {
        notify(res.message || "Failed to create teacher.", true);
      }
    } catch (err) {
      notify("Error creating teacher: " + err.message, true);
    } finally {
      hideLoader();
    }
  };

  // Update Teacher
  const handleUpdateTeacher = async (e) => {
    e.preventDefault();
    if (!editingTeacher.name.trim() || !editingTeacher.username.trim()) {
      notify("Name and Username are required.", true);
      return;
    }

    try {
      showLoader("Saving teacher updates...");
      const payload = {
        name: editingTeacher.name.trim(),
        username: editingTeacher.username.trim().toLowerCase(),
        subject: editingTeacher.subject,
        role: editingTeacher.role,
        is_teacher: 1,
      };
      if (editingTeacher.newPassword && editingTeacher.newPassword.trim()) {
        payload.password = editingTeacher.newPassword.trim();
      }

      const res = await updateAdminTeacher(editingTeacher.id, payload);
      if (res.success) {
        notify(`Teacher "${editingTeacher.name}" updated successfully!`);
        setEditingTeacher(null);
        await loadData();
      } else {
        notify(res.message || "Failed to update teacher.", true);
      }
    } catch (err) {
      notify("Error updating teacher: " + err.message, true);
    } finally {
      hideLoader();
    }
  };

  // Delete Teacher
  const handleDeleteTeacher = async () => {
    if (!deletingTeacher) return;
    try {
      showLoader("Deleting teacher...");
      const res = await deleteAdminTeacher(deletingTeacher.id);
      if (res.success) {
        notify(`Teacher "${deletingTeacher.name}" deleted successfully.`);
        setDeletingTeacher(null);
        await loadData();
      } else {
        notify(res.message || "Failed to delete teacher.", true);
      }
    } catch (err) {
      notify("Error deleting teacher: " + err.message, true);
    } finally {
      hideLoader();
    }
  };

  // Change Admin Password
  const handleSaveAdminPassword = async (e) => {
    e.preventDefault();
    if (!newAdminPass.trim()) {
      notify("Please enter a new password.", true);
      return;
    }
    setSavingPass(true);
    try {
      showLoader("Updating admin password...");
      const res = await updateAdminPassword(newAdminPass.trim());
      if (res.success) {
        notify("Admin password changed successfully!");
        setNewAdminPass("");
      } else {
        notify(res.message || "Failed to change admin password.", true);
      }
    } catch (err) {
      notify("Error changing password: " + err.message, true);
    } finally {
      setSavingPass(false);
      hideLoader();
    }
  };

  // Toggle Guest Portal
  const handleToggleGuestPortal = async () => {
    const nextVal = !guestPortalEnabled;
    try {
      showLoader(nextVal ? "Enabling Guest Portal..." : "Disabling Guest Portal...");
      await updateGuestPortalSetting(nextVal);
      setGuestPortalEnabled(nextVal);
      notify(`Student Guest Portal is now ${nextVal ? "ENABLED" : "DISABLED"}.`);
    } catch (err) {
      notify("Failed to update guest portal setting: " + err.message, true);
    } finally {
      hideLoader();
    }
  };

  const togglePasswordVisibility = (id) => {
    setShowPasswords((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Filter teachers list
  const filteredTeachers = teachers.filter((t) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      t.name?.toLowerCase().includes(q) ||
      t.username?.toLowerCase().includes(q) ||
      t.subject?.toLowerCase().includes(q) ||
      t.role?.toLowerCase().includes(q)
    );
  });

  if (loading && teachers.length === 0) return <PencilLoader />;

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-32">
      {/* ── HEADER ── */}
      <AppHeader
        title="Settings"
        subtitle="Admin Console"
        showBack={true}
        onBack={() => router.push("/")}
      />

      <main className="max-w-md mx-auto px-4 py-4 space-y-4">
        {/* Flash Notifications */}
        {error && (
          <div className="p-3.5 bg-rose-50 text-rose-700 rounded-2xl text-xs font-bold border border-rose-200 flex items-center justify-between animate-in fade-in">
            <span>{error}</span>
            <button onClick={() => setError("")} className="p-1 text-rose-400 hover:text-rose-600">✕</button>
          </div>
        )}
        {successMsg && (
          <div className="p-3.5 bg-emerald-50 text-emerald-800 rounded-2xl text-xs font-bold border border-emerald-200 flex items-center justify-between animate-in fade-in">
            <span>{successMsg}</span>
            <button onClick={() => setSuccessMsg("")} className="p-1 text-emerald-500 hover:text-emerald-700">✕</button>
          </div>
        )}

        {/* ── SECTION 1: TEACHER MANAGEMENT ── */}
        <div className="bg-white rounded-3xl p-4 border border-slate-200 shadow-sm space-y-3.5">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-teal-700 block">
                Staff & Accounts
              </span>
              <h2 className="text-base font-black text-slate-900">
                Teacher Management
              </h2>
            </div>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black text-white bg-teal-600 hover:bg-teal-700 active:scale-95 shadow-sm shadow-teal-200 transition-all"
            >
              <span>+</span>
              <span>Add Teacher</span>
            </button>
          </div>

          {/* Search bar */}
          <div className="relative">
            <input
              type="text"
              placeholder="Search by name, username or subject..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-100/70 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                ✕
              </button>
            )}
          </div>

          {/* Teacher Roster List */}
          <div className="space-y-2 pt-1">
            {filteredTeachers.length === 0 ? (
              <div className="text-center py-6 text-xs font-bold text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                No matching teachers found.
              </div>
            ) : (
              filteredTeachers.map((t) => {
                const isAdmin = t.username?.toLowerCase() === "admin";
                const isGuest = t.username?.toLowerCase() === "guest";
                const isProtected = isAdmin || isGuest;
                const isPassVisible = showPasswords[t.id];

                return (
                  <div
                    key={t.id}
                    className="p-3 bg-slate-50/80 hover:bg-slate-100/80 rounded-2xl border border-slate-200/80 transition-all space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs shrink-0 ${
                            isAdmin
                              ? "bg-amber-100 text-amber-800 border border-amber-300"
                              : isGuest
                              ? "bg-indigo-100 text-indigo-800 border border-indigo-200"
                              : "bg-teal-100 text-teal-800 border border-teal-200"
                          }`}
                        >
                          {isAdmin ? "👑" : isGuest ? "👤" : t.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h3 className="text-xs font-black text-slate-900 truncate">
                              {t.name}
                            </h3>
                            {isAdmin && (
                              <span className="px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-amber-500 text-white shadow-2xs">
                                Admin
                              </span>
                            )}
                            {isGuest && (
                              <span className="px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-indigo-500 text-white shadow-2xs">
                                Portal
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] font-bold text-slate-500">
                            @{t.username} •{" "}
                            <span className="text-teal-700">{t.subject || "General"}</span>
                          </p>
                        </div>
                      </div>

                      {/* Action buttons */}
                      {!isProtected && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() =>
                              setEditingTeacher({
                                id: t.id,
                                name: t.name,
                                username: t.username,
                                subject: t.subject || "Maths",
                                role: t.role || "Faculty",
                                newPassword: "",
                              })
                            }
                            className="p-1.5 rounded-lg text-slate-600 hover:text-teal-700 hover:bg-teal-50 border border-slate-200 bg-white transition-all text-xs font-bold"
                            title="Edit Teacher"
                          >
                            ✏️ Edit
                          </button>
                          <button
                            onClick={() => setDeletingTeacher(t)}
                            className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 border border-rose-200 bg-white transition-all text-xs font-bold"
                            title="Delete Teacher"
                          >
                            🗑️
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Login credentials info bar */}
                    <div className="flex items-center justify-between bg-white px-2.5 py-1.5 rounded-xl border border-black/5 text-[11px]">
                      <span className="text-slate-400 font-bold">Password:</span>
                      <div className="flex items-center gap-1.5 font-mono font-bold text-slate-800">
                        <span>{isPassVisible ? t.password || "(none)" : "••••••••"}</span>
                        <button
                          type="button"
                          onClick={() => togglePasswordVisibility(t.id)}
                          className="text-slate-400 hover:text-teal-600 p-0.5"
                          title="Toggle password"
                        >
                          {isPassVisible ? "🙈" : "👁️"}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ── SECTION 2: SECURITY & ADMIN PASSWORD ── */}
        <div className="bg-white rounded-3xl p-4 border border-slate-200 shadow-sm space-y-3">
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-amber-700 block">
              Security Control
            </span>
            <h2 className="text-base font-black text-slate-900">
              Admin Password
            </h2>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Change the master password used to log in as System Administrator (<span className="font-mono text-slate-800 font-bold">admin</span>).
            </p>
          </div>

          <form onSubmit={handleSaveAdminPassword} className="space-y-2.5 pt-1">
            <input
              type="text"
              placeholder="Enter new admin password"
              value={newAdminPass}
              onChange={(e) => setNewAdminPass(e.target.value)}
              className="w-full bg-slate-100/70 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
            />
            <button
              type="submit"
              disabled={savingPass || !newAdminPass.trim()}
              className="w-full py-2.5 rounded-xl text-xs font-black text-white bg-slate-900 hover:bg-slate-800 active:scale-95 disabled:opacity-50 transition-all shadow-sm"
            >
              Update Admin Password
            </button>
          </form>
        </div>

        {/* ── SECTION 3: STUDENT GUEST PORTAL ── */}
        <div className="bg-white rounded-3xl p-4 border border-slate-200 shadow-sm flex items-center justify-between gap-3">
          <div className="min-w-0">
            <span className="text-[10px] font-black uppercase tracking-wider text-indigo-700 block">
              Public Portal
            </span>
            <h3 className="text-sm font-black text-slate-900">
              Student Guest Portal
            </h3>
            <p className="text-[11px] text-slate-500 font-medium">
              Allow students to self-check attendance via username <span className="font-mono font-bold">guest</span>.
            </p>
          </div>

          <button
            onClick={handleToggleGuestPortal}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all active:scale-95 shrink-0 border ${
              guestPortalEnabled
                ? "bg-emerald-600 text-white border-emerald-600 shadow-sm shadow-emerald-200"
                : "bg-slate-100 text-slate-600 border-slate-200 hover:border-slate-300"
            }`}
          >
            {guestPortalEnabled ? "✓ Enabled" : "Disabled"}
          </button>
        </div>
      </main>

      {/* ── ADD TEACHER MODAL ── */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
            <div
              className="p-4 text-white flex items-center justify-between"
              style={{ background: "linear-gradient(135deg, #082231 0%, #063a43 100%)" }}
            >
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-teal-300 block">
                  New Faculty
                </span>
                <h3 className="text-base font-black">Add Teacher Account</h3>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center font-bold text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateTeacher} className="p-4 space-y-3">
              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Aiyisha"
                  value={newTeacher.name}
                  onChange={(e) => setNewTeacher({ ...newTeacher, name: e.target.value })}
                  className="w-full bg-slate-100/70 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1">
                    Username *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. aiyisha"
                    value={newTeacher.username}
                    onChange={(e) =>
                      setNewTeacher({ ...newTeacher, username: e.target.value.toLowerCase().trim() })
                    }
                    className="w-full bg-slate-100/70 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1">
                    Password *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="******"
                    value={newTeacher.password}
                    onChange={(e) => setNewTeacher({ ...newTeacher, password: e.target.value })}
                    className="w-full bg-slate-100/70 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1">
                  Primary Subject
                </label>
                <select
                  value={newTeacher.subject}
                  onChange={(e) => setNewTeacher({ ...newTeacher, subject: e.target.value })}
                  className="w-full bg-slate-100/70 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                >
                  <option value="General">General (All Subjects)</option>
                  {subjects.map((s) => (
                    <option key={s.id || s.name} value={s.name}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl text-xs font-black text-white bg-teal-600 hover:bg-teal-700 shadow-md shadow-teal-200 active:scale-95 transition-all"
                >
                  Create Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── EDIT TEACHER MODAL ── */}
      {editingTeacher && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
            <div
              className="p-4 text-white flex items-center justify-between"
              style={{ background: "linear-gradient(135deg, #082231 0%, #063a43 100%)" }}
            >
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-teal-300 block">
                  Modify Account
                </span>
                <h3 className="text-base font-black">Edit Teacher</h3>
              </div>
              <button
                onClick={() => setEditingTeacher(null)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center font-bold text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateTeacher} className="p-4 space-y-3">
              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={editingTeacher.name}
                  onChange={(e) => setEditingTeacher({ ...editingTeacher, name: e.target.value })}
                  className="w-full bg-slate-100/70 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1">
                  Username *
                </label>
                <input
                  type="text"
                  required
                  value={editingTeacher.username}
                  onChange={(e) =>
                    setEditingTeacher({
                      ...editingTeacher,
                      username: e.target.value.toLowerCase().trim(),
                    })
                  }
                  className="w-full bg-slate-100/70 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1">
                  New Password (leave blank to keep current)
                </label>
                <input
                  type="text"
                  placeholder="Enter new password to reset"
                  value={editingTeacher.newPassword}
                  onChange={(e) =>
                    setEditingTeacher({ ...editingTeacher, newPassword: e.target.value })
                  }
                  className="w-full bg-slate-100/70 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1">
                  Subject
                </label>
                <select
                  value={editingTeacher.subject}
                  onChange={(e) => setEditingTeacher({ ...editingTeacher, subject: e.target.value })}
                  className="w-full bg-slate-100/70 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                >
                  <option value="General">General (All Subjects)</option>
                  {subjects.map((s) => (
                    <option key={s.id || s.name} value={s.name}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingTeacher(null)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl text-xs font-black text-white bg-teal-600 hover:bg-teal-700 shadow-md shadow-teal-200 active:scale-95 transition-all"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── DELETE TEACHER CONFIRMATION MODAL ── */}
      {deletingTeacher && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl p-5 space-y-4 animate-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center text-xl mx-auto">
              ⚠️
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-base font-black text-slate-900">
                Delete Teacher Account?
              </h3>
              <p className="text-xs text-slate-500">
                Are you sure you want to remove{" "}
                <span className="font-bold text-slate-800">
                  {deletingTeacher.name} (@{deletingTeacher.username})
                </span>
                ? They will no longer be able to log in.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingTeacher(null)}
                className="py-2.5 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteTeacher}
                className="py-2.5 rounded-xl text-xs font-black text-white bg-rose-600 hover:bg-rose-700 shadow-sm shadow-rose-200 transition-all"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
