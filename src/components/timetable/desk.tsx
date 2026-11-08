import { useState, useEffect } from "react";
import {
  BatchesView,
  FacultyView,
  FindView,
  RoomsView,
  TodayView,
} from "@/components/timetable/views";
import { DatesheetView } from "@/components/timetable/datesheet-view";
import { MyScheduleView } from "@/components/timetable/my-schedule-view";
import { AdminPortal } from "@/components/timetable/admin-portal";
import { CampusNoticeBanner } from "@/components/timetable/campus-notice-banner";
import { CampusPulseView } from "@/components/timetable/campus-pulse-view";
import { DeskProvider, useDesk } from "@/components/timetable/context";
import { CampusFooter, Dock, Sidebar, Topbar } from "@/components/timetable/chrome";
import { DetailSheet } from "@/components/timetable/sheet";
import { useClassNotificationScheduler } from "@/components/timetable/notification-modal";
import { StudentGateway } from "@/components/timetable/student-gateway";
import { FacultyWorkspaceView } from "@/components/timetable/faculty-workspace-view";
import { getActiveStudentSession, type StudentSession } from "@/lib/student";
import { getActiveFacultySession, type FacultySession } from "@/lib/faculty-auth";

export function Desk() {
  return (
    <DeskProvider>
      <Frame />
    </DeskProvider>
  );
}

function Frame() {
  const { view, detail } = useDesk();
  const [studentSession, setStudentSession] = useState<StudentSession | null>(() => getActiveStudentSession());
  const [facultySession, setFacultySession] = useState<FacultySession | null>(() => getActiveFacultySession());

  useEffect(() => {
    // Keep sessions strictly in sync with client storage & broadcast updates
    setStudentSession(getActiveStudentSession());
    setFacultySession(getActiveFacultySession());

    const handleStudentSession = (e: Event) => {
      const customEvent = e as CustomEvent<StudentSession | null>;
      setStudentSession(customEvent.detail ?? getActiveStudentSession());
    };

    const handleFacultySession = (e: Event) => {
      const customEvent = e as CustomEvent<FacultySession | null>;
      setFacultySession(customEvent.detail ?? getActiveFacultySession());
    };

    window.addEventListener("cui:student-session-update", handleStudentSession);
    window.addEventListener("cui:faculty-session-update", handleFacultySession);
    window.addEventListener("storage", () => {
      setStudentSession(getActiveStudentSession());
      setFacultySession(getActiveFacultySession());
    });
    return () => {
      window.removeEventListener("cui:student-session-update", handleStudentSession);
      window.removeEventListener("cui:faculty-session-update", handleFacultySession);
    };
  }, []);

  useClassNotificationScheduler();

  // If the user navigated to the Admin Portal, display the admin interface
  if (view === "admin") {
    return (
      <div className="app">
        <main id="main">
          <AdminPortal />
        </main>
      </div>
    );
  }

  // Strict Authentication Gate: User MUST be signed in as either a Student or Faculty member.
  const isAuthenticated = Boolean(studentSession || facultySession);

  if (!isAuthenticated) {
    return (
      <div className="app">
        <StudentGateway
          onAuthenticated={(session) => setStudentSession(session)}
          onFacultyAuthenticated={(session) => setFacultySession(session)}
        />
      </div>
    );
  }

  return (
    <div className="app">
      <a className="skip" href="#main">
        Skip to content
      </a>
      <div className="shell" inert={detail ? true : undefined}>
        <Sidebar />
        <div className="column">
          <CampusNoticeBanner />
          <Topbar />
          <main id="main" tabIndex={-1} data-view={view}>
            <div hidden={view !== "today"}>
              <TodayView />
            </div>
            <div hidden={view !== "pulse"}>
              <CampusPulseView />
            </div>
            <div hidden={view !== "custom"}>
              <MyScheduleView />
            </div>
            <div hidden={view !== "rooms"}>
              <RoomsView />
            </div>
            <div hidden={view !== "faculty"}>
              <FacultyView />
            </div>
            <div hidden={view !== "batches"}>
              <BatchesView />
            </div>
            <div hidden={view !== "find"}>
              <FindView />
            </div>
            <div hidden={view !== "datesheet"}>
              <DatesheetView />
            </div>
            <div hidden={view !== "faculty-desk"}>
              <FacultyWorkspaceView />
            </div>
          </main>
          <CampusFooter />
        </div>
      </div>
      <div inert={detail ? true : undefined}>
        <Dock />
      </div>
      <DetailSheet />
    </div>
  );
}
