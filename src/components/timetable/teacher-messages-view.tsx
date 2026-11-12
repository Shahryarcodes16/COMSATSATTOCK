import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  Clock,
  DoorOpen,
  GraduationCap,
  Megaphone,
  MessageSquareText,
  RefreshCw,
  RotateCcw,
  Search,
  Sparkles,
  Users,
} from "lucide-react";
import { useDesk } from "@/components/timetable/context";
import {
  getClassCancellations,
  isCancellationForToday,
  matchesStudentCancellationContext,
  removeClassCancellation,
  syncCancellationsFromServer,
  type ClassCancellationRecord,
} from "@/lib/campus-pulse";
import { getActiveStudentSession, type StudentSession } from "@/lib/student";
import { getActiveFacultySession, type FacultySession } from "@/lib/faculty-auth";
import { loadCustomSchedule } from "@/lib/my-schedule";
import {
  getActiveArrangedMakeupClasses,
  type MakeupClassRecord,
} from "@/lib/makeup-classes";
import {
  DAYS,
  SLOTS,
  batches,
  rooms,
  subjects,
  teachers,
  type ClassEntry,
} from "@/lib/schedule";
import { CAMPUS_TIME_ZONE } from "@/lib/campus";

type MessageTab = "mine" | "today" | "makeups";

