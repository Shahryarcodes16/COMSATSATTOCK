import { useEffect, useState, useTransition } from "react";
import {
  AlertCircle,
  ArrowLeft,
  Award,
  BookOpen,
  Briefcase,
  CheckCircle2,
  Clock,
  Edit3,
  FileSpreadsheet,
  GraduationCap,
  Layers,
  Lightbulb,
  Plus,
  RefreshCw,
  Send,
  ShieldAlert,
  Sliders,
  Sparkles,
  Tag,
  Trash2,
  UserCheck,
  Users,
  X,
  XCircle,
} from "lucide-react";
import { getActiveFacultySession } from "@/lib/faculty-auth";
import { FypWorkspaceHub } from "./fyp-workspace-hub";
import { FypDefenseDeck } from "./fyp-defense-deck";
import { FypCommitteeDeck } from "./fyp-committee-deck";
import type {
  FypFacultySettings,
  FypGroupRecord,
  FypProposedIdea,
  FypSupervisorRequest,
} from "@/lib/fyp-types";
import { FYP_DOMAINS } from "@/lib/fyp-types";
import {
  getFacultyFypDeckServerFn,
  respondSupervisorRequestServerFn,
  saveFacultyFypSettingsServerFn,
} from "@/lib/fyp-server-fn";

