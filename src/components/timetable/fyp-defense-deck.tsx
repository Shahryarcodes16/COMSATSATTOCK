import { useEffect, useMemo, useState, useTransition } from "react";
import {
  AlertCircle,
  Award,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileCheck,
  Filter,
  GraduationCap,
  Layers,
  Lock,
  MapPin,
  Plus,
  RefreshCw,
  Scale,
  Send,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Sparkles,
  UserCheck,
  Users,
  X,
  XCircle,
} from "lucide-react";
import { facultyList } from "@/lib/faculty";
import type {
  FypDefensePanel,
  FypDefenseRecommendation,
  FypDefenseResultSummary,
  FypDefenseSchedule,
  FypGroupRecord,
  FypPanelMember,
  FypPanelistEvaluation,
  FypStudentScore,
} from "@/lib/fyp-types";
import { DEFAULT_DEFENSE_RUBRIC } from "@/lib/fyp-types";
import {
  assignGroupsToPanelServerFn,
  autoSuggestPanelsServerFn,
  createDefensePanelServerFn,
  getAllDefensePanelsServerFn,
  getAllDefenseSchedulesServerFn,
  getAllFypGroupsCoordinatorServerFn,
  getFacultyAssignedDefensesServerFn,
  getGroupDefenseResultServerFn,
  publishDefenseResultServerFn,
  scheduleDefenseServerFn,
  submitDefenseEvaluationServerFn,
} from "@/lib/fyp-server-fn";

interface FypDefenseDeckProps {
  teacherId: number;
  teacherName: string;
}

const VENUES = [
  "Auditorium & Seminar Hall",
  "CS Lab 1 (Main Academic Block)",
  "CS Lab 2 (Software Engineering Lab)",
  "CS Conference Room (1st Floor)",
  "Hardware & Embedded Systems Lab",
  "Postgraduate Research Seminar Room",
];

