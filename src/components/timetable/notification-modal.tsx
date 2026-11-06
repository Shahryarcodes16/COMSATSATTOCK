import { useEffect, useState, useCallback } from "react";
import {
  Bell,
  BellRing,
  BellOff,
  Check,
  Clock,
  Sparkles,
  Volume2,
  VolumeX,
  X,
  Smartphone,
  AlertTriangle,
} from "lucide-react";
import {
  getNotificationPermission,
  getStoredNotificationSettings,
  isNotificationSupported,
  playNotificationChime,
  requestNotificationPermission,
  saveNotificationSettings,
  sendSystemNotification,
  type NotificationSettings,
  hasNotifiedToday,
  markNotifiedToday,
} from "@/lib/notifications";
import { useDesk } from "@/components/timetable/context";
import { SLOTS, batches, forBatch, rooms, subjects, teachers, getCampusMinutes, entries } from "@/lib/schedule";
import { loadCustomSchedule } from "@/lib/my-schedule";
import { getActiveFacultySession } from "@/lib/faculty-auth";

/**
 * Background hook that checks the schedule every 30s and triggers class alerts
 */
export function useClassNotificationScheduler() {
  const { clock, now, pinnedBatch } = useDesk();

  useEffect(() => {
    if (!isNotificationSupported()) return;

    const checkAlarms = () => {
      const { dayIndex, minutes: currentCampusMinutes } = getCampusMinutes(now);
      if (dayIndex === null || dayIndex < 0 || dayIndex > 4) return; // Weekend or off-campus

      // 1. Check Faculty Notifications if logged in as a faculty member
      const faculty = getActiveFacultySession();
      if (faculty?.profile?.teacherId !== null && faculty?.profile?.teacherId !== undefined) {
        const leadMins = faculty.profile.notificationLeadMins || 10;
        const facultyClasses = entries.filter(
          (e) => e.teacher === faculty.profile.teacherId && e.day === dayIndex,
        );

        for (const cls of facultyClasses) {
          const slotDef = SLOTS[cls.slot];
          if (!slotDef) continue;

          const alertMinutes = slotDef.from - leadMins;
          const key = `faculty_${faculty.profile.teacherId}_${cls.batch}_${cls.slot}_${cls.subject}`;

          if (
            currentCampusMinutes >= alertMinutes &&
            currentCampusMinutes < alertMinutes + 3 &&
            !hasNotifiedToday(key)
          ) {
            const subName = subjects[cls.subject] || "Lecture";
            const roomName = cls.room >= 0 ? rooms[cls.room] : "Campus";
            const batchName = cls.batch >= 0 ? batches[cls.batch] : "Class";

            markNotifiedToday(key);

            sendSystemNotification(`🔔 Next Class in ${leadMins} mins: ${subName}`, {
              body: `📍 ${roomName} with ${batchName} (${slotDef.start} – ${slotDef.end})`,
              playChime: true,
              tag: key,
            });
          }
        }
      }

      // 2. Student & Custom Schedule Notifications
      const settings = getStoredNotificationSettings();
      if (!settings.enabled || Notification.permission !== "granted") return;

      // Determine today's classes
      let todayClasses: {
        slot: number;
        subject: number;
        room: number;
        teacher: number;
        batch: number;
      }[] = [];

      if (settings.source === "custom") {
        const customItems = loadCustomSchedule();
        todayClasses = customItems.filter((item) => item.day === dayIndex);
      } else if (pinnedBatch !== null) {
        todayClasses = forBatch(pinnedBatch).filter((e) => e.day === dayIndex);
      }

      for (const cls of todayClasses) {
        const slotDef = SLOTS[cls.slot];
        if (!slotDef) continue;

        const alertMinutes = slotDef.from - settings.leadMinutes;
        const key = `${settings.source}_${cls.batch}_${cls.slot}_${cls.subject}`;

        // Trigger if we are in the alert window: [alertMinutes, alertMinutes + 3]
        if (
          currentCampusMinutes >= alertMinutes &&
          currentCampusMinutes < alertMinutes + 3 &&
          !hasNotifiedToday(key)
        ) {
          const subName = subjects[cls.subject] || "Lecture";
          const roomName = cls.room >= 0 ? rooms[cls.room] : "Campus";
          const teacherName = cls.teacher >= 0 ? teachers[cls.teacher] : "";

          markNotifiedToday(key);

          sendSystemNotification(`🔔 Class in ${settings.leadMinutes} mins: ${subName}`, {
            body: `📍 ${roomName}${teacherName ? ` · 👤 ${teacherName}` : ""} (${slotDef.start} – ${slotDef.end})`,
            playChime: settings.sound,
            tag: key,
          });
        }
      }
    };

    // Run immediately and every 30 seconds
    checkAlarms();
    const interval = setInterval(checkAlarms, 30_000);
    return () => clearInterval(interval);
  }, [clock, now, pinnedBatch]);
}

