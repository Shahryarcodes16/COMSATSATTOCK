import { useState, useMemo } from "react";
import {
  TrendingUp,
  Clock,
  BookOpen,
  Award,
  AlertCircle,
  Sparkles,
  Calendar,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Info,
  ShieldCheck,
  Zap,
} from "lucide-react";
import {
  computeFacultyAnalytics,
  STANDARD_THEORY_QUOTA,
  SEMESTER_TOTAL_WEEKS,
} from "@/lib/faculty-analytics";
import {
  addClassCancellation,
  removeClassCancellation,
  settleClassCancellation,
  getClassCancellations,
} from "@/lib/campus-pulse";
import type {
  ClassCancellationRecord,
  FacultyAnalytics,
  TimetableRaw,
} from "@/lib/timetable-types";
import { SLOTS, DAYS } from "@/lib/schedule";

interface FacultyAnalyticsPanelProps {
  teacherId: number;
  teacherName: string;
  teacherEmail?: string;
  rawTimetable?: TimetableRaw;
  onNavigateToMakeup?: (batchId?: number) => void;
}

export function FacultyAnalyticsPanel({
  teacherId,
  teacherName,
  teacherEmail = "",
  rawTimetable,
  onNavigateToMakeup,
}: FacultyAnalyticsPanelProps) {
  const [revision, setRevision] = useState(0);

  const analytics: FacultyAnalytics = useMemo(() => {
    return computeFacultyAnalytics(
      teacherId,
      teacherName,
      teacherEmail,
      new Date(),
      rawTimetable,
    );
  }, [teacherId, teacherName, teacherEmail, rawTimetable, revision]);

  const handleSettleDebtManually = (debtId: string) => {
    settleClassCancellation(debtId, "manual_override");
    setRevision((r) => r + 1);
  };

  return (
    <div className="faculty-analytics-container stack">
      {/* 1. Top Metrics Banner */}
      <div className="analytics-metrics-grid">
        <div className="metric-card">
          <div className="metric-icon primary">
            <BookOpen size={18} />
          </div>
          <div className="metric-content">
            <span className="metric-label">Conducted Classes</span>
            <strong className="metric-value">
              {analytics.totalEffectiveConducted}
            </strong>
            <span className="metric-sub">
              Target: {analytics.semesterTargetLectures} lectures
            </span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon success">
            <TrendingUp size={18} />
          </div>
          <div className="metric-content">
            <span className="metric-label">Syllabus Quota Progress</span>
            <strong className="metric-value">{analytics.percentageComplete}%</strong>
            <span className="metric-sub">
              Week by week calendar tracker
            </span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon accent">
            <Award size={18} />
          </div>
          <div className="metric-content">
            <span className="metric-label">11:30–1:15 Double Lectures</span>
            <strong className="metric-value">
              +{analytics.doubleLectureBonusCount * 2}
            </strong>
            <span className="metric-sub">
              Counts as 2 contact lectures/week
            </span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon warning">
            <AlertCircle size={18} />
          </div>
          <div className="metric-content">
            <span className="metric-label">Make-up Class Debt</span>
            <strong className="metric-value">
              {analytics.cancellationsDebtCount}
            </strong>
            <span className="metric-sub">
              {analytics.cancellationsDebtCount === 0
                ? "All classes up to date"
                : "Pending makeup classes owed"}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Double Lecture Rule Explanation Banner */}
      <div className="rule-explanation-card">
        <div className="rule-icon-left">
          <Sparkles size={20} className="text-teal" />
        </div>
        <div className="rule-content">
          <h4>
            Official Academic Rule: 11:30 to 1:15 Slot (L3) Double Counting
          </h4>
          <p className="fine">
            If a theory subject has <strong>only 1 lecture scheduled per week</strong> and it falls in <strong>Slot L3 (11:30 AM – 1:15 PM)</strong>, the extended duration covers two standard curriculum contact periods. The system automatically awards <strong>2 class credits</strong> toward your 32-lecture semester quota for each meeting.
          </p>
        </div>
      </div>

      {/* 3. Course Breakdown Table */}
      <div className="courses-analytics-card stack">
        <div className="card-head-row">
          <div>
            <h4>Course Lecture & Lab Quota Breakdown</h4>
            <p className="fine quiet">
              Tracking scheduled contact hours, conducted sessions, and projected completion.
            </p>
          </div>
        </div>

        <div className="table-responsive">
          <table className="analytics-table">
            <thead>
              <tr>
                <th>Course / Subject</th>
                <th>Type</th>
                <th>Assigned Batches</th>
                <th>Weekly Meetings</th>
                <th>Double Counted (L3)</th>
                <th>Conducted to Date</th>
                <th>Target Quota</th>
                <th>Progress</th>
              </tr>
            </thead>
            <tbody>
              {analytics.courses.map((course) => {
                const target = course.semesterProjectedCount;
                const conducted = course.conductedCountToDate;
                const pct = Math.min(100, Math.round((conducted / target) * 100));

                return (
                  <tr key={course.subjectId}>
                    <td className="course-title-cell">
                      <strong>{course.subjectName}</strong>
                    </td>
                    <td>
                      <span className={`type-tag ${course.isLab ? "lab" : "theory"}`}>
                        {course.isLab ? "Lab Session" : "Theory"}
                      </span>
                    </td>
                    <td>
                      <span className="fine quiet">{course.batchNames.join(", ")}</span>
                    </td>
                    <td>
                      <strong>{course.weeklySlotsCount}</strong> slot(s)/week
                    </td>
                    <td>
                      {course.isDoubleLectureL3 ? (
                        <span className="badge-double-rule" title="11:30-1:15 single weekly lecture counts as 2">
                          <CheckCircle2 size={12} /> Yes (2x Credit)
                        </span>
                      ) : (
                        <span className="fine quiet">Standard</span>
                      )}
                    </td>
                    <td>
                      <strong>{conducted}</strong> lectures
                    </td>
                    <td>{target}</td>
                    <td>
                      <div className="table-progress-wrap">
                        <div className="mini-progress-bar">
                          <div
                            className="mini-progress-fill"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="fine">{pct}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Make-up Debt Ledger */}
      <div className="debt-ledger-card stack">
        <div className="card-head-row">
          <div>
            <h4>Make-up Class Debt Ledger</h4>
            <p className="fine quiet">
              Classes cancelled through the application are logged here. The system remembers your owed make-ups so you can arrange replacement slots with 1 click.
            </p>
          </div>

          <span className="debt-summary-pill">
            {analytics.pendingDebts.length} Pending Debt{analytics.pendingDebts.length === 1 ? "" : "s"}
          </span>
        </div>

        {analytics.pendingDebts.length > 0 ? (
          <div className="debt-list stack">
            {analytics.pendingDebts.map((debt) => (
              <div key={debt.id} className="debt-item-card">
                <div className="debt-item-left">
                  <div className="debt-date-badge">
                    <Calendar size={14} className="text-teal" />
                    <strong>{debt.targetDateLabel}</strong>
                    <span className="fine quiet">
                      {DAYS[debt.day]} · {SLOTS[debt.slot]?.label}
                    </span>
                  </div>

                  <div className="debt-details">
                    <div className="debt-course-line">
                      <strong className="course-name">{debt.subjectName}</strong>
                      <span className="batch-pill">{debt.batchName}</span>
                      <span className="room-pill">Venue: {debt.roomName}</span>
                    </div>
                    <p className="debt-reason fine">
                      <strong>Reason: </strong> {debt.reason}
                    </p>
                  </div>
                </div>

                <div className="debt-actions">
                  <button
                    type="button"
                    className="btn primary fine tap"
                    onClick={() => {
                      if (onNavigateToMakeup) {
                        onNavigateToMakeup(debt.batch);
                      }
                    }}
                  >
                    <Sparkles size={13} />
                    <span>⚡ Find & Book Make-up Slot</span>
                  </button>

                  <button
                    type="button"
                    className="btn secondary fine tap"
                    onClick={() => handleSettleDebtManually(debt.id)}
                    title="Mark this debt as settled without booking a new slot"
                  >
                    <span>Mark Settled</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="zero-debt-state">
            <ShieldCheck size={36} className="text-emerald" />
            <h5>Zero Make-up Debt</h5>
            <p className="quiet fine">
              You have no pending cancelled lectures. All scheduled contact hours are fully satisfied!
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