export function FypDefenseDeck({ teacherId, teacherName }: FypDefenseDeckProps) {
  const [activeTab, setActiveTab] = useState<"assigned" | "coordinator_panels" | "coordinator_schedules" | "results">("assigned");
  const [loading, setLoading] = useState(true);
  const [assignedDefenses, setAssignedDefenses] = useState<
    Array<{
      schedule: FypDefenseSchedule;
      group: FypGroupRecord;
      panel: FypDefensePanel;
      myEvaluation?: FypPanelistEvaluation;
    }>
  >([]);
  const [allPanels, setAllPanels] = useState<FypDefensePanel[]>([]);
  const [allSchedules, setAllSchedules] = useState<FypDefenseSchedule[]>([]);
  const [allGroups, setAllGroups] = useState<FypGroupRecord[]>([]);

  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Evaluation modal
  const [evaluatingDefense, setEvaluatingDefense] = useState<{
    schedule: FypDefenseSchedule;
    group: FypGroupRecord;
    panel: FypDefensePanel;
    myEvaluation?: FypPanelistEvaluation;
  } | null>(null);

  // Scoring state
  const [criterionScores, setCriterionScores] = useState<Record<string, number>>({
    pres: 12,
    prob: 12,
    tech: 16,
    arch: 16,
    qna: 12,
  });
  const [studentScores, setStudentScores] = useState<FypStudentScore[]>([]);
  const [recommendation, setRecommendation] = useState<FypDefenseRecommendation>("accepted");
  const [evalRemarks, setEvalRemarks] = useState("");

  // Panel creation modal (Coordinator)
  const [isPanelModalOpen, setIsPanelModalOpen] = useState(false);
  const [panelName, setPanelName] = useState("");
  const [selectedPanelistIds, setSelectedPanelistIds] = useState<number[]>([]);
  const [designatedChairId, setDesignatedChairId] = useState<number | null>(null);

  // Defense scheduling modal (Coordinator)
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [schedGroupId, setSchedGroupId] = useState("");
  const [schedPanelId, setSchedPanelId] = useState("");
  const [schedDate, setSchedDate] = useState(() => new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0]);
  const [schedStartTime, setSchedStartTime] = useState("09:00");
  const [schedEndTime, setSchedEndTime] = useState("09:45");
  const [schedVenue, setSchedVenue] = useState(VENUES[0]);

  // Results review modal
  const [viewingResultGroupId, setViewingResultGroupId] = useState<string | null>(null);
  const [groupResultSummary, setGroupResultSummary] = useState<FypDefenseResultSummary | null>(null);

  const [isPending, startTransition] = useTransition();

  const loadData = async () => {
    try {
      setLoading(true);
      const [assignedRes, panelsRes, schedsRes, groupsRes] = await Promise.all([
        getFacultyAssignedDefensesServerFn({ data: { teacherId } }),
        getAllDefensePanelsServerFn(),
        getAllDefenseSchedulesServerFn(),
        getAllFypGroupsCoordinatorServerFn(),
      ]);

      setAssignedDefenses(assignedRes.defenses || []);
      setAllPanels(panelsRes.panels || []);
      setAllSchedules(schedsRes.schedules || []);
      setAllGroups(groupsRes.groups || []);
    } catch (err) {
      console.error("Failed to load defense deck data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [teacherId]);

  // Open evaluation form
  const handleOpenEvaluation = (item: {
    schedule: FypDefenseSchedule;
    group: FypGroupRecord;
    panel: FypDefensePanel;
    myEvaluation?: FypPanelistEvaluation;
  }) => {
    setEvaluatingDefense(item);
    if (item.myEvaluation) {
      setCriterionScores(item.myEvaluation.groupCriterionScores || {});
      setStudentScores(item.myEvaluation.studentScores || []);
      setRecommendation(item.myEvaluation.recommendation);
      setEvalRemarks(item.myEvaluation.remarks || "");
    } else {
      // Default scores
      setCriterionScores({
        pres: 12,
        prob: 12,
        tech: 16,
        arch: 16,
        qna: 12,
      });
      const initialStudentScores: FypStudentScore[] = [
        {
          studentId: item.group.leader.studentId,
          regNo: item.group.leader.regNo,
          studentName: item.group.leader.fullName,
          individualMarks: 13,
        },
        ...item.group.members.map((m) => ({
          studentId: m.studentId,
          regNo: m.regNo,
          studentName: m.fullName,
          individualMarks: 12,
        })),
      ];
      setStudentScores(initialStudentScores);
      setRecommendation("accepted");
      setEvalRemarks("");
    }
  };

  // Submit Evaluation
  const handleSubmitEvaluation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!evaluatingDefense) return;

    setActionError(null);
    setActionSuccess(null);

    startTransition(async () => {
      try {
        const res = await submitDefenseEvaluationServerFn({
          data: {
            panelId: evaluatingDefense.panel.id,
            groupId: evaluatingDefense.group.id,
            panelistId: teacherId,
            panelistName: teacherName,
            groupCriterionScores: criterionScores,
            studentScores,
            recommendation,
            remarks: evalRemarks.trim(),
          },
        });
        if (res.success) {
          setActionSuccess(`Evaluation for "${evaluatingDefense.group.title}" submitted successfully! Marks locked.`);
          setEvaluatingDefense(null);
          await loadData();
        }
      } catch (err: any) {
        setActionError(err.message || "Failed to submit defense evaluation.");
      }
    });
  };

  // Create Panel (Coordinator)
  const handleCreatePanel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedPanelistIds.length < 2) {
      setActionError("Please select at least 2 faculty members for the panel.");
      return;
    }

    const members: FypPanelMember[] = selectedPanelistIds.map((tid) => {
      const f = facultyList.find((fac) => fac.teacherId === tid);
      return {
        teacherId: tid,
        teacherName: f?.name || `Teacher #${tid}`,
        email: f?.email || "",
        department: f?.department || "Computer Science",
        isChair: designatedChairId === tid || selectedPanelistIds[0] === tid,
      };
    });

    startTransition(async () => {
      try {
        const res = await createDefensePanelServerFn({
          data: {
            name: panelName.trim(),
            members,
          },
        });
        if (res.success) {
          setActionSuccess(`Defense Panel "${panelName}" created successfully!`);
          setIsPanelModalOpen(false);
          setPanelName("");
          setSelectedPanelistIds([]);
          setDesignatedChairId(null);
          await loadData();
        }
      } catch (err: any) {
        setActionError(err.message || "Failed to create panel.");
      }
    });
  };

  // Schedule Defense (Coordinator)
  const handleScheduleDefense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!schedGroupId || !schedPanelId) return;

    setActionError(null);
    setActionSuccess(null);

    startTransition(async () => {
      try {
        const res = await scheduleDefenseServerFn({
          data: {
            groupId: schedGroupId,
            panelId: schedPanelId,
            defenseDate: schedDate,
            startTime: schedStartTime,
            endTime: schedEndTime,
            venue: schedVenue,
          },
        });
        if (res.success) {
          setActionSuccess(`Defense scheduled on ${schedDate} at ${schedStartTime} (${schedVenue})! Conflict checks passed.`);
          setIsScheduleModalOpen(false);
          await loadData();
        }
      } catch (err: any) {
        setActionError(err.message || "Failed to schedule defense.");
      }
    });
  };

  // Publish Results (Coordinator)
  const handlePublishResult = async (groupId: string) => {
    setActionError(null);
    setActionSuccess(null);

    startTransition(async () => {
      try {
        const res = await publishDefenseResultServerFn({
          data: {
            groupId,
            publishedBy: teacherName,
          },
        });
        if (res.success) {
          setActionSuccess("Defense evaluation results published to students and exam portal!");
          setGroupResultSummary(res.resultSummary);
          await loadData();
        }
      } catch (err: any) {
        setActionError(err.message || "Failed to publish result.");
      }
    });
  };

  // View Results
  const handleViewResult = async (groupId: string) => {
    setViewingResultGroupId(groupId);
    try {
      const res = await getGroupDefenseResultServerFn({
        data: {
          groupId,
          role: "coordinator",
          requesterId: teacherId,
        },
      });
      setGroupResultSummary(res.result || null);
    } catch (err) {
      console.error("Failed to load result summary:", err);
    }
  };

  // Live total calculation for evaluation rubric
  const groupSum = Object.values(criterionScores).reduce((a, b) => a + (Number(b) || 0), 0);
  const indivAvg = studentScores.length > 0
    ? studentScores.reduce((a, b) => a + (Number(b.individualMarks) || 0), 0) / studentScores.length
    : 0;
  const currentTotalCalculated = Math.min(100, Math.round((groupSum + indivAvg) * 10) / 10);

  return (
    <div className="fyp-defense-deck stack" style={{ gap: "1.5rem" }}>
      {/* Top Banner */}
      <div
        className="faculty-day-summary-card"
        style={{
          background: "linear-gradient(135deg, rgba(245, 158, 11, 0.08), rgba(99, 102, 241, 0.04))",
          borderColor: "rgba(245, 158, 11, 0.25)",
        }}
      >
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "1rem" }}>
          <div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
              <span className="badge" style={{ background: "rgba(245, 158, 11, 0.15)", color: "#d97706" }}>
                Phase 3: 6th Semester Defense & Evaluation
              </span>
              <span className="badge" style={{ background: "rgba(99, 102, 241, 0.15)", color: "var(--accent)" }}>
                Independent Blind Scoring Rubric
              </span>
            </div>
            <h2 style={{ fontSize: "1.4rem", fontWeight: 800, margin: "0.25rem 0" }}>
              Defense Panels & Presentations
            </h2>
            <p style={{ color: "var(--muted)", fontSize: "0.9rem", margin: 0 }}>
              {teacherName} • Evaluator & Panelist Workspace
            </p>
          </div>

          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              type="button"
              className="btn secondary tap"
              onClick={loadData}
              disabled={loading}
              title="Refresh defense data"
            >
              <RefreshCw size={15} className={loading ? "spin" : ""} />
            </button>
          </div>
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

      {/* Tabs */}
      <div style={{ display: "flex", gap: "0.5rem", borderBottom: "1px solid var(--border)", paddingBottom: "0.5rem", flexWrap: "wrap" }}>
        <button
          type="button"
          className={`faculty-tab-pill ${activeTab === "assigned" ? "active" : ""}`}
          onClick={() => setActiveTab("assigned")}
          style={{ display: "inline-flex", alignItems: "center", gap: "0.45rem" }}
        >
          <Scale size={15} />
          <span>My Assigned Defenses</span>
          <span className="tab-badge">{assignedDefenses.length}</span>
        </button>

        <button
          type="button"
          className={`faculty-tab-pill ${activeTab === "coordinator_panels" ? "active" : ""}`}
          onClick={() => setActiveTab("coordinator_panels")}
          style={{ display: "inline-flex", alignItems: "center", gap: "0.45rem" }}
        >
          <Users size={15} />
          <span>Panel Allocator</span>
          <span className="tab-badge">{allPanels.length}</span>
        </button>

        <button
          type="button"
          className={`faculty-tab-pill ${activeTab === "coordinator_schedules" ? "active" : ""}`}
          onClick={() => setActiveTab("coordinator_schedules")}
          style={{ display: "inline-flex", alignItems: "center", gap: "0.45rem" }}
        >
          <Calendar size={15} />
          <span>Defense Logistics & Scheduler</span>
          <span className="tab-badge">{allSchedules.length}</span>
        </button>

        <button
          type="button"
          className={`faculty-tab-pill ${activeTab === "results" ? "active" : ""}`}
          onClick={() => setActiveTab("results")}
          style={{ display: "inline-flex", alignItems: "center", gap: "0.45rem" }}
        >
          <Award size={15} />
          <span>Marks & Result Publishing</span>
        </button>
      </div>

      {/* =========================================================================
          TAB 1: MY ASSIGNED DEFENSES (PANELIST VIEW)
          ========================================================================= */}
      {activeTab === "assigned" && (
        <section className="stack" style={{ gap: "1rem" }}>
          {assignedDefenses.length === 0 ? (
            <div className="faculty-empty-slate" style={{ padding: "3rem 1.5rem", textAlign: "center" }}>
              <Scale size={36} style={{ opacity: 0.3, margin: "0 auto 0.75rem" }} />
              <h4 style={{ margin: "0 0 0.25rem", fontWeight: 700 }}>No Defenses Assigned Yet</h4>
              <p style={{ color: "var(--muted)", margin: 0, fontSize: "0.88rem" }}>
                When the FYP coordinator creates panels and assigns 6th semester presentations, they will appear here.
              </p>
            </div>
          ) : (
            assignedDefenses.map((item) => {
              const isEvaluated = Boolean(item.myEvaluation);

              return (
                <div
                  key={item.schedule.id}
                  className="card"
                  style={{
                    padding: "1.25rem",
                    borderLeft: `4px solid ${isEvaluated ? "#10b981" : "var(--accent)"}`,
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.75rem",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.5rem", flexWrap: "wrap" }}>
                    <div>
                      <div style={{ display: "inline-flex", gap: "0.4rem", alignItems: "center", marginBottom: "0.25rem" }}>
                        <span className="badge" style={{ background: "rgba(99, 102, 241, 0.15)", color: "var(--accent)" }}>
                          {item.group.domain}
                        </span>
                        <span
                          className="badge"
                          style={{
                            background: isEvaluated ? "rgba(16, 185, 129, 0.15)" : "rgba(245, 158, 11, 0.15)",
                            color: isEvaluated ? "#10b981" : "#d97706",
                          }}
                        >
                          {isEvaluated ? `✓ Evaluated (${item.myEvaluation?.totalScore}/100)` : "⏳ Scoring Pending"}
                        </span>
                      </div>

                      <h3 style={{ fontSize: "1.15rem", fontWeight: 700, margin: "0.2rem 0" }}>
                        {item.group.title}
                      </h3>
                      <p style={{ fontSize: "0.85rem", color: "var(--muted)", margin: 0 }}>
                        Panel: <strong>{item.panel.name}</strong> • Supervisor: <strong>{item.group.supervisorName}</strong>
                      </p>
                    </div>

                    <button
                      type="button"
                      className="btn primary tap"
                      onClick={() => handleOpenEvaluation(item)}
                      style={{ fontSize: "0.85rem", padding: "6px 14px" }}
                    >
                      <FileCheck size={14} />
                      <span>{isEvaluated ? "View / Edit Rubric Marks" : "Score Defense Presentation"}</span>
                    </button>
                  </div>

                  {/* Defense Logistics Card */}
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "1.25rem",
                      background: "var(--surface)",
                      padding: "0.75rem",
                      borderRadius: "6px",
                      fontSize: "0.85rem",
                    }}
                  >
                    <div>
                      📅 <strong>Date:</strong> {item.schedule.defenseDate}
                    </div>
                    <div>
                      ⏰ <strong>Time:</strong> {item.schedule.startTime} - {item.schedule.endTime}
                    </div>
                    <div>
                      📍 <strong>Venue:</strong> {item.schedule.venue}
                    </div>
                    <div>
                      👑 <strong>Leader:</strong> {item.group.leader.fullName} ({item.group.leader.regNo})
                    </div>
                  </div>

                  {item.myEvaluation && (
                    <div style={{ fontSize: "0.82rem", color: "var(--muted)", background: "rgba(16, 185, 129, 0.06)", padding: "0.5rem 0.75rem", borderRadius: "4px" }}>
                      <strong>Your Recommendation:</strong> {item.myEvaluation.recommendation.replace(/_/g, " ").toUpperCase()} • Remarks: &ldquo;{item.myEvaluation.remarks}&rdquo;
                    </div>
                  )}
                </div>
              );
            })
          )}
        </section>
      )}

      {/* =========================================================================
          TAB 2: PANEL ALLOCATOR (COORDINATOR VIEW)
          ========================================================================= */}
      {activeTab === "coordinator_panels" && (
        <section className="stack" style={{ gap: "1rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
            <div>
              <h4 style={{ fontSize: "1.05rem", fontWeight: 700, margin: 0 }}>
                Defense Evaluation Panels
              </h4>
              <p style={{ fontSize: "0.85rem", color: "var(--muted)", margin: "0.15rem 0 0" }}>
                Each panel consists of 2-3 faculty members with conflict-of-interest enforcement.
              </p>
            </div>

            <button
              type="button"
              className="btn primary tap"
              onClick={() => setIsPanelModalOpen(true)}
              style={{ fontSize: "0.85rem" }}
            >
              <Plus size={15} />
              <span>Create Defense Panel</span>
            </button>
          </div>

          <div className="stack" style={{ gap: "1rem" }}>
            {allPanels.map((panel) => (
              <div key={panel.id} className="card" style={{ padding: "1.25rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.5rem", flexWrap: "wrap" }}>
                  <div>
                    <div style={{ display: "inline-flex", gap: "0.4rem", alignItems: "center", marginBottom: "0.25rem" }}>
                      <span className="badge" style={{ background: "rgba(99, 102, 241, 0.15)", color: "var(--accent)" }}>
                        {panel.department}
                      </span>
                      <span className="badge" style={{ background: "var(--surface)", color: "var(--muted)" }}>
                        {panel.assignedGroupIds.length} Groups Assigned
                      </span>
                    </div>
                    <h3 style={{ fontSize: "1.15rem", fontWeight: 700, margin: "0.2rem 0" }}>
                      {panel.name}
                    </h3>
                  </div>
                </div>

                {/* Panel Members List */}
                <div style={{ marginTop: "0.75rem" }}>
                  <div style={{ fontSize: "0.78rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--muted)", marginBottom: "0.35rem" }}>
                    Evaluation Committee Members
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                    {panel.members.map((m) => (
                      <div
                        key={m.teacherId}
                        style={{
                          fontSize: "0.82rem",
                          padding: "4px 8px",
                          borderRadius: "4px",
                          background: m.isChair ? "rgba(245, 158, 11, 0.12)" : "var(--surface)",
                          border: `1px solid ${m.isChair ? "rgba(245, 158, 11, 0.3)" : "var(--border)"}`,
                          color: m.isChair ? "#d97706" : "inherit",
                          fontWeight: m.isChair ? 700 : 500,
                        }}
                      >
                        {m.isChair ? "👑 Panel Chair: " : "👤 "}
                        {m.teacherName}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* =========================================================================
          TAB 3: DEFENSE LOGISTICS & SCHEDULER (COORDINATOR VIEW)
          ========================================================================= */}
      {activeTab === "coordinator_schedules" && (
        <section className="stack" style={{ gap: "1rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
            <div>
              <h4 style={{ fontSize: "1.05rem", fontWeight: 700, margin: 0 }}>
                Defense Presentation Slots & Venue Logistics
              </h4>
              <p style={{ fontSize: "0.85rem", color: "var(--muted)", margin: "0.15rem 0 0" }}>
                Automatic collision detection prevents double-booking of panel members and venues.
              </p>
            </div>

            <button
              type="button"
              className="btn primary tap"
              onClick={() => {
                if (allGroups.length > 0) setSchedGroupId(allGroups[0].id);
                if (allPanels.length > 0) setSchedPanelId(allPanels[0].id);
                setIsScheduleModalOpen(true);
              }}
              style={{ fontSize: "0.85rem" }}
            >
              <Plus size={15} />
              <span>Schedule Presentation</span>
            </button>
          </div>

          <div className="stack" style={{ gap: "1rem" }}>
            {allSchedules.map((sched) => (
              <div key={sched.id} className="card" style={{ padding: "1.25rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.5rem", flexWrap: "wrap" }}>
                  <div>
                    <div style={{ display: "inline-flex", gap: "0.4rem", alignItems: "center", marginBottom: "0.25rem" }}>
                      <span className="badge" style={{ background: "rgba(99, 102, 241, 0.12)", color: "var(--accent)" }}>
                        {sched.groupDomain}
                      </span>
                      <span className="badge" style={{ background: "rgba(16, 185, 129, 0.12)", color: "#10b981" }}>
                        {sched.panelName}
                      </span>
                    </div>
                    <h3 style={{ fontSize: "1.15rem", fontWeight: 700, margin: "0.2rem 0" }}>
                      {sched.groupTitle}
                    </h3>
                  </div>

                  <span className="badge" style={{ background: "var(--surface)", color: "var(--muted)" }}>
                    {sched.status.toUpperCase()}
                  </span>
                </div>

                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "1.25rem",
                    background: "var(--surface)",
                    padding: "0.75rem",
                    borderRadius: "6px",
                    fontSize: "0.85rem",
                    marginTop: "0.5rem",
                  }}
                >
                  <div>
                    📅 <strong>Date:</strong> {sched.defenseDate}
                  </div>
                  <div>
                    ⏰ <strong>Time:</strong> {sched.startTime} - {sched.endTime}
                  </div>
                  <div>
                    📍 <strong>Venue:</strong> {sched.venue}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* =========================================================================
          TAB 4: DEFENSE MARKS & RESULT PUBLISHING
          ========================================================================= */}
      {activeTab === "results" && (
        <section className="stack" style={{ gap: "1rem" }}>
          <div>
            <h4 style={{ fontSize: "1.05rem", fontWeight: 700, margin: 0 }}>
              Defense Evaluations & Official Results
            </h4>
            <p style={{ fontSize: "0.85rem", color: "var(--muted)", margin: "0.15rem 0 0" }}>
              Review independent panel scores, view consensus recommendations, and publish final marks to students.
            </p>
          </div>

          <div className="stack" style={{ gap: "1rem" }}>
            {allGroups.map((group) => (
              <div key={group.id} className="card" style={{ padding: "1.25rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.5rem", flexWrap: "wrap" }}>
                  <div>
                    <span className="badge" style={{ background: "rgba(99, 102, 241, 0.12)", color: "var(--accent)" }}>
                      {group.domain}
                    </span>
                    <h3 style={{ fontSize: "1.15rem", fontWeight: 700, margin: "0.2rem 0" }}>
                      {group.title}
                    </h3>
                    <p style={{ fontSize: "0.85rem", color: "var(--muted)", margin: 0 }}>
                      Leader: {group.leader.fullName} ({group.leader.regNo}) • Supervisor: {group.supervisorName}
                    </p>
                  </div>

                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <button
                      type="button"
                      className="btn secondary tap"
                      onClick={() => handleViewResult(group.id)}
                      style={{ fontSize: "0.82rem", padding: "6px 12px" }}
                    >
                      <span>View Panel Scores</span>
                    </button>
                    <button
                      type="button"
                      className="btn primary tap"
                      onClick={() => handlePublishResult(group.id)}
                      style={{ fontSize: "0.82rem", padding: "6px 12px" }}
                    >
                      <Award size={14} />
                      <span>Publish Results</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* =========================================================================
          MODAL 1: SCORE DEFENSE PRESENTATION (PANELIST)
          ========================================================================= */}
      {evaluatingDefense && (
        <div className="modal-backdrop" style={{ zIndex: 1000 }} onClick={() => setEvaluatingDefense(null)}>
          <div className="modal-card" style={{ maxWidth: "620px" }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3>Defense Presentation Evaluation</h3>
                <p className="fine quiet">{evaluatingDefense.group.title}</p>
              </div>
              <button type="button" className="close-btn" onClick={() => setEvaluatingDefense(null)}>×</button>
            </div>

            <form onSubmit={handleSubmitEvaluation} className="modal-body stack" style={{ gap: "1rem" }}>
              {/* Group Rubric Criteria */}
              <div className="stack" style={{ gap: "0.75rem" }}>
                <div style={{ fontWeight: 700, fontSize: "0.92rem", borderBottom: "1px solid var(--border)", paddingBottom: "0.3rem" }}>
                  Section A: Group Performance (85 Points)
                </div>

                {DEFAULT_DEFENSE_RUBRIC.filter((c) => c.id !== "indiv").map((criterion) => {
                  const currentVal = criterionScores[criterion.id] ?? Math.round(criterion.maxMarks * 0.8);

                  return (
                    <div key={criterion.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem" }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: "0.88rem", fontWeight: 600 }}>{criterion.name}</div>
                        <div style={{ fontSize: "0.78rem", color: "var(--muted)" }}>{criterion.description}</div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <input
                          type="number"
                          min={0}
                          max={criterion.maxMarks}
                          value={currentVal}
                          onChange={(e) => {
                            const val = Math.min(criterion.maxMarks, Math.max(0, parseInt(e.target.value, 10) || 0));
                            setCriterionScores({ ...criterionScores, [criterion.id]: val });
                          }}
                          className="input"
                          style={{ width: "70px", padding: "0.4rem", textAlign: "center" }}
                        />
                        <span style={{ fontSize: "0.82rem", color: "var(--muted)" }}>/ {criterion.maxMarks}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Individual Student Scores */}
              <div className="stack" style={{ gap: "0.75rem", marginTop: "0.5rem" }}>
                <div style={{ fontWeight: 700, fontSize: "0.92rem", borderBottom: "1px solid var(--border)", paddingBottom: "0.3rem" }}>
                  Section B: Individual Contribution (15 Points Max per Student)
                </div>

                {studentScores.map((s, idx) => (
                  <div key={s.studentId} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem" }}>
                    <div>
                      <div style={{ fontSize: "0.88rem", fontWeight: 600 }}>{s.studentName}</div>
                      <div style={{ fontSize: "0.78rem", color: "var(--muted)" }}>Reg: {s.regNo}</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <input
                        type="number"
                        min={0}
                        max={15}
                        value={s.individualMarks}
                        onChange={(e) => {
                          const val = Math.min(15, Math.max(0, parseInt(e.target.value, 10) || 0));
                          const updated = [...studentScores];
                          updated[idx].individualMarks = val;
                          setStudentScores(updated);
                        }}
                        className="input"
                        style={{ width: "70px", padding: "0.4rem", textAlign: "center" }}
                      />
                      <span style={{ fontSize: "0.82rem", color: "var(--muted)" }}>/ 15</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Recommendation & Remarks */}
              <div className="stack" style={{ gap: "0.75rem", marginTop: "0.5rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.3rem" }}>
                    Panel Recommendation *
                  </label>
                  <select
                    value={recommendation}
                    onChange={(e) => setRecommendation(e.target.value as FypDefenseRecommendation)}
                    className="input"
                    style={{ width: "100%", padding: "0.5rem" }}
                  >
                    <option value="accepted">Accepted (Proceed to 7th Semester)</option>
                    <option value="accepted_with_minor_changes">Accepted with Minor Changes</option>
                    <option value="major_revision">Major Revision Required</option>
                    <option value="deferred">Deferred / Failed</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.3rem" }}>
                    Panelist Feedback Remarks *
                  </label>
                  <textarea
                    rows={3}
                    required
                    placeholder="Provide constructive feedback on literature survey, system design, and defense Q&A..."
                    value={evalRemarks}
                    onChange={(e) => setEvalRemarks(e.target.value)}
                    className="input"
                    style={{ width: "100%", padding: "0.5rem" }}
                  />
                </div>
              </div>

              {/* Live Tally Bar */}
              <div
                style={{
                  background: "var(--surface)",
                  padding: "0.75rem",
                  borderRadius: "6px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  fontWeight: 700,
                }}
              >
                <span>Calculated Overall Score:</span>
                <span style={{ fontSize: "1.1rem", color: "var(--accent)" }}>{currentTotalCalculated} / 100</span>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
                <button type="button" className="btn secondary tap" onClick={() => setEvaluatingDefense(null)} disabled={isPending}>
                  Cancel
                </button>
                <button type="submit" className="btn primary tap" disabled={isPending}>
                  <Lock size={14} />
                  <span>Lock & Submit Score</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 2: CREATE DEFENSE PANEL (COORDINATOR)
          ========================================================================= */}
      {isPanelModalOpen && (
        <div className="modal-backdrop" style={{ zIndex: 1000 }} onClick={() => setIsPanelModalOpen(false)}>
          <div className="modal-card" style={{ maxWidth: "520px" }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3>Create Defense Evaluation Panel</h3>
                <p className="fine quiet">Form a 2-3 member faculty committee</p>
              </div>
              <button type="button" className="close-btn" onClick={() => setIsPanelModalOpen(false)}>×</button>
            </div>

            <form onSubmit={handleCreatePanel} className="modal-body stack" style={{ gap: "1rem" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.3rem" }}>
                  Panel Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Panel A - Artificial Intelligence & Computer Vision"
                  value={panelName}
                  onChange={(e) => setPanelName(e.target.value)}
                  className="input"
                  style={{ width: "100%", padding: "0.5rem" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.3rem" }}>
                  Select 2-3 Faculty Members *
                </label>
                <div className="stack" style={{ maxHeight: "200px", overflowY: "auto", border: "1px solid var(--border)", padding: "0.5rem", borderRadius: "6px" }}>
                  {facultyList
                    .filter((f) => typeof f.teacherId === "number" && f.teacherId > 0)
                    .map((fac) => {
                      const isSelected = selectedPanelistIds.includes(fac.teacherId!);

                      return (
                        <label
                          key={fac.teacherId}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "0.5rem",
                            fontSize: "0.85rem",
                            padding: "4px 0",
                            cursor: "pointer",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedPanelistIds([...selectedPanelistIds, fac.teacherId!]);
                              } else {
                                setSelectedPanelistIds(selectedPanelistIds.filter((id) => id !== fac.teacherId));
                              }
                            }}
                          />
                          <span>
                            <strong>{fac.name}</strong> ({fac.department})
                          </span>
                        </label>
                      );
                    })}
                </div>
              </div>

              {selectedPanelistIds.length > 0 && (
                <div>
                  <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.3rem" }}>
                    Designate Panel Chairperson *
                  </label>
                  <select
                    value={designatedChairId || selectedPanelistIds[0]}
                    onChange={(e) => setDesignatedChairId(parseInt(e.target.value, 10))}
                    className="input"
                    style={{ width: "100%", padding: "0.5rem" }}
                  >
                    {selectedPanelistIds.map((tid) => {
                      const f = facultyList.find((fac) => fac.teacherId === tid);
                      return (
                        <option key={tid} value={tid}>
                          {f?.name || `Teacher #${tid}`}
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
                <button type="button" className="btn secondary tap" onClick={() => setIsPanelModalOpen(false)} disabled={isPending}>
                  Cancel
                </button>
                <button type="submit" className="btn primary tap" disabled={isPending}>
                  <CheckCircle2 size={14} />
                  <span>Save Defense Panel</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 3: SCHEDULE DEFENSE LOGISTICS (COORDINATOR)
          ========================================================================= */}
      {isScheduleModalOpen && (
        <div className="modal-backdrop" style={{ zIndex: 1000 }} onClick={() => setIsScheduleModalOpen(false)}>
          <div className="modal-card" style={{ maxWidth: "520px" }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3>Schedule Defense Presentation</h3>
                <p className="fine quiet">With clash & supervisor conflict validation</p>
              </div>
              <button type="button" className="close-btn" onClick={() => setIsScheduleModalOpen(false)}>×</button>
            </div>

            <form onSubmit={handleScheduleDefense} className="modal-body stack" style={{ gap: "1rem" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.3rem" }}>
                  Select Project Group *
                </label>
                <select
                  value={schedGroupId}
                  onChange={(e) => setSchedGroupId(e.target.value)}
                  className="input"
                  style={{ width: "100%", padding: "0.5rem" }}
                >
                  {allGroups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.title} ({g.domain})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.3rem" }}>
                  Select Evaluation Panel *
                </label>
                <select
                  value={schedPanelId}
                  onChange={(e) => setSchedPanelId(e.target.value)}
                  className="input"
                  style={{ width: "100%", padding: "0.5rem" }}
                >
                  {allPanels.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.members.map((m) => m.teacherName).join(", ")})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.3rem" }}>
                    Defense Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={schedDate}
                    onChange={(e) => setSchedDate(e.target.value)}
                    className="input"
                    style={{ width: "100%", padding: "0.5rem" }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.3rem" }}>
                    Venue / Room *
                  </label>
                  <select
                    value={schedVenue}
                    onChange={(e) => setSchedVenue(e.target.value)}
                    className="input"
                    style={{ width: "100%", padding: "0.5rem" }}
                  >
                    {VENUES.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.3rem" }}>
                    Start Time *
                  </label>
                  <input
                    type="time"
                    required
                    value={schedStartTime}
                    onChange={(e) => setSchedStartTime(e.target.value)}
                    className="input"
                    style={{ width: "100%", padding: "0.5rem" }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.3rem" }}>
                    End Time *
                  </label>
                  <input
                    type="time"
                    required
                    value={schedEndTime}
                    onChange={(e) => setSchedEndTime(e.target.value)}
                    className="input"
                    style={{ width: "100%", padding: "0.5rem" }}
                  />
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
                <button type="button" className="btn secondary tap" onClick={() => setIsScheduleModalOpen(false)} disabled={isPending}>
                  Cancel
                </button>
                <button type="submit" className="btn primary tap" disabled={isPending}>
                  <CheckCircle2 size={14} />
                  <span>Verify & Schedule</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 4: VIEW EVALUATION RESULTS BREAKDOWN
          ========================================================================= */}
      {viewingResultGroupId && groupResultSummary && (
        <div className="modal-backdrop" style={{ zIndex: 1000 }} onClick={() => setViewingResultGroupId(null)}>
          <div className="modal-card" style={{ maxWidth: "560px" }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3>Defense Results Breakdown</h3>
                <p className="fine quiet">{groupResultSummary.groupTitle}</p>
              </div>
              <button type="button" className="close-btn" onClick={() => setViewingResultGroupId(null)}>×</button>
            </div>

            <div className="modal-body stack" style={{ gap: "1rem" }}>
              <div
                style={{
                  background: "var(--surface)",
                  padding: "1rem",
                  borderRadius: "8px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <div style={{ fontSize: "0.82rem", color: "var(--muted)" }}>Consensus Recommendation</div>
                  <div style={{ fontWeight: 700, fontSize: "1.1rem" }}>
                    {groupResultSummary.consensusRecommendation.replace(/_/g, " ").toUpperCase()}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: "0.82rem", color: "var(--muted)" }}>Panel Average Score</div>
                  <div style={{ fontWeight: 800, fontSize: "1.3rem", color: "var(--accent)" }}>
                    {groupResultSummary.averageTotalScore} / 100
                  </div>
                </div>
              </div>

              {/* Panelist Scores */}
              <div>
                <div style={{ fontSize: "0.82rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--muted)", marginBottom: "0.4rem" }}>
                  Individual Panelist Evaluations
                </div>
                <div className="stack" style={{ gap: "0.5rem" }}>
                  {groupResultSummary.panelistSummaries.map((p, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: "0.6rem 0.75rem",
                        borderRadius: "6px",
                        background: "var(--background)",
                        border: "1px solid var(--border)",
                        fontSize: "0.85rem",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 600 }}>
                        <span>{p.panelistName}</span>
                        <span>{p.totalScore !== undefined ? `${p.totalScore} / 100` : "Blinded"}</span>
                      </div>
                      <div style={{ fontSize: "0.8rem", color: "var(--muted)", marginTop: "0.2rem" }}>
                        Remarks: {p.remarks}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button type="button" className="btn secondary tap" onClick={() => setViewingResultGroupId(null)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
