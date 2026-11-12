import { useState, useEffect, useMemo } from "react";
import { AlertCircle, AlertTriangle, Info, CheckCircle2, X } from "lucide-react";
import { getCampusNotice, syncAdminDataFromServer, type CampusNotice } from "@/lib/admin";
import {
  batchesMatch,
  getClassCancellations,
  syncCancellationsFromServer,
  type ClassCancellationRecord,
} from "@/lib/campus-pulse";
import { getActiveStudentSession, type StudentSession } from "@/lib/student";
import { loadCustomSchedule } from "@/lib/my-schedule";
import { isNotificationSupported, sendSystemNotification } from "@/lib/notifications";
import { useDesk } from "@/components/timetable/context";
import { DAYS, SLOTS, batches, subjects, teachers, type ClassEntry } from "@/lib/schedule";

const NOTIFIED_CANCEL_KEY = "cui_notified_cancellations_v1";

function markCancellationNotified(id: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = sessionStorage.getItem(NOTIFIED_CANCEL_KEY);
    const seen: string[] = raw ? JSON.parse(raw) : [];
    if (seen.includes(id)) return false;
    seen.push(id);
    sessionStorage.setItem(NOTIFIED_CANCEL_KEY, JSON.stringify(seen.slice(-50)));
    return true;
  } catch {
    return false;
  }
}

