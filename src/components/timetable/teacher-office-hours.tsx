import { useState, useMemo } from "react";
import {
  Briefcase,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  GraduationCap,
  Mail,
  Pin,
  Search,
  Sparkles,
  UserCheck,
  Users,
} from "lucide-react";
import {
  DAYS,
  SLOTS,
  teachers,
  forTeacher,
  rangeLabel,
  getCampusMinutes,
} from "@/lib/schedule";
import {
  getTeacherOfficeProfile,
  generateMeetingEmailHref,
  type TeacherOfficeProfile,
} from "@/lib/teacher-office-hours";
import { DEPARTMENTS, type Department } from "@/lib/faculty";
import { useDesk } from "@/components/timetable/context";

export function FacultyOfficeHours() {
  const { clock, now, day: selectedDeskDay, open, pinnedTeachers, togglePinTeacher } = useDesk();
  const campusTime = useMemo(() => getCampusMinutes(now), [now]);

  const [selectedDay, setSelectedDay] = useState<number | "week">(() => {
    return campusTime.dayIndex !== null && campusTime.dayIndex >= 0 && campusTime.dayIndex < 5
      ? campusTime.dayIndex
      : selectedDeskDay;
  });
  const [expandedTeachers, setExpandedTeachers] = useState<number[]>([]);
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState<Department>("All");
  const [freeNowOnly, setFreeNowOnly] = useState(false);
  const [pinnedOnly, setPinnedOnly] = useState(false);

  const toggleExpandTeacher = (id: number) => {
    setExpandedTeachers((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  // Compute profiles for all teachers using accurate campus time
  const allProfiles = useMemo(() => {
    const list: TeacherOfficeProfile[] = [];
    for (let id = 0; id < teachers.length; id++) {
      list.push(getTeacherOfficeProfile(id, campusTime.dayIndex, campusTime.minutes));
    }
    return list;
  }, [campusTime.dayIndex, campusTime.minutes]);

  // Filter profiles
  const needle = search.trim().toLowerCase();
  const filtered = useMemo(() => {
    return allProfiles.filter((p) => {
      // 1. Pinned filter
      if (pinnedOnly && !pinnedTeachers.includes(p.teacherId)) return false;

      // 2. Department filter
      if (department !== "All" && p.department !== department) return false;

      // 3. Free now filter
      if (freeNowOnly && p.liveStatus.state !== "free_now") return false;

      // 4. Text query filter
      if (needle) {
        const matchName = p.name.toLowerCase().includes(needle);
        const matchDept = p.department.toLowerCase().includes(needle);
        const matchEmail = p.email && p.email.toLowerCase().includes(needle);
        if (!matchName && !matchDept && !matchEmail) return false;
      }

      return true;
    });
  }, [allProfiles, pinnedOnly, pinnedTeachers, department, freeNowOnly, needle]);

  const freeNowCount = useMemo(() => {
    return allProfiles.filter((p) => p.liveStatus.state === "free_now").length;
  }, [allProfiles]);

  return (
    <div className="faculty-office-hours-hub stack">
      {/* Overview Stat Banner */}
      <div className="office-hours-hero">
        <div className="office-hours-hero-content">
          <div className="office-hours-hero-badge">
            <span className="pulse-dot" />
            <span>Campus Live Consultation Finder</span>
          </div>
          <h2>Faculty Office Hours & Free Slots</h2>
          <p className="quiet">
            Find out when your teachers are available in their offices for project guidance, concept clarifications, or student meetings.
          </p>
        </div>

        <div className="office-hours-hero-stats">
          <div className="office-stat-card">
            <span className="office-stat-num">{freeNowCount}</span>
            <span className="office-stat-label">Faculty Free Right Now</span>
          </div>
          <div className="office-stat-card">
            <span className="office-stat-num">{teachers.length}</span>
            <span className="office-stat-label">Total Faculty Tracked</span>
          </div>
        </div>
      </div>

      {/* Control Bar: Day Selection & Search & Filters */}
      <div className="office-hours-toolbar stack">
        {/* Day Selector */}
        <div className="office-day-selector" role="tablist" aria-label="Select Day">
          {DAYS.map((name, idx) => {
            const isToday = campusTime.dayIndex === idx;
            const isSelected = selectedDay === idx;
            return (
              <button
                key={name}
                type="button"
                role="tab"
                aria-selected={isSelected}
                className={`office-day-btn tap ${isSelected ? "active" : ""}`}
                onClick={() => setSelectedDay(idx)}
              >
                <span>{name}</span>
                {isToday ? <span className="office-today-tag">Today</span> : null}
              </button>
            );
          })}
          <button
            type="button"
            role="tab"
            aria-selected={selectedDay === "week"}
            className={`office-day-btn tap ${selectedDay === "week" ? "active" : ""}`}
            onClick={() => setSelectedDay("week")}
          >
            <Calendar size={14} aria-hidden />
            <span>Full Week (Mon – Fri)</span>
          </button>
        </div>

        {/* Filters and search row */}
        <div className="office-filter-row">
          <div className="office-search-wrap">
            <Search size={16} aria-hidden />
            <input
              type="search"
              className="input office-search-input"
              placeholder="Search faculty by name or email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="office-filter-controls">
            <select
              className="select office-dept-select"
              value={department}
              onChange={(e) => setDepartment(e.target.value as Department)}
              aria-label="Filter by department"
            >
              {DEPARTMENTS.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>

            <button
              type="button"
              className={`btn tap ${freeNowOnly ? "solid active-filter-btn" : ""}`}
              onClick={() => setFreeNowOnly(!freeNowOnly)}
            >
              <UserCheck size={16} aria-hidden />
              <span>Free Now ({freeNowCount})</span>
            </button>

            <button
              type="button"
              className={`btn tap ${pinnedOnly ? "solid active-filter-btn" : ""}`}
              onClick={() => setPinnedOnly(!pinnedOnly)}
            >
              <Pin size={16} aria-hidden />
              <span>Pinned ({pinnedTeachers.length})</span>
            </button>
          </div>
        </div>
      </div>

      {/* Teachers List */}
      <div className="office-teachers-grid">
        {filtered.length === 0 ? (
          <div className="empty-state stack">
            <Users size={32} aria-hidden />
            <h3>No faculty members match your filter</h3>
            <p className="quiet">Try clearing the search query or changing the department filter.</p>
            <button
              type="button"
              className="btn solid tap"
              onClick={() => {
                setSearch("");
                setDepartment("All");
                setFreeNowOnly(false);
                setPinnedOnly(false);
              }}
            >
              Reset Filters
            </button>
          </div>
        ) : (
          filtered.map((profile) => {
            const isWeekMode = selectedDay === "week";
            const isExpanded = expandedTeachers.includes(profile.teacherId);
            const dayInfo = !isWeekMode ? profile.days[selectedDay] : null;
            const isPinned = pinnedTeachers.includes(profile.teacherId);
            const isSelectedDayToday = !isWeekMode && campusTime.dayIndex === selectedDay;

            const renderTimeline = (dInfo: typeof profile.days[0], showDayTitle = false) => {
              return (
                <div key={dInfo.dayIndex} className="office-day-timeline">
                  <div className="office-timeline-heading-row">
                    <span className="office-timeline-label fine quiet">
                      {dInfo.dayName} Schedule:
                    </span>
                    <span className="office-timeline-sub-count fine quiet">
                      {dInfo.freeSlotsCount} free / {dInfo.teachingSlotsCount} lecture{dInfo.teachingSlotsCount !== 1 ? "s" : ""}
                    </span>
                    <span className="office-swipe-hint fine quiet" aria-hidden>
                      All 5 Slots (L1 – L5) ➔
                    </span>
                  </div>

                  <div className="office-timeline-slots">
                    {dInfo.slots.map((st) => {
                      const isFree = st.state === "free";
                      return (
                        <div
                          key={st.slotIndex}
                          className={`office-timeline-cell ${isFree ? "cell-free" : "cell-teaching"}`}
                          title={`${st.label} (${st.start} – ${st.end}): ${
                            isFree
                              ? st.isCancelled
                                ? `🟢 Free for Office Consultation (${st.subjectName || "Lecture"} Cancelled)`
                                : "🟢 Free for Office Consultation"
                              : `🔴 Teaching ${st.subjectName} in ${st.roomName || "Classroom"}`
                          }`}
                        >
                          <div className="office-cell-header">
                            <span className="office-cell-slot">{st.label}</span>
                            <span className="office-cell-time">{st.start}</span>
                          </div>
                          {isFree ? (
                            <div className="office-cell-free-content">
                              <span className="office-free-badge">
                                {st.isCancelled ? "Free · Cancelled" : "Free"}
                              </span>
                              <span className="office-free-tag">
                                {st.isCancelled ? "Lecture Cancelled" : "Consultation"}
                              </span>
                            </div>
                          ) : (
                            <div className="office-cell-teach-content">
                              <span className="office-teach-sub" title={st.subjectName}>
                                {st.subjectName}
                              </span>
                              <span className="office-teach-room">📍 {st.roomName || "Room TBA"}</span>
                              {st.batchName && (
                                <span className="office-teach-batch" title={st.batchName}>
                                  👥 {st.batchName}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            };

            return (
              <div key={profile.teacherId} className="office-teacher-card">
                {/* Header */}
                <div className="office-teacher-card-head">
                  <div>
                    <div className="office-teacher-title-row">
                      <h3
                        className="office-teacher-name tap"
                        onClick={() => open({ type: "teacher", id: profile.teacherId })}
                      >
                        {profile.name}
                      </h3>
                      <button
                        type="button"
                        className={`office-pin-btn tap ${isPinned ? "pinned" : ""}`}
                        aria-label={isPinned ? "Unpin teacher" : "Pin teacher"}
                        title={isPinned ? "Unpin teacher" : "Pin teacher"}
                        onClick={() => togglePinTeacher(profile.teacherId)}
                      >
                        <Pin size={15} aria-hidden />
                      </button>
                    </div>
                    <span className="office-teacher-dept">{profile.department}</span>
                  </div>

                  {/* Live Status Badge */}
                  {isSelectedDayToday ? (
                    <div className={`office-status-pill ${profile.liveStatus.state}`}>
                      {profile.liveStatus.state === "free_now" && <span className="status-dot green" />}
                      {profile.liveStatus.state === "teaching" && <span className="status-dot amber" />}
                      <span>{profile.liveStatus.headline}</span>
                    </div>
                  ) : (
                    <div className="office-status-pill scheduled">
                      <span>
                        {isWeekMode
                          ? `${profile.totalWeeklyFreeSlots} free slots (${profile.weeklyFreeHours} hrs/week)`
                          : `${dayInfo?.freeSlotsCount} free slots (${dayInfo?.freeHours} hrs)`}
                      </span>
                    </div>
                  )}
                </div>

                {/* Live context detail */}
                {isSelectedDayToday && profile.liveStatus.detail ? (
                  <p className="office-live-detail fine quiet">
                    {profile.liveStatus.detail}
                    {"nextClass" in profile.liveStatus && profile.liveStatus.nextClass ? (
                      <span> · {profile.liveStatus.nextClass}</span>
                    ) : null}
                  </p>
                ) : null}

                {/* Slots Timeline: Selected Day or Full Week (Mon - Fri) */}
                {isWeekMode || isExpanded ? (
                  <div className="office-full-week-stack stack">
                    {profile.days.map((d) => renderTimeline(d, true))}
                  </div>
                ) : (
                  dayInfo && renderTimeline(dayInfo, false)
                )}

                {/* Footer Actions */}
                <div className="office-teacher-actions">
                  {profile.email ? (
                    <a
                      href={generateMeetingEmailHref(
                        profile.name,
                        profile.email,
                        isWeekMode ? "Weekly Office Hours" : `${DAYS[selectedDay as number]} (Free Slot)`
                      )}
                      className="btn solid tap office-action-btn"
                      title={`Request an office meeting with ${profile.name}`}
                    >
                      <Mail size={15} aria-hidden />
                      <span>Request Meeting</span>
                    </a>
                  ) : null}

                  {!isWeekMode && (
                    <button
                      type="button"
                      className={`btn tap office-action-btn ${isExpanded ? "solid" : ""}`}
                      onClick={() => toggleExpandTeacher(profile.teacherId)}
                      title="View all 5 days for this faculty member"
                    >
                      <Calendar size={15} aria-hidden />
                      <span>{isExpanded ? "Collapse Day" : "Full Week (5 Days)"}</span>
                    </button>
                  )}

                  <button
                    type="button"
                    className="btn tap office-action-btn"
                    onClick={() => open({ type: "teacher", id: profile.teacherId })}
                  >
                    <ExternalLink size={15} aria-hidden />
                    <span>View Week Timetable</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
