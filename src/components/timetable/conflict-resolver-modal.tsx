import { useState, useMemo } from "react";
import {
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Clock,
  DoorOpen,
  ArrowRight,
  Zap,
  RefreshCw,
  X,
} from "lucide-react";
import {
  findConflictAlternatives,
  applyConflictResolution,
  autoResolveAllConflicts,
} from "@/lib/timetable-resolver";
import type {
  ClashDetail,
  ConflictAlternative,
  TimetableRaw,
} from "@/lib/timetable-types";

interface ConflictResolverModalProps {
  clashes: ClashDetail[];
  rawTimetable: TimetableRaw;
  onResolved: (resolvedRaw: TimetableRaw) => void;
  onClose?: () => void;
}

export function ConflictResolverModal({
  clashes,
  rawTimetable,
  onResolved,
  onClose,
}: ConflictResolverModalProps) {
  const [currentRaw, setCurrentRaw] = useState<TimetableRaw>(rawTimetable);
  const [currentClashes, setCurrentClashes] = useState<ClashDetail[]>(clashes);
  const [autoResolving, setAutoResolving] = useState(false);
  const [resolutionNotice, setResolutionNotice] = useState<string>("");

  // Map each clash to its computed alternatives
  const clashAlternativesMap = useMemo(() => {
    const map = new Map<string, ConflictAlternative[]>();
    for (const clash of currentClashes) {
      const alts = findConflictAlternatives(clash, currentRaw);
      map.set(clash.id, alts);
    }
    return map;
  }, [currentClashes, currentRaw]);

  // Handle single clash resolution
  const handleApplyAlternative = (
    clash: ClashDetail,
    alternative: ConflictAlternative,
  ) => {
    const nextRaw = applyConflictResolution(currentRaw, clash, alternative);
    setCurrentRaw(nextRaw);

    // Remove this clash from current list
    const remaining = currentClashes.filter((c) => c.id !== clash.id);
    setCurrentClashes(remaining);
    setResolutionNotice(
      `Resolved: Moved to ${alternative.dayLabel} ${alternative.slotLabel} in ${alternative.roomName}.`,
    );

    // Notify parent
    onResolved(nextRaw);
  };

  // Handle Auto-Resolve All
  const handleAutoResolveAll = () => {
    setAutoResolving(true);
    setResolutionNotice("");

    const { resolvedRaw, resolvedCount, unresolvedCount } = autoResolveAllConflicts(
      currentRaw,
      currentClashes,
    );

    setCurrentRaw(resolvedRaw);
    setAutoResolving(false);

    if (unresolvedCount === 0) {
      setCurrentClashes([]);
      setResolutionNotice(
        `All ${resolvedCount} conflicts were automatically resolved with optimal slots!`,
      );
    } else {
      setResolutionNotice(
        `Resolved ${resolvedCount} conflicts automatically. ${unresolvedCount} conflict(s) require manual slot selection.`,
      );
    }

    onResolved(resolvedRaw);
  };

  return (
    <div className="conflict-resolver-container stack">
      {/* 1. Header & Quick Auto-Resolve Action */}
      <div className="resolver-header-card">
        <div className="resolver-title-row">
          <div className="title-left">
            <Sparkles size={20} className="sparkle-icon" />
            <div>
              <h3>Smart Conflict Auto-Resolver</h3>
              <p className="fine quiet">
                Detects collisions and calculates conflict-free slots where teacher, batch, and venue are all available.
              </p>
            </div>
          </div>
          {onClose && (
            <button type="button" className="close-btn" onClick={onClose}>
              <X size={18} />
            </button>
          )}
        </div>

        {resolutionNotice && (
          <div className="resolver-notice-banner success">
            <CheckCircle2 size={15} />
            <span>{resolutionNotice}</span>
          </div>
        )}

        <div className="resolver-top-actions">
          <div className="clash-count-pill">
            <AlertTriangle size={15} />
            <strong>{currentClashes.length}</strong> active conflict{currentClashes.length === 1 ? "" : "s"}
          </div>

          {currentClashes.length > 0 && (
            <button
              type="button"
              className="btn primary auto-resolve-btn tap"
              onClick={handleAutoResolveAll}
              disabled={autoResolving}
            >
              <Zap size={15} />
              <span>{autoResolving ? "Resolving..." : "⚡ Auto-Resolve All Clashes"}</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Clash Cards with Suggested Solutions */}
      <div className="clashes-resolver-list stack">
        {currentClashes.map((clash) => {
          const alternatives = clashAlternativesMap.get(clash.id) || [];
          return (
            <div key={clash.id} className="clash-resolution-card">
              <div className="clash-card-header">
                <span className={`clash-type-badge ${clash.type}`}>
                  {clash.type.replace("_", " ").toUpperCase()}
                </span>
                <span className="clash-time-tag">
                  <Calendar size={13} className="quiet" />
                  <strong>{clash.dayLabel}</strong> · {clash.slotLabel}
                </span>
              </div>

              <div className="clash-collision-details">
                <p className="collision-message">
                  <strong>Conflict: </strong> {clash.message}
                </p>

                {clash.classA && clash.classB && (
                  <div className="collision-comparison-row">
                    <div className="class-pill">
                      <strong>Class 1: </strong>
                      {clash.classA.course} ({clash.classA.batch}) — {clash.classA.teacher} in {clash.classA.room}
                    </div>
                    <span className="collision-vs">vs</span>
                    <div className="class-pill conflict">
                      <strong>Class 2 (To Relocate): </strong>
                      {clash.classB.course} ({clash.classB.batch}) — {clash.classB.teacher} in {clash.classB.room}
                    </div>
                  </div>
                )}
              </div>

              {/* Suggested Solutions List */}
              <div className="suggested-alternatives-section">
                <h5 className="suggestions-title">
                  <Sparkles size={13} className="text-teal" />
                  Suggested Conflict-Free Alternative Slots:
                </h5>

                {alternatives.length > 0 ? (
                  <div className="alternatives-grid">
                    {alternatives.map((alt, idx) => (
                      <div key={alt.id} className="alternative-card">
                        <div className="alt-left">
                          <span className="alt-match-score">
                            Match #{idx + 1} ({alt.score}%)
                          </span>
                          <div className="alt-time">
                            <Clock size={13} className="quiet" />
                            <strong>{alt.dayLabel}</strong> · {alt.slotLabel}
                          </div>
                          <div className="alt-venue fine quiet">
                            <DoorOpen size={13} />
                            <span>Venue: <strong>{alt.roomName}</strong></span>
                          </div>
                          <p className="alt-reason fine">{alt.reason}</p>
                        </div>

                        <button
                          type="button"
                          className="btn secondary alt-apply-btn tap"
                          onClick={() => handleApplyAlternative(clash, alt)}
                        >
                          <Zap size={13} />
                          <span>Apply Slot</span>
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="no-alt-box fine quiet">
                    No immediate conflict-free alternatives found within standard hours for this combination.
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {currentClashes.length === 0 && (
          <div className="all-clean-box">
            <CheckCircle2 size={40} className="text-emerald" />
            <h4>Zero Conflicts in Timetable</h4>
            <p className="quiet fine">
              All instructor schedules, batch hours, and room bookings are 100% collision-free.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
