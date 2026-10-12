import {
  BatchesView,
  FacultyView,
  FindView,
  RoomsView,
  TodayView,
} from "@/components/timetable/views";
import { DeskProvider, useDesk } from "@/components/timetable/context";
import { CampusFooter, Dock, Sidebar, Topbar } from "@/components/timetable/chrome";
import { DetailSheet } from "@/components/timetable/sheet";

export function Desk() {
  return (
    <DeskProvider>
      <Frame />
    </DeskProvider>
  );
}

function Frame() {
  const { view, detail } = useDesk();
  return (
    <div className="app">
      <a className="skip" href="#main">
        Skip to content
      </a>
      <div className="shell" inert={detail ? true : undefined}>
        <Sidebar />
        <div className="column">
          <Topbar />
          <main id="main" tabIndex={-1} data-view={view}>
            <div hidden={view !== "today"}>
              <TodayView />
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