export function FypFacultyDeck() {
  const facultySession = getActiveFacultySession();
  const teacherId = facultySession?.profile?.teacherId ?? null;

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"requests" | "groups" | "defense" | "committee" | "settings">("requests");
  const [pendingRequests, setPendingRequests] = useState<FypSupervisorRequest[]>([]);
  const [acceptedGroups, setAcceptedGroups] = useState<FypGroupRecord[]>([]);
  const [selectedWorkspaceGroup, setSelectedWorkspaceGroup] = useState<FypGroupRecord | null>(null);
  const [settings, setSettings] = useState<FypFacultySettings | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Decline modal state
  const [decliningReq, setDecliningReq] = useState<FypSupervisorRequest | null>(null);
  const [declineReason, setDeclineReason] = useState("");

  // Settings editing state
  const [editMaxSlots, setEditMaxSlots] = useState(5);
  const [editIsAccepting, setEditIsAccepting] = useState(true);
  const [newAreaInput, setNewAreaInput] = useState("");
  const [newIdeaTitle, setNewIdeaTitle] = useState("");
  const [newIdeaDesc, setNewIdeaDesc] = useState("");
  const [isPending, startTransition] = useTransition();

  const loadDeck = async () => {
    if (!teacherId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const res = await getFacultyFypDeckServerFn({ data: { teacherId } });
      setPendingRequests(res.pendingRequests || []);
      setAcceptedGroups(res.acceptedGroups || []);
      setSettings(res.settings || null);
      if (res.settings) {
        setEditMaxSlots(res.settings.maxSlots);
        setEditIsAccepting(res.settings.isAccepting);
      }
    } catch (err: any) {
      console.error("Failed to load faculty FYP deck:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDeck();
  }, [teacherId]);

  if (!teacherId) {
    return (
      <div className="faculty-empty-slate" style={{ padding: "3rem 1.5rem", textAlign: "center" }}>
        <GraduationCap size={48} style={{ opacity: 0.3, margin: "0 auto 1rem" }} />
        <h3 style={{ fontSize: "1.2rem", fontWeight: 700, marginBottom: "0.5rem" }}>
          FYP Supervision Portal
        </h3>
        <p style={{ color: "var(--muted)", maxWidth: "420px", margin: "0 auto" }}>
          Please sign in with a verified faculty account linked to your department to manage FYP quotas and student requests.
        </p>
      </div>
    );
  }

  const handleAccept = async (req: FypSupervisorRequest) => {
    setActionError(null);
    setActionSuccess(null);
    startTransition(async () => {
      try {
        const res = await respondSupervisorRequestServerFn({
          data: {
            requestId: req.id,
            teacherId,
            decision: "accepted",
            remark: "Proposal accepted by supervisor.",
          },
        });
        if (res.success) {
          setActionSuccess(`Accepted group "${req.groupTitle}" for supervision!`);
          await loadDeck();
        } else {
          setActionError(res.error || "Could not accept request.");
        }
      } catch (err: any) {
        setActionError(err.message || "Failed to process acceptance.");
      }
    });
  };

  const handleDeclineConfirm = async () => {
    if (!decliningReq) return;
    setActionError(null);
    setActionSuccess(null);
    startTransition(async () => {
      try {
        const res = await respondSupervisorRequestServerFn({
          data: {
            requestId: decliningReq.id,
            teacherId,
            decision: "declined",
            remark: declineReason.trim() || "Slot capacity reached or domain scope mismatch.",
          },
        });
        if (res.success) {
          setActionSuccess(`Declined request for "${decliningReq.groupTitle}".`);
          setDecliningReq(null);
          setDeclineReason("");
          await loadDeck();
        } else {
          setActionError(res.error || "Could not decline request.");
        }
      } catch (err: any) {
        setActionError(err.message || "Failed to process decline.");
      }
    });
  };

  const handleSaveSettings = async () => {
    if (!settings) return;
    setActionError(null);
    setActionSuccess(null);
    startTransition(async () => {
      try {
        const res = await saveFacultyFypSettingsServerFn({
          data: {
            teacherId,
            maxSlots: editMaxSlots,
            isAccepting: editIsAccepting,
            researchAreas: settings.researchAreas,
            availableIdeas: settings.availableIdeas,
          },
        });
        if (res.success) {
          setActionSuccess("Updated supervision capacity and preferences!");
          setSettings(res.settings);
        }
      } catch (err: any) {
        setActionError(err.message || "Failed to save settings.");
      }
    });
  };

  const handleAddResearchTag = () => {
    if (!newAreaInput.trim() || !settings) return;
    const tag = newAreaInput.trim();
    if (!settings.researchAreas.includes(tag)) {
      const updated = [...settings.researchAreas, tag];
      setSettings({ ...settings, researchAreas: updated });
    }
    setNewAreaInput("");
  };

  const handleRemoveResearchTag = (tag: string) => {
    if (!settings) return;
    const updated = settings.researchAreas.filter((t) => t !== tag);
    setSettings({ ...settings, researchAreas: updated });
  };

  const handleAddIdea = () => {
    if (!newIdeaTitle.trim() || !settings) return;
    const newIdea: FypProposedIdea = {
      id: `idea-${Date.now()}`,
      title: newIdeaTitle.trim(),
      description: newIdeaDesc.trim(),
    };
    const updated = [...settings.availableIdeas, newIdea];
    setSettings({ ...settings, availableIdeas: updated });
    setNewIdeaTitle("");
    setNewIdeaDesc("");
  };

  const handleRemoveIdea = (ideaId: string) => {
    if (!settings) return;
    const updated = settings.availableIdeas.filter((i) => i.id !== ideaId);
    setSettings({ ...settings, availableIdeas: updated });
  };

  const maxSlots = settings?.maxSlots ?? 5;
  const currentSupervised = acceptedGroups.length;
  const remainingSlots = Math.max(0, maxSlots - currentSupervised);
  const quotaPercent = Math.min(100, Math.round((currentSupervised / maxSlots) * 100));

  return (
    <div className="fyp-shell">
      {/* Top Banner & Capacity Meter */}
      <div className="fyp-hero-banner">
        <div className="fyp-hero-header">
          <div>
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "0.35rem" }}>
              <span className="fyp-badge primary">
                <Sparkles size={13} />
                6th &amp; 7th Semester FYP Studio
              </span>
              <span className={`fyp-badge ${settings?.isAccepting ? "success" : "ruby"}`}>
                <span className="fyp-pulse-dot" />
                {settings?.isAccepting ? "Accepting Proposals" : "Quota Filled"}
              </span>
            </div>
            <h1 className="fyp-hero-title">
              Final Year Project (FYP) Faculty Studio
            </h1>
            <p className="fyp-hero-subtitle">
              {settings?.teacherName || "Faculty Member"} • {settings?.department || "Department of Computer Science"} • COMSATS University Islamabad (Attock Campus)
            </p>
          </div>

          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <button
              type="button"
              className="fyp-btn secondary"
              onClick={loadDeck}
              disabled={loading}
              title="Refresh FYP deck"
            >
              <RefreshCw size={15} className={loading ? "spin" : ""} />
              <span>Sync</span>
            </button>
            <button
              type="button"
              className={`fyp-btn ${activeTab === "settings" ? "primary" : "secondary"}`}
              onClick={() => setActiveTab(activeTab === "settings" ? "requests" : "settings")}
            >
              <Sliders size={15} />
              <span>Configure Capacity</span>
            </button>
          </div>
        </div>

        {/* Quota Meter */}
        <div style={{ marginTop: "1.25rem", paddingTop: "1rem", borderTop: "1px solid color-mix(in srgb, var(--c-accent) 20%, var(--c-line))" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.88rem", fontWeight: 700, marginBottom: "0.45rem" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", color: "var(--c-ink)" }}>
              <Users size={16} color="var(--c-accent)" />
              Supervision Cohort Capacity
            </span>
            <span style={{ color: "var(--c-muted)", fontSize: "0.85rem" }}>
              <strong style={{ color: "var(--c-ink)" }}>{currentSupervised}</strong> of <strong style={{ color: "var(--c-ink)" }}>{maxSlots}</strong> slots allocated ({remainingSlots} remaining)
            </span>
          </div>
          <div className="fyp-progress-track">
            <div
              className={`fyp-progress-fill ${quotaPercent >= 100 ? "ruby" : quotaPercent > 60 ? "amber" : "emerald"}`}
              style={{ width: `${quotaPercent}%` }}
            />
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
          className={`fyp-tab-btn ${activeTab === "requests" ? "active" : ""}`}
          onClick={() => setActiveTab("requests")}
        >
          <Clock size={16} />
          <span>Incoming Requests</span>
          {pendingRequests.length > 0 && <span className="tab-count">{pendingRequests.length}</span>}
        </button>

        <button
          type="button"
          className={`fyp-tab-btn ${activeTab === "groups" ? "active" : ""}`}
          onClick={() => setActiveTab("groups")}
        >
          <GraduationCap size={16} />
          <span>Supervised Groups</span>
          <span className="tab-count">{acceptedGroups.length}</span>
        </button>

        <button
          type="button"
          className={`fyp-tab-btn ${activeTab === "defense" ? "active" : ""}`}
          onClick={() => setActiveTab("defense")}
        >
          <Award size={16} />
          <span>Defense Panels</span>
        </button>

        <button
          type="button"
          className={`fyp-tab-btn ${activeTab === "committee" ? "active" : ""}`}
          onClick={() => setActiveTab("committee")}
        >
          <FileSpreadsheet size={16} />
          <span>7th Sem Committee</span>
        </button>

        <button
          type="button"
          className={`fyp-tab-btn ${activeTab === "settings" ? "active" : ""}`}
          onClick={() => setActiveTab("settings")}
        >
          <Sliders size={16} />
          <span>Settings &amp; Quotas</span>
        </button>
      </div>

      {/* TAB 1: INCOMING REQUESTS */}
      {activeTab === "requests" && (
        <section className="stack" style={{ gap: "1rem" }}>
          {pendingRequests.length === 0 ? (
            <div className="fyp-card" style={{ padding: "3.5rem 1.5rem", textAlign: "center" }}>
              <Sparkles size={38} style={{ opacity: 0.35, margin: "0 auto 0.75rem", color: "var(--c-accent)" }} />
              <h4 style={{ margin: "0 0 0.25rem", fontWeight: 700, fontSize: "1.1rem" }}>No Pending Requests</h4>
              <p style={{ color: "var(--c-muted)", margin: 0, fontSize: "0.88rem", maxWidth: "420px", marginLeft: "auto", marginRight: "auto" }}>
                Student groups requesting you as their FYP supervisor will appear here with preference rankings and team credentials.
              </p>
            </div>
          ) : (
            pendingRequests.map((req) => (
              <div
                key={req.id}
                className="fyp-card elevated-hover accent-edge"
                style={{ padding: "1.35rem" }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.75rem", flexWrap: "wrap" }}>
                  <div>
                    <div style={{ display: "inline-flex", gap: "0.45rem", alignItems: "center", marginBottom: "0.35rem" }}>
                      <span className="fyp-badge primary">
                        {req.groupDomain}
                      </span>
                      <span className="fyp-badge warning">
                        Choice #{req.preferenceOrder} Priority
                      </span>
                    </div>
                    <h3 style={{ fontSize: "1.2rem", fontWeight: 700, margin: "0.15rem 0 0.35rem" }}>
                      {req.groupTitle}
                    </h3>
                  </div>

                  <span style={{ fontSize: "0.8rem", color: "var(--c-muted)", whiteSpace: "nowrap" }}>
                    Received {new Date(req.createdAt).toLocaleDateString()}
                  </span>
                </div>

                <div className="fyp-kpi-grid" style={{ margin: "0.75rem 0" }}>
                  <div className="fyp-kpi-tile">
                    <span className="kpi-label">Team Leader</span>
                    <span className="kpi-value" style={{ fontSize: "0.98rem" }}>{req.leaderName}</span>
                    <span style={{ fontSize: "0.78rem", color: "var(--c-muted)" }}>{req.leaderRegNo}</span>
                  </div>
                  <div className="fyp-kpi-tile">
                    <span className="kpi-label">Contact Email</span>
                    <span className="kpi-value" style={{ fontSize: "0.92rem", wordBreak: "break-all" }}>{req.leaderEmail}</span>
                  </div>
                  <div className="fyp-kpi-tile">
                    <span className="kpi-label">Cohort Size</span>
                    <span className="kpi-value" style={{ fontSize: "1.1rem" }}>{req.memberCount} Students</span>
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.6rem", marginTop: "0.25rem" }}>
                  <button
                    type="button"
                    className="fyp-btn secondary"
                    onClick={() => {
                      setDecliningReq(req);
                      setDeclineReason("");
                    }}
                    disabled={isPending}
                    style={{ color: "#ef4444" }}
                  >
                    <XCircle size={15} />
                    <span>Decline Request</span>
                  </button>
                  <button
                    type="button"
                    className="fyp-btn primary"
                    onClick={() => handleAccept(req)}
                    disabled={isPending || remainingSlots <= 0}
                    title={remainingSlots <= 0 ? "Supervision quota reached" : "Accept Group"}
                  >
                    <CheckCircle2 size={15} />
                    <span>{remainingSlots <= 0 ? "Quota Full" : "Accept Group"}</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </section>
      )}

      {/* TAB 2: ACTIVE SUPERVISED GROUPS */}
      {activeTab === "groups" && (
        <section className="stack" style={{ gap: "1rem" }}>
          {selectedWorkspaceGroup ? (
            <div className="stack" style={{ gap: "1rem" }}>
              <button
                type="button"
                className="fyp-btn secondary"
                onClick={() => setSelectedWorkspaceGroup(null)}
                style={{ alignSelf: "flex-start" }}
              >
                <ArrowLeft size={15} />
                <span>Back to Supervised Cohort</span>
              </button>

              <FypWorkspaceHub
                group={selectedWorkspaceGroup}
                role="supervisor"
                currentUserName={settings?.teacherName || "Supervisor"}
                supervisorId={teacherId}
                onRefreshGroup={loadDeck}
              />
            </div>
          ) : acceptedGroups.length === 0 ? (
            <div className="fyp-card" style={{ padding: "3.5rem 1.5rem", textAlign: "center" }}>
              <Users size={38} style={{ opacity: 0.35, margin: "0 auto 0.75rem", color: "var(--c-accent)" }} />
              <h4 style={{ margin: "0 0 0.25rem", fontWeight: 700, fontSize: "1.1rem" }}>No Active Supervised Groups</h4>
              <p style={{ color: "var(--c-muted)", margin: 0, fontSize: "0.88rem", maxWidth: "420px", marginLeft: "auto", marginRight: "auto" }}>
                Once you accept student proposals, they will appear here along with their milestone progress, sprints, and meeting minutes.
              </p>
            </div>
          ) : (
            acceptedGroups.map((group) => (
              <div
                key={group.id}
                className="fyp-card elevated-hover emerald-edge"
                style={{ padding: "1.35rem" }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.75rem", flexWrap: "wrap" }}>
                  <div>
                    <div style={{ display: "inline-flex", gap: "0.45rem", alignItems: "center", marginBottom: "0.35rem" }}>
                      <span className="fyp-badge success">
                        ✓ Supervised Group
                      </span>
                      <span className="fyp-badge neutral">
                        {group.domain}
                      </span>
                    </div>
                    <h3 style={{ fontSize: "1.2rem", fontWeight: 700, margin: "0.15rem 0 0.35rem" }}>
                      {group.title}
                    </h3>
                  </div>

                  <button
                    type="button"
                    className="fyp-btn primary"
                    onClick={() => setSelectedWorkspaceGroup(group)}
                  >
                    <BookOpen size={15} />
                    <span>Open Supervision Workspace</span>
                  </button>
                </div>

                <p style={{ fontSize: "0.88rem", color: "var(--c-muted)", margin: "0.45rem 0 0.85rem", lineHeight: 1.55 }}>
                  {group.abstract}
                </p>

                {/* Team Roster */}
                <div style={{ borderTop: "1px solid var(--c-line)", paddingTop: "0.75rem" }}>
                  <div style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--c-muted)", marginBottom: "0.45rem" }}>
                    Project Team Roster
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
            ))
          )}
        </section>
      )}

      {/* TAB 3: SETTINGS, CAPACITY & RESEARCH TAGS */}
      {activeTab === "settings" && settings && (
        <section className="stack" style={{ gap: "1.25rem" }}>
          {/* Capacity Settings */}
          <div className="fyp-card" style={{ padding: "1.35rem" }}>
            <h3 style={{ fontSize: "1.15rem", fontWeight: 700, marginBottom: "0.75rem" }}>
              Supervision Quotas &amp; Availability
            </h3>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "1.25rem" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.4rem" }}>
                  Maximum Supervision Slots
                </label>
                <input
                  type="number"
                  min={1}
                  max={15}
                  value={editMaxSlots}
                  onChange={(e) => setEditMaxSlots(parseInt(e.target.value, 10) || 5)}
                  className="fyp-input"
                  style={{ width: "100%" }}
                />
                <span style={{ fontSize: "0.78rem", color: "var(--c-muted)", display: "block", marginTop: "0.3rem" }}>
                  University standard is 5 groups per faculty member (limit 1 - 15).
                </span>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.4rem" }}>
                  Accepting New Student Proposals
                </label>
                <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.5rem" }}>
                  <label style={{ display: "inline-flex", alignItems: "center", gap: "0.45rem", cursor: "pointer", fontSize: "0.88rem" }}>
                    <input
                      type="radio"
                      name="isAccepting"
                      checked={editIsAccepting}
                      onChange={() => setEditIsAccepting(true)}
                    />
                    <span>Open for Requests</span>
                  </label>
                  <label style={{ display: "inline-flex", alignItems: "center", gap: "0.45rem", cursor: "pointer", fontSize: "0.88rem" }}>
                    <input
                      type="radio"
                      name="isAccepting"
                      checked={!editIsAccepting}
                      onChange={() => setEditIsAccepting(false)}
                    />
                    <span>Pause Incoming</span>
                  </label>
                </div>
              </div>
            </div>

            <div style={{ marginTop: "1.25rem", display: "flex", justifyContent: "flex-end" }}>
              <button
                type="button"
                className="fyp-btn primary"
                onClick={handleSaveSettings}
                disabled={isPending}
              >
                <CheckCircle2 size={15} />
                <span>Save Quotas</span>
              </button>
            </div>
          </div>

          {/* Research Areas / Specializations */}
          <div className="fyp-card" style={{ padding: "1.35rem" }}>
            <h3 style={{ fontSize: "1.15rem", fontWeight: 700, marginBottom: "0.35rem" }}>
              Research Areas &amp; Specializations
            </h3>
            <p style={{ fontSize: "0.85rem", color: "var(--c-muted)", marginBottom: "1rem" }}>
              These research tags help 6th-semester students find your profile when matching their project proposal ideas.
            </p>

            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "1rem" }}>
              {settings.researchAreas.map((area) => (
                <span
                  key={area}
                  className="fyp-badge primary"
                  style={{ padding: "6px 10px", fontSize: "0.85rem" }}
                >
                  <Tag size={13} />
                  <span>{area}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveResearchTag(area)}
                    style={{ background: "transparent", border: "none", cursor: "pointer", padding: 0, color: "inherit", display: "inline-flex" }}
                  >
                    <X size={13} />
                  </button>
                </span>
              ))}
            </div>

            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              <input
                type="text"
                placeholder="Add research topic (e.g. Deep Reinforcement Learning, Web3, Bioinformatics)"
                value={newAreaInput}
                onChange={(e) => setNewAreaInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddResearchTag();
                  }
                }}
                className="fyp-input"
                style={{ flex: 1, minWidth: "220px" }}
              />
              <button type="button" className="fyp-btn secondary" onClick={handleAddResearchTag}>
                <Plus size={15} />
                <span>Add Tag</span>
              </button>
            </div>
          </div>

          {/* Available Proposed Project Ideas */}
          <div className="fyp-card" style={{ padding: "1.35rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
              <div>
                <h3 style={{ fontSize: "1.15rem", fontWeight: 700, margin: 0 }}>
                  Available Project Ideas for Students
                </h3>
                <p style={{ fontSize: "0.85rem", color: "var(--c-muted)", margin: "0.25rem 0 0" }}>
                  Publish curated problem statements so students who need an idea can apply directly to yours.
                </p>
              </div>
            </div>

            <div className="stack" style={{ gap: "0.75rem", margin: "1rem 0" }}>
              {settings.availableIdeas.length === 0 ? (
                <div style={{ fontSize: "0.85rem", color: "var(--c-muted)", fontStyle: "italic" }}>
                  No custom project ideas added yet.
                </div>
              ) : (
                settings.availableIdeas.map((idea) => (
                  <div
                    key={idea.id}
                    className="fyp-card"
                    style={{
                      padding: "0.85rem 1rem",
                      display: "flex",
                      justifyContent: "space-between",
                      gap: "0.5rem",
                      alignItems: "flex-start",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: "0.95rem", display: "inline-flex", alignItems: "center", gap: "0.4rem" }}>
                        <Lightbulb size={16} color="var(--c-brass, #f59e0b)" />
                        {idea.title}
                      </div>
                      {idea.description && (
                        <p style={{ fontSize: "0.85rem", color: "var(--c-muted)", margin: "0.3rem 0 0", lineHeight: 1.5 }}>
                          {idea.description}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      className="fyp-btn secondary"
                      onClick={() => handleRemoveIdea(idea.id)}
                      style={{ padding: "6px", color: "#ef4444" }}
                      title="Remove idea"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Add Idea Input */}
            <div style={{ background: "color-mix(in srgb, var(--c-canvas) 60%, var(--c-paper))", padding: "1rem", borderRadius: "0.75rem", border: "1px dashed var(--c-line)" }}>
              <div style={{ fontWeight: 600, fontSize: "0.88rem", marginBottom: "0.5rem" }}>
                Add New Project Proposal Idea
              </div>
              <input
                type="text"
                placeholder="Project Idea Title..."
                value={newIdeaTitle}
                onChange={(e) => setNewIdeaTitle(e.target.value)}
                className="fyp-input"
                style={{ width: "100%", marginBottom: "0.5rem" }}
              />
              <textarea
                placeholder="Brief description or requirements for students..."
                value={newIdeaDesc}
                onChange={(e) => setNewIdeaDesc(e.target.value)}
                rows={2}
                className="fyp-input"
                style={{ width: "100%", marginBottom: "0.5rem" }}
              />
              <button
                type="button"
                className="fyp-btn secondary"
                onClick={handleAddIdea}
                disabled={!newIdeaTitle.trim()}
              >
                <Plus size={15} />
                <span>Add Idea to Public Profile</span>
              </button>
            </div>
          </div>
        </section>
      )}

      {/* TAB 4: DEFENSE PANELS & EVALUATIONS */}
      {activeTab === "defense" && (
        <FypDefenseDeck
          teacherId={teacherId}
          teacherName={settings?.teacherName || "Faculty Member"}
        />
      )}

      {/* TAB 5: 7TH SEM COMMITTEE & MARKS AGGREGATION */}
      {activeTab === "committee" && (
        <FypCommitteeDeck
          teacherId={teacherId}
          teacherName={settings?.teacherName || "Faculty Member"}
        />
      )}

      {/* Decline Reason Modal */}
      {decliningReq && (
        <div className="fyp-modal-backdrop">
          <div className="fyp-modal-card">
            <h3 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: "0.5rem" }}>
              Decline Supervision Request
            </h3>
            <p style={{ fontSize: "0.88rem", color: "var(--c-muted)", marginBottom: "1rem" }}>
              Please provide feedback or a reason to <strong>{decliningReq.leaderName}</strong> for why their proposal &ldquo;{decliningReq.groupTitle}&rdquo; cannot be accommodated:
            </p>

            <textarea
              rows={3}
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              placeholder="e.g. Quota capacity filled for this semester, or proposal domain does not align with my research lab."
              className="fyp-input"
              style={{ width: "100%", marginBottom: "1.25rem" }}
            />

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.6rem" }}>
              <button
                type="button"
                className="fyp-btn secondary"
                onClick={() => setDecliningReq(null)}
                disabled={isPending}
              >
                Cancel
              </button>
              <button
                type="button"
                className="fyp-btn danger"
                onClick={handleDeclineConfirm}
                disabled={isPending}
              >
                Confirm Decline
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
