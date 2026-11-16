"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import Image from "next/image";
import { useAuth } from "@/context/AuthContext";
import { login as loginApi, getWebAuthnLoginOptions, verifyWebAuthnLogin, searchStudents, getGuestPortalStatus } from "@/lib/api";
import { useLoading } from "@/context/LoadingContext";
import { playSound } from '@/lib/sound';
import { isWebAuthnSupported, startAuthentication } from '@/lib/webauthn';

// Guest Portal offline artwork pool — drop transparent PNGs at
// frontend/public/404/02.png ... 05.png and they join the rotation automatically.
const GUEST_PORTAL_404_IMAGES = ["/404/01.png", "/404/02.png", "/404/03.png", "/404/04.png", "/404/05.png"];
const GUEST_PORTAL_404_FALLBACK = "/404/01.png";
const GUEST_PORTAL_404_LAST_KEY = "markhins-guest-404-last";

export default function LoginPage() {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [guestName, setGuestName] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [passkeyLoading, setPasskeyLoading] = useState(false);
    const [suggestions, setSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [guestPortalDown, setGuestPortalDown] = useState(false);
    const [guestPortalMessage, setGuestPortalMessage] = useState("");
    const [portalChecking, setPortalChecking] = useState(false);
    const [hero404Src, setHero404Src] = useState(GUEST_PORTAL_404_FALLBACK);
    const hero404TriedRef = useRef([]);

    // Server connection config
    const [showServerModal, setShowServerModal] = useState(false);
    const [currentServerUrl, setCurrentServerUrl] = useState("");
    const [serverUrlInput, setServerUrlInput] = useState("");
    const [serverTestStatus, setServerTestStatus] = useState("");
    const [serverTestMsg, setServerTestMsg] = useState("");

    useEffect(() => {
        if (typeof window !== "undefined") {
            const saved = localStorage.getItem("ahead_api_url") || process.env.NEXT_PUBLIC_API_URL || "https://ahead-academy-production.up.railway.app";
            setCurrentServerUrl(saved);
            setServerUrlInput(saved);
        }
    }, []);

    const handleSaveServerUrl = async () => {
        let cleanUrl = serverUrlInput.trim().replace(/\/+$/, '');
        if (!cleanUrl) {
            localStorage.removeItem("ahead_api_url");
            setCurrentServerUrl("https://ahead-academy-production.up.railway.app");
            setShowServerModal(false);
            window.location.reload();
            return;
        }

        // Auto-prepend https:// if protocol was omitted
        if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
            cleanUrl = `https://${cleanUrl}`;
        }

        setServerTestStatus("testing");
        setServerTestMsg("Connecting to server /health endpoint...");

        try {
            const res = await fetch(`${cleanUrl}/health`, { cache: 'no-store' });
            const data = await res.json().catch(() => ({}));
            if (res.ok && data.status === 'ok') {
                localStorage.setItem("ahead_api_url", cleanUrl);
                setCurrentServerUrl(cleanUrl);
                setServerTestStatus("success");
                setServerTestMsg("Connected! Server is live and healthy.");
                setTimeout(() => {
                    setShowServerModal(false);
                    setError("");
                }, 900);
            } else {
                setServerTestStatus("error");
                setServerTestMsg(`Server reachable but responded with HTTP ${res.status}`);
            }
        } catch (err) {
            setServerTestStatus("error");
            setServerTestMsg(`Connection failed: ${err.message}. Ensure URL starts with https://`);
        }
    };

    // Rotate the offline artwork every time the 404 screen is (re)shown: random
    // pick from the files that exist, never the one from the last visit.
    const pickHero404 = useCallback(async () => {
        try {
            const checks = await Promise.all(
                GUEST_PORTAL_404_IMAGES.map((src) =>
                    fetch(src, { method: "HEAD" })
                        .then((res) => (res.ok ? src : null))
                        .catch(() => null)
                )
            );
            const available = checks.filter(Boolean);
            const pool = available.length > 0 ? available : GUEST_PORTAL_404_IMAGES;
            let last = null;
            try { last = sessionStorage.getItem(GUEST_PORTAL_404_LAST_KEY); } catch { /* private mode */ }
            const fresh = pool.filter((src) => src !== last);
            const choices = fresh.length > 0 ? fresh : pool;
            const pick = choices[Math.floor(Math.random() * choices.length)];
            try { sessionStorage.setItem(GUEST_PORTAL_404_LAST_KEY, pick); } catch { /* private mode */ }
            hero404TriedRef.current = [pick];
            setHero404Src(pick);
        } catch {
            // Keep whatever is currently showing
        }
    }, []);

    const handleHero404Error = () => {
        const tried = hero404TriedRef.current;
        const next = GUEST_PORTAL_404_IMAGES.find((src) => !tried.includes(src));
        if (next) {
            tried.push(next);
            setHero404Src(next);
        } else {
            setHero404Src((current) => (current === GUEST_PORTAL_404_FALLBACK ? current : GUEST_PORTAL_404_FALLBACK));
        }
    };

    const { login } = useAuth();
    const { showLoader, hideLoader } = useLoading();
    const nameInputRef = useRef(null);
    const wrapperRef = useRef(null);
    const searchTimeoutRef = useRef(null);

    const isGuestLogin = username.trim().toLowerCase() === "guest";

    // Pre-check the admin's Guest Portal kill-switch before even trying to sign in
    const checkGuestPortal = useCallback(async () => {
        setPortalChecking(true);
        try {
            const status = await getGuestPortalStatus();
            const down = status?.enabled === false;
            setGuestPortalDown(down);
            setGuestPortalMessage(status?.shutdownMessage || "");
            if (down) pickHero404(); // fresh artwork each time (incl. "Try Again")
            return !down;
        } catch {
            // If the status check itself fails, let the login attempt decide
            setGuestPortalDown(false);
            return true;
        } finally {
            setPortalChecking(false);
        }
    }, [pickHero404]);

    useEffect(() => {
        if (isGuestLogin) {
            checkGuestPortal();
        } else {
            setGuestPortalDown(false);
        }
    }, [isGuestLogin, checkGuestPortal]);

    const fetchSuggestions = useCallback((query) => {
        if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
        if (!query || query.trim().length < 1) {
            setSuggestions([]);
            setShowSuggestions(false);
            return;
        }
        searchTimeoutRef.current = setTimeout(async () => {
            try {
                const results = await searchStudents(query.trim());
                if (Array.isArray(results) && results.length > 0) {
                    setSuggestions(results);
                    setShowSuggestions(true);
                } else {
                    setSuggestions([]);
                    setShowSuggestions(false);
                }
            } catch {
                setSuggestions([]);
                setShowSuggestions(false);
            }
        }, 300);
    }, []);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
                setShowSuggestions(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    useEffect(() => {
        return () => {
            if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
        };
    }, []);

    const handleNameChange = (e) => {
        const value = e.target.value;
        setGuestName(value);
        fetchSuggestions(value);
    };

    const handleSelectName = (student) => {
        setGuestName(student.name);
        setShowSuggestions(false);
        setSuggestions([]);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");

        if (isGuestLogin && !guestName.trim()) {
            setError("Please enter your name to proceed with Guest Login.");
            return;
        }

        setLoading(true);
        showLoader("Verifying credentials...");

        try {
            const response = await loginApi(username, password, isGuestLogin ? guestName.trim() : "");
            if (response.token) {
                playSound('loginSuccess');
                login(response.token, response.user);
            } else {
                playSound('loginError');
                setError(response.error || response.message || "Invalid response from server");
            }
        } catch (err) {
            playSound('loginError');
            if (err?.code === 'GUEST_PORTAL_DISABLED') {
                setError("");
                setGuestPortalDown(true);
                setGuestPortalMessage(err.message || "");
                pickHero404();
            } else {
                setError(err.message || "Login failed. Please check your credentials.");
            }
        } finally {
            setLoading(false);
            hideLoader();
        }
    };

    const handlePasskeyLogin = async () => {
        setError("");
        if (!isWebAuthnSupported()) {
            setError("Your browser does not support passkeys. Please use username and password.");
            return;
        }

        setPasskeyLoading(true);
        showLoader("Waiting for biometric...");

        try {
            // Request authentication options — no username needed.
            // The browser/OS will present discoverable passkeys for this site.
            const optionsResult = await getWebAuthnLoginOptions();
            if (!optionsResult.success || !optionsResult.options) {
                throw new Error("Failed to initialize passkey authentication");
            }

            // startAuthentication triggers the native platform authenticator
            // (Android fingerprint, iOS Face ID/Touch ID, device PIN, etc.)
            const credential = await startAuthentication(optionsResult.options);

            // Send the signed credential to the server for verification
            const verifyResult = await verifyWebAuthnLogin(credential, optionsResult.loginSessionId);

            if (verifyResult.token) {
                playSound('loginSuccess');
                login(verifyResult.token, verifyResult.user);
            } else {
                playSound('loginError');
                setError(verifyResult.error || verifyResult.message || "Passkey authentication failed");
            }
        } catch (err) {
            playSound('loginError');
            if (err.name === 'NotAllowedError') {
                setError("No passkey found or authentication was cancelled. Please sign in with your password and register a passkey from your profile.");
            } else if (err.name === 'SecurityError') {
                setError("Security error. Ensure you are using HTTPS in production.");
            } else if (err.name === 'InvalidStateError') {
                setError("No passkey is registered for this site on this device. Please sign in with your password first.");
            } else {
                setError(err.message || "Passkey login failed. Try username and password instead.");
            }
        } finally {
            setPasskeyLoading(false);
            hideLoader();
        }
    };

    // ── Custom 404 screen shown when the admin has shut the Guest Portal down ──
    if (guestPortalDown) {
        return (
            <div className="flex flex-col items-center justify-center px-6 py-12 min-h-screen bg-slate-950 font-sans">
                <div className="w-full max-w-md text-center space-y-7 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <img
                        src="/logo.png"
                        alt="Ahead Academy Logo"
                        className="h-16 w-16 object-contain mx-auto drop-shadow-lg opacity-80"
                        style={{ height: '64px', width: '64px' }}
                    />

                    <div className="rounded-[2.5rem] border border-white/10 bg-white/[0.04] backdrop-blur-xl p-9 shadow-2xl space-y-6">
                        <div className="space-y-4">
                            <Image
                                src={hero404Src}
                                alt="404 — Guest Portal Offline"
                                width={1082}
                                height={1454}
                                priority
                                onError={handleHero404Error}
                                className="mx-auto h-52 sm:h-60 w-auto object-contain drop-shadow-[0_12px_40px_rgba(255,255,255,0.08)]"
                            />
                            <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-400/10 border border-amber-400/30 text-[10px] font-black uppercase tracking-widest text-amber-300">
                                <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                                Guest Portal Offline
                            </span>
                        </div>

                        <h1 className="text-xl font-black text-white tracking-tight">
                            Guest Portal is temporarily closed
                        </h1>

                        <p className="text-sm font-semibold leading-relaxed text-slate-300">
                            {guestPortalMessage ||
                                "The Guest Portal is temporarily unavailable due to administrative restrictions. Access will be restored once the necessary administrative actions have been completed. Please check back later."}
                        </p>

                        <div className="pt-2 space-y-3">
                            <button
                                type="button"
                                onClick={checkGuestPortal}
                                disabled={portalChecking}
                                className="w-full flex justify-center items-center gap-2 py-4 px-4 rounded-2xl text-sm font-black uppercase tracking-widest text-slate-950 bg-white hover:bg-slate-200 focus:outline-none focus:ring-4 focus:ring-white/30 disabled:opacity-60 transition-all active:scale-95"
                            >
                                {portalChecking ? (
                                    <>
                                        <span className="animate-spin rounded-full h-4 w-4 border-2 border-slate-950 border-t-transparent"></span>
                                        Checking...
                                    </>
                                ) : (
                                    "Try Again"
                                )}
                            </button>
                            <button
                                type="button"
                                onClick={() => setGuestPortalDown(false)}
                                className="w-full flex justify-center py-3.5 px-4 rounded-2xl text-xs font-black uppercase tracking-widest text-slate-300 border border-white/15 hover:bg-white/5 focus:outline-none focus:ring-4 focus:ring-white/10 transition-all active:scale-95"
                            >
                                Back to Sign In
                            </button>
                        </div>
                    </div>

                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-600">
                        Ahead Academy · Join Ahead and Stay Ahead
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center justify-center px-6 py-12 min-h-screen bg-gray-50/50 font-sans">
            <div className="w-full max-w-sm space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="text-center">
                    <img
                        src="/logo.png"
                        alt="Ahead Academy Logo"
                        className="h-20 w-20 object-contain mx-auto mb-4 drop-shadow-md"
                        style={{ height: '80px', width: '80px' }}
                    />
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">AHEAD ACADEMY</h1>
                    <p className="mt-1.5 text-xs sm:text-[13px] font-black tracking-widest uppercase text-teal-600">
                        JOIN AHEAD AND STAY AHEAD
                    </p>
                    <p className="mt-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Attendance Management System</p>
                </div>

                <div className="bg-white p-8 rounded-[2.5rem] shadow-2xl shadow-blue-100/20 border border-gray-100 space-y-4">
                    {error && (
                        <div className="p-4 text-xs font-bold text-red-600 bg-red-50 rounded-2xl border border-red-100 animate-shake">
                            {error}
                        </div>
                    )}

                    {/* Password Login Form */}
                    <form className="space-y-6" onSubmit={handleSubmit}>
                        <div className="space-y-5">
                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 px-1">Username</label>
                                <input
                                    type="text"
                                    required
                                    className="w-full px-6 py-4 rounded-2xl border border-gray-100 bg-gray-50 focus:ring-4 focus:ring-blue-100 focus:bg-white outline-none transition-all font-bold text-gray-700 placeholder:text-gray-200"
                                    placeholder="Your username"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                />
                            </div>

                            {isGuestLogin && (
                                <div className="space-y-2 p-3 bg-indigo-50/70 border border-indigo-100 rounded-2xl animate-in fade-in slide-in-from-top-2 duration-300">
                                    <div className="flex justify-between items-center px-1">
                                        <label className="block text-[10px] font-black text-indigo-700 uppercase tracking-widest">
                                            NAME REQUIRED <span className="text-red-500">*</span>
                                        </label>
                                        <span className="text-[9px] font-extrabold text-indigo-600 bg-white px-2 py-0.5 rounded-md border border-indigo-100 shadow-xs uppercase">
                                            MANDATORY
                                        </span>
                                    </div>
                                    <div className="relative" ref={wrapperRef}>
                                        <input
                                            type="text"
                                            required
                                            className="w-full px-4 py-3 rounded-xl border border-indigo-200 bg-white focus:ring-4 focus:ring-indigo-100 outline-none transition-all font-bold text-gray-800 text-xs placeholder:text-indigo-300"
                                            placeholder="eg : Basavaraj Rayareddy"
                                            value={guestName}
                                            onChange={handleNameChange}
                                            onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
                                            ref={nameInputRef}
                                            autoComplete="off"
                                        />
                                        {showSuggestions && suggestions.length > 0 && (
                                            <ul className="absolute z-50 w-full mt-1 bg-white border border-indigo-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                                                {suggestions.map((s) => (
                                                    <li
                                                        key={s.id}
                                                        onClick={() => handleSelectName(s)}
                                                        className="px-4 py-2.5 cursor-pointer hover:bg-indigo-50 transition-colors border-b border-indigo-50 last:border-0"
                                                    >
                                                        <span className="block text-xs font-bold text-gray-800">{s.name}</span>
                                                        <span className="block text-[10px] text-indigo-500 font-semibold">{s.class} - {s.rollNo}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>
                                </div>
                            )}

                            <div>
                                <div className="flex justify-between items-center mb-2 px-1">
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">Password</label>
                                </div>
                                <input
                                    type="password"
                                    required
                                    className="w-full px-6 py-4 rounded-2xl border border-gray-100 bg-gray-50 focus:ring-4 focus:ring-blue-100 focus:bg-white outline-none transition-all font-bold text-gray-700 placeholder:text-gray-200"
                                    placeholder="Enter your password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full flex justify-center py-5 px-4 border border-transparent rounded-2xl shadow-xl shadow-blue-100 text-sm font-black uppercase tracking-widest text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-100 disabled:opacity-50 transition-all active:scale-95"
                        >
                            {loading ? "Verifying..." : "Sign In"}
                        </button>
                    </form>

                    {/* Divider */}
                    <div className="relative my-2">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-gray-100"></div>
                        </div>
                        <div className="relative flex justify-center text-[10px]">
                            <span className="bg-white px-3 font-black text-gray-300 uppercase tracking-widest">or</span>
                        </div>
                    </div>

                    {/* Passkey Login — completely independent of username/password */}
                    <button
                        type="button"
                        disabled={passkeyLoading || loading}
                        onClick={handlePasskeyLogin}
                        className="w-full flex justify-center items-center gap-2 py-4 px-4 border border-gray-200 rounded-2xl text-sm font-bold text-gray-700 bg-gray-50 hover:bg-gray-100 hover:border-gray-300 focus:outline-none focus:ring-4 focus:ring-gray-100 disabled:opacity-50 transition-all active:scale-95"
                    >
                        {passkeyLoading ? (
                            <>
                                <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-300 border-t-gray-600"></div>
                                Verifying...
                            </>
                        ) : (
                            <>
                                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M12 10v4M7.5 21a7.5 7.5 0 0 1 0-15c2.5 0 4.5 1.5 5.5 3.5M15 10.5c0 0 1.5 1 2.5 1a3.5 3.5 0 0 0 0-7c-1 0-2.5.5-3.5 2" />
                                    <rect x="5" y="2" width="14" height="20" rx="7" />
                                    <circle cx="12" cy="15" r="3" fill="currentColor" opacity="0.3" />
                                </svg>
                                Login with Passkey
                            </>
                        )}
                    </button>
                </div>

                <p className="text-center text-[10px] font-black uppercase tracking-widest text-slate-400 pt-1">
                    Ahead Academy · Join Ahead and Stay Ahead
                </p>

                {/* Server Connection Indicator & Direct Config */}
                <div className="pt-2 text-center">
                    <button
                        type="button"
                        onClick={() => setShowServerModal(true)}
                        className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-400 hover:text-teal-600 transition-colors"
                    >
                        <span>⚙️ Server: <span className="text-slate-600 underline font-mono">{currentServerUrl || 'Auto / Default'}</span></span>
                    </button>
                </div>

                {/* Server URL Config Modal */}
                {showServerModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in">
                        <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-[#082231] p-6 text-white shadow-2xl">
                            <div className="flex items-center justify-between pb-3 border-b border-white/10">
                                <h3 className="text-sm font-black tracking-wide text-white">
                                    Backend Server Connection
                                </h3>
                                <button
                                    onClick={() => {
                                        setShowServerModal(false);
                                        setServerTestStatus("");
                                    }}
                                    className="text-slate-400 hover:text-white"
                                >
                                    ✕
                                </button>
                            </div>

                            <p className="text-xs text-slate-300 mt-3 leading-relaxed">
                                Enter your live Railway Backend URL so the app connects directly to your database:
                            </p>

                            <div className="my-4 space-y-2">
                                <input
                                    type="text"
                                    placeholder="https://ahead-academy-production.up.railway.app"
                                    value={serverUrlInput}
                                    onChange={(e) => setServerUrlInput(e.target.value)}
                                    className="w-full rounded-xl border border-white/20 bg-white/10 px-3.5 py-2.5 text-xs font-mono text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-400"
                                />
                                {serverTestMsg && (
                                    <p className={`text-[11px] font-medium leading-snug ${
                                        serverTestStatus === 'success' ? 'text-emerald-400' :
                                        serverTestStatus === 'error' ? 'text-rose-400' : 'text-amber-300 animate-pulse'
                                    }`}>
                                        {serverTestMsg}
                                    </p>
                                )}
                            </div>

                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    disabled={serverTestStatus === 'testing'}
                                    onClick={handleSaveServerUrl}
                                    className="flex-1 rounded-xl bg-teal-500 py-2.5 text-xs font-bold text-white shadow-md hover:bg-teal-400 disabled:opacity-50"
                                >
                                    {serverTestStatus === 'testing' ? 'Testing...' : 'Test & Connect'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        localStorage.removeItem("ahead_api_url");
                                        setCurrentServerUrl("");
                                        setServerUrlInput("");
                                        setShowServerModal(false);
                                        window.location.reload();
                                    }}
                                    className="rounded-xl border border-white/20 px-3 py-2.5 text-xs font-bold text-slate-300 hover:bg-white/10"
                                >
                                    Reset
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
