import { useState, useMemo } from "react";
import {
  Flame,
  DoorOpen,
  Calendar,
  Clock,
  TrendingUp,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  HelpCircle,
  ArrowUpDown,
  Sparkles,
} from "lucide-react";
import { DAYS, SLOTS } from "@/lib/schedule";
import {
  getRoomUtilizationStats,
  categorizeRoom,
} from "@/lib/campus-pulse";
import type {
  RoomCategory,
  RoomUtilizationStat,
  TimetableRaw,
} from "@/lib/timetable-types";
import { useDesk } from "@/components/timetable/context";

const CATEGORIES: ("All" | RoomCategory)[] = [
  "All",
  "Classrooms",
  "Computer Labs",
  "Engineering Labs",
  "Lecture Theatres",
];

export function RoomUtilizationHeatmap({
  rawTimetable,
}: {
  rawTimetable?: TimetableRaw;
}) {
  const { open } = useDesk();
  const [selectedCategory, setSelectedCategory] = useState<"All" | RoomCategory>("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"utilization" | "name" | "least">("utilization");
  const [selectedRoomModal, setSelectedRoomModal] = useState<RoomUtilizationStat | null>(null);

  const stats = useMemo(() => {
    return getRoomUtilizationStats(rawTimetable);
  }, [rawTimetable]);

  // Overall campus metrics
  const overallMetrics = useMemo(() => {
    if (stats.length === 0) {
      return { totalRooms: 0, avgUtilization: 0, mostUsed: null, peakSlotAcrossCampus: "L2" };
    }
    const totalSlotsOccupied = stats.reduce((acc, s) => acc + s.totalOccupied, 0);
    const avgUtilization = Math.round(totalSlotsOccupied / (stats.length * 25) * 100);
    const mostUsed = stats[0] || null;

    // Slot frequency across all rooms
    const slotTotals = [0, 0, 0, 0, 0];
    for (const s of stats) {
      for (let day = 0; day < 5; day++) {
        for (let slot = 0; slot < 5; slot++) {
          if (s.occupancyMatrix[day][slot]) {
            slotTotals[slot]++;
          }
        }
      }
    }
    let peakIdx = 0;
    let peakVal = slotTotals[0];
    for (let i = 1; i < 5; i++) {
      if (slotTotals[i] > peakVal) {
        peakVal = slotTotals[i];
        peakIdx = i;
      }
    }

    return {
      totalRooms: stats.length,
      avgUtilization,
      mostUsed,
      peakSlotAcrossCampus: SLOTS[peakIdx]?.label || `L${peakIdx + 1}`,
    };
  }, [stats]);

  // Filter and sort rooms
  const filteredRooms = useMemo(() => {
    let list = stats;
    if (selectedCategory !== "All") {
      list = list.filter((r) => r.category === selectedCategory);
    }
    const query = searchQuery.trim().toLowerCase();
    if (query) {
      list = list.filter(
        (r) =>
          r.roomName.toLowerCase().includes(query) ||
          r.category.toLowerCase().includes(query),
      );
    }

    return [...list].sort((a, b) => {
      if (sortBy === "utilization") return b.utilizationRate - a.utilizationRate;
      if (sortBy === "least") return a.utilizationRate - b.utilizationRate;
      return a.roomName.localeCompare(b.roomName, undefined, { numeric: true });
    });
  }, [stats, selectedCategory, searchQuery, sortBy]);

  const getIntensityColor = (rate: number) => {
    if (rate >= 75) return "var(--crimson, #e11d48)";
    if (rate >= 50) return "var(--amber, #f59e0b)";
    if (rate >= 25) return "var(--teal, #0d9488)";
    return "var(--slate-400, #94a3b8)";
  };

  return (
    <div className="room-heatmap-container stack">
      {/* 1. Overview Summary Cards */}
      <div className="heatmap-metrics-row">
        <div className="metric-card">
          <div className="metric-icon primary">
            <DoorOpen size={18} />
          </div>
          <div className="metric-content">
            <span className="metric-label">Active Venues</span>
            <strong className="metric-value">{overallMetrics.totalRooms}</strong>
            <span className="metric-sub">Classrooms, Labs & LTs</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon success">
            <TrendingUp size={18} />
          </div>
          <div className="metric-content">
            <span className="metric-label">Avg Campus Utilization</span>
            <strong className="metric-value">{overallMetrics.avgUtilization}%</strong>
            <span className="metric-sub">Across 5-day cycle</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon warning">
            <Flame size={18} />
          </div>
          <div className="metric-content">
            <span className="metric-label">Most Occupied Venue</span>
            <strong className="metric-value">
              {overallMetrics.mostUsed ? overallMetrics.mostUsed.roomName : "–"}
            </strong>
            <span className="metric-sub">
              {overallMetrics.mostUsed
                ? `${overallMetrics.mostUsed.utilizationRate}% occupancy`
                : "No data"}
            </span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon accent">
            <Clock size={18} />
          </div>
          <div className="metric-content">
            <span className="metric-label">Campus Peak Lecture</span>
            <strong className="metric-value">{overallMetrics.peakSlotAcrossCampus}</strong>
            <span className="metric-sub">Highest slot occupancy</span>
          </div>
        </div>
      </div>

      {/* 2. Filter & Controls Bar */}
      <div className="heatmap-controls-card">
        <div className="category-tabs" role="tablist">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              className={`cat-tab ${selectedCategory === cat ? "active" : ""}`}
              onClick={() => setSelectedCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="heatmap-search-sort">
          <div className="search-field">
            <Search size={15} className="quiet" />
            <input
              type="text"
              placeholder="Search room (e.g. CR-03, Lab)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="sort-selector">
            <ArrowUpDown size={14} className="quiet" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="select-clean"
            >
              <option value="utilization">Most Used First</option>
              <option value="least">Least Used First</option>
              <option value="name">Room Name (A-Z)</option>
            </select>
          </div>
        </div>
      </div>

      {/* 3. Heatmap Grid View */}
      <div className="heatmap-cards-grid">
        {filteredRooms.map((stat) => {
          const barColor = getIntensityColor(stat.utilizationRate);
          return (
            <div
              key={stat.roomId}
              className="heatmap-room-card"
              onClick={() => setSelectedRoomModal(stat)}
            >
              <div className="room-card-head">
                <div>
                  <h4 className="room-title">{stat.roomName}</h4>
                  <span className="room-cat-badge">{stat.category}</span>
                </div>
                <div className="rate-badge" style={{ backgroundColor: `${barColor}15`, color: barColor }}>
                  <Flame size={13} />
                  <span>{stat.utilizationRate}%</span>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="util-progress-bar">
                <div
                  className="util-progress-fill"
                  style={{ width: `${stat.utilizationRate}%`, backgroundColor: barColor }}
                />
              </div>

              <div className="room-stats-summary fine quiet">
                <span>Occupied: <strong>{stat.totalOccupied}</strong> / 25 slots</span>
                <span>Peak: <strong>{stat.peakDay} · {stat.peakSlot}</strong></span>
              </div>

              {/* Weekly Mini 5x5 Grid */}
              <div className="room-mini-grid stack" title="Weekly 5x5 occupancy matrix">
                <div className="mini-grid-cols">
                  <span className="col-header empty" />
                  {DAYS.map((d) => (
                    <span key={d} className="col-header">
                      {d.slice(0, 1)}
                    </span>
                  ))}
                </div>

                {SLOTS.map((slotDef, sIdx) => (
                  <div key={slotDef.label} className="mini-grid-row">
                    <span className="row-header">{slotDef.label}</span>
                    {DAYS.map((_, dIdx) => {
                      const isOccupied = stat.occupancyMatrix[dIdx][sIdx];
                      return (
                        <span
                          key={`${dIdx}-${sIdx}`}
                          className={`mini-grid-cell ${isOccupied ? "occupied" : "free"}`}
                          title={`${DAYS[dIdx]} ${slotDef.label}: ${isOccupied ? "Occupied" : "Free"}`}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {filteredRooms.length === 0 && (
        <div className="empty-state-box">
          <DoorOpen size={32} className="quiet" />
          <p>No rooms match the selected category or filter query.</p>
        </div>
      )}

      {/* Room Detail Modal */}
      {selectedRoomModal && (
        <div className="modal-backdrop" onClick={() => setSelectedRoomModal(null)}>
          <div className="modal-card wide" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3>{selectedRoomModal.roomName} Utilization Breakdown</h3>
                <p className="fine quiet">
                  {selectedRoomModal.category} · {selectedRoomModal.utilizationRate}% Weekly Occupancy
                </p>
              </div>
              <button
                type="button"
                className="close-btn"
                onClick={() => setSelectedRoomModal(null)}
              >
                ×
              </button>
            </div>

            <div className="modal-body stack">
              <div className="modal-stats-strip">
                <div className="stat-pill">
                  <span className="label">Total Occupied Slots:</span>
                  <strong>{selectedRoomModal.totalOccupied} / 25</strong>
                </div>
                <div className="stat-pill">
                  <span className="label">Peak Day:</span>
                  <strong>{selectedRoomModal.peakDay}</strong>
                </div>
                <div className="stat-pill">
                  <span className="label">Peak Lecture Slot:</span>
                  <strong>{selectedRoomModal.peakSlot}</strong>
                </div>
              </div>

              {/* Full 5x5 Occupancy Schedule */}
              <div className="full-occupancy-table-wrap">
                <table className="full-occupancy-table">
                  <thead>
                    <tr>
                      <th>Slot / Time</th>
                      {DAYS.map((d) => (
                        <th key={d}>{d}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {SLOTS.map((slotDef, sIdx) => (
                      <tr key={slotDef.label}>
                        <td className="slot-name-col">
                          <strong>{slotDef.label}</strong>
                          <span className="fine quiet">({slotDef.start} - {slotDef.end})</span>
                        </td>
                        {DAYS.map((_, dIdx) => {
                          const isOccupied = selectedRoomModal.occupancyMatrix[dIdx][sIdx];
                          return (
                            <td
                              key={dIdx}
                              className={`occupancy-td ${isOccupied ? "busy-cell" : "free-cell"}`}
                            >
                              {isOccupied ? (
                                <span className="cell-tag occupied">
                                  <XCircle size={12} /> Occupied
                                </span>
                              ) : (
                                <span className="cell-tag free">
                                  <CheckCircle2 size={12} /> Free
                                </span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="modal-actions-right">
                <button
                  type="button"
                  className="btn primary tap"
                  onClick={() => {
                    open({ type: "room", id: selectedRoomModal.roomId });
                    setSelectedRoomModal(null);
                  }}
                >
                  <DoorOpen size={15} />
                  <span>View Full Schedule for {selectedRoomModal.roomName}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
