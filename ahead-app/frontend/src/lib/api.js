import { playSound } from '@/lib/sound';

export function getBaseUrl() {
    // 1. User manual override (saved via Login screen settings)
    if (typeof window !== 'undefined') {
        let customUrl = localStorage.getItem('ahead_api_url');
        if (customUrl && customUrl.trim()) {
            customUrl = customUrl.trim().replace(/\/+$/, '');
            if (!customUrl.startsWith('http://') && !customUrl.startsWith('https://')) {
                customUrl = `https://${customUrl}`;
            }
            return customUrl;
        }
    }

    // 2. Build-time environment variable
    if (process.env.NEXT_PUBLIC_API_URL) {
        let envUrl = process.env.NEXT_PUBLIC_API_URL.trim().replace(/\/+$/, '');
        if (!envUrl.startsWith('http://') && !envUrl.startsWith('https://')) {
            envUrl = `https://${envUrl}`;
        }
        return envUrl;
    }

    // 3. Fallbacks
    if (typeof window !== 'undefined') {
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            return 'http://localhost:8080';
        }
        // Direct production fallback to the deployed Railway backend URL
        return 'https://ahead-academy-production.up.railway.app';
    }
    return 'https://ahead-academy-production.up.railway.app';
}

const BASE_URL = process.env.NEXT_PUBLIC_API_URL;


/**
 * Generic API request handler with error handling and debug logging.
 */
export async function apiRequest(endpoint, options = {}) {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

    const headers = {
        'Content-Type': 'application/json',
        ...options.headers,
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const baseUrl = getBaseUrl();

    // Debug Logging
    if (process.env.NODE_ENV !== 'production') {
        console.log(`[API Request] ${options.method || 'GET'} ${baseUrl}${endpoint}`);
    }

    try {
        const response = await fetch(`${baseUrl}${endpoint}`, {
            cache: 'no-store',
            ...options,
            headers,
        });

        // Handle 401 Unauthorized (Expired or Invalid Token)
        if (response.status === 401) {
            if (typeof window !== 'undefined') {
                localStorage.removeItem('token');
                if (window.location.pathname !== '/login') {
                    window.location.href = '/login?error=Session expired. Please login again.';
                }
            }
            throw new Error('Unauthorized. Please login again.');
        }

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const targetUrl = `${baseUrl}${endpoint}`;
            const errorMsg = errorData.message || errorData.error || `HTTP ${response.status} (${response.statusText || 'Not Found'}) from ${targetUrl}`;
            console.error(`[API Error Response]`, { status: response.status, endpoint, targetUrl, errorData });
            const err = new Error(errorMsg);
            if (errorData.code) err.code = errorData.code; // e.g. GUEST_PORTAL_DISABLED -> custom 404 screen
            throw err;
        }

        const data = await response.json();

        // If response contains a token, return the whole object (important for login)
        if (data.token) return data;

        // Otherwise return .data if available, fallback to whole object
        return data.data !== undefined ? data.data : data;
    } catch (error) {
        // Handle Network Errors
        playSound('error');
        if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
            console.error(`[API Network Error] ${endpoint}: Could not connect to ${baseUrl}`);
            throw new Error(`Network error. Ensure you are on the same WiFi as the server (${baseUrl}) or the server is running.`);
        }
        throw error;
    }
}

/**
 * Auth Endpoints
 */
export const login = (username, password, guest_name = '') =>
    apiRequest('/login', {
        method: 'POST',
        body: JSON.stringify({ username, password, guest_name }),
    });

export const searchStudents = (query) =>
    apiRequest(`/search-students?q=${encodeURIComponent(query)}`);

export const getGuestSessions = () => apiRequest('/admin/guest-sessions');
export const revokeGuestSession = (id) => apiRequest(`/admin/guest-sessions/${id}`, { method: 'DELETE' });
export const clearGuestSessions = () => apiRequest('/admin/guest-sessions', { method: 'DELETE' });
export const logoutAllGuestSessions = () => apiRequest('/admin/guest-sessions', { method: 'DELETE' });

// ── Guest Portal Kill-Switch ──
export const getGuestPortalStatus = () => apiRequest('/guest-portal-status');
export const getGuestPortalSetting = () => apiRequest('/admin/guest-portal-setting');
export const updateGuestPortalSetting = (enabled) =>
    apiRequest('/admin/guest-portal-setting', {
        method: 'POST',
        body: JSON.stringify({ enabled }),
    });
