import { useState, useEffect, useMemo } from "react";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Briefcase,
  Building2,
  Calendar,
  CalendarCheck,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  DoorOpen,
  Eye,
  EyeOff,
  GraduationCap,
  Info,
  Lock,
  LogOut,
  Megaphone,
  Plus,
  RefreshCw,
  Search,
  Share2,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Table,
  Trash2,
  UserCheck,
  Users,
  X,
  XCircle,
  Zap,
} from "lucide-react";
import { useDesk } from "@/components/timetable/context";
import {
  getActiveCoordinatorSession,
  setCoordinatorSession,
  clearCoordinatorSession,
  coordinatorArrangeClass,
  coordinatorCancelArrangedClass,
  isCoordinatorEmail,
  getLocalCoordinatorAccount,
  saveLocalCoordinatorAccount,
  verifyCoordinatorPasswordClient,
  hashCoordinatorPasswordClient,
  generateCoordinatorSalt,
  type CoordinatorSession,
} from "@/lib/coordinator";
import {
  coordinatorSignInFn,
  coordinatorRequestVerificationCodeFn,
  coordinatorVerifyAndSignUpFn,
} from "@/lib/coordinator-server-fn";
import {
  batches,
  rooms,
  teachers,
  subjects,
  DAYS,
  DAY_SHORT,
  SLOTS,
  rangeLabel,
  forBatch,
  roomGroup,
  type ClassEntry,
  type RoomGroup,
} from "@/lib/schedule";
import {
  computeScheduleOverlap,
  type SlotComparisonResult,
  type FreeRoomInfo,
} from "@/lib/schedule-matcher";
import {
  getActiveArrangedMakeupClasses,
  type MakeupClassRecord,
} from "@/lib/makeup-classes";
import { FreeRoomsRadar } from "@/components/timetable/room-radar";

