import { useEffect, useMemo, useState, useTransition } from "react";
import {
  AlertCircle,
  Award,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Filter,
  GraduationCap,
  Lightbulb,
  Plus,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  Tag,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  XCircle,
} from "lucide-react";
import { getActiveStudentSession } from "@/lib/student";
import { FypWorkspaceHub } from "./fyp-workspace-hub";
import type {
  FypDomain,
  FypGroupRecord,
  FypStudentMember,
  FypSupervisorRequest,
  FypSupervisorSummary,
} from "@/lib/fyp-types";
import { FYP_DOMAINS } from "@/lib/fyp-types";
import {
  getAvailableSupervisorsServerFn,
  getGroupRequestsServerFn,
  getMyFypGroupServerFn,
  saveFypGroupServerFn,
  submitSupervisorRequestServerFn,
} from "@/lib/fyp-server-fn";

export function FypStudentPortal() {
  const session = getActiveStudentSession();
  const student = session?.profile;

  const [loading, setLoading] = useState(true);
  const [group, setGroup] = useState<FypGroupRecord | null>(null);
  const [requests, setRequests] = useState<FypSupervisorRequest[]>([]);
  const [supervisors, setSupervisors] = useState<FypSupervisorSummary[]>([]);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Filter / Search for Faculty
  const [searchQuery, setSearchQuery] = useState("");
  const [deptFilter, setDeptFilter] = useState("All");
  const [expandedIdeasTeacherId, setExpandedIdeasTeacherId] = useState<number | null>(null);

  // Group creation form state
  const [title, setTitle] = useState("");
  const [domain, setDomain] = useState<FypDomain>(FYP_DOMAINS[0]);
  const [abstract, setAbstract] = useState("");
  const [additionalMembers, setAdditionalMembers] = useState<
    Array<{ regNo: string; fullName: string; email: string }>
  >([]);

  // Request supervisor modal / dialog state
  const [requestingTeacher, setRequestingTeacher] = useState<FypSupervisorSummary | null>(null);
  const [preferenceOrder, setPreferenceOrder] = useState<number>(1);
  const [isPending, startTransition] = useTransition();

  const loadData = async () => {
    if (!student) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      // 1. Load Student's Group
      const groupRes = await getMyFypGroupServerFn({
        data: { identifier: student.email || student.regNo },
      });
      setGroup(groupRes.group || null);

      // 2. If group exists, load requests
      if (groupRes.group) {
        const reqRes = await getGroupRequestsServerFn({
          data: { groupId: groupRes.group.id },
        });
        setRequests(reqRes.requests || []);
      }

      // 3. Load Available Faculty Supervisors
      const supRes = await getAvailableSupervisorsServerFn({ data: {} });
      setSupervisors(supRes.supervisors || []);
    } catch (err: any) {
      console.error("Failed to load FYP portal data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [student?.email]);

  if (!student) {
    return (
      <div className="faculty-empty-slate" style={{ padding: "3rem 1.5rem", textAlign: "center" }}>
        <GraduationCap size={48} style={{ opacity: 0.3, margin: "0 auto 1rem" }} />
        <h3 style={{ fontSize: "1.2rem", fontWeight: 700, marginBottom: "0.5rem" }}>
          FYP Student Portal
        </h3>
        <p style={{ color: "var(--muted)", maxWidth: "420px", margin: "0 auto" }}>
          Please sign in with your official COMSATS university email (e.g. FA22-BCS-014@cuiatk.edu.pk) to access group formation and supervisor selection.
        </p>
      </div>
    );
  }

  // Handle adding team members during registration
  const handleAddMemberRow = () => {
    if (additionalMembers.length >= 3) return; // Max 4 members total including leader
    setAdditionalMembers([...additionalMembers, { regNo: "", fullName: "", email: "" }]);
  };

  const handleUpdateMember = (index: number, field: string, value: string) => {
    const updated = [...additionalMembers];
    (updated[index] as any)[field] = value;
    setAdditionalMembers(updated);
  };

  const handleRemoveMemberRow = (index: number) => {
    const updated = additionalMembers.filter((_, i) => i !== index);
    setAdditionalMembers(updated);
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    setActionSuccess(null);

    if (!title.trim() || title.length < 5) {
      setActionError("Please provide a project title of at least 5 characters.");
      return;
    }
    if (!abstract.trim() || abstract.length < 15) {
      setActionError("Please write an abstract/proposal scope of at least 15 characters.");
      return;
    }

    // Format leader
    const leader: FypStudentMember = {
      studentId: student.id || student.regNo,
      regNo: student.regNo,
      fullName: student.fullName,
      email: student.email,
      programCode: student.programCode,
      department: student.department,
      isLeader: true,
    };

    // Format members
    const members: FypStudentMember[] = additionalMembers
      .filter((m) => m.regNo.trim() && m.fullName.trim())
      .map((m) => ({
        studentId: m.regNo.trim(),
        regNo: m.regNo.trim().toUpperCase(),
        fullName: m.fullName.trim(),
        email: m.email.trim() || `${m.regNo.trim().toLowerCase()}@cuiatk.edu.pk`,
        programCode: student.programCode,
        isLeader: false,
      }));

    startTransition(async () => {
      try {
        const res = await saveFypGroupServerFn({
          data: {
            title: title.trim(),
            domain,
            abstract: abstract.trim(),
            leader,
            members,
          },
        });
        if (res.success && res.group) {
          setActionSuccess("FYP Group registered successfully! You can now request a faculty supervisor.");
          setGroup(res.group);
          await loadData();
        }
      } catch (err: any) {
        setActionError(err.message || "Failed to register group.");
      }
    });
  };

  const handleSendSupervisorRequest = async () => {
    if (!group || !requestingTeacher) return;
    setActionError(null);
    setActionSuccess(null);

    startTransition(async () => {
      try {
        const res = await submitSupervisorRequestServerFn({
          data: {
            groupId: group.id,
            teacherId: requestingTeacher.teacherId,
            preferenceOrder,
            studentEmail: student.email,
          },
        });
        if (res.success) {
          setActionSuccess(`Supervision request sent to ${requestingTeacher.teacherName}!`);
          setRequestingTeacher(null);
          await loadData();
        }
      } catch (err: any) {
        setActionError(err.message || "Failed to submit request.");
      }
    });
  };

  // Filtered supervisors
  const filteredSupervisors = useMemo(() => {
    return supervisors.filter((s) => {
      if (deptFilter !== "All" && s.department !== deptFilter) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        s.teacherName.toLowerCase().includes(q) ||
        s.department.toLowerCase().includes(q) ||
        s.researchAreas.some((r) => r.toLowerCase().includes(q)) ||
        s.availableIdeas.some((i) => i.title.toLowerCase().includes(q))
      );
    });
  }, [supervisors, deptFilter, searchQuery]);

  const isGroupSupervised = group?.status === "supervisor_accepted" || group?.status === "locked";

  return (
    <div className="fyp-shell">
      {/* Top Banner */}
      <div className="fyp-hero-banner">
        <div className="fyp-hero-header">
          <div>
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "0.35rem", flexWrap: "wrap" }}>
              <span className="fyp-badge primary">
                <Sparkles size={13} />
                6th Semester FYP Module (Supervisor Selection &amp; Defense)
              </span>
              <span className={`fyp-badge ${isGroupSupervised ? "success" : group ? "warning" : "neutral"}`}>
                <span className="fyp-pulse-dot" />
                {isGroupSupervised ? "Supervisor Confirmed" : group ? "Supervisor Selection in Progress" : "Group Formation Required"}
              </span>
            </div>
            <h1 className="fyp-hero-title">
              Final Year Project (FYP) Student Portal
            </h1>
            <p className="fyp-hero-subtitle">
              {student.fullName} ({student.regNo}) • {student.programTitle || "Bachelor of Science in Computer Science"} • CUI Attock
            </p>
          </div>

          <button
            type="button"
            className="fyp-btn secondary"
            onClick={loadData}
            disabled={loading}
            title="Refresh status"
          >
            <RefreshCw size={15} className={loading ? "spin" : ""} />
            <span>Sync Status</span>
          </button>
        </div>
      </div>

      {/* Action Alerts */}
      {actionSuccess && (
        <div className="fyp-badge success" style={{ padding: "0.75rem 1rem", width: "100%", borderRadius: "0.75rem", fontSize: "0.88rem" }}>
          <CheckCircle2 size={18} />
          <span>{actionSuccess}</span>
        </div>
      )}
      {actionError && (
        <div className="fyp-badge danger" style={{ padding: "0.75rem 1rem", width: "100%", borderRadius: "0.75rem", fontSize: "0.88rem" }}>
          <AlertCircle size={18} />
          <span>{actionError}</span>
        </div>
      )}

      {/* STATE 1: NO GROUP CREATED YET */}
      {!group && (
        <div className="fyp-card elevated-hover accent-edge" style={{ padding: "1.75rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.85rem", marginBottom: "1.25rem" }}>
            <div
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "12px",
                background: "color-mix(in srgb, var(--c-accent) 15%, transparent)",
                color: "var(--c-accent)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Users size={22} />
            </div>
            <div>
              <h3 style={{ fontSize: "1.25rem", fontWeight: 700, margin: 0 }}>
                Step 1: Register Your FYP Group
              </h3>
              <p style={{ fontSize: "0.88rem", color: "var(--c-muted)", margin: "0.15rem 0 0" }}>
                Form your project group (leader + 1-3 members) before selecting an official faculty supervisor.
              </p>
            </div>
          </div>

          <form onSubmit={handleCreateGroup} className="stack" style={{ gap: "1.25rem" }}>
            <div>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.4rem" }}>
                Proposed Project Title *
              </label>
              <input
                type="text"
                placeholder="e.g. Autonomous Campus Navigation System using Visual SLAM"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="fyp-input"
                style={{ width: "100%" }}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "1.25rem" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.4rem" }}>
                  Specialization Domain *
                </label>
                <select
                  value={domain}
                  onChange={(e) => setDomain(e.target.value as FypDomain)}
                  className="fyp-input"
                  style={{ width: "100%" }}
                >
                  {FYP_DOMAINS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.4rem" }}>
                  Group Leader
                </label>
                <input
                  type="text"
                  disabled
                  value={`${student.fullName} (${student.regNo})`}
                  className="fyp-input"
                  style={{ width: "100%", opacity: 0.85, background: "color-mix(in srgb, var(--c-canvas) 40%, var(--c-paper))" }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.4rem" }}>
                Project Abstract / Scope Description *
              </label>
              <textarea
                rows={3}
                placeholder="Describe problem statement, objectives, anticipated tech stack, and impact..."
                value={abstract}
                onChange={(e) => setAbstract(e.target.value)}
                required
                className="fyp-input"
                style={{ width: "100%" }}
              />
            </div>

            {/* Additional Members */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.6rem" }}>
                <label style={{ fontSize: "0.85rem", fontWeight: 600 }}>
                  Team Members (Optional, up to 3 additional members)
                </label>
                {additionalMembers.length < 3 && (
                  <button
                    type="button"
                    className="fyp-btn secondary"
                    onClick={handleAddMemberRow}
                    style={{ fontSize: "0.8rem", padding: "4px 10px" }}
                  >
                    <UserPlus size={14} />
                    <span>Add Member</span>
                  </button>
                )}
              </div>

              {additionalMembers.length === 0 ? (
                <div style={{ fontSize: "0.85rem", color: "var(--c-muted)", fontStyle: "italic", background: "color-mix(in srgb, var(--c-canvas) 60%, var(--c-paper))", padding: "0.85rem", borderRadius: "0.75rem", border: "1px dashed var(--c-line)" }}>
                  No extra members added. Click &ldquo;Add Member&rdquo; above if you are a multi-student team (standard group size is 2-3 members).
                </div>
              ) : (
                <div className="stack" style={{ gap: "0.6rem" }}>
                  {additionalMembers.map((m, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: "flex",
                        gap: "0.6rem",
                        alignItems: "center",
                        background: "color-mix(in srgb, var(--c-canvas) 60%, var(--c-paper))",
                        padding: "0.6rem 0.85rem",
                        borderRadius: "0.75rem",
                        border: "1px solid var(--c-line)",
                      }}
                    >
                      <input
                        type="text"
                        placeholder="Reg No (e.g. FA22-BCS-099)"
                        value={m.regNo}
                        onChange={(e) => handleUpdateMember(idx, "regNo", e.target.value)}
                        className="fyp-input"
                        style={{ width: "180px" }}
                      />
                      <input
                        type="text"
                        placeholder="Member Full Name"
                        value={m.fullName}
                        onChange={(e) => handleUpdateMember(idx, "fullName", e.target.value)}
                        className="fyp-input"
                        style={{ flex: 1 }}
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveMemberRow(idx)}
                        style={{ background: "transparent", border: "none", color: "#ef4444", cursor: "pointer", padding: "6px" }}
                        title="Remove member"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "0.5rem" }}>
              <button type="submit" className="fyp-btn primary" disabled={isPending}>
                <CheckCircle2 size={16} />
                <span>Register FYP Group</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* STATE 2: GROUP REGISTERED */}
      {group && (
        <section className="stack" style={{ gap: "1.25rem" }}>
          {/* Group Overview Card */}
          <div className={`fyp-card elevated-hover ${isGroupSupervised ? "emerald-edge" : "accent-edge"}`} style={{ padding: "1.35rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.75rem", flexWrap: "wrap" }}>
              <div>
                <div style={{ display: "inline-flex", gap: "0.45rem", alignItems: "center", marginBottom: "0.35rem" }}>
                  <span className="fyp-badge primary">
                    {group.domain}
                  </span>
                  <span className={`fyp-badge ${isGroupSupervised ? "success" : "warning"}`}>
                    <span className="fyp-pulse-dot" />
                    {isGroupSupervised ? "✓ Supervisor Confirmed" : "⏳ Pending Supervisor Confirmation"}
                  </span>
                </div>
                <h3 style={{ fontSize: "1.25rem", fontWeight: 700, margin: "0.15rem 0 0.35rem" }}>
                  {group.title}
                </h3>
              </div>
            </div>

            <p style={{ fontSize: "0.88rem", color: "var(--c-muted)", margin: "0.45rem 0 0.85rem", lineHeight: 1.55 }}>
              {group.abstract}
            </p>

            {/* Team Roster */}
            <div style={{ borderTop: "1px solid var(--c-line)", paddingTop: "0.75rem" }}>
              <div style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--c-muted)", marginBottom: "0.45rem" }}>
                Group Cohort Roster ({group.members.length + 1} Members)
              </div>
              <div className="fyp-chip-roster">
                <span className="fyp-chip-item leader">
                  👑 <strong>{group.leader.fullName}</strong> ({group.leader.regNo}) • Leader
                </span>
                {group.members.map((m) => (
                  <span key={m.studentId || m.regNo} className="fyp-chip-item">
                    <strong>{m.fullName}</strong> ({m.regNo})
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Phase 2: Active Supervision Workspace */}
          {isGroupSupervised ? (
            <FypWorkspaceHub
              group={group}
              role="student"
              currentUserName={student.fullName}
              onRefreshGroup={loadData}
            />
          ) : (
            <>
              {/* Requests Status Trackers */}
              {requests.length > 0 && (
                <div className="fyp-card" style={{ padding: "1.35rem" }}>
                  <h4 style={{ fontSize: "1.05rem", fontWeight: 700, marginBottom: "0.75rem", display: "flex", alignItems: "center", gap: "0.45rem" }}>
                    <Clock size={17} color="var(--c-accent)" />
                    Supervision Requests Status
                  </h4>

                  <div className="stack" style={{ gap: "0.75rem" }}>
                    {requests.map((req) => (
                      <div
                        key={req.id}
                        className="fyp-card"
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: "0.85rem 1rem",
                          gap: "0.75rem",
                          flexWrap: "wrap",
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 600, fontSize: "0.95rem" }}>
                            {req.teacherName} (Choice #{req.preferenceOrder})
                          </div>
                          <div style={{ fontSize: "0.8rem", color: "var(--c-muted)" }}>
                            Submitted {new Date(req.createdAt).toLocaleDateString()}
                          </div>
                          {req.facultyRemark && (
                            <div style={{ fontSize: "0.83rem", color: req.status === "declined" ? "#ef4444" : "var(--c-muted)", marginTop: "0.25rem" }}>
                              <strong>Faculty Note:</strong> {req.facultyRemark}
                            </div>
                          )}
                        </div>

                        <span
                          className={`fyp-badge ${
                            req.status === "pending"
                              ? "warning"
                              : req.status === "accepted"
                              ? "success"
                              : "ruby"
                          }`}
                        >
                          <span className="fyp-pulse-dot" />
                          {req.status === "pending" && "Review Pending"}
                          {req.status === "accepted" && "Accepted"}
                          {req.status === "declined" && "Declined"}
                          {req.status === "cancelled" && "Cancelled"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Faculty Directory for Supervisor Selection */}
              <div className="fyp-card" style={{ padding: "1.35rem" }}>
                <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "1rem", marginBottom: "1.25rem" }}>
                  <div>
                    <h3 style={{ fontSize: "1.15rem", fontWeight: 700, margin: 0 }}>
                      Select a Faculty Supervisor
                    </h3>
                    <p style={{ fontSize: "0.85rem", color: "var(--c-muted)", margin: "0.2rem 0 0" }}>
                      Browse faculty by research areas, remaining slot capacity, and proposed project ideas.
                    </p>
                  </div>

                  <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                    <div style={{ position: "relative" }}>
                      <Search size={15} style={{ position: "absolute", left: "10px", top: "10px", color: "var(--c-muted)" }} />
                      <input
                        type="text"
                        placeholder="Search supervisor or domain..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="fyp-input"
                        style={{ paddingLeft: "32px", fontSize: "0.85rem", width: "230px" }}
                      />
                    </div>
                  </div>
                </div>

                <div className="stack" style={{ gap: "1rem" }}>
                  {filteredSupervisors.map((faculty) => {
                    const hasPendingReq = requests.some(
                      (r) => r.teacherId === faculty.teacherId && r.status === "pending",
                    );
                    const isIdeasOpen = expandedIdeasTeacherId === faculty.teacherId;

                    return (
                      <div
                        key={faculty.teacherId}
                        className="fyp-card elevated-hover"
                        style={{
                          padding: "1.1rem",
                          display: "flex",
                          flexDirection: "column",
                          gap: "0.75rem",
                          borderLeft: `4px solid ${faculty.isAvailable ? "var(--c-accent)" : "var(--c-line)"}`,
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.75rem", flexWrap: "wrap" }}>
                          <div>
                            <div style={{ display: "inline-flex", gap: "0.45rem", alignItems: "center", marginBottom: "0.3rem" }}>
                              <span className={`fyp-badge ${faculty.isAvailable ? "success" : "ruby"}`}>
                                {faculty.isAvailable ? `${faculty.remainingSlots} Slots Available` : "Quota Full"}
                              </span>
                              <span className="fyp-badge neutral">
                                {faculty.department}
                              </span>
                            </div>
                            <h4 style={{ fontSize: "1.1rem", fontWeight: 700, margin: "0.15rem 0" }}>
                              {faculty.teacherName}
                            </h4>
                            <span style={{ fontSize: "0.82rem", color: "var(--c-muted)" }}>
                              {faculty.email}
                            </span>
                          </div>

                          <button
                            type="button"
                            className="fyp-btn primary"
                            onClick={() => {
                              setRequestingTeacher(faculty);
                              setPreferenceOrder(1);
                            }}
                            disabled={!faculty.isAvailable || hasPendingReq || isPending}
                          >
                            <Send size={14} />
                            <span>{hasPendingReq ? "Request Sent" : "Request Supervisor"}</span>
                          </button>
                        </div>

                        {/* Research tags */}
                        {faculty.researchAreas.length > 0 && (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                            {faculty.researchAreas.map((area) => (
                              <span
                                key={area}
                                className="fyp-badge primary"
                                style={{ fontSize: "0.78rem", padding: "3px 8px" }}
                              >
                                {area}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Available Ideas Toggle */}
                        {faculty.availableIdeas.length > 0 && (
                          <div style={{ marginTop: "0.25rem" }}>
                            <button
                              type="button"
                              onClick={() => setExpandedIdeasTeacherId(isIdeasOpen ? null : faculty.teacherId)}
                              style={{
                                background: "transparent",
                                border: "none",
                                cursor: "pointer",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "0.4rem",
                                fontSize: "0.83rem",
                                color: "var(--c-accent)",
                                padding: 0,
                                fontWeight: 600,
                              }}
                            >
                              <Lightbulb size={14} color="var(--c-brass, #f59e0b)" />
                              <span>{faculty.availableIdeas.length} Available Project Ideas from Faculty</span>
                              {isIdeasOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            </button>

                            {isIdeasOpen && (
                              <div className="stack" style={{ gap: "0.5rem", marginTop: "0.5rem", paddingLeft: "0.75rem", borderLeft: "2px solid var(--c-accent)" }}>
                                {faculty.availableIdeas.map((idea) => (
                                  <div key={idea.id} style={{ fontSize: "0.85rem" }}>
                                    <div style={{ fontWeight: 600 }}>{idea.title}</div>
                                    <div style={{ fontSize: "0.8rem", color: "var(--c-muted)" }}>{idea.description}</div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </section>
      )}

      {/* Send Request Preference Modal */}
      {requestingTeacher && (
        <div className="fyp-modal-backdrop">
          <div className="fyp-modal-card">
            <h3 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: "0.5rem" }}>
              Request Supervision
            </h3>
            <p style={{ fontSize: "0.88rem", color: "var(--c-muted)", marginBottom: "1rem" }}>
              Send your project proposal &ldquo;<strong>{group?.title}</strong>&rdquo; to <strong>{requestingTeacher.teacherName}</strong>.
            </p>

            <div style={{ marginBottom: "1.25rem" }}>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.4rem" }}>
                Preference Choice Order
              </label>
              <select
                value={preferenceOrder}
                onChange={(e) => setPreferenceOrder(parseInt(e.target.value, 10))}
                className="fyp-input"
                style={{ width: "100%" }}
              >
                <option value={1}>1st Choice (Highest Priority)</option>
                <option value={2}>2nd Choice</option>
                <option value={3}>3rd Choice</option>
              </select>
              <span style={{ fontSize: "0.78rem", color: "var(--c-muted)", display: "block", marginTop: "0.3rem" }}>
                Supervisors will see your preference choice ranking when prioritizing incoming proposals.
              </span>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.6rem" }}>
              <button
                type="button"
                className="fyp-btn secondary"
                onClick={() => setRequestingTeacher(null)}
                disabled={isPending}
              >
                Cancel
              </button>
              <button
                type="button"
                className="fyp-btn primary"
                onClick={handleSendSupervisorRequest}
                disabled={isPending}
              >
                <Send size={15} />
                <span>Submit Request</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
