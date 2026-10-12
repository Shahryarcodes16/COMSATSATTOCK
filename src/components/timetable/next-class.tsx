import { ArrowUpRight, CalendarDays, DoorOpen, GraduationCap } from "lucide-react";
import { useDesk } from "@/components/timetable/context";
import { blocksFor, DAYS, forBatch, rooms, spanLabel, subjects, teachers } from "@/lib/schedule";

export function NextClassPanel() {
  const { pinnedBatch, clock, setView, setBatchId } = useDesk();
  const list = pinnedBatch === null ? [] : forBatch(pinnedBatch);
  const blocks = blocksFor(list, clock.focusDay);
  const next =
    clock.phase === "after" ? undefined : blocks.find((block) => block.end >= clock.focusSlot);
  const active = next && clock.phase === "live" && next.start <= clock.focusSlot;
  return (
    <section className="panel next-panel">
      <div className="panel-head">
        <div>
          <p className="eyebrow">Based on Islamabad time</p>
          <h2>{active ? "Happening now" : "Up next"}</h2>
        </div>
        <CalendarDays size={20} aria-hidden />
      </div>
      {pinnedBatch === null ? (
        <div className="next-empty">
          <p>One less thing to remember.</p>
          <span>Save your batch to see your next class, teacher, and room here.</span>
        </div>
      ) : next ? (
        <div className="next-content">
          <span className="schedule-badge">
            {active ? "In progress" : DAYS[clock.focusDay]} · {spanLabel(next.start, next.end)}
          </span>
          <h3>{subjects[next.entry.subject]}</h3>
          {next.entry.teacher >= 0 ? (
            <p>
              <GraduationCap size={16} aria-hidden />
              {teachers[next.entry.teacher]}
            </p>
          ) : null}
          {next.entry.room >= 0 ? (
            <p>
              <DoorOpen size={16} aria-hidden />
              {rooms[next.entry.room]}
            </p>
          ) : null}
          {blocks.filter((block) => block.start <= next.end && block.end >= next.start).length >
          1 ? (
            <span className="fine">Parallel sections are listed. Check your assigned section.</span>
          ) : null}
        </div>
      ) : (
        <div className="next-empty">
          <p>{clock.phase === "after" ? "Done for the day." : "A little breathing room."}</p>
          <span>
            {clock.phase === "after"
              ? "No more classes today. Explore your full week to plan ahead."
              : `No upcoming classes on ${DAYS[clock.focusDay]}.`}
          </span>
        </div>
      )}
      {pinnedBatch !== null ? (
        <button
          className="text-action"
          type="button"
          onClick={() => {
            setBatchId(pinnedBatch);
            setView("batches");
          }}
        >
          View batch schedule <ArrowUpRight size={16} aria-hidden />
        </button>
      ) : null}
    </section>
  );
}
