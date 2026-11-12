import { useState, useEffect, type CSSProperties, type ReactNode } from "react";
import {
  Activity,
  ArrowLeft,
  ArrowUpRight,
  CalendarCheck,
  CalendarDays,
  Clock,
  DoorOpen,
  GraduationCap,
  Lock,
  Mail,
  Megaphone,
  Moon,
  Phone,
  Search,
  Sparkles,
  Sun,
  Users,
  X,
} from "lucide-react";
import crest from "@/assets/crest.png";
import {
  APP_NAME,
  CAMPUS_TIME_LABEL,
  DEVELOPER_NAME,
  DEVELOPER_EMAIL,
  DEVELOPER_EMAIL_HREF,
  DEVELOPER_PHONE,
  DEVELOPER_PHONE_HREF,
} from "@/lib/campus";
import { DAY_SHORT, DAYS, SLOTS, greeting, rangeLabel, timeLabel, type ClockInfo } from "@/lib/schedule";
import { isDatesheetActive } from "@/lib/datesheet";
import { useDesk, type View } from "@/components/timetable/context";
import { NotificationBellButton } from "@/components/timetable/notification-modal";
import { StudentAuthButton } from "@/components/timetable/student-auth-modal";
import { FacultyAuthButton } from "@/components/timetable/faculty-auth-modal";
import { getActiveFacultySession } from "@/lib/faculty-auth";
import { getActiveStudentSession } from "@/lib/student";
import {
  getClassCancellations,
  matchesStudentCancellationContext,
  matchesStudentMakeupContext,
  type ClassCancellationRecord,
} from "@/lib/campus-pulse";
import {
  getActiveArrangedMakeupClasses,
  type MakeupClassRecord,
} from "@/lib/makeup-classes";
import { loadCustomSchedule } from "@/lib/my-schedule";

function useTeacherMessageCount() {
  const { pinnedBatch, batchId } = useDesk();
  const [cancellations, setCancellations] = useState<ClassCancellationRecord[]>(() =>
    getClassCancellations().filter((c) => c.status === "active"),
  );
  const [makeups, setMakeups] = useState<MakeupClassRecord[]>(() =>
    getActiveArrangedMakeupClasses(new Date()),
  );
  const [, setRev] = useState(0);

  useEffect(() => {
    const onCancelUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<ClassCancellationRecord[]>;
      const list = customEvent.detail || getClassCancellations();
      setCancellations(list.filter((c) => c.status === "active"));
    };
    const onMakeupUpdate = () => {
      setMakeups(getActiveArrangedMakeupClasses(new Date()));
    };
    const onBump = () => {
      setCancellations(getClassCancellations().filter((c) => c.status === "active"));
      setMakeups(getActiveArrangedMakeupClasses(new Date()));
      setRev((r) => r + 1);
    };
    window.addEventListener("cui:class-cancellations-updated", onCancelUpdate);
    window.addEventListener("cui:makeup-classes-updated", onMakeupUpdate);
    window.addEventListener("cui:student-session-update", onBump);
    window.addEventListener("cui:faculty-session-update", onBump);
    window.addEventListener("cui:custom-schedule-update", onBump);
    window.addEventListener("storage", onBump);
    return () => {
      window.removeEventListener("cui:class-cancellations-updated", onCancelUpdate);
      window.removeEventListener("cui:makeup-classes-updated", onMakeupUpdate);
      window.removeEventListener("cui:student-session-update", onBump);
      window.removeEventListener("cui:faculty-session-update", onBump);
      window.removeEventListener("cui:custom-schedule-update", onBump);
      window.removeEventListener("storage", onBump);
    };
  }, []);

  const studentSession = getActiveStudentSession();
  const facultySession = getActiveFacultySession();
  const customSchedule = loadCustomSchedule();
  const studentBatch = studentSession?.profile?.defaultBatch || null;
  const teacherId = facultySession?.profile?.teacherId ?? null;
  const hasSavedStudentContext =
    Boolean(studentBatch) || pinnedBatch !== null || customSchedule.length > 0;

  const cancelCount = cancellations.filter((c) => {
    if (teacherId !== null && c.teacher === teacherId) return true;
    return matchesStudentCancellationContext(c, {
      studentBatch,
      pinnedBatch,
      customSchedule,
      activeBatchId: batchId,
      allowFallbackActiveBatch: !hasSavedStudentContext && teacherId === null,
    });
  }).length;

  const makeupCount = makeups.filter((m) => {
    if (teacherId !== null && m.teacher === teacherId) return true;
    return matchesStudentMakeupContext(m, {
      studentBatch,
      pinnedBatch,
      customSchedule,
      activeBatchId: batchId,
      allowFallbackActiveBatch: !hasSavedStudentContext && teacherId === null,
    });
  }).length;

  return cancelCount + makeupCount;
}

