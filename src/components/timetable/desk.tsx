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
import { TeacherMessagesView } from "@/components/timetable/teacher-messages-view";
import { DeskProvider, useDesk } from "@/components/timetable/context";
import { CampusFooter, Dock, Sidebar, Topbar } from "@/components/timetable/chrome";
import { DetailSheet } from "@/components/timetable/sheet";
import { useClassNotificationScheduler } from "@/components/timetable/notification-modal";
import { StudentGateway } from "@/components/timetable/student-gateway";
import { FacultyWorkspaceView } from "@/components/timetable/faculty-workspace-view";
import { AboutSupportView } from "@/components/timetable/about-support-view";
import { PwaOfflineEngine } from "@/components/timetable/pwa-offline-engine";
import { CoordinatorWorkspaceView } from "@/components/timetable/coordinator-workspace-view";
import { getActiveStudentSession, type StudentSession } from "@/lib/student";
import { getActiveFacultySession, type FacultySession } from "@/lib/faculty-auth";
import { getActiveCoordinatorSession, type CoordinatorSession } from "@/lib/coordinator";

export function Desk() {
  return (
    <DeskProvider>
      <PwaOfflineEngine />
      <Frame />
    </DeskProvider>
  );
}

function Frame() {
  const { view, setView, detail } = useDesk();
  const [studentSession, setStudentSession] = useState<StudentSession | null>(() => getActiveStudentSession());
  const [facultySession, setFacultySession] = useState<FacultySession | null>(() => getActiveFacultySession());
  const [coordinatorSession, setCoordinatorSession] = useState<CoordinatorSession | null>(() => getActiveCoordinatorSession());

  useEffect(() => {
    // If incoming link contains a QuickShare code, automatically switch to My Schedule view
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.has("share") || params.has("s")) {
        setView("custom");
      }
    }
  }, [setView]);

  useEffect(() => {
    // Keep sessions strictly in sync with client storage & broadcast updates
    setStudentSession(getActiveStudentSession());
    setFacultySession(getActiveFacultySession());
    setCoordinatorSession(getActiveCoordinatorSession());

    const handleStudentSession = (e: Event) => {
      const customEvent = e as CustomEvent<StudentSession | null>;
      setStudentSession(customEvent.detail ?? getActiveStudentSession());
    };

    const handleFacultySession = (e: Event) => {
      const customEvent = e as CustomEvent<FacultySession | null>;
      setFacultySession(customEvent.detail ?? getActiveFacultySession());
    };

    const handleCoordinatorSession = (e: Event) => {
      const customEvent = e as CustomEvent<CoordinatorSession | null>;
      setCoordinatorSession(customEvent.detail ?? getActiveCoordinatorSession());
    };

    window.addEventListener("cui:student-session-update", handleStudentSession);
    window.addEventListener("cui:faculty-session-update", handleFacultySession);
    window.addEventListener("cui:coordinator-session-update", handleCoordinatorSession);
    window.addEventListener("storage", () => {
      setStudentSession(getActiveStudentSession());
      setFacultySession(getActiveFacultySession());
      setCoordinatorSession(getActiveCoordinatorSession());
    });
    return () => {
      window.removeEventListener("cui:student-session-update", handleStudentSession);
      window.removeEventListener("cui:faculty-session-update", handleFacultySession);
      window.removeEventListener("cui:coordinator-session-update", handleCoordinatorSession);
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

  // Strict Authentication Gate: User MUST be signed in as either a Student, Faculty member, or Coordinator.
  // If view is explicitly set to coordinator, the coordinator view has its own internal secure official email auth screen.
  const isAuthenticated = Boolean(studentSession || facultySession || coordinatorSession || view === "coordinator");

  if (!isAuthenticated) {
    return (
      <div className="app">
        <StudentGateway
          onAuthenticated={(session) => setStudentSession(session)}
          onFacultyAuthenticated={(session) => setFacultySession(session)}
          onCoordinatorAuthenticated={(session) => setCoordinatorSession(session)}
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
            <div hidden={view !== "faculty-desk" && view !== "cancel-class" && view !== "makeup-class"}>
              <FacultyWorkspaceView activeSection={view === "cancel-class" ? "cancel" : view === "makeup-class" ? "makeup" : view === "faculty-desk" ? "table" : undefined} />
            </div>
            <div hidden={view !== "coordinator"}>
              <CoordinatorWorkspaceView />
            </div>
            <div hidden={view !== "notices"}>
              <TeacherMessagesView />
            </div>
            <div hidden={view !== "about"}>
              <AboutSupportView />
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
