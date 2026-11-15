/**
 * FORTIS DayRadar Component
 * Live animated progress bar and swipeable horizontal daily class stream.
 * Automatically tracks live lecture progress %, free gap windows, cancellations, and makeups.
 */
import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Clock,
  Sparkles,
  Coffee,
  CheckCircle2,
  AlertCircle,
  DoorOpen,
  GraduationCap,
  ChevronRight,
  ChevronLeft,
  Calendar,
  Zap,
} from "lucide-react";
import {
  DAYS,
  DAY_SHORT,
  SLOTS,
  subjects,
  rooms,
  teachers,
  batches,
  getCampusMinutes,
  type ClassEntry,
} from "@/lib/schedule";
import { isClassCancelled } from "@/lib/campus-pulse";

interface DayRadarProps {
  schedule: ClassEntry[];
  initialDay?: number;
  onOpenClass?: (entry: ClassEntry) => void;
}

export function DayRadar({ schedule, initialDay, onOpenClass }: DayRadarProps) {
  const [now, setNow] = useState<Date>(() => new Date());
  const [selectedDay, setSelectedDay] = useState<number>(() => {
    if (initialDay !== undefined && initialDay >= 0 && initialDay <= 4) return initialDay;
    const { dayIndex } = getCampusMinutes(new Date());
    return dayIndex !== null ? dayIndex : 0;
  });

  const scrollRef = useRef<HTMLDivElement>(null);

  // Update clock every 10 seconds for real-time progress bar accuracy
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  const campusTime = useMemo(() => {
    return getCampusMinutes(now);
  }, [now]);

  const isToday = campusTime.dayIndex === selectedDay;

  // Filter schedule for selected day, sorted by slot
  const dayClasses = useMemo(() => {
    return schedule
      .filter((e) => e.day === selectedDay)
      .sort((a, b) => a.slot - b.slot);
  }, [schedule, selectedDay]);

  // Build stream timeline items including class cards AND breaks/gaps between classes
  const timelineItems = useMemo(() => {
    if (dayClasses.length === 0) return [];

    type TimelineItem =
      | { type: "class"; entry: ClassEntry; slot: number }
      | { type: "gap"; startSlot: number; endSlot: number; durationMinutes: number; fromLabel: string; toLabel: string };

    const items: TimelineItem[] = [];

    for (let i = 0; i < dayClasses.length; i++) {
      const current = dayClasses[i];

      // Check if there is a gap between the previous class and this class
      if (i > 0) {
        const prev = dayClasses[i - 1];
        if (current.slot > prev.slot + 1) {
          // There are empty slot(s) between them
          const prevSlotEnd = SLOTS[prev.slot].to;
          const curSlotStart = SLOTS[current.slot].from;
          const diffMinutes = curSlotStart - prevSlotEnd;

          items.push({
            type: "gap",
            startSlot: prev.slot + 1,
            endSlot: current.slot - 1,
            durationMinutes: diffMinutes,
            fromLabel: SLOTS[prev.slot].end,
            toLabel: SLOTS[current.slot].start,
          });
        }
      }

      items.push({
        type: "class",
        entry: current,
        slot: current.slot,
      });
    }

    return items;
  }, [dayClasses]);

  // Calculate live slot & progress for the currently active lecture
  const currentSlotStatus = useMemo(() => {
    if (!isToday) return { isLive: false, slotIndex: -1, progressPercent: 0, minutesRemaining: 0 };

    const curMin = campusTime.minutes;
    for (let s = 0; s < SLOTS.length; s++) {
      const slot = SLOTS[s];
      if (curMin >= slot.from && curMin < slot.to) {
        const elapsed = curMin - slot.from;
        const total = slot.to - slot.from;
        const progress = Math.min(100, Math.max(0, Math.round((elapsed / total) * 100)));
        const rem = slot.to - curMin;
        return {
          isLive: true,
          slotIndex: s,
          progressPercent: progress,
          minutesRemaining: rem,
        };
      }
    }

    return { isLive: false, slotIndex: -1, progressPercent: 0, minutesRemaining: 0 };
  }, [isToday, campusTime]);

  const scrollLeft = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: -260, behavior: "smooth" });
    }
  };

  const scrollRight = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: 260, behavior: "smooth" });
    }
  };

  return (
    <div className="w-full bg-card border border-border rounded-2xl p-4 sm:p-5 shadow-sm space-y-4 text-card-foreground">
      {/* Day Selector Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold">
            <Zap className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-bold tracking-tight">FORTIS DayRadar</h3>
              {isToday && (
                <span className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                  LIVE
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {DAYS[selectedDay]} · {dayClasses.length} {dayClasses.length === 1 ? "lecture" : "lectures"} scheduled
            </p>
          </div>
        </div>

        {/* Day Pills */}
        <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-xl shrink-0 self-start sm:self-auto overflow-x-auto max-w-full">
          {DAYS.map((name, idx) => {
            const count = schedule.filter((e) => e.day === idx).length;
            const active = selectedDay === idx;
            const isTodayDay = campusTime.dayIndex === idx;

            return (
              <button
                key={name}
                type="button"
                onClick={() => setSelectedDay(idx)}
                className={`py-1.5 px-2.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 shrink-0 ${
                  active
                    ? "bg-card text-foreground shadow-sm border border-border/80 font-bold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <span>{DAY_SHORT[idx]}</span>
                {count > 0 && (
                  <span
                    className={`px-1 py-0.2 text-[10px] rounded-full font-bold ${
                      active ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {count}
                  </span>
                )}
                {isTodayDay && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" title="Today" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Stream Rail Controls & Header info */}
      <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
        <span>Timeline Stream</span>
        <div className="flex items-center gap-1">
          <button
            onClick={scrollLeft}
            className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title="Scroll Left"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={scrollRight}
            className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title="Scroll Right"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Horizontal Scrollable Rail */}
      {timelineItems.length === 0 ? (
        <div className="p-8 text-center border border-dashed border-border rounded-xl bg-muted/10 space-y-2">
          <div className="w-10 h-10 mx-auto rounded-full bg-primary/10 text-primary flex items-center justify-center">
            <Coffee className="w-5 h-5" />
          </div>
          <h4 className="text-sm font-bold text-foreground">Free Day on {DAYS[selectedDay]}</h4>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            You have zero lectures scheduled on this day. Enjoy your free time or explore other batches!
          </p>
        </div>
      ) : (
        <div
          ref={scrollRef}
          className="flex items-stretch gap-3 overflow-x-auto pb-2 pt-1 snap-x scrollbar-thin scrollbar-thumb-border"
          style={{ scrollbarWidth: "thin" }}
        >
          {timelineItems.map((item, index) => {
            if (item.type === "gap") {
              const hours = Math.floor(item.durationMinutes / 60);
              const mins = item.durationMinutes % 60;
              const durationStr = hours > 0 ? `${hours}h ${mins > 0 ? `${mins}m` : ""}` : `${mins}m`;

              return (
                <div
                  key={`gap-${index}`}
                  className="snap-start shrink-0 w-44 sm:w-48 p-3 rounded-xl border border-dashed border-border/80 bg-muted/20 flex flex-col justify-between"
                >
                  <div className="flex items-center gap-2 text-muted-foreground mb-2">
                    <Coffee className="w-4 h-4 text-amber-500" />
                    <span className="text-xs font-bold text-foreground">Free Break</span>
                  </div>
                  <div className="text-base font-extrabold text-foreground">{durationStr}</div>
                  <div className="text-[11px] text-muted-foreground mt-1">
                    {item.fromLabel} – {item.toLabel}
                  </div>
                  <div className="text-[10px] text-muted-foreground/80 mt-2 bg-muted/40 p-1.5 rounded-lg">
                    💡 Perfect window for library or cafeteria
                  </div>
                </div>
              );
            }

            // Class Card
            const { entry, slot } = item;
            const slotInfo = SLOTS[slot];
            const isLive = isToday && currentSlotStatus.isLive && currentSlotStatus.slotIndex === slot;
            const isPast =
              isToday &&
              campusTime.minutes >= slotInfo.to;
            const isUpcoming =
              isToday &&
              campusTime.minutes < slotInfo.from;

            const isCancelled = isClassCancelled(entry.day, entry.slot, entry.teacher, entry.batch, entry.room);
            const subName = subjects[entry.subject] || "Course";
            const roomName = entry.room >= 0 ? rooms[entry.room] : "Room TBA";
            const teacherName = entry.teacher >= 0 ? teachers[entry.teacher] : "Faculty TBA";
            const batchName = entry.batch >= 0 ? batches[entry.batch] : "";

            return (
              <div
                key={`class-${index}`}
                onClick={() => onOpenClass?.(entry)}
                className={`snap-start shrink-0 w-64 sm:w-72 p-4 rounded-xl border transition-all flex flex-col justify-between relative cursor-pointer ${
                  isLive && !isCancelled
                    ? "border-emerald-500 bg-emerald-500/5 shadow-md shadow-emerald-500/10 ring-1 ring-emerald-500/30"
                    : isCancelled
                      ? "border-rose-500/40 bg-rose-500/5 opacity-80"
                      : isPast
                        ? "border-border/60 bg-muted/20 opacity-70"
                        : "border-border bg-card hover:border-primary/50 hover:bg-muted/30"
                }`}
              >
                {/* Header: Slot Badge & Status */}
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-md bg-muted text-muted-foreground">
                      Slot {slot + 1} · {slotInfo.start} – {slotInfo.end}
                    </span>

                    {isCancelled ? (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-rose-500/20 text-rose-600 dark:text-rose-400">
                        CANCELLED
                      </span>
                    ) : isLive ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-500 text-white flex items-center gap-1 shadow-sm">
                        <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                        LIVE NOW
                      </span>
                    ) : isPast ? (
                      <span className="text-[10px] font-semibold text-muted-foreground flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-500" /> Done
                      </span>
                    ) : entry.isMakeup ? (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-amber-500/20 text-amber-600">
                        ⚡ MAKEUP
                      </span>
                    ) : (
                      <span className="text-[10px] font-semibold text-muted-foreground">
                        Upcoming
                      </span>
                    )}
                  </div>

                  {/* Course Title */}
                  <h4
                    className={`font-bold text-sm leading-snug line-clamp-2 ${
                      isCancelled ? "line-through text-muted-foreground" : "text-foreground"
                    }`}
                  >
                    {subName}
                  </h4>

                  {/* Batch & Instructor info */}
                  <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1.5 font-semibold text-primary">
                      <span>{batchName}</span>
                      {entry.repeater && (
                        <span className="px-1.5 py-0.2 text-[9px] rounded-sm bg-primary/20 text-primary">
                          Repeater
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 truncate">
                      <GraduationCap className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{teacherName}</span>
                    </div>
                    <div className="flex items-center gap-1.5 font-medium text-foreground">
                      <DoorOpen className="w-3.5 h-3.5 text-primary shrink-0" />
                      <span>{roomName}</span>
                      {isCancelled && <span className="text-rose-500 text-[10px]">(Freed)</span>}
                    </div>
                  </div>
                </div>

                {/* Live Progress Bar for Currently Active Class */}
                {isLive && !isCancelled && (
                  <div className="mt-3 pt-2.5 border-t border-emerald-500/20 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] font-semibold">
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                        {currentSlotStatus.minutesRemaining} mins left
                      </span>
                      <span className="font-mono text-muted-foreground">
                        {currentSlotStatus.progressPercent}%
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-emerald-500/20 overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 transition-all duration-500 rounded-full shadow-sm"
                        style={{ width: `${currentSlotStatus.progressPercent}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