export const logoutApi = () => apiRequest('/logout', { method: 'POST' });

/**
 * Validate Token Endpoint (Check if still valid on app load)
 */
export const validateToken = () => apiRequest('/validate-token');

// ── WebAuthn / Passkey API Endpoints ──

export const getWebAuthnRegisterOptions = (deviceName) =>
    apiRequest('/webauthn/register/options', {
        method: 'POST',
        body: JSON.stringify({ deviceName }),
    });

export const verifyWebAuthnRegister = (credential, deviceName) =>
    apiRequest('/webauthn/register/verify', {
        method: 'POST',
        body: JSON.stringify({ credential, deviceName }),
    });

export const getWebAuthnLoginOptions = () =>
    apiRequest('/webauthn/login/options', {
        method: 'POST',
        body: JSON.stringify({}),
    });

export const verifyWebAuthnLogin = (credential, loginSessionId) =>
    apiRequest('/webauthn/login/verify', {
        method: 'POST',
        body: JSON.stringify({ credential, loginSessionId }),
    });

export const getWebAuthnCredentials = () => apiRequest('/webauthn/credentials');

export const deleteWebAuthnCredential = (credentialId) =>
    apiRequest(`/webauthn/credentials/${credentialId}`, {
        method: 'DELETE',
    });

export const resolvePeriod = (classId, period, date) =>
    apiRequest(`/resolve-period?class=${classId}&period=${period}&date=${date || ''}`);

/**
 * Dashboard & Students Endpoints
 */
export const getClasses = async () => {
    const res = await apiRequest('/classes');
    if (res && Array.isArray(res.data)) return res.data;
    if (Array.isArray(res)) return res;
    return [];
};

export const getSubjects = async (classId) => {
    const params = new URLSearchParams();
    if (classId) params.set("classId", classId);
    const query = params.toString();
    const res = await apiRequest(`/subjects${query ? `?${query}` : ''}`);
    if (res && Array.isArray(res.data)) return res.data;
    if (Array.isArray(res)) return res;
    return [];
};

export const getStudents = async (classId, subjectId, date, include_inactive) => {
    const params = new URLSearchParams();
    if (classId) params.set("classId", classId);
    if (subjectId) params.set("subjectId", subjectId);
    if (date) params.set("date", date);
    if (include_inactive) params.set("include_inactive", include_inactive);
    const res = await apiRequest(`/students?${params.toString()}`);
    if (res && Array.isArray(res.data)) return res.data;
    if (Array.isArray(res)) return res;
    return [];
};

/**
 * Student Management (Ahead Academy)
 */
export const addStudent = (data) =>
    apiRequest('/students', {
        method: 'POST',
        body: JSON.stringify(data),
    });

