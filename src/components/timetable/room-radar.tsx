import { useState, useEffect, useMemo } from "react";
import {
  Clock,
  Compass,
  DoorOpen,
  Filter,
  Flame,
  GraduationCap,
  Sparkles,
  Zap,
} from "lucide-react";
import { useDesk } from "@/components/timetable/context";
import {
  DAYS,
  SLOTS,
  ROOM_GROUPS,
  type RoomGroup,
} from "@/lib/schedule";
import { getFreeRoomsForSlot, type FreeRoomDetail } from "@/lib/room-radar";

export function FreeRoomsRadar({
  onSelectSlot,
}: {
  onSelectSlot?: (day: number, slot: number) => void;
}) {
  const { clock, day: deskDay, slot: deskSlot, setDay, setSlot, open } = useDesk();
  const [selectedGroup, setSelectedGroup] = useState<"All" | RoomGroup>("All");
  const [cancelRevision, setCancelRevision] = useState(0);

  useEffect(() => {
    const handleUpdate = () => setCancelRevision((r) => r + 1);
    window.addEventListener("cui:class-cancellations-updated", handleUpdate);
    window.addEventListener("storage", handleUpdate);
    return () => {
      window.removeEventListener("cui:class-cancellations-updated", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, []);

  // Determine current active day & slot for radar:
  // If clock is live (weekdays 8:30am - 4:30pm), use live slot.
  // Otherwise use current selected desk day/slot.
  const isLiveSession = clock.dayIndex !== null && clock.liveSlot !== null;
  const radarDay = isLiveSession ? clock.dayIndex! : deskDay;
  const radarSlot = isLiveSession ? clock.liveSlot! : deskSlot;

  const currentSlotLabel = SLOTS[radarSlot]?.label ?? "L1";
  const currentSlotTime = `${SLOTS[radarSlot]?.start} – ${SLOTS[radarSlot]?.end}`;

  const freeRooms = useMemo(
    () => getFreeRoomsForSlot(radarDay, radarSlot),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [radarDay, radarSlot, cancelRevision],
  );

  const filteredRooms = useMemo(() => {
    if (selectedGroup === "All") return freeRooms;
    return freeRooms.filter((r) => r.group === selectedGroup);
  }, [freeRooms, selectedGroup]);

  // Group counts
  const counts = useMemo(() => {
    const map = {
      All: freeRooms.length,
      Classrooms: 0,
      Labs: 0,
      "Lecture halls": 0,
      "Lecture theatres": 0,
    };
    for (const r of freeRooms) {
      if (r.group in map) {
        map[r.group]++;
      }
    }
    return map;
  }, [freeRooms]);

  return (
    <section className="free-rooms-radar stack" aria-label="Live free rooms radar">
      <div className="radar-banner">
        <div className="radar-header">
          <div className="radar-title-wrap">
            <span className="radar-live-badge">
              <span className={`radar-dot ${isLiveSession ? "radar-dot-pulse" : ""}`} aria-hidden />
              {isLiveSession ? "Live Campus Radar" : "Study Spot Finder"}
            </span>
            <h2 className="radar-headline">
              <Zap size={20} className="radar-bolt" aria-hidden />
              <span>{freeRooms.length} Free Rooms Right Now</span>
            </h2>
            <p className="radar-subtext">
              {isLiveSession ? (
                <>
                  Showing unoccupied rooms for <b>{DAYS[radarDay]} · {currentSlotLabel}</b> ({currentSlotTime})
                </>
              ) : (
                <>
                  Campus closed now · Showing free rooms for <b>{DAYS[radarDay]} · {currentSlotLabel}</b> ({currentSlotTime})
                </>
              )}
            </p>
          </div>

          {!isLiveSession && (
            <div className="radar-slot-quick-pick">
              <span className="fine quiet">Check another slot:</span>
              <div className="radar-slot-btns">
                {SLOTS.map((s, idx) => (
                  <button
                    key={s.label}
                    type="button"
                    className={`btn tap ${deskSlot === idx ? "solid" : ""}`}
                    onClick={() => {
                      setSlot(idx);
                      onSelectSlot?.(deskDay, idx);
                    }}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Room type filter chips */}
        <div className="chips radar-filters" role="group" aria-label="Filter free rooms by type">
          {(["All", "Classrooms", "Labs", "Lecture halls", "Lecture theatres"] as const).map(
            (groupName) => (
              <button
                key={groupName}
                type="button"
                className={`chip ${selectedGroup === groupName ? "on" : ""}`}
                aria-pressed={selectedGroup === groupName}
                onClick={() => setSelectedGroup(groupName)}
              >
                {groupName === "Lecture halls"
                  ? "Halls"
                  : groupName === "Lecture theatres"
                    ? "Theatres"
                    : groupName}{" "}
                <span className="radar-chip-count">({counts[groupName] || 0})</span>
              </button>
            ),
          )}
        </div>
      </div>

      {/* Free room cards grid */}
      {filteredRooms.length === 0 ? (
        <div className="radar-empty">
          <DoorOpen size={36} className="quiet" aria-hidden />
          <p className="bold">No free {selectedGroup.toLowerCase()} for this slot.</p>
          <p className="fine quiet">Try selecting another room type or checking the next lecture slot.</p>
        </div>
      ) : (
        <div className="radar-rooms-grid">
          {filteredRooms.map((room) => {
            const isFreeAllDay = room.freeSlotsCount >= SLOTS.length - radarSlot;

            return (
              <button
                key={room.id}
                type="button"
                className={`radar-room-card tap ${isFreeAllDay ? "radar-card-gold" : ""}`}
                onClick={() => open({ type: "room", id: room.id })}
                title={`View ${room.name} full schedule`}
              >
                <div className="radar-card-top">
                  <div className="radar-room-name-wrap">
                    <DoorOpen size={17} className="room-icon" aria-hidden />
                    <span className="radar-room-name">{room.name}</span>
                  </div>
                  <span className={`radar-duration-tag ${isFreeAllDay ? "duration-allday" : ""}`}>
                    {isFreeAllDay ? "✨ Free Rest of Day" : `Free: ${room.freeSlotsCount} slot${room.freeSlotsCount > 1 ? "s" : ""}`}
                  </span>
                </div>

                <div className="radar-card-details">
                  <span className="radar-group-label">{room.group}</span>
                  <span className="radar-until-text">
                    Available until <b>{room.freeUntilTime}</b>
                  </span>
                </div>

                {room.nextClass ? (
                  <div className="radar-next-alert">
                    <span className="fine quiet">
                      Next: <b>{room.nextClass.subject}</b> at {room.nextClass.startTime} ({room.nextClass.batch})
                    </span>
                  </div>
                ) : (
                  <div className="radar-free-badge">
                    <Sparkles size={12} aria-hidden />
                    <span className="fine">Completely free for today</span>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