// Desktop sidebar navigates all sections
const BASE_DESKTOP_NAV: { id: View; label: string; icon: typeof Clock }[] = [
  { id: "today", label: "Today", icon: Clock },
  { id: "notices" as View, label: "Teacher Messages", icon: Megaphone },
  { id: "pulse" as View, label: "Campus Pulse", icon: Activity },
  { id: "custom", label: "My Schedule", icon: CalendarCheck },
  { id: "rooms", label: "Rooms", icon: DoorOpen },
  { id: "faculty", label: "Faculty", icon: GraduationCap },
  { id: "batches", label: "Batches", icon: Users },
  { id: "find", label: "Search", icon: Search },
];

// Mobile dock shows primary schedule & campus views with clean single-line labels
const MOBILE_NAV: { id: View; label: string; icon: typeof Clock }[] = [
  { id: "today", label: "Today", icon: Clock },
  { id: "pulse" as View, label: "Pulse", icon: Activity },
  { id: "custom", label: "Schedule", icon: CalendarCheck },
  { id: "rooms", label: "Rooms", icon: DoorOpen },
  { id: "faculty", label: "Faculty", icon: GraduationCap },
];

export function Brand() {
  return (
    <div className="brand" aria-label={APP_NAME}>
      <img className="crest" src={crest} alt="COMSATS University Islamabad, Attock Campus" />
      <div>
        <p className="eyebrow">CUI Attock</p>
        <p className="brand-name">Campus Timetable</p>
      </div>
    </div>
  );
}

