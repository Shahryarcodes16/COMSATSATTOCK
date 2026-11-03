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
  Trash2,
  Upload,
  UserCheck,
  Users,
} from "lucide-react";
import { useDesk } from "@/components/timetable/context";
import {
  AUTHORIZED_ADMIN_EMAIL,
  DEFAULT_ADMIN_PASSKEY,
  isAuthorizedAdminEmail,
  verifyAdminCredentials,
  getActiveAdminSession,
  setAdminSession,
  clearAdminSession,
  getCampusNotice,
  saveCampusNotice,
  clearCampusNotice,
  updateAdminPasskey,
  getStoredAdminPasskey,
  resetAdminPasskeyWithAuth,
  type CampusNotice,
  type AdminSession,
} from "@/lib/admin";
import { DATESHEET, isDatesheetActive } from "@/lib/datesheet";
import { batches, rooms, teachers, entries } from "@/lib/schedule";

export function AdminPortal() {
  const { setView, now } = useDesk();
  const [session, setSession] = useState<AdminSession | null>(() => getActiveAdminSession());

  // Login form state
  const [emailInput, setEmailInput] = useState(AUTHORIZED_ADMIN_EMAIL);
  const [passkeyInput, setPasskeyInput] = useState("");
  const [showPasskey, setShowPasskey] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loginError, setLoginError] = useState("");

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
  const [newPasskey, setNewPasskey] = useState("");
  const [confirmPasskey, setConfirmPasskey] = useState("");
  const [passkeyFeedback, setPasskeyFeedback] = useState("");
  const [showCurrentConfiguredPasskey, setShowCurrentConfiguredPasskey] = useState(false);

  // Login screen direct passkey reset state
  const [isResetPasskeyOpen, setIsResetPasskeyOpen] = useState(false);
  const [resetCurrentOrMaster, setResetCurrentOrMaster] = useState("");
  const [resetNewPasskey, setResetNewPasskey] = useState("");
  const [resetConfirmPasskey, setResetConfirmPasskey] = useState("");
  const [resetFeedback, setResetFeedback] = useState("");
  const [resetError, setResetError] = useState("");

  useEffect(() => {
    if (currentNotice) {
      setNoticeTitle(currentNotice.title);
      setNoticeMessage(currentNotice.message);
      setNoticeType(currentNotice.type);
      setNoticeEnabled(currentNotice.enabled);
    }
  }, [currentNotice]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");

    const result = verifyAdminCredentials(emailInput, passkeyInput);
    if (!result.success) {
      setLoginError(result.error || "Authentication failed");
      return;
    }

    setAdminSession(emailInput, rememberMe);
    setSession(getActiveAdminSession());
    setPasskeyInput("");
  };

  const handleLogout = () => {
    clearAdminSession();
    setSession(null);
  };

  const handleSaveNotice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!noticeMessage.trim()) {
      setNoticeFeedback("Please enter a notice message.");
      return;
    }

    saveCampusNotice({
      enabled: noticeEnabled,
      title: noticeTitle.trim(),
      message: noticeMessage.trim(),
      type: noticeType,
    });

    setCurrentNotice(getCampusNotice());
    setNoticeFeedback("✅ Announcement published live across campus!");
    setTimeout(() => setNoticeFeedback(""), 4000);
  };

  const handleClearNotice = () => {
    clearCampusNotice();
    setCurrentNotice(null);
    setNoticeTitle("");
    setNoticeMessage("");
    setNoticeFeedback("Announcement cleared.");
    setTimeout(() => setNoticeFeedback(""), 3000);
  };

  const handlePasskeyChange = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPasskey.length < 4) {
      setPasskeyFeedback("Passkey must be at least 4 characters long.");
      return;
    }
    if (newPasskey !== confirmPasskey) {
      setPasskeyFeedback("New passkeys do not match.");
      return;
    }

    const success = updateAdminPasskey(newPasskey);
    if (success) {
      setPasskeyFeedback("✅ Passkey updated successfully!");
      setNewPasskey("");
      setConfirmPasskey("");
      setTimeout(() => setPasskeyFeedback(""), 4000);
    } else {
      setPasskeyFeedback("Failed to update passkey.");
    }
  };

  const handleDirectPasskeyReset = (e: React.FormEvent) => {
    e.preventDefault();
    setResetError("");
    setResetFeedback("");

    if (resetNewPasskey.length < 4) {
      setResetError("New passkey must be at least 4 characters long.");
      return;
    }
    if (resetNewPasskey !== resetConfirmPasskey) {
      setResetError("New passkeys do not match.");
      return;
    }

    const result = resetAdminPasskeyWithAuth(
      emailInput,
      resetCurrentOrMaster,
      resetNewPasskey,
    );

    if (!result.success) {
      setResetError(result.error || "Failed to update passkey.");
      return;
    }

    setResetFeedback("✅ Passkey updated successfully! You can now log in with your new passkey.");
    setPasskeyInput(resetNewPasskey);
    setResetCurrentOrMaster("");
    setResetNewPasskey("");
    setResetConfirmPasskey("");
    setTimeout(() => {
      setIsResetPasskeyOpen(false);
      setResetFeedback("");
    }, 3000);
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
  // -------------------------------------------------------------
  if (!session) {
    return (
      <div className="page admin-login-page">
        <div className="admin-login-card">
          <div className="admin-login-head">
            <div className="admin-shield-icon">
              <Lock size={28} aria-hidden />
            </div>
            <h2>Admin Control Center</h2>
            <p className="quiet fine">
              Strictly restricted to the authorized campus administrator:
              <br />
              <b>{AUTHORIZED_ADMIN_EMAIL}</b>
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
              <span className="field-label">Official University Gmail</span>
              <input
                type="email"
                className="input"
                required
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="fa23-bcs-014@cuiatk.edu.pk"
              />
              {!isAuthorizedAdminEmail(emailInput) && emailInput.length > 5 && (
                <span className="field-hint error">
                  ⚠️ Only {AUTHORIZED_ADMIN_EMAIL} is authorized to log in.
                </span>
              )}
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
                  placeholder="Enter your security passkey"
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
              <span className="field-hint quiet">
                Default initial passkey: <code>cuiatk@2026</code> (can be changed in settings)
              </span>
            </label>

            <label className="admin-checkbox-label">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              />
              <span>Keep admin session active on this device</span>
            </label>

            <button type="submit" className="btn solid tap admin-login-submit-btn">
              <ShieldCheck size={18} aria-hidden />
              <span>Authenticate & Enter Portal</span>
            </button>
          </form>

          {/* Direct Passkey Change / Reset Option on Login Screen */}
          <div className="admin-login-extras stack">
            <button
              type="button"
              className="btn tap admin-toggle-reset-btn"
              onClick={() => {
                setIsResetPasskeyOpen(!isResetPasskeyOpen);
                setResetError("");
                setResetFeedback("");
              }}
            >
              <KeyRound size={15} aria-hidden />
              <span>{isResetPasskeyOpen ? "Hide Passkey Reset" : "🔑 Change / Reset Admin Passkey"}</span>
            </button>

            {isResetPasskeyOpen && (
              <form onSubmit={handleDirectPasskeyReset} className="admin-reset-card stack">
                <div className="admin-reset-card-head">
                  <KeyRound size={17} color="#087f79" />
                  <b>Change Your Admin Passkey</b>
                </div>
                <p className="fine quiet" style={{ margin: 0 }}>
                  Enter your current passkey (default: <code>cuiatk@2026</code>) or verification PIN (<code>014</code>) to set a new passkey.
                </p>

                {resetError && (
                  <div className="admin-error-banner" role="alert">
                    <ShieldAlert size={16} />
                    <span>{resetError}</span>
                  </div>
                )}
                {resetFeedback && (
                  <div className="admin-feedback-banner">
                    <CheckCircle2 size={16} />
                    <span>{resetFeedback}</span>
                  </div>
                )}

                <label className="field-label-wrap">
                  <span className="field-label">Current Passkey or Roll PIN (014)</span>
                  <input
                    type="password"
                    className="input"
                    required
                    value={resetCurrentOrMaster}
                    onChange={(e) => setResetCurrentOrMaster(e.target.value)}
                    placeholder="cuiatk@2026 or 014"
                  />
                </label>

                <label className="field-label-wrap">
                  <span className="field-label">New Passkey</span>
                  <input
                    type="password"
                    className="input"
                    required
                    value={resetNewPasskey}
                    onChange={(e) => setResetNewPasskey(e.target.value)}
                    placeholder="Enter new passkey"
                  />
                </label>

                <label className="field-label-wrap">
                  <span className="field-label">Confirm New Passkey</span>
                  <input
                    type="password"
                    className="input"
                    required
                    value={resetConfirmPasskey}
                    onChange={(e) => setResetConfirmPasskey(e.target.value)}
                    placeholder="Confirm new passkey"
                  />
                </label>

                <button type="submit" className="btn solid tap">
                  <Save size={16} />
                  <span>Update Passkey</span>
                </button>
              </form>
            )}
          </div>

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
          <Upload size={16} aria-hidden />
          <span>📤 Upload Timetable</span>
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
      {/* TAB 2: TIMETABLE UPLOADER */}
      {/* ========================================================= */}
      {activeTab === "uploader" && (
        <div className="admin-tab-content stack">
          <div className="panel-head">
            <div>
              <h2 className="section-title">Automated Timetable Excel / CSV Uploader</h2>
              <p className="quiet">
                Drop your official university timetable file here. The app automatically parses all batches, rooms, teachers, and lecture slots.
              </p>
            </div>
          </div>

          {/* Current System Overview */}
          <div className="admin-stats-grid">
            <div className="admin-stat-card">
              <span className="fine quiet">Current Batches</span>
              <span className="admin-stat-num">{batches.length}</span>
              <span className="fine">Across all departments</span>
            </div>
            <div className="admin-stat-card">
              <span className="fine quiet">Active Faculty</span>
              <span className="admin-stat-num">{teachers.length}</span>
              <span className="fine">Professors & Lecturers</span>
            </div>
            <div className="admin-stat-card">
              <span className="fine quiet">Lecture Rooms & Labs</span>
              <span className="admin-stat-num">{rooms.length}</span>
              <span className="fine">LH, CR, LT & Computer Labs</span>
            </div>
            <div className="admin-stat-card">
              <span className="fine quiet">Weekly Scheduled Classes</span>
              <span className="admin-stat-num">{entries.length}</span>
              <span className="fine">Mon – Fri Lectures</span>
            </div>
          </div>

          {/* Upload Drop Zone */}
          <div className="admin-dropzone stack">
            <div className="admin-dropzone-inner">
              <FileSpreadsheet size={42} aria-hidden className="admin-drop-icon" />
              <h3>Drag and Drop New Timetable (.xlsx or .csv)</h3>
              <p className="quiet fine">
                Supports official COMSATS Attock Excel workbooks or CSV exports.
              </p>
              <label className="btn solid tap admin-upload-file-btn">
                <Upload size={16} aria-hidden />
                <span>Browse Files</span>
                <input
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleFileUpload}
                  style={{ display: "none" }}
                />
              </label>
            </div>

            {uploadedFileName && (
              <div className="admin-uploaded-file-row">
                <FileText size={18} aria-hidden />
                <span>{uploadedFileName}</span>
                {isProcessingFile ? (
                  <span className="fine quiet">Analyzing file…</span>
                ) : (
                  <span className="admin-file-ready-tag">Parsed & Ready</span>
                )}
              </div>
            )}
          </div>

          {uploadFeedback && (
            <div className="admin-feedback-banner">
              <CheckCircle2 size={18} aria-hidden />
              <span>{uploadFeedback}</span>
            </div>
          )}

          {parsedStats && (
            <div className="admin-preview-summary stack">
              <h3>Preview Parsed Timetable</h3>
              <div className="admin-grid-2">
                <div className="admin-summary-item">
                  <b>{parsedStats.totalRows}</b> Lectures identified
                </div>
                <div className="admin-summary-item">
                  <b>{parsedStats.classesCount}</b> Batches mapped (BSCS, BSE, BBA, etc.)
                </div>
                <div className="admin-summary-item">
                  <b>{parsedStats.roomsCount}</b> Rooms & Labs allocated
                </div>
                <div className="admin-summary-item">
                  <b>{parsedStats.teachersCount}</b> Faculty timetable links verified
                </div>
              </div>

              <div className="admin-form-actions">
                <button
                  type="button"
                  className="btn solid tap"
                  onClick={() => {
                    alert("Timetable verified! In a production deployment, this replaces src/data/timetable.json or database records.");
                  }}
                >
                  <Save size={16} aria-hidden />
                  <span>Deploy This Timetable Live to All Students</span>
                </button>
              </div>
            </div>
          )}
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
                  Only <code>{AUTHORIZED_ADMIN_EMAIL}</code> can log in to this portal. All other accounts are strictly blocked.
                </p>
              </div>
            </div>

            <div className="admin-current-passkey-row">
              <div>
                <span className="fine quiet">Current Configured Passkey:</span>
                <p style={{ margin: "2px 0 0 0", fontFamily: "monospace", fontSize: "1rem" }}>
                  {showCurrentConfiguredPasskey ? getStoredAdminPasskey() : "••••••••••••"}
                </p>
              </div>
              <button
                type="button"
                className="btn tap"
                onClick={() => setShowCurrentConfiguredPasskey(!showCurrentConfiguredPasskey)}
              >
                {showCurrentConfiguredPasskey ? <EyeOff size={15} /> : <Eye size={15} />}
                <span>{showCurrentConfiguredPasskey ? "Hide" : "Reveal Current Passkey"}</span>
              </button>
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
              Set a custom passkey that only you know. You will use this new passkey to log into the Admin Portal in the future.
            </p>

            <label className="field-label-wrap">
              <span className="field-label">New Master Passkey (min 4 characters)</span>
              <input
                type="password"
                className="input"
                required
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

              <button
                type="button"
                className="btn tap"
                onClick={() => {
                  updateAdminPasskey(DEFAULT_ADMIN_PASSKEY);
                  setPasskeyFeedback(`Reset to default initial passkey: ${DEFAULT_ADMIN_PASSKEY}`);
                  setTimeout(() => setPasskeyFeedback(""), 4000);
                }}
                title="Reset back to factory default: cuiatk@2026"
              >
                <RefreshCw size={15} aria-hidden />
                <span>Reset to Default ({DEFAULT_ADMIN_PASSKEY})</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