export const updateStudent = (id, data) =>
    apiRequest(`/students/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
    });

export const deactivateStudent = (id, isActive) =>
    apiRequest(`/students/${id}/deactivate`, {
        method: 'POST',
        body: JSON.stringify({ isActive }),
    });

/**
 * Class Management (Ahead Academy)
 */
export const addClass = (data) =>
    apiRequest('/classes', {
        method: 'POST',
        body: JSON.stringify(data),
    });

export const editClass = (name, data) =>
    apiRequest(`/classes/${encodeURIComponent(name)}`, {
        method: 'PUT',
        body: JSON.stringify(data),
    });

export const setClassActive = (name, isActive) =>
    apiRequest(`/classes/${encodeURIComponent(name)}/deactivate`, {
        method: 'POST',
        body: JSON.stringify({ isActive }),
    });

/**
 * Subject Management (Ahead Academy)
 */
export const addSubject = (data) =>
    apiRequest('/subjects', {
        method: 'POST',
        body: JSON.stringify(data),
    });

export const setSubjectActive = (name, isActive) =>
    apiRequest(`/subjects/${encodeURIComponent(name)}/deactivate`, {
        method: 'POST',
        body: JSON.stringify({ isActive }),
    });

/**
 * Student-Subject assignment
 */
export const getStudentSubjects = (id) =>
    apiRequest(`/students/${id}/subjects`);

export const assignStudentSubjects = (id, subjectIds) =>
    apiRequest(`/students/${id}/subjects`, {
        method: 'POST',
        body: JSON.stringify({ subjectIds }),
    });

/**
 * Advanced Features
 */
export const getTimetable = (classId) => apiRequest(`/timetable/${classId}`);

export const getFullTimetable = (weekday, date) => apiRequest(`/full-timetable/${weekday}?date=${date || ''}`);

export const getStudentHistory = (rollNo) => apiRequest(`/student-history/${rollNo}`);

export const getDailyReport = async (date) => {
    const res = await apiRequest(`/daily-report?date=${date}`);
    if (res && Array.isArray(res.data)) return res.data;
    if (Array.isArray(res)) return res;
    return [];
};

export const getBatchReport = (classId, range = null, subject = null) => {
    const params = new URLSearchParams();
    if (range?.from) params.set('from', range.from);
    if (range?.to) params.set('to', range.to);
    if (subject && subject !== 'All' && subject !== 'all') params.set('subject', subject);
    const query = params.toString();
    return apiRequest(`/batch-report/${encodeURIComponent(classId)}${query ? `?${query}` : ''}`);
};

export const getClassAverages = () => apiRequest('/class-averages');

export const getWeeklyReport = () => apiRequest('/weekly-report');

export const getSickLeaveOverview = () => apiRequest('/sick-leave-overview');

export const getPeriodSummary = (classId, period, date) =>
    apiRequest(`/period-summary?class=${classId}&period=${period}&date=${date}`);

/**
 * Attendance Submission
 */
export const markAttendance = (data) =>
    apiRequest('/mark-attendance', {
        method: 'POST',
        body: JSON.stringify(data),
    });

export const getLastAttendance = () =>
    apiRequest('/attendance/last');

export const getMarkedPeriods = (className, date) =>
    apiRequest(`/attendance/marked-periods?class=${className}&date=${date || ''}`);

export const editLastAttendance = (records, { classId, period, date } = {}) =>
    apiRequest('/attendance/edit-last', {
        method: 'PUT',
        body: JSON.stringify({ records, classId, period, date }),
    });

export const deleteLastAttendance = ({ classId, period, date } = {}) =>
    apiRequest('/attendance/delete-last', {
        method: 'POST',
        body: JSON.stringify({ classId, period, date }),
    });


/**
 * Study Leave Attendance
 */
export const getStudyLeaveSetting = () => apiRequest('/admin/study-leave-setting');

export const updateStudyLeaveSetting = (enabled, powers) =>
    apiRequest('/admin/study-leave-setting', {
        method: 'POST',
        body: JSON.stringify({ enabled, powers }),
    });

export const getStudyLeavePlatforms = () => apiRequest('/admin/study-leave-platforms');

export const saveStudyLeavePlatforms = (platforms) =>
    apiRequest('/admin/study-leave-platforms', {
        method: 'POST',
        body: JSON.stringify({ platforms }),
    });

export const getStudyLeaveHistory = (filters = {}) =>
    apiRequest('/admin/study-leave-history', {
        method: 'POST',
        body: JSON.stringify(filters),
    });

export const markStudyLeaveAttendance = (data) =>
    apiRequest('/study-leave/mark', {
        method: 'POST',
        body: JSON.stringify(data),
    });

export const getStudyLeaveStatus = (session, date, classes) =>
    apiRequest('/study-leave/status', {
        method: 'POST',
        body: JSON.stringify({ session, date, classes }),
    });

export const editStudyLeaveAttendance = (session, date, className, students) =>
    apiRequest('/study-leave/edit', {
        method: 'POST',
        body: JSON.stringify({ session, date, class: className, students }),
    });

export const deleteStudyLeaveAttendance = (session, date, className) =>
    apiRequest('/study-leave/delete', {
        method: 'POST',
        body: JSON.stringify({ session, date, class: className }),
    });

export const getLastStudyLeave = () => apiRequest('/study-leave/last');

export const getStudyLeaveDayHistory = (date) =>
    apiRequest('/study-leave/day-history', {
        method: 'POST',
        body: JSON.stringify({ date }),
    });


/**
 * Extra Class Attendance
 */
export const getExtraSubjects = () => apiRequest('/extra-subjects');
export const getSubjectsByClass = (classId) => apiRequest(`/extra-subjects?classId=${classId}`);
export async function getTeacherRegisterReport(params = {}) {
    const { classId, teacherId, fromDate, toDate } = params;
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    const baseUrl = getBaseUrl();
    const response = await fetch(
        `${baseUrl}/teacher-register-report?classId=${classId}&teacherId=${teacherId}&fromDate=${fromDate || ''}&toDate=${toDate || ''}`,
        {
            method: 'GET',
            headers: {
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            cache: 'no-store',
        }
    );

    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.success) {
        throw new Error(data.message || `Error ${response.status}: ${response.statusText}`);
    }
    return data;
}

export const getExtraClassesReport = (params = {}) => {
    const { date, teacherId, classId } = params;
    let url = '/extra-classes-report?';
    if (date) url += `date=${date}&`;
    if (teacherId) url += `teacherId=${teacherId}&`;
    if (classId) url += `classId=${classId}&`;
    return apiRequest(url);
};

export const getNamazAnalytics = (params = {}) => {
    const search = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
        if (value) search.set(key, value);
    });
    return apiRequest(`/namaz-analytics?${search.toString()}`);
};

export const getNamazApiMonitor = () => apiRequest('/admin/namaz-api-monitor');
export const updateNamazStatus = (data) => apiRequest('/admin/update-namaz-status', {
    method: 'POST',
    body: JSON.stringify(data),
});
export const getEventAttendance = () => apiRequest('/event-attendance');

export const getPermissionStudents = (forHistory = false) => apiRequest(`/api/permissions/students${forHistory ? '?for_history=1' : ''}`);
export const getPermissionSummary = () => apiRequest('/api/permissions/summary');
export const createPermission = (data) => apiRequest('/api/permissions', {
    method: 'POST',
    body: JSON.stringify(data),
});
export const getPermissions = (view = 'history', filters = {}) => {
    const search = new URLSearchParams({ view });
    Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') search.set(key, value);
    });
    return apiRequest(`/api/permissions?${search.toString()}`);
};
export const approvePermission = (id) => apiRequest(`/api/permissions/${id}/approve`, {
    method: 'POST',
});
export const rejectPermission = (id) => apiRequest(`/api/permissions/${id}/reject`, {
    method: 'DELETE',
});
export const approveTeacherReturn = (id) => apiRequest(`/api/permissions/${id}/return/teacher`, {
    method: 'POST',
});
export const approvePrincipalReturn = (id) => apiRequest(`/api/permissions/${id}/return/principal`, {
    method: 'POST',
});
export const rejectPrincipalReturn = (id) => apiRequest(`/api/permissions/${id}/return/principal`, {
    method: 'DELETE',
});

export const markExtraAttendance = (data) =>
    apiRequest('/attendance/extra', {
        method: 'POST',
        body: JSON.stringify(data),
    });

export const markHealthStatus = (type, rollNos, classId) =>
    apiRequest(`/health/${type}`, {
        method: 'POST',
        body: JSON.stringify({ rollNos, classId }),
    });

export const getSickList = () => apiRequest('/health/sick-list');
export const getLeaveList = () => apiRequest('/health/leave-list');

export const getMyProfile = () => apiRequest('/profile/me');
export const getTeachingStats = () => apiRequest('/profile/teaching-stats');
export const getSyllabusConfigs = (params = {}) => {
    const search = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
        if (v) search.set(k, v);
    });
    return apiRequest(`/api/syllabus?${search.toString()}`);
};
export const saveSyllabusConfig = (data) => apiRequest('/api/syllabus/config', {
    method: 'POST',
    body: JSON.stringify(data)
});
export const updateSyllabusProgress = (data) => apiRequest('/api/syllabus/progress', {
    method: 'POST',
    body: JSON.stringify(data)
});
export const deleteSyllabusConfig = (id) => apiRequest(`/api/syllabus/config/${id}`, {
    method: 'DELETE'
});
export const updateCredentials = (data) => apiRequest('/profile/update-credentials', {
    method: 'POST',
    body: JSON.stringify(data)
});
export const getAnnouncementStatus = (announcementKey) => apiRequest(`/announcements/${announcementKey}`);
export const getPendingAnnouncement = () => apiRequest('/announcements/pending/current');
export const dismissAnnouncement = (announcementKey) => apiRequest(`/announcements/${announcementKey}/dismiss`, {
    method: 'POST',
});
export const getTeachersList = (params = {}) => {
    const includeAll = params?.include_all ? '?include_all=true' : '';
    return apiRequest(`/teachers${includeAll}`);
};

export const getAdminAnnouncements = () => apiRequest('/admin/announcements');
export const revokeAllAnnouncements = () => apiRequest('/admin/announcements/revoke-all', {
    method: 'POST',
});
export const createAdminAnnouncement = (data) => apiRequest('/admin/announcements', {
    method: 'POST',
    body: JSON.stringify(data),
});
export const updateAdminAnnouncement = (announcementId, data) => apiRequest(`/admin/announcements/${announcementId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
});
export const deleteAdminAnnouncement = (announcementId) => apiRequest(`/admin/announcements/${announcementId}`, {
    method: 'DELETE',
});
export const getAnnouncementViewers = (announcementKey) => apiRequest(`/admin/announcements/${announcementKey}/viewers`);
export const getAdminTeachers = async () => {
    const res = await apiRequest('/admin/teachers');
    if (res && Array.isArray(res.data)) return res.data;
    if (Array.isArray(res)) return res;
    return [];
};
export const createAdminTeacher = (data) => apiRequest('/admin/teachers', {
    method: 'POST',
    body: JSON.stringify(data),
});
export const updateAdminTeacher = (teacherId, data) => apiRequest(`/admin/teachers/${teacherId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
});
export const deleteAdminTeacher = (teacherId) => apiRequest(`/admin/teachers/${teacherId}`, {
    method: 'DELETE',
});
export const updateAdminPassword = (password) => apiRequest('/admin/update-password', {
    method: 'POST',
    body: JSON.stringify({ password }),
});
export async function uploadTeacherPhoto(teacherId, file, token) {
    const formData = new FormData();
    formData.append('file', file);
    const authToken = token || (typeof window !== 'undefined' ? localStorage.getItem('token') : null);

    const baseUrl = getBaseUrl();
    const response = await fetch(`${baseUrl}/admin/teachers/${teacherId}/photo`, {
        method: 'POST',
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
        body: formData,
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.success) {
        throw new Error(data.message || `Error ${response.status}: ${response.statusText}`);
    }
    return data;
}

export const deleteTeacherPhoto = (teacherId) => apiRequest(`/admin/teachers/${teacherId}/photo`, {
    method: 'DELETE',
});
export const getAdminTimetable = (weekday) => apiRequest(`/admin/timetable/${weekday}`);
export const getTeacherSubjectOptions = (teacherId) => apiRequest(`/admin/teacher-subjects/${teacherId}`);
export const updateTimetablePeriod = (data) => apiRequest('/admin/timetable/period', {
    method: 'PUT',
    body: JSON.stringify(data),
});
export const getAdminActivityLog = (date) => apiRequest(`/admin/activity-log?date=${date}`);

let _lastHeartbeat = 0;
let _activityTrackerStarted = false;
const HEARTBEAT_INTERVAL = 5 * 1000;

function sendPing(action, meta) {
    try {
        const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
        if (!token) return;
        const baseUrl = getBaseUrl();
        fetch(`${baseUrl}/api/track-event`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ action, meta }),
        }).catch(() => {});
    } catch (_) {}
}

export function trackEvent(action, meta = '') {
    sendPing(action, meta);
}

export function startActivityTracker() {
    if (typeof window === 'undefined' || _activityTrackerStarted) return;
    _activityTrackerStarted = true;
    const fire = () => {
        if (document.visibilityState !== 'visible') return;
        const now = Date.now();
        if (now - _lastHeartbeat < HEARTBEAT_INTERVAL) return;
        _lastHeartbeat = now;
        sendPing('Active in app');
    };
    ['click', 'touchstart', 'keydown', 'scroll', 'focus'].forEach(evt => {
        window.addEventListener(evt, fire, { passive: true });
    });
    fire();
    window.setInterval(fire, HEARTBEAT_INTERVAL);
}

// ── Manual Substitute System API helpers ──
export const getSubstituteCoordinators = () => apiRequest('/api/substitute/coordinators');
export const saveSubstituteCoordinators = (coordinators) => apiRequest('/api/substitute/coordinators', {
    method: 'POST',
    body: JSON.stringify({ coordinators }),
});

// ── Timetable Editors API helpers ──
export const getTimetableEditors = () => apiRequest('/api/timetable/editors');
export const saveTimetableEditors = (editors) => apiRequest('/api/timetable/editors', {
    method: 'POST',
    body: JSON.stringify({ editors }),
});

export const getSubstitutePlannerData = (date, leavesOrIds, notWorkingClasses = []) => {
    const classes = Array.isArray(notWorkingClasses) ? notWorkingClasses.join(',') : notWorkingClasses;
    let leavesStr = "";
    let idsStr = "";
    if (Array.isArray(leavesOrIds)) {
        if (leavesOrIds.length > 0 && typeof leavesOrIds[0] === 'object' && leavesOrIds[0] !== null) {
            // New structured leaves list
            leavesStr = encodeURIComponent(JSON.stringify(leavesOrIds));
        } else {
            // Legacy IDs array
            idsStr = leavesOrIds.join(',');
        }
    } else if (typeof leavesOrIds === 'object' && leavesOrIds !== null) {
        leavesStr = encodeURIComponent(JSON.stringify(leavesOrIds));
    }
    return apiRequest(`/api/substitute/planner-data?date=${date}&on_leave_teacher_ids=${idsStr}&not_working_classes=${encodeURIComponent(classes || '')}&leaves=${leavesStr}`);
};
export const saveSubstituteAssignments = (date, assignments, leaves = []) => apiRequest('/api/substitute/assign', {
    method: 'POST',
    body: JSON.stringify({ date, assignments, leaves }),
});
export const getSubstituteReport = (params = {}) => {
    const search = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') search.set(k, v);
    });
    return apiRequest(`/api/substitute/report?${search.toString()}`);
};
export const getSubstituteDashboardWidget = () => apiRequest('/api/substitute/dashboard-widget');

// ── Teacher Attendance API Helpers ──
export const scanTeacherAttendance = (qrToken, coords = null) => apiRequest('/api/teacher-attendance/scan', {
    method: 'POST',
    body: JSON.stringify({
        qrToken,
        latitude: coords?.latitude,
        longitude: coords?.longitude
    }),
});

export const getTodayTeacherAttendanceStatus = () => apiRequest('/api/teacher-attendance/today-status');
export const getTodayTeacherAttendanceList = (date) => apiRequest(`/api/teacher-attendance/today-list${date ? `?date=${date}` : ''}`);
export const getTeacherAttendanceHistory = (teacherId) => apiRequest(`/api/teacher-attendance/history/${teacherId}`);
export const getAllTeacherAttendanceHistory = () => apiRequest('/api/teacher-attendance/all-history');
export const createStaffMember = (data) => apiRequest('/api/teachers/create', { method: 'POST', body: JSON.stringify(data) });
export const updateStaffMember = (id, data) => apiRequest(`/api/teachers/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteStaffMember = (id) => apiRequest(`/api/teachers/${id}`, { method: 'DELETE' });
export const clearAllTeacherAttendance = () => apiRequest('/api/teacher-attendance/clear-all', { method: 'POST' });

// ── Single Active Session Setting ──
export const getSingleSessionSetting = () => apiRequest('/admin/single-session-setting');
export const updateSingleSessionSetting = (enabled) => apiRequest('/admin/single-session-setting', {
    method: 'POST',
    body: JSON.stringify({ enabled }),
});

// ── Staff Attendance Afternoon Cutoff Setting ──
export const getStaffCutoffSetting = () => apiRequest('/admin/staff-cutoff-setting');
export const updateStaffCutoffSetting = (cutoff_time) => apiRequest('/admin/staff-cutoff-setting', {
    method: 'POST',
    body: JSON.stringify({ cutoff_time }),
});

// ── Geofence Location Check Setting ──
export const getGeofenceSetting = () => apiRequest('/admin/geofence-setting');
export const updateGeofenceSetting = (data) => apiRequest('/admin/geofence-setting', {
    method: 'POST',
    body: JSON.stringify(data),
});

// ── Web Push Notification API Helpers ──
export const getPushPublicKey = () => apiRequest('/api/push/public-key');
export const savePushSubscription = (subscription, phone = '') => apiRequest('/api/push/subscribe', {
    method: 'POST',
    body: JSON.stringify({ subscription, phone, userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '' }),
});
export const getPushSetting = () => apiRequest('/admin/push-setting');
export const updatePushSetting = (data) => apiRequest('/admin/push-setting', {
    method: 'POST',
    body: JSON.stringify(data),
});
export const sendTestPushNotification = (title, message) => apiRequest('/admin/push-test', {
    method: 'POST',
    body: JSON.stringify({ title, message }),
});

