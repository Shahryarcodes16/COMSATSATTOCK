import { useState, useMemo } from "react";
import {
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  Copy,
  DoorOpen,
  Filter,
  GraduationCap,
  Layers,
  MapPin,
  Search,
  Sparkles,
  Users,
  XCircle,
  Bell,
  ChevronRight,
  AlertCircle,
} from "lucide-react";
import { useDesk } from "@/components/timetable/context";
import {
  DAYS,
  DAY_SHORT,
  SLOTS,
  batches,
  rooms,
  teachers,
  subjects,
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
  type SlotComparisonResult,
} from "@/lib/schedule-matcher";
import { facultyUpdateLeadTimeFn } from "@/lib/faculty-server-fn";

export function FacultyWorkspaceView() {
  const { open, now } = useDesk();
  const [facultySession, setFacultySession] = useState<FacultySession | null>(
    () => getActiveFacultySession(),
  );

  const [activeTab, setActiveTab] = useState<"schedule" | "makeup">("makeup");

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
  const [copiedNotice, setCopiedNotice] = useState(false);
  const [leadMins, setLeadMins] = useState(facultySession?.profile?.notificationLeadMins || 10);
  const [updatingLead, setUpdatingLead] = useState(false);

  const teacherId = facultySession?.profile?.teacherId ?? null;
  const teacherName =
    facultySession?.profile?.timetableName ||
    facultySession?.profile?.fullName ||
    "Faculty Member";

  // Teacher classes
  const teacherClasses = useMemo(() => {
    if (teacherId === null) return [];
    return getTeacherClasses(teacherId);
  }, [teacherId]);

  // Batches taught by this teacher
  const taughtBatchIds = useMemo(() => {
    if (teacherId === null) return [];
    return getBatchesForTeacher(teacherId);
  }, [teacherId]);

  // Compute Schedule Matcher Overlap
  const comparison = useMemo(() => {
    if (teacherId === null) return null;
    return computeScheduleOverlap(teacherId, selectedBatchId);
  }, [teacherId, selectedBatchId]);

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

  const handleCopyNotice = (slot: SlotComparisonResult, roomName: string) => {
    if (!comparison) return;
    const dayName = DAYS[slot.day];
    const slotInfo = SLOTS[slot.slot];
    const text =
      `📢 *CUI Attock Extra/Makeup Class Announcement*\n\n` +
      `• *Teacher:* ${teacherName}\n` +
      `• *Class:* ${batches[selectedBatchId]}\n` +
      `• *Day & Time:* ${dayName}, ${slotInfo.start} - ${slotInfo.end} (${slotInfo.label})\n` +
      `• *Venue:* ${roomName}\n\n` +
      `Please ensure timely attendance.`;

    navigator.clipboard.writeText(text);
    setCopiedNotice(true);
    setTimeout(() => setCopiedNotice(false), 2500);
  };

  // If no faculty member is logged in, show helpful guidance
  if (!facultySession) {
    return (
      <div className="faculty-workspace-gate">
        <div className="faculty-workspace-card">
          <GraduationCap size={48} color="#087f79" />
          <h2>Faculty Workspace & Makeup Matcher</h2>
          <p>
            Please sign in with your official CUI Attock faculty email to view your
            personalized teaching schedule, manage pre-class reminders, and discover free
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

      {/* Workspace Tabs Navigation */}
      <div className="faculty-nav-tabs">
        <button
          type="button"
          className={`faculty-tab ${activeTab === "makeup" ? "active" : ""}`}
          onClick={() => setActiveTab("makeup")}
        >
          <Sparkles size={16} />
          <span>Smart Makeup & Lab Matcher</span>
          {comparison && (
            <span className="tab-badge">{comparison.bothFreeSlotsCount} Free</span>
          )}
        </button>

        <button
          type="button"
          className={`faculty-tab ${activeTab === "schedule" ? "active" : ""}`}
          onClick={() => setActiveTab("schedule")}
        >
          <Calendar size={16} />
          <span>My Teaching Timetable</span>
          <span className="tab-badge">{teacherClasses.length} Classes</span>
        </button>
      </div>

      {/* TAB 1: SMART MAKEUP & EXTRA CLASS MATCHER */}
      {activeTab === "makeup" && (
        <section className="makeup-matcher-section stack">
          {/* Batch Selector Bar */}
          <div className="batch-matcher-bar">
            <div className="matcher-bar-label">
              <Users size={18} />
              <div>
                <strong>Select Student Batch to Match:</strong>
                <p>Finds mutual free slots where both you and this batch have no lecture.</p>
              </div>
            </div>

            <div className="matcher-bar-controls">
              <div className="search-wrap" style={{ position: "relative" }}>
                <Search size={14} style={{ position: "absolute", left: 10, top: 11, color: "var(--c-muted)" }} />
                <input
                  type="text"
                  className="input batch-search-input"
                  placeholder="Filter batches (e.g. BCS-V)..."
                  value={batchSearch}
                  onChange={(e) => setBatchSearch(e.target.value)}
                  style={{ paddingLeft: "2rem", width: 220 }}
                />
              </div>

              <select
                className="input select select-batch-dropdown"
                value={selectedBatchId}
                style={{
                  color: "var(--c-ink, #162d3b)",
                  backgroundColor: "var(--c-paper, #ffffff)",
                  border: "1px solid var(--c-line)",
                  fontWeight: 600,
                }}
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

          {/* Overlap Summary Card */}
          {comparison && (
            <div className="matcher-summary-pill">
              <CheckCircle2 size={18} color="#087f79" />
              <span>
                Matching <strong>{teacherName}</strong> with <strong>{batches[selectedBatchId]}</strong>:{" "}
                <strong>{comparison.bothFreeSlotsCount} Free Mutual Slots</strong> found throughout the week with unoccupied labs and rooms available!
              </span>
            </div>
          )}

          {/* 5x5 Weekly Matcher Matrix */}
          <div className="matcher-matrix-container">
            <div className="matcher-matrix-grid">
              {/* Header: Days */}
              <div className="matrix-header-cell time-corner">Day / Time</div>
              {SLOTS.map((slot) => (
                <div key={slot.label} className="matrix-header-cell slot-col">
                  <strong>{slot.label}</strong>
                  <span className="slot-hours">
                    {slot.start} - {slot.end}
                  </span>
                </div>
              ))}

              {/* Rows: Each Day */}
              {DAYS.map((dayName, dayIdx) => (
                <div key={dayName} className="matrix-row-group">
                  <div className="matrix-day-cell">
                    <span className="day-name-full">{dayName}</span>
                    <span className="day-name-short">{DAY_SHORT[dayIdx]}</span>
                  </div>

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
                        onClick={() => setSelectedSlotDetails(cell)}
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

          {/* Selected Free Slot Drawer: Available Rooms & Labs Discovery */}
          {selectedSlotDetails && (
            <div className="slot-discovery-drawer">
              <div className="discovery-header">
                <div className="discovery-title">
                  <Sparkles size={20} color="#087f79" />
                  <div>
                    <h3>
                      {DAYS[selectedSlotDetails.day]} • {SLOTS[selectedSlotDetails.slot].label} (
                      {SLOTS[selectedSlotDetails.slot].start} - {SLOTS[selectedSlotDetails.slot].end})
                    </h3>
                    <p>
                      {selectedSlotDetails.isBothFree
                        ? `🎉 Both you and ${batches[selectedBatchId]} are free! Pick any vacant lab or lecture hall below to schedule your class.`
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
                  {/* Category Breakdown */}
                  <div className="room-category-counters">
                    <span className="counter-badge labs">
                      🧪 {selectedSlotDetails.freeLabsCount} Computer & Engg Labs Free
                    </span>
                    <span className="counter-badge lts">
                      🏛️ {selectedSlotDetails.freeLTsCount} Lecture Theatres Free
                    </span>
                    <span className="counter-badge crs">
                      🏫 {selectedSlotDetails.freeCRsCount} Classrooms Free
                    </span>
                  </div>

                  {/* List of Available Free Venues */}
                  <div className="free-venues-grid">
                    {selectedSlotDetails.freeRooms.map((r) => (
                      <div key={r.id} className="venue-card">
                        <div className="venue-info">
                          <span className="venue-group-tag">{r.group}</span>
                          <strong className="venue-name">{r.name}</strong>
                        </div>
                        <button
                          type="button"
                          className="btn secondary sm tap copy-venue-btn"
                          onClick={() => handleCopyNotice(selectedSlotDetails, r.name)}
                        >
                          <Copy size={13} />
                          <span>{copiedNotice ? "Copied!" : "Copy Class Notice"}</span>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* TAB 2: MY TEACHING TIMETABLE */}
      {activeTab === "schedule" && (
        <section className="faculty-schedule-section stack">
          <div className="schedule-header-summary">
            <h3>{teacherName}&apos;s Weekly Schedule</h3>
            <p>Direct view of all your assigned courses, lecture rooms, and student sections.</p>
          </div>

          <div className="teacher-classes-list">
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
                        <div key={`${dayIdx}-${c.slot}-${idx}`} className="teacher-class-card">
                          <div className="class-time-badge">
                            <Clock size={13} />
                            <span>
                              {slot.label}: {slot.start} - {slot.end}
                            </span>
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
        </section>
      )}
    </div>
  );
}