/**
 * Topbar or Page Bell Button to trigger the Notification settings modal
 */
export function NotificationBellButton({
  className = "",
  showLabel = false,
}: {
  className?: string;
  showLabel?: boolean;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const s = getStoredNotificationSettings();
    setEnabled(s.enabled && getNotificationPermission() === "granted");
  }, [modalOpen]);

  return (
    <>
      <button
        type="button"
        className={
          showLabel
            ? `notif-bell-pill btn tap ${enabled ? "notif-active-bell" : ""} ${className}`
            : `icon-btn tap ${enabled ? "notif-active-bell" : ""} ${className}`
        }
        aria-label="Class Reminder Notifications"
        title={enabled ? "Class reminders are active" : "Enable class reminders"}
        onClick={() => setModalOpen(true)}
      >
        {enabled ? (
          <BellRing size={16} strokeWidth={2} aria-hidden />
        ) : (
          <Bell size={16} strokeWidth={1.8} aria-hidden />
        )}
        {showLabel ? <span className="notif-bell-label">Reminders</span> : null}
        {enabled ? <span className="notif-badge-dot" aria-hidden /> : null}
      </button>

      {modalOpen ? <NotificationSettingsModal onClose={() => setModalOpen(false)} /> : null}
    </>
  );
}

/**
 * Modern modal dialog for configuring notification settings
 */
