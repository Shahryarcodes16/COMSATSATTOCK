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
  FypFinalStudentGrade,
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
  getGroupFinalResultsServerFn,
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
  const [finalGrades, setFinalGrades] = useState<FypFinalStudentGrade[]>([]);

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
      const [mRes, meetRes, docRes, sumRes, defRes, gradesRes] = await Promise.all([
        getGroupMilestonesServerFn({ data: { groupId: group.id } }),
        getGroupMeetingLogsServerFn({ data: { groupId: group.id } }),
        getGroupDocumentsServerFn({ data: { groupId: group.id } }),
        getGroupProgressSummaryServerFn({ data: { groupId: group.id } }),
        getStudentDefenseScheduleServerFn({ data: { groupId: group.id } }).catch(() => ({
          schedule: null,
          panel: null,
          resultSummary: null,
        })),
        getGroupFinalResultsServerFn({ data: { groupId: group.id } }).catch(() => ({ grades: [] })),
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
      setFinalGrades(gradesRes?.grades || []);
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
    <div className="fyp-shell">
      {/* Overview Progress & Compliance Hero Card */}
      <div className="fyp-hero-banner">
        <div className="fyp-hero-header">
          <div>
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "0.35rem", flexWrap: "wrap" }}>
              <span className="fyp-badge primary">
                {group.domain}
              </span>
              <span className={`fyp-badge ${summary?.isOnTrack ? "success" : "ruby"}`}>
                <span className="fyp-pulse-dot" />
                {summary?.isOnTrack ? "Cohort On Track" : "Action Required"}
              </span>
            </div>
            <h1 className="fyp-hero-title">
              {group.title}
            </h1>
            <p className="fyp-hero-subtitle">
              Supervisor: <strong>{group.supervisorName}</strong> • Team Leader: <strong>{group.leader.fullName}</strong> ({group.leader.regNo})
            </p>
          </div>

          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              type="button"
              className="fyp-btn secondary"
              onClick={loadHubData}
              disabled={loading}
              title="Refresh workspace"
            >
              <RefreshCw size={14} className={loading ? "spin" : ""} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Milestone Progress Bar & Monthly Meeting Tracker */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1.25rem", marginTop: "1.25rem", paddingTop: "1rem", borderTop: "1px solid color-mix(in srgb, var(--c-accent) 20%, var(--c-line))" }}>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.4rem" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", color: "var(--c-ink)" }}>
                <Award size={15} color="var(--c-accent)" />
                Project Milestone Completion
              </span>
              <span style={{ color: "var(--c-muted)", fontSize: "0.83rem" }}>
                <strong style={{ color: "var(--c-ink)" }}>{summary?.completedMilestones || 0}</strong> of <strong style={{ color: "var(--c-ink)" }}>{summary?.totalMilestones || 6}</strong> Approved ({percentComplete}%)
              </span>
            </div>
            <div className="fyp-progress-track">
              <div
                className={`fyp-progress-fill ${percentComplete === 100 ? "emerald" : "accent"}`}
                style={{ width: `${percentComplete}%` }}
              />
            </div>
          </div>

          <div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.4rem" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", color: "var(--c-ink)" }}>
                <Calendar size={15} color={isMeetingMet ? "#10b981" : "var(--c-brass, #f59e0b)"} />
                Monthly Supervision Compliance
              </span>
              <span style={{ color: isMeetingMet ? "#10b981" : "#d97706", fontSize: "0.83rem" }}>
                <strong>{summary?.monthlyMeetingCount || 0} / 2 Meetings</strong> {isMeetingMet ? "✓ Met" : "(Min 2 Required)"}
              </span>
            </div>
            <div className="fyp-progress-track">
              <div
                className={`fyp-progress-fill ${isMeetingMet ? "emerald" : "amber"}`}
                style={{ width: `${Math.min(100, ((summary?.monthlyMeetingCount || 0) / 2) * 100)}%` }}
              />
            </div>
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

      {/* Tabs */}
      <div className="fyp-tabs-bar">
        <button
          type="button"
          className={`fyp-tab-btn ${activeTab === "milestones" ? "active" : ""}`}
          onClick={() => setActiveTab("milestones")}
        >
          <Award size={15} />
          <span>Milestones &amp; Sprints</span>
          <span className="tab-count">{milestones.length}</span>
        </button>

        <button
          type="button"
          className={`fyp-tab-btn ${activeTab === "meetings" ? "active" : ""}`}
          onClick={() => setActiveTab("meetings")}
        >
          <Calendar size={15} />
          <span>Meeting Minutes &amp; Log</span>
          <span className="tab-count">{meetings.length}</span>
        </button>

        <button
          type="button"
          className={`fyp-tab-btn ${activeTab === "documents" ? "active" : ""}`}
          onClick={() => setActiveTab("documents")}
        >
          <FileText size={15} />
          <span>Document Vault &amp; Turnitin</span>
          <span className="tab-count">{documents.length}</span>
        </button>

        <button
          type="button"
          className={`fyp-tab-btn ${activeTab === "defense" ? "active" : ""}`}
          onClick={() => setActiveTab("defense")}
        >
          <Award size={15} />
          <span>6th Sem Defense</span>
          {defenseResult?.published ? (
            <span className="fyp-badge success" style={{ fontSize: "0.72rem", padding: "1px 6px" }}>
              Published
            </span>
          ) : defenseSchedule ? (
            <span className="fyp-badge primary" style={{ fontSize: "0.72rem", padding: "1px 6px" }}>
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
                className={`fyp-card elevated-hover ${isApproved ? "emerald-edge" : isRevision ? "ruby-edge" : isSubmitted ? "accent-edge" : ""}`}
                style={{ padding: "1.35rem" }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem", flexWrap: "wrap" }}>
                  <div>
                    <div style={{ display: "inline-flex", gap: "0.45rem", alignItems: "center", marginBottom: "0.35rem" }}>
                      <span className="fyp-badge neutral">
                        Milestone {index + 1} ({ms.weightage}%)
                      </span>
                      <span
                        className={`fyp-badge ${
                          isApproved
                            ? "success"
                            : isRevision
                            ? "ruby"
                            : isSubmitted
                            ? "primary"
                            : "neutral"
                        }`}
                      >
                        <span className="fyp-pulse-dot" />
                        {isApproved && "Approved by Supervisor"}
                        {isRevision && "Revision Requested"}
                        {isSubmitted && "Submitted (Under Review)"}
                        {ms.status === "not_started" && "Not Submitted"}
                      </span>
                    </div>

                    <h4 style={{ fontSize: "1.15rem", fontWeight: 700, margin: "0.15rem 0" }}>
                      {ms.title}
                    </h4>
                    <p style={{ fontSize: "0.85rem", color: "var(--c-muted)", margin: "0.2rem 0 0.5rem", lineHeight: 1.5 }}>
                      {ms.description}
                    </p>
                    <div style={{ fontSize: "0.82rem", color: "var(--c-muted)", display: "flex", gap: "1rem" }}>
                      <span>📅 Deadline: <strong style={{ color: "var(--c-ink)" }}>{new Date(ms.deadline).toLocaleDateString()}</strong></span>
                      {latestSub && <span>📄 Latest Version: <strong style={{ color: "var(--c-ink)" }}>v{latestSub.version}</strong></span>}
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                    {role === "student" && !isApproved && (
                      <button
                        type="button"
                        className="fyp-btn primary"
                        onClick={() => {
                          setSubmittingMilestone(ms);
                          setSubmitFileName(`${group.title.substring(0, 15)}_${ms.key}_draft.pdf`);
                        }}
                      >
                        <Upload size={14} />
                        <span>{ms.submissions.length > 0 ? "Submit Revision" : "Submit Deliverable"}</span>
                      </button>
                    )}

                    {role === "supervisor" && isSubmitted && (
                      <button
                        type="button"
                        className="fyp-btn primary"
                        onClick={() => {
                          setReviewingMilestone(ms);
                          setReviewDecision("approved");
                          setReviewFeedback("");
                        }}
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
                    className={`fyp-badge ${isApproved ? "success" : "ruby"}`}
                    style={{
                      marginTop: "0.85rem",
                      padding: "0.75rem 1rem",
                      borderRadius: "0.6rem",
                      width: "100%",
                      fontSize: "0.86rem",
                      lineHeight: 1.45,
                    }}
                  >
                    <strong>Supervisor Remarks:</strong> {ms.supervisorFeedback}
                  </div>
                )}

                {/* Latest Submission Card */}
                {latestSub && (
                  <div
                    className="fyp-card"
                    style={{
                      marginTop: "0.85rem",
                      padding: "0.85rem 1rem",
                      display: "flex",
                      flexWrap: "wrap",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "0.6rem",
                    }}
                  >
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", fontWeight: 600, fontSize: "0.92rem" }}>
                        <FileText size={16} color="var(--c-accent)" />
                        <span>{latestSub.fileName}</span>
                        <span className="fyp-badge neutral" style={{ fontSize: "0.75rem", padding: "1px 6px" }}>v{latestSub.version}</span>
                      </div>
                      <div style={{ fontSize: "0.8rem", color: "var(--c-muted)", marginTop: "0.2rem" }}>
                        Submitted by {latestSub.submittedBy} on {new Date(latestSub.submittedAt).toLocaleDateString()} • &ldquo;{latestSub.changeSummary}&rdquo;
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                      {/* Plagiarism Badge */}
                      <span
                        className={`fyp-badge ${latestSub.similarityStatus === "passed" ? "success" : "ruby"}`}
                      >
                        {latestSub.similarityStatus === "passed" ? <ShieldCheck size={13} /> : <ShieldAlert size={13} />}
                        <span>Turnitin: {latestSub.plagiarismScore}% (AI: {latestSub.aiScore}%)</span>
                      </span>

                      <a
                        href={latestSub.documentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="fyp-btn secondary"
                        style={{ fontSize: "0.8rem", padding: "4px 10px" }}
                      >
                        <ExternalLink size={13} />
                        <span>Open Document</span>
                      </a>
                    </div>
                  </div>
                )}

                {/* Submissions Version History Toggle */}
                {ms.submissions && ms.submissions.length > 1 && (
                  <div style={{ marginTop: "0.6rem" }}>
                    <button
                      type="button"
                      onClick={() => setExpandedMilestoneId(isExpanded ? null : ms.id)}
                      style={{
                        background: "transparent",
                        border: "none",
                        cursor: "pointer",
                        fontSize: "0.82rem",
                        color: "var(--c-accent)",
                        padding: 0,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "0.35rem",
                        fontWeight: 600,
                      }}
                    >
                      <GitBranch size={13} />
                      <span>{ms.submissions.length} Submissions in Version History</span>
                      {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                    </button>

                    {isExpanded && (
                      <div className="stack" style={{ gap: "0.45rem", marginTop: "0.5rem", paddingLeft: "0.75rem", borderLeft: "2px solid var(--c-accent)" }}>
                        {ms.submissions.map((sub) => (
                          <div
                            key={sub.id}
                            className="fyp-card"
                            style={{
                              fontSize: "0.82rem",
                              display: "flex",
                              justifyContent: "space-between",
                              padding: "0.5rem 0.75rem",
                            }}
                          >
                            <span>
                              <strong>v{sub.version}</strong>: {sub.fileName} ({sub.changeSummary})
                            </span>
                            <span style={{ color: "var(--c-muted)" }}>
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
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.75rem" }}>
            <div>
              <h4 style={{ fontSize: "1.1rem", fontWeight: 700, margin: 0 }}>
                Supervision Meeting Records
              </h4>
              <p style={{ fontSize: "0.85rem", color: "var(--c-muted)", margin: "0.15rem 0 0" }}>
                Keep an official log of supervision discussions, deliverables, and action items.
              </p>
            </div>

            <button
              type="button"
              className="fyp-btn primary"
              onClick={() => setIsMeetingModalOpen(true)}
            >
              <Plus size={15} />
              <span>Log Meeting Minutes</span>
            </button>
          </div>

          {meetings.length === 0 ? (
            <div className="fyp-card" style={{ padding: "3.5rem 1.5rem", textAlign: "center" }}>
              <Calendar size={38} style={{ opacity: 0.35, margin: "0 auto 0.75rem", color: "var(--c-accent)" }} />
              <h4 style={{ margin: "0 0 0.25rem", fontWeight: 700, fontSize: "1.1rem" }}>No Meeting Minutes Recorded</h4>
              <p style={{ color: "var(--c-muted)", margin: 0, fontSize: "0.88rem", maxWidth: "420px", marginLeft: "auto", marginRight: "auto" }}>
                Log your supervision meetings to fulfill the monthly university supervision requirement (min 2 meetings/month).
              </p>
            </div>
          ) : (
            meetings.map((m) => {
              const isConfirmed = m.status === "confirmed";

              return (
                <div
                  key={m.id}
                  className={`fyp-card elevated-hover ${isConfirmed ? "emerald-edge" : "amber-edge"}`}
                  style={{ padding: "1.35rem" }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.75rem", flexWrap: "wrap" }}>
                    <div>
                      <div style={{ display: "inline-flex", gap: "0.45rem", alignItems: "center", marginBottom: "0.35rem" }}>
                        <span className={`fyp-badge ${isConfirmed ? "success" : "warning"}`}>
                          <span className="fyp-pulse-dot" />
                          {isConfirmed ? "✓ Confirmed by Supervisor" : "Pending Supervisor Confirmation"}
                        </span>
                        <span className="fyp-badge neutral">
                          📅 {m.meetingDate}
                        </span>
                      </div>

                      <h4 style={{ fontSize: "1.15rem", fontWeight: 700, margin: "0.15rem 0" }}>
                        Supervision Session with {group.supervisorName}
                      </h4>
                      <div style={{ fontSize: "0.82rem", color: "var(--c-muted)" }}>
                        Logged by {m.schedulerName} ({m.scheduledBy}) • Attendees: {m.attendees.join(", ")}
                      </div>
                    </div>

                    {role === "supervisor" && !isConfirmed && (
                      <button
                        type="button"
                        className="fyp-btn primary"
                        onClick={() => {
                          setConfirmingMeeting(m);
                          setConfirmNotes("Meeting minutes reviewed and confirmed.");
                        }}
                      >
                        <CheckCircle2 size={14} />
                        <span>Confirm Minutes</span>
                      </button>
                    )}
                  </div>

                  {/* Discussion Points & Action Items */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "1rem", marginTop: "1rem", background: "color-mix(in srgb, var(--c-canvas) 60%, var(--c-paper))", padding: "1rem", borderRadius: "0.75rem", border: "1px solid var(--c-line)" }}>
                    <div>
                      <div style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--c-muted)", marginBottom: "0.3rem" }}>
                        Discussion Points
                      </div>
                      <p style={{ fontSize: "0.88rem", margin: 0, whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
                        {m.discussionPoints}
                      </p>
                    </div>

                    <div>
                      <div style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--c-muted)", marginBottom: "0.3rem" }}>
                        Assigned Action Items
                      </div>
                      <p style={{ fontSize: "0.88rem", margin: 0, whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
                        {m.actionItems}
                      </p>
                    </div>
                  </div>

                  {m.nextMeetingDate && (
                    <div style={{ fontSize: "0.82rem", color: "var(--c-muted)", marginTop: "0.6rem" }}>
                      📌 Next Follow-up Date: <strong style={{ color: "var(--c-ink)" }}>{m.nextMeetingDate}</strong>
                    </div>
                  )}

                  {m.supervisorNotes && (
                    <div className="fyp-badge success" style={{ marginTop: "0.6rem", padding: "0.6rem 0.85rem", borderRadius: "0.5rem", width: "100%", fontSize: "0.85rem" }}>
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
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.75rem" }}>
            <div>
              <h4 style={{ fontSize: "1.1rem", fontWeight: 700, margin: 0 }}>
                Project Document Vault &amp; Similarity Reports
              </h4>
              <p style={{ fontSize: "0.85rem", color: "var(--c-muted)", margin: "0.15rem 0 0" }}>
                Central storage for SRS, code repositories, presentation slides, and Turnitin similarity checks.
              </p>
            </div>

            <button
              type="button"
              className="fyp-btn primary"
              onClick={() => setIsDocModalOpen(true)}
            >
              <Upload size={15} />
              <span>Add Document / Repo Link</span>
            </button>
          </div>

          {documents.length === 0 ? (
            <div className="fyp-card" style={{ padding: "3.5rem 1.5rem", textAlign: "center" }}>
              <FileText size={38} style={{ opacity: 0.35, margin: "0 auto 0.75rem", color: "var(--c-accent)" }} />
              <h4 style={{ margin: "0 0 0.25rem", fontWeight: 700, fontSize: "1.1rem" }}>No Documents Uploaded Yet</h4>
              <p style={{ color: "var(--c-muted)", margin: 0, fontSize: "0.88rem", maxWidth: "420px", marginLeft: "auto", marginRight: "auto" }}>
                Add your project proposal, SRS, architecture designs, or code repository link above.
              </p>
            </div>
          ) : (
            documents.map((doc) => (
              <div
                key={doc.id}
                className="fyp-card elevated-hover"
                style={{
                  padding: "1.35rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.85rem",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.75rem", flexWrap: "wrap" }}>
                  <div>
                    <div style={{ display: "inline-flex", gap: "0.45rem", alignItems: "center", marginBottom: "0.35rem" }}>
                      <span className="fyp-badge primary">
                        {doc.category.toUpperCase()}
                      </span>
                      <span className="fyp-badge neutral">
                        v{doc.version}
                      </span>
                      {doc.plagiarismScore !== undefined && (
                        <span
                          className={`fyp-badge ${doc.similarityStatus === "passed" ? "success" : "ruby"}`}
                        >
                          {doc.similarityStatus === "passed" ? "✓" : "▲"} Turnitin {doc.plagiarismScore}% (AI: {doc.aiScore}%)
                        </span>
                      )}
                    </div>

                    <h4 style={{ fontSize: "1.15rem", fontWeight: 700, margin: "0.15rem 0" }}>
                      {doc.title}
                    </h4>
                    <div style={{ fontSize: "0.82rem", color: "var(--c-muted)" }}>
                      Uploaded by {doc.uploadedBy} on {new Date(doc.uploadedAt).toLocaleDateString()}
                    </div>
                  </div>

                  <a
                    href={doc.documentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="fyp-btn secondary"
                  >
                    <ExternalLink size={14} />
                    <span>Open Resource</span>
                  </a>
                </div>

                {/* Inline Comment Thread */}
                <div style={{ background: "color-mix(in srgb, var(--c-canvas) 60%, var(--c-paper))", padding: "1rem", borderRadius: "0.75rem", border: "1px solid var(--c-line)" }}>
                  <div style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--c-muted)", marginBottom: "0.5rem" }}>
                    Supervisor &amp; Student Review Thread ({doc.comments?.length || 0})
                  </div>

                  {doc.comments && doc.comments.length > 0 && (
                    <div className="stack" style={{ gap: "0.5rem", marginBottom: "0.75rem" }}>
                      {doc.comments.map((comm) => (
                        <div
                          key={comm.id}
                          className="fyp-card"
                          style={{
                            padding: "0.5rem 0.75rem",
                            background: comm.authorRole === "supervisor" ? "color-mix(in srgb, var(--c-accent) 10%, var(--c-paper))" : "var(--c-paper)",
                            fontSize: "0.85rem",
                          }}
                        >
                          <div style={{ fontWeight: 600, fontSize: "0.8rem", color: comm.authorRole === "supervisor" ? "var(--c-accent)" : "inherit" }}>
                            {comm.authorRole === "supervisor" ? "🎓" : "👤"} {comm.authorName} ({comm.authorRole}):
                          </div>
                          <div style={{ marginTop: "0.2rem" }}>{comm.text}</div>
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
                      className="fyp-input"
                      style={{ flex: 1 }}
                    />
                    <button
                      type="button"
                      className="fyp-btn secondary"
                      onClick={() => handleAddComment(doc.id)}
                      disabled={!commentText.trim() || activeDocForComment !== doc.id || isPending}
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
            <div className="fyp-card" style={{ padding: "3.5rem 1.5rem", textAlign: "center" }}>
              <Clock size={40} style={{ opacity: 0.35, margin: "0 auto 0.75rem", color: "var(--c-accent)" }} />
              <h4 style={{ margin: "0 0 0.25rem", fontWeight: 700, fontSize: "1.1rem" }}>Defense Allocation in Progress</h4>
              <p style={{ color: "var(--c-muted)", margin: "0 auto", fontSize: "0.88rem", maxWidth: "480px" }}>
                The FYP Coordinator is currently forming evaluation panels and scheduling defense slots across departmental venues. You will see your exact presentation date, room, and panelist roster once published.
              </p>
            </div>
          )}

          {defenseSchedule && (
            <div className="fyp-card elevated-hover accent-edge" style={{ padding: "1.35rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem" }}>
                <div>
                  <div style={{ display: "inline-flex", alignItems: "center", gap: "0.45rem", marginBottom: "0.35rem" }}>
                    <span className="fyp-badge primary">
                      6th Semester Defense
                    </span>
                    <span
                      className={`fyp-badge ${defenseSchedule.status === "completed" ? "success" : "warning"}`}
                    >
                      {defenseSchedule.status.toUpperCase()}
                    </span>
                  </div>
                  <h3 style={{ fontSize: "1.25rem", fontWeight: 700, margin: "0.15rem 0" }}>
                    Presentation Logistics &amp; Venue
                  </h3>
                </div>

                <div style={{ textAlign: "right", fontSize: "0.85rem" }}>
                  <div style={{ fontWeight: 700, color: "var(--c-accent)", fontSize: "1rem" }}>
                    📅 {defenseSchedule.defenseDate}
                  </div>
                  <div style={{ color: "var(--c-muted)" }}>
                    ⏰ {defenseSchedule.startTime} – {defenseSchedule.endTime}
                  </div>
                </div>
              </div>

              <div className="fyp-kpi-grid" style={{ margin: "1rem 0" }}>
                <div className="fyp-kpi-tile">
                  <span className="kpi-label">Defense Venue</span>
                  <span className="kpi-value" style={{ fontSize: "1.05rem", display: "inline-flex", alignItems: "center", gap: "0.35rem" }}>
                    <MapPin size={16} color="var(--c-accent)" />
                    {defenseSchedule.venue}
                  </span>
                </div>

                <div className="fyp-kpi-tile">
                  <span className="kpi-label">Assigned Panel</span>
                  <span className="kpi-value" style={{ fontSize: "1.05rem", display: "inline-flex", alignItems: "center", gap: "0.35rem" }}>
                    <Users size={16} color="var(--c-accent)" />
                    {defensePanel ? `${defensePanel.panelCode} (${defensePanel.members.length} Evaluators)` : "Assigned"}
                  </span>
                </div>
              </div>

              {/* Panel Evaluators List */}
              {defensePanel && (
                <div style={{ marginTop: "1rem" }}>
                  <div style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--c-muted)", marginBottom: "0.5rem" }}>
                    Evaluation Committee Members
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "0.75rem" }}>
                    {defensePanel.members.map((member) => (
                      <div
                        key={member.teacherId}
                        className="fyp-card"
                        style={{
                          padding: "0.75rem 1rem",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          borderLeft: member.isChairperson ? "3px solid var(--c-accent)" : undefined,
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 600, fontSize: "0.92rem" }}>
                            {member.isChairperson ? "👑 " : "👤 "} {member.teacherName}
                          </div>
                          <div style={{ fontSize: "0.78rem", color: "var(--c-muted)" }}>
                            {member.designation} • {member.department}
                          </div>
                        </div>
                        {member.isChairperson && (
                          <span className="fyp-badge primary" style={{ fontSize: "0.72rem" }}>
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
            <div className="fyp-card elevated-hover emerald-edge" style={{ padding: "1.35rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem" }}>
                <div>
                  <div style={{ display: "inline-flex", alignItems: "center", gap: "0.45rem", marginBottom: "0.35rem" }}>
                    <span className="fyp-badge success">
                      Official Published Results
                    </span>
                    <span
                      className={`fyp-badge ${
                        defenseResult.consensusRecommendation === "accepted"
                          ? "success"
                          : defenseResult.consensusRecommendation === "accepted_with_minor_changes"
                          ? "primary"
                          : "ruby"
                      }`}
                    >
                      {defenseResult.consensusRecommendation.replace(/_/g, " ").toUpperCase()}
                    </span>
                  </div>
                  <h3 style={{ fontSize: "1.25rem", fontWeight: 700, margin: "0.15rem 0" }}>
                    6th Semester Defense Evaluation Scorecard
                  </h3>
                  <div style={{ fontSize: "0.82rem", color: "var(--c-muted)" }}>
                    Published on {new Date(defenseResult.publishedAt || "").toLocaleDateString()} by {defenseResult.publishedBy}
                  </div>
                </div>

                <div
                  style={{
                    textAlign: "center",
                    padding: "0.75rem 1.5rem",
                    borderRadius: "0.75rem",
                    background: "rgba(16, 185, 129, 0.1)",
                    border: "1px solid rgba(16, 185, 129, 0.3)",
                  }}
                >
                  <div style={{ fontSize: "0.75rem", textTransform: "uppercase", fontWeight: 700, color: "#10b981" }}>
                    Panel Average
                  </div>
                  <div style={{ fontSize: "1.9rem", fontWeight: 800, color: "#10b981", lineHeight: 1.1 }}>
                    {defenseResult.panelAverageScore}
                    <span style={{ fontSize: "0.9rem", fontWeight: 500 }}> / 100</span>
                  </div>
                </div>
              </div>

              {/* Rubric Breakdown */}
              <div style={{ marginTop: "1.25rem" }}>
                <div style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--c-muted)", marginBottom: "0.5rem" }}>
                  Defense Rubric Breakdown
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "0.75rem" }}>
                  {Object.entries(defenseResult.rubricBreakdown).map(([critId, score]) => (
                    <div
                      key={critId}
                      className="fyp-card"
                      style={{ padding: "0.75rem 1rem" }}
                    >
                      <div style={{ fontSize: "0.78rem", color: "var(--c-muted)", textTransform: "capitalize" }}>
                        {critId.replace(/_/g, " ")}
                      </div>
                      <div style={{ fontWeight: 700, fontSize: "1.1rem", marginTop: "0.25rem", color: "var(--c-accent)" }}>
                        {score} pts
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Per-Student Individual Marks */}
              <div style={{ marginTop: "1.25rem" }}>
                <div style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--c-muted)", marginBottom: "0.5rem" }}>
                  Individual Student Performance Marks
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "0.75rem" }}>
                  {defenseResult.studentScores.map((st) => (
                    <div
                      key={st.studentId}
                      className="fyp-card"
                      style={{
                        padding: "0.75rem 1rem",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600, fontSize: "0.92rem" }}>{st.studentName}</div>
                        <div style={{ fontSize: "0.78rem", color: "var(--c-muted)" }}>{st.regNo}</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: "1.15rem", fontWeight: 700, color: "var(--c-accent)" }}>
                          {st.individualMarks} / 15
                        </div>
                        <div style={{ fontSize: "0.72rem", color: "var(--c-muted)" }}>Individual</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Panel Remarks */}
              {defenseResult.panelRemarks.length > 0 && (
                <div style={{ marginTop: "1.25rem" }}>
                  <div style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--c-muted)", marginBottom: "0.5rem" }}>
                    Consolidated Panel Feedback &amp; Directions
                  </div>
                  <div className="stack" style={{ gap: "0.5rem" }}>
                    {defenseResult.panelRemarks.map((remark, idx) => (
                      <div
                        key={idx}
                        className="fyp-card accent-edge"
                        style={{
                          padding: "0.75rem 1rem",
                          fontSize: "0.88rem",
                          lineHeight: 1.5,
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

          {/* Phase 4: Official Final Aggregated Grades (When Published) */}
          {finalGrades.length > 0 && finalGrades.some((g) => g.isPublished) && (
            <div className="fyp-card elevated-hover emerald-edge" style={{ padding: "1.35rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.5rem", marginBottom: "0.75rem" }}>
                <div>
                  <div style={{ display: "inline-flex", alignItems: "center", gap: "0.45rem", marginBottom: "0.35rem" }}>
                    <span className="fyp-badge success">
                      Official Final Marksheet
                    </span>
                    <span className="fyp-badge primary">
                      CUI Exam Department
                    </span>
                  </div>
                  <h3 style={{ fontSize: "1.25rem", fontWeight: 800, margin: "0.15rem 0" }}>
                    Final Year Project Official Marks &amp; GPA
                  </h3>
                  <div style={{ fontSize: "0.82rem", color: "var(--c-muted)" }}>
                    Published by {finalGrades[0]?.publishedBy || "Exam Board"} on {new Date(finalGrades[0]?.publishedAt || "").toLocaleDateString()}
                  </div>
                </div>
              </div>

              <div className="fyp-table-wrapper" style={{ marginTop: "0.5rem" }}>
                <table className="fyp-table">
                  <thead>
                    <tr>
                      <th>Student</th>
                      <th>Reg No</th>
                      <th>Supervisor (30%)</th>
                      <th>Defense (30%)</th>
                      <th>Committee (40%)</th>
                      <th>Total Score</th>
                      <th>Letter Grade</th>
                      <th>GPA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {finalGrades.map((g) => (
                      <tr key={g.studentId}>
                        <td style={{ fontWeight: 600 }}>{g.studentName}</td>
                        <td style={{ color: "var(--c-muted)" }}>{g.regNo}</td>
                        <td>{g.supervisorScore}</td>
                        <td>{g.defenseScore}</td>
                        <td>{g.committeeScore}</td>
                        <td style={{ fontWeight: 800, color: "var(--c-accent)" }}>
                          {g.weightedTotal} / 100
                        </td>
                        <td>
                          <span
                            className={`fyp-badge ${g.letterGrade.startsWith("A") ? "success" : "primary"}`}
                            style={{ fontWeight: 800 }}
                          >
                            {g.letterGrade}
                          </span>
                        </td>
                        <td style={{ fontWeight: 700 }}>{g.gradePoint.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      )}

      {/* =========================================================================
          MODAL 1: SUBMIT MILESTONE (STUDENT)
          ========================================================================= */}
      {submittingMilestone && (
        <div className="fyp-modal-backdrop" onClick={() => setSubmittingMilestone(null)}>
          <div className="fyp-modal-card" style={{ maxWidth: "520px" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
              <div>
                <h3 style={{ fontSize: "1.25rem", fontWeight: 700, margin: 0 }}>Submit Deliverable</h3>
                <p style={{ fontSize: "0.85rem", color: "var(--c-muted)", margin: "0.2rem 0 0" }}>{submittingMilestone.title}</p>
              </div>
              <button type="button" className="fyp-btn secondary" style={{ padding: "4px 8px" }} onClick={() => setSubmittingMilestone(null)}>×</button>
            </div>

            <form onSubmit={handleSubmitMilestone} className="stack" style={{ gap: "1rem" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.4rem" }}>
                  Deliverable File Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. FYP_SRS_Document_v1.pdf"
                  value={submitFileName}
                  onChange={(e) => setSubmitFileName(e.target.value)}
                  className="fyp-input"
                  style={{ width: "100%" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.4rem" }}>
                  Document URL / Cloud Link (Google Drive, OneDrive, GitHub) *
                </label>
                <input
                  type="url"
                  required
                  placeholder="https://drive.google.com/file/... or https://github.com/..."
                  value={submitDocUrl}
                  onChange={(e) => setSubmitDocUrl(e.target.value)}
                  className="fyp-input"
                  style={{ width: "100%" }}
                />
                <span style={{ fontSize: "0.78rem", color: "var(--c-muted)", display: "block", marginTop: "0.3rem" }}>
                  Ensure sharing permissions are open for university evaluators.
                </span>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.4rem" }}>
                  Version Change Summary / Release Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Added section 3.2 for database normalization and revised sequence diagrams."
                  value={submitChangeSummary}
                  onChange={(e) => setSubmitChangeSummary(e.target.value)}
                  className="fyp-input"
                  style={{ width: "100%" }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.6rem" }}>
                <button type="button" className="fyp-btn secondary" onClick={() => setSubmittingMilestone(null)} disabled={isPending}>
                  Cancel
                </button>
                <button type="submit" className="fyp-btn primary" disabled={isPending}>
                  <Upload size={14} />
                  <span>Upload &amp; Run Turnitin Scan</span>
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
        <div className="fyp-modal-backdrop" onClick={() => setReviewingMilestone(null)}>
          <div className="fyp-modal-card" style={{ maxWidth: "520px" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
              <div>
                <h3 style={{ fontSize: "1.25rem", fontWeight: 700, margin: 0 }}>Supervisor Evaluation</h3>
                <p style={{ fontSize: "0.85rem", color: "var(--c-muted)", margin: "0.2rem 0 0" }}>{reviewingMilestone.title}</p>
              </div>
              <button type="button" className="fyp-btn secondary" style={{ padding: "4px 8px" }} onClick={() => setReviewingMilestone(null)}>×</button>
            </div>

            <div className="stack" style={{ gap: "1.25rem" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.4rem" }}>
                  Review Decision
                </label>
                <div style={{ display: "flex", gap: "1rem" }}>
                  <label style={{ display: "inline-flex", alignItems: "center", gap: "0.45rem", cursor: "pointer", fontSize: "0.88rem" }}>
                    <input
                      type="radio"
                      name="decision"
                      checked={reviewDecision === "approved"}
                      onChange={() => setReviewDecision("approved")}
                    />
                    <span>✓ Approve Milestone</span>
                  </label>
                  <label style={{ display: "inline-flex", alignItems: "center", gap: "0.45rem", cursor: "pointer", fontSize: "0.88rem" }}>
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
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.4rem" }}>
                  Supervisor Feedback &amp; Guidance Remarks
                </label>
                <textarea
                  rows={3}
                  placeholder="Provide detailed comments, required corrections, or approval notes for the students..."
                  value={reviewFeedback}
                  onChange={(e) => setReviewFeedback(e.target.value)}
                  className="fyp-input"
                  style={{ width: "100%" }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.6rem" }}>
                <button type="button" className="fyp-btn secondary" onClick={() => setReviewingMilestone(null)} disabled={isPending}>
                  Cancel
                </button>
                <button type="button" className="fyp-btn primary" onClick={handleReviewMilestone} disabled={isPending}>
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
        <div className="fyp-modal-backdrop" onClick={() => setIsMeetingModalOpen(false)}>
          <div className="fyp-modal-card" style={{ maxWidth: "540px" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
              <div>
                <h3 style={{ fontSize: "1.25rem", fontWeight: 700, margin: 0 }}>Log Supervision Meeting Minutes</h3>
                <p style={{ fontSize: "0.85rem", color: "var(--c-muted)", margin: "0.2rem 0 0" }}>{group.title}</p>
              </div>
              <button type="button" className="fyp-btn secondary" style={{ padding: "4px 8px" }} onClick={() => setIsMeetingModalOpen(false)}>×</button>
            </div>

            <form onSubmit={handleCreateMeetingLog} className="stack" style={{ gap: "1rem" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.4rem" }}>
                    Meeting Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={meetingDate}
                    onChange={(e) => setMeetingDate(e.target.value)}
                    className="fyp-input"
                    style={{ width: "100%" }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.4rem" }}>
                    Next Meeting Target Date
                  </label>
                  <input
                    type="date"
                    value={nextMeetingDate}
                    onChange={(e) => setNextMeetingDate(e.target.value)}
                    className="fyp-input"
                    style={{ width: "100%" }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.4rem" }}>
                  Key Discussion Points *
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Outline topics discussed, architecture choices, literature review feedback, etc."
                  value={discussionPoints}
                  onChange={(e) => setDiscussionPoints(e.target.value)}
                  className="fyp-input"
                  style={{ width: "100%" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.4rem" }}>
                  Action Items &amp; Deliverables for Next Sprint *
                </label>
                <textarea
                  rows={2}
                  required
                  placeholder="List specific tasks assigned to team members..."
                  value={actionItems}
                  onChange={(e) => setActionItems(e.target.value)}
                  className="fyp-input"
                  style={{ width: "100%" }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.6rem" }}>
                <button type="button" className="fyp-btn secondary" onClick={() => setIsMeetingModalOpen(false)} disabled={isPending}>
                  Cancel
                </button>
                <button type="submit" className="fyp-btn primary" disabled={isPending}>
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
        <div className="fyp-modal-backdrop" onClick={() => setConfirmingMeeting(null)}>
          <div className="fyp-modal-card" style={{ maxWidth: "480px" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
              <div>
                <h3 style={{ fontSize: "1.25rem", fontWeight: 700, margin: 0 }}>Confirm Meeting Minutes</h3>
                <p style={{ fontSize: "0.85rem", color: "var(--c-muted)", margin: "0.2rem 0 0" }}>Meeting on {confirmingMeeting.meetingDate}</p>
              </div>
              <button type="button" className="fyp-btn secondary" style={{ padding: "4px 8px" }} onClick={() => setConfirmingMeeting(null)}>×</button>
            </div>

            <div className="stack" style={{ gap: "1.25rem" }}>
              <p style={{ fontSize: "0.88rem", color: "var(--c-muted)", margin: 0, lineHeight: 1.5 }}>
                Confirm that this supervision session took place and endorse the recorded action items for the group.
              </p>

              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.4rem" }}>
                  Supervisor Endorsement Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  value={confirmNotes}
                  onChange={(e) => setConfirmNotes(e.target.value)}
                  placeholder="e.g. Minutes confirmed. Ensure API tests are completed before next week."
                  className="fyp-input"
                  style={{ width: "100%" }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.6rem" }}>
                <button type="button" className="fyp-btn secondary" onClick={() => setConfirmingMeeting(null)} disabled={isPending}>
                  Cancel
                </button>
                <button type="button" className="fyp-btn primary" onClick={handleConfirmMeeting} disabled={isPending}>
                  <CheckCircle2 size={14} />
                  <span>Confirm &amp; Endorse</span>
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
        <div className="fyp-modal-backdrop" onClick={() => setIsDocModalOpen(false)}>
          <div className="fyp-modal-card" style={{ maxWidth: "500px" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
              <div>
                <h3 style={{ fontSize: "1.25rem", fontWeight: 700, margin: 0 }}>Add Document or Repository</h3>
                <p style={{ fontSize: "0.85rem", color: "var(--c-muted)", margin: "0.2rem 0 0" }}>{group.title}</p>
              </div>
              <button type="button" className="fyp-btn secondary" style={{ padding: "4px 8px" }} onClick={() => setIsDocModalOpen(false)}>×</button>
            </div>

            <form onSubmit={handleUploadDocument} className="stack" style={{ gap: "1rem" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.4rem" }}>
                  Document Category *
                </label>
                <select
                  value={docCategory}
                  onChange={(e) => setDocCategory(e.target.value as FypDocumentCategory)}
                  className="fyp-input"
                  style={{ width: "100%" }}
                >
                  {FYP_DOCUMENT_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c.replace("_", " ").toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.4rem" }}>
                  Document Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. SRS Final Draft, GitHub Repo, Presentation Slides"
                  value={docTitle}
                  onChange={(e) => setDocTitle(e.target.value)}
                  className="fyp-input"
                  style={{ width: "100%" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.4rem" }}>
                  Resource URL / Link *
                </label>
                <input
                  type="url"
                  required
                  placeholder="https://github.com/... or https://drive.google.com/..."
                  value={docUrl}
                  onChange={(e) => setDocUrl(e.target.value)}
                  className="fyp-input"
                  style={{ width: "100%" }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.6rem" }}>
                <button type="button" className="fyp-btn secondary" onClick={() => setIsDocModalOpen(false)} disabled={isPending}>
                  Cancel
                </button>
                <button type="submit" className="fyp-btn primary" disabled={isPending}>
                  <Upload size={14} />
                  <span>Upload &amp; Run Scan</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