export function CoordinatorWorkspaceView() {
  const { setView, open, makeupRevision, goBack } = useDesk();
  const [session, setSession] = useState<CoordinatorSession | null>(() => getActiveCoordinatorSession());

  // Authentication state (if not logged in)
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [authStage, setAuthStage] = useState<"details" | "verify">("details");
  const [emailInput, setEmailInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [confirmPasswordInput, setConfirmPasswordInput] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [designationInput, setDesignationInput] = useState("Academic Timetable Coordinator");
  const [verificationCodeInput, setVerificationCodeInput] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loginError, setLoginError] = useState("");
  const [authSuccessMsg, setAuthSuccessMsg] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  // Active workspace tabs: "arrange" | "registry" | "radar"
  const [activeTab, setActiveTab] = useState<"arrange" | "registry" | "radar">("arrange");

  // Arranging a class state
  const [studentName, setStudentName] = useState("");
  const [studentRegNo, setStudentRegNo] = useState("");
  const [arrangementReason, setArrangementReason] = useState("");

  const [selectedBatchId, setSelectedBatchId] = useState<number>(0);
  const [selectedTeacherId, setSelectedTeacherId] = useState<number>(0);
  const [selectedSubjectId, setSelectedSubjectId] = useState<number>(0);

  const [batchSearch, setBatchSearch] = useState("");
  const [teacherSearch, setTeacherSearch] = useState("");

  const [matcherViewMode, setMatcherViewMode] = useState<"matrix" | "cards">("cards");
  const [filterOnlyFree, setFilterOnlyFree] = useState(false);
  const [selectedSlotDetails, setSelectedSlotDetails] = useState<SlotComparisonResult | null>(null);
  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(null);
  const [roomCategoryFilter, setRoomCategoryFilter] = useState<"all" | "labs" | "lts" | "crs">("all");

  const [isArranging, setIsArranging] = useState(false);
  const [successFeedback, setSuccessFeedback] = useState<string | null>(null);
  const [generatedNotice, setGeneratedNotice] = useState<string | null>(null);
  const [copiedNotice, setCopiedNotice] = useState(false);

  // Active arranged classes
  const [activeMakeups, setActiveMakeups] = useState<MakeupClassRecord[]>(() => getActiveArrangedMakeupClasses());
  const [cancelRevision, setCancelRevision] = useState(0);

  useEffect(() => {
    const handleUpdate = () => {
      setActiveMakeups(getActiveArrangedMakeupClasses());
      setCancelRevision((r) => r + 1);
    };
    window.addEventListener("cui:makeup-classes-updated", handleUpdate);
    window.addEventListener("cui:class-cancellations-updated", handleUpdate);
    window.addEventListener("storage", handleUpdate);
    return () => {
      window.removeEventListener("cui:makeup-classes-updated", handleUpdate);
      window.removeEventListener("cui:class-cancellations-updated", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, []);

  // Filtered batch & teacher lists
  const filteredBatches = useMemo(() => {
    if (!batchSearch.trim()) return batches.map((name, id) => ({ id, name }));
    const q = batchSearch.toLowerCase().trim();
    return batches
      .map((name, id) => ({ id, name }))
      .filter((b) => b.name.toLowerCase().includes(q));
  }, [batchSearch]);

  const filteredTeachers = useMemo(() => {
    if (!teacherSearch.trim()) return teachers.map((name, id) => ({ id, name }));
    const q = teacherSearch.toLowerCase().trim();
    return teachers
      .map((name, id) => ({ id, name }))
      .filter((t) => t.name.toLowerCase().includes(q));
  }, [teacherSearch]);

  // Suggested subjects for chosen batch
  const suggestedSubjectIds = useMemo(() => {
    const set = new Set<number>();
    for (const e of forBatch(selectedBatchId)) {
      set.add(e.subject);
    }
    return Array.from(set).sort((a, b) => a - b);
  }, [selectedBatchId]);

  // When batch changes, default subject to first offering
  useEffect(() => {
    if (suggestedSubjectIds.length > 0) {
      setSelectedSubjectId(suggestedSubjectIds[0]);
    }
  }, [suggestedSubjectIds]);

  // Overlap comparison between selected teacher and selected batch
  const comparison = useMemo(() => {
    return computeScheduleOverlap(selectedTeacherId, selectedBatchId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTeacherId, selectedBatchId, makeupRevision, cancelRevision]);

  const allMutualFreeSlots = useMemo(() => {
    if (!comparison) return [];
    const list: SlotComparisonResult[] = [];
    for (let d = 0; d < 5; d++) {
      for (let s = 0; s < 5; s++) {
        const item = comparison.matrix[d][s];
        if (item.isBothFree) {
          list.push(item);
        }
      }
    }
    return list;
  }, [comparison]);

  // Official Coordinator Sign In Handler
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    setAuthSuccessMsg("");

    const cleanEmail = emailInput.trim().toLowerCase();
    if (!cleanEmail || !isCoordinatorEmail(cleanEmail)) {
      setLoginError("Please enter your official university email (@cuiatk.edu.pk, @ciit-attock.edu.pk).");
      return;
    }
    if (!passwordInput) {
      setLoginError("Please enter your password.");
      return;
    }

    setIsLoggingIn(true);
    try {
      const localVault = getLocalCoordinatorAccount(cleanEmail);
      const res = await coordinatorSignInFn({
        data: {
          email: cleanEmail,
          password: passwordInput,
          clientVaultAccount: localVault || undefined,
        },
      });

      if (!res.success || !res.session) {
        if (localVault) {
          const valid = await verifyCoordinatorPasswordClient(
            passwordInput,
            localVault.passwordHash,
            localVault.passwordSalt,
          );
          if (valid) {
            const fallbackSession: CoordinatorSession = {
              role: "coordinator",
              profile: {
                id: localVault.id || `coord_${Date.now()}`,
                email: localVault.email,
                fullName: localVault.fullName,
                department: localVault.department || "Academic & Timetable Coordination Office",
                designation: localVault.designation || "Academic Timetable Coordinator",
                createdAt: localVault.registeredAt || new Date().toISOString(),
              },
              token: `cui-coord-${Date.now()}`,
              signedInAt: new Date().toISOString(),
            };
            setCoordinatorSession(fallbackSession, rememberMe);
            setSession(fallbackSession);
            return;
          }
        }
        setLoginError(res.error || "Invalid coordinator email or password.");
        return;
      }

      if (res.credentialSync) {
        saveLocalCoordinatorAccount({
          id: res.session.profile.id,
          email: res.credentialSync.email,
          fullName: res.credentialSync.fullName,
          department: res.credentialSync.department,
          designation: res.credentialSync.designation,
          passwordHash: res.credentialSync.passwordHash,
          passwordSalt: res.credentialSync.passwordSalt,
          registeredAt: res.session.profile.createdAt,
        });
      }

      setCoordinatorSession(res.session, rememberMe);
      setSession(res.session);
    } catch (err: any) {
      const localVault = getLocalCoordinatorAccount(cleanEmail);
      if (localVault) {
        const valid = await verifyCoordinatorPasswordClient(
          passwordInput,
          localVault.passwordHash,
          localVault.passwordSalt,
        );
        if (valid) {
          const fallbackSession: CoordinatorSession = {
            role: "coordinator",
            profile: {
              id: localVault.id || `coord_${Date.now()}`,
              email: localVault.email,
              fullName: localVault.fullName,
              department: localVault.department || "Academic & Timetable Coordination Office",
              designation: localVault.designation || "Academic Timetable Coordinator",
              createdAt: localVault.registeredAt || new Date().toISOString(),
            },
            token: `cui-coord-${Date.now()}`,
            signedInAt: new Date().toISOString(),
          };
          setCoordinatorSession(fallbackSession, rememberMe);
          setSession(fallbackSession);
          return;
        }
      }
      setLoginError(err?.message || "Failed to sign in. Please verify your credentials.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Official Coordinator Code Request Handler
  const handleRequestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    setAuthSuccessMsg("");

    const cleanEmail = emailInput.trim().toLowerCase();
    if (!cleanEmail || !isCoordinatorEmail(cleanEmail)) {
      setLoginError("Official email must belong to @cuiatk.edu.pk or @ciit-attock.edu.pk. Student emails cannot register as coordinator.");
      return;
    }
    if (!nameInput.trim() || nameInput.trim().length < 2) {
      setLoginError("Please enter your official full name.");
      return;
    }
    if (passwordInput.length < 6) {
      setLoginError("Password must be at least 6 characters long.");
      return;
    }
    if (passwordInput !== confirmPasswordInput) {
      setLoginError("Passwords do not match.");
      return;
    }

    setIsLoggingIn(true);
    try {
      const origin = typeof window !== "undefined" ? window.location.origin : undefined;
      const res = await coordinatorRequestVerificationCodeFn({
        data: {
          email: cleanEmail,
          fullName: nameInput.trim(),
          department: "Academic & Timetable Coordination Office",
          designation: designationInput.trim(),
          originUrl: origin,
        },
      });

      if (!res.success) {
        setLoginError(res.error || "Failed to dispatch verification code.");
        return;
      }

      setAuthStage("verify");
      setResendCooldown(60);
      setAuthSuccessMsg(res.message || `A 6-digit verification code has been dispatched to ${cleanEmail}. Please check your official university inbox.`);
    } catch (err: any) {
      setLoginError(err?.message || "Failed to dispatch verification code. Please check your network and try again.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Official Coordinator Verify & Sign Up Handler
  const handleVerifyAndSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    setAuthSuccessMsg("");

    const cleanEmail = emailInput.trim().toLowerCase();
    if (!verificationCodeInput.trim() || verificationCodeInput.trim().length !== 6) {
      setLoginError("Please enter the 6-digit verification code sent to your official email.");
      return;
    }

    setIsLoggingIn(true);
    try {
      const res = await coordinatorVerifyAndSignUpFn({
        data: {
          email: cleanEmail,
          code: verificationCodeInput.trim(),
          password: passwordInput,
          department: "Academic & Timetable Coordination Office",
          designation: designationInput.trim(),
        },
      });

      if (!res?.success || !res?.session) {
        setLoginError(res?.error || "Failed to create coordinator account.");
        return;
      }

      if (res.credentialSync) {
        saveLocalCoordinatorAccount({
          id: res.session.profile.id,
          email: res.credentialSync.email,
          fullName: res.credentialSync.fullName,
          department: res.credentialSync.department,
          designation: res.credentialSync.designation,
          passwordHash: res.credentialSync.passwordHash,
          passwordSalt: res.credentialSync.passwordSalt,
          registeredAt: res.session.profile.createdAt,
        });
      }

      setCoordinatorSession(res.session, rememberMe);
      setSession(res.session);
    } catch (err: any) {
      setLoginError(err?.message || "Verification failed. Please check the 6-digit code sent to your official email.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    clearCoordinatorSession();
    setSession(null);
  };

  // Generate official WhatsApp broadcast text for student/CR
  const formatOfficialNotice = (
    dayIdx: number,
    slotIdx: number,
    roomName: string,
    batchName: string,
    teacherName: string,
    subjectName: string,
    reqStudent: string,
    reason: string,
  ) => {
    const dayName = DAYS[dayIdx];
    const slotInfo = SLOTS[slotIdx];
    return (
      `📢 *OFFICIAL NOTICE: Class Arranged by Academic Coordinator*\n` +
      `COMSATS University Islamabad, Attock Campus\n\n` +
      `• *Course:* ${subjectName}\n` +
      `• *Batch:* ${batchName}\n` +
      `• *Instructor:* ${teacherName}\n` +
      `• *Day & Time:* ${dayName}, ${slotInfo.start} - ${slotInfo.end} (${slotInfo.label})\n` +
      `• *Venue / Room:* ${roomName}\n` +
      (reqStudent ? `• *Arranged for Student/CR:* ${reqStudent}\n` : "") +
      (reason ? `• *Purpose:* ${reason}\n` : "") +
      `\n⚠️ *Attendance:* All students of ${batchName} are notified to attend. Timetable schedules on FORTIS have been updated in real-time.`
    );
  };

  // Confirm and arrange official class
  const handleConfirmArrangement = async () => {
    if (!selectedSlotDetails || selectedRoomId === null) return;

    setIsArranging(true);
    setSuccessFeedback(null);

    const bName = batches[selectedBatchId];
    const tName = teachers[selectedTeacherId];
    const sName = subjects[selectedSubjectId] || "Course";
    const rName = rooms[selectedRoomId];

    const studentInfo = [studentRegNo.trim(), studentName.trim()].filter(Boolean).join(" - ");

    const res = await coordinatorArrangeClass({
      day: selectedSlotDetails.day,
      slot: selectedSlotDetails.slot,
      batch: selectedBatchId,
      room: selectedRoomId,
      teacher: selectedTeacherId,
      subject: selectedSubjectId,
      studentRequesterName: studentName.trim() || undefined,
      studentRequesterRegNo: studentRegNo.trim().toUpperCase() || undefined,
      reason: arrangementReason.trim() || undefined,
    });

    setIsArranging(false);

    if (!res.success) {
      alert(res.error || "Failed to schedule class. Please verify room availability.");
      return;
    }

    const noticeText = formatOfficialNotice(
      selectedSlotDetails.day,
      selectedSlotDetails.slot,
      rName,
      bName,
      tName,
      sName,
      studentInfo,
      arrangementReason,
    );

    setGeneratedNotice(noticeText);
    setSuccessFeedback(
      `🎉 Class successfully arranged for ${bName} in ${rName}! Whole campus timetable has been updated in real-time.`,
    );

    // Refresh active list
    setActiveMakeups(getActiveArrangedMakeupClasses());

    // Reset selection drawer
    setSelectedSlotDetails(null);
    setSelectedRoomId(null);
  };

  // Cancel an arranged class
  const handleCancelArrangedClass = async (id: string, label: string) => {
    if (!window.confirm(`Are you sure you want to cancel this arranged class?\n\n"${label}"\n\nThe venue and teacher will be instantly released as free.`)) {
      return;
    }

    await coordinatorCancelArrangedClass(id);
    setActiveMakeups(getActiveArrangedMakeupClasses());
  };

  // If coordinator is not logged in, render the official authentication gateway
  if (!session) {
    return (
      <div className="page coordinator-login-page stack" style={{ maxWidth: 540, margin: "2rem auto", padding: "1rem" }}>
        <div className="view-header-row">
          <button
            type="button"
            className="btn tap view-back-btn"
            onClick={() => goBack("today")}
          >
            <ArrowLeft size={16} aria-hidden />
            <span>Back to Timetable</span>
          </button>
        </div>

        <div className="coordinator-auth-card stack" style={{
          background: "var(--c-paper)",
          border: "1px solid var(--c-line)",
          borderRadius: "1.25rem",
          padding: "2rem",
          boxShadow: "0 12px 32px rgba(0, 0, 0, 0.08)",
          gap: "1.25rem"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.85rem" }}>
            <div style={{
              width: 48,
              height: 48,
              borderRadius: "1rem",
              background: "color-mix(in srgb, var(--c-accent) 15%, transparent)",
              color: "var(--c-accent)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}>
              <Briefcase size={26} />
            </div>
            <div>
              <span className="eyebrow" style={{ color: "var(--c-accent)", fontWeight: 800 }}>OFFICIAL FACULTY & STAFF ACCESS</span>
              <h1 style={{ fontSize: "1.35rem", fontWeight: 900, margin: 0, color: "var(--c-ink)" }}>
                Academic Coordinator Desk
              </h1>
            </div>
          </div>

          <p className="quiet" style={{ fontSize: "0.88rem", margin: 0, lineHeight: 1.5 }}>
            Authorized portal for the University Academic & Timetable Coordination Office. Login or create an account with your official university email (<code>@cuiatk.edu.pk</code>).
          </p>

          {/* Switcher Tabs */}
          <div className="student-gateway-tabs" style={{ marginBottom: "0.5rem" }}>
            <button
              type="button"
              className={`gateway-tab-btn ${authMode === "signin" ? "active" : ""}`}
              onClick={() => {
                setAuthMode("signin");
                setLoginError("");
                setAuthSuccessMsg("");
              }}
            >
              <Briefcase size={16} />
              <span>Coordinator Sign In</span>
            </button>
            <button
              type="button"
              className={`gateway-tab-btn ${authMode === "signup" ? "active" : ""}`}
              onClick={() => {
                setAuthMode("signup");
                setAuthStage("details");
                setLoginError("");
                setAuthSuccessMsg("");
              }}
            >
              <Sparkles size={16} />
              <span>Register Account</span>
            </button>
          </div>

          {loginError && (
            <div className="admin-error-banner" role="alert" style={{ margin: 0 }}>
              <AlertCircle size={16} />
              <span>{loginError}</span>
            </div>
          )}

          {authSuccessMsg && (
            <div className="admin-success-banner" role="status" style={{ margin: 0 }}>
              <CheckCircle2 size={16} />
              <span>{authSuccessMsg}</span>
            </div>
          )}

          {authMode === "signin" ? (
            /* --- Sign In Form --- */
            <form onSubmit={handleSignIn} className="stack" style={{ gap: "1rem" }}>
              <label className="stack" style={{ gap: "0.35rem" }}>
                <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--c-ink)" }}>Official University Email</span>
                <input
                  type="email"
                  className="input"
                  placeholder="e.g. coordinator@cuiatk.edu.pk"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  required
                  autoComplete="username"
                />
                {isCoordinatorEmail(emailInput) ? (
                  <span className="fine" style={{ color: "#087f79", display: "flex", alignItems: "center", gap: 4 }}>
                    <CheckCircle2 size={13} />
                    Verified official university domain
                  </span>
                ) : (
                  emailInput.length > 5 && (
                    <span className="fine quiet" style={{ color: "#d97706" }}>
                      Must be official domain: <code>@cuiatk.edu.pk</code> or <code>@ciit-attock.edu.pk</code>
                    </span>
                  )
                )}
              </label>

              <label className="stack" style={{ gap: "0.35rem" }}>
                <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--c-ink)" }}>Password</span>
                <div style={{ position: "relative" }}>
                  <input
                    type={showPassword ? "text" : "password"}
                    className="input"
                    placeholder="Enter coordinator account password"
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: "absolute",
                      right: 10,
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "none",
                      border: "none",
                      color: "var(--c-muted)",
                      cursor: "pointer",
                    }}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </label>

              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.85rem", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                <span>Keep me signed in on this device</span>
              </label>

              <button
                type="submit"
                className="btn solid tap btn-lg"
                disabled={isLoggingIn}
                style={{
                  width: "100%",
                  background: "var(--c-accent)",
                  color: "var(--c-on-accent)",
                  marginTop: "0.5rem",
                }}
              >
                {isLoggingIn ? <RefreshCw size={17} className="spin" /> : <Lock size={17} />}
                <span>Sign In &amp; Open Desk</span>
              </button>

              <div style={{ textAlign: "center", marginTop: 4 }}>
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode("signup");
                    setAuthStage("details");
                    setLoginError("");
                  }}
                  className="link-btn"
                  style={{ color: "var(--c-accent)", fontWeight: 600, background: "none", border: "none", cursor: "pointer", fontSize: "0.82rem", textDecoration: "underline" }}
                >
                  Need an account? Register with official email
                </button>
              </div>
            </form>
          ) : (
            /* --- Registration Flow --- */
            authStage === "details" ? (
              <form onSubmit={handleRequestCode} className="stack" style={{ gap: "1rem" }}>
                <label className="stack" style={{ gap: "0.35rem" }}>
                  <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--c-ink)" }}>Official University Email</span>
                  <input
                    type="email"
                    className="input"
                    placeholder="e.g. farooq.ahmed@cuiatk.edu.pk"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    required
                    autoComplete="username"
                  />
                  {isCoordinatorEmail(emailInput) ? (
                    <span className="fine" style={{ color: "#087f79", display: "flex", alignItems: "center", gap: 4 }}>
                      <CheckCircle2 size={13} />
                      Verified official coordinator/faculty domain
                    </span>
                  ) : (
                    emailInput.length > 5 && (
                      <span className="fine quiet" style={{ color: "#d97706" }}>
                        Must be official domain: <code>@cuiatk.edu.pk</code> or <code>@ciit-attock.edu.pk</code>
                      </span>
                    )
                  )}
                </label>

                <label className="stack" style={{ gap: "0.35rem" }}>
                  <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--c-ink)" }}>Official Full Name</span>
                  <input
                    type="text"
                    className="input"
                    placeholder="e.g. Dr. Farooq Ahmed"
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    required
                  />
                </label>

                <label className="stack" style={{ gap: "0.35rem" }}>
                  <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--c-ink)" }}>Designation / Office Role</span>
                  <input
                    type="text"
                    className="input"
                    placeholder="e.g. Timetable Coordinator / Academic Officer"
                    value={designationInput}
                    onChange={(e) => setDesignationInput(e.target.value)}
                    required
                  />
                </label>

                <label className="stack" style={{ gap: "0.35rem" }}>
                  <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--c-ink)" }}>Create Password</span>
                  <input
                    type={showPassword ? "text" : "password"}
                    className="input"
                    placeholder="Minimum 6 characters"
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    required
                    autoComplete="new-password"
                  />
                </label>

                <label className="stack" style={{ gap: "0.35rem" }}>
                  <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--c-ink)" }}>Confirm Password</span>
                  <input
                    type={showPassword ? "text" : "password"}
                    className="input"
                    placeholder="Re-enter password"
                    value={confirmPasswordInput}
                    onChange={(e) => setConfirmPasswordInput(e.target.value)}
                    required
                    autoComplete="new-password"
                  />
                </label>

                <button
                  type="submit"
                  className="btn solid tap btn-lg"
                  disabled={isLoggingIn}
                  style={{
                    width: "100%",
                    background: "var(--c-accent)",
                    color: "var(--c-on-accent)",
                    marginTop: "0.5rem",
                  }}
                >
                  {isLoggingIn ? <RefreshCw size={17} className="spin" /> : <ArrowRight size={17} />}
                  <span>Send Verification Code</span>
                </button>
              </form>
            ) : (
              /* --- Registration Verify Code --- */
              <form onSubmit={handleVerifyAndSignUp} className="stack" style={{ gap: "1rem" }}>
                <div style={{ textAlign: "center", marginBottom: 4 }}>
                  <p className="fine quiet" style={{ margin: 0 }}>
                    Enter the 6-digit code sent to <strong>{emailInput}</strong>
                  </p>
                </div>

                <label className="stack" style={{ gap: "0.35rem" }}>
                  <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--c-ink)" }}>6-Digit Verification Code</span>
                  <input
                    type="text"
                    maxLength={6}
                    className="input"
                    placeholder="e.g. 741829"
                    value={verificationCodeInput}
                    onChange={(e) => setVerificationCodeInput(e.target.value.replace(/\D/g, ""))}
                    required
                    style={{ letterSpacing: "4px", fontSize: "1.1rem", fontWeight: 700, textAlign: "center" }}
                  />
                </label>

                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem" }}>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthStage("details");
                      setLoginError("");
                    }}
                    className="link-btn"
                    style={{ color: "var(--c-muted)", background: "none", border: "none", cursor: "pointer" }}
                  >
                    ← Edit Details
                  </button>

                  <button
                    type="button"
                    disabled={resendCooldown > 0}
                    onClick={async () => {
                      if (resendCooldown > 0) return;
                      setResendCooldown(60);
                      try {
                        const origin = typeof window !== "undefined" ? window.location.origin : undefined;
                        const res = await coordinatorRequestVerificationCodeFn({
                          data: {
                            email: emailInput.trim().toLowerCase(),
                            fullName: nameInput.trim(),
                            department: "Academic & Timetable Coordination Office",
                            designation: designationInput.trim(),
                            originUrl: origin,
                          },
                        });
                        if (res.success) {
                          setAuthSuccessMsg(res.message || "Fresh code dispatched to your official email.");
                        } else {
                          setLoginError(res.error || "Failed to dispatch verification code.");
                        }
                      } catch (err: any) {
                        setLoginError(err?.message || "Failed to resend code. Please check your network.");
                      }
                    }}
                    className="link-btn"
                    style={{
                      color: resendCooldown > 0 ? "var(--c-muted)" : "var(--c-accent)",
                      fontWeight: 600,
                      background: "none",
                      border: "none",
                      cursor: resendCooldown > 0 ? "default" : "pointer",
                    }}
                  >
                    {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend Code"}
                  </button>
                </div>

                <button
                  type="submit"
                  className="btn solid tap btn-lg"
                  disabled={isLoggingIn || verificationCodeInput.length !== 6}
                  style={{
                    width: "100%",
                    background: "var(--c-accent)",
                    color: "var(--c-on-accent)",
                    marginTop: "0.5rem",
                  }}
                >
                  {isLoggingIn ? <RefreshCw size={17} className="spin" /> : <CheckCircle2 size={17} />}
                  <span>Verify Email &amp; Open Desk</span>
                </button>
              </form>
            )
          )}
        </div>
      </div>
    );
  }

  // Coordinator is logged in: Executive Workspace
  return (
    <div className="page coordinator-workspace-page stack" style={{ gap: "1.5rem", paddingBottom: "3rem" }}>
      {/* Executive Header */}
      <div className="panel-head" style={{ borderBottom: "1px solid var(--c-line)", paddingBottom: "1.25rem" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap", marginBottom: "0.4rem" }}>
            <span style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.4rem",
              padding: "0.25rem 0.65rem",
              borderRadius: "999px",
              background: "color-mix(in srgb, var(--c-accent) 15%, transparent)",
              color: "var(--c-accent)",
              fontSize: "0.75rem",
              fontWeight: 800,
              letterSpacing: "0.04em",
              textTransform: "uppercase"
            }}>
              <ShieldCheck size={14} />
              COMSATS Attock Academic Authority
            </span>
            <span style={{ fontSize: "0.78rem", color: "var(--c-muted)" }}>
              Signed in as <strong>{session.profile?.fullName || session.profile?.email}</strong> ({session.profile?.email})
            </span>
          </div>

          <h1 className="page-title" style={{ margin: "0 0 0.4rem" }}>
            Class Arrangement &amp; Timetable Adjustment Desk
          </h1>
          <p className="quiet" style={{ margin: 0, maxWidth: 740, fontSize: "0.92rem", lineHeight: 1.5 }}>
            When students or CRs request a class, select the batch, instructor, and course. FORTIS discovers mutual free slots and vacant labs/halls so you can arrange the lecture instantly across the campus routine.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
          <button
            type="button"
            className="btn tap"
            onClick={handleLogout}
            style={{ fontSize: "0.82rem", color: "var(--c-muted)" }}
            title="Sign out of Coordinator Desk"
          >
            <LogOut size={15} />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {/* Tabs Switcher: Arrange New Class vs Active Registry vs Live Radar */}
      <div className="faculty-view-tabs tabs-3" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "arrange"}
          className={`tab-btn tap ${activeTab === "arrange" ? "tab-btn-active" : ""}`}
          onClick={() => setActiveTab("arrange")}
        >
          <Sparkles size={16} />
          <span className="tab-label-full">⚡ Arrange Class for Student</span>
          <span className="tab-label-short">⚡ Arrange</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "registry"}
          className={`tab-btn tap ${activeTab === "registry" ? "tab-btn-active" : ""}`}
          onClick={() => setActiveTab("registry")}
        >
          <CalendarCheck size={16} />
          <span className="tab-label-full">📋 Arranged Registry ({activeMakeups.length})</span>
          <span className="tab-label-short">📋 Registry ({activeMakeups.length})</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "radar"}
          className={`tab-btn tap ${activeTab === "radar" ? "tab-btn-active" : ""}`}
          onClick={() => setActiveTab("radar")}
        >
          <Zap size={16} />
          <span className="tab-label-full">🔍 Campus Rooms Live Radar</span>
          <span className="tab-label-short">🔍 Radar</span>
        </button>
      </div>

      {/* Success Banner Feedback & WhatsApp Circular Sharing */}
      {successFeedback && (
        <div className="admin-feedback-banner stack" role="alert" style={{ background: "color-mix(in srgb, #10b981 12%, var(--c-paper))", border: "1.5px solid #10b981", padding: "1rem 1.25rem", borderRadius: "1rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <CheckCircle2 size={20} color="#10b981" />
            <strong style={{ color: "#065f46", fontSize: "0.95rem" }}>{successFeedback}</strong>
          </div>

          {generatedNotice && (
            <div style={{ marginTop: "0.6rem", display: "flex", gap: "0.6rem", flexWrap: "wrap", alignItems: "center" }}>
              <button
                type="button"
                className="btn solid sm tap"
                onClick={() => {
                  navigator.clipboard.writeText(generatedNotice);
                  setCopiedNotice(true);
                  setTimeout(() => setCopiedNotice(false), 2500);
                }}
                style={{ background: "var(--c-accent)", color: "var(--c-on-accent)" }}
              >
                {copiedNotice ? <Check size={14} /> : <Copy size={14} />}
                <span>{copiedNotice ? "Notice Copied!" : "Copy Official WhatsApp Notice"}</span>
              </button>

              <a
                href={`https://api.whatsapp.com/send?text=${encodeURIComponent(generatedNotice)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="whatsapp-share-pill"
              >
                <Share2 size={13} />
                <span>Send Notice to Student/CR on WhatsApp</span>
              </a>

              <button
                type="button"
                className="btn sm tap"
                onClick={() => setSuccessFeedback(null)}
                style={{ marginLeft: "auto" }}
              >
                Dismiss
              </button>
            </div>
          )}
        </div>
      )}

      {/* TAB 1: Arrange New Class */}
      {activeTab === "arrange" && (
        <div className="coordinator-arrange-desk stack" style={{ gap: "1.5rem" }}>
          {/* Step 1: Student Requester & Class Parameters */}
          <div className="zero-clash-card stack" style={{ gap: "1.25rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", borderBottom: "1px solid var(--c-line)", paddingBottom: "0.85rem" }}>
              <span className="zero-clash-step-num">1</span>
              <div>
                <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 800 }}>Student Request & Target Class</h3>
                <p className="quiet" style={{ margin: 0, fontSize: "0.82rem" }}>
                  Record the student or CR who requested this session and choose the batch, instructor, and course.
                </p>
              </div>
            </div>

            {/* Student Requester Info (Audit trail) */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem" }}>
              <label className="stack" style={{ gap: "0.3rem" }}>
                <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--c-ink)" }}>Student / CR Name</span>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. Muhammad Ali"
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                />
              </label>

              <label className="stack" style={{ gap: "0.3rem" }}>
                <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--c-ink)" }}>Student Reg No. / Batch ID</span>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. FA23-BCS-014"
                  value={studentRegNo}
                  onChange={(e) => setStudentRegNo(e.target.value)}
                />
              </label>

              <label className="stack" style={{ gap: "0.3rem" }}>
                <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--c-ink)" }}>Reason / Purpose</span>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. Makeup Lab 4 / Midterm Prep / Extra Class"
                  value={arrangementReason}
                  onChange={(e) => setArrangementReason(e.target.value)}
                />
              </label>
            </div>

            {/* Target Class Selection: Batch, Teacher, Subject */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "1rem", marginTop: "0.5rem" }}>
              {/* Batch Selector */}
              <label className="stack" style={{ gap: "0.35rem" }}>
                <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--c-ink)" }}>
                  🎓 Target Student Batch ({batches.length} campus batches)
                </span>
                <input
                  type="text"
                  className="input"
                  placeholder="Search batch (e.g. BCS, BSE...)"
                  value={batchSearch}
                  onChange={(e) => setBatchSearch(e.target.value)}
                  style={{ marginBottom: "0.35rem" }}
                />
                <select
                  className="input select"
                  value={selectedBatchId}
                  onChange={(e) => setSelectedBatchId(Number(e.target.value))}
                >
                  {filteredBatches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </label>

              {/* Teacher Selector */}
              <label className="stack" style={{ gap: "0.35rem" }}>
                <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--c-ink)" }}>
                  👨‍🏫 Instructor / Faculty Member ({teachers.length} faculty)
                </span>
                <input
                  type="text"
                  className="input"
                  placeholder="Search teacher name..."
                  value={teacherSearch}
                  onChange={(e) => setTeacherSearch(e.target.value)}
                  style={{ marginBottom: "0.35rem" }}
                />
                <select
                  className="input select"
                  value={selectedTeacherId}
                  onChange={(e) => setSelectedTeacherId(Number(e.target.value))}
                >
                  {filteredTeachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </label>

              {/* Subject Selector */}
              <label className="stack" style={{ gap: "0.35rem" }}>
                <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--c-ink)" }}>
                  📚 Course / Subject
                </span>
                <select
                  className="input select"
                  value={selectedSubjectId}
                  onChange={(e) => setSelectedSubjectId(Number(e.target.value))}
                >
                  {suggestedSubjectIds.length > 0 && (
                    <optgroup label="Courses on Batch Timetable">
                      {suggestedSubjectIds.map((sId) => (
                        <option key={`sug-${sId}`} value={sId}>
                          {subjects[sId]}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  <optgroup label="All University Subjects">
                    {subjects.map((name, sId) => (
                      <option key={`all-${sId}`} value={sId}>
                        {name}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </label>
            </div>
          </div>

          {/* Step 2: Mutual Free Slot Discovery & Vacant Venues */}
          <div className="zero-clash-card stack" style={{ gap: "1.25rem" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.85rem", borderBottom: "1px solid var(--c-line)", paddingBottom: "0.85rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <span className="zero-clash-step-num">2</span>
                <div>
                  <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 800 }}>
                    Select Mutual Free Slot & Vacant Venue
                  </h3>
                  <p className="quiet" style={{ margin: 0, fontSize: "0.82rem" }}>
                    Matching <strong>{batches[selectedBatchId]}</strong> with <strong>{teachers[selectedTeacherId]}</strong> ({comparison.bothFreeSlotsCount} mutual free slots).
                  </p>
                </div>
              </div>

              {/* Layout Switcher */}
              <div className="matcher-layout-switcher">
                <div className="switcher-tabs">
                  <button
                    type="button"
                    className={`switcher-tab ${matcherViewMode === "matrix" ? "active" : ""}`}
                    onClick={() => setMatcherViewMode("matrix")}
                  >
                    <Table size={14} />
                    <span>5x5 Matrix</span>
                  </button>
                  <button
                    type="button"
                    className={`switcher-tab ${matcherViewMode === "cards" ? "active" : ""}`}
                    onClick={() => setMatcherViewMode("cards")}
                  >
                    <Sparkles size={14} />
                    <span>Free Slots Cards ({allMutualFreeSlots.length})</span>
                  </button>
                </div>

                <label className="filter-free-label">
                  <input
                    type="checkbox"
                    checked={filterOnlyFree}
                    onChange={(e) => setFilterOnlyFree(e.target.checked)}
                  />
                  <span>Only show mutual free slots</span>
                </label>
              </div>
            </div>

            {/* Matrix View */}
            {matcherViewMode === "matrix" && (
              <div className="matcher-matrix-scroll-wrapper">
                <div className="matcher-matrix-grid">
                  <div className="matrix-header-cell time-corner">Day / Slot</div>
                  {SLOTS.map((s) => (
                    <div key={s.label} className="matrix-header-cell slot-col">
                      <strong>{s.label}</strong>
                      <span className="slot-hours">{s.start} - {s.end}</span>
                    </div>
                  ))}

                  {DAYS.map((dayName, dayIdx) => (
                    <div key={dayName} className="matrix-row-group">
                      <div className="matrix-day-cell">
                        <span className="day-name-full">{dayName}</span>
                        <span className="day-name-short">{DAY_SHORT[dayIdx]}</span>
                      </div>

                      {comparison.matrix[dayIdx].map((cell) => {
                        const isBothFree = cell.isBothFree;
                        const isSelected =
                          selectedSlotDetails?.day === cell.day &&
                          selectedSlotDetails?.slot === cell.slot;

                        if (filterOnlyFree && !isBothFree) {
                          return (
                            <div key={cell.slot} className="matrix-cell muted-slot">
                              <span className="fine quiet">Occupied</span>
                            </div>
                          );
                        }

                        return (
                          <button
                            key={cell.slot}
                            type="button"
                            onClick={() => {
                              setSelectedSlotDetails(cell);
                              setSelectedRoomId(null);
                              setRoomCategoryFilter("all");
                            }}
                            className={`matrix-cell ${isBothFree ? "free-match" : "busy-slot"} ${isSelected ? "selected" : ""}`}
                          >
                            {isBothFree ? (
                              <div className="cell-free-content">
                                <span className="match-tag">
                                  <CheckCircle2 size={12} />
                                  BOTH FREE
                                </span>
                                <div className="free-rooms-pill">
                                  <DoorOpen size={11} />
                                  <span>{cell.freeRooms.length} Rooms Free</span>
                                </div>
                                {cell.freeLabsCount > 0 && (
                                  <span className="labs-available-pill">
                                    🧪 {cell.freeLabsCount} Labs Free
                                  </span>
                                )}
                                {cell.freeLTsCount > 0 && (
                                  <span className="lts-count-chip" style={{ fontSize: "0.68rem", padding: "0.1rem 0.4rem" }}>
                                    🏛️ {cell.freeLTsCount} LTs Free
                                  </span>
                                )}
                              </div>
                            ) : (
                              <div className="cell-busy-content">
                                <span className="busy-tag">
                                  <XCircle size={11} />
                                  BUSY
                                </span>
                                {!cell.isTeacherFree && cell.teacherEntry && (
                                  <div className="busy-reason teacher">
                                    <strong>Teacher:</strong> {cell.teacherEntry.batch} ({cell.teacherEntry.room})
                                  </div>
                                )}
                                {!cell.isBatchFree && cell.batchEntry && (
                                  <div className="busy-reason batch">
                                    <strong>Batch:</strong> {cell.batchEntry.subject} ({cell.batchEntry.room})
                                  </div>
                                )}
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Cards View */}
            {matcherViewMode === "cards" && (
              <div className="quick-free-slots-list">
                {allMutualFreeSlots.length === 0 ? (
                  <div className="empty-state stack">
                    <XCircle size={32} aria-hidden />
                    <h3>No Mutual Free Slots Available</h3>
                    <p className="quiet">
                      {batches[selectedBatchId]} and {teachers[selectedTeacherId]} have conflicting lectures during all five lecture slots throughout the week.
                    </p>
                  </div>
                ) : (
                  <div className="free-slots-cards-grid">
                    {allMutualFreeSlots.map((slotItem) => {
                      const dayName = DAYS[slotItem.day];
                      const slotInfo = SLOTS[slotItem.slot];
                      const isSelected =
                        selectedSlotDetails?.day === slotItem.day &&
                        selectedSlotDetails?.slot === slotItem.slot;

                      return (
                        <div
                          key={`${slotItem.day}-${slotItem.slot}`}
                          className={`free-slot-card ${isSelected ? "selected" : ""}`}
                        >
                          <div className="slot-card-top">
                            <span className="slot-card-day">{dayName}</span>
                            <span className="slot-card-time">
                              {slotInfo.label} ({slotInfo.start} - {slotInfo.end})
                            </span>
                          </div>

                          <div className="slot-card-venues-info">
                            <span className="venues-count-chip">
                              <DoorOpen size={13} />
                              <strong>{slotItem.freeRooms.length}</strong> Rooms Vacant
                            </span>
                            {slotItem.freeLabsCount > 0 && (
                              <span className="labs-count-chip">
                                🧪 <strong>{slotItem.freeLabsCount}</strong> Labs Free
                              </span>
                            )}
                            {slotItem.freeLTsCount > 0 && (
                              <span className="lts-count-chip">
                                🏛️ <strong>{slotItem.freeLTsCount}</strong> LTs Free
                              </span>
                            )}
                          </div>

                          <button
                            type="button"
                            className="btn solid sm tap select-slot-btn"
                            onClick={() => {
                              setSelectedSlotDetails(slotItem);
                              setSelectedRoomId(null);
                              setRoomCategoryFilter("all");
                            }}
                          >
                            <Sparkles size={13} />
                            <span>{isSelected ? "Inspecting Venues Below" : "Select Slot & Choose Room"}</span>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Selected Slot Free Venue Drawer */}
            {selectedSlotDetails && selectedSlotDetails.isBothFree && (
              <div className="slot-discovery-drawer" style={{ background: "color-mix(in srgb, var(--c-accent) 4%, var(--c-paper))", borderColor: "var(--c-accent)" }}>
                <div className="discovery-header">
                  <div className="discovery-title">
                    <Sparkles size={24} color="var(--c-accent)" />
                    <div>
                      <h3 style={{ margin: "0 0 0.2rem" }}>
                        Select Destination Room for {DAYS[selectedSlotDetails.day]} • {SLOTS[selectedSlotDetails.slot].label} ({SLOTS[selectedSlotDetails.slot].start} - {SLOTS[selectedSlotDetails.slot].end})
                      </h3>
                      <p className="quiet" style={{ margin: 0 }}>
                        Pick any vacant computer lab, lecture hall, or classroom to host this session for <strong>{batches[selectedBatchId]}</strong>.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="close-drawer-btn"
                    onClick={() => {
                      setSelectedSlotDetails(null);
                      setSelectedRoomId(null);
                    }}
                  >
                    ✕ Close
                  </button>
                </div>

                <div className="discovery-content stack" style={{ gap: "1rem" }}>
                  {/* Category Counters */}
                  <div className="room-category-counters">
                    <button
                      type="button"
                      className={`counter-filter-btn ${roomCategoryFilter === "all" ? "active" : ""}`}
                      onClick={() => setRoomCategoryFilter("all")}
                    >
                      All Venues ({selectedSlotDetails.freeRooms.length})
                    </button>
                    <button
                      type="button"
                      className={`counter-filter-btn labs ${roomCategoryFilter === "labs" ? "active" : ""}`}
                      onClick={() => setRoomCategoryFilter("labs")}
                    >
                      🧪 Labs ({selectedSlotDetails.freeLabsCount})
                    </button>
                    <button
                      type="button"
                      className={`counter-filter-btn lts ${roomCategoryFilter === "lts" ? "active" : ""}`}
                      onClick={() => setRoomCategoryFilter("lts")}
                    >
                      🏛️ LTs ({selectedSlotDetails.freeLTsCount})
                    </button>
                    <button
                      type="button"
                      className={`counter-filter-btn crs ${roomCategoryFilter === "crs" ? "active" : ""}`}
                      onClick={() => setRoomCategoryFilter("crs")}
                    >
                      🏫 Classrooms ({selectedSlotDetails.freeCRsCount})
                    </button>
                  </div>

                  {/* Free Venues Grid */}
                  <div className="free-venues-grid" style={{ maxHeight: 320 }}>
                    {selectedSlotDetails.freeRooms
                      .filter((r) => {
                        if (roomCategoryFilter === "labs") return r.group === "Labs";
                        if (roomCategoryFilter === "lts") return r.group === "Lecture theatres";
                        if (roomCategoryFilter === "crs")
                          return r.group === "Classrooms" || r.group === "Lecture halls";
                        return true;
                      })
                      .map((r) => {
                        const isChosen = selectedRoomId === r.id;
                        const cardType =
                          r.group === "Labs" ? "lab" : r.group === "Lecture theatres" ? "lt" : "room";

                        return (
                          <div
                            key={r.id}
                            className={`venue-card ${cardType} ${isChosen ? "selected" : ""}`}
                            style={{
                              borderColor: isChosen ? "var(--c-accent)" : undefined,
                              background: isChosen ? "color-mix(in srgb, var(--c-accent) 10%, var(--c-paper))" : undefined,
                              cursor: "pointer",
                            }}
                            onClick={() => setSelectedRoomId(r.id)}
                          >
                            <div className="venue-info">
                              <span className="venue-group-tag">
                                {r.group === "Labs" ? "🧪 " : r.group === "Lecture theatres" ? "🏛️ " : "🏫 "}
                                {r.group}
                              </span>
                              <span className="venue-name">{r.name}</span>
                            </div>

                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "auto" }}>
                              <span style={{ fontSize: "0.74rem", fontWeight: 700, color: isChosen ? "var(--c-accent)" : "var(--c-muted)" }}>
                                {isChosen ? "✓ Venue Selected" : "Tap to Select"}
                              </span>
                              <button
                                type="button"
                                className="btn sm tap"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  open({ type: "room", id: r.id });
                                }}
                                style={{ fontSize: "0.72rem", padding: "0.2rem 0.5rem" }}
                              >
                                View
                              </button>
                            </div>
                          </div>
                        );
                      })}
                  </div>

                  {/* Step 3: Final Official Arrangement Dispatch */}
                  {selectedRoomId !== null && (
                    <div className="coordinator-dispatch-box" style={{
                      background: "var(--c-paper)",
                      border: "1.5px solid var(--c-accent)",
                      borderRadius: "1rem",
                      padding: "1.25rem",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      flexWrap: "wrap",
                      gap: "1rem",
                      boxShadow: "0 6px 20px rgba(0, 0, 0, 0.06)",
                    }}>
                      <div>
                        <span style={{ fontSize: "0.76rem", fontWeight: 800, color: "var(--c-accent)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                          ⚡ Ready for Official Timetable Deployment
                        </span>
                        <h4 style={{ margin: "0.2rem 0", fontSize: "1.1rem", fontWeight: 800 }}>
                          {subjects[selectedSubjectId]} • {batches[selectedBatchId]}
                        </h4>
                        <p className="quiet" style={{ margin: 0, fontSize: "0.82rem" }}>
                          Instructor: <strong>{teachers[selectedTeacherId]}</strong> · Venue: <strong>{rooms[selectedRoomId]}</strong> · {DAYS[selectedSlotDetails.day]}, {SLOTS[selectedSlotDetails.slot].label} ({SLOTS[selectedSlotDetails.slot].start} - {SLOTS[selectedSlotDetails.slot].end})
                        </p>
                      </div>

                      <button
                        type="button"
                        className="btn solid tap btn-lg"
                        disabled={isArranging}
                        onClick={handleConfirmArrangement}
                        style={{
                          background: "var(--c-accent)",
                          color: "var(--c-on-accent)",
                          fontWeight: 800,
                          padding: "0.65rem 1.4rem",
                        }}
                      >
                        {isArranging ? <RefreshCw size={17} className="spin" /> : <Sparkles size={17} />}
                        <span>Confirm & Arrange Official Class →</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: Arranged Registry & Cancellation Authority */}
      {activeTab === "registry" && (
        <div className="coordinator-registry-view stack" style={{ gap: "1.25rem" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.75rem" }}>
            <div>
              <h3 style={{ margin: "0 0 0.2rem", fontSize: "1.15rem", fontWeight: 800 }}>
                Live University Arranged Class Registry
              </h3>
              <p className="quiet" style={{ margin: 0, fontSize: "0.84rem" }}>
                Active classes scheduled across campus. Cancelling any class instantly frees the venue and resets the routine back to standard.
              </p>
            </div>
          </div>

          {activeMakeups.length === 0 ? (
            <div className="directory-empty stack" style={{ padding: "3rem 1.5rem", background: "var(--c-paper)", borderRadius: "1rem", border: "1px dashed var(--c-line)" }}>
              <CalendarCheck size={40} className="quiet" />
              <h3>No Active Arranged Classes</h3>
              <p className="quiet">
                There are currently no makeup, extra, or coordinator-arranged classes active on the campus timetable.
              </p>
            </div>
          ) : (
            <div className="active-makeups-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "1rem" }}>
              {activeMakeups.map((m) => {
                const dayName = m.targetDateLabel || DAYS[m.day];
                const slotDef = SLOTS[m.slot];
                const slotLabel = slotDef ? `${slotDef.label} (${slotDef.start} – ${slotDef.end})` : `Slot ${m.slot + 1}`;
                const subjName = subjects[m.subject] || "Class";
                const bName = batches[m.batch] || "Batch";
                const tName = teachers[m.teacher] || "Instructor";
                const rName = rooms[m.room] || "Campus";

                return (
                  <div
                    key={m.id}
                    className="makeup-registry-card stack"
                    style={{
                      background: "var(--c-paper)",
                      border: "1px solid var(--c-line)",
                      borderLeft: "4.5px solid var(--c-accent)",
                      borderRadius: "1rem",
                      padding: "1.25rem",
                      gap: "0.85rem",
                      boxShadow: "0 2px 10px rgba(0, 0, 0, 0.04)"
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.5rem" }}>
                      <div>
                        <span style={{ fontSize: "0.72rem", fontWeight: 800, color: "var(--c-accent)", textTransform: "uppercase" }}>
                          ⭐ ACTIVE ARRANGED CLASS
                        </span>
                        <h4 style={{ margin: "0.2rem 0", fontSize: "1.1rem", fontWeight: 800, color: "var(--c-ink)" }}>
                          {subjName}
                        </h4>
                      </div>
                      <span className="venues-count-chip" style={{ fontSize: "0.75rem" }}>
                        {rName}
                      </span>
                    </div>

                    <div style={{ fontSize: "0.82rem", color: "var(--c-muted)", display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                      <div>📅 <strong>{dayName}</strong> at <strong>{slotLabel}</strong></div>
                      <div>🎓 Batch: <strong>{bName}</strong></div>
                      <div>👨‍🏫 Instructor: <strong>{tName}</strong></div>
                    </div>

                    {m.note && (
                      <div style={{ fontSize: "0.78rem", background: "var(--c-canvas)", padding: "0.5rem 0.75rem", borderRadius: "0.5rem", color: "var(--c-ink)", border: "1px solid var(--c-line)" }}>
                        {m.note}
                      </div>
                    )}

                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "auto", paddingTop: "0.6rem", borderTop: "1px dashed var(--c-line)" }}>
                      <button
                        type="button"
                        className="btn sm tap"
                        onClick={() => {
                          const text = `📢 Official Class Notification:\n${subjName} for ${bName} with ${tName} is scheduled on ${dayName} at ${slotLabel} in ${rName}.`;
                          navigator.clipboard.writeText(text);
                          alert("Notice copied to clipboard!");
                        }}
                        style={{ fontSize: "0.75rem" }}
                      >
                        <Copy size={13} />
                        <span>Copy Notice</span>
                      </button>

                      <button
                        type="button"
                        className="btn sm tap"
                        onClick={() => handleCancelArrangedClass(m.id, `${subjName} (${bName})`)}
                        style={{ color: "#e11d48", borderColor: "rgba(225, 29, 72, 0.35)", marginLeft: "auto", fontSize: "0.75rem" }}
                      >
                        <Trash2 size={13} />
                        <span>Cancel & Free Room</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: Live Radar for Campus Rooms */}
      {activeTab === "radar" && (
        <div className="coordinator-radar-view stack" style={{ gap: "1rem" }}>
          <FreeRoomsRadar />
        </div>
      )}
    </div>
  );
}
