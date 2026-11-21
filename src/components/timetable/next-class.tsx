import { useEffect, useState } from "react";
import { ArrowUpRight, CalendarDays, DoorOpen, GraduationCap } from "lucide-react";
import { useDesk } from "@/components/timetable/context";
import { blocksFor, DAYS, forBatch, rooms, spanLabel, subjects, teachers } from "@/lib/schedule";
import { isClassCancelled } from "@/lib/campus-pulse";

export function NextClassPanel() {
  const { pinnedBatch, clock, setView, setBatchId } = useDesk();
  const [, setCancelRevision] = useState(0);

  useEffect(() => {
    const handleUpdate = () => setCancelRevision((r) => r + 1);
    window.addEventListener("cui:class-cancellations-updated", handleUpdate);
    window.addEventListener("cui:makeup-classes-updated", handleUpdate);
    window.addEventListener("storage", handleUpdate);
    return () => {
      window.removeEventListener("cui:class-cancellations-updated", handleUpdate);
      window.removeEventListener("cui:makeup-classes-updated", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, []);

  const list = pinnedBatch === null ? [] : forBatch(pinnedBatch);
  const blocks = blocksFor(list, clock.focusDay);
  const next =
    clock.phase === "after" ? undefined : blocks.find((block) => block.end >= clock.focusSlot);
  const active = next && clock.phase === "live" && next.start <= clock.focusSlot;

  let cancellationRecord = null;
  if (next) {
    for (let s = next.start; s <= next.end; s++) {
      const c = isClassCancelled(clock.focusDay, s, next.entry.teacher, next.entry.batch, next.entry.room);
      if (c) {
        cancellationRecord = c;
        break;
      }
    }
  }

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
        <div className={`next-content ${cancellationRecord ? "cancelled-next-panel-card" : ""}`}>
          {cancellationRecord && (
            <div className="next-cancellation-strip">
              <span className="cancellation-badge-text">🚨 CLASS CANCELLED BY INSTRUCTOR</span>
              <p className="cancellation-reason-text">
                {cancellationRecord.teacherName || (next.entry.teacher >= 0 ? teachers[next.entry.teacher] : "Faculty")} cancelled this class.
                {cancellationRecord.reason ? ` Reason: "${cancellationRecord.reason}"` : ""}
              </p>
              <div className="room-freed-badge">
                🟢 Venue <strong>{rooms[next.entry.room] || cancellationRecord.roomName}</strong> is now FREE
              </div>
            </div>
          )}

          {next.entry.isMakeup && !cancellationRecord && (
            <div className="next-makeup-strip">
              <span className="next-makeup-pill">
                ⭐ MAKE-UP CLASS ARRANGED
              </span>
              {next.entry.makeupNote && (
                <p className="next-makeup-note">
                  &ldquo;{next.entry.makeupNote}&rdquo;
                </p>
              )}
            </div>
          )}

          <span className="schedule-badge">
            {active && !cancellationRecord && <span className="next-live-dot" aria-hidden />}
            {cancellationRecord
              ? `${active ? "Scheduled now (Cancelled)" : DAYS[clock.focusDay]} · ${spanLabel(next.start, next.end)}`
              : `${next.entry.isMakeup ? "Make-up · " : ""}${active ? "In progress" : DAYS[clock.focusDay]} · ${spanLabel(next.start, next.end)}`}
          </span>
          <h3 className={cancellationRecord ? "cancelled-next-title" : ""}>
            {subjects[next.entry.subject]}
          </h3>
          {next.entry.teacher >= 0 ? (
            <p className="next-meta-row">
              <GraduationCap size={16} aria-hidden />
              <span>{teachers[next.entry.teacher]}</span>
            </p>
          ) : null}
          {next.entry.room >= 0 ? (
            <p className="next-meta-row">
              <DoorOpen size={16} aria-hidden />
              <span>{rooms[next.entry.room]}</span>
              {cancellationRecord ? <span className="venue-freed-tag">(Freed)</span> : null}
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
