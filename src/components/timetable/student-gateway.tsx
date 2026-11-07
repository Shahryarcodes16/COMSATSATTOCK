import { useState, useEffect } from "react";
import {
  GraduationCap,
  Lock,
  Mail,
  User,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Sparkles,
  ShieldCheck,
  RefreshCw,
  ArrowRight,
  BookOpen,
  CalendarDays,
  Clock,
  Building2,
  Users,
} from "lucide-react";
import crest from "@/assets/crest.png";
import {
  isValidUniversityEmail,
  parseUniversityEmail,
  setStudentSession,
  saveLocalRegisteredAccount,
  getLocalRegisteredAccount,
  verifyClientPassword,
  type StudentSession,
  type StudentProfile,
  type ParsedStudentEmail,
} from "@/lib/student";
import {
  studentSignInFn,
  studentRequestVerificationCodeFn,
  studentVerifyAndSignUpFn,
} from "@/lib/student-server-fn";
import {
  isFacultyEmail,
  setFacultySession,
  saveLocalFacultyAccount,
  getLocalFacultyAccount,
  type FacultySession,
} from "@/lib/faculty-auth";
import { facultyList } from "@/lib/faculty";
import {
  facultyRequestVerificationCodeFn,
  facultyVerifyAndSignUpFn,
  facultySignInFn,
} from "@/lib/faculty-server-fn";
import { useDesk } from "@/components/timetable/context";
import { batches } from "@/lib/schedule";

