import { useState, useEffect } from "react";
import {
  GraduationCap,
  LogOut,
  Bell,
  Sparkles,
  CheckCircle2,
  Calendar,
  Building,
  X,
} from "lucide-react";
import {
  getActiveFacultySession,
  clearFacultySession,
  type FacultySession,
} from "@/lib/faculty-auth";
import { useDesk } from "@/components/timetable/context";
import { facultyUpdateLeadTimeFn } from "@/lib/faculty-server-fn";

export function FacultyAuthButton({ showLabel = false }: { showLabel?: boolean }) {
  const { setView, view } = useDesk();
  const [facultySession, setFacultySession] = useState<FacultySession | null>(
    () => getActiveFacultySession(),
  );
  const [showModal, setShowModal] = useState(false);
  const [leadMins, setLeadMins] = useState(facultySession?.profile?.notificationLeadMins || 10);
  const [savingLead, setSavingLead] = useState(false);

  useEffect(() => {
    const handleUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<FacultySession | null>;
      setFacultySession(customEvent.detail ?? getActiveFacultySession());
    };

    window.addEventListener("cui:faculty-session-update", handleUpdate);
    window.addEventListener("storage", () => {
      setFacultySession(getActiveFacultySession());
    });
    return () => {
      window.removeEventListener("cui:faculty-session-update", handleUpdate);
    };
  }, []);

  if (!facultySession) return null;

  const handleUpdateLead = async (mins: number) => {
    setLeadMins(mins);
    setSavingLead(true);
    try {
      const res = await facultyUpdateLeadTimeFn({
        data: {
          email: facultySession.profile.email,
          leadMins: mins,
        },
      });
      if (res.success && res.session) {
        setFacultySession(res.session);
      }
    } catch {
      // Ignore
    } finally {
      setSavingLead(false);
    }
  };

  const handleSignOut = () => {
    clearFacultySession();
    setShowModal(false);
    setView("today");
  };

  const teacherName =
    facultySession.profile.timetableName || facultySession.profile.fullName;

  return (
    <>
      <button
        type="button"
        className={`faculty-topbar-pill tap ${view === "faculty-desk" ? "on" : ""}`}
        onClick={() => setShowModal(true)}
        title="Faculty Workspace & Settings"
      >
        <span className="faculty-pill-badge">Faculty</span>
        <span className="faculty-pill-name">{teacherName}</span>
      </button>

      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <div
            className="student-profile-dialog"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 460 }}
          >
            <div className="dialog-header">
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <GraduationCap size={24} color="#087f79" />
                <h3 style={{ margin: 0, fontSize: "1.15rem" }}>Faculty Portal</h3>
              </div>
              <button
                type="button"
                className="close-btn"
                onClick={() => setShowModal(false)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="dialog-body stack" style={{ gap: "1rem" }}>
              {/* Faculty Card */}
              <div
                style={{
                  background: "radial-gradient(circle at 10% 20%, #087f79 0%, #163847 100%)",
                  color: "#ffffff",
                  padding: "1.25rem",
                  borderRadius: "1rem",
                  boxShadow: "0 10px 25px -5px rgba(8, 127, 121, 0.4)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <span style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.1em", opacity: 0.85, fontWeight: 700 }}>
                      CUI Attock Faculty Card
                    </span>
                    <h2 style={{ margin: "0.25rem 0", fontSize: "1.25rem", fontWeight: 800 }}>
                      {teacherName}
                    </h2>
                    <p style={{ margin: 0, fontSize: "0.85rem", opacity: 0.9 }}>
                      {facultySession.profile.department}
                    </p>
                  </div>
                  <span style={{ background: "rgba(255,255,255,0.2)", padding: "4px 10px", borderRadius: "999px", fontSize: "0.75rem", fontWeight: 700 }}>
                    Active
                  </span>
                </div>

                <div style={{ marginTop: "1rem", borderTop: "1px solid rgba(255,255,255,0.15)", paddingTop: "0.75rem", fontSize: "0.78rem", opacity: 0.85 }}>
                  {facultySession.profile.email}
                </div>
              </div>

              {/* Quick Actions */}
              <button
                type="button"
                className="btn solid tap"
                style={{ justifyContent: "center", padding: "0.75rem 1rem" }}
                onClick={() => {
                  setShowModal(false);
                  setView("faculty-desk");
                }}
              >
                <Sparkles size={16} />
                <span>Open Teaching Desk & Makeup Matcher</span>
              </button>

              {/* Notification Preferences */}
              <div style={{ background: "var(--c-paper)", border: "1px solid var(--c-line)", padding: "0.85rem 1rem", borderRadius: "0.75rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <Bell size={15} color="var(--c-accent)" />
                  <strong style={{ fontSize: "0.85rem" }}>Pre-Class Reminders</strong>
                </div>
                <p style={{ fontSize: "0.78rem", color: "var(--muted, #64748b)", margin: "0 0 8px" }}>
                  How long before each lecture/lab should we remind you?
                </p>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    className={`btn sm tap ${leadMins === 5 ? "solid" : "secondary"}`}
                    onClick={() => handleUpdateLead(5)}
                    disabled={savingLead}
                  >
                    5 Mins Before
                  </button>
                  <button
                    type="button"
                    className={`btn sm tap ${leadMins === 10 ? "solid" : "secondary"}`}
                    onClick={() => handleUpdateLead(10)}
                    disabled={savingLead}
                  >
                    10 Mins Before
                  </button>
                </div>
              </div>

              {/* Logout Button */}
              <button
                type="button"
                className="btn secondary tap"
                style={{ justifyContent: "center", color: "#dc2626", borderColor: "color-mix(in srgb, #dc2626 30%, transparent)" }}
                onClick={handleSignOut}
              >
                <LogOut size={16} />
                <span>Sign Out of Faculty Account</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
