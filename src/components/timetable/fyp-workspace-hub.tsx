import { useState, useEffect, useTransition } from "react";
import {
  AlertCircle,
  Award,
  BookOpen,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  ExternalLink,
  FileCheck,
  FileText,
  Filter,
  FolderGit2,
  GitBranch,
  GraduationCap,
  Layers,
  MapPin,
  MessageSquare,
  Paperclip,
  Plus,
  RefreshCw,
  Send,
  ShieldAlert,
  ShieldCheck,
  Upload,
  UserCheck,
  Users,
  X,
  XCircle,
} from "lucide-react";
import type {
  FypDefensePanel,
  FypDefenseResultSummary,
  FypDefenseSchedule,
  FypDocumentCategory,
  FypGroupProgressSummary,
  FypGroupRecord,
  FypMeetingLog,
  FypMilestone,
  FypProjectDocument,
} from "@/lib/fyp-types";
import { FYP_DOCUMENT_CATEGORIES } from "@/lib/fyp-types";
import {
  addDocumentCommentServerFn,
  confirmMeetingLogServerFn,
  createMeetingLogServerFn,
  getGroupDocumentsServerFn,
  getGroupMeetingLogsServerFn,
  getGroupMilestonesServerFn,
  getGroupProgressSummaryServerFn,
  getStudentDefenseScheduleServerFn,
  reviewMilestoneServerFn,
  submitMilestoneServerFn,
  uploadGroupDocumentServerFn,
} from "@/lib/fyp-server-fn";

interface FypWorkspaceHubProps {
  group: FypGroupRecord;
  role: "student" | "supervisor";
  currentUserName: string;
  supervisorId?: number;
  onRefreshGroup?: () => void;
}

