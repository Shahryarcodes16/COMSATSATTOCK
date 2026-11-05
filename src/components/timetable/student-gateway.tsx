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
  studentSignUpFn,
  studentSignInFn,
  studentRequestVerificationCodeFn,
  studentVerifyAndSignUpFn,
} from "@/lib/student-server-fn";
import { useDesk } from "@/components/timetable/context";
import { batches } from "@/lib/schedule";

export function StudentGateway({
  onAuthenticated,
}: {
  onAuthenticated: (session: StudentSession) => void;
}) {
  const { setView, pinBatch, setBatchId } = useDesk();
  // Default to signup as requested: "first student create a signup then all features shown"
  const [mode, setMode] = useState<"signup" | "signin">("signup");

  // Signup Stages: "details" -> "verify"
  const [signupStage, setSignupStage] = useState<"details" | "verify">("details");
  const [verificationCode, setVerificationCode] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);
  const [devPreviewCode, setDevPreviewCode] = useState<string | null>(null);

  // Form State
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [selectedBatch, setSelectedBatch] = useState<string>("");
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

  // Status & Feedback
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Extracted student info for preview
  const parsedEmail: ParsedStudentEmail | null = parseUniversityEmail(email);

  // Available batches matching the student's program (e.g. BS(CS)-I through VIII)
  const programBatches = parsedEmail
    ? batches.filter((b) => b.toLowerCase().includes(parsedEmail.program.batchPrefix.toLowerCase()))
    : [];

  // Magic Link auto-detection from URL: ?verify_email=...&code=...
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const verifyEmail = params.get("verify_email");
    const code = params.get("code");
    if (verifyEmail && isValidUniversityEmail(verifyEmail)) {
      setEmail(verifyEmail);
      setMode("signup");
      setSignupStage("verify");
      if (code) {
        setVerificationCode(code);
        setSuccessMsg("Magic Link Verified: Please set your secure password to complete your account.");
      }
    }
  }, []);

  // 60-second resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

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
        if (res.credentialSync) {
          saveLocalRegisteredAccount(res.credentialSync);
        }
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

      // Check device local registry vault (recovers accounts across serverless cold starts)
      const localAccount = getLocalRegisteredAccount(normalizedEmail);
      if (localAccount) {
        const matches = await verifyClientPassword(
          password,
          localAccount.passwordHash,
          localAccount.passwordSalt,
        );

        if (matches) {
          const parsed = parseUniversityEmail(localAccount.email);
          const profile: StudentProfile = {
            id: `stu-${Date.now()}`,
            email: localAccount.email,
            fullName: localAccount.fullName,
            session: parsed?.session || "FA",
            year: parsed?.year || "23",
            programCode: parsed?.programCode || "bcs",
            rollNumber: parsed?.rollNumber || "014",
            regNo: parsed?.regNo || localAccount.email.split("@")[0].toUpperCase(),
            programTitle: parsed?.program.name || "BS Computer Science",
            department: parsed?.program.department || "COMSATS Attock",
            defaultBatch: localAccount.defaultBatch,
            createdAt: localAccount.registeredAt || new Date().toISOString(),
          };

          const session: StudentSession = {
            profile,
            token: `cui-stu-local-${Date.now()}`,
            signedInAt: new Date().toISOString(),
          };

          setStudentSession(session, rememberMe);

          // Silently re-seed serverless instance in the background
          studentSignUpFn({
            data: {
              email: localAccount.email,
              fullName: localAccount.fullName,
              password,
              defaultBatch: localAccount.defaultBatch || undefined,
            },
          }).catch(() => {});

          if (profile.defaultBatch) {
            const batchIdx = batches.indexOf(profile.defaultBatch);
            if (batchIdx !== -1) {
              pinBatch(batchIdx);
              setBatchId(batchIdx);
            }
          }

          setSuccessMsg(`Welcome back, ${profile.fullName}! Unlocking campus workspace...`);
          setTimeout(() => {
            onAuthenticated(session);
          }, 900);
          return;
        } else {
          setError("Incorrect password for this student account. Please verify and try again.");
          setLoading(false);
          return;
        }
      }

      setError(res.error || "Authentication failed. Please verify credentials.");
      setLoading(false);
    } catch {
      // Offline fallback: check local vault
      const localAccount = getLocalRegisteredAccount(normalizedEmail);
      if (localAccount) {
        const matches = await verifyClientPassword(
          password,
          localAccount.passwordHash,
          localAccount.passwordSalt,
        );
        if (matches) {
          const parsed = parseUniversityEmail(localAccount.email);
          const profile: StudentProfile = {
            id: `stu-${Date.now()}`,
            email: localAccount.email,
            fullName: localAccount.fullName,
            session: parsed?.session || "FA",
            year: parsed?.year || "23",
            programCode: parsed?.programCode || "bcs",
            rollNumber: parsed?.rollNumber || "014",
            regNo: parsed?.regNo || localAccount.email.split("@")[0].toUpperCase(),
            programTitle: parsed?.program.name || "BS Computer Science",
            department: parsed?.program.department || "COMSATS Attock",
            defaultBatch: localAccount.defaultBatch,
            createdAt: localAccount.registeredAt || new Date().toISOString(),
          };
          const session: StudentSession = {
            profile,
            token: `cui-stu-offline-${Date.now()}`,
            signedInAt: new Date().toISOString(),
          };
          setStudentSession(session, rememberMe);
          setSuccessMsg(`Welcome back, ${profile.fullName}!`);
          setTimeout(() => {
            onAuthenticated(session);
          }, 800);
          return;
        }
      }
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

        {/* Auth Card */}
        <div className="student-gateway-card">
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
                    className="input"
                    value={selectedBatch}
                    onChange={(e) => setSelectedBatch(e.target.value)}
                  >
                    {programBatches.map((b) => (
                      <option key={b} value={b}>
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