export function CampusNoticeBanner() {
  const { batchId, pinnedBatch, view } = useDesk();
  const [notice, setNotice] = useState<CampusNotice | null>(() => getCampusNotice());
  const [cancellations, setCancellations] = useState<ClassCancellationRecord[]>(() =>
    getClassCancellations().filter((c) => c.status === "active"),
  );
  const [studentSession, setStudentSession] = useState<StudentSession | null>(() =>
    getActiveStudentSession(),
  );
  const [customSchedule, setCustomSchedule] = useState<ClassEntry[]>(() =>
    loadCustomSchedule(),
  );
  const [dismissedNotice, setDismissedNotice] = useState(false);
  const [dismissedCancellationIds, setDismissedCancellationIds] = useState<Set<string>>(
    () => new Set(),
  );

  useEffect(() => {
    // 1. Sync admin announcement
    syncAdminDataFromServer().then((cfg) => {
      if (cfg?.notice) {
        setNotice(cfg.notice);
      }
    });

    // 2. Sync cancellations from server database
    syncCancellationsFromServer().then((list) => {
      if (Array.isArray(list)) {
        setCancellations(list.filter((c) => c.status === "active"));
      }
    });

    const handleNoticeUpdate = () => {
      setNotice(getCampusNotice());
      setDismissedNotice(false);
    };

    const handleCancellationsUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<ClassCancellationRecord[]>;
      const list = customEvent.detail || getClassCancellations();
      setCancellations(list.filter((c) => c.status === "active"));
    };

    const handleStudentUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<StudentSession | null>;
      setStudentSession(customEvent.detail ?? getActiveStudentSession());
    };

    const handleCustomScheduleUpdate = () => {
      setCustomSchedule(loadCustomSchedule());
    };

    const handleStorage = () => {
      setNotice(getCampusNotice());
      setCancellations(getClassCancellations().filter((c) => c.status === "active"));
      setStudentSession(getActiveStudentSession());
      setCustomSchedule(loadCustomSchedule());
    };

    window.addEventListener("cui:campus-notice-update", handleNoticeUpdate);
    window.addEventListener("cui:class-cancellations-updated", handleCancellationsUpdate);
    window.addEventListener("cui:student-session-update", handleStudentUpdate);
    window.addEventListener("cui:custom-schedule-update", handleCustomScheduleUpdate);
    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener("cui:campus-notice-update", handleNoticeUpdate);
      window.removeEventListener("cui:class-cancellations-updated", handleCancellationsUpdate);
      window.removeEventListener("cui:student-session-update", handleStudentUpdate);
      window.removeEventListener("cui:custom-schedule-update", handleCustomScheduleUpdate);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  // Filter cancellations strictly relevant to this student's enrolled batch, pinned batch, or custom courses
  const relevantCancellations = useMemo(() => {
    const studentBatch = (studentSession?.profile?.defaultBatch || "").trim();
    const pinnedBatchName = pinnedBatch !== null ? (batches[pinnedBatch] || "").trim() : "";
    const activeBatchName = (batches[batchId] || "").trim();

    return cancellations.filter((c) => {
      if (dismissedCancellationIds.has(c.id)) return false;

      // 1. Match logged-in student's enrolled batch
      if (studentBatch && batchesMatch(c.batchName, studentBatch)) {
        return true;
      }

      // 2. Match student's pinned batch on dashboard
      if (
        pinnedBatch !== null &&
        (c.batch === pinnedBatch || batchesMatch(c.batchName, pinnedBatchName))
      ) {
        return true;
      }

      // 3. Match any specific course the student added into "My Schedule" (handles repeaters & cross-section courses)
      if (customSchedule.length > 0) {
        const matchesCustomCourse = customSchedule.some((entry) => {
          const entryBatch = batches[entry.batch] || "";
          const entrySubject = subjects[entry.subject] || "";
          const entryTeacher = entry.teacher >= 0 ? teachers[entry.teacher] || "" : "";

          const sameBatch = entry.batch === c.batch || batchesMatch(entryBatch, c.batchName);
          const sameSubject =
            entry.subject === c.subject ||
            entrySubject.toLowerCase().trim() === c.subjectName.toLowerCase().trim();
          const sameTeacher =
            entry.teacher === c.teacher ||
            (entryTeacher !== "" &&
              entryTeacher.toLowerCase().trim() === c.teacherName.toLowerCase().trim());

          return (sameBatch && sameSubject) || (sameTeacher && sameSubject);
        });
        if (matchesCustomCourse) {
          return true;
        }
      }

      // 4. Match currently inspected batch when browsing Batches tab or if student has no saved batch yet
      const hasSavedBatchContext =
        Boolean(studentBatch) || pinnedBatch !== null || customSchedule.length > 0;
      if (
        (view === "batches" || !hasSavedBatchContext) &&
        (c.batch === batchId || batchesMatch(c.batchName, activeBatchName))
      ) {
        return true;
      }

      // Do not display cancellations to students from unrelated batches or courses
      return false;
    });
  }, [
    cancellations,
    studentSession,
    pinnedBatch,
    batchId,
    view,
    customSchedule,
    dismissedCancellationIds,
  ]);

  // Also trigger a system notification (if enabled) when a fresh relevant cancellation arrives
  useEffect(() => {
    if (!isNotificationSupported() || Notification.permission !== "granted") return;
    for (const c of relevantCancellations) {
      if (markCancellationNotified(c.id)) {
        const slotDef = SLOTS[c.slot];
        const slotLabel = slotDef ? `${slotDef.label} (${slotDef.start})` : `Slot ${c.slot + 1}`;
        sendSystemNotification(`🚨 Lecture Cancelled: ${c.subjectName}`, {
          body: `${c.teacherName} cancelled ${c.batchName} (${slotLabel}). ${c.reason || ""}`.trim(),
          playChime: true,
          tag: `cancel_${c.id}`,
        });
      }
    }
  }, [relevantCancellations]);

  const handleDismissCancellation = (id: string) => {
    setDismissedCancellationIds((prev) => new Set([...prev, id]));
  };

  const getNoticeIcon = (type: string) => {
    switch (type) {
      case "urgent":
        return <AlertTriangle size={18} aria-hidden />;
      case "warning":
        return <AlertCircle size={18} aria-hidden />;
      case "success":
        return <CheckCircle2 size={18} aria-hidden />;
      default:
        return <Info size={18} aria-hidden />;
    }
  };

  return (
    <div className="campus-banner-wrapper stack">
      {/* 1. Student Class Cancellation Alert Banners (Highest Priority) */}
      {relevantCancellations.map((c) => {
        const slotDef = SLOTS[c.slot];
        const slotLabel = slotDef ? `${slotDef.label} (${slotDef.start} – ${slotDef.end})` : `Slot ${c.slot + 1}`;
        const dayLabel = DAYS[c.day] || "Day";

        return (
          <div
            key={c.id}
            className="campus-global-notice cancellation-student-banner"
            role="alert"
            style={{
              background: "color-mix(in srgb, #e11d48 12%, var(--c-paper))",
              border: "1.5px solid #e11d48",
              color: "var(--c-ink)",
              borderRadius: "var(--r-md)",
              padding: "0.85rem 1rem",
              display: "flex",
              alignItems: "flex-start",
              gap: "0.85rem",
              boxShadow: "0 4px 14px rgba(225, 29, 72, 0.12)",
            }}
          >
            <div style={{ color: "#e11d48", marginTop: "2px", flexShrink: 0 }}>
              <AlertTriangle size={20} aria-hidden />
            </div>

            <div style={{ flex: 1, fontSize: "0.88rem", lineHeight: 1.45 }}>
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap", marginBottom: "0.25rem" }}>
                <span
                  style={{
                    background: "#e11d48",
                    color: "#fff",
                    fontWeight: 800,
                    fontSize: "0.72rem",
                    padding: "0.15rem 0.5rem",
                    borderRadius: "4px",
                    letterSpacing: "0.04em",
                  }}
                >
                  🚨 LECTURE CANCELLED
                </span>
                <strong style={{ color: "#e11d48" }}>{c.subjectName} ({c.batchName})</strong>
                <span className="fine quiet">• {c.targetDateLabel || dayLabel} at {slotLabel}</span>
              </div>

              <p style={{ margin: "0.2rem 0", color: "var(--c-ink)" }}>
                Instructor <strong>{c.teacherName}</strong> has cancelled this lecture.
                {c.reason && (
                  <span>
                    {" "}Reason: <em>&quot;{c.reason}&quot;</em>.
                  </span>
                )}
              </p>

              <div style={{ fontSize: "0.78rem", color: "var(--c-muted)", display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "0.25rem" }}>
                <span>• Students of <strong>{c.batchName}</strong> are not required to attend.</span>
                <span>• Venue <strong>{c.roomName}</strong> is released as FREE.</span>
              </div>
            </div>

            <button
              type="button"
              className="campus-notice-close"
              onClick={() => handleDismissCancellation(c.id)}
              aria-label="Dismiss cancellation alert"
              style={{
                background: "transparent",
                border: "none",
                cursor: "pointer",
                padding: "0.25rem",
                color: "var(--c-muted)",
              }}
            >
              <X size={16} aria-hidden />
            </button>
          </div>
        );
      })}

      {/* 2. Admin Campus Announcement Banner */}
      {notice && notice.enabled && !dismissedNotice && (
        <div className={`campus-global-notice ${notice.type}`} role="alert">
          <div className="campus-notice-icon">{getNoticeIcon(notice.type)}</div>
          <div className="campus-notice-body">
            {notice.title && <b>{notice.title}: </b>}
            <span>{notice.message}</span>
          </div>
          <button
            type="button"
            className="campus-notice-close"
            onClick={() => setDismissedNotice(true)}
            aria-label="Dismiss notice"
          >
            <X size={15} aria-hidden />
          </button>
        </div>
      )}
    </div>
  );
}
