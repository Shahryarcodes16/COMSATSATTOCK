import { useEffect, useState } from "react";
import {
  batches,
  blocksFor,
  rooms,
  SLOTS,
  timeLabel,
  subjects,
  teachers,
  type Block,
  type ClassEntry,
} from "@/lib/schedule";
import { useDesk } from "@/components/timetable/context";
import { isClassCancelled } from "@/lib/campus-pulse";

function overlaps(blocks: Block[]): boolean {
  for (let left = 0; left < blocks.length; left += 1) {
    for (let right = left + 1; right < blocks.length; right += 1) {
      const a = blocks[left];
      const b = blocks[right];
      if (a.start <= b.end && b.start <= a.end) return true;
    }
  }
  return false;
}

export function ClassList({
  list,
  day,
  who,
}: {
  list: ClassEntry[];
  day: number;
  who: "batch" | "teacher";
}) {
  const { clock, open } = useDesk();
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

  const blocks = blocksFor(list, day);
  if (blocks.length === 0) {
    return <p className="quiet">Nothing scheduled. A clear day.</p>;
  }
  return (
    <div className="stack">
      {overlaps(blocks) ? (
        <p className="note">
          More than one class shares a slot. These run in parallel, so confirm which section is
          yours.
        </p>
      ) : null}
      {blocks.map((block) => {
        const entry = block.entry;
        const live =
          clock.dayIndex === day &&
          clock.liveSlot !== null &&
          clock.liveSlot >= block.start &&
          clock.liveSlot <= block.end;
        const person = entry.teacher >= 0 ? teachers[entry.teacher] : "";
        const room = entry.room >= 0 ? rooms[entry.room] : "";
        const batch = batches[entry.batch];

        // Check if class is cancelled for any slot in this block
        let cancellationRecord = null;
        for (let s = block.start; s <= block.end; s++) {
          const c = isClassCancelled(day, s, entry.teacher, entry.batch, entry.room);
          if (c) {
            cancellationRecord = c;
            break;
          }
        }
        const isCancelled = cancellationRecord !== null;

        return (
          <article
            key={`${block.start}-${entry.batch}-${entry.subject}-${entry.room}-${entry.repeater}-${entry.makeupId || "std"}`}
            className={
              isCancelled
                ? "class-card cancelled-class-card"
                : entry.isMakeup
                  ? `class-card makeup-card-highlight${live ? " live" : ""}`
                  : live
                    ? "class-card live"
                    : "class-card"
            }
          >
            <div className="when">
              <b style={{ textDecoration: isCancelled ? "line-through" : undefined, opacity: isCancelled ? 0.7 : 1 }}>
                {timeLabel(SLOTS[block.start].from)}
              </b>
              <span style={{ textDecoration: isCancelled ? "line-through" : undefined, opacity: isCancelled ? 0.7 : 1 }}>
                {timeLabel(SLOTS[block.end].to)}
              </span>
              {isCancelled && <span className="cancelled-side-badge">CANCELLED</span>}
            </div>
            <div>
              <div className="class-kind">
                <span>
                  {entry.isMakeup
                    ? "⭐ Make-up Class"
                    : /lab/i.test(subjects[entry.subject])
                      ? "Practical lab"
                      : "Lecture"}
                </span>
                <span>
                  {SLOTS[block.start].label}
                  {block.end !== block.start ? `–${SLOTS[block.end].label}` : ""}
                </span>
                {isCancelled && (
                  <span className="badge-cancelled-pill">
                    ❌ Class Cancelled by Instructor
                  </span>
                )}
              </div>

              {entry.isMakeup && !isCancelled && entry.makeupNote && (
                <p className="makeup-note-text" style={{ margin: "0.25rem 0 0.45rem" }}>
                  Note from instructor: &ldquo;{entry.makeupNote}&rdquo;
                </p>
              )}

              {isCancelled && cancellationRecord && (
                <div className="cancelled-class-notice-box">
                  <p className="cancelled-notice-text">
                    <strong>Notice:</strong> This lecture has been officially cancelled.
                    {cancellationRecord.reason ? ` Reason: "${cancellationRecord.reason}"` : ""}
                  </p>
                  <span className="room-freed-indicator">
                    🟢 Venue <strong>{room || cancellationRecord.roomName}</strong> is freed and available for study.
                  </span>
                </div>
              )}

              <p className={`subject ${isCancelled ? "subject-cancelled" : ""}`}>
                <span style={{ textDecoration: isCancelled ? "line-through" : undefined, opacity: isCancelled ? 0.7 : 1 }}>
                  {subjects[entry.subject]}
                </span>
                <span className="flags">
                  {entry.repeater ? <span className="flag">Repeater</span> : null}
                  {live && !isCancelled ? <span className="flag now">Now</span> : null}
                </span>
              </p>
              <div className="links class-meta">
                {who === "batch" && person ? (
                  <button
                    type="button"
                    className="btn tap"
                    onClick={() => open({ type: "teacher", id: entry.teacher })}
                  >
                    {person}
                  </button>
                ) : null}
                {who === "teacher" ? (
                  <button
                    type="button"
                    className="btn tap"
                    onClick={() => open({ type: "batch", id: entry.batch })}
                  >
                    {batch}
                  </button>
                ) : null}
                {room ? (
                  <button
                    type="button"
                    className="btn tap"
                    onClick={() => open({ type: "room", id: entry.room })}
                  >
                    {room}
                  </button>
                ) : null}
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
