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
import { DeskProvider, useDesk } from "@/components/timetable/context";
import { CampusFooter, Dock, Sidebar, Topbar } from "@/components/timetable/chrome";
import { DetailSheet } from "@/components/timetable/sheet";
import { useClassNotificationScheduler } from "@/components/timetable/notification-modal";
import { StudentGateway } from "@/components/timetable/student-gateway";
import { getActiveStudentSession, type StudentSession } from "@/lib/student";
import { getActiveAdminSession } from "@/lib/admin";

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
  const [adminSession, setAdminSession] = useState(() => getActiveAdminSession());

  useEffect(() => {
    const handleStudentSession = (e: Event) => {
      const customEvent = e as CustomEvent<StudentSession | null>;
      setStudentSession(customEvent.detail || getActiveStudentSession());
    };

    window.addEventListener("cui:student-session-update", handleStudentSession);
    window.addEventListener("storage", () => {
      setStudentSession(getActiveStudentSession());
      setAdminSession(getActiveAdminSession());
    });
    return () => {
      window.removeEventListener("cui:student-session-update", handleStudentSession);
    };
  }, []);

  useClassNotificationScheduler();

  // Authentication Gate: Students must first create an account or sign in before app features are unlocked
  const isAuthenticated = Boolean(studentSession || adminSession);

  if (!isAuthenticated) {
    if (view === "admin") {
      return (
        <div className="app">
          <main id="main">
            <AdminPortal />
          </main>
        </div>
      );
    }

    return (
      <div className="app">
        <StudentGateway onAuthenticated={(session) => setStudentSession(session)} />
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
            <div hidden={view !== "admin"}>
              <AdminPortal />
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
