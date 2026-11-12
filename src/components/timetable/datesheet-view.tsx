import { useState, useMemo, useEffect } from "react";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Calendar,
  CalendarDays,
  CheckCircle2,
  Clock,
  Download,
  Filter,
  GraduationCap,
  MapPin,
  Plus,
  Printer,
  Search,
  Sparkles,
  Trash2,
  UserCheck,
  Users,
  X,
} from "lucide-react";
import { useDesk } from "@/components/timetable/context";
import {
  DATESHEET,
  getExamTimeInfo,
  detectExamClashes,
  loadSavedRepeaterCourseIds,
  saveSavedRepeaterCourseIds,
  isDatesheetActive,
  downloadDatesheetIcsFile,
  type ExamEntry,
} from "@/lib/datesheet";
import { ExportDatesheetImage } from "@/components/timetable/datesheet-image-modal";

export function DatesheetView() {
  const { clock, now, goBack } = useDesk();
  const [selectedClass, setSelectedClass] = useState<string>("BCS-V");
  const [selectedDate, setSelectedDate] = useState<string>("all");
  const [search, setSearch] = useState<string>("");
  const [repeaterModalOpen, setRepeaterModalOpen] = useState<boolean>(false);
  const [repeaterExamIds, setRepeaterExamIds] = useState<number[]>(() =>
    loadSavedRepeaterCourseIds(),
  );

  // Sync repeater course IDs to storage
  const handleAddRepeaterCourse = (examId: number) => {
    if (!repeaterExamIds.includes(examId)) {
      const next = [...repeaterExamIds, examId];
      setRepeaterExamIds(next);
      saveSavedRepeaterCourseIds(next);
    }
  };

  const handleRemoveRepeaterCourse = (examId: number) => {
    const next = repeaterExamIds.filter((id) => id !== examId);
    setRepeaterExamIds(next);
    saveSavedRepeaterCourseIds(next);
  };

  const handleDownloadIcs = () => {
    const safeName = selectedClass.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    downloadDatesheetIcsFile(personalExams, `cui-midterms-${safeName}.ics`);
  };

  const handlePrint = () => {
    window.print();
  };

  // Get primary batch exams
  const primaryExams = useMemo(() => {
    return DATESHEET.exams.filter((e) => e.className === selectedClass);
  }, [selectedClass]);

  // Get repeater exams
  const repeaterExams = useMemo(() => {
    return DATESHEET.exams.filter(
      (e) => repeaterExamIds.includes(e.id) && e.className !== selectedClass,
    );
  }, [repeaterExamIds, selectedClass]);

  // Combined personal exams
  const personalExams = useMemo(() => {
    const combined = [...primaryExams, ...repeaterExams];
    // Sort chronologically by date and rawTime
    return combined.sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return a.rawTime.localeCompare(b.rawTime);
    });
  }, [primaryExams, repeaterExams]);

  // Detect clashes
  const clashes = useMemo(() => {
    return detectExamClashes(personalExams);
  }, [personalExams]);

  // Filter for display
  const needle = search.trim().toLowerCase();
  const displayedExams = useMemo(() => {
    return personalExams.filter((exam) => {
      // Date filter
      if (selectedDate !== "all" && exam.date !== selectedDate) return false;

      // Text search
      if (needle) {
        const matchCode = exam.courseCode.toLowerCase().includes(needle);
        const matchTitle = exam.courseTitle.toLowerCase().includes(needle);
        const matchRoom = exam.room.toLowerCase().includes(needle);
        const matchInstructor = exam.instructor.toLowerCase().includes(needle);
        const matchClass = exam.className.toLowerCase().includes(needle);
        if (!matchCode && !matchTitle && !matchRoom && !matchInstructor && !matchClass) {
          return false;
        }
      }
      return true;
    });
  }, [personalExams, selectedDate, needle]);

  const active = isDatesheetActive(now || new Date());

  if (!active) {
    return (
      <div className="page datesheet-page stack">
        <div className="empty-state stack">
          <CheckCircle2 size={36} color="#16a34a" aria-hidden />
          <h2>Midterm Examinations Concluded</h2>
          <p className="quiet">
            Midterm exams have officially ended. Regular semester classes are now in progress.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="page datesheet-page stack">
      {/* Header Banner */}
      <div className="datesheet-hero">
        {/* Top Back & Cross Action Bar */}
        <div className="view-header-row">
          <button
            type="button"
            className="btn tap view-back-btn"
            onClick={() => goBack("today")}
            aria-label="Back to Timetable"
          >
            <ArrowLeft size={16} aria-hidden />
            <span>Back to Timetable</span>
          </button>
          <button
            type="button"
            className="icon-btn tap view-close-btn"
            onClick={() => goBack("today")}
            aria-label="Close Date Sheet"
            title="Close Date Sheet and return to timetable"
          >
            <X size={18} aria-hidden />
          </button>
        </div>

        <div className="datesheet-hero-head">
          <div className="datesheet-badge">
            <CalendarDays size={16} aria-hidden />
            <span>Official Examination Schedule · FA26</span>
          </div>
          <h1 className="page-title">Midterm Date Sheet</h1>
          <p className="quiet">
            Personalized exam timetable with repeater support, room allocations, and live countdowns.
          </p>
        </div>

        {/* Rescheduled 4 Nov -> 12 Nov Banner */}
        <div className="datesheet-notice-banner">
          <AlertCircle size={18} aria-hidden />
          <div>
            <b>Important Schedule Adjustment:</b>
            <span>
              Papers originally scheduled for <b>4 November 2026</b> have been officially rescheduled to <b>12 November 2026</b>. Timings, halls, and rooms remain identical.
            </span>
          </div>
        </div>
      </div>

      {/* Clash Alert Banner */}
      {clashes.length > 0 && (
        <div className="datesheet-clash-banner">
          <AlertTriangle size={22} aria-hidden />
          <div className="stack">
            <b>🚨 {clashes.length} Exam Clash Detected!</b>
            {clashes.map((clash, idx) => (
              <p key={idx} className="fine">
                • <b>{clash.exam1.courseTitle}</b> ({clash.exam1.className}) and{" "}
                <b>{clash.exam2.courseTitle}</b> ({clash.exam2.className}) both take place on{" "}
                <b>{clash.date}</b> at <b>{clash.time}</b>!
              </p>
            ))}
            <span className="fine quiet">
              Repeater students with clashes must immediately submit a clash form to the CUI Attock Examination Coordination Office.
            </span>
          </div>
        </div>
      )}

      {/* Control Bar: Class selection, Date Tabs, Search, Repeater Action */}
      <div className="datesheet-controls stack">
        <div className="datesheet-selector-row">
          <label className="datesheet-class-picker">
            <span className="field-label">
              <Users size={15} aria-hidden />
              Select Your Primary Class / Batch
            </span>
            <select
              className="select"
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
            >
              {DATESHEET.classes.map((cls) => (
                <option key={cls} value={cls}>
                  {cls}
                </option>
              ))}
            </select>
          </label>

          <div className="datesheet-action-buttons">
            <button
              type="button"
              className="btn tap datesheet-add-repeater-btn"
              onClick={() => setRepeaterModalOpen(true)}
            >
              <Plus size={16} aria-hidden />
              <span>Add Repeat Courses ({repeaterExams.length})</span>
            </button>

            <ExportDatesheetImage
              className={selectedClass}
              exams={personalExams}
            />

            <button
              type="button"
              className="btn tap datesheet-ics-btn"
              onClick={handleDownloadIcs}
              title="Add all your exams to Google Calendar / Phone Calendar with 60-min alarms"
            >
              <Calendar size={16} aria-hidden />
              <span>Calendar (.ics)</span>
            </button>

            <button
              type="button"
              className="btn tap datesheet-print-btn"
              onClick={handlePrint}
              title="Print Official Examination Slip or Save as PDF"
            >
              <Printer size={16} aria-hidden />
              <span>Print Slip / PDF</span>
            </button>
          </div>
        </div>

        {/* Date Filter Tabs */}
        <div className="datesheet-date-tabs" role="tablist">
          <button
            type="button"
            className={`datesheet-date-pill ${selectedDate === "all" ? "active" : ""}`}
            onClick={() => setSelectedDate("all")}
          >
            All Dates ({personalExams.length})
          </button>
          {DATESHEET.dates.map((d) => {
            const count = personalExams.filter((e) => e.date === d).length;
            const isShifted = d === "2026-11-12";
            return (
              <button
                key={d}
                type="button"
                className={`datesheet-date-pill ${selectedDate === d ? "active" : ""}`}
                onClick={() => setSelectedDate(d)}
              >
                <span>{d.slice(5)}</span>
                {isShifted ? <span className="datesheet-shifted-tag">Shifted (4 Nov)</span> : null}
                <span className="datesheet-pill-count">{count}</span>
              </button>
            );
          })}
        </div>

        {/* Search Bar */}
        <div className="datesheet-search-row">
          <div className="office-search-wrap">
            <Search size={16} aria-hidden />
            <input
              type="search"
              className="input office-search-input"
              placeholder="Search by course code, title, instructor, or room…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {repeaterExams.length > 0 && (
            <span className="datesheet-repeater-summary-tag">
              Includes {repeaterExams.length} repeater exam{repeaterExams.length === 1 ? "" : "s"}
            </span>
          )}
        </div>
      </div>

      {/* Exam Cards Grid */}
      <div className="datesheet-cards-grid">
        {displayedExams.length === 0 ? (
          <div className="empty-state stack">
            <Calendar size={32} aria-hidden />
            <h3>No exams found for this selection</h3>
            <p className="quiet">
              Try selecting another date or clearing your search query.
            </p>
          </div>
        ) : (
          displayedExams.map((exam) => {
            const timeInfo = getExamTimeInfo(exam, now || new Date());
            const isRepeater = exam.className !== selectedClass;

            return (
              <div
                key={exam.id}
                className={`datesheet-card ${timeInfo.status === "completed" ? "completed" : ""} ${
                  timeInfo.status === "in_progress" ? "in-progress" : ""
                }`}
              >
                <div className="datesheet-card-top">
                  <div className="datesheet-date-badge">
                    <Calendar size={14} aria-hidden />
                    <b>{exam.date}</b>
                    {exam.isRescheduled ? (
                      <span className="datesheet-shifted-chip" title="Shifted from 4 November">
                        Shifted from 4 Nov
                      </span>
                    ) : null}
                  </div>

                  <div className="datesheet-status-pill-wrap">
                    {isRepeater ? (
                      <span className="datesheet-repeater-chip">
                        Repeat ({exam.className})
                      </span>
                    ) : null}
                    <span className={`exam-status-pill ${timeInfo.status}`}>
                      {timeInfo.badgeLabel}
                    </span>
                  </div>
                </div>

                <div className="datesheet-course-info">
                  <span className="datesheet-course-code">{exam.courseCode}</span>
                  <h3 className="datesheet-course-title">{exam.courseTitle}</h3>
                </div>

                <div className="datesheet-meta-grid">
                  <div className="datesheet-meta-item">
                    <Clock size={15} aria-hidden />
                    <div>
                      <span className="fine quiet">Time Slot</span>
                      <b>
                        {exam.startTime} – {exam.endTime}
                      </b>
                    </div>
                  </div>

                  <div className="datesheet-meta-item highlight">
                    <MapPin size={15} aria-hidden />
                    <div>
                      <span className="fine quiet">Examination Hall / Room</span>
                      <b>{exam.room}</b>
                    </div>
                  </div>

                  <div className="datesheet-meta-item">
                    <GraduationCap size={15} aria-hidden />
                    <div>
                      <span className="fine quiet">Course Instructor</span>
                      <span>{exam.instructor}</span>
                    </div>
                  </div>

                  <div className="datesheet-meta-item">
                    <Users size={15} aria-hidden />
                    <div>
                      <span className="fine quiet">Class & Strength</span>
                      <span>
                        {exam.className} ({exam.strength} Students)
                      </span>
                    </div>
                  </div>
                </div>

                {exam.invigilators ? (
                  <div className="datesheet-invigilators-row">
                    <span className="fine quiet">Invigilators:</span>
                    <span className="fine">{exam.invigilators}</span>
                  </div>
                ) : null}

                {/* Footer status / remove repeater */}
                <div className="datesheet-card-footer">
                  <span className="fine quiet">{timeInfo.timeRemaining}</span>
                  {isRepeater && (
                    <button
                      type="button"
                      className="btn tap datesheet-remove-btn"
                      onClick={() => handleRemoveRepeaterCourse(exam.id)}
                      title="Remove this repeat course"
                    >
                      <Trash2 size={13} aria-hidden />
                      <span>Remove Repeat</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Printable Exam Roll Slip (Visible only in print / PDF mode) */}
      <div className="datesheet-printable-slip" aria-hidden="true">
        <div className="print-slip-header">
          <h2>COMSATS UNIVERSITY ISLAMABAD · ATTOCK CAMPUS</h2>
          <h3>Midterm Examination Slip — Fall 2026</h3>
          <p className="print-slip-meta">
            <b>Class / Batch:</b> {selectedClass} &nbsp;·&nbsp; <b>Total Scheduled Exams:</b> {personalExams.length} &nbsp;·&nbsp; <b>Generated:</b> {new Date().toLocaleDateString("en-GB")}
          </p>
          <div className="print-slip-notice">
            <b>Notice:</b> Examination papers originally on <b>4 November 2026</b> have been officially shifted to <b>12 November 2026</b> with identical timings and room allocations.
          </div>
        </div>
        <table className="print-slip-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Date</th>
              <th>Time</th>
              <th>Course Code</th>
              <th>Course Title</th>
              <th>Hall / Room</th>
              <th>Instructor</th>
              <th>Category</th>
            </tr>
          </thead>
          <tbody>
            {personalExams.map((exam, idx) => (
              <tr key={exam.id}>
                <td>{idx + 1}</td>
                <td>
                  <b>{exam.date}</b>
                  {exam.isRescheduled ? " (Shifted from 4 Nov)" : ""}
                </td>
                <td>{exam.startTime} – {exam.endTime}</td>
                <td><b>{exam.courseCode}</b></td>
                <td>{exam.courseTitle}</td>
                <td><b>{exam.room}</b></td>
                <td>{exam.instructor}</td>
                <td>{exam.className === selectedClass ? "Regular" : `Repeat (${exam.className})`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Bottom Back to Timetable Button */}
      <div className="datesheet-bottom-back-row">
        <button
          type="button"
          className="btn tap view-back-btn"
          onClick={() => goBack("today")}
        >
          <ArrowLeft size={16} aria-hidden />
          <span>Back to Timetable</span>
        </button>
      </div>

      {/* Repeater Course Selector Modal */}
      {repeaterModalOpen && (
        <RepeaterCoursesModal
          alreadySelectedIds={repeaterExamIds}
          currentClass={selectedClass}
          onAdd={handleAddRepeaterCourse}
          onRemove={handleRemoveRepeaterCourse}
          onClose={() => setRepeaterModalOpen(false)}
        />
      )}
    </div>
  );
}

/**
 * Modal to allow repeater students to search and pick any course from other batches
 */
function RepeaterCoursesModal({
  alreadySelectedIds,
  currentClass,
  onAdd,
  onRemove,
  onClose,
}: {
  alreadySelectedIds: number[];
  currentClass: string;
  onAdd: (id: number) => void;
  onRemove: (id: number) => void;
  onClose: () => void;
}) {
  const [modalSearch, setModalSearch] = useState("");
  const [filterClass, setFilterClass] = useState("All");

  const needle = modalSearch.trim().toLowerCase();

  const candidateExams = useMemo(() => {
    return DATESHEET.exams.filter((exam) => {
      // Exclude exams belonging to their current class
      if (exam.className === currentClass) return false;

      if (filterClass !== "All" && exam.className !== filterClass) return false;

      if (needle) {
        const matchCode = exam.courseCode.toLowerCase().includes(needle);
        const matchTitle = exam.courseTitle.toLowerCase().includes(needle);
        const matchClass = exam.className.toLowerCase().includes(needle);
        const matchInstructor = exam.instructor.toLowerCase().includes(needle);
        if (!matchCode && !matchTitle && !matchClass && !matchInstructor) return false;
      }
      return true;
    });
  }, [currentClass, filterClass, needle]);

  return (
    <div className="notif-modal-backdrop" onClick={onClose}>
      <div
        className="notif-modal datesheet-repeater-modal"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="notif-modal-head">
          <div className="notif-modal-title-group">
            <span className="notif-modal-icon">
              <Plus size={22} aria-hidden />
            </span>
            <div>
              <h2 className="section-title">Add Repeat / Improvement Courses</h2>
              <p className="quiet fine">
                Search courses from other semesters to add to your personal datesheet
              </p>
            </div>
          </div>
          <button type="button" className="icon-btn tap" onClick={onClose} aria-label="Close">
            <X size={18} aria-hidden />
          </button>
        </div>

        <div className="notif-modal-body stack">
          <div className="datesheet-modal-controls">
            <div className="office-search-wrap">
              <Search size={16} aria-hidden />
              <input
                type="search"
                className="input office-search-input"
                placeholder="Search subject code (e.g. CSC211, MTH104) or title…"
                value={modalSearch}
                onChange={(e) => setModalSearch(e.target.value)}
                autoFocus
              />
            </div>

            <select
              className="select"
              value={filterClass}
              onChange={(e) => setFilterClass(e.target.value)}
            >
              <option value="All">All Other Classes</option>
              {DATESHEET.classes
                .filter((c) => c !== currentClass)
                .map((cls) => (
                  <option key={cls} value={cls}>
                    {cls}
                  </option>
                ))}
            </select>
          </div>

          <div className="datesheet-modal-candidates-list">
            {candidateExams.slice(0, 50).map((exam) => {
              const isSelected = alreadySelectedIds.includes(exam.id);
              return (
                <div key={exam.id} className="datesheet-modal-candidate-item">
                  <div className="datesheet-modal-candidate-info">
                    <div className="datesheet-modal-candidate-title-row">
                      <b>
                        {exam.courseCode}: {exam.courseTitle}
                      </b>
                      <span className="datesheet-shifted-chip">{exam.className}</span>
                    </div>
                    <span className="fine quiet">
                      📅 {exam.date} · 🕒 {exam.startTime} – {exam.endTime} · 📍 {exam.room}
                    </span>
                  </div>

                  <button
                    type="button"
                    className={`btn tap ${isSelected ? "solid" : ""}`}
                    onClick={() => {
                      if (isSelected) onRemove(exam.id);
                      else onAdd(exam.id);
                    }}
                  >
                    {isSelected ? "Remove" : "+ Add Course"}
                  </button>
                </div>
              );
            })}
          </div>

          <div className="notif-modal-actions">
            <button type="button" className="btn solid tap" onClick={onClose}>
              Done Selecting
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