export function NotificationSettingsModal({ onClose }: { onClose: () => void }) {
  const [settings, setSettings] = useState<NotificationSettings>(() =>
    getStoredNotificationSettings(),
  );
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(
    getNotificationPermission(),
  );
  const [testSent, setTestSent] = useState(false);
  const { pinnedBatch } = useDesk();

  const handleToggleEnable = async () => {
    if (!settings.enabled) {
      // User wants to enable
      let perm = permission;
      if (perm !== "granted") {
        perm = await requestNotificationPermission();
        setPermission(perm);
      }
      if (perm === "granted") {
        const next = { ...settings, enabled: true };
        setSettings(next);
        saveNotificationSettings(next);
      }
    } else {
      const next = { ...settings, enabled: false };
      setSettings(next);
      saveNotificationSettings(next);
    }
  };

  const handleLeadChange = (mins: 5 | 10 | 15) => {
    const next = { ...settings, leadMinutes: mins };
    setSettings(next);
    saveNotificationSettings(next);
  };

  const handleSoundToggle = () => {
    const next = { ...settings, sound: !settings.sound };
    setSettings(next);
    saveNotificationSettings(next);
  };

  const handleSourceChange = (src: "pinned" | "custom") => {
    const next = { ...settings, source: src };
    setSettings(next);
    saveNotificationSettings(next);
  };

  const handleSendTest = async () => {
    let perm = permission;
    if (perm !== "granted") {
      perm = await requestNotificationPermission();
      setPermission(perm);
    }
    if (perm === "granted") {
      playNotificationChime();
      await sendSystemNotification("🔔 CUI Attock Timetable: Alert Active!", {
        body: `Testing ${settings.leadMinutes}m class reminder. Next lecture in Lab-03 with Dr. Muazzam Maqsood.`,
        playChime: settings.sound,
      });
      setTestSent(true);
      setTimeout(() => setTestSent(false), 3000);
    }
  };

  return (
    <div className="notif-modal-backdrop" onClick={onClose}>
      <div
        className="notif-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="notif-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="notif-modal-head">
          <div className="notif-modal-title-group">
            <span className="notif-modal-icon">
              <BellRing size={22} aria-hidden />
            </span>
            <div>
              <h2 id="notif-modal-title" className="section-title">
                Class Reminders
              </h2>
              <p className="quiet fine">Never miss a lecture or sprint across campus</p>
            </div>
          </div>
          <button
            type="button"
            className="icon-btn tap"
            onClick={onClose}
            aria-label="Close reminder settings"
          >
            <X size={18} aria-hidden />
          </button>
        </div>

        <div className="notif-modal-body stack">
          {/* Main Enable Card */}
          <div className={`notif-card-main ${settings.enabled && permission === "granted" ? "active" : ""}`}>
            <div className="notif-card-info">
              <div className="notif-card-title-row">
                <b>Smart Notifications</b>
                {settings.enabled && permission === "granted" ? (
                  <span className="notif-status-badge active">Active</span>
                ) : (
                  <span className="notif-status-badge inactive">Disabled</span>
                )}
              </div>
              <p className="quiet fine">
                Get a clean phone notification {settings.leadMinutes} minutes before your lecture starts.
              </p>
            </div>
            <button
              type="button"
              className={`notif-toggle-btn ${settings.enabled && permission === "granted" ? "on" : "off"}`}
              onClick={handleToggleEnable}
              aria-label={settings.enabled ? "Disable reminders" : "Enable reminders"}
            >
              <span className="notif-toggle-knob" />
            </button>
          </div>

          {permission === "denied" && (
            <div className="notif-warning-banner">
              <AlertTriangle size={16} aria-hidden />
              <span>
                Notifications are blocked in your browser settings. Please allow notifications for this site to receive reminders.
              </span>
            </div>
          )}

          {/* Lead time setting */}
          <div className="notif-setting-section">
            <span className="field-label">
              <Clock size={15} aria-hidden />
              When should we remind you?
            </span>
            <div className="notif-lead-grid">
              {([5, 10, 15] as const).map((mins) => (
                <button
                  key={mins}
                  type="button"
                  className={`notif-lead-pill ${settings.leadMinutes === mins ? "active" : ""}`}
                  onClick={() => handleLeadChange(mins)}
                >
                  <span className="notif-lead-num">{mins}</span>
                  <span className="notif-lead-label">minutes before</span>
                </button>
              ))}
            </div>
          </div>

          {/* Sound toggle & Target schedule */}
          <div className="notif-setting-row">
            <div className="notif-row-label">
              <span className="field-label">
                {settings.sound ? <Volume2 size={15} aria-hidden /> : <VolumeX size={15} aria-hidden />}
                Sound Chime
              </span>
              <p className="quiet fine">Play a pleasant 2-tone chime with alert</p>
            </div>
            <button
              type="button"
              className={`btn tap ${settings.sound ? "solid" : ""}`}
              onClick={handleSoundToggle}
            >
              {settings.sound ? "Sound On" : "Muted"}
            </button>
          </div>

          {/* Schedule Source Selection */}
          <div className="notif-setting-section">
            <span className="field-label">Which schedule to track?</span>
            <div className="notif-source-grid">
              <button
                type="button"
                className={`notif-source-card ${settings.source === "pinned" ? "active" : ""}`}
                onClick={() => handleSourceChange("pinned")}
              >
                <b>My Saved Batch</b>
                <span className="quiet fine">
                  {pinnedBatch !== null ? batches[pinnedBatch] : "Select your batch in Today tab"}
                </span>
              </button>
              <button
                type="button"
                className={`notif-source-card ${settings.source === "custom" ? "active" : ""}`}
                onClick={() => handleSourceChange("custom")}
              >
                <b>My Schedule (Custom)</b>
                <span className="quiet fine">Custom chosen courses & repeaters</span>
              </button>
            </div>
          </div>

          {/* Mobile tip */}
          <div className="notif-mobile-tip">
            <Smartphone size={16} aria-hidden />
            <div>
              <b>Works on Android & iOS Lock Screens</b>
              <p className="fine quiet">
                On iPhone, tap <b>Share ⎋ → Add to Home Screen</b> to receive lock-screen class alerts.
              </p>
            </div>
          </div>

          {/* Test Alert Button */}
          <div className="notif-modal-actions">
            <button
              type="button"
              className={`btn solid tap notif-test-btn ${testSent ? "copied" : ""}`}
              onClick={handleSendTest}
            >
              {testSent ? <Check size={16} aria-hidden /> : <Sparkles size={16} aria-hidden />}
              <span>{testSent ? "Test Alert Sent!" : "Send Test Notification"}</span>
            </button>
            <button type="button" className="btn tap" onClick={onClose}>
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
