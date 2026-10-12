import { useEffect, useRef, useState } from "react";
import { CalendarDays, List } from "lucide-react";
import { Segment } from "@/components/timetable/chrome";
import { DAY_SHORT, DAYS, SLOTS, cellMap, subjects, rangeLabel, type ClassEntry } from "@/lib/schedule";

type Props = {
  list: ClassEntry[];
  focusDay: number | null;
  liveDay: number | null;
  liveSlot: number | null;
  caption: (entry: ClassEntry) => string;
  onDayChange?: (day: number) => void;
};

export function WeekGrid({ list, focusDay, liveDay, liveSlot, caption, onDayChange }: Props) {
  const [chosenLayout, setChosenLayout] = useState<"week" | "agenda" | null>(null);
  const [compact, setCompact] = useState(false);
  const layout = chosenLayout ?? (compact ? "agenda" : "week");
  const scrollRef = useRef<HTMLDivElement>(null);
  const [overflowing, setOverflowing] = useState(false);
  const [day, setDay] = useState(focusDay ?? 0);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 859px)");
    const update = () => setCompact(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    setDay(focusDay ?? 0);
  }, [focusDay]);
  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    const update = () => setOverflowing(element.scrollWidth > element.clientWidth + 1);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [layout, list]);
  const map = cellMap(list);
  const content = (items: ClassEntry[], cellDay: number, slot: number) => {
    const groups = new Map<string, ClassEntry[]>();
    for (const entry of items) {
      const key = `${entry.subject}|${entry.teacher}|${entry.room}|${entry.repeater}`;
      const group = groups.get(key) ?? [];
      group.push(entry);
      groups.set(key, group);
    }
    return [...groups.entries()].map(([key, group]) => {
      const entry = group[0];
      const live = liveDay === cellDay && liveSlot === slot;
      const lab = /lab/i.test(subjects[entry.subject]);
      return (
        <article key={key} className={`mini${live ? " live" : ""}${lab ? " lab" : ""}`}>
          <div className="mini-label">
            <span>{entry.repeater ? "Repeater" : lab ? "Lab" : "Lecture"}</span>
            {live ? <span className="flag now">Now</span> : null}
          </div>
          <strong>{subjects[entry.subject]}</strong>
          <span className="mini-caption">{[...new Set(group.map(caption))].join(" · ")}</span>
        </article>
      );
    });
  };
  return (
    <div className="schedule-view stack">
      <div className="schedule-toolbar noprint">
        <span className="quiet">Your week, at a glance</span>
        <Segment
          label="Schedule layout"
          value={layout}
          onChange={(value) => setChosenLayout(value === "agenda" ? "agenda" : "week")}
          options={[
            {
              value: "week",
              label: (
                <>
                  <CalendarDays size={15} aria-hidden /> Week
                </>
              ),
            },
            {
              value: "agenda",
              label: (
                <>
                  <List size={15} aria-hidden /> Agenda
                </>
              ),
            },
          ]}
        />
      </div>
      {layout === "agenda" ? (
        <div className="agenda noprint">
          <Segment
            label="Agenda day"
            value={String(day)}
            onChange={(value) => {
              setDay(Number(value));
              onDayChange?.(Number(value));
            }}
            options={DAY_SHORT.map((label, index) => ({
              value: String(index),
              label,
              mark: liveDay === index,
            }))}
          />
          <h3 className="agenda-title">{DAYS[day]}</h3>
          {SLOTS.map((slot, index) => {
            const items = map.get(`${day}|${index}`) ?? [];
            return (
              <section
                className="agenda-slot"
                key={slot.label}
                aria-label={`${DAYS[day]} ${slot.label}`}
              >
                <div className="agenda-time">
                  <b>{slot.label}</b>
                  <span>
                    {rangeLabel(index)}
                  </span>
                </div>
                <div className="stack">
                  {items.length ? (
                    content(items, day, index)
                  ) : (
                    <p className="agenda-free">No class scheduled</p>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      ) : null}
      <div
        ref={scrollRef}
        className={`week-scroll${layout === "agenda" ? " print-only" : ""}`}
        role="region"
        tabIndex={overflowing ? 0 : undefined}
        aria-label={
          overflowing ? "Weekly timetable, scroll horizontally to see all days" : "Weekly timetable"
        }
      >
        <table className="week" aria-label="Weekly timetable">
          <thead>
            <tr>
              <th scope="col">Time</th>
              {DAY_SHORT.map((label, index) => (
                <th
                  scope="col"
                  key={label}
                  className={focusDay === index ? "selected-day" : undefined}
                >
                  <span>{label}</span>
                  {liveDay === index ? <small className="today-label">Today</small> : null}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SLOTS.map((slot, index) => (
              <tr key={slot.label}>
                <th scope="row" className="time">
                  <b>{slot.label}</b>
                  <span>
                    {rangeLabel(index)}
                  </span>
                </th>
                {DAY_SHORT.map((_, cellDay) => {
                  const items = map.get(`${cellDay}|${index}`) ?? [];
                  return (
                    <td key={cellDay} className={focusDay === cellDay ? "cell focus" : "cell"}>
                      {items.length ? (
                        content(items, cellDay, index)
                      ) : (
                        <span className="empty-cell">Free</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {layout === "week" && overflowing ? (
        <p className="fine scroll-hint noprint">
          Scroll across to see the full week, or switch to Agenda.
        </p>
      ) : null}
    </div>
  );
}
