import { useState, useEffect, useMemo } from "react";
import {
  Activity,
  Clock,
  DoorOpen,
  GraduationCap,
  Users,
  Flame,
  Radio,
  Sparkles,
  Calendar,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
} from "lucide-react";
import { getCampusPulseTelemetry } from "@/lib/campus-pulse";
import type { CampusPulseTelemetry, TimetableRaw } from "@/lib/timetable-types";
import { useDesk } from "@/components/timetable/context";
import { SLOTS } from "@/lib/schedule";

interface CampusPulseViewProps {
  rawTimetable?: TimetableRaw;
}

export function CampusPulseView({ rawTimetable }: CampusPulseViewProps) {
  const { now, setView, open } = useDesk();
  const [pulseData, setPulseData] = useState<CampusPulseTelemetry>(() =>
    getCampusPulseTelemetry(now || new Date(), rawTimetable),
  );

  // Subscribe to cancellation and makeup updates
  useEffect(() => {
    const handleUpdate = () => {
      setPulseData(getCampusPulseTelemetry(now || new Date(), rawTimetable));
    };

    window.addEventListener("cui:class-cancellations-updated", handleUpdate);
    window.addEventListener("cui:makeup-classes-updated", handleUpdate);
    window.addEventListener("cui:timetable-updated", handleUpdate);
    window.addEventListener("storage", handleUpdate);

    return () => {
      window.removeEventListener("cui:class-cancellations-updated", handleUpdate);
      window.removeEventListener("cui:makeup-classes-updated", handleUpdate);
      window.removeEventListener("cui:timetable-updated", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, [now, rawTimetable]);

  // Recalculate when now changes
  useEffect(() => {
    setPulseData(getCampusPulseTelemetry(now || new Date(), rawTimetable));
  }, [now, rawTimetable]);

  const phaseDetails = useMemo(() => {
    switch (pulseData.livePhase) {
      case "live":
        return {
          title: "Lectures In Session",
          desc: `${pulseData.liveSlotLabel} is active. Next transition in ${pulseData.minutesToNextTransition} mins.`,
          badgeClass: "badge-live",
        };
      case "break":
        return {
          title: "Lecture Break",
          desc: `Next lecture ${pulseData.nextSlotLabel} begins in ${pulseData.minutesToNextTransition} mins.`,
          badgeClass: "badge-break",
        };
      case "before":
        return {
          title: "Pre-Class Morning",
          desc: `Campus opens for L1 at 8:30 AM (in ${pulseData.minutesToNextTransition} mins).`,
          badgeClass: "badge-before",
        };
      case "after":
        return {
          title: "Teaching Day Concluded",
          desc: "All scheduled lectures for today have finished. Free rooms open for study.",
          badgeClass: "badge-after",
        };
      default:
        return {
          title: "Weekend Quiet",
          desc: "No formal lectures scheduled today. Campus reopens on Monday at 8:30 AM.",
          badgeClass: "badge-weekend",
        };
    }
  }, [pulseData]);

  return (
    <div className="campus-pulse-container stack">
      {/* 1. Live Beacon Header Card */}
      <div className="pulse-banner-card">
        <div className="pulse-beacon-header">
          <div className="beacon-left">
            <span className={`pulse-beacon-indicator ${pulseData.livePhase === "live" ? "active" : ""}`}>
              <Radio size={14} className="radio-icon" />
            </span>
            <div>
              <div className="beacon-title-row">
                <h3>Campus Pulse Live Telemetry</h3>
                <span className={`pulse-status-tag ${phaseDetails.badgeClass}`}>
                  {phaseDetails.title}
                </span>
              </div>
              <p className="fine quiet">{phaseDetails.desc}</p>
            </div>
          </div>

          <div className="beacon-time-box">
            <Clock size={16} className="text-teal" />
            <div className="time-display">
              <span className="live-clock">
                {now ? now.toLocaleTimeString("en-PK", { timeZone: "Asia/Karachi", hour: "2-digit", minute: "2-digit" }) : "--:--"}
              </span>
              <span className="fine quiet">{pulseData.currentDayLabel}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Live Telemetry Metrics Row */}
      <div className="pulse-metrics-grid">
        <div className="metric-card">
          <div className="metric-icon primary">
            <Activity size={18} />
          </div>
          <div className="metric-content">
            <span className="metric-label">Lectures In Session</span>
            <strong className="metric-value">{pulseData.classesInSessionCount}</strong>
            <span className="metric-sub">Across campus right now</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon success">
            <GraduationCap size={18} />
          </div>
          <div className="metric-content">
            <span className="metric-label">Active Instructors</span>
            <strong className="metric-value">{pulseData.activeTeachersCount}</strong>
            <span className="metric-sub">Conducting classes now</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon accent">
            <DoorOpen size={18} />
          </div>
          <div className="metric-content">
            <span className="metric-label">Available Free Rooms</span>
            <strong className="metric-value">{pulseData.freeRoomsCount}</strong>
            <span className="metric-sub">Out of {pulseData.totalRoomsCount} venues</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon warning">
            <Flame size={18} />
          </div>
          <div className="metric-content">
            <span className="metric-label">Occupied Rooms</span>
            <strong className="metric-value">{pulseData.occupiedRoomsCount}</strong>
            <span className="metric-sub">Venues in active use</span>
          </div>
        </div>
      </div>

      {/* 3. Live Classes In Session List */}
      <div className="pulse-active-classes-section stack">
        <div className="section-head-row">
          <div>
            <h4>
              Live Classes Underway ({pulseData.classesInSession.length})
            </h4>
            <p className="fine quiet">
              Real-time cascade: shows scheduled lectures, arranged makeups, and cancellations.
            </p>
          </div>

          <button
            type="button"
            className="btn secondary fine tap"
            onClick={() => setView("rooms")}
          >
            <DoorOpen size={13} />
            <span>Open Free Room Radar</span>
          </button>
        </div>

        {pulseData.classesInSession.length > 0 ? (
          <div className="active-classes-grid">
            {pulseData.classesInSession.map((cls, idx) => (
              <div
                key={idx}
                className={`active-class-card ${cls.isCancelled ? "cancelled" : cls.isMakeup ? "makeup" : ""}`}
              >
                <div className="class-card-top">
                  <span className="class-venue-pill">
                    <DoorOpen size={12} />
                    {cls.room || "TBA"}
                  </span>

                  {cls.isCancelled ? (
                    <span className="status-pill cancelled">
                      CANCELLED BY FACULTY (ROOM FREED)
                    </span>
                  ) : cls.isMakeup ? (
                    <span className="status-pill makeup">
                      <Sparkles size={11} /> ARRANGED MAKEUP
                    </span>
                  ) : (
                    <span className="status-pill regular">IN SESSION</span>
                  )}
                </div>

                <div className="class-info-block">
                  <h5 className="class-course-title">{cls.course}</h5>
                  <div className="class-meta-details fine quiet">
                    <span>Batch: <strong>{cls.batch}</strong></span>
                    <span>Teacher: <strong>{cls.teacher || "Unassigned"}</strong></span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-pulse-state">
            <Clock size={32} className="quiet" />
            <p>
              {pulseData.livePhase === "break"
                ? "Campus is in between lecture slots. Next classes will start shortly."
                : "No lectures currently in session at this hour."}
            </p>
          </div>
        )}
      </div>

      {/* 4. Real-Time Dynamic Cascade Feed (Recent Events) */}
      <div className="pulse-events-feed stack">
        <div className="section-head-row">
          <h4>Recent Campus Activity & Schedule Cascade</h4>
          <span className="fine quiet">Live updates</span>
        </div>

        {pulseData.recentEvents.length > 0 ? (
          <div className="events-timeline stack">
            {pulseData.recentEvents.map((ev) => (
              <div key={ev.id} className={`event-timeline-item ${ev.type}`}>
                <div className="event-bullet" />
                <div className="event-content">
                  <div className="event-title-line">
                    <strong className="event-title">{ev.title}</strong>
                    <span className="event-time fine quiet">{ev.timeAgo}</span>
                  </div>
                  <p className="event-details fine">{ev.details}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="no-events-box fine quiet">
            No schedule cancellations or makeups logged today. Campus timetable is running standard schedule.
          </div>
        )}
      </div>
    </div>
  );
}