export function StudentGateway({
  onAuthenticated,
  onFacultyAuthenticated,
}: {
  onAuthenticated: (session: StudentSession) => void;
  onFacultyAuthenticated?: (session: FacultySession) => void;
}) {
  const { setView, pinBatch, setBatchId } = useDesk();
  const [portalType, setPortalType] = useState<"student" | "faculty">("student");

  // Student mode
  const [mode, setMode] = useState<"signup" | "signin">("signup");
  const [signupStage, setSignupStage] = useState<"details" | "verify">("details");
  const [verificationCode, setVerificationCode] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);
  const [devPreviewCode, setDevPreviewCode] = useState<string | null>(null);

  // Student Form State
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [selectedBatch, setSelectedBatch] = useState<string>("");
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

  // Faculty mode
  const [facultyMode, setFacultyMode] = useState<"signup" | "signin">("signup");
  const [facultyStage, setFacultyStage] = useState<"details" | "verify">("details");
  const [facultyEmail, setFacultyEmail] = useState("");
  const [facultyName, setFacultyName] = useState("");
  const [facultyTeacherId, setFacultyTeacherId] = useState<number | undefined>(undefined);
  const [facultyPassword, setFacultyPassword] = useState("");
  const [facultyConfirmPassword, setFacultyConfirmPassword] = useState("");
  const [facultyCode, setFacultyCode] = useState("");
  const [facultyLeadMins, setFacultyLeadMins] = useState(10);
  const [facultyRememberMe, setFacultyRememberMe] = useState(true);
  const [facultyDevPreviewCode, setFacultyDevPreviewCode] = useState<string | null>(null);
  const [facultyResendCooldown, setFacultyResendCooldown] = useState(0);

  // Status & Feedback
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Extracted student info for preview
  const parsedEmail: ParsedStudentEmail | null = parseUniversityEmail(email);

  // Matched faculty member for preview
  const matchedFaculty = facultyEmail
    ? facultyList.find((f) => f.email && f.email.trim().toLowerCase() === facultyEmail.trim().toLowerCase())
    : null;

  // Available batches matching the student's program (e.g. BS(CS)-I through VIII)
  const programBatches = parsedEmail
    ? batches.filter((b) => b.toLowerCase().includes(parsedEmail.program.batchPrefix.toLowerCase()))
    : [];

  // Magic Link auto-detection from URL for students: ?verify_email=...&code=...
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const verifyEmail = params.get("verify_email");
    const code = params.get("code");
    if (verifyEmail && isValidUniversityEmail(verifyEmail)) {
      setPortalType("student");
      setEmail(verifyEmail);
      setMode("signup");
      setSignupStage("verify");
      if (code) {
        setVerificationCode(code);
        setSuccessMsg("Magic Link Verified: Please set your secure password to complete your account.");
      }
    }

    const verifyFaculty = params.get("verify_faculty_email") || params.get("faculty_email");
    if (verifyFaculty && isFacultyEmail(verifyFaculty)) {
      setPortalType("faculty");
      setFacultyEmail(verifyFaculty);
      setFacultyMode("signup");
      setFacultyStage("verify");
      if (code) {
        setFacultyCode(code);
        setSuccessMsg("Magic Link Verified: Please set your secure faculty password.");
      }
    }
  }, []);

  // 60-second resend cooldown timers
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  useEffect(() => {
    if (facultyResendCooldown <= 0) return;
    const t = setTimeout(() => setFacultyResendCooldown(facultyResendCooldown - 1), 1000);
    return () => clearTimeout(t);
  }, [facultyResendCooldown]);

  useEffect(() => {
    if (parsedEmail && programBatches.length > 0 && !selectedBatch) {
      setSelectedBatch(programBatches[0]);
    }
  }, [parsedEmail, programBatches, selectedBatch]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");

    const normalizedEmail = email.trim().toLowerCase();

    if (!isValidUniversityEmail(normalizedEmail)) {
      setError("Please enter a valid university email (e.g. fa23-bcs-014@cuiatk.edu.pk).");
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
          email: normalizedEmail,
          password,
        },
      });

      if (res.success && res.session) {
        setStudentSession(res.session, rememberMe);
        if (res.session.profile.defaultBatch) {
          const batchIdx = batches.indexOf(res.session.profile.defaultBatch);
          if (batchIdx !== -1) {
            pinBatch(batchIdx);
            setBatchId(batchIdx);
          }
        }

        setSuccessMsg(`Welcome back, ${res.session.profile.fullName}! Unlocking campus workspace...`);
        setTimeout(() => {
          onAuthenticated(res.session!);
        }, 900);
        return;
      }

      setError(res.error || "Authentication failed. Please verify credentials.");
      setLoading(false);
    } catch {
      setError("Unable to connect to authentication server. Please check your network.");
    } finally {
      setLoading(false);
    }
  };

  const handleRequestVerificationCode = async (e: React.FormEvent) => {
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

  const handleVerifyAndCreateAccount = async (e: React.FormEvent) => {
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
      if (res.credentialSync) {
        saveLocalRegisteredAccount(res.credentialSync);
      }

      if (selectedBatch) {
        const batchIdx = batches.indexOf(selectedBatch);
        if (batchIdx !== -1) {
          pinBatch(batchIdx);
          setBatchId(batchIdx);
        }
      }

      setSuccessMsg("Email verified! Your student account has been created successfully.");
      setTimeout(() => {
        onAuthenticated(res.session!);
      }, 1000);
    } catch {
      setError("Unable to verify code. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  // Faculty Handlers
  const handleFacultyRequestVerificationCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");

    const cleanEmail = facultyEmail.trim().toLowerCase();
    if (!isFacultyEmail(cleanEmail)) {
      setError("Please enter your official faculty email (e.g. name@cuiatk.edu.pk or @ciit-attock.edu.pk).");
      return;
    }
    if (!facultyName.trim()) {
      setError("Please enter your name as displayed on campus.");
      return;
    }

    setLoading(true);
    try {
      const originUrl = typeof window !== "undefined" ? window.location.origin : undefined;
      const res = await facultyRequestVerificationCodeFn({
        data: {
          email: cleanEmail,
          fullName: facultyName.trim(),
          teacherId: facultyTeacherId,
          originUrl,
        },
      });

      if (!res.success) {
        setError(res.error || "Unable to send verification code. Please check your faculty email.");
        return;
      }

      if (res.devPreviewCode) {
        setFacultyDevPreviewCode(res.devPreviewCode);
      }

      setFacultyStage("verify");
      setFacultyResendCooldown(60);
      setSuccessMsg(res.message || `Verification code sent to ${cleanEmail}! Please check your official inbox.`);
    } catch (err: any) {
      setError(err?.message || "An unexpected error occurred while contacting the server.");
    } finally {
      setLoading(false);
    }
  };

  const handleFacultyVerifyAndCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");

    const cleanEmail = facultyEmail.trim().toLowerCase();
    const cleanCode = facultyCode.trim();

    if (!cleanCode || cleanCode.length < 6) {
      setError("Please enter the 6-digit verification code sent to your faculty email.");
      return;
    }
    if (facultyPassword.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }
    if (facultyPassword !== facultyConfirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const res = await facultyVerifyAndSignUpFn({
        data: {
          email: cleanEmail,
          code: cleanCode,
          password: facultyPassword,
          teacherId: facultyTeacherId,
        },
      });

      if (!res.success || !res.session) {
        setError(res.error || "Verification failed. Please check your code.");
        return;
      }

      setFacultySession(res.session, facultyRememberMe);
      if (res.credentialSync) {
        saveLocalFacultyAccount(res.credentialSync);
      }

      setSuccessMsg("Faculty account verified and registered successfully!");
      setTimeout(() => {
        if (onFacultyAuthenticated) {
          onFacultyAuthenticated(res.session!);
        }
        setView("faculty-desk");
      }, 800);
    } catch (err: any) {
      setError(err?.message || "Failed to verify faculty code.");
    } finally {
      setLoading(false);
    }
  };

  const handleFacultySignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");

    const cleanEmail = facultyEmail.trim().toLowerCase();
    if (!isFacultyEmail(cleanEmail)) {
      setError("Please enter your official faculty email (e.g. name@cuiatk.edu.pk).");
      return;
    }
    if (!facultyPassword) {
      setError("Please enter your password.");
      return;
    }

    setLoading(true);
    try {
      const res = await facultySignInFn({
        data: {
          email: cleanEmail,
          password: facultyPassword,
        },
      });

      if (!res.success || !res.session) {
        setError(res.error || "Invalid faculty credentials.");
        return;
      }

      setFacultySession(res.session, facultyRememberMe);
      if (res.credentialSync) {
        saveLocalFacultyAccount(res.credentialSync);
      }

      setSuccessMsg("Welcome back, Professor! Opening Teaching Desk...");
      setTimeout(() => {
        if (onFacultyAuthenticated) {
          onFacultyAuthenticated(res.session!);
        }
        setView("faculty-desk");
      }, 600);
    } catch (err: any) {
      setError(err?.message || "Failed to sign in.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="student-gateway-screen">
      <div className="student-gateway-container">
        {/* Branding Hero */}
        <div className="student-gateway-brand">
          <img className="student-gateway-crest" src={crest} alt="COMSATS Attock Crest" />
          <div className="student-gateway-titles">
            <span className="student-gateway-sub">COMSATS UNIVERSITY ISLAMABAD • ATTOCK CAMPUS</span>
            <h1>Campus Timetable & Examination Portal</h1>
            <p className="student-gateway-desc">
              Please sign up with your official university email to unlock your personalized lecture schedule, room radar, and midterm datesheet.
            </p>
          </div>
        </div>

        {/* Feature Highlights Pills */}
        <div className="student-gateway-perks">
          <div className="perk-pill">
            <Clock size={16} color="#087f79" />
            <span>Real-Time Lectures</span>
          </div>
          <div className="perk-pill">
            <CalendarDays size={16} color="#087f79" />
            <span>Midterm Datesheet</span>
          </div>
          <div className="perk-pill">
            <Building2 size={16} color="#087f79" />
            <span>Free Room Radar</span>
          </div>
          <div className="perk-pill">
            <Users size={16} color="#087f79" />
            <span>Faculty Directory</span>
          </div>
        </div>

        {/* Role Switcher: Student vs Faculty */}
        <div className="gateway-role-switcher" role="tablist" aria-label="Portal Selection">
          <button
            type="button"
            role="tab"
            aria-selected={portalType === "student"}
            className={`role-switcher-btn ${portalType === "student" ? "active" : ""}`}
            onClick={() => {
              setPortalType("student");
              setError("");
              setSuccessMsg("");
            }}
          >
            <User size={16} />
            <span>Student Portal</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={portalType === "faculty"}
            className={`role-switcher-btn ${portalType === "faculty" ? "active" : ""}`}
            onClick={() => {
              setPortalType("faculty");
              setError("");
              setSuccessMsg("");
            }}
          >
            <GraduationCap size={16} />
            <span>Faculty Portal</span>
          </button>
        </div>

        {/* Auth Card */}
        <div className="student-gateway-card">
          {portalType === "student" ? (
            <>
              {/* Tabs */}
          <div className="student-gateway-tabs">
            <button
              type="button"
              className={`gateway-tab-btn ${mode === "signup" ? "active" : ""}`}
              onClick={() => {
                setMode("signup");
                setError("");
                setSuccessMsg("");
              }}
            >
              <Sparkles size={16} />
              <span>Create Student Account</span>
            </button>
            <button
              type="button"
              className={`gateway-tab-btn ${mode === "signin" ? "active" : ""}`}
              onClick={() => {
                setMode("signin");
                setError("");
                setSuccessMsg("");
              }}
            >
              <ShieldCheck size={16} />
              <span>Student Sign In</span>
            </button>
          </div>

          {/* Feedback Banners */}
          {error && (
            <div className="admin-error-banner" role="alert" style={{ margin: "1rem 1.5rem 0", display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-start" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
              {mode === "signin" && error.includes("No student account found") && (
                <button
                  type="button"
                  onClick={() => {
                    setMode("signup");
                    setError("");
                  }}
                  className="link-btn"
                  style={{
                    color: "var(--c-accent)",
                    fontWeight: 700,
                    fontSize: "0.82rem",
                    textAlign: "left",
                    textDecoration: "underline",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: 0,
                  }}
                >
                  Click here to create your account now →
                </button>
              )}
            </div>
          )}
          {successMsg && (
            <div className="admin-feedback-banner" style={{ margin: "1rem 1.5rem 0" }}>
              <CheckCircle2 size={16} />
              <span>{successMsg}</span>
            </div>
          )}

          {/* SIGN UP FORM: 2-STAGE SECURE EMAIL VERIFICATION */}
          {mode === "signup" && signupStage === "details" && (
            <form onSubmit={handleRequestVerificationCode} className="student-gateway-form stack">
              <div style={{ background: "color-mix(in srgb, var(--c-accent) 6%, transparent)", padding: "0.75rem 1rem", borderRadius: "0.75rem", border: "1px solid color-mix(in srgb, var(--c-accent) 20%, transparent)", fontSize: "0.82rem", color: "var(--c-ink)", display: "flex", alignItems: "center", gap: "0.6rem" }}>
                <ShieldCheck size={18} color="var(--c-accent)" style={{ flexShrink: 0 }} />
                <span>
                  To keep campus data private, a <strong>6-digit verification code</strong> or magic link will be sent to your official university Gmail.
                </span>
              </div>

              <label className="field-label-wrap">
                <span className="field-label">Student Full Name</span>
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
                <span className="field-label">Official University Email</span>
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

                {/* Real-time identity preview badge */}
                {parsedEmail ? (
                  <div className="student-identity-preview">
                    <CheckCircle2 size={16} color="#087f79" style={{ flexShrink: 0 }} />
                    <div>
                      <b>{parsedEmail.regNo}</b>: {parsedEmail.program.name} ({parsedEmail.sessionFull} 20{parsedEmail.year})
                    </div>
                  </div>
                ) : (
                  email.length > 5 && (
                    <span className="fine quiet" style={{ color: "#d97706", marginTop: 4 }}>
                      Format: <code>session (fa/sp) + year + program + roll @cuiatk.edu.pk</code>
                    </span>
                  )
                )}
              </label>

              {/* Class Section Picker */}
              {parsedEmail && programBatches.length > 0 && (
                <label className="field-label-wrap">
                  <span className="field-label">Current Class Section / Batch</span>
                  <select
                    className="input select"
                    value={selectedBatch}
                    onChange={(e) => setSelectedBatch(e.target.value)}
                  >
                    {programBatches.map((b) => (
                      <option key={b} value={b} style={{ color: "#162d3b" }}>
                        {b}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <button
                type="submit"
                className="btn solid tap student-gateway-submit"
                disabled={loading || !isValidUniversityEmail(email)}
              >
                {loading ? <RefreshCw size={18} className="spin" /> : <Mail size={18} />}
                <span>{loading ? "Sending Code to Gmail..." : "Send Verification Code to University Gmail →"}</span>
              </button>

              <p className="fine quiet" style={{ textAlign: "center", marginTop: 8 }}>
                Already registered?{" "}
                <button
                  type="button"
                  onClick={() => setMode("signin")}
                  className="link-btn"
                  style={{ color: "#087f79", fontWeight: 600, background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}
                >
                  Sign in here
                </button>
              </p>
            </form>
          )}

          {/* STAGE 2: VERIFY 6-DIGIT CODE & SET PASSWORD */}
          {mode === "signup" && signupStage === "verify" && (
            <form onSubmit={handleVerifyAndCreateAccount} className="student-gateway-form stack">
              <div style={{ background: "color-mix(in srgb, var(--c-accent) 8%, var(--c-paper))", padding: "0.85rem 1rem", borderRadius: "0.85rem", border: "1px solid var(--c-accent)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: "0.78rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--c-accent)" }}>
                    Email Verification Code Sent
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setSignupStage("details");
                      setError("");
                    }}
                    style={{ background: "none", border: "none", color: "var(--muted, #64748b)", fontSize: "0.78rem", cursor: "pointer", textDecoration: "underline" }}
                  >
                    Change Email
                  </button>
                </div>
                <div style={{ fontSize: "0.88rem", fontWeight: 600, color: "var(--c-ink)" }}>
                  {email}
                </div>
                <div style={{ fontSize: "0.78rem", color: "var(--muted, #64748b)", marginTop: 4 }}>
                  Please check your university Gmail inbox (and spam folder) for the 6-digit code.
                </div>
              </div>

              {devPreviewCode && (
                <div style={{ background: "#fef3c7", border: "1px solid #f59e0b", padding: "0.6rem 0.85rem", borderRadius: "0.6rem", fontSize: "0.8rem", color: "#92400e", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span>💡 Preview Code: <strong>{devPreviewCode}</strong></span>
                  <button
                    type="button"
                    onClick={() => setVerificationCode(devPreviewCode)}
                    style={{ background: "#d97706", color: "#fff", border: "none", borderRadius: "4px", padding: "2px 8px", fontSize: "0.75rem", cursor: "pointer", fontWeight: 700 }}
                  >
                    Auto-Fill
                  </button>
                </div>
              )}

              <label className="field-label-wrap">
                <span className="field-label">6-Digit Verification Code</span>
                <div style={{ position: "relative" }}>
                  <input
                    type="text"
                    className="input"
                    required
                    maxLength={6}
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="• • • • • •"
                    style={{
                      textAlign: "center",
                      letterSpacing: "0.35em",
                      fontSize: "1.4rem",
                      fontWeight: 800,
                      fontFamily: "monospace",
                      color: "var(--c-accent)",
                    }}
                  />
                </div>
              </label>

              <label className="field-label-wrap">
                <span className="field-label">Choose Account Password (min 6 characters)</span>
                <div style={{ position: "relative" }}>
                  <input
                    type={showPassword ? "text" : "password"}
                    className="input"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Create your secure password"
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
                className="btn solid tap student-gateway-submit"
                disabled={loading || verificationCode.trim().length !== 6 || password.length < 6}
              >
                {loading ? <RefreshCw size={18} className="spin" /> : <Sparkles size={18} />}
                <span>{loading ? "Verifying & Unlocking..." : "Verify Code & Unlock Campus Workspace"}</span>
              </button>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8, fontSize: "0.8rem" }}>
                <button
                  type="button"
                  onClick={handleRequestVerificationCode}
                  disabled={resendCooldown > 0 || loading}
                  style={{
                    background: "none",
                    border: "none",
                    color: resendCooldown > 0 ? "var(--muted, #64748b)" : "var(--c-accent)",
                    cursor: resendCooldown > 0 ? "default" : "pointer",
                    fontWeight: 600,
                    textDecoration: resendCooldown > 0 ? "none" : "underline",
                  }}
                >
                  {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : "Resend Verification Code"}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSignupStage("details");
                    setError("");
                  }}
                  style={{ background: "none", border: "none", color: "var(--muted, #64748b)", cursor: "pointer", textDecoration: "underline" }}
                >
                  ← Back to Details
                </button>
              </div>
            </form>
          )}

          {/* SIGN IN FORM */}
          {mode === "signin" && (
            <form onSubmit={handleSignIn} className="student-gateway-form stack">
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
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </label>

              <label className="admin-checkbox-label" style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.85rem" }}>
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                <span>Keep me signed in on this device</span>
              </label>

              <button
                type="submit"
                className="btn solid tap student-gateway-submit"
                disabled={loading}
              >
                {loading ? <RefreshCw size={18} className="spin" /> : <ArrowRight size={18} />}
                <span>{loading ? "Authenticating..." : "Sign In & Open Workspace"}</span>
              </button>

              <p className="fine quiet" style={{ textAlign: "center", marginTop: 8 }}>
                New student?{" "}
                <button
                  type="button"
                  onClick={() => setMode("signup")}
                  className="link-btn"
                  style={{ color: "#087f79", fontWeight: 600, background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}
                >
                  Create your account here
                </button>
              </p>
            </form>
          )}
        </>
      ) : (
        /* =================== FACULTY PORTAL =================== */
        <>
          {/* Faculty Tabs */}
          <div className="student-gateway-tabs">
            <button
              type="button"
              className={`gateway-tab-btn ${facultyMode === "signup" ? "active" : ""}`}
              onClick={() => {
                setFacultyMode("signup");
                setError("");
                setSuccessMsg("");
              }}
            >
              <Sparkles size={16} />
              <span>Create Faculty Account</span>
            </button>
            <button
              type="button"
              className={`gateway-tab-btn ${facultyMode === "signin" ? "active" : ""}`}
              onClick={() => {
                setFacultyMode("signin");
                setError("");
                setSuccessMsg("");
              }}
            >
              <ShieldCheck size={16} />
              <span>Faculty Sign In</span>
            </button>
          </div>

          {/* Feedback Banners */}
          {error && (
            <div className="admin-error-banner" role="alert" style={{ margin: "1rem 1.5rem 0", display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-start" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
              {facultyMode === "signin" && error.includes("No faculty account") && (
                <button
                  type="button"
                  onClick={() => {
                    setFacultyMode("signup");
                    setError("");
                  }}
                  className="link-btn"
                  style={{
                    color: "var(--c-accent)",
                    fontWeight: 700,
                    fontSize: "0.82rem",
                    textAlign: "left",
                    textDecoration: "underline",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: 0,
                  }}
                >
                  Click here to create your faculty account now →
                </button>
              )}
            </div>
          )}
          {successMsg && (
            <div className="admin-feedback-banner" style={{ margin: "1rem 1.5rem 0" }}>
              <CheckCircle2 size={16} />
              <span>{successMsg}</span>
            </div>
          )}

          {/* FACULTY SIGN UP: STAGE 1 */}
          {facultyMode === "signup" && facultyStage === "details" && (
            <form onSubmit={handleFacultyRequestVerificationCode} className="student-gateway-form stack">
              <div style={{ background: "color-mix(in srgb, var(--c-accent) 6%, transparent)", padding: "0.75rem 1rem", borderRadius: "0.75rem", border: "1px solid color-mix(in srgb, var(--c-accent) 20%, transparent)", fontSize: "0.82rem", color: "var(--c-ink)", display: "flex", alignItems: "center", gap: "0.6rem" }}>
                <GraduationCap size={20} color="var(--c-accent)" style={{ flexShrink: 0 }} />
                <span>
                  Faculty members can view their <strong>teaching schedule</strong>, find <strong>free makeup slots</strong> with any batch & room, and receive <strong>pre-lecture classroom notifications</strong>.
                </span>
              </div>

              {/* Select Faculty Identity */}
              <label className="field-label-wrap">
                <span className="field-label">Select Your Name from Directory</span>
                <select
                  className="input select faculty-directory-select"
                  value={facultyTeacherId ?? ""}
                  style={{
                    color: "var(--c-ink, #162d3b)",
                    backgroundColor: "var(--c-paper, #ffffff)",
                    border: "1px solid var(--c-line)",
                    fontWeight: 600,
                  }}
                  onChange={(e) => {
                    const val = e.target.value ? Number(e.target.value) : undefined;
                    setFacultyTeacherId(val);
                    if (val !== undefined) {
                      const found = facultyList.find((f) => (f.teacherId !== null ? f.teacherId === val : f.id === val));
                      if (found) {
                        setFacultyName(found.name);
                        if (found.email) setFacultyEmail(found.email);
                      }
                    }
                  }}
                >
                  <option value="" style={{ color: "#64748b" }}>
                    -- Choose Name (Optional Auto-Fill) --
                  </option>
                  {[
                    "Computer Science",
                    "Electrical & Computer Engineering",
                    "Mathematics & Sciences",
                    "Engineering & Technology",
                    "Management Sciences",
                  ].map((dept) => {
                    const deptMembers = facultyList
                      .filter((f) => f.department === dept)
                      .sort((a, b) => a.name.localeCompare(b.name));
                    if (deptMembers.length === 0) return null;
                    return (
                      <optgroup key={dept} label={`Department of ${dept}`}>
                        {deptMembers.map((f) => (
                          <option
                            key={f.id}
                            value={f.teacherId ?? f.id}
                            style={{ color: "#162d3b", backgroundColor: "#ffffff" }}
                          >
                            {f.name}
                          </option>
                        ))}
                      </optgroup>
                    );
                  })}
                </select>
              </label>

              <label className="field-label-wrap">
                <span className="field-label">Faculty Full Name</span>
                <div style={{ position: "relative" }}>
                  <input
                    type="text"
                    className="input"
                    required
                    value={facultyName}
                    onChange={(e) => setFacultyName(e.target.value)}
                    placeholder="e.g. Dr. Muazzam Maqsood"
                    style={{ paddingLeft: "2.3rem" }}
                  />
                  <User size={16} style={{ position: "absolute", left: 12, top: 13, color: "var(--muted, #64748b)" }} />
                </div>
              </label>

              <label className="field-label-wrap">
                <span className="field-label">Official University Faculty Email</span>
                <div style={{ position: "relative" }}>
                  <input
                    type="email"
                    className="input"
                    required
                    value={facultyEmail}
                    onChange={(e) => setFacultyEmail(e.target.value)}
                    placeholder="muazzam.maqsood@cuiatk.edu.pk"
                    style={{ paddingLeft: "2.3rem" }}
                  />
                  <Mail size={16} style={{ position: "absolute", left: 12, top: 13, color: "var(--muted, #64748b)" }} />
                </div>

                {matchedFaculty ? (
                  <div className="student-identity-preview">
                    <CheckCircle2 size={16} color="#087f79" style={{ flexShrink: 0 }} />
                    <div>
                      <b>{matchedFaculty.name}</b> • {matchedFaculty.department}
                    </div>
                  </div>
                ) : (
                  facultyEmail.length > 5 && (
                    <span className="fine quiet" style={{ color: "#d97706", marginTop: 4 }}>
                      Must be official faculty domain: <code>@cuiatk.edu.pk</code> or <code>@ciit-attock.edu.pk</code>
                    </span>
                  )
                )}
              </label>

              <button
                type="submit"
                className="btn solid tap student-gateway-submit"
                disabled={loading || !isFacultyEmail(facultyEmail)}
              >
                {loading ? <RefreshCw size={18} className="spin" /> : <Mail size={18} />}
                <span>{loading ? "Sending Code to Faculty Gmail..." : "Send Verification Code to Faculty Gmail →"}</span>
              </button>

              <p className="fine quiet" style={{ textAlign: "center", marginTop: 8 }}>
                Already registered?{" "}
                <button
                  type="button"
                  onClick={() => setFacultyMode("signin")}
                  className="link-btn"
                  style={{ color: "#087f79", fontWeight: 600, background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}
                >
                  Sign in here
                </button>
              </p>
            </form>
          )}

          {/* FACULTY SIGN UP: STAGE 2 */}
          {facultyMode === "signup" && facultyStage === "verify" && (
            <form onSubmit={handleFacultyVerifyAndCreateAccount} className="student-gateway-form stack">
              <div style={{ background: "color-mix(in srgb, var(--c-accent) 8%, var(--c-paper))", padding: "0.85rem 1rem", borderRadius: "0.85rem", border: "1px solid var(--c-accent)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: "0.78rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--c-accent)" }}>
                    Faculty Verification Code Sent
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setFacultyStage("details");
                      setError("");
                    }}
                    style={{ background: "none", border: "none", color: "var(--muted, #64748b)", fontSize: "0.78rem", cursor: "pointer", textDecoration: "underline" }}
                  >
                    Change Email
                  </button>
                </div>
                <div style={{ fontSize: "0.88rem", fontWeight: 600, color: "var(--c-ink)" }}>
                  {facultyEmail}
                </div>
                <div style={{ fontSize: "0.78rem", color: "var(--muted, #64748b)", marginTop: 4 }}>
                  Please check your official inbox for the 6-digit verification code.
                </div>
              </div>

              {facultyDevPreviewCode && (
                <div style={{ background: "#fef3c7", border: "1px solid #f59e0b", padding: "0.6rem 0.85rem", borderRadius: "0.6rem", fontSize: "0.82rem", color: "#92400e" }}>
                  Dev Verification Code: <strong>{facultyDevPreviewCode}</strong>
                </div>
              )}

              <label className="field-label-wrap">
                <span className="field-label">Enter 6-Digit Verification Code</span>
                <input
                  type="text"
                  className="input"
                  required
                  maxLength={6}
                  value={facultyCode}
                  onChange={(e) => setFacultyCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="123456"
                  autoComplete="one-time-code"
                  style={{ fontSize: "1.25rem", letterSpacing: "0.35em", textAlign: "center", fontWeight: 700, fontFamily: "monospace" }}
                />
              </label>

              <label className="field-label-wrap">
                <span className="field-label">Set Your Secure Password</span>
                <div style={{ position: "relative" }}>
                  <input
                    type={showPassword ? "text" : "password"}
                    className="input"
                    required
                    minLength={6}
                    value={facultyPassword}
                    onChange={(e) => setFacultyPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    autoComplete="new-password"
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
                    value={facultyConfirmPassword}
                    onChange={(e) => setFacultyConfirmPassword(e.target.value)}
                    placeholder="Re-enter your password"
                    autoComplete="new-password"
                    style={{ paddingLeft: "2.3rem" }}
                  />
                  <Lock size={16} style={{ position: "absolute", left: 12, top: 13, color: "var(--muted, #64748b)" }} />
                </div>
              </label>

              {/* Pre-Class Notification Lead Time */}
              <label className="field-label-wrap">
                <span className="field-label">Pre-Class Classroom Reminder</span>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 4 }}>
                  <button
                    type="button"
                    className={`btn ${facultyLeadMins === 10 ? "solid" : ""}`}
                    style={{ fontSize: "0.82rem", padding: "0.55rem" }}
                    onClick={() => setFacultyLeadMins(10)}
                  >
                    10 Minutes Before (Recommended)
                  </button>
                  <button
                    type="button"
                    className={`btn ${facultyLeadMins === 5 ? "solid" : ""}`}
                    style={{ fontSize: "0.82rem", padding: "0.55rem" }}
                    onClick={() => setFacultyLeadMins(5)}
                  >
                    5 Minutes Before
                  </button>
                </div>
              </label>

              <label className="admin-checkbox-label" style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.85rem" }}>
                <input
                  type="checkbox"
                  checked={facultyRememberMe}
                  onChange={(e) => setFacultyRememberMe(e.target.checked)}
                />
                <span>Keep me signed in on this device</span>
              </label>

              <button
                type="submit"
                className="btn solid tap student-gateway-submit"
                disabled={loading || facultyCode.length < 6}
              >
                {loading ? <RefreshCw size={18} className="spin" /> : <GraduationCap size={18} />}
                <span>{loading ? "Verifying..." : "Complete Registration & Open Teaching Desk"}</span>
              </button>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.82rem", marginTop: 4 }}>
                <button
                  type="button"
                  disabled={facultyResendCooldown > 0 || loading}
                  onClick={handleFacultyRequestVerificationCode}
                  style={{ background: "none", border: "none", color: facultyResendCooldown > 0 ? "var(--muted, #64748b)" : "#087f79", cursor: facultyResendCooldown > 0 ? "default" : "pointer", fontWeight: 600 }}
                >
                  {facultyResendCooldown > 0 ? `Resend code in ${facultyResendCooldown}s` : "Resend Verification Code"}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setFacultyStage("details");
                    setError("");
                  }}
                  style={{ background: "none", border: "none", color: "var(--muted, #64748b)", cursor: "pointer", textDecoration: "underline" }}
                >
                  ← Back to Details
                </button>
              </div>
            </form>
          )}

          {/* FACULTY SIGN IN FORM */}
          {facultyMode === "signin" && (
            <form onSubmit={handleFacultySignIn} className="student-gateway-form stack">
              <label className="field-label-wrap">
                <span className="field-label">Official University Faculty Email</span>
                <div style={{ position: "relative" }}>
                  <input
                    type="email"
                    className="input"
                    required
                    value={facultyEmail}
                    onChange={(e) => setFacultyEmail(e.target.value)}
                    placeholder="muazzam.maqsood@cuiatk.edu.pk"
                    autoComplete="username"
                    style={{ paddingLeft: "2.3rem" }}
                  />
                  <Mail size={16} style={{ position: "absolute", left: 12, top: 13, color: "var(--muted, #64748b)" }} />
                </div>
              </label>

              <label className="field-label-wrap">
                <span className="field-label">Password</span>
                <div style={{ position: "relative" }}>
                  <input
                    type={showPassword ? "text" : "password"}
                    className="input"
                    required
                    value={facultyPassword}
                    onChange={(e) => setFacultyPassword(e.target.value)}
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
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </label>

              <label className="admin-checkbox-label" style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.85rem" }}>
                <input
                  type="checkbox"
                  checked={facultyRememberMe}
                  onChange={(e) => setFacultyRememberMe(e.target.checked)}
                />
                <span>Keep me signed in on this device</span>
              </label>

              <button
                type="submit"
                className="btn solid tap student-gateway-submit"
                disabled={loading}
              >
                {loading ? <RefreshCw size={18} className="spin" /> : <GraduationCap size={18} />}
                <span>{loading ? "Authenticating..." : "Sign In & Open Teaching Desk"}</span>
              </button>

              <p className="fine quiet" style={{ textAlign: "center", marginTop: 8 }}>
                New faculty member?{" "}
                <button
                  type="button"
                  onClick={() => setFacultyMode("signup")}
                  className="link-btn"
                  style={{ color: "#087f79", fontWeight: 600, background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}
                >
                  Create faculty account here
                </button>
              </p>
            </form>
          )}
        </>
      )}

          {/* Admin Portal Switcher */}
          <div className="student-gateway-footer">
            <button
              type="button"
              className="gateway-admin-btn tap"
              onClick={() => setView("admin")}
            >
              <Lock size={14} />
              <span>Campus Administrator Portal</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
