import { useState, useMemo, useEffect } from "react";
import {
  BookOpen,
  Calendar,
  CalendarDays,
  CalendarPlus,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  DoorOpen,
  Filter,
  GraduationCap,
  Layers,
  List,
  MapPin,
  Search,
  Share2,
  Sparkles,
  Table,
  Trash2,
  Users,
  X,
  XCircle,
  Bell,
  ChevronRight,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import { useDesk } from "@/components/timetable/context";
import { WeekGrid } from "@/components/timetable/week-grid";
import {
  DAYS,
  DAY_SHORT,
  SLOTS,
  batches,
  rooms,
  teachers,
  subjects,
  forTeacher,
  type ClassEntry,
  type RoomGroup,
} from "@/lib/schedule";
import {
  getActiveFacultySession,
  type FacultySession,
} from "@/lib/faculty-auth";
import {
  computeScheduleOverlap,
  getTeacherClasses,
  getBatchesForTeacher,
  type FreeRoomInfo,
  type SlotComparisonResult,
} from "@/lib/schedule-matcher";
import {
  getArrangedMakeupClasses,
  addMakeupClass,
  removeMakeupClass,
  isMakeupActive,
  computeMakeupTargetAndExpiry,
  type MakeupClassRecord,
} from "@/lib/makeup-classes";
import { facultyUpdateLeadTimeFn } from "@/lib/faculty-server-fn";

export function FacultyWorkspaceView() {
  const { open, now, clock, makeupRevision } = useDesk();
  const [facultySession, setFacultySession] = useState<FacultySession | null>(
    () => getActiveFacultySession(),
  );

  // Tabs: Today's Lectures | Weekly Timetable (Table) | Smart Makeup & Lab Matcher
  const [activeTab, setActiveTab] = useState<"today" | "table" | "makeup">(
    () => (clock.dayIndex !== null && clock.dayIndex >= 0 && clock.dayIndex < 5 ? "today" : "table"),
  );

  // Selected Day for Today's view (defaults to today's weekday if valid, else Monday)
  const currentWeekday = clock.dayIndex !== null && clock.dayIndex >= 0 && clock.dayIndex < 5 ? clock.dayIndex : 0;
  const [selectedDay, setSelectedDay] = useState<number>(currentWeekday);

  // Timetable view mode: "grid" (table) | "agenda" (cards) | "courses" (summary)
  const [tableMode, setTableMode] = useState<"grid" | "agenda" | "courses">("grid");

  // Makeup Matcher view mode on mobile: "matrix" | "cards"
  const [matcherViewMode, setMatcherViewMode] = useState<"matrix" | "cards">("matrix");

  // Makeup Class Matcher State
  const [selectedBatchId, setSelectedBatchId] = useState<number>(() => {
    if (facultySession?.profile?.teacherId !== null && facultySession?.profile?.teacherId !== undefined) {
      const teacherBatches = getBatchesForTeacher(facultySession.profile.teacherId);
      if (teacherBatches.length > 0) return teacherBatches[0];
    }
    return 0;
  });

  const [batchSearch, setBatchSearch] = useState("");
  const [filterOnlyFree, setFilterOnlyFree] = useState(false);
  const [selectedSlotDetails, setSelectedSlotDetails] = useState<SlotComparisonResult | null>(null);
  const [roomCategoryFilter, setRoomCategoryFilter] = useState<"all" | "labs" | "lts" | "crs">("all");
  const [copiedNotice, setCopiedNotice] = useState(false);
  const [leadMins, setLeadMins] = useState(facultySession?.profile?.notificationLeadMins || 10);
  const [updatingLead, setUpdatingLead] = useState(false);

  // Booking Modal State for arranging a makeup class
  const [bookingModalState, setBookingModalState] = useState<{
    slot: SlotComparisonResult;
    room: FreeRoomInfo;
  } | null>(null);
  const [bookingSubjectId, setBookingSubjectId] = useState<number>(0);
  const [bookingNote, setBookingNote] = useState("");
  const [bookingSuccessNotice, setBookingSuccessNotice] = useState<string | null>(null);

  // Sync session changes from storage
  useEffect(() => {
    const handleUpdate = () => {
      const sess = getActiveFacultySession();
      setFacultySession(sess);
      if (sess?.profile?.notificationLeadMins) {
        setLeadMins(sess.profile.notificationLeadMins);
      }
    };
    window.addEventListener("cui:faculty-session-update", handleUpdate);
    window.addEventListener("storage", handleUpdate);
    return () => {
      window.removeEventListener("cui:faculty-session-update", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, []);

  const teacherId = facultySession?.profile?.teacherId ?? null;
  const teacherName =
    facultySession?.profile?.timetableName ||
    facultySession?.profile?.fullName ||
    "Faculty Member";

  // Teacher classes (recomputed when teacherId or makeupRevision changes)
  const teacherClasses = useMemo(() => {
    if (teacherId === null) return [];
    return forTeacher(teacherId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teacherId, makeupRevision]);

  // Makeup classes arranged by this teacher
  const teacherMakeupClasses = useMemo(() => {
    if (teacherId === null) return [];
    return getArrangedMakeupClasses().filter((m) => m.teacher === teacherId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teacherId, makeupRevision]);

  // Classes for the selected day in Today's tab
  const todayDayClasses = useMemo(() => {
    return teacherClasses
      .filter((c) => c.day === selectedDay)
      .sort((a, b) => a.slot - b.slot);
  }, [teacherClasses, selectedDay]);

  // Classes specifically for right now / today
  const actualTodayClasses = useMemo(() => {
    if (clock.dayIndex === null) return [];
    return teacherClasses
      .filter((c) => c.day === clock.dayIndex)
      .sort((a, b) => a.slot - b.slot);
  }, [teacherClasses, clock.dayIndex]);

  // Unique courses taught by this teacher
  const uniqueCourses = useMemo(() => {
    const map = new Map<number, { subjectId: number; classes: ClassEntry[] }>();
    for (const c of teacherClasses) {
      const cur = map.get(c.subject) || { subjectId: c.subject, classes: [] };
      cur.classes.push(c);
      map.set(c.subject, cur);
    }
    return Array.from(map.values());
  }, [teacherClasses]);

  // Batches taught by this teacher
  const taughtBatchIds = useMemo(() => {
    if (teacherId === null) return [];
    return getBatchesForTeacher(teacherId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teacherId, makeupRevision]);

  // Candidate subjects for arranging a makeup class with the selected batch
  const candidateSubjects = useMemo(() => {
    if (teacherId === null) return [];
    const forThisBatch = teacherClasses
      .filter((c) => c.batch === selectedBatchId)
      .map((c) => c.subject);
    const set = new Set(forThisBatch);
    if (set.size > 0) return Array.from(set);
    return Array.from(new Set(teacherClasses.map((c) => c.subject)));
  }, [teacherId, teacherClasses, selectedBatchId]);

  // Compute Schedule Matcher Overlap (recomputes dynamically on makeup updates)
  const comparison = useMemo(() => {
    if (teacherId === null) return null;
    return computeScheduleOverlap(teacherId, selectedBatchId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teacherId, selectedBatchId, makeupRevision]);

  // Flat list of mutual free slots for mobile card view
  const allMutualFreeSlots = useMemo(() => {
    if (!comparison) return [];
    const list: SlotComparisonResult[] = [];
    for (let d = 0; d < 5; d++) {
      for (let s = 0; s < 5; s++) {
        const item = comparison.matrix[d][s];
        if (item.isBothFree) {
          list.push(item);
        }
      }
    }
    return list;
  }, [comparison]);

  // Handle lead time update
  const handleUpdateLeadTime = async (mins: number) => {
    setLeadMins(mins);
    if (!facultySession) return;
    setUpdatingLead(true);
    try {
      const res = await facultyUpdateLeadTimeFn({
        data: {
          email: facultySession.profile.email,
          leadMins: mins,
        },
      });
      if (res.success && res.session) {
        setFacultySession(res.session);
      }
    } catch {
      // Ignore
    } finally {
      setUpdatingLead(false);
    }
  };

  const generateNoticeText = (
    dayIdx: number,
    slotIdx: number,
    roomName: string,
    batchId: number,
    subjectName?: string,
  ) => {
    const dayName = DAYS[dayIdx];
    const slotInfo = SLOTS[slotIdx];
    return (
      `📢 *CUI Attock Extra/Makeup Class Announcement*\n\n` +
      `• *Teacher:* ${teacherName}\n` +
      (subjectName ? `• *Course:* ${subjectName}\n` : "") +
      `• *Class:* ${batches[batchId]}\n` +
      `• *Day & Time:* ${dayName}, ${slotInfo.start} - ${slotInfo.end} (${slotInfo.label})\n` +
      `• *Venue:* ${roomName}\n\n` +
      `Please ensure timely attendance.`
    );
  };

  const handleCopyNotice = (slot: SlotComparisonResult, roomName: string) => {
    const text = generateNoticeText(slot.day, slot.slot, roomName, selectedBatchId);
    navigator.clipboard.writeText(text);
    setCopiedNotice(true);
    setTimeout(() => setCopiedNotice(false), 2500);
  };

  // Confirm and arrange makeup class
  const handleConfirmBooking = () => {
    if (!bookingModalState || !facultySession || teacherId === null) return;
    const { slot, room } = bookingModalState;
    const subjId = bookingSubjectId || candidateSubjects[0] || 0;
    const slotDef = SLOTS[slot.slot];

    addMakeupClass({
      day: slot.day,
      slot: slot.slot,
      batch: selectedBatchId,
      room: room.id,
      teacher: teacherId,
      subject: subjId,
      note: bookingNote.trim() || undefined,
      createdByEmail: facultySession.profile.email,
    });

    const msg = `🎉 Makeup class successfully arranged in ${room.name}! Room ${room.name} and your status are now automatically OCCUPIED until ${slotDef.end}. After ${slotDef.end}, the system will automatically change the status of ${room.name} and your schedule back to FREE. You can also cancel and release the room anytime.`;
    setBookingSuccessNotice(msg);
    setBookingModalState(null);
    setBookingNote("");
    setSelectedSlotDetails(null);

    // Auto-clear success banner after 10 seconds
    setTimeout(() => setBookingSuccessNotice(null), 10000);
  };

  // Cancel an arranged makeup class anytime, releasing room & teacher immediately
  const handleCancelMakeup = (id: string, roomName: string) => {
    if (window.confirm(`Release ${roomName} now? This will cancel the makeup class and immediately restore both ${roomName} and your schedule back to FREE.`)) {
      removeMakeupClass(id);
      setBookingSuccessNotice(`✅ ${roomName} and your schedule have been released and are now FREE.`);
      setTimeout(() => setBookingSuccessNotice(null), 6000);
    }
  };

  // If no faculty member is logged in, show helpful guidance
  if (!facultySession) {
    return (
      <div className="faculty-workspace-gate">
        <div className="faculty-workspace-card">
          <GraduationCap size={48} color="#087f79" />
          <h2>Faculty Workspace & Teaching Desk</h2>
          <p>
            Please sign in with your official CUI Attock faculty email to view your
            personalized teaching timetable, manage pre-class reminders, and discover free
            lecture halls and labs for makeup classes.
          </p>
        </div>
      </div>
    );
  }

  // Filtered batches for quick picker
  const filteredBatches = batches
    .map((name, id) => ({ id, name, taught: taughtBatchIds.includes(id) }))
    .filter((b) => b.name.toLowerCase().includes(batchSearch.toLowerCase()));

  return (
    <div className="faculty-workspace stack">
      {/* Faculty Hero Banner */}
      <section className="faculty-hero-card">
        <div className="faculty-hero-main">
          <div className="faculty-avatar">
            <GraduationCap size={28} />
          </div>
          <div className="faculty-meta">
            <div className="faculty-name-row">
              <h2>{teacherName}</h2>
              <span className="faculty-dept-pill">{facultySession.profile.department}</span>
            </div>
            <p className="faculty-sub">
              Official Faculty Account • {teacherClasses.length} Scheduled Classes/Week
              {teacherMakeupClasses.length > 0 && ` (${teacherMakeupClasses.length} Makeup Classes Active)`}
            </p>
          </div>
        </div>

        {/* Pre-Class Notification Lead Time Settings */}
        <div className="faculty-notification-pref">
          <div className="pref-label">
            <Bell size={14} />
            <span>Pre-Class Reminder:</span>
          </div>
          <div className="pref-options">
            <button
              type="button"
              className={`pref-btn ${leadMins === 5 ? "active" : ""}`}
              onClick={() => handleUpdateLeadTime(5)}
              disabled={updatingLead}
            >
              5 Mins Before
            </button>
            <button
              type="button"
              className={`pref-btn ${leadMins === 10 ? "active" : ""}`}
              onClick={() => handleUpdateLeadTime(10)}
              disabled={updatingLead}
            >
              10 Mins Before
            </button>
          </div>
        </div>
      </section>

      {/* Booking Success Toast Banner */}
      {bookingSuccessNotice && (
        <div className="booking-success-banner">
          <div className="success-banner-content">
            <CheckCircle2 size={20} color="#10b981" />
            <span>{bookingSuccessNotice}</span>
          </div>
          <button
            type="button"
            className="btn secondary sm tap"
            onClick={() => setBookingSuccessNotice(null)}
          >
            ✕ Dismiss
          </button>
        </div>
      )}

      {/* Primary Workspace Navigation Tabs */}
      <div className="faculty-workspace-tabs" role="tablist">
        {/* Tab 1: Today's Lectures */}
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "today"}
          className={`faculty-tab-pill ${activeTab === "today" ? "active" : ""}`}
          onClick={() => setActiveTab("today")}
        >
          <Clock size={16} />
          <span className="tab-label-full">Today&apos;s Lectures</span>
          <span className="tab-label-short">Today</span>
          <span className="tab-badge">
            {actualTodayClasses.length > 0 ? `${actualTodayClasses.length} Today` : "Today"}
          </span>
        </button>

        {/* Tab 2: Weekly Timetable (Proper Table Format) */}
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "table"}
          className={`faculty-tab-pill ${activeTab === "table" ? "active" : ""}`}
          onClick={() => setActiveTab("table")}
        >
          <Table size={16} />
          <span className="tab-label-full">My Teaching Timetable</span>
          <span className="tab-label-short">Weekly Grid</span>
          <span className="tab-badge">{teacherClasses.length} Classes</span>
        </button>

        {/* Tab 3: Smart Makeup & Lab Matcher */}
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "makeup"}
          className={`faculty-tab-pill ${activeTab === "makeup" ? "active" : ""}`}
          onClick={() => setActiveTab("makeup")}
        >
          <Sparkles size={16} />
          <span className="tab-label-full">Smart Makeup & Lab Matcher</span>
          <span className="tab-label-short">Makeup Matcher</span>
          {comparison && (
            <span className="tab-badge">{comparison.bothFreeSlotsCount} Free</span>
          )}
        </button>
      </div>

      {/* =========================================================================
          TAB 1: TODAY'S TEACHING SCHEDULE
          ========================================================================= */}
      {activeTab === "today" && (
        <section className="faculty-today-section stack">
          {/* Day Selector Navigation Bar */}
          <div className="faculty-day-selector-bar">
            <span className="selector-title">
              <Calendar size={15} />
              <span>Select Day:</span>
            </span>
            <div className="faculty-day-pills">
              {DAYS.map((dayName, idx) => {
                const count = teacherClasses.filter((c) => c.day === idx).length;
                const isToday = clock.dayIndex === idx;
                const isSelected = selectedDay === idx;
                return (
                  <button
                    key={dayName}
                    type="button"
                    className={`day-pill ${isSelected ? "selected" : ""} ${isToday ? "today-highlight" : ""}`}
                    onClick={() => setSelectedDay(idx)}
                  >
                    <span className="day-name">{isToday ? "Today" : DAY_SHORT[idx]}</span>
                    <span className="day-count">({count})</span>
                    {isToday && <span className="today-dot" title="Campus day today" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Day Status Summary */}
          <div className="faculty-day-summary-card">
            <div>
              <h3>
                {selectedDay === clock.dayIndex ? "Today's Schedule" : `${DAYS[selectedDay]}'s Schedule`}
              </h3>
              <p className="quiet">
                {todayDayClasses.length === 0
                  ? `No lectures listed for ${DAYS[selectedDay]}. Enjoy your preparation time!`
                  : `${todayDayClasses.length} lecture${todayDayClasses.length === 1 ? "" : "s"} scheduled for ${DAYS[selectedDay]}.`}
              </p>
            </div>
            {selectedDay === clock.dayIndex && clock.liveSlot !== null && (
              <div className="live-status-chip">
                <span className="live-pulse-dot" />
                <span>Slot {clock.liveSlot + 1} ({SLOTS[clock.liveSlot].start} - {SLOTS[clock.liveSlot].end})</span>
              </div>
            )}
          </div>

          {/* Today's Lectures Cards List */}
          {todayDayClasses.length === 0 ? (
            <div className="empty-state stack">
              <CalendarDays size={32} aria-hidden />
              <h3>Free Day — No Lectures Scheduled</h3>
              <p className="quiet">
                You have no scheduled lectures on {DAYS[selectedDay]}. You can explore the weekly timetable
                table or schedule an extra/makeup class using the Lab Matcher.
              </p>
              <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center", flexWrap: "wrap" }}>
                <button
                  type="button"
                  className="btn tap"
                  onClick={() => setActiveTab("table")}
                >
                  <Table size={15} />
                  <span>View Full Week Table</span>
                </button>
                <button
                  type="button"
                  className="btn solid tap"
                  onClick={() => setActiveTab("makeup")}
                >
                  <Sparkles size={15} />
                  <span>Schedule Makeup Class</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="faculty-today-cards-grid">
              {todayDayClasses.map((c, idx) => {
                const slot = SLOTS[c.slot];
                const isLive = selectedDay === clock.dayIndex && clock.liveSlot === c.slot;
                const isUpcoming = selectedDay === clock.dayIndex && clock.liveSlot !== null && c.slot > clock.liveSlot;
                const isPast = selectedDay === clock.dayIndex && clock.liveSlot !== null && c.slot < clock.liveSlot;
                const isLab = /lab/i.test(subjects[c.subject]);

                return (
                  <div
                    key={`${selectedDay}-${c.slot}-${idx}`}
                    className={`faculty-lecture-card ${isLive ? "live-card" : ""} ${isPast ? "past-card" : ""} ${c.isMakeup ? "makeup-card-highlight" : ""}`}
                  >
                    {/* Header: Slot time and live tag */}
                    <div className="lecture-card-header">
                      <div className="lecture-time-badge">
                        <Clock size={13} />
                        <span>
                          {slot.label} • {slot.start} - {slot.end}
                        </span>
                      </div>
                      <div style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
                        {c.isMakeup && (
                          <span className="lecture-status-badge makeup-pill">
                            ⭐ Makeup Class
                          </span>
                        )}
                        {isLive && (
                          <span className="lecture-status-badge live">
                            <span className="live-dot" />
                            LIVE NOW
                          </span>
                        )}
                        {isUpcoming && (
                          <span className="lecture-status-badge upcoming">
                            Upcoming Next
                          </span>
                        )}
                        {isPast && (
                          <span className="lecture-status-badge completed">
                            Completed
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Course Title */}
                    <div className="lecture-title-row">
                      <h4>{subjects[c.subject]}</h4>
                      {isLab && <span className="lab-tag-pill">🧪 Lab Session</span>}
                      {c.makeupNote && <span className="makeup-note-text">Note: {c.makeupNote}</span>}
                    </div>

                    {/* Meta Pills: Section & Venue */}
                    <div className="lecture-pills-row">
                      <button
                        type="button"
                        className="class-meta-pill batch tap"
                        onClick={() => open({ type: "batch", id: c.batch })}
                        title={`View ${batches[c.batch]} timetable`}
                      >
                        <Users size={13} />
                        <span>{batches[c.batch]}</span>
                      </button>

                      <button
                        type="button"
                        className="class-meta-pill room tap"
                        onClick={() => open({ type: "room", id: c.room })}
                        title={`View room details for ${rooms[c.room]}`}
                      >
                        <MapPin size={13} />
                        <span>{rooms[c.room]}</span>
                      </button>
                    </div>

                    {/* Actions */}
                    <div className="lecture-card-footer">
                      {c.isMakeup && c.makeupId ? (
                        <button
                          type="button"
                          className="btn secondary sm tap cancel-makeup-btn"
                          onClick={() => handleCancelMakeup(c.makeupId!, rooms[c.room])}
                          title="Cancel this makeup class and release the room"
                        >
                          <Trash2 size={13} />
                          <span>Cancel & Release Room</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="btn secondary sm tap makeup-link-btn"
                          onClick={() => {
                            setSelectedBatchId(c.batch);
                            setActiveTab("makeup");
                          }}
                          title={`Find free mutual slots & rooms for ${batches[c.batch]}`}
                        >
                          <Sparkles size={13} />
                          <span>Find Replacement / Makeup Slot</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* =========================================================================
          TAB 2: MY TEACHING TIMETABLE (PROPER TABLE FORMAT)
          ========================================================================= */}
      {activeTab === "table" && (
        <section className="faculty-table-section stack">
          {/* Sub-Toolbar: Table vs Agenda vs Course Summary */}
          <div className="faculty-timetable-toolbar">
            <div className="toolbar-headline">
              <h3>{teacherName}&apos;s Weekly Schedule</h3>
              <p className="quiet">
                Official weekly teaching allocation across departments, classrooms, and labs.
              </p>
            </div>

            <div className="timetable-view-switcher" role="group" aria-label="Timetable View Mode">
              <button
                type="button"
                className={`switch-btn ${tableMode === "grid" ? "active" : ""}`}
                onClick={() => setTableMode("grid")}
              >
                <Table size={14} />
                <span>Weekly Grid (Table)</span>
              </button>
              <button
                type="button"
                className={`switch-btn ${tableMode === "agenda" ? "active" : ""}`}
                onClick={() => setTableMode("agenda")}
              >
                <List size={14} />
                <span>Day Agenda</span>
              </button>
              <button
                type="button"
                className={`switch-btn ${tableMode === "courses" ? "active" : ""}`}
                onClick={() => setTableMode("courses")}
              >
                <BookOpen size={14} />
                <span>My Courses ({uniqueCourses.length})</span>
              </button>
            </div>
          </div>

          {/* View 1: Proper Timetable Table Format (WeekGrid) */}
          {tableMode === "grid" && (
            <div className="faculty-weekgrid-container">
              <WeekGrid
                list={teacherClasses}
                focusDay={selectedDay}
                liveDay={clock.dayIndex}
                liveSlot={clock.liveSlot}
                caption={(e) => `${batches[e.batch]} · ${rooms[e.room]}`}
                onDayChange={(d) => setSelectedDay(d)}
              />
            </div>
          )}

          {/* View 2: Day-by-Day Agenda List */}
          {tableMode === "agenda" && (
            <div className="teacher-classes-list stack">
              {DAYS.map((dayName, dayIdx) => {
                const dayClasses = teacherClasses.filter((c) => c.day === dayIdx);
                if (dayClasses.length === 0) return null;

                return (
                  <div key={dayName} className="teacher-day-group">
                    <div className="teacher-day-header">
                      <h4>{dayName}</h4>
                      <span className="day-count-badge">{dayClasses.length} Classes</span>
                    </div>

                    <div className="classes-cards-grid">
                      {dayClasses.map((c, idx) => {
                        const slot = SLOTS[c.slot];
                        return (
                          <div key={`${dayIdx}-${c.slot}-${idx}`} className={`teacher-class-card ${c.isMakeup ? "makeup-card-highlight" : ""}`}>
                            <div className="class-time-badge">
                              <Clock size={13} />
                              <span>
                                {slot.label}: {slot.start} - {slot.end}
                              </span>
                              {c.isMakeup && (
                                <span className="lecture-status-badge makeup-pill" style={{ marginLeft: "auto" }}>
                                  ⭐ Makeup
                                </span>
                              )}
                            </div>

                            <h4 className="class-subject-title">{subjects[c.subject]}</h4>

                            <div className="class-pills-row">
                              <button
                                type="button"
                                className="class-meta-pill batch tap"
                                onClick={() => open({ type: "batch", id: c.batch })}
                              >
                                <Users size={12} />
                                <span>{batches[c.batch]}</span>
                              </button>

                              <button
                                type="button"
                                className="class-meta-pill room tap"
                                onClick={() => open({ type: "room", id: c.room })}
                              >
                                <MapPin size={12} />
                                <span>{rooms[c.room]}</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* View 3: Unique Courses Breakdown */}
          {tableMode === "courses" && (
            <div className="faculty-courses-grid">
              {uniqueCourses.map(({ subjectId, classes }) => {
                const taughtBatches = Array.from(new Set(classes.map((c) => c.batch)));
                const usedRooms = Array.from(new Set(classes.map((c) => c.room)));
                const isLab = /lab/i.test(subjects[subjectId]);

                return (
                  <div key={subjectId} className="faculty-course-card">
                    <div className="course-card-head">
                      <div className="course-icon-badge">
                        {isLab ? "🧪" : "📚"}
                      </div>
                      <div>
                        <h4>{subjects[subjectId]}</h4>
                        <span className="course-type-label">
                          {isLab ? "Laboratory Course" : "Theory Lecture Course"}
                        </span>
                      </div>
                    </div>

                    <div className="course-stats-row">
                      <div className="course-stat">
                        <strong>{classes.length}</strong>
                        <span>Slots/Week</span>
                      </div>
                      <div className="course-stat">
                        <strong>{taughtBatches.length}</strong>
                        <span>Section{taughtBatches.length === 1 ? "" : "s"}</span>
                      </div>
                      <div className="course-stat">
                        <strong>{classes.length * 1.5}</strong>
                        <span>Credit Hrs</span>
                      </div>
                    </div>

                    <div className="course-batches-list">
                      <span className="list-title">Assigned Batches:</span>
                      <div className="pill-wrap">
                        {taughtBatches.map((bId) => (
                          <button
                            key={bId}
                            type="button"
                            className="chip sm tap"
                            onClick={() => open({ type: "batch", id: bId })}
                          >
                            <Users size={11} />
                            <span>{batches[bId]}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="course-venues-list">
                      <span className="list-title">Allocated Venues:</span>
                      <div className="pill-wrap">
                        {usedRooms.map((rId) => (
                          <button
                            key={rId}
                            type="button"
                            className="chip sm tap"
                            onClick={() => open({ type: "room", id: rId })}
                          >
                            <MapPin size={11} />
                            <span>{rooms[rId]}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* =========================================================================
          TAB 3: RESPONSIVE SMART MAKEUP & LAB MATCHER
          ========================================================================= */}
      {activeTab === "makeup" && (
        <section className="makeup-matcher-section stack">
          {/* Active Scheduled Makeup Classes Management Banner */}
          {teacherMakeupClasses.length > 0 && (
            <div className="active-makeups-banner stack">
              <div className="active-makeups-head">
                <div className="active-makeups-title">
                  <Sparkles size={18} color="#10b981" />
                  <strong>Your Arranged Makeup Classes ({teacherMakeupClasses.length})</strong>
                </div>
                <span className="active-makeups-note">
                  Active reservations automatically occupy the room & teacher. Once the lecture ends (e.g. at 10:00 for L1), the system automatically releases the venue back to FREE. You can also click &quot;Cancel / Release Room&quot; anytime.
                </span>
              </div>

              <div className="active-makeups-grid">
                {teacherMakeupClasses.map((m) => {
                  const dayName = DAYS[m.day];
                  const slotInfo = SLOTS[m.slot];
                  const roomName = rooms[m.room];
                  const batchName = batches[m.batch];
                  const subjectName = subjects[m.subject];
                  const isActive = isMakeupActive(m, now || new Date());
                  const noticeText = generateNoticeText(m.day, m.slot, roomName, m.batch, subjectName);
                  const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(noticeText)}`;

                  return (
                    <div
                      key={m.id}
                      className={`active-makeup-card ${isActive ? "active-session" : "completed-session"}`}
                    >
                      <div className="active-makeup-info">
                        <div className="active-makeup-header-row">
                          {isActive ? (
                            <span className="makeup-live-pill active">
                              <span className="status-dot-pulse green" />
                              <span>Occupied · Auto-releases at {slotInfo.end}</span>
                            </span>
                          ) : (
                            <span className="makeup-live-pill completed">
                              <span className="status-dot-pulse gray" />
                              <span>Completed · Room & Teacher Released (Free)</span>
                            </span>
                          )}
                        </div>

                        <div className="active-makeup-time">
                          <Clock size={13} />
                          <span>
                            {m.targetDateLabel || dayName} • {slotInfo.label} ({slotInfo.start} - {slotInfo.end})
                          </span>
                        </div>
                        <h4 className="active-makeup-subject">{subjectName}</h4>
                        <div className="active-makeup-badges">
                          <span className="chip sm">
                            <Users size={11} />
                            <span>{batchName}</span>
                          </span>
                          <span className="chip sm">
                            <DoorOpen size={11} />
                            <span>{roomName}</span>
                          </span>
                        </div>
                        {m.note && <p className="active-makeup-memo">Note: {m.note}</p>}
                      </div>

                      <div className="active-makeup-actions">
                        <button
                          type="button"
                          className="btn secondary sm tap copy-btn"
                          onClick={() => {
                            navigator.clipboard.writeText(noticeText);
                            alert("Class notice copied to clipboard!");
                          }}
                          title="Copy notice text"
                        >
                          <Copy size={12} />
                          <span>Copy</span>
                        </button>
                        <a
                          href={whatsappUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="whatsapp-share-pill sm"
                          title="Share to WhatsApp class group"
                        >
                          <Share2 size={12} />
                          <span>WhatsApp</span>
                        </a>
                        {isActive ? (
                          <button
                            type="button"
                            className="btn secondary sm tap cancel-makeup-action"
                            onClick={() => handleCancelMakeup(m.id, roomName)}
                            title="Cancel makeup class anytime to immediately release the room and teacher"
                          >
                            <Trash2 size={12} />
                            <span>Cancel / Release Room</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="btn secondary sm tap"
                            onClick={() => removeMakeupClass(m.id)}
                            title="Dismiss from history"
                          >
                            <Trash2 size={12} />
                            <span>Dismiss</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Responsive Batch Selector Bar */}
          <div className="batch-matcher-bar">
            <div className="matcher-bar-label">
              <Users size={20} />
              <div>
                <strong>Select Student Batch to Match:</strong>
                <p>Calculates schedule overlap to find mutual free slots with vacant labs & lecture halls.</p>
              </div>
            </div>

            <div className="matcher-bar-controls">
              {/* Filter Batches Input */}
              <div className="search-wrap matcher-search-wrap">
                <Search size={14} className="search-icon-inside" />
                <input
                  type="text"
                  className="input batch-search-input"
                  placeholder="Search batch (e.g. BCS-V)..."
                  value={batchSearch}
                  onChange={(e) => setBatchSearch(e.target.value)}
                />
              </div>

              {/* Batch Select Dropdown */}
              <select
                className="input select select-batch-dropdown"
                value={selectedBatchId}
                onChange={(e) => setSelectedBatchId(Number(e.target.value))}
              >
                {taughtBatchIds.length > 0 && (
                  <optgroup label="⭐ Batches You Currently Teach">
                    {taughtBatchIds.map((id) => (
                      <option key={`taught-${id}`} value={id}>
                        {batches[id]} (Your Class)
                      </option>
                    ))}
                  </optgroup>
                )}
                <optgroup label="All Campus Batches">
                  {filteredBatches.map((b) => (
                    <option key={`all-${b.id}`} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </optgroup>
              </select>

              {/* Only show mutual free slots toggle */}
              <label className="filter-free-label">
                <input
                  type="checkbox"
                  checked={filterOnlyFree}
                  onChange={(e) => setFilterOnlyFree(e.target.checked)}
                />
                <span>Only show matching free slots</span>
              </label>
            </div>
          </div>

          {/* Overlap Summary Pill */}
          {comparison && (
            <div className="matcher-summary-pill">
              <CheckCircle2 size={18} color="#10b981" />
              <span>
                Matching <strong>{teacherName}</strong> with <strong>{batches[selectedBatchId]}</strong>:{" "}
                <strong>{comparison.bothFreeSlotsCount} Mutual Free Slots</strong> found with unoccupied labs and rooms available!
              </span>
            </div>
          )}

          {/* Layout Mode Switcher (Grid vs Quick Cards for Mobile) */}
          <div className="matcher-layout-switcher">
            <div className="switcher-tabs">
              <button
                type="button"
                className={`switcher-tab ${matcherViewMode === "matrix" ? "active" : ""}`}
                onClick={() => setMatcherViewMode("matrix")}
              >
                <Table size={14} />
                <span>5x5 Matrix Grid</span>
              </button>
              <button
                type="button"
                className={`switcher-tab ${matcherViewMode === "cards" ? "active" : ""}`}
                onClick={() => setMatcherViewMode("cards")}
              >
                <Sparkles size={14} />
                <span>Quick Free Slots ({allMutualFreeSlots.length})</span>
              </button>
            </div>
            {matcherViewMode === "matrix" && (
              <span className="matrix-scroll-hint">
                👉 Scroll horizontally on mobile to view all slots
              </span>
            )}
          </div>

          {/* MODE A: 5x5 Matrix Grid */}
          {matcherViewMode === "matrix" && (
            <div className="matcher-matrix-scroll-wrapper">
              <div className="matcher-matrix-grid">
                {/* Header Row: Corner + Slots 1-5 */}
                <div className="matrix-header-cell time-corner">Day / Time</div>
                {SLOTS.map((slot) => (
                  <div key={slot.label} className="matrix-header-cell slot-col">
                    <strong>{slot.label}</strong>
                    <span className="slot-hours">
                      {slot.start} - {slot.end}
                    </span>
                  </div>
                ))}

                {/* Day Rows: Monday to Friday */}
                {DAYS.map((dayName, dayIdx) => (
                  <div key={dayName} className="matrix-row-group">
                    {/* Sticky Day Column */}
                    <div className="matrix-day-cell">
                      <span className="day-name-full">{dayName}</span>
                      <span className="day-name-short">{DAY_SHORT[dayIdx]}</span>
                    </div>

                    {/* Cells for Slots 0..4 */}
                    {comparison?.matrix[dayIdx].map((cell) => {
                      const isBothFree = cell.isBothFree;
                      const isSelected =
                        selectedSlotDetails?.day === cell.day &&
                        selectedSlotDetails?.slot === cell.slot;

                      if (filterOnlyFree && !isBothFree) {
                        return (
                          <div key={cell.slot} className="matrix-cell muted-slot">
                            <span className="fine quiet">Occupied</span>
                          </div>
                        );
                      }

                      return (
                        <button
                          key={cell.slot}
                          type="button"
                          onClick={() => {
                            setSelectedSlotDetails(cell);
                            setRoomCategoryFilter("all");
                          }}
                          className={`matrix-cell ${isBothFree ? "free-match" : "busy-slot"} ${isSelected ? "selected" : ""}`}
                        >
                          {isBothFree ? (
                            <div className="cell-free-content">
                              <span className="match-tag">
                                <CheckCircle2 size={12} />
                                BOTH FREE
                              </span>
                              <div className="free-rooms-pill">
                                <DoorOpen size={11} />
                                <span>{cell.freeRooms.length} Rooms Free</span>
                              </div>
                              {cell.freeLabsCount > 0 && (
                                <span className="labs-available-pill">
                                  🧪 {cell.freeLabsCount} Labs Free
                                </span>
                              )}
                            </div>
                          ) : (
                            <div className="cell-busy-content">
                              <span className="busy-tag">
                                <XCircle size={11} />
                                BUSY
                              </span>
                              {!cell.isTeacherFree && cell.teacherEntry && (
                                <div className="busy-reason teacher">
                                  <strong>You:</strong> {cell.teacherEntry.batch} ({cell.teacherEntry.room})
                                </div>
                              )}
                              {!cell.isBatchFree && cell.batchEntry && (
                                <div className="busy-reason batch">
                                  <strong>Batch:</strong> {cell.batchEntry.subject} ({cell.batchEntry.room})
                                </div>
                              )}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* MODE B: Quick Free Slots Cards (Super fast on phones!) */}
          {matcherViewMode === "cards" && (
            <div className="quick-free-slots-list">
              {allMutualFreeSlots.length === 0 ? (
                <div className="empty-state stack">
                  <XCircle size={32} aria-hidden />
                  <h3>No Mutual Free Slots Found</h3>
                  <p className="quiet">
                    Every scheduled slot throughout the week is occupied by either your lectures or
                    {batches[selectedBatchId]}&apos;s schedule.
                  </p>
                </div>
              ) : (
                <div className="free-slots-cards-grid">
                  {allMutualFreeSlots.map((slot) => {
                    const dayName = DAYS[slot.day];
                    const slotInfo = SLOTS[slot.slot];
                    const isSelected =
                      selectedSlotDetails?.day === slot.day &&
                      selectedSlotDetails?.slot === slot.slot;

                    return (
                      <div
                        key={`${slot.day}-${slot.slot}`}
                        className={`free-slot-card ${isSelected ? "selected" : ""}`}
                      >
                        <div className="slot-card-top">
                          <span className="slot-card-day">{dayName}</span>
                          <span className="slot-card-time">
                            {slotInfo.label} ({slotInfo.start} - {slotInfo.end})
                          </span>
                        </div>

                        <div className="slot-card-venues-info">
                          <span className="venues-count-chip">
                            <DoorOpen size={13} />
                            <strong>{slot.freeRooms.length}</strong> Rooms Vacant
                          </span>
                          {slot.freeLabsCount > 0 && (
                            <span className="labs-count-chip">
                              🧪 <strong>{slot.freeLabsCount}</strong> Labs Free
                            </span>
                          )}
                          {slot.freeLTsCount > 0 && (
                            <span className="lts-count-chip">
                              🏛️ <strong>{slot.freeLTsCount}</strong> LTs Free
                            </span>
                          )}
                        </div>

                        <button
                          type="button"
                          className="btn solid sm tap select-slot-btn"
                          onClick={() => {
                            setSelectedSlotDetails(slot);
                            setRoomCategoryFilter("all");
                          }}
                        >
                          <Sparkles size={13} />
                          <span>{isSelected ? "Inspecting Venues" : "View Free Venues & Book"}</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Selected Free Slot Venue Discovery Drawer */}
          {selectedSlotDetails && (
            <div className="slot-discovery-drawer">
              <div className="discovery-header">
                <div className="discovery-title">
                  <Sparkles size={22} color="#10b981" />
                  <div>
                    <h3>
                      {DAYS[selectedSlotDetails.day]} • {SLOTS[selectedSlotDetails.slot].label} (
                      {SLOTS[selectedSlotDetails.slot].start} - {SLOTS[selectedSlotDetails.slot].end})
                    </h3>
                    <p>
                      {selectedSlotDetails.isBothFree
                        ? `🎉 Both you and ${batches[selectedBatchId]} are free! Pick any vacant lab or lecture hall below to arrange your makeup class.`
                        : `One or both parties are occupied in this slot.`}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  className="close-drawer-btn"
                  onClick={() => setSelectedSlotDetails(null)}
                >
                  ✕ Close
                </button>
              </div>

              {selectedSlotDetails.isBothFree && (
                <div className="discovery-content stack">
                  {/* Category Filter Pills */}
                  <div className="room-category-counters">
                    <button
                      type="button"
                      className={`counter-filter-btn ${roomCategoryFilter === "all" ? "active" : ""}`}
                      onClick={() => setRoomCategoryFilter("all")}
                    >
                      All Venues ({selectedSlotDetails.freeRooms.length})
                    </button>
                    <button
                      type="button"
                      className={`counter-filter-btn labs ${roomCategoryFilter === "labs" ? "active" : ""}`}
                      onClick={() => setRoomCategoryFilter("labs")}
                    >
                      🧪 Labs ({selectedSlotDetails.freeLabsCount})
                    </button>
                    <button
                      type="button"
                      className={`counter-filter-btn lts ${roomCategoryFilter === "lts" ? "active" : ""}`}
                      onClick={() => setRoomCategoryFilter("lts")}
                    >
                      🏛️ LTs ({selectedSlotDetails.freeLTsCount})
                    </button>
                    <button
                      type="button"
                      className={`counter-filter-btn crs ${roomCategoryFilter === "crs" ? "active" : ""}`}
                      onClick={() => setRoomCategoryFilter("crs")}
                    >
                      🏫 Classrooms ({selectedSlotDetails.freeCRsCount})
                    </button>
                  </div>

                  {/* List of Available Free Venues */}
                  <div className="free-venues-grid">
                    {selectedSlotDetails.freeRooms
                      .filter((r) => {
                        if (roomCategoryFilter === "labs") return r.group === "Labs";
                        if (roomCategoryFilter === "lts") return r.group === "Lecture theatres";
                        if (roomCategoryFilter === "crs")
                          return r.group === "Classrooms" || r.group === "Lecture halls";
                        return true;
                      })
                      .map((r) => {
                        const noticeText = generateNoticeText(selectedSlotDetails.day, selectedSlotDetails.slot, r.name, selectedBatchId);
                        const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(noticeText)}`;

                        return (
                          <div
                            key={r.id}
                            className={`venue-card ${r.group === "Labs" ? "lab" : r.group === "Lecture theatres" ? "lt" : "room"}`}
                          >
                            <div className="venue-info">
                              <span className="venue-group-tag">{r.group}</span>
                              <strong className="venue-name">{r.name}</strong>
                            </div>

                            <div className="venue-actions-row">
                              {/* Primary Action: Book / Arrange Class in this room */}
                              <button
                                type="button"
                                className="btn solid sm tap book-makeup-btn"
                                onClick={() => {
                                  setBookingModalState({
                                    slot: selectedSlotDetails,
                                    room: r,
                                  });
                                  setBookingSubjectId(candidateSubjects[0] ?? 0);
                                }}
                                title={`Arrange makeup class in ${r.name}`}
                              >
                                <CalendarPlus size={13} />
                                <span>Book Makeup Class</span>
                              </button>

                              <button
                                type="button"
                                className="btn secondary sm tap copy-venue-btn"
                                onClick={() => handleCopyNotice(selectedSlotDetails, r.name)}
                                title="Copy formatted text notice to clipboard"
                              >
                                {copiedNotice ? <Check size={13} /> : <Copy size={13} />}
                                <span>{copiedNotice ? "Copied!" : "Copy"}</span>
                              </button>

                              <a
                                href={whatsappUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="whatsapp-share-pill"
                                title="Share class notice directly to student WhatsApp group"
                              >
                                <Share2 size={13} />
                                <span>WhatsApp</span>
                              </a>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Booking Confirmation Dialog Modal */}
          {bookingModalState && (
            <div className="booking-modal-backdrop">
              <div className="booking-modal-card stack">
                <div className="booking-modal-head">
                  <div className="booking-modal-title">
                    <CalendarPlus size={20} color="#10b981" />
                    <h3>Confirm Makeup Class Reservation</h3>
                  </div>
                  <button
                    type="button"
                    className="close-drawer-btn"
                    onClick={() => setBookingModalState(null)}
                  >
                    ✕
                  </button>
                </div>

                <div className="booking-modal-details">
                  <div className="booking-detail-row">
                    <span className="detail-label">Teacher:</span>
                    <strong>{teacherName}</strong>
                  </div>
                  <div className="booking-detail-row">
                    <span className="detail-label">Target Batch:</span>
                    <strong>{batches[selectedBatchId]}</strong>
                  </div>
                  <div className="booking-detail-row">
                    <span className="detail-label">Venue:</span>
                    <strong>{bookingModalState.room.name} ({bookingModalState.room.group})</strong>
                  </div>
                  <div className="booking-detail-row">
                    <span className="detail-label">Day & Time:</span>
                    <strong>
                      {DAYS[bookingModalState.slot.day]} • {SLOTS[bookingModalState.slot.slot].label} (
                      {SLOTS[bookingModalState.slot.slot].start} - {SLOTS[bookingModalState.slot.slot].end})
                    </strong>
                  </div>
                  <div className="booking-detail-row">
                    <span className="detail-label">Scheduled Date:</span>
                    <strong>
                      {computeMakeupTargetAndExpiry(bookingModalState.slot.day, bookingModalState.slot.slot, now || new Date()).targetDateLabel}
                    </strong>
                  </div>
                  <div className="booking-detail-row">
                    <span className="detail-label">Auto-Release:</span>
                    <strong style={{ color: "#10b981" }}>
                      Automatically reverts to FREE at {SLOTS[bookingModalState.slot.slot].end}
                    </strong>
                  </div>
                </div>

                {/* Subject Selector */}
                <label className="booking-field-label">
                  <span>Select Course / Subject:</span>
                  <select
                    className="input select"
                    value={bookingSubjectId}
                    onChange={(e) => setBookingSubjectId(Number(e.target.value))}
                  >
                    {candidateSubjects.map((sId) => (
                      <option key={sId} value={sId}>
                        {subjects[sId]}
                      </option>
                    ))}
                  </select>
                </label>

                {/* Optional Note */}
                <label className="booking-field-label">
                  <span>Optional Announcement Note:</span>
                  <input
                    type="text"
                    className="input"
                    placeholder="e.g. Midterm revision, Lab 04 practical makeup..."
                    value={bookingNote}
                    onChange={(e) => setBookingNote(e.target.value)}
                  />
                </label>

                <p className="booking-warning-note">
                  ℹ️ <strong>Automatic Status System:</strong> Confirming this reservation immediately changes the status of
                  <strong> {bookingModalState.room.name}</strong> and <strong>{teacherName}</strong> to occupied across the campus timetable.
                  Once this lecture ends at <strong>{SLOTS[bookingModalState.slot.slot].end}</strong>, the system will <strong>automatically restore both the room and your status back to FREE</strong>! You can also click <em>&quot;Cancel / Release Room&quot;</em> anytime to free it early.
                </p>

                <div className="booking-modal-actions">
                  <button
                    type="button"
                    className="btn solid tap confirm-booking-btn"
                    onClick={handleConfirmBooking}
                  >
                    <CheckCircle2 size={15} />
                    <span>Confirm & Update Timetable</span>
                  </button>
                  <button
                    type="button"
                    className="btn secondary tap"
                    onClick={() => setBookingModalState(null)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
