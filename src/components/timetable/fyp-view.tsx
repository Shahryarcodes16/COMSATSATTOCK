import { useState, useEffect } from "react";
import { GraduationCap, Users } from "lucide-react";
import { getActiveFacultySession } from "@/lib/faculty-auth";
import { getActiveStudentSession } from "@/lib/student";
import { FypFacultyDeck } from "./fyp-faculty-deck";
import { FypStudentPortal } from "./fyp-student-portal";

export function FypView() {
  const [facultySession, setFacultySession] = useState(() => getActiveFacultySession());
  const [studentSession, setStudentSession] = useState(() => getActiveStudentSession());
  const [activeRole, setActiveRole] = useState<"faculty" | "student">(() => {
    if (facultySession) return "faculty";
    return "student";
  });

  useEffect(() => {
    const handleFacultyUpdate = () => {
      const sess = getActiveFacultySession();
      setFacultySession(sess);
      if (sess && !studentSession) setActiveRole("faculty");
    };
    const handleStudentUpdate = () => {
      const sess = getActiveStudentSession();
      setStudentSession(sess);
      if (sess && !facultySession) setActiveRole("student");
    };

    window.addEventListener("cui:faculty-session-update", handleFacultyUpdate);
    window.addEventListener("cui:student-session-update", handleStudentUpdate);
    window.addEventListener("storage", () => {
      handleFacultyUpdate();
      handleStudentUpdate();
    });

    return () => {
      window.removeEventListener("cui:faculty-session-update", handleFacultyUpdate);
      window.removeEventListener("cui:student-session-update", handleStudentUpdate);
    };
  }, [facultySession, studentSession]);

  const hasBothSessions = Boolean(facultySession && studentSession);

  return (
    <div className="fyp-view-container stack" style={{ gap: "1.25rem", padding: "1rem 0" }}>
      {hasBothSessions && (
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
          <button
            type="button"
            className={`btn tap ${activeRole === "faculty" ? "primary" : "secondary"}`}
            onClick={() => setActiveRole("faculty")}
            style={{ fontSize: "0.82rem", padding: "4px 10px" }}
          >
            <GraduationCap size={14} />
            <span>Supervisor View</span>
          </button>
          <button
            type="button"
            className={`btn tap ${activeRole === "student" ? "primary" : "secondary"}`}
            onClick={() => setActiveRole("student")}
            style={{ fontSize: "0.82rem", padding: "4px 10px" }}
          >
            <Users size={14} />
            <span>Student View</span>
          </button>
        </div>
      )}

      {activeRole === "faculty" && facultySession ? (
        <FypFacultyDeck />
      ) : (
        <FypStudentPortal />
      )}
    </div>
  );
}
