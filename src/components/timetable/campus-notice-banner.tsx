import { useState, useEffect, useMemo } from "react";
import { AlertCircle, AlertTriangle, Info, CheckCircle2, X, Bell } from "lucide-react";
import { getCampusNotice, syncAdminDataFromServer, type CampusNotice } from "@/lib/admin";
import {
  getClassCancellations,
  syncCancellationsFromServer,
  type ClassCancellationRecord,
} from "@/lib/campus-pulse";
import { getActiveStudentSession } from "@/lib/student";
import { useDesk } from "@/components/timetable/context";
import { DAYS, SLOTS, batches } from "@/lib/schedule";

export function CampusNoticeBanner() {
  const { batchId, pinnedBatch } = useDesk();
  const [notice, setNotice] = useState<CampusNotice | null>(() => getCampusNotice());
  const [cancellations, setCancellations] = useState<ClassCancellationRecord[]>(() =>
    getClassCancellations().filter((c) => c.status === "active"),
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

    window.addEventListener("cui:campus-notice-update", handleNoticeUpdate);
    window.addEventListener("cui:class-cancellations-updated", handleCancellationsUpdate);
    window.addEventListener("storage", handleNoticeUpdate);

    return () => {
      window.removeEventListener("cui:campus-notice-update", handleNoticeUpdate);
      window.removeEventListener("cui:class-cancellations-updated", handleCancellationsUpdate);
      window.removeEventListener("storage", handleNoticeUpdate);
    };
  }, []);

  // Filter cancellations relevant to current student or currently viewed batch
  const relevantCancellations = useMemo(() => {
    const studentSession = getActiveStudentSession();
    const studentBatchName = (
      studentSession?.profile?.defaultBatch ||
      studentSession?.profile?.regNo ||
      ""
    )
      .toLowerCase()
      .trim();
    const activeBatchName = batches[batchId]?.toLowerCase().trim();
    const pinnedBatchName = pinnedBatch !== null ? batches[pinnedBatch]?.toLowerCase().trim() : "";

    return cancellations.filter((c) => {
      if (dismissedCancellationIds.has(c.id)) return false;

      // If logged in as student, match student's enrolled batch
      if (studentBatchName) {
        const cBatch = c.batchName.toLowerCase().trim();
        if (cBatch.includes(studentBatchName) || studentBatchName.includes(cBatch)) {
          return true;
        }
      }

      // If viewing or pinned to this batch
      if (activeBatchName && c.batchName.toLowerCase().trim() === activeBatchName) {
        return true;
      }
      if (pinnedBatchName && c.batchName.toLowerCase().trim() === pinnedBatchName) {
        return true;
      }

      // If student is not enrolled or batch not selected, show all active cancellations
      return !studentBatchName;
    });
  }, [cancellations, batchId, pinnedBatch, dismissedCancellationIds]);

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
