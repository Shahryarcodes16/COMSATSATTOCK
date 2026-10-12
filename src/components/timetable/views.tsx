import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  CalendarDays,
  Clock,
  DoorOpen,
  GraduationCap,
  Pin,
  Printer,
  Search,
  Users,
} from "lucide-react";
import { DayPicker, DaySlotBar, Segment } from "@/components/timetable/chrome";
import { ClassList } from "@/components/timetable/class-list";
import { useDesk } from "@/components/timetable/context";
import { WeekGrid } from "@/components/timetable/week-grid";
import { CopySchedule } from "@/components/timetable/copy-schedule";
import { NextClassPanel } from "@/components/timetable/next-class";
import {
  ROOM_GROUPS,
  WEEK_CELLS,
  at,
  batches,
  batchesInProgram,
  batchLoad,
  clockFace,
  DAYS,
  SLOTS,
  rangeLabel,
  forBatch,
  forRoom,
  forSubject,
  forTeacher,
  groupBySlot,
  isFree,
  mutualFree,
  programs,
  roomGroup,
  rooms,
  searchCatalog,
  summarize,
  teachers,
  teachingLoad,
  teachingHours,
  type RoomGroup,
} from "@/lib/schedule";

function Meter({ value }: { value: number }) {
  return (
    <div className="meter" aria-hidden>
      <span style={{ width: `${Math.round((value / WEEK_CELLS) * 100)}%` }} />
    </div>
  );
}

