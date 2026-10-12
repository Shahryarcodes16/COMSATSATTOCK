import type { CSSProperties, ReactNode } from "react";
import {
  ArrowUpRight,
  Clock,
  DoorOpen,
  GraduationCap,
  Moon,
  Phone,
  Search,
  Sun,
  Users,
} from "lucide-react";
import crest from "@/assets/crest.png";
import {
  APP_NAME,
  CAMPUS_TIME_LABEL,
  DEVELOPER_NAME,
  DEVELOPER_PHONE,
  DEVELOPER_PHONE_HREF,
} from "@/lib/campus";
import { DAY_SHORT, DAYS, SLOTS, greeting, rangeLabel, timeLabel, type ClockInfo } from "@/lib/schedule";
import { useDesk, type View } from "@/components/timetable/context";

const NAV: { id: View; label: string; icon: typeof Clock }[] = [
  { id: "today", label: "Today", icon: Clock },
  { id: "rooms", label: "Rooms", icon: DoorOpen },
  { id: "faculty", label: "Faculty", icon: GraduationCap },
  { id: "batches", label: "Batches", icon: Users },
  { id: "find", label: "Search", icon: Search },
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
  const { view, setView } = useDesk();
  return (
    <aside className="sidebar">
      <Brand />
      <p className="nav-label">Campus workspace</p>
      <nav className="side-nav" aria-label="Sections">
        {NAV.map((item) => {
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
              {item.label}
              {on ? <ArrowUpRight className="nav-arrow" size={15} aria-hidden /> : null}
            </button>
          );
        })}
      </nav>
      <div className="side-foot">
        <span className="side-campus">
          <GraduationCap size={18} aria-hidden />
          Attock Campus
        </span>
        <p>Timetable from 5 Oct 2026</p>
        <p>{CAMPUS_TIME_LABEL}</p>
        <span className="side-note">A clearer view of campus life.</span>
      </div>
    </aside>
  );
}

export function Topbar() {
  const { now, theme, toggleTheme, setView } = useDesk();
  const ink = theme === "ink";
  return (
    <header className="topbar">
      <div>
        <div className="mobile-brand">
          <Brand />
        </div>
        <p className="hello">{greeting(now)}</p>
      </div>
      <div className="topbar-actions">
        <button type="button" className="topbar-search" onClick={() => setView("find")}>
          <Search size={17} aria-hidden />
          <span>Search campus</span>
          <ArrowUpRight size={15} aria-hidden />
        </button>
        <button
          type="button"
          className="icon-btn tap"
          aria-label={ink ? "Use the paper theme" : "Use the ink theme"}
          onClick={toggleTheme}
        >
          <span className="icon-swap">
            <span className={ink ? "off" : ""}>
              <Moon size={18} strokeWidth={1.75} aria-hidden />
            </span>
            <span className={ink ? "" : "off"}>
              <Sun size={18} strokeWidth={1.75} aria-hidden />
            </span>
          </span>
        </button>
      </div>
    </header>
  );
}

export function CampusFooter() {
  return (
    <footer className="campus-footer">
      <div>
        <p>Developed by {DEVELOPER_NAME}</p>
        <p className="fine">Attock Campus · {CAMPUS_TIME_LABEL}</p>
      </div>
      <a
        className="btn tap"
        href={DEVELOPER_PHONE_HREF}
        aria-label={`Call developer ${DEVELOPER_NAME} at ${DEVELOPER_PHONE}`}
      >
        <Phone size={16} aria-hidden />
        {DEVELOPER_PHONE}
      </a>
    </footer>
  );
}

export function Dock() {
  const { view, setView } = useDesk();
  const index = NAV.findIndex((item) => item.id === view);
  return (
    <nav className="dock" aria-label="Sections" style={{ "--i": index } as CSSProperties}>
      <i className="dock-thumb" aria-hidden />
      {NAV.map((item) => {
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
            {item.label}
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
