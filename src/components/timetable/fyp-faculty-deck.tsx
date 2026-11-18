import { useEffect, useState, useTransition } from "react";
import {
  AlertCircle,
  ArrowLeft,
  BookOpen,
  Briefcase,
  CheckCircle2,
  Clock,
  Edit3,
  GraduationCap,
  Layers,
  Lightbulb,
  Plus,
  RefreshCw,
  Send,
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
  const [activeTab, setActiveTab] = useState<"requests" | "groups" | "settings">("requests");
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
    <div className="fyp-faculty-deck stack" style={{ gap: "1.5rem" }}>
      {/* Top Banner & Capacity Meter */}
      <div
        className="faculty-day-summary-card"
        style={{
          background: "linear-gradient(135deg, rgba(99, 102, 241, 0.08), rgba(168, 85, 247, 0.04))",
          borderColor: "rgba(99, 102, 241, 0.25)",
        }}
      >
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: "1rem", alignItems: "flex-start" }}>
          <div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
              <span className="badge" style={{ background: "rgba(99, 102, 241, 0.15)", color: "var(--accent)" }}>
                6th Semester Supervisor Allocation
              </span>
              <span className="badge" style={{ background: settings?.isAccepting ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)", color: settings?.isAccepting ? "#10b981" : "#ef4444" }}>
                {settings?.isAccepting ? "● Accepting Requests" : "○ Requests Paused"}
              </span>
            </div>
            <h2 style={{ fontSize: "1.4rem", fontWeight: 800, margin: "0.25rem 0" }}>
              Final Year Project (FYP) Studio
            </h2>
            <p style={{ color: "var(--muted)", fontSize: "0.9rem", margin: 0 }}>
              {settings?.teacherName || "Faculty Member"} • {settings?.department || "Department of Computer Science"}
            </p>
          </div>

          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              type="button"
              className="btn secondary tap"
              onClick={loadDeck}
              disabled={loading}
              title="Refresh FYP deck"
            >
              <RefreshCw size={15} className={loading ? "spin" : ""} />
            </button>
            <button
              type="button"
              className={`btn tap ${activeTab === "settings" ? "primary" : "secondary"}`}
              onClick={() => setActiveTab(activeTab === "settings" ? "requests" : "settings")}
            >
              <Sliders size={15} />
              <span>Configure Quotas & Ideas</span>
            </button>
          </div>
        </div>

        {/* Quota Meter */}
        <div style={{ marginTop: "1.25rem", paddingTop: "1rem", borderTop: "1px solid var(--border)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.88rem", fontWeight: 600, marginBottom: "0.4rem" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}>
              <Users size={15} color="var(--accent)" />
              Supervision Capacity
            </span>
            <span>
              <strong>{currentSupervised}</strong> of <strong>{maxSlots}</strong> slots filled ({remainingSlots} remaining)
            </span>
          </div>
          <div
            style={{
              height: "8px",
              width: "100%",
              backgroundColor: "var(--border)",
              borderRadius: "4px",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${quotaPercent}%`,
                backgroundColor: quotaPercent >= 100 ? "#ef4444" : quotaPercent > 60 ? "#f59e0b" : "var(--accent)",
                transition: "width 0.4s ease",
              }}
            />
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

      {/* Tab Selectors */}
      <div style={{ display: "flex", gap: "0.5rem", borderBottom: "1px solid var(--border)", paddingBottom: "0.5rem" }}>
        <button
          type="button"
          className={`faculty-tab-pill ${activeTab === "requests" ? "active" : ""}`}
          onClick={() => setActiveTab("requests")}
          style={{ display: "inline-flex", alignItems: "center", gap: "0.45rem" }}
        >
          <Clock size={16} />
          <span>Incoming Requests</span>
          {pendingRequests.length > 0 && (
            <span
              style={{
                background: "var(--accent)",
                color: "#fff",
                fontSize: "0.75rem",
                padding: "1px 6px",
                borderRadius: "10px",
                fontWeight: 700,
              }}
            >
              {pendingRequests.length}
            </span>
          )}
        </button>

        <button
          type="button"
          className={`faculty-tab-pill ${activeTab === "groups" ? "active" : ""}`}
          onClick={() => setActiveTab("groups")}
          style={{ display: "inline-flex", alignItems: "center", gap: "0.45rem" }}
        >
          <GraduationCap size={16} />
          <span>Active Supervised Groups</span>
          <span
            style={{
              background: "rgba(16, 185, 129, 0.2)",
              color: "#10b981",
              fontSize: "0.75rem",
              padding: "1px 6px",
              borderRadius: "10px",
              fontWeight: 700,
            }}
          >
            {acceptedGroups.length}
          </span>
        </button>

        <button
          type="button"
          className={`faculty-tab-pill ${activeTab === "settings" ? "active" : ""}`}
          onClick={() => setActiveTab("settings")}
          style={{ display: "inline-flex", alignItems: "center", gap: "0.45rem" }}
        >
          <Sliders size={16} />
          <span>Capacity & Research Tags</span>
        </button>
      </div>

      {/* TAB 1: INCOMING REQUESTS */}
      {activeTab === "requests" && (
        <section className="stack" style={{ gap: "1rem" }}>
          {pendingRequests.length === 0 ? (
            <div className="faculty-empty-slate" style={{ padding: "3rem 1.5rem", textAlign: "center" }}>
              <Sparkles size={36} style={{ opacity: 0.3, margin: "0 auto 0.75rem" }} />
              <h4 style={{ margin: "0 0 0.25rem", fontWeight: 700 }}>No Pending Requests</h4>
              <p style={{ color: "var(--muted)", margin: 0, fontSize: "0.88rem" }}>
                Student groups requesting you as their FYP supervisor will appear here.
              </p>
            </div>
          ) : (
            pendingRequests.map((req) => (
              <div
                key={req.id}
                className="card"
                style={{
                  padding: "1.25rem",
                  borderLeft: "4px solid var(--accent)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.75rem",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.5rem" }}>
                  <div>
                    <div style={{ display: "inline-flex", gap: "0.4rem", alignItems: "center", marginBottom: "0.25rem" }}>
                      <span className="badge" style={{ background: "rgba(99, 102, 241, 0.15)", color: "var(--accent)" }}>
                        {req.groupDomain}
                      </span>
                      <span className="badge" style={{ background: "rgba(245, 158, 11, 0.15)", color: "#d97706" }}>
                        Choice #{req.preferenceOrder}
                      </span>
                    </div>
                    <h3 style={{ fontSize: "1.15rem", fontWeight: 700, margin: "0.2rem 0" }}>
                      {req.groupTitle}
                    </h3>
                  </div>

                  <span style={{ fontSize: "0.78rem", color: "var(--muted)", whiteSpace: "nowrap" }}>
                    {new Date(req.createdAt).toLocaleDateString()}
                  </span>
                </div>

                <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem", fontSize: "0.85rem", color: "var(--muted)" }}>
                  <div>
                    <strong>Team Leader:</strong> {req.leaderName} ({req.leaderRegNo})
                  </div>
                  <div>
                    <strong>Contact:</strong> {req.leaderEmail}
                  </div>
                  <div>
                    <strong>Team Size:</strong> {req.memberCount} Students
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "0.5rem" }}>
                  <button
                    type="button"
                    className="btn secondary tap"
                    onClick={() => {
                      setDecliningReq(req);
                      setDeclineReason("");
                    }}
                    disabled={isPending}
                    style={{ color: "#ef4444" }}
                  >
                    <XCircle size={15} />
                    <span>Decline</span>
                  </button>
                  <button
                    type="button"
                    className="btn primary tap"
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
                className="btn secondary tap"
                onClick={() => setSelectedWorkspaceGroup(null)}
                style={{ alignSelf: "flex-start", display: "inline-flex", alignItems: "center", gap: "0.4rem" }}
              >
                <ArrowLeft size={15} />
                <span>Back to Supervised Groups List</span>
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
            <div className="faculty-empty-slate" style={{ padding: "3rem 1.5rem", textAlign: "center" }}>
              <Users size={36} style={{ opacity: 0.3, margin: "0 auto 0.75rem" }} />
              <h4 style={{ margin: "0 0 0.25rem", fontWeight: 700 }}>No Active Supervised Groups</h4>
              <p style={{ color: "var(--muted)", margin: 0, fontSize: "0.88rem" }}>
                Once you accept student proposals, they will appear here along with their milestone progress and meeting minutes.
              </p>
            </div>
          ) : (
            acceptedGroups.map((group) => (
              <div
                key={group.id}
                className="card"
                style={{
                  padding: "1.25rem",
                  borderLeft: "4px solid #10b981",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.75rem",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.5rem", flexWrap: "wrap" }}>
                  <div>
                    <div style={{ display: "inline-flex", gap: "0.4rem", alignItems: "center", marginBottom: "0.25rem" }}>
                      <span className="badge" style={{ background: "rgba(16, 185, 129, 0.15)", color: "#10b981" }}>
                        ✓ Supervised
                      </span>
                      <span className="badge" style={{ background: "rgba(99, 102, 241, 0.1)", color: "var(--accent)" }}>
                        {group.domain}
                      </span>
                    </div>
                    <h3 style={{ fontSize: "1.15rem", fontWeight: 700, margin: "0.2rem 0" }}>
                      {group.title}
                    </h3>
                  </div>

                  <button
                    type="button"
                    className="btn primary tap"
                    onClick={() => setSelectedWorkspaceGroup(group)}
                    style={{ fontSize: "0.85rem", padding: "6px 12px", display: "inline-flex", alignItems: "center", gap: "0.4rem" }}
                  >
                    <BookOpen size={14} />
                    <span>Open Supervision Workspace</span>
                  </button>
                </div>

                <p style={{ fontSize: "0.88rem", color: "var(--muted)", margin: "0.25rem 0", lineHeight: 1.5 }}>
                  {group.abstract}
                </p>

                {/* Team Roster */}
                <div style={{ background: "var(--surface)", padding: "0.75rem", borderRadius: "6px" }}>
                  <div style={{ fontSize: "0.78rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--muted)", marginBottom: "0.4rem" }}>
                    Project Team
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
            ))
          )}
        </section>
      )}

      {/* TAB 3: SETTINGS, CAPACITY & RESEARCH TAGS */}
      {activeTab === "settings" && settings && (
        <section className="stack" style={{ gap: "1.5rem" }}>
          {/* Capacity Settings */}
          <div className="card" style={{ padding: "1.25rem" }}>
            <h3 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "0.75rem" }}>
              Supervision Quotas & Availability
            </h3>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "1rem" }}>
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
                  className="input"
                  style={{ width: "100%", padding: "0.5rem" }}
                />
                <span style={{ fontSize: "0.78rem", color: "var(--muted)", display: "block", marginTop: "0.25rem" }}>
                  Default is 5 groups as per university policy (range 1 - 15).
                </span>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.4rem" }}>
                  Accepting New Student Proposals
                </label>
                <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.5rem" }}>
                  <label style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", cursor: "pointer" }}>
                    <input
                      type="radio"
                      name="isAccepting"
                      checked={editIsAccepting}
                      onChange={() => setEditIsAccepting(true)}
                    />
                    <span>Yes, Open for Requests</span>
                  </label>
                  <label style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", cursor: "pointer" }}>
                    <input
                      type="radio"
                      name="isAccepting"
                      checked={!editIsAccepting}
                      onChange={() => setEditIsAccepting(false)}
                    />
                    <span>No, Pause Incoming</span>
                  </label>
                </div>
              </div>
            </div>

            <div style={{ marginTop: "1rem", display: "flex", justifyContent: "flex-end" }}>
              <button
                type="button"
                className="btn primary tap"
                onClick={handleSaveSettings}
                disabled={isPending}
              >
                <CheckCircle2 size={15} />
                <span>Save Quotas</span>
              </button>
            </div>
          </div>

          {/* Research Areas / Specializations */}
          <div className="card" style={{ padding: "1.25rem" }}>
            <h3 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "0.5rem" }}>
              Research Areas & Domains
            </h3>
            <p style={{ fontSize: "0.85rem", color: "var(--muted)", marginBottom: "1rem" }}>
              These research tags help 6th-semester students find your profile when matching their project proposal ideas.
            </p>

            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "1rem" }}>
              {settings.researchAreas.map((area) => (
                <span
                  key={area}
                  className="badge"
                  style={{
                    padding: "6px 10px",
                    background: "rgba(99, 102, 241, 0.12)",
                    color: "var(--accent)",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.4rem",
                    fontSize: "0.85rem",
                  }}
                >
                  <Tag size={13} />
                  <span>{area}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveResearchTag(area)}
                    style={{ background: "transparent", border: "none", cursor: "pointer", padding: 0 }}
                  >
                    <X size={13} />
                  </button>
                </span>
              ))}
            </div>

            <div style={{ display: "flex", gap: "0.5rem" }}>
              <input
                type="text"
                placeholder="Add research topic (e.g. Deep Reinforcement Learning, Blockchain)"
                value={newAreaInput}
                onChange={(e) => setNewAreaInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddResearchTag();
                  }
                }}
                className="input"
                style={{ flex: 1, padding: "0.5rem" }}
              />
              <button type="button" className="btn secondary tap" onClick={handleAddResearchTag}>
                <Plus size={15} />
                <span>Add Tag</span>
              </button>
            </div>
          </div>

          {/* Available Proposed Project Ideas */}
          <div className="card" style={{ padding: "1.25rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
              <div>
                <h3 style={{ fontSize: "1.1rem", fontWeight: 700, margin: 0 }}>
                  Available Project Ideas for Students
                </h3>
                <p style={{ fontSize: "0.85rem", color: "var(--muted)", margin: "0.25rem 0 0" }}>
                  Publish curated problem statements so students who need an idea can apply directly to yours.
                </p>
              </div>
            </div>

            <div className="stack" style={{ gap: "0.75rem", margin: "1rem 0" }}>
              {settings.availableIdeas.length === 0 ? (
                <div style={{ fontSize: "0.85rem", color: "var(--muted)", fontStyle: "italic" }}>
                  No custom project ideas added yet.
                </div>
              ) : (
                settings.availableIdeas.map((idea) => (
                  <div
                    key={idea.id}
                    style={{
                      padding: "0.75rem",
                      borderRadius: "6px",
                      background: "var(--surface)",
                      border: "1px solid var(--border)",
                      display: "flex",
                      justifyContent: "space-between",
                      gap: "0.5rem",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: "0.92rem", display: "inline-flex", alignItems: "center", gap: "0.35rem" }}>
                        <Lightbulb size={15} color="#f59e0b" />
                        {idea.title}
                      </div>
                      {idea.description && (
                        <p style={{ fontSize: "0.83rem", color: "var(--muted)", margin: "0.25rem 0 0" }}>
                          {idea.description}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      className="btn secondary tap"
                      onClick={() => handleRemoveIdea(idea.id)}
                      style={{ height: "30px", width: "30px", padding: 0, color: "#ef4444" }}
                      title="Remove idea"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Add Idea Input */}
            <div style={{ background: "var(--surface)", padding: "1rem", borderRadius: "8px", border: "1px dashed var(--border)" }}>
              <div style={{ fontWeight: 600, fontSize: "0.88rem", marginBottom: "0.5rem" }}>
                Add New Project Proposal Idea
              </div>
              <input
                type="text"
                placeholder="Project Idea Title..."
                value={newIdeaTitle}
                onChange={(e) => setNewIdeaTitle(e.target.value)}
                className="input"
                style={{ width: "100%", padding: "0.5rem", marginBottom: "0.5rem" }}
              />
              <textarea
                placeholder="Brief description or requirements for students..."
                value={newIdeaDesc}
                onChange={(e) => setNewIdeaDesc(e.target.value)}
                rows={2}
                className="input"
                style={{ width: "100%", padding: "0.5rem", marginBottom: "0.5rem" }}
              />
              <button
                type="button"
                className="btn secondary tap"
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

      {/* Decline Reason Modal */}
      {decliningReq && (
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
              Decline Supervision Request
            </h3>
            <p style={{ fontSize: "0.88rem", color: "var(--muted)", marginBottom: "1rem" }}>
              Please provide feedback or a reason to <strong>{decliningReq.leaderName}</strong> for why their proposal &ldquo;{decliningReq.groupTitle}&rdquo; cannot be accommodated:
            </p>

            <textarea
              rows={3}
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              placeholder="e.g. Quota capacity filled for this semester, or proposal domain does not align with my research lab."
              className="input"
              style={{ width: "100%", padding: "0.6rem", marginBottom: "1rem" }}
            />

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
              <button
                type="button"
                className="btn secondary tap"
                onClick={() => setDecliningReq(null)}
                disabled={isPending}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn tap"
                style={{ background: "#ef4444", color: "#fff" }}
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
