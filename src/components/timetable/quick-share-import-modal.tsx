/**
 * FORTIS QuickShare Import Modal
 * Displays an incoming shared schedule preview and allows 1-click cloning into the student's personal timetable.
 */
import React, { useState, useMemo } from "react";
import {
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  X,
  Calendar,
  Layers,
  GraduationCap,
  DoorOpen,
  Users,
} from "lucide-react";
import {
  subjects,
  rooms,
  teachers,
  batches,
  DAYS,
  SLOTS,
  type ClassEntry,
} from "@/lib/schedule";
import { saveCustomSchedule, loadCustomSchedule } from "@/lib/my-schedule";

interface QuickShareImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  sharedEntries: ClassEntry[];
  senderName?: string;
  batchName?: string;
  onImportComplete?: () => void;
}

export function QuickShareImportModal({
  isOpen,
  onClose,
  sharedEntries,
  senderName,
  batchName,
  onImportComplete,
}: QuickShareImportModalProps) {
  const [imported, setImported] = useState(false);

  const existingSchedule = useMemo(() => {
    return loadCustomSchedule();
  }, []);

  const courseList = useMemo(() => {
    const map = new Map<number, ClassEntry[]>();
    for (const e of sharedEntries) {
      const arr = map.get(e.subject) || [];
      arr.push(e);
      map.set(e.subject, arr);
    }
    return Array.from(map.entries());
  }, [sharedEntries]);

  const activeDays = useMemo(() => {
    const d = new Set(sharedEntries.map((e) => e.day));
    return d.size;
  }, [sharedEntries]);

  const hasFriday = useMemo(() => {
    return sharedEntries.some((e) => e.day === 4);
  }, [sharedEntries]);

  const handleClone = () => {
    saveCustomSchedule(sharedEntries);
    setImported(true);

    // Clean ?share= query param from URL without refreshing the page
    if (typeof window !== "undefined" && window.history) {
      const cleanUrl = window.location.pathname + window.location.hash;
      window.history.replaceState({}, document.title, cleanUrl);
    }

    if (onImportComplete) {
      onImportComplete();
    }

    setTimeout(() => {
      onClose();
    }, 1200);
  };

  if (!isOpen || sharedEntries.length === 0) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="quickshare-import-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-xl max-h-[90vh] bg-card border border-border rounded-2xl shadow-2xl flex flex-col text-card-foreground overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-border bg-card/95 backdrop-blur-md flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20 shadow-sm">
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="quickshare-import-modal-title" className="text-lg sm:text-xl font-bold tracking-tight">
                  {senderName ? `${senderName}'s Shared Schedule` : "Incoming Shared Schedule"}
                </h2>
              </div>
              <p className="text-xs text-muted-foreground">
                {batchName ? `Batch: ${batchName} · ` : ""}
                Ready to clone into your personal FORTIS timetable
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
            title="Cancel"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 space-y-5 overflow-y-auto max-h-[calc(90vh-140px)]">
          {/* Metrics Pill Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
            <div className="p-2.5 rounded-xl bg-muted/40 border border-border/80">
              <div className="text-base sm:text-lg font-bold text-foreground">{courseList.length}</div>
              <div className="text-[11px] text-muted-foreground">Subjects</div>
            </div>
            <div className="p-2.5 rounded-xl bg-muted/40 border border-border/80">
              <div className="text-base sm:text-lg font-bold text-foreground">{sharedEntries.length}</div>
              <div className="text-[11px] text-muted-foreground">Weekly Slots</div>
            </div>
            <div className="p-2.5 rounded-xl bg-muted/40 border border-border/80">
              <div className="text-base sm:text-lg font-bold text-foreground">{activeDays} Days</div>
              <div className="text-[11px] text-muted-foreground">Campus Days</div>
            </div>
            <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25">
              <div className="text-base sm:text-lg font-bold text-emerald-600 dark:text-emerald-400">
                {!hasFriday ? "🎉 Free Friday" : "Full Week"}
              </div>
              <div className="text-[11px] text-emerald-600/80 dark:text-emerald-400/80">0 Clashes</div>
            </div>
          </div>

          {/* Overwrite notice if existing schedule has courses */}
          {existingSchedule.length > 0 && !imported && (
            <div className="p-3 rounded-xl border border-amber-500/30 bg-amber-500/10 text-xs text-amber-700 dark:text-amber-300 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <strong>Notice:</strong> You currently have {existingSchedule.length} classes in your timetable. Cloning this shared schedule will replace your current timetable with these {sharedEntries.length} classes.
              </div>
            </div>
          )}

          {/* Course Breakdown */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
              Enrolled Courses & Assigned Sections ({courseList.length})
            </label>
            <div className="space-y-2">
              {courseList.map(([subId, slots]) => {
                const subName = subjects[subId] || `Subject #${subId}`;
                const firstSlot = slots[0];
                const batch = firstSlot && firstSlot.batch >= 0 ? batches[firstSlot.batch] : "Custom";
                const teacher = firstSlot && firstSlot.teacher >= 0 ? teachers[firstSlot.teacher] : "Faculty";
                const room = firstSlot && firstSlot.room >= 0 ? rooms[firstSlot.room] : "TBA";

                return (
                  <div
                    key={subId}
                    className="p-3 rounded-xl border border-border bg-card/60 flex items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <div className="font-bold text-foreground text-sm">{subName}</div>
                      <div className="text-muted-foreground flex items-center gap-2 mt-0.5">
                        <span className="font-semibold text-primary">{batch}</span>
                        <span>·</span>
                        <span className="flex items-center gap-1">
                          <GraduationCap className="w-3 h-3" />
                          {teacher}
                        </span>
                        <span>·</span>
                        <span className="flex items-center gap-1">
                          <DoorOpen className="w-3 h-3" />
                          {room}
                        </span>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 font-mono text-[11px] font-bold rounded-md bg-muted text-foreground shrink-0">
                      {slots.length} {slots.length === 1 ? "lecture" : "lectures"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-border bg-card/95 backdrop-blur-md flex items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2.5 text-xs font-semibold text-muted-foreground hover:text-foreground bg-muted hover:bg-muted/80 rounded-xl transition-colors"
          >
            Cancel / Ignore
          </button>

          <button
            onClick={handleClone}
            disabled={imported}
            className="px-5 py-2.5 text-xs sm:text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl transition-all shadow-md shadow-emerald-600/20 flex items-center gap-2 active:scale-[0.98] disabled:opacity-80"
          >
            {imported ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-white" />
                <span>Schedule Cloned!</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Clone to My Schedule</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