export function FypWorkspaceHub({
  group,
  role,
  currentUserName,
  supervisorId,
  onRefreshGroup,
}: FypWorkspaceHubProps) {
  const [activeTab, setActiveTab] = useState<"milestones" | "meetings" | "documents" | "defense">("milestones");
  const [loading, setLoading] = useState(true);
  const [milestones, setMilestones] = useState<FypMilestone[]>([]);
  const [meetings, setMeetings] = useState<FypMeetingLog[]>([]);
  const [documents, setDocuments] = useState<FypProjectDocument[]>([]);
  const [summary, setSummary] = useState<FypGroupProgressSummary | null>(null);
  const [defenseSchedule, setDefenseSchedule] = useState<FypDefenseSchedule | null>(null);
  const [defensePanel, setDefensePanel] = useState<FypDefensePanel | null>(null);
  const [defenseResult, setDefenseResult] = useState<FypDefenseResultSummary | null>(null);

  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Milestone submission modal (Student)
  const [submittingMilestone, setSubmittingMilestone] = useState<FypMilestone | null>(null);
  const [submitDocUrl, setSubmitDocUrl] = useState("");
  const [submitFileName, setSubmitFileName] = useState("");
  const [submitChangeSummary, setSubmitChangeSummary] = useState("");

  // Milestone review modal (Supervisor)
  const [reviewingMilestone, setReviewingMilestone] = useState<FypMilestone | null>(null);
  const [reviewDecision, setReviewDecision] = useState<"approved" | "revision_requested">("approved");
  const [reviewFeedback, setReviewFeedback] = useState("");

  // Meeting modal
  const [isMeetingModalOpen, setIsMeetingModalOpen] = useState(false);
  const [meetingDate, setMeetingDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [selectedAttendees, setSelectedAttendees] = useState<string[]>(() => [
    group.leader.fullName,
    ...group.members.map((m) => m.fullName),
  ]);
  const [discussionPoints, setDiscussionPoints] = useState("");
  const [actionItems, setActionItems] = useState("");
  const [nextMeetingDate, setNextMeetingDate] = useState("");

  // Confirm meeting notes modal (Supervisor)
  const [confirmingMeeting, setConfirmingMeeting] = useState<FypMeetingLog | null>(null);
  const [confirmNotes, setConfirmNotes] = useState("");

  // Document upload modal
  const [isDocModalOpen, setIsDocModalOpen] = useState(false);
  const [docCategory, setDocCategory] = useState<FypDocumentCategory>("proposal");
  const [docTitle, setDocTitle] = useState("");
  const [docUrl, setDocUrl] = useState("");

  // Document comment state
  const [activeDocForComment, setActiveDocForComment] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");

  const [expandedMilestoneId, setExpandedMilestoneId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const loadHubData = async () => {
    try {
      setLoading(true);
      const [mRes, meetRes, docRes, sumRes, defRes] = await Promise.all([
        getGroupMilestonesServerFn({ data: { groupId: group.id } }),
        getGroupMeetingLogsServerFn({ data: { groupId: group.id } }),
        getGroupDocumentsServerFn({ data: { groupId: group.id } }),
        getGroupProgressSummaryServerFn({ data: { groupId: group.id } }),
        getStudentDefenseScheduleServerFn({ data: { groupId: group.id } }).catch(() => ({
          schedule: null,
          panel: null,
          resultSummary: null,
        })),
      ]);

      setMilestones(mRes.milestones || []);
      setMeetings(meetRes.meetingLogs || []);
      setDocuments(docRes.documents || []);
      setSummary(sumRes.summary || null);
      if (defRes) {
        setDefenseSchedule(defRes.schedule || null);
        setDefensePanel(defRes.panel || null);
        setDefenseResult(defRes.resultSummary || null);
      }
    } catch (err) {
      console.error("Failed to load FYP workspace hub data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHubData();
  }, [group.id]);

  // Handle Milestone Submission
  const handleSubmitMilestone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!submittingMilestone || !submitDocUrl.trim() || !submitFileName.trim()) return;

    setActionError(null);
    setActionSuccess(null);

    startTransition(async () => {
      try {
        const res = await submitMilestoneServerFn({
          data: {
            groupId: group.id,
            milestoneId: submittingMilestone.id,
            documentUrl: submitDocUrl.trim(),
            fileName: submitFileName.trim(),
            changeSummary: submitChangeSummary.trim(),
            submittedBy: currentUserName,
          },
        });
        if (res.success) {
          setActionSuccess(`Milestone "${submittingMilestone.title}" submitted successfully! Turnitin similarity report generated.`);
          setSubmittingMilestone(null);
          setSubmitDocUrl("");
          setSubmitFileName("");
          setSubmitChangeSummary("");
          await loadHubData();
        }
      } catch (err: any) {
        setActionError(err.message || "Failed to submit milestone.");
      }
    });
  };

  // Handle Supervisor Review
  const handleReviewMilestone = async () => {
    if (!reviewingMilestone || !supervisorId) return;

    setActionError(null);
    setActionSuccess(null);

    startTransition(async () => {
      try {
        const res = await reviewMilestoneServerFn({
          data: {
            milestoneId: reviewingMilestone.id,
            supervisorId,
            decision: reviewDecision,
            feedback: reviewFeedback.trim(),
          },
        });
        if (res.success) {
          setActionSuccess(`Milestone "${reviewingMilestone.title}" marked as ${reviewDecision === "approved" ? "Approved" : "Revision Requested"}!`);
          setReviewingMilestone(null);
          setReviewFeedback("");
          await loadHubData();
          if (onRefreshGroup) onRefreshGroup();
        }
      } catch (err: any) {
        setActionError(err.message || "Failed to submit review.");
      }
    });
  };

  // Handle Create Meeting Log
  const handleCreateMeetingLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!discussionPoints.trim() || !actionItems.trim()) return;

    setActionError(null);
    setActionSuccess(null);

    startTransition(async () => {
      try {
        const res = await createMeetingLogServerFn({
          data: {
            groupId: group.id,
            meetingDate,
            scheduledBy: role,
            schedulerName: currentUserName,
            attendees: selectedAttendees,
            discussionPoints: discussionPoints.trim(),
            actionItems: actionItems.trim(),
            nextMeetingDate: nextMeetingDate || undefined,
          },
        });
        if (res.success) {
          setActionSuccess("Supervision meeting minutes logged successfully!");
          setIsMeetingModalOpen(false);
          setDiscussionPoints("");
          setActionItems("");
          setNextMeetingDate("");
          await loadHubData();
        }
      } catch (err: any) {
        setActionError(err.message || "Failed to create meeting log.");
      }
    });
  };

  // Handle Confirm Meeting (Supervisor)
  const handleConfirmMeeting = async () => {
    if (!confirmingMeeting || !supervisorId) return;

    setActionError(null);
    setActionSuccess(null);

    startTransition(async () => {
      try {
        const res = await confirmMeetingLogServerFn({
          data: {
            logId: confirmingMeeting.id,
            supervisorId,
            notes: confirmNotes.trim(),
          },
        });
        if (res.success) {
          setActionSuccess("Meeting minutes confirmed and verified!");
          setConfirmingMeeting(null);
          setConfirmNotes("");
          await loadHubData();
        }
      } catch (err: any) {
        setActionError(err.message || "Failed to confirm meeting.");
      }
    });
  };

  // Handle Upload Document
  const handleUploadDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docTitle.trim() || !docUrl.trim()) return;

    setActionError(null);
    setActionSuccess(null);

    startTransition(async () => {
      try {
        const res = await uploadGroupDocumentServerFn({
          data: {
            groupId: group.id,
            category: docCategory,
            title: docTitle.trim(),
            documentUrl: docUrl.trim(),
            uploadedBy: currentUserName,
          },
        });
        if (res.success) {
          setActionSuccess(`Document "${docTitle}" added to repository with plagiarism scan!`);
          setIsDocModalOpen(false);
          setDocTitle("");
          setDocUrl("");
          await loadHubData();
        }
      } catch (err: any) {
        setActionError(err.message || "Failed to upload document.");
      }
    });
  };

  // Handle Document Comment
  const handleAddComment = async (docId: string) => {
    if (!commentText.trim()) return;

    startTransition(async () => {
      try {
        const res = await addDocumentCommentServerFn({
          data: {
            documentId: docId,
            authorName: currentUserName,
            authorRole: role,
            text: commentText.trim(),
          },
        });
        if (res.success) {
          setCommentText("");
          await loadHubData();
        }
      } catch (err: any) {
        setActionError(err.message || "Failed to add comment.");
      }
    });
  };

  const percentComplete = summary?.percentComplete ?? 0;
  const isMeetingMet = summary?.isMeetingRequirementMet ?? false;

  return (
    <div className="fyp-workspace-hub stack" style={{ gap: "1.25rem" }}>
      {/* Overview Progress & Compliance Bar */}
      <div
        className="card"
        style={{
          padding: "1.25rem",
          background: "linear-gradient(135deg, rgba(99, 102, 241, 0.05), rgba(16, 185, 129, 0.03))",
          borderColor: "rgba(99, 102, 241, 0.2)",
        }}
      >
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "1rem" }}>
          <div>
            <div style={{ display: "inline-flex", gap: "0.4rem", alignItems: "center", marginBottom: "0.25rem" }}>
              <span className="badge" style={{ background: "rgba(99, 102, 241, 0.15)", color: "var(--accent)" }}>
                {group.domain}
              </span>
              <span
                className="badge"
                style={{
                  background: summary?.isOnTrack ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)",
                  color: summary?.isOnTrack ? "#10b981" : "#ef4444",
                }}
              >
                {summary?.isOnTrack ? "● On Track" : "▲ Attention Needed"}
              </span>
            </div>
            <h3 style={{ fontSize: "1.2rem", fontWeight: 700, margin: "0.2rem 0" }}>
              {group.title}
            </h3>
            <p style={{ fontSize: "0.85rem", color: "var(--muted)", margin: 0 }}>
              Supervisor: <strong>{group.supervisorName}</strong> • Team Leader: <strong>{group.leader.fullName}</strong>
            </p>
          </div>

          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              type="button"
              className="btn secondary tap"
              onClick={loadHubData}
              disabled={loading}
              title="Refresh workspace"
            >
              <RefreshCw size={14} className={loading ? "spin" : ""} />
            </button>
          </div>
        </div>

        {/* Milestone Progress Bar & Monthly Meeting Tracker */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1rem", marginTop: "1rem", paddingTop: "0.75rem", borderTop: "1px solid var(--border)" }}>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem", fontWeight: 600, marginBottom: "0.35rem" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}>
                <Award size={14} color="var(--accent)" />
                Project Milestone Completion
              </span>
              <span>
                <strong>{summary?.completedMilestones || 0}</strong> of <strong>{summary?.totalMilestones || 6}</strong> Approved ({percentComplete}%)
              </span>
            </div>
            <div style={{ height: "7px", width: "100%", background: "var(--border)", borderRadius: "4px", overflow: "hidden" }}>
              <div
                style={{
                  height: "100%",
                  width: `${percentComplete}%`,
                  background: percentComplete === 100 ? "#10b981" : "var(--accent)",
                  transition: "width 0.4s ease",
                }}
              />
            </div>
          </div>

          <div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem", fontWeight: 600, marginBottom: "0.35rem" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}>
                <Calendar size={14} color={isMeetingMet ? "#10b981" : "#f59e0b"} />
                Monthly Supervision Compliance
              </span>
              <span style={{ color: isMeetingMet ? "#10b981" : "#d97706" }}>
                <strong>{summary?.monthlyMeetingCount || 0} / 2 Meetings</strong> {isMeetingMet ? "✓ Met" : "(Min 2 Required)"}
              </span>
            </div>
            <div style={{ height: "7px", width: "100%", background: "var(--border)", borderRadius: "4px", overflow: "hidden" }}>
              <div
                style={{
                  height: "100%",
                  width: `${Math.min(100, ((summary?.monthlyMeetingCount || 0) / 2) * 100)}%`,
                  background: isMeetingMet ? "#10b981" : "#f59e0b",
                  transition: "width 0.4s ease",
                }}
              />
            </div>
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
      <div style={{ display: "flex", gap: "0.5rem", borderBottom: "1px solid var(--border)", paddingBottom: "0.5rem" }}>
        <button
          type="button"
          className={`faculty-tab-pill ${activeTab === "milestones" ? "active" : ""}`}
          onClick={() => setActiveTab("milestones")}
          style={{ display: "inline-flex", alignItems: "center", gap: "0.45rem" }}
        >
          <Award size={15} />
          <span>Milestones & Sprints</span>
          <span className="tab-badge">{milestones.length}</span>
        </button>

        <button
          type="button"
          className={`faculty-tab-pill ${activeTab === "meetings" ? "active" : ""}`}
          onClick={() => setActiveTab("meetings")}
          style={{ display: "inline-flex", alignItems: "center", gap: "0.45rem" }}
        >
          <Calendar size={15} />
          <span>Meeting Minutes & Log</span>
          <span className="tab-badge">{meetings.length}</span>
        </button>

        <button
          type="button"
          className={`faculty-tab-pill ${activeTab === "documents" ? "active" : ""}`}
          onClick={() => setActiveTab("documents")}
          style={{ display: "inline-flex", alignItems: "center", gap: "0.45rem" }}
        >
          <FileText size={15} />
          <span>Document Vault & Turnitin</span>
          <span className="tab-badge">{documents.length}</span>
        </button>

        <button
          type="button"
          className={`faculty-tab-pill ${activeTab === "defense" ? "active" : ""}`}
          onClick={() => setActiveTab("defense")}
          style={{ display: "inline-flex", alignItems: "center", gap: "0.45rem" }}
        >
          <Award size={15} />
          <span>6th Sem Defense</span>
          {defenseResult?.published ? (
            <span
              style={{
                background: "rgba(16, 185, 129, 0.2)",
                color: "#10b981",
                fontSize: "0.72rem",
                padding: "1px 6px",
                borderRadius: "10px",
                fontWeight: 700,
              }}
            >
              Published
            </span>
          ) : defenseSchedule ? (
            <span
              style={{
                background: "rgba(99, 102, 241, 0.2)",
                color: "var(--accent)",
                fontSize: "0.72rem",
                padding: "1px 6px",
                borderRadius: "10px",
                fontWeight: 700,
              }}
            >
              Scheduled
            </span>
          ) : null}
        </button>
      </div>

      {/* =========================================================================
          TAB 1: MILESTONES & SUPERVISOR REVIEWS
          ========================================================================= */}
      {activeTab === "milestones" && (
        <section className="stack" style={{ gap: "1rem" }}>
          {milestones.map((ms, index) => {
            const isApproved = ms.status === "approved";
            const isRevision = ms.status === "revision_requested";
            const isSubmitted = ms.status === "submitted";
            const isExpanded = expandedMilestoneId === ms.id;
            const latestSub = ms.submissions && ms.submissions.length > 0 ? ms.submissions[ms.submissions.length - 1] : null;

            return (
              <div
                key={ms.id}
                className="card"
                style={{
                  padding: "1.25rem",
                  borderLeft: `4px solid ${isApproved ? "#10b981" : isRevision ? "#ef4444" : isSubmitted ? "var(--accent)" : "var(--border)"}`,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem", flexWrap: "wrap" }}>
                  <div>
                    <div style={{ display: "inline-flex", gap: "0.4rem", alignItems: "center", marginBottom: "0.25rem" }}>
                      <span className="badge" style={{ background: "var(--surface)", color: "var(--muted)" }}>
                        Milestone {index + 1} ({ms.weightage}%)
                      </span>
                      <span
                        className="badge"
                        style={{
                          background: isApproved
                            ? "rgba(16, 185, 129, 0.15)"
                            : isRevision
                            ? "rgba(239, 68, 68, 0.15)"
                            : isSubmitted
                            ? "rgba(99, 102, 241, 0.15)"
                            : "var(--surface)",
                          color: isApproved
                            ? "#10b981"
                            : isRevision
                            ? "#ef4444"
                            : isSubmitted
                            ? "var(--accent)"
                            : "var(--muted)",
                        }}
                      >
                        {isApproved && "✓ Approved by Supervisor"}
                        {isRevision && "▲ Revision Requested"}
                        {isSubmitted && "⏳ Submitted (Under Review)"}
                        {ms.status === "not_started" && "○ Not Submitted"}
                      </span>
                    </div>

                    <h4 style={{ fontSize: "1.1rem", fontWeight: 700, margin: "0.2rem 0" }}>
                      {ms.title}
                    </h4>
                    <p style={{ fontSize: "0.85rem", color: "var(--muted)", margin: "0.2rem 0 0.5rem" }}>
                      {ms.description}
                    </p>
                    <div style={{ fontSize: "0.8rem", color: "var(--muted)", display: "flex", gap: "0.75rem" }}>
                      <span>📅 Deadline: <strong>{new Date(ms.deadline).toLocaleDateString()}</strong></span>
                      {latestSub && <span>📄 Latest Version: <strong>v{latestSub.version}</strong></span>}
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                    {role === "student" && !isApproved && (
                      <button
                        type="button"
                        className="btn primary tap"
                        onClick={() => {
                          setSubmittingMilestone(ms);
                          setSubmitFileName(`${group.title.substring(0, 15)}_${ms.key}_draft.pdf`);
                        }}
                        style={{ fontSize: "0.82rem", padding: "6px 12px" }}
                      >
                        <Upload size={14} />
                        <span>{ms.submissions.length > 0 ? "Submit Revision" : "Submit Deliverable"}</span>
                      </button>
                    )}

                    {role === "supervisor" && isSubmitted && (
                      <button
                        type="button"
                        className="btn primary tap"
                        onClick={() => {
                          setReviewingMilestone(ms);
                          setReviewDecision("approved");
                          setReviewFeedback("");
                        }}
                        style={{ fontSize: "0.82rem", padding: "6px 12px" }}
                      >
                        <FileCheck size={14} />
                        <span>Review Submission</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Supervisor Feedback Note Alert */}
                {ms.supervisorFeedback && (
                  <div
                    style={{
                      marginTop: "0.75rem",
                      padding: "0.6rem 0.75rem",
                      borderRadius: "6px",
                      background: isApproved ? "rgba(16, 185, 129, 0.08)" : "rgba(239, 68, 68, 0.08)",
                      border: `1px solid ${isApproved ? "rgba(16, 185, 129, 0.2)" : "rgba(239, 68, 68, 0.2)"}`,
                      fontSize: "0.84rem",
                    }}
                  >
                    <strong>Supervisor Remarks:</strong> {ms.supervisorFeedback}
                  </div>
                )}

                {/* Latest Submission Card */}
                {latestSub && (
                  <div
                    style={{
                      marginTop: "0.75rem",
                      padding: "0.75rem",
                      borderRadius: "6px",
                      background: "var(--surface)",
                      border: "1px solid var(--border)",
                      display: "flex",
                      flexWrap: "wrap",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "0.5rem",
                    }}
                  >
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontWeight: 600, fontSize: "0.88rem" }}>
                        <FileText size={15} color="var(--accent)" />
                        <span>{latestSub.fileName}</span>
                        <span className="badge" style={{ fontSize: "0.75rem", padding: "1px 6px" }}>v{latestSub.version}</span>
                      </div>
                      <div style={{ fontSize: "0.78rem", color: "var(--muted)", marginTop: "0.15rem" }}>
                        Submitted by {latestSub.submittedBy} on {new Date(latestSub.submittedAt).toLocaleDateString()} • &ldquo;{latestSub.changeSummary}&rdquo;
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                      {/* Plagiarism Badge */}
                      <span
                        className="badge"
                        style={{
                          background: latestSub.similarityStatus === "passed" ? "rgba(16, 185, 129, 0.12)" : "rgba(239, 68, 68, 0.12)",
                          color: latestSub.similarityStatus === "passed" ? "#10b981" : "#ef4444",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "0.3rem",
                        }}
                      >
                        {latestSub.similarityStatus === "passed" ? <ShieldCheck size={13} /> : <ShieldAlert size={13} />}
                        <span>Turnitin: {latestSub.plagiarismScore}% (AI: {latestSub.aiScore}%)</span>
                      </span>

                      <a
                        href={latestSub.documentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn secondary tap"
                        style={{ fontSize: "0.78rem", padding: "4px 8px" }}
                      >
                        <ExternalLink size={13} />
                        <span>Open Document</span>
                      </a>
                    </div>
                  </div>
                )}

                {/* Submissions Version History Toggle */}
                {ms.submissions && ms.submissions.length > 1 && (
                  <div style={{ marginTop: "0.5rem" }}>
                    <button
                      type="button"
                      onClick={() => setExpandedMilestoneId(isExpanded ? null : ms.id)}
                      style={{
                        background: "transparent",
                        border: "none",
                        cursor: "pointer",
                        fontSize: "0.8rem",
                        color: "var(--accent)",
                        padding: 0,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "0.3rem",
                        fontWeight: 600,
                      }}
                    >
                      <GitBranch size={13} />
                      <span>{ms.submissions.length} Submissions in Version History</span>
                      {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                    </button>

                    {isExpanded && (
                      <div className="stack" style={{ gap: "0.4rem", marginTop: "0.5rem", paddingLeft: "0.5rem", borderLeft: "2px solid var(--accent)" }}>
                        {ms.submissions.map((sub) => (
                          <div
                            key={sub.id}
                            style={{
                              fontSize: "0.8rem",
                              display: "flex",
                              justifyContent: "space-between",
                              background: "var(--background)",
                              padding: "0.4rem 0.6rem",
                              borderRadius: "4px",
                            }}
                          >
                            <span>
                              <strong>v{sub.version}</strong>: {sub.fileName} ({sub.changeSummary})
                            </span>
                            <span style={{ color: "var(--muted)" }}>
                              {new Date(sub.submittedAt).toLocaleDateString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </section>
      )}

      {/* =========================================================================
          TAB 2: MEETING MINUTES & LOG
          ========================================================================= */}
      {activeTab === "meetings" && (
        <section className="stack" style={{ gap: "1rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
            <div>
              <h4 style={{ fontSize: "1.05rem", fontWeight: 700, margin: 0 }}>
                Supervision Meeting Records
              </h4>
              <p style={{ fontSize: "0.85rem", color: "var(--muted)", margin: "0.15rem 0 0" }}>
                Keep an official log of supervision discussions, deliverables, and action items.
              </p>
            </div>

            <button
              type="button"
              className="btn primary tap"
              onClick={() => setIsMeetingModalOpen(true)}
              style={{ fontSize: "0.85rem" }}
            >
              <Plus size={15} />
              <span>Log Meeting Minutes</span>
            </button>
          </div>

          {meetings.length === 0 ? (
            <div className="faculty-empty-slate" style={{ padding: "3rem 1.5rem", textAlign: "center" }}>
              <Calendar size={36} style={{ opacity: 0.3, margin: "0 auto 0.75rem" }} />
              <h4 style={{ margin: "0 0 0.25rem", fontWeight: 700 }}>No Meeting Minutes Recorded</h4>
              <p style={{ color: "var(--muted)", margin: 0, fontSize: "0.88rem" }}>
                Log your supervision meetings to fulfill the monthly university supervision requirement (min 2 meetings/month).
              </p>
            </div>
          ) : (
            meetings.map((m) => {
              const isConfirmed = m.status === "confirmed";

              return (
                <div
                  key={m.id}
                  className="card"
                  style={{
                    padding: "1.25rem",
                    borderLeft: `4px solid ${isConfirmed ? "#10b981" : "#f59e0b"}`,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.5rem", flexWrap: "wrap" }}>
                    <div>
                      <div style={{ display: "inline-flex", gap: "0.4rem", alignItems: "center", marginBottom: "0.25rem" }}>
                        <span
                          className="badge"
                          style={{
                            background: isConfirmed ? "rgba(16, 185, 129, 0.15)" : "rgba(245, 158, 11, 0.15)",
                            color: isConfirmed ? "#10b981" : "#d97706",
                          }}
                        >
                          {isConfirmed ? "✓ Confirmed by Supervisor" : "⏳ Pending Supervisor Confirmation"}
                        </span>
                        <span className="badge" style={{ background: "var(--surface)", color: "var(--muted)" }}>
                          📅 {m.meetingDate}
                        </span>
                      </div>

                      <h4 style={{ fontSize: "1.05rem", fontWeight: 700, margin: "0.2rem 0" }}>
                        Supervision Session with {group.supervisorName}
                      </h4>
                      <div style={{ fontSize: "0.82rem", color: "var(--muted)" }}>
                        Logged by {m.schedulerName} ({m.scheduledBy}) • Attendees: {m.attendees.join(", ")}
                      </div>
                    </div>

                    {role === "supervisor" && !isConfirmed && (
                      <button
                        type="button"
                        className="btn primary tap"
                        onClick={() => {
                          setConfirmingMeeting(m);
                          setConfirmNotes("Meeting minutes reviewed and confirmed.");
                        }}
                        style={{ fontSize: "0.82rem", padding: "6px 12px" }}
                      >
                        <CheckCircle2 size={14} />
                        <span>Confirm Minutes</span>
                      </button>
                    )}
                  </div>

                  {/* Discussion Points & Action Items */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "1rem", marginTop: "0.75rem", background: "var(--surface)", padding: "0.75rem", borderRadius: "6px" }}>
                    <div>
                      <div style={{ fontSize: "0.78rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--muted)", marginBottom: "0.25rem" }}>
                        Discussion Points
                      </div>
                      <p style={{ fontSize: "0.86rem", margin: 0, whiteSpace: "pre-wrap", lineHeight: 1.4 }}>
                        {m.discussionPoints}
                      </p>
                    </div>

                    <div>
                      <div style={{ fontSize: "0.78rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--muted)", marginBottom: "0.25rem" }}>
                        Assigned Action Items
                      </div>
                      <p style={{ fontSize: "0.86rem", margin: 0, whiteSpace: "pre-wrap", lineHeight: 1.4 }}>
                        {m.actionItems}
                      </p>
                    </div>
                  </div>

                  {m.nextMeetingDate && (
                    <div style={{ fontSize: "0.8rem", color: "var(--muted)", marginTop: "0.5rem" }}>
                      📌 Next Follow-up Date: <strong>{m.nextMeetingDate}</strong>
                    </div>
                  )}

                  {m.supervisorNotes && (
                    <div style={{ marginTop: "0.5rem", padding: "0.5rem 0.75rem", borderRadius: "6px", background: "rgba(16, 185, 129, 0.08)", border: "1px solid rgba(16, 185, 129, 0.2)", fontSize: "0.82rem" }}>
                      <strong>Supervisor Note:</strong> {m.supervisorNotes}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </section>
      )}

      {/* =========================================================================
          TAB 3: DOCUMENT MANAGEMENT & PLAGIARISM CHECK
          ========================================================================= */}
      {activeTab === "documents" && (
        <section className="stack" style={{ gap: "1rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
            <div>
              <h4 style={{ fontSize: "1.05rem", fontWeight: 700, margin: 0 }}>
                Project Document Vault & Similarity Reports
              </h4>
              <p style={{ fontSize: "0.85rem", color: "var(--muted)", margin: "0.15rem 0 0" }}>
                Central storage for SRS, code repositories, presentation slides, and Turnitin similarity checks.
              </p>
            </div>

            <button
              type="button"
              className="btn primary tap"
              onClick={() => setIsDocModalOpen(true)}
              style={{ fontSize: "0.85rem" }}
            >
              <Upload size={15} />
              <span>Add Document / Repo Link</span>
            </button>
          </div>

          {documents.length === 0 ? (
            <div className="faculty-empty-slate" style={{ padding: "3rem 1.5rem", textAlign: "center" }}>
              <FileText size={36} style={{ opacity: 0.3, margin: "0 auto 0.75rem" }} />
              <h4 style={{ margin: "0 0 0.25rem", fontWeight: 700 }}>No Documents Uploaded Yet</h4>
              <p style={{ color: "var(--muted)", margin: 0, fontSize: "0.88rem" }}>
                Add your project proposal, SRS, architecture designs, or code repository link above.
              </p>
            </div>
          ) : (
            documents.map((doc) => (
              <div
                key={doc.id}
                className="card"
                style={{
                  padding: "1.25rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.75rem",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.5rem", flexWrap: "wrap" }}>
                  <div>
                    <div style={{ display: "inline-flex", gap: "0.4rem", alignItems: "center", marginBottom: "0.25rem" }}>
                      <span className="badge" style={{ background: "rgba(99, 102, 241, 0.12)", color: "var(--accent)" }}>
                        {doc.category.toUpperCase()}
                      </span>
                      <span className="badge" style={{ background: "var(--surface)", color: "var(--muted)" }}>
                        v{doc.version}
                      </span>
                      {doc.plagiarismScore !== undefined && (
                        <span
                          className="badge"
                          style={{
                            background: doc.similarityStatus === "passed" ? "rgba(16, 185, 129, 0.12)" : "rgba(239, 68, 68, 0.12)",
                            color: doc.similarityStatus === "passed" ? "#10b981" : "#ef4444",
                          }}
                        >
                          {doc.similarityStatus === "passed" ? "✓" : "▲"} Turnitin {doc.plagiarismScore}% (AI: {doc.aiScore}%)
                        </span>
                      )}
                    </div>

                    <h4 style={{ fontSize: "1.05rem", fontWeight: 700, margin: "0.2rem 0" }}>
                      {doc.title}
                    </h4>
                    <div style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
                      Uploaded by {doc.uploadedBy} on {new Date(doc.uploadedAt).toLocaleDateString()}
                    </div>
                  </div>

                  <a
                    href={doc.documentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn secondary tap"
                    style={{ fontSize: "0.82rem", padding: "6px 12px" }}
                  >
                    <ExternalLink size={14} />
                    <span>Open Resource</span>
                  </a>
                </div>

                {/* Inline Comment Thread */}
                <div style={{ background: "var(--surface)", padding: "0.75rem", borderRadius: "6px" }}>
                  <div style={{ fontSize: "0.78rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--muted)", marginBottom: "0.4rem" }}>
                    Supervisor & Student Review Thread ({doc.comments?.length || 0})
                  </div>

                  {doc.comments && doc.comments.length > 0 && (
                    <div className="stack" style={{ gap: "0.4rem", marginBottom: "0.6rem" }}>
                      {doc.comments.map((comm) => (
                        <div
                          key={comm.id}
                          style={{
                            padding: "0.4rem 0.6rem",
                            borderRadius: "4px",
                            background: comm.authorRole === "supervisor" ? "rgba(99, 102, 241, 0.08)" : "var(--background)",
                            border: "1px solid var(--border)",
                            fontSize: "0.83rem",
                          }}
                        >
                          <div style={{ fontWeight: 600, fontSize: "0.78rem", color: comm.authorRole === "supervisor" ? "var(--accent)" : "inherit" }}>
                            {comm.authorRole === "supervisor" ? "🎓" : "👤"} {comm.authorName} ({comm.authorRole}):
                          </div>
                          <div style={{ marginTop: "0.15rem" }}>{comm.text}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add comment input */}
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <input
                      type="text"
                      placeholder="Add an inline review note or question..."
                      value={activeDocForComment === doc.id ? commentText : ""}
                      onFocus={() => setActiveDocForComment(doc.id)}
                      onChange={(e) => {
                        setActiveDocForComment(doc.id);
                        setCommentText(e.target.value);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddComment(doc.id);
                        }
                      }}
                      className="input"
                      style={{ flex: 1, padding: "0.4rem 0.6rem", fontSize: "0.85rem" }}
                    />
                    <button
                      type="button"
                      className="btn secondary tap"
                      onClick={() => handleAddComment(doc.id)}
                      disabled={!commentText.trim() || activeDocForComment !== doc.id || isPending}
                      style={{ padding: "0 10px" }}
                    >
                      <Send size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </section>
      )}

      {/* =========================================================================
          TAB 4: 6TH SEMESTER DEFENSE & EVALUATION
          ========================================================================= */}
      {activeTab === "defense" && (
        <section className="stack" style={{ gap: "1.25rem" }}>
          {!defenseSchedule && (
            <div className="faculty-empty-slate" style={{ padding: "3rem 1.5rem", textAlign: "center" }}>
              <Clock size={40} style={{ opacity: 0.3, margin: "0 auto 0.75rem" }} />
              <h4 style={{ margin: "0 0 0.25rem", fontWeight: 700 }}>Defense Allocation in Progress</h4>
              <p style={{ color: "var(--muted)", margin: 0, fontSize: "0.88rem", maxWidth: "480px" }}>
                The FYP Coordinator is currently forming evaluation panels and scheduling defense slots across departmental venues. You will see your exact presentation date, room, and panelist roster once published.
              </p>
            </div>
          )}

          {defenseSchedule && (
            <div className="card" style={{ padding: "1.25rem", borderLeft: "4px solid var(--accent)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem" }}>
                <div>
                  <div style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.3rem" }}>
                    <span className="badge" style={{ background: "rgba(99, 102, 241, 0.15)", color: "var(--accent)" }}>
                      6th Semester Defense
                    </span>
                    <span
                      className="badge"
                      style={{
                        background:
                          defenseSchedule.status === "completed"
                            ? "rgba(16, 185, 129, 0.15)"
                            : "rgba(245, 158, 11, 0.15)",
                        color: defenseSchedule.status === "completed" ? "#10b981" : "#d97706",
                      }}
                    >
                      {defenseSchedule.status.toUpperCase()}
                    </span>
                  </div>
                  <h3 style={{ fontSize: "1.2rem", fontWeight: 700, margin: "0.2rem 0" }}>
                    Presentation Logistics & Venue
                  </h3>
                </div>

                <div style={{ textAlign: "right", fontSize: "0.85rem" }}>
                  <div style={{ fontWeight: 700, color: "var(--accent)", fontSize: "0.95rem" }}>
                    📅 {defenseSchedule.defenseDate}
                  </div>
                  <div style={{ color: "var(--muted)" }}>
                    ⏰ {defenseSchedule.startTime} – {defenseSchedule.endTime}
                  </div>
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: "1rem",
                  marginTop: "1rem",
                  padding: "0.85rem",
                  background: "var(--surface)",
                  borderRadius: "8px",
                }}
              >
                <div>
                  <div style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", color: "var(--muted)" }}>
                    Defense Venue
                  </div>
                  <div style={{ fontWeight: 600, display: "flex", alignItems: "center", gap: "0.35rem", marginTop: "0.2rem" }}>
                    <MapPin size={16} color="var(--accent)" />
                    {defenseSchedule.venue}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", color: "var(--muted)" }}>
                    Assigned Panel
                  </div>
                  <div style={{ fontWeight: 600, display: "flex", alignItems: "center", gap: "0.35rem", marginTop: "0.2rem" }}>
                    <Users size={16} color="var(--accent)" />
                    {defensePanel ? `${defensePanel.panelCode} (${defensePanel.members.length} Evaluators)` : "Assigned"}
                  </div>
                </div>
              </div>

              {/* Panel Evaluators List */}
              {defensePanel && (
                <div style={{ marginTop: "1rem" }}>
                  <div style={{ fontSize: "0.78rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--muted)", marginBottom: "0.5rem" }}>
                    Evaluation Committee Members
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "0.75rem" }}>
                    {defensePanel.members.map((member) => (
                      <div
                        key={member.teacherId}
                        style={{
                          padding: "0.6rem 0.8rem",
                          borderRadius: "6px",
                          background: member.isChairperson ? "rgba(99, 102, 241, 0.08)" : "var(--background)",
                          border: member.isChairperson ? "1px solid rgba(99, 102, 241, 0.3)" : "1px solid var(--border)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 600, fontSize: "0.88rem" }}>
                            {member.isChairperson ? "👑 " : "👤 "} {member.teacherName}
                          </div>
                          <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                            {member.designation} • {member.department}
                          </div>
                        </div>
                        {member.isChairperson && (
                          <span className="badge" style={{ background: "var(--accent)", color: "#fff", fontSize: "0.7rem" }}>
                            Chair
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Published Results & Rubric Summary */}
          {defenseResult?.published && (
            <div
              className="card"
              style={{
                padding: "1.25rem",
                background: "linear-gradient(135deg, rgba(16, 185, 129, 0.04), rgba(99, 102, 241, 0.04))",
                borderLeft: "4px solid #10b981",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem" }}>
                <div>
                  <div style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.25rem" }}>
                    <span className="badge" style={{ background: "rgba(16, 185, 129, 0.15)", color: "#10b981" }}>
                      Official Published Results
                    </span>
                    <span
                      className="badge"
                      style={{
                        background:
                          defenseResult.consensusRecommendation === "accepted"
                            ? "rgba(16, 185, 129, 0.2)"
                            : defenseResult.consensusRecommendation === "accepted_with_minor_changes"
                            ? "rgba(59, 130, 246, 0.2)"
                            : "rgba(239, 68, 68, 0.2)",
                        color:
                          defenseResult.consensusRecommendation === "accepted"
                            ? "#10b981"
                            : defenseResult.consensusRecommendation === "accepted_with_minor_changes"
                            ? "#2563eb"
                            : "#ef4444",
                      }}
                    >
                      {defenseResult.consensusRecommendation.replace(/_/g, " ").toUpperCase()}
                    </span>
                  </div>
                  <h3 style={{ fontSize: "1.25rem", fontWeight: 700, margin: "0.2rem 0" }}>
                    6th Semester Defense Evaluation Scorecard
                  </h3>
                  <div style={{ fontSize: "0.85rem", color: "var(--muted)" }}>
                    Published on {new Date(defenseResult.publishedAt || "").toLocaleDateString()} by {defenseResult.publishedBy}
                  </div>
                </div>

                <div
                  style={{
                    textAlign: "center",
                    padding: "0.6rem 1.25rem",
                    borderRadius: "8px",
                    background: "rgba(16, 185, 129, 0.1)",
                    border: "1px solid rgba(16, 185, 129, 0.3)",
                  }}
                >
                  <div style={{ fontSize: "0.75rem", textTransform: "uppercase", fontWeight: 700, color: "#10b981" }}>
                    Panel Average
                  </div>
                  <div style={{ fontSize: "1.75rem", fontWeight: 800, color: "#10b981", lineHeight: 1.1 }}>
                    {defenseResult.panelAverageScore}
                    <span style={{ fontSize: "0.9rem", fontWeight: 500 }}> / 100</span>
                  </div>
                </div>
              </div>

              {/* Rubric Breakdown */}
              <div style={{ marginTop: "1.25rem" }}>
                <div style={{ fontSize: "0.78rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--muted)", marginBottom: "0.5rem" }}>
                  Defense Rubric Breakdown
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "0.75rem" }}>
                  {Object.entries(defenseResult.rubricBreakdown).map(([critId, score]) => (
                    <div
                      key={critId}
                      style={{
                        padding: "0.6rem 0.8rem",
                        background: "var(--surface)",
                        borderRadius: "6px",
                        border: "1px solid var(--border)",
                      }}
                    >
                      <div style={{ fontSize: "0.78rem", color: "var(--muted)", textTransform: "capitalize" }}>
                        {critId.replace(/_/g, " ")}
                      </div>
                      <div style={{ fontWeight: 700, fontSize: "1.05rem", marginTop: "0.2rem", color: "var(--accent)" }}>
                        {score} pts
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Per-Student Individual Marks */}
              <div style={{ marginTop: "1.25rem" }}>
                <div style={{ fontSize: "0.78rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--muted)", marginBottom: "0.5rem" }}>
                  Individual Student Performance Marks
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "0.75rem" }}>
                  {defenseResult.studentScores.map((st) => (
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
                        <div style={{ fontWeight: 600, fontSize: "0.88rem" }}>{st.studentName}</div>
                        <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>{st.regNo}</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--accent)" }}>
                          {st.individualMarks} / 15
                        </div>
                        <div style={{ fontSize: "0.7rem", color: "var(--muted)" }}>Individual</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Panel Remarks */}
              {defenseResult.panelRemarks.length > 0 && (
                <div style={{ marginTop: "1.25rem" }}>
                  <div style={{ fontSize: "0.78rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--muted)", marginBottom: "0.5rem" }}>
                    Consolidated Panel Feedback & Directions
                  </div>
                  <div className="stack" style={{ gap: "0.5rem" }}>
                    {defenseResult.panelRemarks.map((remark, idx) => (
                      <div
                        key={idx}
                        style={{
                          padding: "0.6rem 0.8rem",
                          borderRadius: "6px",
                          background: "var(--surface)",
                          borderLeft: "3px solid var(--accent)",
                          fontSize: "0.85rem",
                          lineHeight: 1.45,
                        }}
                      >
                        &ldquo;{remark}&rdquo;
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* =========================================================================
          MODAL 1: SUBMIT MILESTONE (STUDENT)
          ========================================================================= */}
      {submittingMilestone && (
        <div className="modal-backdrop" style={{ zIndex: 1000 }} onClick={() => setSubmittingMilestone(null)}>
          <div className="modal-card" style={{ maxWidth: "520px" }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3>Submit Deliverable</h3>
                <p className="fine quiet">{submittingMilestone.title}</p>
              </div>
              <button type="button" className="close-btn" onClick={() => setSubmittingMilestone(null)}>×</button>
            </div>

            <form onSubmit={handleSubmitMilestone} className="modal-body stack" style={{ gap: "1rem" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.3rem" }}>
                  Deliverable File Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. FYP_SRS_Document_v1.pdf"
                  value={submitFileName}
                  onChange={(e) => setSubmitFileName(e.target.value)}
                  className="input"
                  style={{ width: "100%", padding: "0.5rem" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.3rem" }}>
                  Document URL / Cloud Link (Google Drive, OneDrive, GitHub) *
                </label>
                <input
                  type="url"
                  required
                  placeholder="https://drive.google.com/file/... or https://github.com/..."
                  value={submitDocUrl}
                  onChange={(e) => setSubmitDocUrl(e.target.value)}
                  className="input"
                  style={{ width: "100%", padding: "0.5rem" }}
                />
                <span style={{ fontSize: "0.78rem", color: "var(--muted)", display: "block", marginTop: "0.25rem" }}>
                  Ensure sharing permissions are open for university evaluators.
                </span>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.3rem" }}>
                  Version Change Summary / Release Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Added section 3.2 for database normalization and revised sequence diagrams."
                  value={submitChangeSummary}
                  onChange={(e) => setSubmitChangeSummary(e.target.value)}
                  className="input"
                  style={{ width: "100%", padding: "0.5rem" }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
                <button type="button" className="btn secondary tap" onClick={() => setSubmittingMilestone(null)} disabled={isPending}>
                  Cancel
                </button>
                <button type="submit" className="btn primary tap" disabled={isPending}>
                  <Upload size={14} />
                  <span>Upload & Run Turnitin Scan</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 2: REVIEW MILESTONE (SUPERVISOR)
          ========================================================================= */}
      {reviewingMilestone && (
        <div className="modal-backdrop" style={{ zIndex: 1000 }} onClick={() => setReviewingMilestone(null)}>
          <div className="modal-card" style={{ maxWidth: "520px" }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3>Supervisor Evaluation</h3>
                <p className="fine quiet">{reviewingMilestone.title}</p>
              </div>
              <button type="button" className="close-btn" onClick={() => setReviewingMilestone(null)}>×</button>
            </div>

            <div className="modal-body stack" style={{ gap: "1rem" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.3rem" }}>
                  Review Decision
                </label>
                <div style={{ display: "flex", gap: "1rem" }}>
                  <label style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", cursor: "pointer" }}>
                    <input
                      type="radio"
                      name="decision"
                      checked={reviewDecision === "approved"}
                      onChange={() => setReviewDecision("approved")}
                    />
                    <span>✓ Approve Milestone</span>
                  </label>
                  <label style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", cursor: "pointer" }}>
                    <input
                      type="radio"
                      name="decision"
                      checked={reviewDecision === "revision_requested"}
                      onChange={() => setReviewDecision("revision_requested")}
                    />
                    <span>▲ Request Revision</span>
                  </label>
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.3rem" }}>
                  Supervisor Feedback & Guidance Remarks
                </label>
                <textarea
                  rows={3}
                  placeholder="Provide detailed comments, required corrections, or approval notes for the students..."
                  value={reviewFeedback}
                  onChange={(e) => setReviewFeedback(e.target.value)}
                  className="input"
                  style={{ width: "100%", padding: "0.5rem" }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
                <button type="button" className="btn secondary tap" onClick={() => setReviewingMilestone(null)} disabled={isPending}>
                  Cancel
                </button>
                <button type="button" className="btn primary tap" onClick={handleReviewMilestone} disabled={isPending}>
                  <CheckCircle2 size={14} />
                  <span>Submit Evaluation</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 3: LOG MEETING MINUTES
          ========================================================================= */}
      {isMeetingModalOpen && (
        <div className="modal-backdrop" style={{ zIndex: 1000 }} onClick={() => setIsMeetingModalOpen(false)}>
          <div className="modal-card" style={{ maxWidth: "540px" }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3>Log Supervision Meeting Minutes</h3>
                <p className="fine quiet">{group.title}</p>
              </div>
              <button type="button" className="close-btn" onClick={() => setIsMeetingModalOpen(false)}>×</button>
            </div>

            <form onSubmit={handleCreateMeetingLog} className="modal-body stack" style={{ gap: "1rem" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.3rem" }}>
                    Meeting Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={meetingDate}
                    onChange={(e) => setMeetingDate(e.target.value)}
                    className="input"
                    style={{ width: "100%", padding: "0.5rem" }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.3rem" }}>
                    Next Meeting Target Date
                  </label>
                  <input
                    type="date"
                    value={nextMeetingDate}
                    onChange={(e) => setNextMeetingDate(e.target.value)}
                    className="input"
                    style={{ width: "100%", padding: "0.5rem" }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.3rem" }}>
                  Key Discussion Points *
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Outline topics discussed, architecture choices, literature review feedback, etc."
                  value={discussionPoints}
                  onChange={(e) => setDiscussionPoints(e.target.value)}
                  className="input"
                  style={{ width: "100%", padding: "0.5rem" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.3rem" }}>
                  Action Items & Deliverables for Next Sprint *
                </label>
                <textarea
                  rows={2}
                  required
                  placeholder="List specific tasks assigned to team members..."
                  value={actionItems}
                  onChange={(e) => setActionItems(e.target.value)}
                  className="input"
                  style={{ width: "100%", padding: "0.5rem" }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
                <button type="button" className="btn secondary tap" onClick={() => setIsMeetingModalOpen(false)} disabled={isPending}>
                  Cancel
                </button>
                <button type="submit" className="btn primary tap" disabled={isPending}>
                  <CheckCircle2 size={14} />
                  <span>Save Meeting Minutes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 4: CONFIRM MEETING (SUPERVISOR)
          ========================================================================= */}
      {confirmingMeeting && (
        <div className="modal-backdrop" style={{ zIndex: 1000 }} onClick={() => setConfirmingMeeting(null)}>
          <div className="modal-card" style={{ maxWidth: "480px" }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3>Confirm Meeting Minutes</h3>
                <p className="fine quiet">Meeting on {confirmingMeeting.meetingDate}</p>
              </div>
              <button type="button" className="close-btn" onClick={() => setConfirmingMeeting(null)}>×</button>
            </div>

            <div className="modal-body stack" style={{ gap: "1rem" }}>
              <p style={{ fontSize: "0.88rem", color: "var(--muted)", margin: 0 }}>
                Confirm that this supervision session took place and endorse the recorded action items for the group.
              </p>

              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.3rem" }}>
                  Supervisor Endorsement Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  value={confirmNotes}
                  onChange={(e) => setConfirmNotes(e.target.value)}
                  placeholder="e.g. Minutes confirmed. Ensure API tests are completed before next week."
                  className="input"
                  style={{ width: "100%", padding: "0.5rem" }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
                <button type="button" className="btn secondary tap" onClick={() => setConfirmingMeeting(null)} disabled={isPending}>
                  Cancel
                </button>
                <button type="button" className="btn primary tap" onClick={handleConfirmMeeting} disabled={isPending}>
                  <CheckCircle2 size={14} />
                  <span>Confirm & Endorse</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 5: UPLOAD DOCUMENT / REPO LINK
          ========================================================================= */}
      {isDocModalOpen && (
        <div className="modal-backdrop" style={{ zIndex: 1000 }} onClick={() => setIsDocModalOpen(false)}>
          <div className="modal-card" style={{ maxWidth: "500px" }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3>Add Document or Repository</h3>
                <p className="fine quiet">{group.title}</p>
              </div>
              <button type="button" className="close-btn" onClick={() => setIsDocModalOpen(false)}>×</button>
            </div>

            <form onSubmit={handleUploadDocument} className="modal-body stack" style={{ gap: "1rem" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.3rem" }}>
                  Document Category *
                </label>
                <select
                  value={docCategory}
                  onChange={(e) => setDocCategory(e.target.value as FypDocumentCategory)}
                  className="input"
                  style={{ width: "100%", padding: "0.5rem" }}
                >
                  {FYP_DOCUMENT_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c.replace("_", " ").toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.3rem" }}>
                  Document Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. SRS Final Draft, GitHub Repo, Presentation Slides"
                  value={docTitle}
                  onChange={(e) => setDocTitle(e.target.value)}
                  className="input"
                  style={{ width: "100%", padding: "0.5rem" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.3rem" }}>
                  Resource URL / Link *
                </label>
                <input
                  type="url"
                  required
                  placeholder="https://github.com/... or https://drive.google.com/..."
                  value={docUrl}
                  onChange={(e) => setDocUrl(e.target.value)}
                  className="input"
                  style={{ width: "100%", padding: "0.5rem" }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
                <button type="button" className="btn secondary tap" onClick={() => setIsDocModalOpen(false)} disabled={isPending}>
                  Cancel
                </button>
                <button type="submit" className="btn primary tap" disabled={isPending}>
                  <Upload size={14} />
                  <span>Upload & Run Scan</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