export function Sidebar() {
  const { now, view, setView } = useDesk();
  const datesheetActive = isDatesheetActive(now);
  const [facultyActive, setFacultyActive] = useState(() => !!getActiveFacultySession());
  const messageCount = useTeacherMessageCount();

  useEffect(() => {
    const handleUpdate = () => {
      setFacultyActive(!!getActiveFacultySession());
    };
    window.addEventListener("cui:faculty-session-update", handleUpdate);
    window.addEventListener("storage", handleUpdate);
    return () => {
      window.removeEventListener("cui:faculty-session-update", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, []);

  let desktopNav = datesheetActive
    ? [
        ...BASE_DESKTOP_NAV.slice(0, 2),
        { id: "datesheet" as View, label: "Date Sheet", icon: CalendarDays },
        ...BASE_DESKTOP_NAV.slice(2),
      ]
    : BASE_DESKTOP_NAV;

  if (facultyActive) {
    desktopNav = [
      { id: "faculty-desk" as View, label: "Teaching Desk", icon: GraduationCap },
      ...desktopNav,
    ];
  }

  return (
    <aside className="sidebar">
      <Brand />
      <p className="nav-label">Campus workspace</p>
      <nav className="side-nav" aria-label="Sections">
        {desktopNav.map((item) => {
          const Icon = item.icon;
          const on = view === item.id;
          return (
            <button
              key={item.id}
              type="button"
              className={on ? "side-link on" : "side-link"}
              aria-current={on ? "page" : undefined}
              onClick={() => setView(item.id)}
            >
              <Icon size={18} strokeWidth={1.75} aria-hidden />
              <span>{item.label}</span>
              {item.id === "notices" && messageCount > 0 ? (
                <span className="side-nav-badge">{messageCount}</span>
              ) : null}
              {on ? <ArrowUpRight className="nav-arrow" size={15} aria-hidden /> : null}
            </button>
          );
        })}
      </nav>
      {datesheetActive && (
        <div className="datesheet-sidebar-card">
          <div className="datesheet-sidebar-badge-row">
            <span className="datesheet-live-dot" />
            <span className="datesheet-badge-text">FA26 MIDTERMS</span>
          </div>
          <p className="datesheet-sidebar-title">Midterm Date Sheet</p>
          <p className="datesheet-sidebar-desc">Nov 5 – Nov 12 (4 Nov shifted)</p>
          <button
            type="button"
            className={`btn tap datesheet-sidebar-btn ${view === "datesheet" ? "solid" : ""}`}
            onClick={() => setView("datesheet")}
          >
            <CalendarDays size={14} aria-hidden />
            <span>{view === "datesheet" ? "Viewing Datesheet" : "Open Schedule"}</span>
          </button>
        </div>
      )}
      <div className="side-foot">
        <span className="side-campus">
          <GraduationCap size={18} aria-hidden />
          Attock Campus
        </span>
        <p>Timetable from 5 Oct 2026</p>
        <p>{CAMPUS_TIME_LABEL}</p>
        <span className="side-note">A clearer view of campus life.</span>
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
          <StudentAuthButton showLabel={true} />
          <button
            type="button"
            className={`side-admin-link tap ${view === "admin" ? "on" : ""}`}
            onClick={() => setView("admin")}
            title="Campus Administrator Control Center"
          >
            <Lock size={13} aria-hidden />
            <span>Admin Portal</span>
          </button>
        </div>
      </div>
    </aside>
  );
}

export function Topbar() {
  const { now, theme, toggleTheme, setView, view, goBack } = useDesk();
  const isSearchActive = view === "find";
  const datesheetActive = isDatesheetActive(now);
  const [facultyActive, setFacultyActive] = useState(() => !!getActiveFacultySession());
  const messageCount = useTeacherMessageCount();

  useEffect(() => {
    const handleFacultyUpdate = () => setFacultyActive(!!getActiveFacultySession());
    window.addEventListener("cui:faculty-session-update", handleFacultyUpdate);
    window.addEventListener("storage", () => setFacultyActive(!!getActiveFacultySession()));
    return () => {
      window.removeEventListener("cui:faculty-session-update", handleFacultyUpdate);
    };
  }, []);

  return (
    <header className="topbar">
      <div className="topbar-left-group">
        {view !== "today" && (
          <button
            type="button"
            className="icon-btn tap topbar-back-btn"
            onClick={() => goBack("today")}
            aria-label="Back to Timetable"
            title="Back to Timetable"
          >
            <ArrowLeft size={18} aria-hidden />
          </button>
        )}
        <div className="topbar-brand-wrap">
          <div className="mobile-brand">
            <Brand />
          </div>
          <p className="hello">{greeting(now)}</p>
        </div>
      </div>
      <div className="topbar-actions">
        {/* Datesheet quick pill button */}
        {datesheetActive && (
          <button
            type="button"
            className={`datesheet-topbar-pill tap ${view === "datesheet" ? "on" : ""}`}
            onClick={() => (view === "datesheet" ? goBack("today") : setView("datesheet"))}
            title={view === "datesheet" ? "Close Datesheet and return" : "Open Midterm Examination Date Sheet"}
          >
            <span className="datesheet-pill-dot" />
            <span className="datesheet-pill-title">Date Sheet</span>
            {view === "datesheet" ? (
              <span className="datesheet-pill-badge" style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                <X size={12} /> Close
              </span>
            ) : (
              <span className="datesheet-pill-badge">Nov 5–12</span>
            )}
          </button>
        )}

        {/* Desktop search button */}
        <button
          type="button"
          className={`topbar-search ${isSearchActive ? "on" : ""}`}
          onClick={() => (isSearchActive ? goBack("today") : setView("find"))}
        >
          {isSearchActive ? <X size={17} aria-hidden /> : <Search size={17} aria-hidden />}
          <span>{isSearchActive ? "Close search" : "Search campus"}</span>
          {isSearchActive ? <X size={15} aria-hidden /> : <ArrowUpRight size={15} aria-hidden />}
        </button>

        {/* Mobile search icon button */}
        <button
          type="button"
          className={`icon-btn tap topbar-mobile-search ${isSearchActive ? "on" : ""}`}
          aria-label={isSearchActive ? "Close search and return to timetable" : "Search campus courses, faculty, rooms, batches"}
          aria-current={isSearchActive ? "page" : undefined}
          onClick={() => (isSearchActive ? goBack("today") : setView("find"))}
          title={isSearchActive ? "Close search" : "Search campus"}
        >
          {isSearchActive ? (
            <X size={18} strokeWidth={2} aria-hidden />
          ) : (
            <Search size={18} strokeWidth={1.8} aria-hidden />
          )}
        </button>

        {/* If faculty is logged in, show their official teaching desk pill */}
        {facultyActive ? (
          <FacultyAuthButton />
        ) : (
          <StudentAuthButton />
        )}

        {/* Teacher Messages & Today's Cancelled Classes Screen */}
        <button
          type="button"
          className={`icon-btn tap notices-topbar-btn ${view === "notices" ? "on" : ""}`}
          aria-label={
            view === "notices"
              ? "Close Teacher Messages"
              : `Teacher Messages & Today's Cancelled Classes${messageCount > 0 ? ` (${messageCount} active)` : ""}`
          }
          aria-current={view === "notices" ? "page" : undefined}
          onClick={() => (view === "notices" ? goBack("today") : setView("notices"))}
          title={view === "notices" ? "Close Teacher Messages" : "Teacher Messages & Today's Cancelled Classes"}
        >
          {view === "notices" ? (
            <X size={18} strokeWidth={2} aria-hidden />
          ) : (
            <Megaphone size={18} strokeWidth={1.8} aria-hidden />
          )}
          {view !== "notices" && messageCount > 0 && <span className="notices-badge-count">{messageCount}</span>}
        </button>

        {/* Class Reminders */}
        <NotificationBellButton />

        {/* Theme toggle: Paper (Light) -> Ink (Slate Dark) -> Midnight (OLED Pitch Black) */}
        <button
          type="button"
          className="icon-btn tap"
          aria-label={
            theme === "paper"
              ? "Current theme: Paper (Light). Click to switch to Ink (Slate Dark)."
              : theme === "ink"
                ? "Current theme: Ink (Slate Dark). Click to switch to Midnight (Pitch Black OLED)."
                : "Current theme: Midnight (Pitch Black OLED). Click to switch to Paper (Light)."
          }
          title={
            theme === "paper"
              ? "Theme: Paper (Light) — Click for Slate Ink"
              : theme === "ink"
                ? "Theme: Ink (Slate Dark) — Click for Modern Midnight Black"
                : "Theme: Midnight (Pitch Black OLED) — Click for Paper Light"
          }
          onClick={toggleTheme}
        >
          <span className="icon-swap">
            <span className={theme === "paper" ? "" : "off"}>
              <Sun size={18} strokeWidth={1.75} aria-hidden />
            </span>
            <span className={theme === "ink" ? "" : "off"}>
              <Moon size={18} strokeWidth={1.75} aria-hidden />
            </span>
            <span className={theme === "midnight" ? "" : "off"}>
              <Sparkles size={18} strokeWidth={1.75} aria-hidden />
            </span>
          </span>
        </button>
      </div>
    </header>
  );
}

export function CampusFooter() {
  const { view, setView } = useDesk();

  return (
    <footer className="campus-footer">
      <div>
        <p>Developed by {DEVELOPER_NAME}</p>
        <p className="fine">Attock Campus · {CAMPUS_TIME_LABEL}</p>
      </div>
      <div className="campus-footer-contacts">
        <button
          type="button"
          className={`btn tap campus-footer-admin-btn ${view === "admin" ? "solid" : ""}`}
          onClick={() => setView("admin")}
          title="Campus Administrator Control Center"
        >
          <Lock size={15} aria-hidden />
          <span>Admin Portal</span>
        </button>
        <a
          className="btn tap"
          href={DEVELOPER_EMAIL_HREF}
          aria-label={`Email developer ${DEVELOPER_NAME} at ${DEVELOPER_EMAIL}`}
        >
          <Mail size={16} aria-hidden />
          {DEVELOPER_EMAIL}
        </a>
        <a
          className="btn tap"
          href={DEVELOPER_PHONE_HREF}
          aria-label={`Call developer ${DEVELOPER_NAME} at ${DEVELOPER_PHONE}`}
        >
          <Phone size={16} aria-hidden />
          {DEVELOPER_PHONE}
        </a>
      </div>
    </footer>
  );
}

export function Dock() {
  const { view, setView } = useDesk();
  const [facultyActive, setFacultyActive] = useState(() => !!getActiveFacultySession());

  useEffect(() => {
    const handleUpdate = () => {
      setFacultyActive(!!getActiveFacultySession());
    };
    window.addEventListener("cui:faculty-session-update", handleUpdate);
    window.addEventListener("storage", handleUpdate);
    return () => {
      window.removeEventListener("cui:faculty-session-update", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, []);

  const navItems = facultyActive
    ? [
        { id: "today" as View, label: "Today", icon: Clock },
        { id: "faculty-desk" as View, label: "Teaching", icon: CalendarCheck },
        { id: "rooms" as View, label: "Rooms", icon: DoorOpen },
        { id: "faculty" as View, label: "Faculty", icon: GraduationCap },
        { id: "batches" as View, label: "Batches", icon: Users },
      ]
    : MOBILE_NAV;

  const index = navItems.findIndex((item) => item.id === view);

  return (
    <nav
      className="dock"
      aria-label="Sections"
      style={
        {
          "--i": Math.max(0, index),
          "--n": navItems.length,
        } as CSSProperties
      }
    >
      <i
        className="dock-thumb"
        style={{ opacity: index === -1 ? 0 : 1 }}
        aria-hidden
      />
      {navItems.map((item) => {
        const Icon = item.icon;
        const on = view === item.id;
        return (
          <button
            key={item.id}
            type="button"
            className={on ? "on" : undefined}
            aria-current={on ? "page" : undefined}
            onClick={() => setView(item.id)}
          >
            <Icon size={18} strokeWidth={1.75} aria-hidden />
            <span className="dock-label">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

export function Segment({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: ReactNode; disabled?: boolean; mark?: boolean }[];
  onChange: (value: string) => void;
}) {
  const index = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  return (
    <div
      className="seg"
      role="group"
      aria-label={label}
      style={{ "--n": options.length, "--i": index } as CSSProperties}
    >
      <i className="seg-thumb" aria-hidden />
      {options.map((option) => {
        const on = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={on}
            aria-description={option.mark ? "Current campus day or lecture" : undefined}
            disabled={option.disabled}
            className={[on ? "on" : "", option.mark ? "mark" : ""].filter(Boolean).join(" ")}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function showingCopy(
  day: number,
  slot: number,
  following: boolean,
  clock: ClockInfo,
): string {
  const when = `${DAYS[day]}, ${SLOTS[slot].label} (${rangeLabel(slot)})`;
  if (clock.phase === "loading") return "Reading the campus clock…";
  if (!following) return `Showing ${when}`;
  if (clock.phase === "live") return `Right now · ${when}`;
  if (clock.phase === "weekend") return `Weekend preview · ${when}`;
  if (clock.phase === "after") return `Last lecture today · ${when}`;
  return `Coming up · ${when}`;
}

export function DayPicker() {
  const { day, setDay, clock, following, backToNow } = useDesk();
  return (
    <div className="selection-bar stack">
      <Segment
        label="Day"
        value={String(day)}
        onChange={(value) => setDay(Number(value))}
        options={DAY_SHORT.map((label, index) => ({
          value: String(index),
          label,
          mark: clock.dayIndex === index,
        }))}
      />
      <div className="status">
        <span>{DAYS[day]} schedule</span>
        {clock.dayIndex !== null ? (
          <span className="today-indicator">
            <i aria-hidden />
            Today
          </span>
        ) : null}
        {!following ? (
          <button type="button" className="btn tap" onClick={backToNow}>
            Back to today
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function DaySlotBar() {
  const { day, slot, setDay, setSlot, clock, following, backToNow } = useDesk();
  return (
    <div className="selection-bar stack">
      <Segment
        label="Day"
        value={String(day)}
        onChange={(value) => setDay(Number(value))}
        options={DAY_SHORT.map((label, index) => ({
          value: String(index),
          label,
          mark: clock.dayIndex === index,
        }))}
      />
      <Segment
        label="Lecture"
        value={String(slot)}
        onChange={(value) => setSlot(Number(value))}
        options={SLOTS.map((item, index) => ({
          value: String(index),
          label: (
            <>
              {item.label}
              <small>{timeLabel(item.from)}</small>
            </>
          ),
          mark: clock.dayIndex === day && clock.liveSlot === index,
        }))}
      />
      <div className="status" aria-live="polite">
        <span>{showingCopy(day, slot, following, clock)}</span>
        {following ? null : (
          <button type="button" className="btn tap" onClick={backToNow}>
            Back to now
          </button>
        )}
      </div>
    </div>
  );
}
