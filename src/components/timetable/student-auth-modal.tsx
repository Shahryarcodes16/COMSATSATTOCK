import { useState, useEffect } from "react";
import {
  GraduationCap,
  Lock,
  Mail,
  User,
  CheckCircle2,
  AlertCircle,
  X,
  Eye,
  EyeOff,
  LogOut,
  CalendarDays,
  Clock,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  RefreshCw,
  BookOpen,
  KeyRound,
  Send,
} from "lucide-react";
import crest from "@/assets/crest.png";
import {
  isValidUniversityEmail,
  parseUniversityEmail,
  getActiveStudentSession,
  setStudentSession,
  clearStudentSession,
  PROGRAM_MAP,
  type StudentSession,
  type ParsedStudentEmail,
} from "@/lib/student";
import {
  studentSignInFn,
  studentRequestVerificationCodeFn,
  studentVerifyAndSignUpFn,
  studentUpdateBatchFn,
} from "@/lib/student-server-fn";
import { useDesk } from "@/components/timetable/context";
import { batches } from "@/lib/schedule";

/**
 * Topbar / Sidebar Button for Student Authentication
 */
export function StudentAuthButton({ showLabel = true }: { showLabel?: boolean }) {
  const [session, setSession] = useState<StudentSession | null>(() => getActiveStudentSession());
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    const handleUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<StudentSession | null>;
      setSession(customEvent.detail || getActiveStudentSession());
    };

    window.addEventListener("cui:student-session-update", handleUpdate);
    window.addEventListener("storage", () => setSession(getActiveStudentSession()));
    return () => {
      window.removeEventListener("cui:student-session-update", handleUpdate);
      window.removeEventListener("storage", () => setSession(getActiveStudentSession()));
    };
  }, []);

  return (
    <>
      <button
        type="button"
        className={`student-topbar-pill tap ${session ? "logged-in" : ""}`}
        onClick={() => setIsModalOpen(true)}
        title={session ? `Signed in as ${session.profile.fullName} (${session.profile.regNo})` : "Student Sign In / Sign Up with University Email"}
      >
        <span className="student-pill-icon">
          <GraduationCap size={16} aria-hidden />
        </span>
        {showLabel && (
          <span className="student-pill-label">
            {session ? session.profile.regNo : "Student Login"}
          </span>
        )}
        {session && <span className="student-status-dot" aria-hidden />}
      </button>

      {isModalOpen && (
        <StudentAuthModal
          session={session}
          onClose={() => setIsModalOpen(false)}
          onSessionChange={(s) => setSession(s)}
        />
      )}
    </>
  );
}

/**
 * Modern, Secure Student Login / Sign Up / Profile Modal
 */
