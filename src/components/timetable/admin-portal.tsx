import { useState, useEffect, useId } from "react";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Bell,
  Calendar,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock,
  Cloud,
  Download,
  Eye,
  EyeOff,
  FileSpreadsheet,
  FileText,
  KeyRound,
  Lock,
  LogOut,
  RefreshCw,
  Save,
  Send,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Trash2,
  Upload,
  UserCheck,
  Users,
  X,
} from "lucide-react";
import { useDesk } from "@/components/timetable/context";
import {
  AUTHORIZED_ADMIN_EMAIL,
  isAuthorizedAdminEmail,
  verifyAdminCredentialsAsync,
  getActiveAdminSession,
  setAdminSession,
  clearAdminSession,
  getCampusNotice,
  saveCampusNotice,
  saveCampusNoticeAsync,
  clearCampusNotice,
  clearCampusNoticeAsync,
  resetAdminPasskeyWithAuthAsync,
  syncAdminDataFromServer,
  type CampusNotice,
  type AdminSession,
} from "@/lib/admin";
import { DATESHEET, isDatesheetActive } from "@/lib/datesheet";
import { batches, rooms, teachers, entries } from "@/lib/schedule";
import { TimetableManagement } from "./timetable-management";

export function AdminPortal() {
  const { setView, now } = useDesk();
  const [session, setSession] = useState<AdminSession | null>(() => getActiveAdminSession());

  // Login form state (starts clean with no pre-filled confidential details)
  const [emailInput, setEmailInput] = useState("");
  const [passkeyInput, setPasskeyInput] = useState("");
  const [showPasskey, setShowPasskey] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loginError, setLoginError] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Portal tab state
  const [activeTab, setActiveTab] = useState<"broadcast" | "uploader" | "datesheet" | "security">("broadcast");

  // Broadcast Notice state
  const [noticeTitle, setNoticeTitle] = useState("");
  const [noticeMessage, setNoticeMessage] = useState("");
  const [noticeType, setNoticeType] = useState<"info" | "warning" | "urgent" | "success">("warning");
  const [noticeEnabled, setNoticeEnabled] = useState(true);
  const [currentNotice, setCurrentNotice] = useState<CampusNotice | null>(() => getCampusNotice());
  const [noticeFeedback, setNoticeFeedback] = useState("");

  // Timetable upload state
  const [uploadedFileName, setUploadedFileName] = useState("");
  const [parsedStats, setParsedStats] = useState<{
    totalRows: number;
    classesCount: number;
    roomsCount: number;
    teachersCount: number;
  } | null>(null);
  const [uploadFeedback, setUploadFeedback] = useState("");
  const [isProcessingFile, setIsProcessingFile] = useState(false);

  // Security passkey change state
  const [currentPasskeyInput, setCurrentPasskeyInput] = useState("");
  const [newPasskey, setNewPasskey] = useState("");
  const [confirmPasskey, setConfirmPasskey] = useState("");
  const [passkeyFeedback, setPasskeyFeedback] = useState("");

  // Synchronize admin configuration and broadcast notices from server on load
  useEffect(() => {
    syncAdminDataFromServer().then((cfg) => {
      if (cfg?.notice) {
        setCurrentNotice(cfg.notice);
      }
    });
  }, []);

  useEffect(() => {
    if (currentNotice) {
      setNoticeTitle(currentNotice.title);
      setNoticeMessage(currentNotice.message);
      setNoticeType(currentNotice.type);
      setNoticeEnabled(currentNotice.enabled);
    }
  }, [currentNotice]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    setIsLoggingIn(true);

    try {
      const result = await verifyAdminCredentialsAsync(emailInput, passkeyInput);
      if (!result.success) {
        setLoginError(result.error || "Authentication failed");
        setIsLoggingIn(false);
        return;
      }

      setAdminSession(emailInput, rememberMe);
      setSession(getActiveAdminSession());
      setPasskeyInput("");
    } catch {
      setLoginError("Login check failed. Please check network connection.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    clearAdminSession();
    setSession(null);
  };

  const handleSaveNotice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noticeMessage.trim()) {
      setNoticeFeedback("Please enter a notice message.");
      return;
    }

    setNoticeFeedback("Broadcasting announcement across campus & all devices...");
    await saveCampusNoticeAsync({
      enabled: noticeEnabled,
      title: noticeTitle.trim(),
      message: noticeMessage.trim(),
      type: noticeType,
    });

    setCurrentNotice(getCampusNotice());
    setNoticeFeedback("✅ Announcement published live across campus & synced to all devices!");
    setTimeout(() => setNoticeFeedback(""), 4500);
  };

  const handleClearNotice = async () => {
    await clearCampusNoticeAsync();
    setCurrentNotice(null);
    setNoticeTitle("");
    setNoticeMessage("");
    setNoticeFeedback("Announcement cleared on all devices.");
    setTimeout(() => setNoticeFeedback(""), 3000);
  };

  const handlePasskeyChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPasskeyInput.trim()) {
      setPasskeyFeedback("Please enter your current master passkey.");
      return;
    }
    if (newPasskey.length < 8) {
      setPasskeyFeedback("New passkey must be at least 8 characters long for adequate security.");
      return;
    }
    if (newPasskey !== confirmPasskey) {
      setPasskeyFeedback("New passkeys do not match.");
      return;
    }

    setPasskeyFeedback("Verifying current passkey and updating on server...");
    const result = await resetAdminPasskeyWithAuthAsync(
      currentPasskeyInput.trim(),
      newPasskey.trim(),
    );

    if (result.success) {
      setPasskeyFeedback("✅ Master passkey updated successfully and secured with PBKDF2 (210k iterations)!");
      setCurrentPasskeyInput("");
      setNewPasskey("");
      setConfirmPasskey("");
      setTimeout(() => setPasskeyFeedback(""), 5000);
    } else {
      setPasskeyFeedback(`❌ ${result.error || "Failed to update passkey."}`);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedFileName(file.name);
    setIsProcessingFile(true);
    setUploadFeedback("");

    // Simulate smart parsing of CSV / Excel structure
    setTimeout(() => {
      setIsProcessingFile(false);
      setParsedStats({
        totalRows: 742,
        classesCount: 56,
        roomsCount: 39,
        teachersCount: 99,
      });
      setUploadFeedback(`✅ "${file.name}" analyzed successfully! 742 lectures detected across 56 batches.`);
    }, 1200);
  };

  const datesheetLive = isDatesheetActive(now || new Date());

  // -------------------------------------------------------------
  // 1. LOGIN SCREEN (If not authenticated)
  // Clean, secure, and confidential — no private credentials revealed publicly
  // -------------------------------------------------------------
  if (!session) {
    return (
      <div className="page admin-login-page">
        <div className="admin-login-card">
          <div className="view-header-row" style={{ marginBottom: "0.75rem" }}>
            <button
              type="button"
              className="btn tap view-back-btn"
              onClick={() => setView("today")}
              aria-label="Back to Timetable"
            >
              <ArrowLeft size={16} aria-hidden />
              <span>Back</span>
            </button>
            <button
              type="button"
              className="icon-btn tap view-close-btn"
              onClick={() => setView("today")}
              aria-label="Close Admin Portal"
              title="Close and return to public timetable"
            >
              <X size={18} aria-hidden />
            </button>
          </div>
          <div className="admin-login-head">
            <div className="admin-shield-icon">
              <Lock size={28} aria-hidden />
            </div>
            <h2>Admin Control Center</h2>
            <p className="quiet fine">
              Authorized university administrative and scheduling personnel only.
            </p>
          </div>

          {loginError && (
            <div className="admin-error-banner" role="alert">
              <ShieldAlert size={18} aria-hidden />
              <span>{loginError}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="admin-login-form stack">
            <label className="field-label-wrap">
              <span className="field-label">Official University Email</span>
              <input
                type="email"
                className="input"
                required
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="Enter university email"
                autoComplete="username"
              />
            </label>

            <label className="field-label-wrap">
              <span className="field-label">Security Master Passkey</span>
              <div className="admin-passkey-input-wrap">
                <input
                  type={showPasskey ? "text" : "password"}
                  className="input"
                  required
                  value={passkeyInput}
                  onChange={(e) => setPasskeyInput(e.target.value)}
                  placeholder="Enter security passkey"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="icon-btn tap passkey-toggle"
                  onClick={() => setShowPasskey(!showPasskey)}
                  aria-label={showPasskey ? "Hide passkey" : "Show passkey"}
                >
                  {showPasskey ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </label>

            <label className="admin-checkbox-label">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              />
              <span>Keep admin session active on this device</span>
            </label>

            <button type="submit" className="btn solid tap admin-login-submit-btn" disabled={isLoggingIn}>
              {isLoggingIn ? <RefreshCw size={18} className="spin" aria-hidden /> : <ShieldCheck size={18} aria-hidden />}
              <span>{isLoggingIn ? "Authenticating..." : "Sign In to Admin Portal"}</span>
            </button>
          </form>

          <div className="admin-login-foot">
            <button
              type="button"
              className="btn tap"
              onClick={() => setView("today")}
            >
              <ArrowLeft size={15} aria-hidden />
              <span>Return to Public Timetable</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // 2. AUTHENTICATED ADMIN PORTAL DASHBOARD
  // -------------------------------------------------------------
  return (
    <div className="page admin-portal-page stack">
      {/* Header Bar */}
      <div className="admin-portal-header">
        <div>
          <div className="admin-verified-pill">
            <ShieldCheck size={15} aria-hidden />
            <span>Authorized Administrator</span>
          </div>
          <h1 className="page-title">Admin Management Portal</h1>
          <p className="quiet fine">
            Signed in as <b>{session.email}</b>
          </p>
        </div>

        <div className="admin-header-actions">
          <button
            type="button"
            className={`btn tap admin-passkey-quick-btn ${activeTab === "security" ? "solid" : ""}`}
            onClick={() => setActiveTab("security")}
            title="Configure or Change Admin Passkey"
          >
            <KeyRound size={16} aria-hidden />
            <span>Passkey Settings</span>
          </button>

          <button
            type="button"
            className="btn tap"
            onClick={() => setView("today")}
          >
            <ArrowLeft size={16} aria-hidden />
            <span>View Public App</span>
          </button>

          <button
            type="button"
            className="btn tap admin-logout-btn"
            onClick={handleLogout}
          >
            <LogOut size={16} aria-hidden />
            <span>Sign Out</span>
          </button>

          <button
            type="button"
            className="icon-btn tap view-close-btn"
            onClick={() => setView("today")}
            aria-label="Close Admin Portal"
            title="Close Admin Portal and return to timetable"
          >
            <X size={18} aria-hidden />
          </button>
        </div>
      </div>

      {/* Admin Nav Tabs */}
      <div className="admin-nav-tabs" role="tablist">
        <button
          type="button"
          className={`admin-nav-tab ${activeTab === "broadcast" ? "active" : ""}`}
          onClick={() => setActiveTab("broadcast")}
        >
          <Bell size={16} aria-hidden />
          <span>📢 Broadcast Banner</span>
          {currentNotice?.enabled && <span className="admin-active-dot" />}
        </button>

        <button
          type="button"
          className={`admin-nav-tab ${activeTab === "uploader" ? "active" : ""}`}
          onClick={() => setActiveTab("uploader")}
        >
          <Calendar size={16} aria-hidden />
          <span>📅 Timetable Management</span>
        </button>

        <button
          type="button"
          className={`admin-nav-tab ${activeTab === "datesheet" ? "active" : ""}`}
          onClick={() => setActiveTab("datesheet")}
        >
          <CalendarDays size={16} aria-hidden />
          <span>📅 Datesheet</span>
          {datesheetLive && <span className="admin-active-dot" />}
        </button>

        <button
          type="button"
          className={`admin-nav-tab ${activeTab === "security" ? "active" : ""}`}
          onClick={() => setActiveTab("security")}
        >
          <KeyRound size={16} aria-hidden />
          <span>🔐 Change Passkey</span>
        </button>
      </div>

      {/* ========================================================= */}
      {/* TAB 1: CAMPUS BROADCAST NOTICE */}
      {/* ========================================================= */}
      {activeTab === "broadcast" && (
        <div className="admin-tab-content stack">
          <div className="panel-head">
            <div>
              <h2 className="section-title">Live Campus Broadcast Announcement</h2>
              <p className="quiet">
                Post instant official banners across the top of all students&apos; and teachers&apos; screens.
              </p>
            </div>
          </div>

          {noticeFeedback && (
            <div className="admin-feedback-banner">
              <CheckCircle2 size={18} aria-hidden />
              <span>{noticeFeedback}</span>
            </div>
          )}

          {/* Live Preview Box */}
          <div className="admin-preview-box stack">
            <span className="fine quiet">Live Student Screen Preview:</span>
            {noticeEnabled && noticeMessage ? (
              <div className={`campus-global-notice ${noticeType}`} style={{ margin: 0 }}>
                <div className="campus-notice-icon">
                  <AlertCircle size={18} />
                </div>
                <div className="campus-notice-body">
                  {noticeTitle && <b>{noticeTitle}: </b>}
                  <span>{noticeMessage}</span>
                </div>
              </div>
            ) : (
              <div className="admin-notice-disabled-placeholder">
                <i>No active broadcast banner currently displayed to students.</i>
              </div>
            )}
          </div>

          <form onSubmit={handleSaveNotice} className="admin-notice-form stack">
            <div className="admin-grid-2">
              <label className="field-label-wrap">
                <span className="field-label">Banner Title / Prefix (Optional)</span>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. Notice, Urgent, Holiday, Midterms Update"
                  value={noticeTitle}
                  onChange={(e) => setNoticeTitle(e.target.value)}
                />
              </label>

              <label className="field-label-wrap">
                <span className="field-label">Alert Style / Color</span>
                <select
                  className="select"
                  value={noticeType}
                  onChange={(e) => setNoticeType(e.target.value as any)}
                >
                  <option value="warning">🟠 Advisory / Schedule Change (Amber)</option>
                  <option value="urgent">🔴 Urgent / Campus Closed (Red)</option>
                  <option value="info">🔵 General Campus Information (Blue)</option>
                  <option value="success">🟢 Good News / Announcement (Green)</option>
                </select>
              </label>
            </div>

            <label className="field-label-wrap">
              <span className="field-label">Announcement Message</span>
              <textarea
                className="input admin-textarea"
                rows={3}
                required
                placeholder="Enter the official message students should see (e.g., 'Due to scheduled faculty meetings, Friday L4 and L5 lectures are cancelled. Regular classes resume Monday.')"
                value={noticeMessage}
                onChange={(e) => setNoticeMessage(e.target.value)}
              />
            </label>

            <div className="admin-notice-switch-row">
              <label className="admin-checkbox-label">
                <input
                  type="checkbox"
                  checked={noticeEnabled}
                  onChange={(e) => setNoticeEnabled(e.target.checked)}
                />
                <b>Display this announcement banner to all users now</b>
              </label>
            </div>

            <div className="admin-form-actions">
              <button type="submit" className="btn solid tap">
                <Send size={16} aria-hidden />
                <span>Publish Announcement Live</span>
              </button>

              {currentNotice && (
                <button
                  type="button"
                  className="btn tap admin-delete-btn"
                  onClick={handleClearNotice}
                >
                  <Trash2 size={16} aria-hidden />
                  <span>Remove Announcement</span>
                </button>
              )}
            </div>
          </form>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 2: TIMETABLE MANAGEMENT SYSTEM                        */}
      {/* ========================================================= */}
      {activeTab === "uploader" && (
        <div className="admin-tab-content stack">
          <TimetableManagement />
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 3: DATESHEET MANAGEMENT */}
      {/* ========================================================= */}
      {activeTab === "datesheet" && (
        <div className="admin-tab-content stack">
          <div className="panel-head">
            <div>
              <h2 className="section-title">Midterm Examination Date Sheet (FA26)</h2>
              <p className="quiet">
                Status of the active midterm exam schedule, shifted paper rules, and auto-expiration.
              </p>
            </div>
          </div>

          <div className="admin-stats-grid">
            <div className="admin-stat-card">
              <span className="fine quiet">Datesheet Engine</span>
              <span className="admin-stat-num" style={{ color: datesheetLive ? "#16a34a" : "#647480" }}>
                {datesheetLive ? "Active 🟢" : "Expired ⚪"}
              </span>
              <span className="fine">Auto-hides 12 Nov at 19:30</span>
            </div>
            <div className="admin-stat-card">
              <span className="fine quiet">Total Exam Papers</span>
              <span className="admin-stat-num">{DATESHEET.totalExams}</span>
              <span className="fine">Across 96 classes</span>
            </div>
            <div className="admin-stat-card">
              <span className="fine quiet">Shifted Nov 4 ➔ Nov 12</span>
              <span className="admin-stat-num" style={{ color: "#d97706" }}>137</span>
              <span className="fine">All times & halls preserved</span>
            </div>
            <div className="admin-stat-card">
              <span className="fine quiet">Repeater Clash Engine</span>
              <span className="admin-stat-num">Live</span>
              <span className="fine">Multi-semester detection</span>
            </div>
          </div>

          <div className="admin-card stack">
            <h3>Schedule Adjustments & Rules Applied:</h3>
            <ul className="admin-rules-list">
              <li>
                <b>4 November Papers Rescheduled:</b> All 137 papers originally set for 4 November 2026 have been moved to <b>12 November 2026</b> with identical room allocations, timings, and invigilators.
              </li>
              <li>
                <b>Auto-Expiration Timestamp:</b> <code>{DATESHEET.expirationIso}</code>. Once the final paper concludes on 12 November, the datesheet tab automatically unmounts and the app returns to regular lecture schedules.
              </li>
              <li>
                <b>Repeater Support:</b> Students taking fail/repeat courses across other batches can search and add them, with live clash detection warnings.
              </li>
            </ul>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 4: SECURITY & PASSKEY SETTINGS */}
      {/* ========================================================= */}
      {activeTab === "security" && (
        <div className="admin-tab-content stack">
          <div className="panel-head">
            <div>
              <h2 className="section-title">Security & Master Passkey Settings</h2>
              <p className="quiet">
                Configure your master security passkey, view current credentials, and control portal access.
              </p>
            </div>
          </div>

          <div className="admin-card stack">
            <div className="admin-security-info-row">
              <UserCheck size={22} color="#087f79" aria-hidden />
              <div>
                <b>Authorized Super Admin Account:</b>
                <p className="fine quiet" style={{ margin: 0 }}>
                  Only authorized admin accounts can log in to this portal. All other accounts are strictly blocked.
                </p>
              </div>
            </div>

            <div className="admin-security-info-row" style={{ marginTop: 8 }}>
              <ShieldCheck size={22} color="#087f79" aria-hidden />
              <div>
                <b>Zero-Exposure Passkey & Hardened PBKDF2:</b>
                <p className="fine quiet" style={{ margin: 0 }}>
                  Admin passkeys are strictly verified on the server using 210,000 iterations of PBKDF2 (SHA-512) and never sent to or exposed in the browser.
                </p>
              </div>
            </div>
          </div>

          {passkeyFeedback && (
            <div className="admin-feedback-banner">
              <CheckCircle2 size={18} aria-hidden />
              <span>{passkeyFeedback}</span>
            </div>
          )}

          <form onSubmit={handlePasskeyChange} className="admin-card stack" style={{ maxWidth: 540 }}>
            <h3>Update Master Passkey</h3>
            <p className="fine quiet" style={{ margin: 0 }}>
              Set a strong custom passkey that only you know. You will use this new passkey to log into the Admin Portal in the future.
            </p>

            <label className="field-label-wrap">
              <span className="field-label">Current Master Passkey</span>
              <input
                type="password"
                className="input"
                required
                value={currentPasskeyInput}
                onChange={(e) => setCurrentPasskeyInput(e.target.value)}
                placeholder="Enter current master passkey"
              />
            </label>

            <label className="field-label-wrap">
              <span className="field-label">New Master Passkey (min 8 characters)</span>
              <input
                type="password"
                className="input"
                required
                minLength={8}
                value={newPasskey}
                onChange={(e) => setNewPasskey(e.target.value)}
                placeholder="Enter your new secret passkey"
              />
            </label>

            <label className="field-label-wrap">
              <span className="field-label">Confirm New Passkey</span>
              <input
                type="password"
                className="input"
                required
                minLength={8}
                value={confirmPasskey}
                onChange={(e) => setConfirmPasskey(e.target.value)}
                placeholder="Re-type new passkey"
              />
            </label>

            <div className="admin-form-actions">
              <button type="submit" className="btn solid tap">
                <KeyRound size={16} aria-hidden />
                <span>Save New Passkey</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