function formatCancelledTime(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleTimeString("en-PK", {
      timeZone: CAMPUS_TIME_ZONE,
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export function TeacherMessagesView() {
  const { now, pinnedBatch, batchId, setBatchId, setView, open } = useDesk();
  const [cancellations, setCancellations] = useState<ClassCancellationRecord[]>(() =>
    getClassCancellations().filter((c) => c.status === "active"),
  );
  const [makeups, setMakeups] = useState<MakeupClassRecord[]>(() =>
    getActiveArrangedMakeupClasses(now || new Date()),
  );
  const [studentSession, setStudentSession] = useState<StudentSession | null>(() =>
    getActiveStudentSession(),
  );
  const [facultySession, setFacultySession] = useState<FacultySession | null>(() =>
    getActiveFacultySession(),
  );
  const [customSchedule, setCustomSchedule] = useState<ClassEntry[]>(() =>
    loadCustomSchedule(),
  );
  const [activeTab, setActiveTab] = useState<MessageTab>("mine");
  const [searchQuery, setSearchQuery] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const updated = await syncCancellationsFromServer();
      setCancellations(updated.filter((c) => c.status === "active"));
      setMakeups(getActiveArrangedMakeupClasses(new Date()));
    } finally {
      setTimeout(() => setIsRefreshing(false), 300);
    }
  };

  useEffect(() => {
    syncCancellationsFromServer().then((list) => {
      if (Array.isArray(list)) {
        setCancellations(list.filter((c) => c.status === "active"));
      }
    });

    const onCancelUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<ClassCancellationRecord[]>;
      const list = customEvent.detail || getClassCancellations();
      setCancellations(list.filter((c) => c.status === "active"));
    };
    const onMakeupUpdate = () => {
      setMakeups(getActiveArrangedMakeupClasses(new Date()));
    };
    const onStudentUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<StudentSession | null>;
      setStudentSession(customEvent.detail ?? getActiveStudentSession());
    };
    const onFacultyUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<FacultySession | null>;
      setFacultySession(customEvent.detail ?? getActiveFacultySession());
    };
    const onCustomScheduleUpdate = () => {
      setCustomSchedule(loadCustomSchedule());
    };
    const onStorage = () => {
      setCancellations(getClassCancellations().filter((c) => c.status === "active"));
      setMakeups(getActiveArrangedMakeupClasses(new Date()));
      setStudentSession(getActiveStudentSession());
      setFacultySession(getActiveFacultySession());
      setCustomSchedule(loadCustomSchedule());
    };

    window.addEventListener("cui:class-cancellations-updated", onCancelUpdate);
    window.addEventListener("cui:makeup-classes-updated", onMakeupUpdate);
    window.addEventListener("cui:student-session-update", onStudentUpdate);
    window.addEventListener("cui:faculty-session-update", onFacultyUpdate);
    window.addEventListener("cui:custom-schedule-update", onCustomScheduleUpdate);
    window.addEventListener("storage", onStorage);

    return () => {
      window.removeEventListener("cui:class-cancellations-updated", onCancelUpdate);
      window.removeEventListener("cui:makeup-classes-updated", onMakeupUpdate);
      window.removeEventListener("cui:student-session-update", onStudentUpdate);
      window.removeEventListener("cui:faculty-session-update", onFacultyUpdate);
      window.removeEventListener("cui:custom-schedule-update", onCustomScheduleUpdate);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const refDate = now || new Date();
  const studentBatch = studentSession?.profile?.defaultBatch || null;
  const pinnedBatchName = pinnedBatch !== null ? batches[pinnedBatch] : null;
  const trackedBatchLabel =
    studentBatch || pinnedBatchName || (customSchedule.length > 0 ? "Custom Schedule" : batches[batchId] || "All Batches");

  const hasSavedStudentContext =
    Boolean(studentBatch) || pinnedBatch !== null || customSchedule.length > 0;

  // Cancellations specifically affecting the student's batch/courses OR sent by logged-in faculty
  const myRelevantCancellations = useMemo(() => {
    const teacherId = facultySession?.profile?.teacherId ?? null;
    const teacherName = (
      facultySession?.profile?.timetableName ||
      facultySession?.profile?.fullName ||
      ""
    )
      .toLowerCase()
      .trim();

    return cancellations.filter((c) => {
      if (
        teacherId !== null &&
        (c.teacher === teacherId ||
          (teacherName !== "" && c.teacherName.toLowerCase().trim() === teacherName))
      ) {
        return true;
      }

      return matchesStudentCancellationContext(c, {
        studentBatch,
        pinnedBatch,
        customSchedule,
        activeBatchId: batchId,
        allowFallbackActiveBatch: !hasSavedStudentContext && teacherId === null,
      });
    });
  }, [
    cancellations,
    facultySession,
    studentBatch,
    pinnedBatch,
    customSchedule,
    batchId,
    hasSavedStudentContext,
  ]);

  const myTodayCancellations = useMemo(
    () => myRelevantCancellations.filter((c) => isCancellationForToday(c, refDate)),
    [myRelevantCancellations, refDate],
  );

  const myOtherCancellations = useMemo(
    () => myRelevantCancellations.filter((c) => !isCancellationForToday(c, refDate)),
    [myRelevantCancellations, refDate],
  );

  const allTodayCancellations = useMemo(() => {
    const list = cancellations.filter((c) => isCancellationForToday(c, refDate));
    const q = searchQuery.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (c) =>
        c.teacherName.toLowerCase().includes(q) ||
        c.subjectName.toLowerCase().includes(q) ||
        c.batchName.toLowerCase().includes(q) ||
        c.roomName.toLowerCase().includes(q) ||
        c.reason.toLowerCase().includes(q),
    );
  }, [cancellations, refDate, searchQuery]);

  const relevantMakeups = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return makeups.filter((m) => {
      const bName = (batches[m.batch] || "").toLowerCase();
      const tName = (teachers[m.teacher] || "").toLowerCase();
      const sName = (subjects[m.subject] || "").toLowerCase();
      const rName = (rooms[m.room] || "").toLowerCase();
      if (!q) return true;
      return (
        bName.includes(q) ||
        tName.includes(q) ||
        sName.includes(q) ||
        rName.includes(q) ||
        (m.note || "").toLowerCase().includes(q)
      );
    });
  }, [makeups, searchQuery]);

  const todayDisplayLabel = useMemo(
    () =>
      refDate.toLocaleDateString("en-GB", {
        timeZone: CAMPUS_TIME_ZONE,
        weekday: "long",
        day: "numeric",
        month: "long",
      }),
    [refDate],
  );

  const freedRoomsTodayCount = useMemo(() => {
    const roomSet = new Set(
      allTodayCancellations.map((c) => c.roomName || String(c.room)).filter(Boolean),
    );
    return roomSet.size;
  }, [allTodayCancellations]);

  const renderCancellationCard = (c: ClassCancellationRecord, isTodayItem: boolean) => {
    const slotDef = SLOTS[c.slot];
    const slotTime = slotDef ? `${slotDef.label} (${slotDef.start} – ${slotDef.end})` : `Slot ${c.slot + 1}`;
    const dayLabel = DAYS[c.day] || "Scheduled Day";
    const cancelledTime = formatCancelledTime(c.cancelledAt);
    const isOwnerFaculty =
      facultySession?.profile?.teacherId !== null &&
      facultySession?.profile?.teacherId !== undefined &&
      (facultySession.profile.teacherId === c.teacher ||
        (facultySession.profile.email &&
          facultySession.profile.email.toLowerCase() === c.cancelledByEmail.toLowerCase()));

    return (
      <article key={c.id} className="tm-message-card">
        <div className="tm-card-top">
          <div className="tm-teacher-block">
            <span className="tm-teacher-avatar" aria-hidden>
              <GraduationCap size={18} />
            </span>
            <div>
              <div className="tm-teacher-name-row">
                <strong>{c.teacherName}</strong>
                <span className="tm-status-pill cancelled">
                  {isTodayItem ? "❌ Cancelled Today" : `❌ Cancelled (${dayLabel})`}
                </span>
              </div>
              <span className="tm-meta-line">
                {c.targetDateLabel || dayLabel} · {slotTime}
                {cancelledTime ? ` · Sent at ${cancelledTime}` : ""}
              </span>
            </div>
          </div>
        </div>

        <div className="tm-course-row">
          <span className="tm-course-title">{c.subjectName}</span>
          <span className="tm-batch-chip">
            <Users size={13} aria-hidden />
            {c.batchName}
          </span>
        </div>

        <div className="tm-quote-box">
          <div className="tm-quote-label">
            <MessageSquareText size={14} aria-hidden />
            <span>Message from {c.teacherName}</span>
          </div>
          <p className="tm-quote-text">&ldquo;{c.reason || "Lecture cancelled by instructor."}&rdquo;</p>
        </div>

        <div className="tm-impact-strip">
          <span className="tm-impact-student">
            Students of <strong>{c.batchName}</strong> do not need to attend this slot.
          </span>
          <span className="tm-impact-room">
            🟢 Venue <strong>{c.roomName || "Classroom"}</strong> is FREE
          </span>
        </div>

        <div className="tm-card-actions">
          {c.batch >= 0 && (
            <button
              type="button"
              className="btn sm tap"
              onClick={() => {
                setBatchId(c.batch);
                setView("batches");
              }}
            >
              <CalendarDays size={14} aria-hidden />
              <span>View Batch Timetable</span>
            </button>
          )}
          {c.room >= 0 && (
            <button
              type="button"
              className="btn sm tap"
              onClick={() => open({ type: "room", id: c.room })}
            >
              <DoorOpen size={14} aria-hidden />
              <span>Inspect {c.roomName}</span>
            </button>
          )}
          {c.teacher >= 0 && (
            <button
              type="button"
              className="btn sm tap"
              onClick={() => open({ type: "teacher", id: c.teacher })}
            >
              <ArrowUpRight size={14} aria-hidden />
              <span>Teacher Schedule</span>
            </button>
          )}
          {isOwnerFaculty && (
            <button
              type="button"
              className="btn sm tap tm-undo-btn"
              onClick={() => removeClassCancellation(c.id)}
            >
              <RotateCcw size={14} aria-hidden />
              <span>Restore / Undo Cancellation</span>
            </button>
          )}
        </div>
      </article>
    );
  };

  return (
    <div className="page teacher-messages-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Faculty Broadcasts &amp; Live Alerts</p>
          <h1 className="page-title">Teacher Messages</h1>
          <p className="quiet">
            Official class cancellation messages from instructors and live freed classrooms for{" "}
            <strong>{todayDisplayLabel}</strong>.
          </p>
        </div>
        <div className="tm-header-actions">
          <button
            type="button"
            className="btn tap"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw size={15} className={isRefreshing ? "spin" : undefined} aria-hidden />
            <span>{isRefreshing ? "Syncing..." : "Refresh Messages"}</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="tm-summary-strip">
        <div className="tm-kpi-card highlight">
          <span className="tm-kpi-label">Your Cancelled Classes Today</span>
          <strong className="tm-kpi-value">{myTodayCancellations.length}</strong>
          <span className="tm-kpi-sub">Tracking: {trackedBatchLabel}</span>
        </div>
        <div className="tm-kpi-card">
          <span className="tm-kpi-label">Campus Cancellations Today</span>
          <strong className="tm-kpi-value">{allTodayCancellations.length}</strong>
          <span className="tm-kpi-sub">Across all departments</span>
        </div>
        <div className="tm-kpi-card">
          <span className="tm-kpi-label">Classrooms / Labs Freed</span>
          <strong className="tm-kpi-value">{freedRoomsTodayCount}</strong>
          <span className="tm-kpi-sub">Open for study or make-ups</span>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="tm-tabs-bar" role="tablist" aria-label="Message categories">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "mine"}
          className={`tab-btn tap ${activeTab === "mine" ? "tab-btn-active" : ""}`}
          onClick={() => setActiveTab("mine")}
        >
          <Megaphone size={15} aria-hidden />
          <span>My Class Messages ({myRelevantCancellations.length})</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "today"}
          className={`tab-btn tap ${activeTab === "today" ? "tab-btn-active" : ""}`}
          onClick={() => setActiveTab("today")}
        >
          <AlertTriangle size={15} aria-hidden />
          <span>All Today&apos;s Cancellations ({allTodayCancellations.length})</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "makeups"}
          className={`tab-btn tap ${activeTab === "makeups" ? "tab-btn-active" : ""}`}
          onClick={() => setActiveTab("makeups")}
        >
          <Sparkles size={15} aria-hidden />
          <span>Make-up Notices ({relevantMakeups.length})</span>
        </button>
      </div>

      {/* Search bar for campus-wide & makeup tabs */}
      {activeTab !== "mine" && (
        <label className="search">
          <Search size={18} aria-hidden />
          <input
            type="search"
            value={searchQuery}
            placeholder="Filter by teacher name, subject, batch, room, or message..."
            aria-label="Filter teacher messages"
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </label>
      )}

      {/* TAB 1: MY CLASS MESSAGES (TODAY FIRST, THEN OTHER ACTIVE) */}
      {activeTab === "mine" && (
        <div className="stack">
          {myTodayCancellations.length === 0 && myOtherCancellations.length === 0 ? (
            <section className="panel tm-empty-panel">
              <CheckCircle2 size={34} color="#10b981" aria-hidden />
              <h3>No Cancelled Classes for {trackedBatchLabel}</h3>
              <p className="quiet">
                All your scheduled lectures under your teachers are running normally today. New
                cancellation messages from instructors appear here automatically.
              </p>
              <div className="tm-empty-actions">
                <button
                  type="button"
                  className="btn solid tap"
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                >
                  <RefreshCw size={14} className={isRefreshing ? "spin" : undefined} aria-hidden />
                  <span>Check for New Messages</span>
                </button>
                {allTodayCancellations.length > 0 && (
                  <button
                    type="button"
                    className="btn tap"
                    onClick={() => setActiveTab("today")}
                  >
                    <span>View {allTodayCancellations.length} Campus Cancellation{allTodayCancellations.length > 1 ? "s" : ""} Today</span>
                  </button>
                )}
              </div>
            </section>
          ) : (
            <>
              {myTodayCancellations.length > 0 && (
                <section className="stack">
                  <div className="tm-section-heading">
                    <Clock size={16} aria-hidden />
                    <h2>Today&apos;s Cancelled Classes ({myTodayCancellations.length})</h2>
                  </div>
                  <div className="tm-cards-list">
                    {myTodayCancellations.map((c) => renderCancellationCard(c, true))}
                  </div>
                </section>
              )}

              {myOtherCancellations.length > 0 && (
                <section className="stack">
                  <div className="tm-section-heading">
                    <CalendarDays size={16} aria-hidden />
                    <h2>Active Cancellations for Other Days ({myOtherCancellations.length})</h2>
                  </div>
                  <div className="tm-cards-list">
                    {myOtherCancellations.map((c) => renderCancellationCard(c, false))}
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      )}

      {/* TAB 2: ALL CAMPUS TODAY CANCELLATIONS */}
      {activeTab === "today" && (
        <div className="stack">
          {allTodayCancellations.length === 0 ? (
            <section className="panel tm-empty-panel">
              <CheckCircle2 size={34} color="#10b981" aria-hidden />
              <h3>No Classes Cancelled Today Across Campus</h3>
              <p className="quiet">
                Every lecture scheduled for {todayDisplayLabel} is currently active.
              </p>
            </section>
          ) : (
            <div className="tm-cards-list">
              {allTodayCancellations.map((c) => renderCancellationCard(c, true))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: MAKE-UP CLASS NOTICES */}
      {activeTab === "makeups" && (
        <div className="stack">
          {relevantMakeups.length === 0 ? (
            <section className="panel tm-empty-panel">
              <Sparkles size={32} aria-hidden />
              <h3>No Active Make-up Class Notices</h3>
              <p className="quiet">
                When a teacher schedules a make-up or extra class, their message, room, and slot will appear here.
              </p>
            </section>
          ) : (
            <div className="tm-cards-list">
              {relevantMakeups.map((m) => {
                const tName = teachers[m.teacher] || "Instructor";
                const bName = batches[m.batch] || `Batch #${m.batch}`;
                const sName = subjects[m.subject] || "Make-up Class";
                const rName = rooms[m.room] || "TBA";
                const slotDef = SLOTS[m.slot];
                const slotLabel = slotDef
                  ? `${slotDef.label} (${slotDef.start} – ${slotDef.end})`
                  : `Slot ${m.slot + 1}`;
                return (
                  <article key={m.id} className="tm-message-card makeup">
                    <div className="tm-card-top">
                      <div className="tm-teacher-block">
                        <span className="tm-teacher-avatar makeup" aria-hidden>
                          <Sparkles size={18} />
                        </span>
                        <div>
                          <div className="tm-teacher-name-row">
                            <strong>{tName}</strong>
                            <span className="tm-status-pill makeup">⭐ Make-up Class Arranged</span>
                          </div>
                          <span className="tm-meta-line">
                            {m.targetDateLabel || DAYS[m.day]} · {slotLabel}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="tm-course-row">
                      <span className="tm-course-title">{sName}</span>
                      <span className="tm-batch-chip">
                        <Users size={13} aria-hidden />
                        {bName}
                      </span>
                    </div>

                    {m.note && (
                      <div className="tm-quote-box makeup">
                        <div className="tm-quote-label">
                          <MessageSquareText size={14} aria-hidden />
                          <span>Note from {tName}</span>
                        </div>
                        <p className="tm-quote-text">&ldquo;{m.note}&rdquo;</p>
                      </div>
                    )}

                    <div className="tm-impact-strip">
                      <span className="tm-impact-room">
                        📍 Venue: <strong>{rName}</strong>
                      </span>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
