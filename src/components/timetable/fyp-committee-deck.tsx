import { useEffect, useState, useTransition } from "react";
import {
  AlertCircle,
  AlertTriangle,
  Award,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Download,
  ExternalLink,
  FileCheck,
  FileSpreadsheet,
  FileText,
  Filter,
  GraduationCap,
  Layers,
  Lock,
  Plus,
  RefreshCw,
  Save,
  Search,
  Send,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import type {
  FypCommitteeEvaluation,
  FypCommitteeMember,
  FypCommitteeModerationResult,
  FypFinalStudentGrade,
  FypGradeWeightageConfig,
  FypGroupRecord,
  FypInternalCommittee,
  FypStudentScore,
} from "@/lib/fyp-types";
import {
  DEFAULT_GRADE_WEIGHTAGE,
  DEFAULT_INTERNAL_RUBRIC,
  calculateComsatsGrade,
} from "@/lib/fyp-types";
import {
  assignGroupsToCommitteeServerFn,
  computeFinalGradesServerFn,
  createInternalCommitteeServerFn,
  exportMarksheetServerFn,
  getAllFypGroupsCoordinatorServerFn,
  getAllInternalCommitteesServerFn,
  getCommitteeEvaluationsForGroupServerFn,
  getCommitteeModerationViewServerFn,
  getFacultyAssignedCommitteesServerFn,
  getGradeWeightageConfigServerFn,
  getGroupFinalResultsServerFn,
  publishFinalResultsServerFn,
  saveGradeWeightageConfigServerFn,
  submitCommitteeEvaluationServerFn,
} from "@/lib/fyp-server-fn";
import { facultyList } from "@/lib/faculty";

interface FypCommitteeDeckProps {
  teacherId: number;
  teacherName: string;
}

export function FypCommitteeDeck({ teacherId, teacherName }: FypCommitteeDeckProps) {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"evaluate" | "moderation" | "aggregator" | "committees">("evaluate");

  // Data states
  const [myCommittees, setMyCommittees] = useState<
    Array<{ committee: FypInternalCommittee; groups: FypGroupRecord[]; isLead: boolean }>
  >([]);
  const [allCommittees, setAllCommittees] = useState<FypInternalCommittee[]>([]);
  const [allGroups, setAllGroups] = useState<FypGroupRecord[]>([]);
  const [weightage, setWeightage] = useState<FypGradeWeightageConfig>(DEFAULT_GRADE_WEIGHTAGE);

  // Moderation state
  const [selectedModerationGroupId, setSelectedModerationGroupId] = useState<string>("");
  const [moderationView, setModerationView] = useState<FypCommitteeModerationResult | null>(null);

  // Aggregator state
  const [selectedAggregatorGroupId, setSelectedAggregatorGroupId] = useState<string>("");
  const [computedGrades, setComputedGrades] = useState<FypFinalStudentGrade[]>([]);

  // Action status
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Evaluation Modal state
  const [evaluatingGroup, setEvaluatingGroup] = useState<FypGroupRecord | null>(null);
  const [evaluatingCommitteeId, setEvaluatingCommitteeId] = useState<string>("");
  const [criterionScores, setCriterionScores] = useState<Record<string, number>>({
    impl: 22,
    prog: 18,
    rep: 17,
    demo: 18,
  });
  const [studentIndivScores, setStudentIndivScores] = useState<Record<string, number>>({});
  const [evidenceNotes, setEvidenceNotes] = useState("");
  const [recommendation, setRecommendation] = useState<"accepted" | "minor_revisions" | "major_revisions" | "repeat">("accepted");
  const [remarks, setRemarks] = useState("");

  // Committee Creation Modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newCommName, setNewCommName] = useState("");
  const [newCommLeadId, setNewCommLeadId] = useState<number>(teacherId);
  const [selectedMemberIds, setSelectedMemberIds] = useState<number[]>([teacherId]);

  // Weightage Editing State
  const [editSupervisorWeight, setEditSupervisorWeight] = useState(30);
  const [editDefenseWeight, setEditDefenseWeight] = useState(30);
  const [editCommitteeWeight, setEditCommitteeWeight] = useState(40);

  const availableFaculty = facultyList.filter((f) => typeof f.teacherId === "number" && f.teacherId > 0);

  const loadData = async () => {
    try {
      setLoading(true);
      const [myRes, allCommRes, allGroupsRes, weightRes] = await Promise.all([
        getFacultyAssignedCommitteesServerFn({ data: { teacherId } }),
        getAllInternalCommitteesServerFn(),
        getAllFypGroupsCoordinatorServerFn(),
        getGradeWeightageConfigServerFn(),
      ]);

      setMyCommittees(myRes.assignments || []);
      setAllCommittees(allCommRes.committees || []);
      setAllGroups(allGroupsRes.groups || []);
      if (weightRes.config) {
        setWeightage(weightRes.config);
        setEditSupervisorWeight(weightRes.config.supervisorWeight);
        setEditDefenseWeight(weightRes.config.defenseWeight);
        setEditCommitteeWeight(weightRes.config.committeeWeight);
      }

      if (allGroupsRes.groups?.length > 0) {
        if (!selectedModerationGroupId) setSelectedModerationGroupId(allGroupsRes.groups[0].id);
        if (!selectedAggregatorGroupId) setSelectedAggregatorGroupId(allGroupsRes.groups[0].id);
      }
    } catch (err: any) {
      console.error("Failed to load committee deck data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [teacherId]);

  // Load moderation data when selected group changes
  useEffect(() => {
    if (!selectedModerationGroupId) return;
    getCommitteeModerationViewServerFn({ data: { groupId: selectedModerationGroupId } })
      .then((res) => setModerationView(res.moderation || null))
      .catch(() => setModerationView(null));
  }, [selectedModerationGroupId]);

  // Load computed grades when aggregator group changes
  useEffect(() => {
    if (!selectedAggregatorGroupId) return;
    getGroupFinalResultsServerFn({ data: { groupId: selectedAggregatorGroupId } })
      .then((res) => setComputedGrades(res.grades || []))
      .catch(() => setComputedGrades([]));
  }, [selectedAggregatorGroupId]);

  // Open evaluation modal
  const handleOpenEvaluationModal = (group: FypGroupRecord, committeeId: string) => {
    setEvaluatingGroup(group);
    setEvaluatingCommitteeId(committeeId);

    // Initial student indiv scores
    const initialIndiv: Record<string, number> = {};
    initialIndiv[group.leader.studentId] = 13;
    for (const m of group.members) {
      initialIndiv[m.studentId] = 13;
    }
    setStudentIndivScores(initialIndiv);
    setRemarks("");
    setEvidenceNotes("");
  };

  // Submit Evaluation
  const handleSubmitEvaluation = async () => {
    if (!evaluatingGroup) return;
    setActionError(null);
    setActionSuccess(null);

    const studentScoresPayload: FypStudentScore[] = [
      {
        studentId: evaluatingGroup.leader.studentId,
        regNo: evaluatingGroup.leader.regNo,
        studentName: evaluatingGroup.leader.fullName,
        individualMarks: studentIndivScores[evaluatingGroup.leader.studentId] ?? 13,
      },
      ...evaluatingGroup.members.map((m) => ({
        studentId: m.studentId,
        regNo: m.regNo,
        studentName: m.fullName,
        individualMarks: studentIndivScores[m.studentId] ?? 13,
      })),
    ];

    startTransition(async () => {
      try {
        const res = await submitCommitteeEvaluationServerFn({
          data: {
            committeeId: evaluatingCommitteeId,
            groupId: evaluatingGroup.id,
            evaluatorId: teacherId,
            evaluatorName: teacherName,
            groupCriterionScores: criterionScores,
            studentScores: studentScoresPayload,
            evidenceNotes,
            recommendation,
            remarks: remarks.trim() || "Evaluation submitted with full rubric review.",
          },
        });

        if (res.success) {
          setActionSuccess(`Evaluation submitted successfully for "${evaluatingGroup.title}"! (Total Score: ${res.evaluation.totalScore}/100)`);
          setEvaluatingGroup(null);
          await loadData();
        }
      } catch (err: any) {
        setActionError(err.message || "Failed to submit evaluation.");
      }
    });
  };

  // Handle Save Weightages
  const handleSaveWeightages = async () => {
    const sum = editSupervisorWeight + editDefenseWeight + editCommitteeWeight;
    if (sum !== 100) {
      setActionError(`Weightages must sum to exactly 100%. Current sum: ${sum}%.`);
      return;
    }

    setActionError(null);
    setActionSuccess(null);

    startTransition(async () => {
      try {
        const res = await saveGradeWeightageConfigServerFn({
          data: {
            supervisorWeight: editSupervisorWeight,
            defenseWeight: editDefenseWeight,
            committeeWeight: editCommitteeWeight,
            updatedBy: teacherName,
          },
        });
        if (res.success) {
          setActionSuccess("Updated official FYP grade weightage configuration!");
          setWeightage(res.config);
        }
      } catch (err: any) {
        setActionError(err.message || "Failed to save weightages.");
      }
    });
  };

  // Handle Compute Grades
  const handleComputeGrades = async () => {
    if (!selectedAggregatorGroupId) return;
    setActionError(null);
    setActionSuccess(null);

    startTransition(async () => {
      try {
        const res = await computeFinalGradesServerFn({
          data: {
            groupId: selectedAggregatorGroupId,
            calculatedBy: teacherName,
          },
        });
        if (res.success) {
          setActionSuccess("Calculated aggregated scores and letter grades!");
          setComputedGrades(res.grades);
        }
      } catch (err: any) {
        setActionError(err.message || "Failed to calculate final grades.");
      }
    });
  };

  // Handle Publish Results
  const handlePublishResults = async () => {
    if (!selectedAggregatorGroupId) return;
    setActionError(null);
    setActionSuccess(null);

    startTransition(async () => {
      try {
        const res = await publishFinalResultsServerFn({
          data: {
            groupId: selectedAggregatorGroupId,
            publishedBy: teacherName,
          },
        });
        if (res.success) {
          setActionSuccess("Official final FYP grades published to student portal & examination department!");
          setComputedGrades(res.grades);
        }
      } catch (err: any) {
        setActionError(err.message || "Failed to publish grades.");
      }
    });
  };

  // Handle Marksheet Export
  const handleExportMarksheet = async (format: "csv" | "json") => {
    try {
      const res = await exportMarksheetServerFn({ data: { format } });
      const blob = new Blob([res.data], { type: res.mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setActionError("Failed to export marksheet: " + err.message);
    }
  };

  // Create committee
  const handleCreateCommittee = async () => {
    if (!newCommName.trim()) {
      setActionError("Please provide a committee name.");
      return;
    }
    if (selectedMemberIds.length < 2) {
      setActionError("Please select at least 2 faculty members for the committee.");
      return;
    }

    const members: FypCommitteeMember[] = selectedMemberIds.map((tid) => {
      const fac = availableFaculty.find((f) => f.teacherId === tid);
      return {
        teacherId: tid,
        teacherName: fac?.name || `Teacher #${tid}`,
        email: fac?.email || "faculty@cuiatk.edu.pk",
        department: fac?.department || "Computer Science",
        isLead: tid === newCommLeadId,
      };
    });

    startTransition(async () => {
      try {
        const res = await createInternalCommitteeServerFn({
          data: {
            name: newCommName.trim(),
            members,
          },
        });
        if (res.success) {
          setActionSuccess(`Created committee "${res.committee.name}"!`);
          setIsCreateModalOpen(false);
          setNewCommName("");
          await loadData();
        }
      } catch (err: any) {
        setActionError(err.message || "Failed to create committee.");
      }
    });
  };

  // Calculate live preview total
  const groupPart = Object.entries(criterionScores).reduce((acc, [_, v]) => acc + (Number(v) || 0), 0);
  const indivValues = Object.values(studentIndivScores);
  const avgIndiv = indivValues.length > 0 ? indivValues.reduce((a, b) => a + b, 0) / indivValues.length : 0;
  const livePreviewTotal = Math.min(100, Math.round((groupPart + avgIndiv) * 10) / 10);
  const liveComsatsGrade = calculateComsatsGrade(livePreviewTotal);

  return (
    <div className="fyp-shell">
      {/* Top Banner */}
      <div className="fyp-hero-banner">
        <div className="fyp-hero-header">
          <div>
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "0.35rem", flexWrap: "wrap" }}>
              <span className="fyp-badge success">
                Phase 4: 7th Semester Module
              </span>
              <span className="fyp-badge primary">
                <span className="fyp-pulse-dot" />
                COMSATS Examination System
              </span>
            </div>
            <h1 className="fyp-hero-title">
              Internal Evaluation Committee &amp; Marks Aggregator
            </h1>
            <p className="fyp-hero-subtitle">
              7th semester internal marking, divergence moderation, configurable weightages, and final examination marksheets.
            </p>
          </div>

          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <button
              type="button"
              className="fyp-btn secondary"
              onClick={() => handleExportMarksheet("csv")}
              title="Download CSV Marksheet"
            >
              <FileSpreadsheet size={15} />
              <span>Export CSV</span>
            </button>
            <button
              type="button"
              className="fyp-btn secondary"
              onClick={loadData}
              disabled={loading}
              title="Sync status"
            >
              <RefreshCw size={15} className={loading ? "spin" : ""} />
              <span>Sync</span>
            </button>
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="fyp-kpi-grid" style={{ marginTop: "1.25rem", paddingTop: "1rem", borderTop: "1px solid color-mix(in srgb, var(--c-accent) 20%, var(--c-line))" }}>
          <div className="fyp-kpi-tile">
            <span className="kpi-label">Assigned Committees</span>
            <span className="kpi-value">{myCommittees.length}</span>
          </div>
          <div className="fyp-kpi-tile">
            <span className="kpi-label">7th Sem Groups</span>
            <span className="kpi-value">{allGroups.length}</span>
          </div>
          <div className="fyp-kpi-tile">
            <span className="kpi-label">Official Weightages</span>
            <span className="kpi-value" style={{ fontSize: "0.95rem", color: "#10b981" }}>
              {weightage.supervisorWeight}% Sup • {weightage.defenseWeight}% Def • {weightage.committeeWeight}% Comm
            </span>
          </div>
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

      {/* Tab Selectors */}
      <div className="fyp-tabs-bar">
        <button
          type="button"
          className={`fyp-tab-btn ${activeTab === "evaluate" ? "active" : ""}`}
          onClick={() => setActiveTab("evaluate")}
        >
          <Award size={15} />
          <span>Committee Marking</span>
          <span className="tab-count">{myCommittees.reduce((acc, c) => acc + c.groups.length, 0)}</span>
        </button>

        <button
          type="button"
          className={`fyp-tab-btn ${activeTab === "moderation" ? "active" : ""}`}
          onClick={() => setActiveTab("moderation")}
        >
          <AlertTriangle size={15} />
          <span>Moderation Inspector</span>
          {moderationView?.hasDivergenceAlert && (
            <span className="fyp-badge ruby" style={{ fontSize: "0.7rem", padding: "1px 6px" }}>
              Alert
            </span>
          )}
        </button>

        <button
          type="button"
          className={`fyp-tab-btn ${activeTab === "aggregator" ? "active" : ""}`}
          onClick={() => setActiveTab("aggregator")}
        >
          <Sliders size={15} />
          <span>Weightages &amp; Marksheet</span>
        </button>

        <button
          type="button"
          className={`fyp-tab-btn ${activeTab === "committees" ? "active" : ""}`}
          onClick={() => setActiveTab("committees")}
        >
          <Users size={15} />
          <span>All Committees ({allCommittees.length})</span>
        </button>
      </div>

      {/* =========================================================================
          TAB 1: COMMITTEE MARKING & ASSIGNED GROUPS
          ========================================================================= */}
      {activeTab === "evaluate" && (
        <section className="stack" style={{ gap: "1rem" }}>
          {myCommittees.length === 0 ? (
            <div className="fyp-card" style={{ padding: "3.5rem 1.5rem", textAlign: "center" }}>
              <Users size={40} style={{ opacity: 0.35, margin: "0 auto 0.75rem", color: "var(--c-accent)" }} />
              <h4 style={{ margin: "0 0 0.25rem", fontWeight: 700, fontSize: "1.1rem" }}>No Committee Assignments Yet</h4>
              <p style={{ color: "var(--c-muted)", margin: 0, fontSize: "0.88rem", maxWidth: "420px", marginLeft: "auto", marginRight: "auto" }}>
                You have not yet been assigned to a 7th semester internal evaluation committee. Committees formed by the coordinator will appear here.
              </p>
            </div>
          ) : (
            myCommittees.map((assignment) => (
              <div key={assignment.committee.id} className="fyp-card elevated-hover stack" style={{ padding: "1.35rem", gap: "1rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.75rem" }}>
                  <div>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: "0.45rem", marginBottom: "0.35rem" }}>
                      <span className="fyp-badge primary">
                        {assignment.committee.department}
                      </span>
                      {assignment.isLead && (
                        <span className="fyp-badge warning">
                          👑 Committee Lead
                        </span>
                      )}
                    </div>
                    <h3 style={{ fontSize: "1.2rem", fontWeight: 700, margin: "0.15rem 0" }}>
                      {assignment.committee.name}
                    </h3>
                    <div style={{ fontSize: "0.82rem", color: "var(--c-muted)" }}>
                      Evaluators: {assignment.committee.members.map((m) => m.teacherName).join(", ")}
                    </div>
                  </div>

                  <span className="fyp-badge neutral">
                    {assignment.groups.length} Assigned Groups
                  </span>
                </div>

                {/* Groups list */}
                {assignment.groups.length === 0 ? (
                  <div style={{ padding: "1.25rem", textAlign: "center", background: "color-mix(in srgb, var(--c-canvas) 60%, var(--c-paper))", borderRadius: "0.75rem", color: "var(--c-muted)", fontSize: "0.85rem", border: "1px dashed var(--c-line)" }}>
                    No project groups assigned to this committee yet.
                  </div>
                ) : (
                  <div className="stack" style={{ gap: "0.75rem" }}>
                    {assignment.groups.map((grp) => (
                      <div
                        key={grp.id}
                        className="fyp-card accent-edge"
                        style={{
                          padding: "1rem",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          flexWrap: "wrap",
                          gap: "0.75rem",
                        }}
                      >
                        <div>
                          <div style={{ display: "inline-flex", gap: "0.4rem", alignItems: "center", marginBottom: "0.2rem" }}>
                            <span className="fyp-badge primary" style={{ fontSize: "0.75rem", padding: "2px 6px" }}>{grp.domain}</span>
                            <span style={{ fontSize: "0.78rem", color: "var(--c-muted)" }}>
                              Leader: {grp.leader.fullName} ({grp.leader.regNo})
                            </span>
                          </div>
                          <div style={{ fontWeight: 700, fontSize: "1.05rem" }}>{grp.title}</div>
                          <div style={{ fontSize: "0.8rem", color: "var(--c-muted)", marginTop: "0.2rem" }}>
                            Team: {[grp.leader, ...grp.members].map((m) => m.fullName).join(", ")}
                          </div>
                        </div>

                        <button
                          type="button"
                          className="fyp-btn primary"
                          onClick={() => handleOpenEvaluationModal(grp, assignment.committee.id)}
                        >
                          <FileCheck size={14} />
                          <span>Score Group (7th Sem)</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </section>
      )}

      {/* =========================================================================
          TAB 2: MODERATION & DIVERGENCE INSPECTOR
          ========================================================================= */}
      {activeTab === "moderation" && (
        <section className="stack" style={{ gap: "1rem" }}>
          {/* Group selector */}
          <div className="fyp-card" style={{ padding: "1.25rem", display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
            <label style={{ fontWeight: 600, fontSize: "0.88rem" }}>Select FYP Group for Moderation Analysis:</label>
            <select
              value={selectedModerationGroupId}
              onChange={(e) => setSelectedModerationGroupId(e.target.value)}
              className="fyp-input"
              style={{ flex: 1, minWidth: "260px" }}
            >
              {allGroups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.title} ({g.domain})
                </option>
              ))}
            </select>
          </div>

          {moderationView && (
            <div className="fyp-card elevated-hover stack" style={{ padding: "1.35rem", gap: "1rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem" }}>
                <div>
                  <h3 style={{ fontSize: "1.25rem", fontWeight: 700, margin: "0 0 0.25rem" }}>
                    Committee Score Divergence Analysis
                  </h3>
                  <div style={{ fontSize: "0.85rem", color: "var(--c-muted)" }}>
                    {moderationView.groupTitle} • {moderationView.evaluationsCount} of {moderationView.totalCommitteeMembers} Evaluations Submitted
                  </div>
                </div>

                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", color: "var(--c-muted)" }}>
                    Committee Average
                  </div>
                  <div style={{ fontSize: "1.75rem", fontWeight: 800, color: "var(--c-accent)" }}>
                    {moderationView.averageScore}
                    <span style={{ fontSize: "0.85rem", fontWeight: 500 }}> / 100</span>
                  </div>
                </div>
              </div>

              {/* Divergence Alert Banner */}
              {moderationView.hasDivergenceAlert ? (
                <div
                  className="fyp-badge ruby"
                  style={{
                    padding: "0.85rem 1rem",
                    borderRadius: "0.75rem",
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.75rem",
                    fontSize: "0.88rem",
                  }}
                >
                  <AlertTriangle size={20} />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>
                      High Score Divergence Alert: {moderationView.maxDivergence} Marks Difference!
                    </div>
                    <div style={{ fontSize: "0.82rem", opacity: 0.9 }}>
                      Evaluation scores vary by more than 15 marks across committee members. A moderation review or consensus meeting is recommended.
                    </div>
                  </div>
                </div>
              ) : (
                <div
                  className="fyp-badge success"
                  style={{
                    padding: "0.85rem 1rem",
                    borderRadius: "0.75rem",
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.6rem",
                    fontSize: "0.88rem",
                  }}
                >
                  <CheckCircle2 size={16} />
                  <span>Scores are within acceptable university variance tolerance (Divergence: {moderationView.maxDivergence} marks).</span>
                </div>
              )}

              {/* Member breakdown */}
              <div style={{ marginTop: "0.5rem" }}>
                <div style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--c-muted)", marginBottom: "0.5rem" }}>
                  Individual Evaluator Scores
                </div>
                {moderationView.scores.length === 0 ? (
                  <div style={{ padding: "1rem", textAlign: "center", color: "var(--c-muted)", fontSize: "0.85rem" }}>
                    No evaluations submitted for this group yet.
                  </div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "0.75rem" }}>
                    {moderationView.scores.map((s) => (
                      <div
                        key={s.evaluatorId}
                        className="fyp-card"
                        style={{
                          padding: "0.75rem 1rem",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 600, fontSize: "0.92rem" }}>{s.evaluatorName}</div>
                          <div style={{ fontSize: "0.75rem", color: "var(--c-muted)" }}>Committee Member</div>
                        </div>
                        <div style={{ fontSize: "1.35rem", fontWeight: 800, color: "var(--c-accent)" }}>
                          {s.totalScore}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      )}

      {/* =========================================================================
          TAB 3: WEIGHTAGES & MARKS AGGREGATOR
          ========================================================================= */}
      {activeTab === "aggregator" && (
        <section className="stack" style={{ gap: "1.25rem" }}>
          {/* Weightage Config Card */}
          <div className="card" style={{ padding: "1.25rem" }}>
            <h3 style={{ fontSize: "1.15rem", fontWeight: 700, marginBottom: "0.3rem" }}>
              COMSATS FYP Grade Weightage Policy
            </h3>
            <p style={{ fontSize: "0.85rem", color: "var(--muted)", marginBottom: "1rem" }}>
              Configure the academic distribution across supervisor progress, 6th semester defense, and 7th semester committee marks.
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem", marginBottom: "1rem" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, marginBottom: "0.3rem" }}>
                  Supervisor Milestones Weight (%)
                </label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={editSupervisorWeight}
                  onChange={(e) => setEditSupervisorWeight(Number(e.target.value))}
                  className="input"
                  style={{ width: "100%", padding: "0.5rem" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, marginBottom: "0.3rem" }}>
                  6th Semester Defense Weight (%)
                </label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={editDefenseWeight}
                  onChange={(e) => setEditDefenseWeight(Number(e.target.value))}
                  className="input"
                  style={{ width: "100%", padding: "0.5rem" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, marginBottom: "0.3rem" }}>
                  7th Semester Committee Weight (%)
                </label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={editCommitteeWeight}
                  onChange={(e) => setEditCommitteeWeight(Number(e.target.value))}
                  className="input"
                  style={{ width: "100%", padding: "0.5rem" }}
                />
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
              <div style={{ fontSize: "0.85rem", fontWeight: 600 }}>
                Total Weight:{" "}
                <span style={{ color: editSupervisorWeight + editDefenseWeight + editCommitteeWeight === 100 ? "#10b981" : "#ef4444" }}>
                  {editSupervisorWeight + editDefenseWeight + editCommitteeWeight}%
                </span>{" "}
                {editSupervisorWeight + editDefenseWeight + editCommitteeWeight === 100 ? "✓ Valid" : "(Must equal 100%)"}
              </div>

              <button
                type="button"
                className="btn primary tap"
                onClick={handleSaveWeightages}
                disabled={isPending || editSupervisorWeight + editDefenseWeight + editCommitteeWeight !== 100}
              >
                <Save size={14} />
                <span>Save Weightage Settings</span>
              </button>
            </div>
          </div>

          {/* Group Selector & Computation Controls */}
          <div className="card" style={{ padding: "1.25rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem", marginBottom: "1rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flex: 1, minWidth: "280px" }}>
                <label style={{ fontWeight: 600, fontSize: "0.85rem", whiteSpace: "nowrap" }}>Select Group:</label>
                <select
                  value={selectedAggregatorGroupId}
                  onChange={(e) => setSelectedAggregatorGroupId(e.target.value)}
                  className="input"
                  style={{ flex: 1, padding: "0.45rem" }}
                >
                  {allGroups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.title} ({g.domain})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button
                  type="button"
                  className="btn secondary tap"
                  onClick={handleComputeGrades}
                  disabled={isPending || !selectedAggregatorGroupId}
                >
                  <Sparkles size={14} />
                  <span>Compute Grades</span>
                </button>
                <button
                  type="button"
                  className="btn primary tap"
                  onClick={handlePublishResults}
                  disabled={isPending || computedGrades.length === 0}
                  style={{ background: "#10b981", color: "#fff" }}
                >
                  <Lock size={14} />
                  <span>Publish &amp; Lock Grades</span>
                </button>
              </div>
            </div>

            {/* Computed Grades Table */}
            {computedGrades.length === 0 ? (
              <div style={{ padding: "2rem", textAlign: "center", background: "var(--surface)", borderRadius: "8px", color: "var(--muted)", fontSize: "0.88rem" }}>
                Click &ldquo;Compute Grades&rdquo; to aggregate supervisor, defense, and committee scores for this group.
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem", textAlign: "left" }}>
                  <thead>
                    <tr style={{ borderBottom: "2px solid var(--border)", background: "var(--surface)" }}>
                      <th style={{ padding: "0.6rem 0.8rem" }}>Student</th>
                      <th style={{ padding: "0.6rem 0.8rem" }}>Reg No</th>
                      <th style={{ padding: "0.6rem 0.8rem" }}>Supervisor (30%)</th>
                      <th style={{ padding: "0.6rem 0.8rem" }}>Defense (30%)</th>
                      <th style={{ padding: "0.6rem 0.8rem" }}>Committee (40%)</th>
                      <th style={{ padding: "0.6rem 0.8rem" }}>Weighted Total</th>
                      <th style={{ padding: "0.6rem 0.8rem" }}>Letter Grade</th>
                      <th style={{ padding: "0.6rem 0.8rem" }}>GPA</th>
                      <th style={{ padding: "0.6rem 0.8rem" }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {computedGrades.map((g) => (
                      <tr key={g.studentId} style={{ borderBottom: "1px solid var(--border)" }}>
                        <td style={{ padding: "0.6rem 0.8rem", fontWeight: 600 }}>{g.studentName}</td>
                        <td style={{ padding: "0.6rem 0.8rem", color: "var(--muted)" }}>{g.regNo}</td>
                        <td style={{ padding: "0.6rem 0.8rem" }}>{g.supervisorScore}</td>
                        <td style={{ padding: "0.6rem 0.8rem" }}>{g.defenseScore}</td>
                        <td style={{ padding: "0.6rem 0.8rem" }}>{g.committeeScore}</td>
                        <td style={{ padding: "0.6rem 0.8rem", fontWeight: 700, color: "var(--accent)" }}>
                          {g.weightedTotal} / 100
                        </td>
                        <td style={{ padding: "0.6rem 0.8rem" }}>
                          <span
                            className="badge"
                            style={{
                              background: g.letterGrade.startsWith("A") ? "rgba(16, 185, 129, 0.2)" : "rgba(99, 102, 241, 0.2)",
                              color: g.letterGrade.startsWith("A") ? "#10b981" : "var(--accent)",
                              fontWeight: 800,
                            }}
                          >
                            {g.letterGrade}
                          </span>
                        </td>
                        <td style={{ padding: "0.6rem 0.8rem", fontWeight: 700 }}>
                          {g.gradePoint.toFixed(2)}
                        </td>
                        <td style={{ padding: "0.6rem 0.8rem" }}>
                          <span
                            className="badge"
                            style={{
                              background: g.isPublished ? "rgba(16, 185, 129, 0.15)" : "rgba(245, 158, 11, 0.15)",
                              color: g.isPublished ? "#10b981" : "#d97706",
                              fontSize: "0.72rem",
                            }}
                          >
                            {g.isPublished ? "Published" : "Draft"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      )}

      {/* =========================================================================
          TAB 4: ALL COMMITTEES MANAGEMENT
          ========================================================================= */}
      {activeTab === "committees" && (
        <section className="stack" style={{ gap: "1rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ fontSize: "1.15rem", fontWeight: 700, margin: 0 }}>
              7th Semester Evaluation Committees Roster
            </h3>
            <button
              type="button"
              className="btn primary tap"
              onClick={() => setIsCreateModalOpen(true)}
              style={{ fontSize: "0.82rem" }}
            >
              <Plus size={15} />
              <span>Form New Committee</span>
            </button>
          </div>

          <div className="stack" style={{ gap: "0.75rem" }}>
            {allCommittees.map((comm) => (
              <div key={comm.id} className="card" style={{ padding: "1.25rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.5rem" }}>
                  <div>
                    <span className="badge" style={{ background: "rgba(99, 102, 241, 0.15)", color: "var(--accent)", marginBottom: "0.25rem", display: "inline-block" }}>
                      {comm.department}
                    </span>
                    <h4 style={{ fontSize: "1.1rem", fontWeight: 700, margin: "0.15rem 0" }}>
                      {comm.name}
                    </h4>
                  </div>
                  <span className="badge" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                    {comm.assignedGroupIds.length} Groups Assigned
                  </span>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "0.75rem", marginTop: "0.75rem" }}>
                  {comm.members.map((m) => (
                    <div
                      key={m.teacherId}
                      style={{
                        padding: "0.6rem 0.8rem",
                        borderRadius: "6px",
                        background: m.isLead ? "rgba(99, 102, 241, 0.08)" : "var(--surface)",
                        border: m.isLead ? "1px solid rgba(99, 102, 241, 0.3)" : "1px solid var(--border)",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600, fontSize: "0.85rem" }}>
                          {m.isLead ? "👑 " : "👤 "} {m.teacherName}
                        </div>
                        <div style={{ fontSize: "0.72rem", color: "var(--muted)" }}>{m.department}</div>
                      </div>
                      {m.isLead && (
                        <span className="badge" style={{ background: "var(--accent)", color: "#fff", fontSize: "0.68rem" }}>
                          Lead
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* =========================================================================
          MODAL: EVALUATE GROUP (7TH SEMESTER INTERNAL RUBRIC)
          ========================================================================= */}
      {evaluatingGroup && (
        <div className="modal-backdrop" style={{ zIndex: 1000 }} onClick={() => setEvaluatingGroup(null)}>
          <div className="modal-card" style={{ maxWidth: "680px" }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3>7th Semester Internal Committee Evaluation</h3>
                <p className="fine quiet">{evaluatingGroup.title}</p>
              </div>
              <button type="button" className="close-btn" onClick={() => setEvaluatingGroup(null)}>×</button>
            </div>

            <div className="modal-body stack" style={{ gap: "1.25rem", maxHeight: "75vh", overflowY: "auto" }}>
              {/* Group Criteria Inputs */}
              <div>
                <h4 style={{ fontSize: "0.92rem", fontWeight: 700, marginBottom: "0.5rem" }}>
                  Group Deliverable Criteria (85 Marks Total)
                </h4>
                <div className="stack" style={{ gap: "0.75rem" }}>
                  {DEFAULT_INTERNAL_RUBRIC.filter((c) => c.id !== "indiv").map((criterion) => (
                    <div
                      key={criterion.id}
                      style={{
                        padding: "0.75rem",
                        background: "var(--surface)",
                        borderRadius: "6px",
                        border: "1px solid var(--border)",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.25rem" }}>
                        <span style={{ fontWeight: 600, fontSize: "0.85rem" }}>{criterion.name}</span>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                          <input
                            type="number"
                            min={0}
                            max={criterion.maxMarks}
                            value={criterionScores[criterion.id] ?? 0}
                            onChange={(e) =>
                              setCriterionScores({
                                ...criterionScores,
                                [criterion.id]: Math.min(criterion.maxMarks, Math.max(0, Number(e.target.value))),
                              })
                            }
                            className="input"
                            style={{ width: "60px", padding: "0.3rem", textAlign: "center", fontWeight: 700 }}
                          />
                          <span style={{ fontSize: "0.78rem", color: "var(--muted)" }}>/ {criterion.maxMarks}</span>
                        </div>
                      </div>
                      <p style={{ fontSize: "0.75rem", color: "var(--muted)", margin: 0, lineHeight: 1.35 }}>
                        {criterion.description}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Per-Student Individual Marks */}
              <div>
                <h4 style={{ fontSize: "0.92rem", fontWeight: 700, marginBottom: "0.5rem" }}>
                  Individual Student Performance &amp; Ownership (15 Marks Max)
                </h4>
                <div className="stack" style={{ gap: "0.5rem" }}>
                  {[evaluatingGroup.leader, ...evaluatingGroup.members].map((st) => (
                    <div
                      key={st.studentId}
                      style={{
                        padding: "0.6rem 0.8rem",
                        background: "var(--surface)",
                        borderRadius: "6px",
                        border: "1px solid var(--border)",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600, fontSize: "0.85rem" }}>{st.fullName}</div>
                        <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>{st.regNo}</div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                        <input
                          type="number"
                          min={0}
                          max={15}
                          value={studentIndivScores[st.studentId] ?? 13}
                          onChange={(e) =>
                            setStudentIndivScores({
                              ...studentIndivScores,
                              [st.studentId]: Math.min(15, Math.max(0, Number(e.target.value))),
                            })
                          }
                          className="input"
                          style={{ width: "55px", padding: "0.3rem", textAlign: "center", fontWeight: 700 }}
                        />
                        <span style={{ fontSize: "0.78rem", color: "var(--muted)" }}>/ 15</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Evidence Notes Input */}
              <div>
                <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, marginBottom: "0.3rem" }}>
                  Evidence Support &amp; Verification Links (Git commits, task logs, live walkthrough)
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Verified GitHub commit velocity (branch feature/auth). Demo verified live on local testbed."
                  value={evidenceNotes}
                  onChange={(e) => setEvidenceNotes(e.target.value)}
                  className="input"
                  style={{ width: "100%", padding: "0.5rem" }}
                />
              </div>

              {/* Recommendation */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, marginBottom: "0.3rem" }}>
                    Committee Recommendation
                  </label>
                  <select
                    value={recommendation}
                    onChange={(e) => setRecommendation(e.target.value as any)}
                    className="input"
                    style={{ width: "100%", padding: "0.5rem" }}
                  >
                    <option value="accepted">Accepted (Proceed to External)</option>
                    <option value="minor_revisions">Minor Revisions Required</option>
                    <option value="major_revisions">Major Revisions Required</option>
                    <option value="repeat">Repeat Semester Evaluation</option>
                  </select>
                </div>

                {/* Live Grade Preview */}
                <div
                  style={{
                    padding: "0.6rem 0.8rem",
                    borderRadius: "6px",
                    background: "rgba(99, 102, 241, 0.08)",
                    border: "1px solid rgba(99, 102, 241, 0.2)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <div style={{ fontSize: "0.72rem", textTransform: "uppercase", fontWeight: 700, color: "var(--muted)" }}>
                      Live Score Total
                    </div>
                    <div style={{ fontWeight: 800, fontSize: "1.25rem", color: "var(--accent)" }}>
                      {livePreviewTotal} / 100
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "0.72rem", color: "var(--muted)" }}>Predicted Grade</div>
                    <span className="badge" style={{ background: "var(--accent)", color: "#fff", fontWeight: 800 }}>
                      {liveComsatsGrade.letterGrade} ({liveComsatsGrade.gradePoint.toFixed(2)})
                    </span>
                  </div>
                </div>
              </div>

              {/* Feedback Remarks */}
              <div>
                <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, marginBottom: "0.3rem" }}>
                  Feedback &amp; Qualitative Assessment Remarks *
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Provide comprehensive review notes and specific guidance for the final external defense..."
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  className="input"
                  style={{ width: "100%", padding: "0.5rem" }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "0.5rem" }}>
                <button
                  type="button"
                  className="btn secondary tap"
                  onClick={() => setEvaluatingGroup(null)}
                  disabled={isPending}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn primary tap"
                  onClick={handleSubmitEvaluation}
                  disabled={isPending}
                >
                  <CheckCircle2 size={15} />
                  <span>Submit Evaluation</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: FORM NEW COMMITTEE (COORDINATOR)
          ========================================================================= */}
      {isCreateModalOpen && (
        <div className="modal-backdrop" style={{ zIndex: 1000 }} onClick={() => setIsCreateModalOpen(false)}>
          <div className="modal-card" style={{ maxWidth: "520px" }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3>Form 7th Sem Internal Committee</h3>
                <p className="fine quiet">Select 2 to 4 faculty members and designate the lead.</p>
              </div>
              <button type="button" className="close-btn" onClick={() => setIsCreateModalOpen(false)}>×</button>
            </div>

            <div className="modal-body stack" style={{ gap: "1rem" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.3rem" }}>
                  Committee Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 7th Sem Committee 01 - AI & Data Science"
                  value={newCommName}
                  onChange={(e) => setNewCommName(e.target.value)}
                  className="input"
                  style={{ width: "100%", padding: "0.5rem" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.3rem" }}>
                  Select Committee Faculty Members (2 to 4)
                </label>
                <div style={{ maxHeight: "180px", overflowY: "auto", border: "1px solid var(--border)", borderRadius: "6px", padding: "0.5rem" }}>
                  {availableFaculty.map((fac) => {
                    const isChecked = selectedMemberIds.includes(fac.teacherId!);
                    return (
                      <label
                        key={fac.teacherId}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.5rem",
                          padding: "0.35rem 0.5rem",
                          borderRadius: "4px",
                          background: isChecked ? "rgba(99, 102, 241, 0.08)" : "transparent",
                          cursor: "pointer",
                          fontSize: "0.85rem",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              if (selectedMemberIds.length < 4) {
                                setSelectedMemberIds([...selectedMemberIds, fac.teacherId!]);
                              }
                            } else {
                              if (selectedMemberIds.length > 2) {
                                setSelectedMemberIds(selectedMemberIds.filter((id) => id !== fac.teacherId));
                              }
                            }
                          }}
                        />
                        <span>{fac.name}</span>
                        <span style={{ fontSize: "0.72rem", color: "var(--muted)" }}>({fac.department})</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.3rem" }}>
                  Designate Committee Lead
                </label>
                <select
                  value={newCommLeadId}
                  onChange={(e) => setNewCommLeadId(Number(e.target.value))}
                  className="input"
                  style={{ width: "100%", padding: "0.5rem" }}
                >
                  {selectedMemberIds.map((tid) => {
                    const fac = availableFaculty.find((f) => f.teacherId === tid);
                    return (
                      <option key={tid} value={tid}>
                        👑 {fac?.name || `Teacher #${tid}`}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "0.5rem" }}>
                <button
                  type="button"
                  className="btn secondary tap"
                  onClick={() => setIsCreateModalOpen(false)}
                  disabled={isPending}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn primary tap"
                  onClick={handleCreateCommittee}
                  disabled={isPending || selectedMemberIds.length < 2 || !newCommName.trim()}
                >
                  <Plus size={14} />
                  <span>Create Committee</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