export function StudentAuthModal({
  session,
  onClose,
  onSessionChange,
}: {
  session: StudentSession | null;
  onClose: () => void;
  onSessionChange: (s: StudentSession | null) => void;
}) {
  const { setView, pinBatch, setBatchId } = useDesk();
  const [mode, setMode] = useState<"signin" | "signup">(session ? "signin" : "signin");

  // Form State
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [selectedBatch, setSelectedBatch] = useState<string>("");
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

  // 2-Step OTP Verification State
  const [signupStage, setSignupStage] = useState<"form" | "verify">("form");
  const [verificationCode, setVerificationCode] = useState("");
  const [devPreviewCode, setDevPreviewCode] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);

  // Status & Feedback
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Extracted student info for preview
  const parsedEmail: ParsedStudentEmail | null = parseUniversityEmail(email);

  // Available batches matching the student's program (e.g. BS(CS)-I through VIII)
  const programBatches = parsedEmail
    ? batches.filter((b) => b.toLowerCase().includes(parsedEmail.program.batchPrefix.toLowerCase()))
    : [];

  // Auto-select first matching batch when email is parsed
  useEffect(() => {
    if (parsedEmail && programBatches.length > 0 && !selectedBatch) {
      setSelectedBatch(programBatches[0]);
    }
  }, [parsedEmail, programBatches, selectedBatch]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");

    if (!isValidUniversityEmail(email)) {
      setError("Please enter a valid university email matching: fa23-bcs-014@cuiatk.edu.pk");
      return;
    }
    if (!password) {
      setError("Please enter your account password.");
      return;
    }

    setLoading(true);
    try {
      const res = await studentSignInFn({
        data: {
          email: email.trim().toLowerCase(),
          password,
        },
      });

      if (!res.success || !res.session) {
        setError(res.error || "Authentication failed. Please verify credentials.");
        setLoading(false);
        return;
      }

      setStudentSession(res.session, rememberMe);
      onSessionChange(res.session);

      // If student has a default batch, set it in the timetable
      if (res.session.profile.defaultBatch) {
        const batchIdx = batches.indexOf(res.session.profile.defaultBatch);
        if (batchIdx !== -1) {
          pinBatch(batchIdx);
          setBatchId(batchIdx);
        }
      }

      setSuccessMsg(`Welcome back, ${res.session.profile.fullName}!`);
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch {
      setError("Unable to connect to authentication server. Check your network.");
    } finally {
      setLoading(false);
    }
  };

  const handleRequestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");

    const normalizedEmail = email.trim().toLowerCase();

    if (!fullName.trim() || fullName.trim().length < 2) {
      setError("Please enter your full name (minimum 2 characters).");
      return;
    }
    if (!isValidUniversityEmail(normalizedEmail)) {
      setError("Please enter your official university email (e.g. fa23-bcs-014@cuiatk.edu.pk).");
      return;
    }

    setLoading(true);
    try {
      const originUrl = typeof window !== "undefined" ? window.location.origin : undefined;
      const res = await studentRequestVerificationCodeFn({
        data: {
          email: normalizedEmail,
          fullName: fullName.trim(),
          defaultBatch: selectedBatch || undefined,
          originUrl,
        },
      });

      if (!res.success) {
        setError(res.error || "Failed to dispatch verification code.");
        setLoading(false);
        return;
      }

      setSignupStage("verify");
      setResendCooldown(60);
      if (res.devPreviewCode) {
        setDevPreviewCode(res.devPreviewCode);
      }
      setSuccessMsg(res.message || `Verification code sent to ${normalizedEmail}!`);
    } catch {
      setError("Unable to dispatch verification code. Please check your network connection.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyAndSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");

    const normalizedEmail = email.trim().toLowerCase();
    const trimmedCode = verificationCode.trim();

    if (!trimmedCode || trimmedCode.length !== 6) {
      setError("Please enter the complete 6-digit verification code from your Gmail.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match. Please verify.");
      return;
    }

    setLoading(true);
    try {
      const res = await studentVerifyAndSignUpFn({
        data: {
          email: normalizedEmail,
          code: trimmedCode,
          password,
        },
      });

      if (!res.success || !res.session) {
        setError(res.error || "Verification failed. Please check the code.");
        setLoading(false);
        return;
      }

      setStudentSession(res.session, rememberMe);
      onSessionChange(res.session);

      if (selectedBatch) {
        const batchIdx = batches.indexOf(selectedBatch);
        if (batchIdx !== -1) {
          pinBatch(batchIdx);
          setBatchId(batchIdx);
        }
      }

      setSuccessMsg("Account verified & created successfully! Welcome to CUI Attock Timetable.");
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: any) {
      console.error("[student-auth-modal] Verification error:", err);
      setError(err?.message || "Unable to verify account. Please check your network connection.");
    } finally {
      setLoading(false);
    }
  };

  const handleBatchUpdate = async (newBatch: string) => {
    if (!session) return;
    try {
      const res = await studentUpdateBatchFn({
        data: {
          email: session.profile.email,
          defaultBatch: newBatch,
        },
      });
      if (res.success && res.session) {
        setStudentSession(res.session);
        onSessionChange(res.session);
        const idx = batches.indexOf(newBatch);
        if (idx !== -1) {
          pinBatch(idx);
          setBatchId(idx);
        }
        setSuccessMsg(`Default batch updated to ${newBatch}!`);
        setTimeout(() => setSuccessMsg(""), 3000);
      }
    } catch (err) {
      console.warn("Failed to update default batch:", err);
    }
  };

  const handleSignOut = () => {
    clearStudentSession();
    onSessionChange(null);
    onClose();
  };

  return (
    <div className="notif-modal-backdrop" onClick={onClose}>
      <div
        className="notif-modal student-auth-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="student-modal-title"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 520 }}
      >
        {/* Header */}
        <div className="notif-modal-head">
          <div className="notif-modal-title-group">
            <span className="notif-modal-icon">
              <GraduationCap size={22} aria-hidden />
            </span>
            <div>
              <h3 id="student-modal-title" style={{ margin: 0, fontSize: "1.1rem" }}>
                {session ? "Student Identity Card" : mode === "signin" ? "Student Sign In" : "Create Student Account"}
              </h3>
              <p className="fine quiet" style={{ margin: "2px 0 0 0" }}>
                {session
                  ? "COMSATS University Islamabad, Attock Campus"
                  : "Sign in with your official university email"}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="icon-btn tap"
            onClick={onClose}
            aria-label="Close modal"
          >
            <X size={18} aria-hidden />
          </button>
        </div>

        {/* Modal Body */}
        <div className="notif-modal-body stack" style={{ padding: "1.25rem 1.5rem" }}>
          {/* Banner Messages */}
          {error && (
            <div className="admin-error-banner" role="alert">
              <AlertCircle size={16} aria-hidden />
              <span>{error}</span>
            </div>
          )}
          {successMsg && (
            <div className="admin-feedback-banner">
              <CheckCircle2 size={16} aria-hidden />
              <span>{successMsg}</span>
            </div>
          )}

          {/* 1. AUTHENTICATED PROFILE VIEW */}
          {session ? (
            <div className="stack" style={{ gap: "1rem" }}>
              <div
                className="student-card-preview"
                style={{
                  background: "linear-gradient(135deg, rgba(8,127,121,0.08) 0%, rgba(8,127,121,0.02) 100%)",
                  border: "1px solid rgba(8,127,121,0.22)",
                  borderRadius: "1rem",
                  padding: "1.25rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.85rem",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <img src={crest} alt="CUI Crest" style={{ width: 34, height: 34, objectFit: "contain" }} />
                    <div>
                      <b style={{ display: "block", fontSize: "0.95rem" }}>{session.profile.fullName}</b>
                      <span className="fine quiet">{session.profile.email}</span>
                    </div>
                  </div>
                  <span
                    style={{
                      background: "#087f79",
                      color: "#fff",
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      padding: "4px 10px",
                      borderRadius: 12,
                      letterSpacing: "0.5px",
                    }}
                  >
                    {session.profile.regNo}
                  </span>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "8px",
                    fontSize: "0.82rem",
                    background: "var(--c-paper, #fff)",
                    padding: "10px",
                    borderRadius: "8px",
                    border: "1px solid var(--c-line, #e2e8f0)",
                  }}
                >
                  <div>
                    <span className="fine quiet" style={{ display: "block" }}>Degree Program</span>
                    <b>{session.profile.programTitle}</b>
                  </div>
                  <div>
                    <span className="fine quiet" style={{ display: "block" }}>Session & Year</span>
                    <b>{session.profile.session === "FA" ? "Fall" : "Spring"} 20{session.profile.year}</b>
                  </div>
                  <div style={{ gridColumn: "span 2" }}>
                    <span className="fine quiet" style={{ display: "block" }}>Department</span>
                    <span>{session.profile.department}</span>
                  </div>
                </div>

                {/* Default Section Picker */}
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <span className="fine quiet">My Primary Class Batch / Section:</span>
                  <select
                    className="input"
                    value={session.profile.defaultBatch || ""}
                    onChange={(e) => handleBatchUpdate(e.target.value)}
                    style={{ fontSize: "0.85rem", padding: "6px 10px" }}
                  >
                    <option value="">Select your section (e.g. BS(CS)-V)...</option>
                    {batches.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Fast Action Shortcuts */}
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {session.profile.defaultBatch && (
                  <button
                    type="button"
                    className="btn solid tap"
                    onClick={() => {
                      const idx = batches.indexOf(session.profile.defaultBatch!);
                      if (idx !== -1) {
                        pinBatch(idx);
                        setBatchId(idx);
                      }
                      setView("batches");
                      onClose();
                    }}
                    style={{ justifyContent: "center" }}
                  >
                    <BookOpen size={16} aria-hidden />
                    <span>View {session.profile.defaultBatch} Timetable</span>
                  </button>
                )}

                <button
                  type="button"
                  className="btn tap"
                  onClick={() => {
                    setView("datesheet");
                    onClose();
                  }}
                  style={{ justifyContent: "center" }}
                >
                  <CalendarDays size={16} aria-hidden />
                  <span>Check Midterm Datesheet</span>
                </button>

                <button
                  type="button"
                  className="btn tap"
                  onClick={handleSignOut}
                  style={{ justifyContent: "center", color: "#e11d48", marginTop: 4 }}
                >
                  <LogOut size={16} aria-hidden />
                  <span>Sign Out of Account</span>
                </button>
              </div>
            </div>
          ) : (
            /* 2. AUTHENTICATION TABS (SIGN IN / SIGN UP) */
            <div className="stack" style={{ gap: "1rem" }}>
              <div className="student-auth-tab-row" style={{ display: "flex", borderBottom: "1px solid var(--c-line)", gap: "1rem" }}>
                <button
                  type="button"
                  className={`student-tab-btn ${mode === "signin" ? "active" : ""}`}
                  onClick={() => {
                    setMode("signin");
                    setSignupStage("form");
                    setVerificationCode("");
                    setError("");
                  }}
                  style={{
                    background: "none",
                    border: "none",
                    padding: "8px 4px",
                    fontWeight: mode === "signin" ? 700 : 500,
                    borderBottom: mode === "signin" ? "2px solid #087f79" : "2px solid transparent",
                    color: mode === "signin" ? "#087f79" : "var(--c-ink)",
                    cursor: "pointer",
                  }}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  className={`student-tab-btn ${mode === "signup" ? "active" : ""}`}
                  onClick={() => {
                    setMode("signup");
                    setSignupStage("form");
                    setVerificationCode("");
                    setError("");
                  }}
                  style={{
                    background: "none",
                    border: "none",
                    padding: "8px 4px",
                    fontWeight: mode === "signup" ? 700 : 500,
                    borderBottom: mode === "signup" ? "2px solid #087f79" : "2px solid transparent",
                    color: mode === "signup" ? "#087f79" : "var(--c-ink)",
                    cursor: "pointer",
                  }}
                >
                  Create New Account
                </button>
              </div>

              {/* A. SIGN IN FORM */}
              {mode === "signin" && (
                <form onSubmit={handleSignIn} className="stack" style={{ gap: "0.85rem" }}>
                  <label className="field-label-wrap">
                    <span className="field-label">Official University Email</span>
                    <div style={{ position: "relative" }}>
                      <input
                        type="email"
                        className="input"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="fa23-bcs-014@cuiatk.edu.pk"
                        autoComplete="username"
                        style={{ paddingLeft: "2.3rem" }}
                      />
                      <Mail size={16} style={{ position: "absolute", left: 12, top: 13, color: "var(--muted, #64748b)" }} />
                    </div>
                    {email && !isValidUniversityEmail(email) && (
                      <span className="fine quiet" style={{ color: "#d97706", marginTop: 4 }}>
                        Pattern: <code>fa/sp</code> + <code>YY</code>-<code>prog</code>-<code>roll</code>@cuiatk.edu.pk
                      </span>
                    )}
                  </label>

                  <label className="field-label-wrap">
                    <span className="field-label">Password</span>
                    <div style={{ position: "relative" }}>
                      <input
                        type={showPassword ? "text" : "password"}
                        className="input"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter your password"
                        autoComplete="current-password"
                        style={{ paddingLeft: "2.3rem", paddingRight: "2.3rem" }}
                      />
                      <Lock size={16} style={{ position: "absolute", left: 12, top: 13, color: "var(--muted, #64748b)" }} />
                      <button
                        type="button"
                        className="icon-btn tap"
                        onClick={() => setShowPassword(!showPassword)}
                        style={{ position: "absolute", right: 8, top: 8 }}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </label>

                  <label className="admin-checkbox-label" style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.82rem" }}>
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                    />
                    <span>Remember me on this device</span>
                  </label>

                  <button
                    type="submit"
                    className="btn solid tap"
                    disabled={loading}
                    style={{ justifyContent: "center", marginTop: 4 }}
                  >
                    {loading ? <RefreshCw size={16} className="spin" /> : <ShieldCheck size={16} />}
                    <span>{loading ? "Signing in..." : "Sign In to Portal"}</span>
                  </button>

                  <div className="fine quiet" style={{ textAlign: "center", marginTop: 6 }}>
                    New student?{" "}
                    <button
                      type="button"
                      onClick={() => setMode("signup")}
                      style={{ background: "none", border: "none", color: "#087f79", fontWeight: 600, cursor: "pointer", textDecoration: "underline" }}
                    >
                      Create your account here
                    </button>
                  </div>
                </form>
              )}

              {/* B. SIGN UP FLOW (2-STAGE SECURE OTP VERIFICATION) */}
              {mode === "signup" && signupStage === "form" && (
                <form onSubmit={handleRequestCode} className="stack" style={{ gap: "0.85rem" }}>
                  <label className="field-label-wrap">
                    <span className="field-label">Full Name</span>
                    <div style={{ position: "relative" }}>
                      <input
                        type="text"
                        className="input"
                        required
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="e.g. Muhammad Ali"
                        style={{ paddingLeft: "2.3rem" }}
                      />
                      <User size={16} style={{ position: "absolute", left: 12, top: 13, color: "var(--muted, #64748b)" }} />
                    </div>
                  </label>

                  <label className="field-label-wrap">
                    <span className="field-label">Official University Student Email</span>
                    <div style={{ position: "relative" }}>
                      <input
                        type="email"
                        className="input"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="fa23-bcs-014@cuiatk.edu.pk"
                        style={{ paddingLeft: "2.3rem" }}
                      />
                      <Mail size={16} style={{ position: "absolute", left: 12, top: 13, color: "var(--muted, #64748b)" }} />
                    </div>

                    {/* Live Student Identity Extractor Preview */}
                    {parsedEmail ? (
                      <div
                        style={{
                          background: "rgba(8,127,121,0.08)",
                          border: "1px solid rgba(8,127,121,0.22)",
                          borderRadius: 8,
                          padding: "8px 12px",
                          marginTop: 6,
                          fontSize: "0.78rem",
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <CheckCircle2 size={16} color="#087f79" style={{ flexShrink: 0 }} />
                        <div>
                          <b>{parsedEmail.regNo}</b>: {parsedEmail.program.name} ({parsedEmail.sessionFull} 20{parsedEmail.year})
                        </div>
                      </div>
                    ) : (
                      email && (
                        <span className="fine quiet" style={{ color: "#d97706", marginTop: 4 }}>
                          Must match official pattern: <code>fa23-bcs-014@cuiatk.edu.pk</code>
                        </span>
                      )
                    )}
                  </label>

                  {/* Program Batch Picker */}
                  {parsedEmail && programBatches.length > 0 && (
                    <label className="field-label-wrap">
                      <span className="field-label">Current Class Section / Batch</span>
                      <select
                        className="input"
                        value={selectedBatch}
                        onChange={(e) => setSelectedBatch(e.target.value)}
                        style={{ fontSize: "0.85rem" }}
                      >
                        {programBatches.map((b) => (
                          <option key={b} value={b}>
                            {b}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}

                  <div className="fine quiet" style={{ fontSize: "0.8rem", color: "var(--muted, #64748b)", margin: "4px 0" }}>
                    🛡️ A secure 6-digit verification code will be dispatched to your official student Gmail inbox to verify identity.
                  </div>

                  <button
                    type="submit"
                    className="btn solid tap"
                    disabled={loading || !isValidUniversityEmail(email)}
                    style={{ justifyContent: "center", marginTop: 4 }}
                  >
                    {loading ? <RefreshCw size={16} className="spin" /> : <Send size={16} />}
                    <span>{loading ? "Sending Verification Code..." : "Send Verification Code"}</span>
                  </button>

                  <div className="fine quiet" style={{ textAlign: "center", marginTop: 6 }}>
                    Already have an account?{" "}
                    <button
                      type="button"
                      onClick={() => setMode("signin")}
                      style={{ background: "none", border: "none", color: "#087f79", fontWeight: 600, cursor: "pointer", textDecoration: "underline" }}
                    >
                      Sign in here
                    </button>
                  </div>
                </form>
              )}

              {/* STAGE 2: ENTER CODE & SET PASSWORD */}
              {mode === "signup" && signupStage === "verify" && (
                <form onSubmit={handleVerifyAndSignUp} className="stack" style={{ gap: "0.85rem" }}>
                  <div
                    style={{
                      background: "rgba(8,127,121,0.08)",
                      border: "1px solid rgba(8,127,121,0.22)",
                      borderRadius: 8,
                      padding: "10px 14px",
                      fontSize: "0.85rem",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <Mail size={16} color="#087f79" />
                      <b>Check Your Student Gmail</b>
                    </div>
                    <p className="fine quiet" style={{ margin: 0 }}>
                      A 6-digit verification code was dispatched to <b>{email}</b>.
                    </p>
                  </div>

                  {devPreviewCode && (
                    <div
                      style={{
                        background: "rgba(217, 119, 6, 0.12)",
                        border: "1px solid rgba(217, 119, 6, 0.35)",
                        borderRadius: 8,
                        padding: "8px 12px",
                        fontSize: "0.82rem",
                        color: "#b45309",
                      }}
                    >
                      <b>Local Dev OTP Preview:</b> <code>{devPreviewCode}</code>
                    </div>
                  )}

                  <label className="field-label-wrap">
                    <span className="field-label">6-Digit Verification Code</span>
                    <div style={{ position: "relative" }}>
                      <input
                        type="text"
                        className="input"
                        required
                        autoFocus
                        maxLength={6}
                        value={verificationCode}
                        onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                        placeholder="123456"
                        style={{
                          paddingLeft: "2.3rem",
                          letterSpacing: "4px",
                          fontFamily: "monospace",
                          fontSize: "1.1rem",
                          fontWeight: 700,
                        }}
                      />
                      <KeyRound size={16} style={{ position: "absolute", left: 12, top: 13, color: "var(--muted, #64748b)" }} />
                    </div>
                  </label>

                  <label className="field-label-wrap">
                    <span className="field-label">Set Account Password (min 6 characters)</span>
                    <div style={{ position: "relative" }}>
                      <input
                        type={showPassword ? "text" : "password"}
                        className="input"
                        required
                        minLength={6}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Create a strong password"
                        style={{ paddingLeft: "2.3rem", paddingRight: "2.3rem" }}
                      />
                      <Lock size={16} style={{ position: "absolute", left: 12, top: 13, color: "var(--muted, #64748b)" }} />
                      <button
                        type="button"
                        className="icon-btn tap"
                        onClick={() => setShowPassword(!showPassword)}
                        style={{ position: "absolute", right: 8, top: 8 }}
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </label>

                  <label className="field-label-wrap">
                    <span className="field-label">Confirm Password</span>
                    <div style={{ position: "relative" }}>
                      <input
                        type={showPassword ? "text" : "password"}
                        className="input"
                        required
                        minLength={6}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Re-type your password"
                        style={{ paddingLeft: "2.3rem" }}
                      />
                      <Lock size={16} style={{ position: "absolute", left: 12, top: 13, color: "var(--muted, #64748b)" }} />
                    </div>
                  </label>

                  <button
                    type="submit"
                    className="btn solid tap"
                    disabled={loading || verificationCode.trim().length !== 6 || password.length < 6}
                    style={{ justifyContent: "center", marginTop: 4 }}
                  >
                    {loading ? <RefreshCw size={16} className="spin" /> : <ShieldCheck size={16} />}
                    <span>{loading ? "Verifying & Creating..." : "Verify Code & Create Account"}</span>
                  </button>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8, fontSize: "0.8rem" }}>
                    <button
                      type="button"
                      onClick={() => {
                        setSignupStage("form");
                        setVerificationCode("");
                        setError("");
                      }}
                      style={{
                        background: "none",
                        border: "none",
                        color: "var(--muted, #64748b)",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <ArrowLeft size={14} />
                      <span>Change Email</span>
                    </button>

                    <button
                      type="button"
                      disabled={loading || resendCooldown > 0}
                      onClick={handleRequestCode}
                      style={{
                        background: "none",
                        border: "none",
                        color: resendCooldown > 0 ? "var(--muted, #64748b)" : "#087f79",
                        fontWeight: 600,
                        cursor: resendCooldown > 0 ? "default" : "pointer",
                      }}
                    >
                      {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend Code"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
