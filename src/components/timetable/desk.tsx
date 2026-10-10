import { BatchesView, FacultyView, FindView, RoomsView, TodayView } from "@/components/timetable/views";
import { DeskProvider, useDesk } from "@/components/timetable/context";
import { Dock, Sidebar, Topbar } from "@/components/timetable/chrome";
import { DetailSheet } from "@/components/timetable/sheet";

export function Desk() {
  return (
    <DeskProvider>
      <Frame />
    </DeskProvider>
  );
}

function Frame() {
  const { view } = useDesk();
  return (
    <div className="app">
      <a className="skip" href="#main">
        Skip to content
      </a>
      <div className="shell">
        <Sidebar />
        <div className="column">
          <Topbar />
          <main id="main" data-view={view}>
            {view === "today" ? <TodayView /> : null}
            {view === "rooms" ? <RoomsView /> : null}
            {view === "faculty" ? <FacultyView /> : null}
            {view === "batches" ? <BatchesView /> : null}
            {view === "find" ? <FindView /> : null}
          </main>
        </div>
      </div>
      <Dock />
      <DetailSheet />
    </div>
  );
}