function initials(name: string) {
  return name
    .replace(/\b(Prof|Dr|Mr|Ms)\.?\s*/g, "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("");
}

export function TodayView() {
  const {
    now,
    clock,
    ready,
    day,
    slot,
    pinnedBatch,
    pinBatch,
    batchId,
    setBatchId,
    pinnedTeachers,
    open,
    setView,
  } = useDesk();
  const cell = at(day, slot);
  const busyRooms = new Set(cell.map((entry) => entry.room).filter((id) => id >= 0));
  const busyTeachers = new Set(cell.map((entry) => entry.teacher).filter((id) => id >= 0));
  const mine = pinnedBatch === null ? [] : forBatch(pinnedBatch);
  const currentLecture = ready && clock.dayIndex === day && clock.liveSlot === slot;
  const availabilityWindow = `${DAYS[day]} · ${SLOTS[slot].label}`;

  return (
    <div className="page today-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">COMSATS University Islamabad · Attock Campus</p>
          <h1 className="page-title">Campus overview</h1>
          <p className="quiet">Your schedule. Your spaces. Your next move.</p>
        </div>
        <span className="term-badge">Timetable · 5 Oct 2026</span>
      </div>
      <section className="campus-overview">
        <div className="overview-copy">
          <span className="campus-badge">
            <GraduationCap size={16} aria-hidden />
            Attock campus timetable
          </span>
          <h2>
            A little more clarity.
            <br />A lot less rushing.
          </h2>
          <p>Know where to be, find a free room, and make time to connect.</p>
          <div className="overview-actions">
            <button type="button" className="btn" onClick={() => setView("batches")}>
              <CalendarDays size={16} aria-hidden />
              Explore schedules
            </button>
            <button type="button" className="overview-link" onClick={() => setView("find")}>
              Find on campus <ArrowUpRight size={16} aria-hidden />
            </button>
          </div>
        </div>
        <div className="overview-clock">
          <p className="kicker">
            <i className={clock.phase === "live" ? "pip live" : "pip"} aria-hidden />
            Islamabad time
          </p>
          <p className="display">{clock.phase === "loading" ? "–:–" : clockFace(now)}</p>
          <span className="clock-zone">PKT · UTC+5</span>
          <p className="clock-state">{clock.headline}</p>
          <span className="clock-detail">{clock.detail}</span>
        </div>
      </section>
      <section className="overview-availability" aria-label="Campus availability">
        <div className="availability-heading">
          <div>
            <p className="eyebrow">Choose a day & lecture</p>
            <h2>Find your window</h2>
          </div>
          <span className="fine">Availability follows the published timetable.</span>
        </div>
        <DaySlotBar />
        <div className="availability-context" aria-live="polite" aria-atomic="true">
          <span className="availability-mode">
            <Clock size={14} aria-hidden />
            {currentLecture ? "Current lecture" : "Selected timetable slot"}
          </span>
          <p>
            Counts below are for <strong>{availabilityWindow}</strong>, {rangeLabel(slot)} PKT.
          </p>
        </div>
        <div className="stats">
          <button type="button" className="stat tap" onClick={() => setView("batches")}>
            <span className="stat-icon">
              <Users size={20} aria-hidden />
            </span>
            <div>
              <b>{ready ? cell.length : "—"}</b>
              <span>Batch listings</span>
              <small className="stat-window">{availabilityWindow} · {rangeLabel(slot)}</small>
            </div>
            <ArrowUpRight size={18} aria-hidden />
          </button>
          <button type="button" className="stat tap" onClick={() => setView("rooms")}>
            <span className="stat-icon">
              <DoorOpen size={20} aria-hidden />
            </span>
            <div>
              <b>{ready ? rooms.length - busyRooms.size : "—"}</b>
              <span>Rooms free</span>
              <small className="stat-window">{availabilityWindow} · {rangeLabel(slot)}</small>
            </div>
            <ArrowUpRight size={18} aria-hidden />
          </button>
          <button type="button" className="stat tap" onClick={() => setView("faculty")}>
            <span className="stat-icon">
              <GraduationCap size={20} aria-hidden />
            </span>
            <div>
              <b>{ready ? teachers.length - busyTeachers.size : "—"}</b>
              <span>Faculty free</span>
              <small className="stat-window">{availabilityWindow} · {rangeLabel(slot)}</small>
            </div>
            <ArrowUpRight size={18} aria-hidden />
          </button>
        </div>
      </section>
      <div className="today-layout">
        <section className="panel my-batch-panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Your schedule</p>
              <h2>My batch</h2>
            </div>
            {pinnedBatch !== null ? (
              <button type="button" className="btn tap" onClick={() => pinBatch(null)}>
                Change batch
              </button>
            ) : null}
          </div>
          {!ready ? (
            <p className="quiet">Opening your timetable…</p>
          ) : pinnedBatch === null ? (
            <div className="empty-state stack">
              <Users size={28} aria-hidden />
              <h3>Make this timetable yours</h3>
              <p className="quiet">
                Choose your batch to see your classes here every time you visit.
              </p>
              <label className="stack">
                <span className="field-label">Your batch</span>
                <select
                  className="select"
                  value={batchId}
                  onChange={(event) => setBatchId(Number(event.target.value))}
                >
                  {programs.map((program) => (
                    <optgroup key={program} label={program}>
                      {batchesInProgram(program).map((id) => (
                        <option key={id} value={id}>
                          {batches[id]}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </label>
              <button type="button" className="btn solid tap" onClick={() => pinBatch(batchId)}>
                <Pin size={16} aria-hidden />
                Save my batch
              </button>
            </div>
          ) : (
            <div className="stack">
              <p className="batch-heading">
                {batches[pinnedBatch]} <span>{DAYS[day]}</span>
              </p>
              <ClassList list={mine} day={day} who="batch" />
              <button
                type="button"
                className="btn solid tap"
                onClick={() => {
                  setBatchId(pinnedBatch);
                  setView("batches");
                }}
              >
                Open the full week <ArrowUpRight size={16} aria-hidden />
              </button>
            </div>
          )}
        </section>
        <div className="today-side stack">
          <NextClassPanel />
          <section className="panel">
            <div className="panel-head">
              <h2>Saved faculty</h2>
              <button type="button" className="btn tap" onClick={() => setView("faculty")}>
                Faculty
              </button>
            </div>
            {pinnedTeachers.length === 0 ? (
              <p className="quiet">
                Save a faculty member from their schedule to see their availability here.
              </p>
            ) : (
              <div className="stack">
                {pinnedTeachers.map((id) => {
                  const hits = groupBySlot(forTeacher(id), day, slot);
                  return (
                    <button
                      key={id}
                      type="button"
                      className="watch tap"
                      onClick={() => open({ type: "teacher", id })}
                    >
                      <span>
                        <b>{teachers[id]}</b>
                        <span className="sub">
                          {hits.length === 0 ? "Free this lecture" : summarize(hits)}
                        </span>
                      </span>
                      <Clock size={16} aria-hidden />
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>
      <p className="fine">
        Only rooms and teachers on the published sheet are listed. Make-up classes are not included,
        so confirm before you go.
      </p>
    </div>
  );
}

export function RoomsView() {
  const { day, slot, open } = useDesk();
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<"free" | "busy">("free");
  const [group, setGroup] = useState<"All" | RoomGroup>("All");
  const [span, setSpan] = useState<1 | 2>(1);
  const effectiveSpan: 1 | 2 = slot === 4 ? 1 : span;

  const occupied = useMemo(() => {
    const map = new Map<number, ReturnType<typeof at>>();
    for (const entry of [...at(day, slot), ...(effectiveSpan === 2 ? at(day, slot + 1) : [])]) {
      if (entry.room < 0) continue;
      const list = map.get(entry.room);
      if (list) list.push(entry);
      else map.set(entry.room, [entry]);
    }
    return map;
  }, [day, slot, effectiveSpan]);

  const needle = query.trim().toLowerCase();
  const matched = rooms
    .map((label, id) => ({ id, label }))
    .filter((room) => (group === "All" ? true : roomGroup(room.label) === group))
    .filter((room) => room.label.toLowerCase().includes(needle));

  const free = matched.filter((room) => isFree(forRoom(room.id), day, slot, effectiveSpan));
  const busy = matched.filter((room) => !isFree(forRoom(room.id), day, slot, effectiveSpan));

  return (
    <div className="page rooms-page">
      <div className="panel-head">
        <div>
          <p className="eyebrow">Find your space</p>
          <h1 className="page-title">Rooms</h1>
          <p className="quiet">Find an available room for the lecture you choose.</p>
        </div>
      </div>
      <DaySlotBar />
      {day === 2 && slot === 1 ? (
        <p className="note">
          Wednesday 10:00–11:30 is the activity slot. A few regular classes are still on the sheet,
          so free counts follow those listings.
        </p>
      ) : null}
      <label className="search">
        <Search size={18} aria-hidden />
        <input
          type="search"
          value={query}
          aria-label="Search rooms"
          placeholder="Search a room"
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      <div className="chips" role="group" aria-label="Room type">
        {(["All", ...ROOM_GROUPS] as const).map((item) => (
          <button
            key={item}
            type="button"
            aria-pressed={group === item}
            className={group === item ? "chip on" : "chip"}
            onClick={() => setGroup(item)}
          >
            {item === "Lecture halls"
              ? "Halls"
              : item === "Lecture theatres"
                ? "Theatres"
                : item === "Classrooms"
                  ? "Classrooms"
                  : item === "Labs"
                    ? "Labs"
                    : "All"}
          </button>
        ))}
      </div>
      <Segment
        label="How long the room should be free"
        value={effectiveSpan === 2 ? "2" : "1"}
        onChange={(value) => setSpan(value === "2" ? 2 : 1)}
        options={[
          { value: "1", label: "This lecture" },
          { value: "2", label: "And the next", disabled: slot === 4 },
        ]}
      />
      <Segment
        label="Free or busy"
        value={mode}
        onChange={(value) => setMode(value === "busy" ? "busy" : "free")}
        options={[
          { value: "free", label: `Free ${free.length}` },
          { value: "busy", label: `Busy ${busy.length}` },
        ]}
      />
      {mode === "free" ? (
        free.length === 0 ? (
          <p className="quiet">No open room matches this filter.</p>
        ) : (
          ROOM_GROUPS.map((name) => {
            const list = free.filter((room) => roomGroup(room.label) === name);
            if (list.length === 0) return null;
            return (
              <section key={name}>
                <h2 className="group-label">
                  {name}
                  <span>{list.length}</span>
                </h2>
                <div className="tile-grid">
                  {list.map((room) => (
                    <button
                      key={room.id}
                      type="button"
                      className="tile tap"
                      onClick={() => open({ type: "room", id: room.id })}
                    >
                      <span className="room-icon">
                        <DoorOpen size={19} aria-hidden />
                      </span>
                      <span className="room-copy">
                        <b>{room.label}</b>
                        <span>
                          Available this {effectiveSpan === 2 ? "and next lecture" : "lecture"}
                        </span>
                      </span>
                      <ArrowUpRight size={16} className="card-arrow" aria-hidden />
                    </button>
                  ))}
                </div>
              </section>
            );
          })
        )
      ) : busy.length === 0 ? (
        <p className="quiet">No busy room matches this filter.</p>
      ) : (
        <div className="stack">
          {busy.map((room) => (
            <button
              key={room.id}
              type="button"
              className="busy-row tap"
              onClick={() => open({ type: "room", id: room.id })}
            >
              <b>{room.label}</b>
              <span>{summarize(occupied.get(room.id) ?? [])}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function FacultyView() {
  const { day, slot, open, pinnedTeachers } = useDesk();
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<"free" | "busy">("free");
  const [sort, setSort] = useState<"az" | "light">("az");
  const needle = query.trim().toLowerCase();

  const occupied = useMemo(() => {
    const map = new Map<number, ReturnType<typeof at>>();
    for (const entry of at(day, slot)) {
      if (entry.teacher < 0) continue;
      const list = map.get(entry.teacher);
      if (list) list.push(entry);
      else map.set(entry.teacher, [entry]);
    }
    return map;
  }, [day, slot]);

  const order = (left: number, right: number) => {
    if (sort === "light") {
      const diff = teachingLoad(left) - teachingLoad(right);
      if (diff !== 0) return diff;
    }
    return teachers[left].localeCompare(teachers[right]);
  };

  const matched = teachers
    .map((label, id) => ({ id, label }))
    .filter((person) => person.label.toLowerCase().includes(needle))
    .sort((a, b) => order(a.id, b.id));
  const free = matched.filter((person) => isFree(forTeacher(person.id), day, slot, 1));
  const busy = matched.filter((person) => occupied.has(person.id));

  return (
    <div className="page faculty-page">
      <div className="panel-head">
        <div>
          <p className="eyebrow">Connect on campus</p>
          <h1 className="page-title">Faculty</h1>
          <p className="quiet">Explore teaching schedules and free lectures.</p>
        </div>
      </div>
      <DaySlotBar />
      <label className="search">
        <Search size={18} aria-hidden />
        <input
          type="search"
          value={query}
          aria-label="Search faculty"
          placeholder="Search faculty"
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      <Segment
        label="Sort"
        value={sort}
        onChange={(value) => setSort(value === "light" ? "light" : "az")}
        options={[
          { value: "az", label: "A to Z" },
          { value: "light", label: "Lightest week" },
        ]}
      />
      <Segment
        label="Free or busy"
        value={mode}
        onChange={(value) => setMode(value === "busy" ? "busy" : "free")}
        options={[
          { value: "free", label: `Free ${free.length}` },
          { value: "busy", label: `Busy ${busy.length}` },
        ]}
      />
      {mode === "free" ? (
        free.length === 0 ? (
          <p className="quiet">No free faculty member matches this search.</p>
        ) : (
          <div className="people">
            {free.map((person) => (
              <button
                key={person.id}
                type="button"
                className="person tap"
                onClick={() => open({ type: "teacher", id: person.id })}
              >
                <span className="avatar" aria-hidden>
                  {initials(person.label)}
                </span>
                <span className="person-copy">
                  <b>{person.label}</b>
                  <span>
                    {teachingHours(person.id)} teaching hours / week
                    {pinnedTeachers.includes(person.id) ? " · Saved" : ""}
                  </span>
                </span>
                <span className="availability-tag">Free</span>
              </button>
            ))}
          </div>
        )
      ) : busy.length === 0 ? (
        <p className="quiet">Nobody matching this search is teaching right then.</p>
      ) : (
        <div className="stack">
          {busy.map((person) => (
            <button
              key={person.id}
              type="button"
              className="busy-row tap"
              onClick={() => open({ type: "teacher", id: person.id })}
            >
              <b>{person.label}</b>
              <span>{summarize(occupied.get(person.id) ?? [])}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function BatchesView() {
  const { batchId, setBatchId, day, setDay, clock, pinBatch, pinnedBatch } = useDesk();
  const [program, setProgram] = useState("All");
  const ids = batchesInProgram(program);
  const list = forBatch(batchId);

  useEffect(() => {
    const next = batchesInProgram(program);
    if (!next.includes(batchId)) setProgram("All");
  }, [program, batchId, setBatchId]);

  return (
    <div className="page batches-page">
      <p className="print-batch-title">{batches[batchId]} · Timetable from 5 October 2026</p>
      <div className="panel-head">
        <div>
          <p className="eyebrow">Plan your week</p>
          <h1 className="page-title">Batch schedules</h1>
          <p className="quiet">Your classes, from Monday to Friday.</p>
        </div>
        <button
          type="button"
          className="btn tap"
          aria-pressed={pinnedBatch === batchId}
          onClick={() => pinBatch(pinnedBatch === batchId ? null : batchId)}
        >
          <Pin size={16} aria-hidden />
          {pinnedBatch === batchId ? "Pinned" : "Pin"}
        </button>
      </div>
      <section className="batch-controls panel" aria-label="Choose your batch and day">
        <div className="chips" aria-label="Programme">
          {["All", ...programs].map((item) => (
            <button
              key={item}
              type="button"
              aria-pressed={program === item}
              className={program === item ? "chip on" : "chip"}
              onClick={() => {
                setProgram(item);
                const next = batchesInProgram(item);
                if (!next.includes(batchId) && next[0] !== undefined) setBatchId(next[0]);
              }}
            >
              {item.replace("BS(", "").replace(")", "")}
            </button>
          ))}
        </div>
        <div className="batch-selection">
          <label className="batch-picker stack">
            <span className="field-label">Batch</span>
            <select
              className="select"
              aria-label="Choose batch"
              value={ids.includes(batchId) ? batchId : (ids[0] ?? batchId)}
              onChange={(event) => setBatchId(Number(event.target.value))}
            >
              {(program === "All" ? programs : [program]).map((name) => (
                <optgroup key={name} label={name}>
                  {batchesInProgram(name).map((id) => (
                    <option key={id} value={id}>
                      {batches[id]}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
          <div className="batch-load stack">
            <p className="quiet">
              {batchLoad(batchId)} / {WEEK_CELLS} lecture slots scheduled
            </p>
            <Meter value={batchLoad(batchId)} />
          </div>
        </div>
        <DayPicker />
      </section>
      <WeekGrid
        list={list}
        onDayChange={setDay}
        focusDay={day}
        liveDay={clock.dayIndex}
        liveSlot={clock.liveSlot}
        caption={(entry) =>
          [
            entry.teacher >= 0 ? teachers[entry.teacher] : "",
            entry.room >= 0 ? rooms[entry.room] : "",
          ]
            .filter(Boolean)
            .join(" · ")
        }
      />
      <section className="daily-summary stack">
        <h2 className="section-title">
          {DAYS[day]} · {batches[batchId]}
        </h2>
        <ClassList list={list} day={day} who="batch" />
      </section>
      <div className="row-actions noprint">
        <CopySchedule key={batchId} title={batches[batchId]} list={list} />
        <button type="button" className="btn tap" onClick={() => window.print()}>
          <Printer size={16} aria-hidden />
          Print
        </button>
      </div>
    </div>
  );
}

function HitGroup({
  title,
  hits,
  onOpen,
}: {
  title: string;
  hits: { id: number; label: string }[];
  onOpen: (id: number) => void;
}) {
  if (hits.length === 0) return null;
  return (
    <section className="stack">
      <h2 className="group-label">
        {title}
        <span>{hits.length} matches</span>
      </h2>
      {hits.map((hit) => (
        <button
          key={`${title}-${hit.id}`}
          type="button"
          className="hit tap"
          onClick={() => onOpen(hit.id)}
        >
          {hit.label}
          {title === "Subjects" ? <small>{forSubject(hit.id).length} offerings</small> : null}
        </button>
      ))}
    </section>
  );
}

export function FindView() {
  const { open, setView, setBatchId, day, slot } = useDesk();
  const [query, setQuery] = useState("");
  const [meet, setMeet] = useState<"teachers" | "batch">("teachers");
  const [left, setLeft] = useState("");
  const [right, setRight] = useState("");
  const hits = searchCatalog(query);

  const leftId = left === "" ? -1 : Number(left);
  const rightId = right === "" ? -1 : Number(right);
  const ready = leftId >= 0 && rightId >= 0 && (meet === "batch" || leftId !== rightId);
  const free = ready
    ? mutualFree(meet === "teachers" ? forTeacher(leftId) : forBatch(leftId), forTeacher(rightId))
    : [];
  const freeNow = free.some((cell) => cell.day === day && cell.slot === slot);

  return (
    <div className="page search-page">
      <div className="panel-head">
        <div>
          <p className="eyebrow">Everything on the timetable</p>
          <h1 className="page-title">Search & meet</h1>
          <p className="quiet">Find a class or a shared free lecture.</p>
        </div>
      </div>
      <label className="search">
        <Search size={18} aria-hidden />
        <input
          type="search"
          value={query}
          aria-label="Search subjects, faculty, rooms, or batches"
          placeholder="Subject, teacher, room, or batch"
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      {query.trim() ? (
        <div className="stack">
          <HitGroup
            title="Batches"
            hits={hits.batches}
            onOpen={(id) => {
              setBatchId(id);
              setView("batches");
            }}
          />
          <HitGroup
            title="Faculty"
            hits={hits.teachers}
            onOpen={(id) => open({ type: "teacher", id })}
          />
          <HitGroup title="Rooms" hits={hits.rooms} onOpen={(id) => open({ type: "room", id })} />
          <HitGroup
            title="Subjects"
            hits={hits.subjects}
            onOpen={(id) => open({ type: "subject", id })}
          />
          {hits.batches.length + hits.teachers.length + hits.rooms.length + hits.subjects.length ===
          0 ? (
            <p className="quiet">Nothing on the sheet matches that.</p>
          ) : null}
        </div>
      ) : (
        <section className="panel stack">
          <h2>When are they both free?</h2>
          <p className="quiet">
            Pick two teachers, or a batch and a teacher, and see the lectures where neither is
            already booked.
          </p>
          <Segment
            label="Who to compare"
            value={meet}
            onChange={(value) => {
              setMeet(value === "batch" ? "batch" : "teachers");
              setLeft("");
              setRight("");
            }}
            options={[
              { value: "teachers", label: "Two teachers" },
              { value: "batch", label: "Batch and teacher" },
            ]}
          />
          <label className="stack">
            <span className="quiet">{meet === "batch" ? "Batch" : "First teacher"}</span>
            <select
              className="select"
              value={left}
              onChange={(event) => setLeft(event.target.value)}
            >
              <option value="">Choose</option>
              {meet === "batch"
                ? batches.map((label, id) => (
                    <option key={label} value={id}>
                      {label}
                    </option>
                  ))
                : teachers.map((label, id) => (
                    <option key={label} value={id}>
                      {label}
                    </option>
                  ))}
            </select>
          </label>
          <label className="stack">
            <span className="quiet">{meet === "batch" ? "Teacher" : "Second teacher"}</span>
            <select
              className="select"
              value={right}
              onChange={(event) => setRight(event.target.value)}
            >
              <option value="">Choose</option>
              {teachers.map((label, id) => (
                <option key={label} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          {ready ? (
            <>
              <p className="quiet">
                {free.length} shared free lecture{free.length === 1 ? "" : "s"} this week.
                {freeNow ? " Both are free in the lecture you are viewing." : ""}
              </p>
              <div className="free-grid" role="table" aria-label="Shared free lectures">
                <div className="week-row" role="row">
                  <span className="hd" role="columnheader">
                    Slot
                  </span>
                  {["Mon", "Tue", "Wed", "Thu", "Fri"].map((label, index) => (
                    <span key={`${label}${index}`} className="hd" role="columnheader">
                      {label}
                    </span>
                  ))}
                </div>
                {["L1", "L2", "L3", "L4", "L5"].map((label, slotIndex) => (
                  <div key={label} className="week-row" role="row">
                    <span className="hd" role="rowheader">
                      {label}
                    </span>
                    {[0, 1, 2, 3, 4].map((dayIndex) => {
                      const openCell = free.some(
                        (cell) => cell.day === dayIndex && cell.slot === slotIndex,
                      );
                      return (
                        <i
                          key={dayIndex}
                          role="cell"
                          aria-label={`${DAYS[dayIndex]} ${label}: ${openCell ? "free" : "busy"}`}
                          className={openCell ? "open" : "shut"}
                        >
                          {openCell ? "Free" : "Busy"}
                        </i>
                      );
                    })}
                  </div>
                ))}
              </div>
            </>
          ) : null}
        </section>
      )}
    </div>
  );
}
