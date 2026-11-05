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
  type StudentSession,
  type ParsedStudentEmail,
} from "@/lib/student";
import { studentSignUpFn, studentSignInFn } from "@/lib/student-server-fn";
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
      }, 1000);
    } catch {
      setError("Unable to connect to authentication server. Please check your network.");
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");

    if (!fullName.trim() || fullName.trim().length < 2) {
      setError("Please enter your full name (minimum 2 characters).");
      return;
    }
    if (!isValidUniversityEmail(email)) {
      setError("Please enter your official university email (e.g. fa23-bcs-014@cuiatk.edu.pk).");
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
      const res = await studentSignUpFn({
        data: {
          email: email.trim().toLowerCase(),
          fullName: fullName.trim(),
          password,
          defaultBatch: selectedBatch || undefined,
        },
      });

      if (!res.success || !res.session) {
        setError(res.error || "Failed to create account.");
        setLoading(false);
        return;
      }

      setStudentSession(res.session, rememberMe);
      if (selectedBatch) {
        const batchIdx = batches.indexOf(selectedBatch);
        if (batchIdx !== -1) {
          pinBatch(batchIdx);
          setBatchId(batchIdx);
        }
      }

      setSuccessMsg("Account created successfully! Welcome to CUI Attock Timetable.");
      setTimeout(() => {
        onAuthenticated(res.session!);
      }, 1200);
    } catch {
      setError("Unable to register account. Please check your network connection.");
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
            <div className="admin-error-banner" role="alert" style={{ margin: "1rem 1.5rem 0" }}>
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}
          {successMsg && (
            <div className="admin-feedback-banner" style={{ margin: "1rem 1.5rem 0" }}>
              <CheckCircle2 size={16} />
              <span>{successMsg}</span>
            </div>
          )}

          {/* SIGN UP FORM */}
          {mode === "signup" && (
            <form onSubmit={handleSignUp} className="student-gateway-form stack">
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

              <label className="field-label-wrap">
                <span className="field-label">Create Password (min 6 characters)</span>
                <div style={{ position: "relative" }}>
                  <input
                    type={showPassword ? "text" : "password"}
                    className="input"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Choose a secure password"
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
                disabled={loading || !isValidUniversityEmail(email)}
              >
                {loading ? <RefreshCw size={18} className="spin" /> : <ArrowRight size={18} />}
                <span>{loading ? "Creating Account..." : "Create Account & Unlock Timetable"}</span>
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
