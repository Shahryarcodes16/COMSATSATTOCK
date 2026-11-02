import { useState, useEffect, useMemo } from "react";
import {
  AlertTriangle,
  Calendar,
  CalendarCheck,
  CalendarPlus,
  Check,
  Clock,
  Download,
  Filter,
  GraduationCap,
  List,
  Mail,
  MapPin,
  Plus,
  Share2,
  Trash2,
  Users,
  X,
  Sparkles,
} from "lucide-react";
import { useDesk } from "@/components/timetable/context";
import { Segment } from "@/components/timetable/chrome";
import { CopySchedule } from "@/components/timetable/copy-schedule";
import { ExportScheduleImage } from "@/components/timetable/schedule-image-modal";
import { WeekGrid } from "@/components/timetable/week-grid";
import {
  DAYS,
  SLOTS,
  batches,
  forBatch,
  programs,
  rangeLabel,
  rooms,
  subjects,
  teachers,
  type ClassEntry,
} from "@/lib/schedule";
import { getFacultyEmail } from "@/lib/faculty";
import {
  downloadIcsFile,
  findScheduleClashes,
  getEntryKey,
  loadCustomSchedule,
  saveCustomSchedule,
  type ScheduleClash,
} from "@/lib/my-schedule";

export function MyScheduleView() {
  const { clock, day: selectedDay, open, setView } = useDesk();
  const [schedule, setSchedule] = useState<ClassEntry[]>([]);
  const [viewTab, setViewTab] = useState<"week" | "today" | "courses">("week");
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isAddClassModalOpen, setIsAddClassModalOpen] = useState(false);
  const [copiedText, setCopiedText] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    setSchedule(loadCustomSchedule());
  }, []);

  // Update schedule & persist
  const updateSchedule = (next: ClassEntry[]) => {
    setSchedule(next);
    saveCustomSchedule(next);
  };

  const removeEntry = (keyToRemove: string) => {
    const next = schedule.filter((e) => getEntryKey(e) !== keyToRemove);
    updateSchedule(next);
  };

  const clearAll = () => {
    if (window.confirm("Are you sure you want to clear your custom schedule?")) {
      updateSchedule([]);
    }
  };

  // Clashes
  const clashes = useMemo(() => findScheduleClashes(schedule), [schedule]);

  // Today's classes
  const todayClasses = useMemo(() => {
    const currentDay = clock.dayIndex !== null ? clock.dayIndex : selectedDay;
    return schedule
      .filter((e) => e.day === currentDay)
      .sort((a, b) => a.slot - b.slot);
  }, [schedule, clock.dayIndex, selectedDay]);

  // Unique courses count
  const uniqueSubjects = useMemo(() => {
    const map = new Map<number, ClassEntry[]>();
    for (const e of schedule) {
      const list = map.get(e.subject) ?? [];
      list.push(e);
      map.set(e.subject, list);
    }
    return map;
  }, [schedule]);

  // Import batch classes
  const handleImportBatch = (batchId: number, replaceExisting: boolean) => {
    const batchClasses = forBatch(batchId);
    if (replaceExisting) {
      updateSchedule(batchClasses);
    } else {
      // Append non-duplicates
      const existingKeys = new Set(schedule.map(getEntryKey));
      const newItems = batchClasses.filter((e) => !existingKeys.has(getEntryKey(e)));
      updateSchedule([...schedule, ...newItems]);
    }
    setIsImportModalOpen(false);
  };

  // Add individual class
  const handleAddClass = (entry: ClassEntry) => {
    const key = getEntryKey(entry);
    const exists = schedule.some((e) => getEntryKey(e) === key);
    if (!exists) {
      updateSchedule([...schedule, entry]);
    }
  };

  return (
    <div className="page my-schedule-page">
      {/* Page Header */}
      <div className="panel-head">
        <div>
          <p className="eyebrow">Personalized Timetable</p>
          <h1 className="page-title">My Schedule</h1>
          <p className="quiet">
            Your custom course timetable with live clash detection, today&apos;s lectures, and 1-click calendar export.
          </p>
        </div>
      </div>

      {/* Action Toolbar */}
      <div className="my-schedule-actions">
        <button
          type="button"
          className="btn solid tap"
          onClick={() => setIsImportModalOpen(true)}
        >
          <Sparkles size={16} aria-hidden />
          <span>Import from Batch</span>
        </button>

        <button
          type="button"
          className="btn tap"
          onClick={() => setIsAddClassModalOpen(true)}
        >
          <Plus size={16} aria-hidden />
          <span>Add Custom Class</span>
        </button>

        {schedule.length > 0 ? (
          <>
            <ExportScheduleImage title="My Custom Schedule" list={schedule} />

            <button
              type="button"
              className="btn tap"
              onClick={() => downloadIcsFile(schedule)}
              title="Download .ics file for Google Calendar, Apple Calendar, Outlook"
            >
              <Download size={16} aria-hidden />
              <span>Export Calendar (.ics)</span>
            </button>

            <CopySchedule title="My Custom Schedule" list={schedule} />

            <button
              type="button"
              className="btn tap my-schedule-clear-btn"
              onClick={clearAll}
              title="Clear all courses from custom schedule"
            >
              <Trash2 size={15} aria-hidden />
              <span>Clear</span>
            </button>
          </>
        ) : null}
      </div>

      {/* Clash Alert Notice */}
      {clashes.length > 0 ? (
        <div className="clash-alert-banner" role="alert">
          <div className="clash-alert-header">
            <AlertTriangle size={18} className="clash-icon" aria-hidden />
            <strong>{clashes.length} Timetable Clash{clashes.length > 1 ? "es" : ""} Detected!</strong>
          </div>
          <p className="fine">
            You have overlapping lectures scheduled at the same time:
          </p>
          <ul className="clash-list">
            {clashes.map((c, idx) => (
              <li key={idx}>
                <b>{DAYS[c.day]} · {SLOTS[c.slot]?.label} ({rangeLabel(c.slot)})</b>:{" "}
                {c.entries.map((e) => subjects[e.subject]).join(" ⚡ clashes with ")}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* Main Tabs */}
      {schedule.length > 0 ? (
        <>
          <div className="faculty-view-tabs" role="tablist" aria-label="Schedule views">
            <button
              type="button"
              role="tab"
              aria-selected={viewTab === "week"}
              className={viewTab === "week" ? "tab-btn tab-btn-active tap" : "tab-btn tap"}
              onClick={() => setViewTab("week")}
            >
              <Calendar size={16} aria-hidden />
              <span>Weekly Grid ({schedule.length} slots)</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={viewTab === "today"}
              className={viewTab === "today" ? "tab-btn tab-btn-active tap" : "tab-btn tap"}
              onClick={() => setViewTab("today")}
            >
              <Clock size={16} aria-hidden />
              <span>Today ({todayClasses.length} lectures)</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={viewTab === "courses"}
              className={viewTab === "courses" ? "tab-btn tab-btn-active tap" : "tab-btn tap"}
              onClick={() => setViewTab("courses")}
            >
              <List size={16} aria-hidden />
              <span>My Courses ({uniqueSubjects.size})</span>
            </button>
          </div>

          {/* TAB 1: Week Grid */}
          {viewTab === "week" ? (
            <div className="my-schedule-week-container">
              <WeekGrid
                list={schedule}
                focusDay={clock.dayIndex ?? 0}
                liveDay={clock.dayIndex}
                liveSlot={clock.liveSlot}
                caption={(entry) =>
                  [
                    batches[entry.batch],
                    entry.room >= 0 ? rooms[entry.room] : "",
                    entry.teacher >= 0 ? teachers[entry.teacher] : "",
                  ]
                    .filter(Boolean)
                    .join(" · ")
                }
              />
            </div>
          ) : null}

          {/* TAB 2: Today's Lectures */}
          {viewTab === "today" ? (
            <div className="my-schedule-today-view stack">
              <p className="quiet">
                Showing scheduled lectures for{" "}
                <b>{DAYS[clock.dayIndex !== null ? clock.dayIndex : selectedDay]}</b>.
              </p>

              {todayClasses.length === 0 ? (
                <div className="directory-empty">
                  <CalendarCheck size={32} className="quiet" aria-hidden />
                  <p className="bold">No lectures scheduled for today!</p>
                  <p className="fine quiet">
                    Enjoy your free day or prepare for your upcoming classes.
                  </p>
                </div>
              ) : (
                <div className="today-class-list">
                  {todayClasses.map((entry) => {
                    const isLive =
                      clock.dayIndex === entry.day && clock.liveSlot === entry.slot;
                    const isPast =
                      clock.dayIndex === entry.day &&
                      clock.liveSlot !== null &&
                      entry.slot < clock.liveSlot;
                    const teacherName = entry.teacher >= 0 ? teachers[entry.teacher] : null;
                    const email = entry.teacher >= 0 ? getFacultyEmail(entry.teacher, teacherName ?? "") : null;
                    const roomName = entry.room >= 0 ? rooms[entry.room] : "Room TBA";

                    return (
                      <div
                        key={getEntryKey(entry)}
                        className={`today-card ${isLive ? "today-live" : ""} ${isPast ? "today-past" : ""}`}
                      >
                        <div className="today-time-badge">
                          <span className="slot-badge">{SLOTS[entry.slot]?.label}</span>
                          <span className="time-range">{rangeLabel(entry.slot)}</span>
                          {isLive ? <span className="live-pill">In Progress</span> : null}
                          {isPast ? <span className="past-pill">Finished</span> : null}
                        </div>

                        <div className="today-class-info">
                          <h3 className="course-title">
                            {subjects[entry.subject]}
                            {entry.repeater ? (
                              <span className="repeater-tag">Repeater</span>
                            ) : null}
                          </h3>

                          <div className="meta-tags">
                            <span className="meta-pill">
                              <MapPin size={13} aria-hidden />
                              <span>{roomName}</span>
                            </span>
                            <span className="meta-pill">
                              <Users size={13} aria-hidden />
                              <span>{batches[entry.batch]}</span>
                            </span>
                            {teacherName ? (
                              <button
                                type="button"
                                className="meta-pill teacher-pill tap"
                                onClick={() => open({ type: "teacher", id: entry.teacher })}
                              >
                                <GraduationCap size={13} aria-hidden />
                                <span>{teacherName}</span>
                              </button>
                            ) : null}
                          </div>

                          {email ? (
                            <a href={`mailto:${email}`} className="quick-email-link">
                              <Mail size={12} aria-hidden />
                              <span>{email}</span>
                            </a>
                          ) : null}
                        </div>

                        <button
                          type="button"
                          className="icon-btn remove-class-btn tap"
                          aria-label="Remove from schedule"
                          title="Remove from My Schedule"
                          onClick={() => removeEntry(getEntryKey(entry))}
                        >
                          <Trash2 size={15} aria-hidden />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : null}

          {/* TAB 3: Enrolled Courses Breakdown */}
          {viewTab === "courses" ? (
            <div className="my-schedule-courses-view stack">
              <p className="quiet">
                You are enrolled in <b>{uniqueSubjects.size}</b> courses across{" "}
                <b>{schedule.length}</b> weekly lecture slots.
              </p>

              <div className="courses-grid">
                {[...uniqueSubjects.entries()].map(([subId, items]) => {
                  const subjectName = subjects[subId];
                  const teachersInCourse = [
                    ...new Set(
                      items
                        .map((e) => (e.teacher >= 0 ? teachers[e.teacher] : null))
                        .filter(Boolean),
                    ),
                  ];
                  const batchesInCourse = [
                    ...new Set(items.map((e) => batches[e.batch])),
                  ];

                  return (
                    <div key={subId} className="course-card">
                      <div className="course-card-top">
                        <h3 className="course-name">{subjectName}</h3>
                        <span className="hours-tag">{items.length * 1.5} hrs / wk</span>
                      </div>

                      <div className="course-card-details">
                        <div className="detail-row">
                          <Users size={14} className="quiet" aria-hidden />
                          <span>{batchesInCourse.join(", ")}</span>
                        </div>
                        {teachersInCourse.length > 0 ? (
                          <div className="detail-row">
                            <GraduationCap size={14} className="quiet" aria-hidden />
                            <span>{teachersInCourse.join(", ")}</span>
                          </div>
                        ) : null}
                      </div>

                      <div className="course-slots-breakdown">
                        <span className="fine quiet">Weekly Slots:</span>
                        <div className="slots-chips-row">
                          {items.map((item) => (
                            <span key={getEntryKey(item)} className="slot-chip">
                              <b>{DAYS[item.day].slice(0, 3)}</b>: {SLOTS[item.slot]?.label} ({rooms[item.room] ?? "Room"})
                            </span>
                          ))}
                        </div>
                      </div>

                      <button
                        type="button"
                        className="btn tap remove-course-btn"
                        onClick={() => {
                          const keys = new Set(items.map(getEntryKey));
                          updateSchedule(schedule.filter((e) => !keys.has(getEntryKey(e))));
                        }}
                      >
                        <Trash2 size={14} aria-hidden />
                        <span>Drop Course ({items.length} classes)</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
        </>
      ) : (
        /* Empty State */
        <div className="my-schedule-empty-state">
          <div className="empty-icon-wrap">
            <CalendarPlus size={44} aria-hidden />
          </div>
          <h2>Create Your Custom Schedule</h2>
          <p className="quiet">
            Build your personalized timetable tailored to your registered courses, electives, and repeat lectures.
          </p>

          <div className="empty-buttons">
            <button
              type="button"
              className="btn solid tap btn-lg"
              onClick={() => setIsImportModalOpen(true)}
            >
              <Sparkles size={18} aria-hidden />
              <span>Import Entire Batch / Section</span>
            </button>
            <button
              type="button"
              className="btn tap btn-lg"
              onClick={() => setIsAddClassModalOpen(true)}
            >
              <Plus size={18} aria-hidden />
              <span>Add Specific Courses</span>
            </button>
          </div>

          <p className="fine quiet">
            💡 Tip: You can import your base section with 1 click, then add repeat subjects or electives from other sections!
          </p>
        </div>
      )}

      {/* MODAL 1: Import Batch Modal */}
      {isImportModalOpen ? (
        <ImportBatchModal
          onClose={() => setIsImportModalOpen(false)}
          onImport={handleImportBatch}
          hasExisting={schedule.length > 0}
        />
      ) : null}

      {/* MODAL 2: Add Class Modal */}
      {isAddClassModalOpen ? (
        <AddClassModal
          onClose={() => setIsAddClassModalOpen(false)}
          onAdd={handleAddClass}
          alreadyAddedKeys={new Set(schedule.map(getEntryKey))}
        />
      ) : null}
    </div>
  );
}

// Sub-component: Import Batch Modal
function ImportBatchModal({
  onClose,
  onImport,
  hasExisting,
}: {
  onClose: () => void;
  onImport: (batchId: number, replace: boolean) => void;
  hasExisting: boolean;
}) {
  const [selectedProgram, setSelectedProgram] = useState("All");
  const [selectedBatch, setSelectedBatch] = useState<number>(0);
  const [mode, setMode] = useState<"replace" | "merge">(hasExisting ? "merge" : "replace");

  const filteredBatches = useMemo(() => {
    return batches
      .map((label, id) => ({ id, label }))
      .filter((b) => selectedProgram === "All" || b.label.startsWith(selectedProgram));
  }, [selectedProgram]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3>Import Batch Timetable</h3>
            <p className="fine quiet">Load all official classes from your main section.</p>
          </div>
          <button type="button" className="icon-btn tap" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="modal-body stack">
          <label className="stack">
            <span className="group-label">Filter Program</span>
            <select
              className="select"
              value={selectedProgram}
              onChange={(e) => setSelectedProgram(e.target.value)}
            >
              {programs.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>

          <label className="stack">
            <span className="group-label">Choose Batch & Section</span>
            <select
              className="select"
              value={selectedBatch}
              onChange={(e) => setSelectedBatch(Number(e.target.value))}
            >
              {filteredBatches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.label} ({forBatch(b.id).length} classes)
                </option>
              ))}
            </select>
          </label>

          {hasExisting ? (
            <div className="stack">
              <span className="group-label">Import Action</span>
              <Segment
                label="Import mode"
                value={mode}
                onChange={(val) => setMode(val as "replace" | "merge")}
                options={[
                  { value: "merge", label: "Add to Current Schedule" },
                  { value: "replace", label: "Replace Everything" },
                ]}
              />
            </div>
          ) : null}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn tap" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn solid tap"
            onClick={() => onImport(selectedBatch, mode === "replace")}
          >
            Import {forBatch(selectedBatch).length} Classes
          </button>
        </div>
      </div>
    </div>
  );
}

// Sub-component: Add Class / Elective Modal
function AddClassModal({
  onClose,
  onAdd,
  alreadyAddedKeys,
}: {
  onClose: () => void;
  onAdd: (entry: ClassEntry) => void;
  alreadyAddedKeys: Set<string>;
}) {
  const [search, setSearch] = useState("");
  const [selectedBatch, setSelectedBatch] = useState<number | "all">("all");

  const candidates = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const result: { entry: ClassEntry; key: string }[] = [];

    for (let b = 0; b < batches.length; b++) {
      if (selectedBatch !== "all" && selectedBatch !== b) continue;
      const list = forBatch(b);
      for (const entry of list) {
        const subName = subjects[entry.subject] || "";
        const teacherName = entry.teacher >= 0 ? teachers[entry.teacher] : "";
        const roomName = entry.room >= 0 ? rooms[entry.room] : "";
        const batchName = batches[entry.batch] || "";

        if (
          !needle ||
          subName.toLowerCase().includes(needle) ||
          teacherName.toLowerCase().includes(needle) ||
          roomName.toLowerCase().includes(needle) ||
          batchName.toLowerCase().includes(needle)
        ) {
          result.push({ entry, key: getEntryKey(entry) });
        }
      }
    }
    return result.slice(0, 50); // limit to top 50 matches
  }, [search, selectedBatch]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-box modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3>Add Course or Elective</h3>
            <p className="fine quiet">Search and add any course from across campus to your schedule.</p>
          </div>
          <button type="button" className="icon-btn tap" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="modal-body stack">
          <div className="modal-search-row">
            <input
              type="search"
              className="search-input-modal"
              value={search}
              placeholder="Search by subject name, teacher, room..."
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />

            <select
              className="select modal-batch-select"
              value={selectedBatch}
              onChange={(e) =>
                setSelectedBatch(e.target.value === "all" ? "all" : Number(e.target.value))
              }
            >
              <option value="all">All Batches</option>
              {batches.map((label, id) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div className="candidate-list">
            {candidates.length === 0 ? (
              <p className="quiet fine" style={{ textAlign: "center", padding: "2rem" }}>
                No courses match that search. Try searching by subject or teacher name.
              </p>
            ) : (
              candidates.map(({ entry, key }) => {
                const added = alreadyAddedKeys.has(key);
                return (
                  <div key={key} className="candidate-row">
                    <div className="candidate-info">
                      <b>{subjects[entry.subject]}</b>
                      <div className="candidate-meta">
                        <span>{DAYS[entry.day]} · {SLOTS[entry.slot]?.label} ({rangeLabel(entry.slot)})</span>
                        <span>· {batches[entry.batch]}</span>
                        {entry.teacher >= 0 ? <span>· {teachers[entry.teacher]}</span> : null}
                        {entry.room >= 0 ? <span>· {rooms[entry.room]}</span> : null}
                        {entry.repeater ? <span className="repeater-tag">Repeater</span> : null}
                      </div>
                    </div>

                    <button
                      type="button"
                      className={`btn tap ${added ? "added-btn" : "solid"}`}
                      disabled={added}
                      onClick={() => onAdd(entry)}
                    >
                      {added ? (
                        <>
                          <Check size={14} /> Added
                        </>
                      ) : (
                        <>
                          <Plus size={14} /> Add
                        </>
                      )}
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn solid tap" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
