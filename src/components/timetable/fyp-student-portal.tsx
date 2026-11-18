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
    <div className="fyp-student-portal stack" style={{ gap: "1.5rem" }}>
      {/* Top Banner */}
      <div
        className="faculty-day-summary-card"
        style={{
          background: "linear-gradient(135deg, rgba(99, 102, 241, 0.08), rgba(59, 130, 246, 0.04))",
          borderColor: "rgba(99, 102, 241, 0.25)",
        }}
      >
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: "1rem", alignItems: "center" }}>
          <div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
              <span className="badge" style={{ background: "rgba(99, 102, 241, 0.15)", color: "var(--accent)" }}>
                Phase 1: 6th Semester Module
              </span>
              <span className="badge" style={{ background: isGroupSupervised ? "rgba(16, 185, 129, 0.15)" : "rgba(245, 158, 11, 0.15)", color: isGroupSupervised ? "#10b981" : "#d97706" }}>
                {isGroupSupervised ? "✓ Supervisor Confirmed" : group ? "⏳ Supervisor Selection in Progress" : "○ Group Formation"}
              </span>
            </div>
            <h2 style={{ fontSize: "1.4rem", fontWeight: 800, margin: "0.25rem 0" }}>
              Final Year Project (FYP) Portal
            </h2>
            <p style={{ color: "var(--muted)", fontSize: "0.9rem", margin: 0 }}>
              {student.fullName} ({student.regNo}) • {student.programTitle || "Bachelor of Science"}
            </p>
          </div>

          <button
            type="button"
            className="btn secondary tap"
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
        <div className="alert-card success" style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.75rem 1rem", borderRadius: "8px", background: "rgba(16, 185, 129, 0.1)", border: "1px solid rgba(16, 185, 129, 0.3)", color: "#10b981" }}>
          <CheckCircle2 size={18} />
          <span style={{ fontSize: "0.9rem", fontWeight: 500 }}>{actionSuccess}</span>
        </div>
      )}
      {actionError && (
        <div className="alert-card error" style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.75rem 1rem", borderRadius: "8px", background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.3)", color: "#ef4444" }}>
          <AlertCircle size={18} />
          <span style={{ fontSize: "0.9rem", fontWeight: 500 }}>{actionError}</span>
        </div>
      )}

      {/* STATE 1: NO GROUP CREATED YET */}
      {!group && (
        <div className="card" style={{ padding: "1.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "50%",
                background: "rgba(99, 102, 241, 0.12)",
                color: "var(--accent)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Users size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: "1.15rem", fontWeight: 700, margin: 0 }}>
                Step 1: Register Your FYP Group
              </h3>
              <p style={{ fontSize: "0.85rem", color: "var(--muted)", margin: 0 }}>
                Form your project group (leader + 1-3 members) before selecting an official supervisor.
              </p>
            </div>
          </div>

          <form onSubmit={handleCreateGroup} className="stack" style={{ gap: "1rem" }}>
            <div>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.35rem" }}>
                Proposed Project Title *
              </label>
              <input
                type="text"
                placeholder="e.g. Autonomous Campus Navigation System using Visual SLAM"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="input"
                style={{ width: "100%", padding: "0.6rem" }}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "1rem" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.35rem" }}>
                  Specialization Domain *
                </label>
                <select
                  value={domain}
                  onChange={(e) => setDomain(e.target.value as FypDomain)}
                  className="input"
                  style={{ width: "100%", padding: "0.6rem" }}
                >
                  {FYP_DOMAINS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.35rem" }}>
                  Group Leader
                </label>
                <input
                  type="text"
                  disabled
                  value={`${student.fullName} (${student.regNo})`}
                  className="input"
                  style={{ width: "100%", padding: "0.6rem", opacity: 0.8, background: "var(--surface)" }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.35rem" }}>
                Project Abstract / Scope Description *
              </label>
              <textarea
                rows={3}
                placeholder="Describe problem statement, objectives, anticipated tech stack, and impact..."
                value={abstract}
                onChange={(e) => setAbstract(e.target.value)}
                required
                className="input"
                style={{ width: "100%", padding: "0.6rem" }}
              />
            </div>

            {/* Additional Members */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                <label style={{ fontSize: "0.85rem", fontWeight: 600 }}>
                  Team Members (Optional, up to 3 additional members)
                </label>
                {additionalMembers.length < 3 && (
                  <button
                    type="button"
                    className="btn secondary tap"
                    onClick={handleAddMemberRow}
                    style={{ fontSize: "0.78rem", padding: "4px 8px" }}
                  >
                    <UserPlus size={13} />
                    <span>Add Member</span>
                  </button>
                )}
              </div>

              {additionalMembers.length === 0 ? (
                <div style={{ fontSize: "0.82rem", color: "var(--muted)", fontStyle: "italic", background: "var(--surface)", padding: "0.6rem", borderRadius: "6px" }}>
                  No extra members added. Click &ldquo;Add Member&rdquo; above if you are a multi-student team (standard group size is 2-3 members).
                </div>
              ) : (
                <div className="stack" style={{ gap: "0.5rem" }}>
                  {additionalMembers.map((m, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: "flex",
                        gap: "0.5rem",
                        alignItems: "center",
                        background: "var(--surface)",
                        padding: "0.5rem",
                        borderRadius: "6px",
                      }}
                    >
                      <input
                        type="text"
                        placeholder="Reg No (e.g. FA22-BCS-099)"
                        value={m.regNo}
                        onChange={(e) => handleUpdateMember(idx, "regNo", e.target.value)}
                        className="input"
                        style={{ width: "180px", padding: "0.4rem" }}
                      />
                      <input
                        type="text"
                        placeholder="Member Full Name"
                        value={m.fullName}
                        onChange={(e) => handleUpdateMember(idx, "fullName", e.target.value)}
                        className="input"
                        style={{ flex: 1, padding: "0.4rem" }}
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveMemberRow(idx)}
                        style={{ background: "transparent", border: "none", color: "#ef4444", cursor: "pointer", padding: "4px" }}
                        title="Remove member"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "1rem" }}>
              <button type="submit" className="btn primary tap" disabled={isPending}>
                <CheckCircle2 size={16} />
                <span>Register FYP Group</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* STATE 2: GROUP REGISTERED */}
      {group && (
        <section className="stack" style={{ gap: "1.5rem" }}>
          {/* Group Overview Card */}
          <div className="card" style={{ padding: "1.25rem", borderLeft: `4px solid ${isGroupSupervised ? "#10b981" : "var(--accent)"}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.5rem" }}>
              <div>
                <div style={{ display: "inline-flex", gap: "0.4rem", alignItems: "center", marginBottom: "0.25rem" }}>
                  <span className="badge" style={{ background: "rgba(99, 102, 241, 0.15)", color: "var(--accent)" }}>
                    {group.domain}
                  </span>
                  <span
                    className="badge"
                    style={{
                      background: isGroupSupervised ? "rgba(16, 185, 129, 0.15)" : "rgba(245, 158, 11, 0.15)",
                      color: isGroupSupervised ? "#10b981" : "#d97706",
                    }}
                  >
                    {isGroupSupervised ? "✓ Supervisor Confirmed" : "⏳ Pending Supervisor"}
                  </span>
                </div>
                <h3 style={{ fontSize: "1.25rem", fontWeight: 700, margin: "0.2rem 0" }}>
                  {group.title}
                </h3>
              </div>
            </div>

            <p style={{ fontSize: "0.88rem", color: "var(--muted)", margin: "0.5rem 0", lineHeight: 1.5 }}>
              {group.abstract}
            </p>

            {/* Team Roster */}
            <div style={{ background: "var(--surface)", padding: "0.75rem", borderRadius: "6px", marginTop: "0.5rem" }}>
              <div style={{ fontSize: "0.78rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--muted)", marginBottom: "0.4rem" }}>
                Group Members ({group.members.length + 1})
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                <div
                  style={{
                    fontSize: "0.82rem",
                    padding: "4px 8px",
                    borderRadius: "4px",
                    background: "rgba(99, 102, 241, 0.1)",
                    border: "1px solid rgba(99, 102, 241, 0.2)",
                  }}
                >
                  👑 <strong>{group.leader.fullName}</strong> ({group.leader.regNo}) • Leader
                </div>
                {group.members.map((m) => (
                  <div
                    key={m.studentId || m.regNo}
                    style={{
                      fontSize: "0.82rem",
                      padding: "4px 8px",
                      borderRadius: "4px",
                      background: "var(--background)",
                      border: "1px solid var(--border)",
                    }}
                  >
                    <strong>{m.fullName}</strong> ({m.regNo})
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Supervisor Status Banner */}
          {isGroupSupervised ? (
            <div
              className="card"
              style={{
                padding: "1.5rem",
                textAlign: "center",
                background: "linear-gradient(135deg, rgba(16, 185, 129, 0.08), rgba(99, 102, 241, 0.04))",
                borderColor: "rgba(16, 185, 129, 0.3)",
              }}
            >
              <Award size={40} color="#10b981" style={{ margin: "0 auto 0.75rem" }} />
              <h3 style={{ fontSize: "1.25rem", fontWeight: 800, margin: 0 }}>
                Supervised by {group.supervisorName}
              </h3>
              <p style={{ color: "var(--muted)", fontSize: "0.9rem", margin: "0.4rem auto 0", maxWidth: "480px" }}>
                Your group has been successfully accepted for 6th-semester supervision. The group membership and title are now locked.
              </p>
            </div>
          ) : (
            <>
              {/* Requests Status Trackers */}
              {requests.length > 0 && (
                <div className="card" style={{ padding: "1.25rem" }}>
                  <h4 style={{ fontSize: "1rem", fontWeight: 700, marginBottom: "0.75rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                    <Clock size={16} />
                    Supervision Requests Status
                  </h4>

                  <div className="stack" style={{ gap: "0.75rem" }}>
                    {requests.map((req) => (
                      <div
                        key={req.id}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: "0.75rem",
                          borderRadius: "6px",
                          background: "var(--surface)",
                          border: "1px solid var(--border)",
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 600, fontSize: "0.92rem" }}>
                            {req.teacherName} (Choice #{req.preferenceOrder})
                          </div>
                          <div style={{ fontSize: "0.78rem", color: "var(--muted)" }}>
                            Submitted {new Date(req.createdAt).toLocaleDateString()}
                          </div>
                          {req.facultyRemark && (
                            <div style={{ fontSize: "0.82rem", color: req.status === "declined" ? "#ef4444" : "var(--muted)", marginTop: "0.25rem" }}>
                              <strong>Faculty Note:</strong> {req.facultyRemark}
                            </div>
                          )}
                        </div>

                        <span
                          className="badge"
                          style={{
                            background:
                              req.status === "pending"
                                ? "rgba(245, 158, 11, 0.15)"
                                : req.status === "accepted"
                                ? "rgba(16, 185, 129, 0.15)"
                                : "rgba(239, 68, 68, 0.15)",
                            color:
                              req.status === "pending"
                                ? "#d97706"
                                : req.status === "accepted"
                                ? "#10b981"
                                : "#ef4444",
                          }}
                        >
                          {req.status === "pending" && "⏳ Review Pending"}
                          {req.status === "accepted" && "✓ Accepted"}
                          {req.status === "declined" && "✕ Declined"}
                          {req.status === "cancelled" && "○ Cancelled"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Faculty Directory for Supervisor Selection */}
              <div className="card" style={{ padding: "1.25rem" }}>
                <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "1rem", marginBottom: "1rem" }}>
                  <div>
                    <h3 style={{ fontSize: "1.15rem", fontWeight: 700, margin: 0 }}>
                      Select a Faculty Supervisor
                    </h3>
                    <p style={{ fontSize: "0.85rem", color: "var(--muted)", margin: "0.2rem 0 0" }}>
                      Browse faculty by research areas, remaining slot capacity, and proposed project ideas.
                    </p>
                  </div>

                  <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                    <div style={{ position: "relative" }}>
                      <Search size={15} style={{ position: "absolute", left: "10px", top: "10px", color: "var(--muted)" }} />
                      <input
                        type="text"
                        placeholder="Search supervisor or domain..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="input"
                        style={{ paddingLeft: "32px", fontSize: "0.85rem", width: "220px" }}
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
                        style={{
                          padding: "1rem",
                          borderRadius: "8px",
                          border: "1px solid var(--border)",
                          background: faculty.isAvailable ? "var(--background)" : "rgba(0, 0, 0, 0.02)",
                          display: "flex",
                          flexDirection: "column",
                          gap: "0.75rem",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.5rem" }}>
                          <div>
                            <div style={{ display: "inline-flex", gap: "0.4rem", alignItems: "center", marginBottom: "0.2rem" }}>
                              <span
                                className="badge"
                                style={{
                                  background: faculty.isAvailable ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)",
                                  color: faculty.isAvailable ? "#10b981" : "#ef4444",
                                }}
                              >
                                {faculty.isAvailable ? `${faculty.remainingSlots} Slots Available` : "Quota Full"}
                              </span>
                              <span className="badge" style={{ background: "var(--surface)", color: "var(--muted)" }}>
                                {faculty.department}
                              </span>
                            </div>
                            <h4 style={{ fontSize: "1.05rem", fontWeight: 700, margin: "0.2rem 0" }}>
                              {faculty.teacherName}
                            </h4>
                            <span style={{ fontSize: "0.82rem", color: "var(--muted)" }}>
                              {faculty.email}
                            </span>
                          </div>

                          <button
                            type="button"
                            className="btn primary tap"
                            onClick={() => {
                              setRequestingTeacher(faculty);
                              setPreferenceOrder(1);
                            }}
                            disabled={!faculty.isAvailable || hasPendingReq || isPending}
                            style={{ fontSize: "0.85rem", padding: "6px 12px" }}
                          >
                            <Send size={14} />
                            <span>{hasPendingReq ? "Request Sent" : "Request Supervisor"}</span>
                          </button>
                        </div>

                        {/* Research tags */}
                        {faculty.researchAreas.length > 0 && (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
                            {faculty.researchAreas.map((area) => (
                              <span
                                key={area}
                                style={{
                                  fontSize: "0.75rem",
                                  padding: "2px 8px",
                                  borderRadius: "4px",
                                  background: "rgba(99, 102, 241, 0.08)",
                                  color: "var(--accent)",
                                }}
                              >
                                {area}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Available Ideas Toggle */}
                        {faculty.availableIdeas.length > 0 && (
                          <div>
                            <button
                              type="button"
                              onClick={() => setExpandedIdeasTeacherId(isIdeasOpen ? null : faculty.teacherId)}
                              style={{
                                background: "transparent",
                                border: "none",
                                cursor: "pointer",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "0.35rem",
                                fontSize: "0.82rem",
                                color: "var(--accent)",
                                padding: 0,
                                fontWeight: 600,
                              }}
                            >
                              <Lightbulb size={14} color="#f59e0b" />
                              <span>{faculty.availableIdeas.length} Available Project Ideas from Faculty</span>
                              {isIdeasOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            </button>

                            {isIdeasOpen && (
                              <div className="stack" style={{ gap: "0.5rem", marginTop: "0.5rem", paddingLeft: "0.5rem", borderLeft: "2px solid var(--accent)" }}>
                                {faculty.availableIdeas.map((idea) => (
                                  <div key={idea.id} style={{ fontSize: "0.85rem" }}>
                                    <div style={{ fontWeight: 600 }}>{idea.title}</div>
                                    <div style={{ fontSize: "0.8rem", color: "var(--muted)" }}>{idea.description}</div>
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
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "1rem",
          }}
        >
          <div className="card" style={{ maxWidth: "480px", width: "100%", padding: "1.5rem" }}>
            <h3 style={{ fontSize: "1.2rem", fontWeight: 700, marginBottom: "0.5rem" }}>
              Request Supervision
            </h3>
            <p style={{ fontSize: "0.88rem", color: "var(--muted)", marginBottom: "1rem" }}>
              Send your project proposal &ldquo;<strong>{group?.title}</strong>&rdquo; to <strong>{requestingTeacher.teacherName}</strong>.
            </p>

            <div style={{ marginBottom: "1rem" }}>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.35rem" }}>
                Preference Choice Order
              </label>
              <select
                value={preferenceOrder}
                onChange={(e) => setPreferenceOrder(parseInt(e.target.value, 10))}
                className="input"
                style={{ width: "100%", padding: "0.5rem" }}
              >
                <option value={1}>1st Choice (Highest Priority)</option>
                <option value={2}>2nd Choice</option>
                <option value={3}>3rd Choice</option>
              </select>
              <span style={{ fontSize: "0.78rem", color: "var(--muted)", display: "block", marginTop: "0.25rem" }}>
                Supervisors will see your preference choice ranking when prioritizing incoming proposals.
              </span>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
              <button
                type="button"
                className="btn secondary tap"
                onClick={() => setRequestingTeacher(null)}
                disabled={isPending}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn primary tap"
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
