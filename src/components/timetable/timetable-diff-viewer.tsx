import { useState, useMemo } from "react";
import {
  GitCompare,
  PlusCircle,
  MinusCircle,
  AlertCircle,
  Search,
  Filter,
  Users,
  GraduationCap,
  Calendar,
  CheckCircle2,
  X,
  ArrowRight,
} from "lucide-react";
import { computeDetailedTimetableDiff } from "@/lib/timetable-diff";
import type {
  DetailedDiffItem,
  DetailedTimetableDiff,
  TimetableRaw,
} from "@/lib/timetable-types";

interface TimetableDiffViewerProps {
  oldTimetable: TimetableRaw | null;
  newTimetable: TimetableRaw;
  oldVersionLabel?: string;
  newVersionLabel?: string;
  onClose?: () => void;
}

export function TimetableDiffViewer({
  oldTimetable,
  newTimetable,
  oldVersionLabel = "Current Active Timetable",
  newVersionLabel = "New Revision",
  onClose,
}: TimetableDiffViewerProps) {
  const [filterType, setFilterType] = useState<"all" | "added" | "removed" | "modified">("all");
  const [selectedBatch, setSelectedBatch] = useState<string>("all");
  const [selectedTeacher, setSelectedTeacher] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const diff: DetailedTimetableDiff = useMemo(() => {
    return computeDetailedTimetableDiff(oldTimetable, newTimetable);
  }, [oldTimetable, newTimetable]);

  const allItems = useMemo(() => {
    return [...diff.added, ...diff.removed, ...diff.modified];
  }, [diff]);

  const filteredItems = useMemo(() => {
    let list = allItems;

    if (filterType !== "all") {
      list = list.filter((item) => item.type === filterType);
    }

    if (selectedBatch !== "all") {
      list = list.filter((item) => item.batch === selectedBatch);
    }

    if (selectedTeacher !== "all") {
      list = list.filter(
        (item) =>
          item.newDetails?.teacher === selectedTeacher ||
          item.oldDetails?.teacher === selectedTeacher,
      );
    }

    const query = searchQuery.trim().toLowerCase();
    if (query) {
      list = list.filter(
        (item) =>
          item.course.toLowerCase().includes(query) ||
          item.batch.toLowerCase().includes(query) ||
          item.newDetails?.room.toLowerCase().includes(query) ||
          item.oldDetails?.room.toLowerCase().includes(query) ||
          item.newDetails?.teacher.toLowerCase().includes(query) ||
          item.oldDetails?.teacher.toLowerCase().includes(query),
      );
    }

    // Sort by day and slot
    return list.sort((a, b) => a.day - b.day || a.slot - b.slot);
  }, [allItems, filterType, selectedBatch, selectedTeacher, searchQuery]);

  return (
    <div className="diff-viewer-container stack">
      {/* 1. Header & Version Comparison Banner */}
      <div className="diff-header-card">
        <div className="diff-title-row">
          <div className="title-left">
            <GitCompare size={20} className="diff-icon" />
            <div>
              <h3>Timetable Visual Diff Comparison</h3>
              <p className="fine quiet">
                Comparing <strong>{oldVersionLabel}</strong> vs <strong>{newVersionLabel}</strong>
              </p>
            </div>
          </div>
          {onClose && (
            <button type="button" className="close-btn" onClick={onClose} title="Close diff view">
              <X size={18} />
            </button>
          )}
        </div>

        {/* Change Metric Badges */}
        <div className="diff-metric-badges">
          <button
            type="button"
            className={`metric-badge added ${filterType === "added" ? "active" : ""}`}
            onClick={() => setFilterType(filterType === "added" ? "all" : "added")}
          >
            <PlusCircle size={14} />
            <span>+{diff.added.length} Added</span>
          </button>

          <button
            type="button"
            className={`metric-badge removed ${filterType === "removed" ? "active" : ""}`}
            onClick={() => setFilterType(filterType === "removed" ? "all" : "removed")}
          >
            <MinusCircle size={14} />
            <span>-{diff.removed.length} Removed</span>
          </button>

          <button
            type="button"
            className={`metric-badge modified ${filterType === "modified" ? "active" : ""}`}
            onClick={() => setFilterType(filterType === "modified" ? "all" : "modified")}
          >
            <AlertCircle size={14} />
            <span>~{diff.modified.length} Modified</span>
          </button>

          <div className="metric-badge unchanged">
            <CheckCircle2 size={14} />
            <span>{diff.unchangedCount} Unchanged</span>
          </div>
        </div>
      </div>

      {/* 2. Filters & Search Toolbar */}
      <div className="diff-filters-card">
        <div className="search-field">
          <Search size={15} className="quiet" />
          <input
            type="text"
            placeholder="Search course, batch, teacher, or venue..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="dropdown-filter">
          <Users size={14} className="quiet" />
          <select
            value={selectedBatch}
            onChange={(e) => setSelectedBatch(e.target.value)}
            className="select-clean"
          >
            <option value="all">All Batches ({diff.affectedBatches.length})</option>
            {diff.affectedBatches.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </div>

        <div className="dropdown-filter">
          <GraduationCap size={14} className="quiet" />
          <select
            value={selectedTeacher}
            onChange={(e) => setSelectedTeacher(e.target.value)}
            className="select-clean"
          >
            <option value="all">All Faculty ({diff.affectedTeachers.length})</option>
            {diff.affectedTeachers.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 3. Diff Items List */}
      <div className="diff-list-section stack">
        {filteredItems.map((item, index) => {
          if (item.type === "added") {
            return (
              <div key={`added-${index}`} className="diff-item-card added">
                <div className="diff-item-left">
                  <span className="diff-pill added">
                    <PlusCircle size={12} /> ADDED
                  </span>
                  <div className="diff-time-tag">
                    <Calendar size={13} className="quiet" />
                    <strong>{item.dayLabel}</strong> · {item.slotLabel}
                  </div>
                </div>

                <div className="diff-item-body">
                  <div className="course-line">
                    <strong className="course-name">{item.course}</strong>
                    <span className="batch-pill">{item.batch}</span>
                  </div>
                  <div className="meta-line fine quiet">
                    <span>Teacher: <strong>{item.newDetails?.teacher || "Unassigned"}</strong></span>
                    <span>Venue: <strong>{item.newDetails?.room || "TBA"}</strong></span>
                  </div>
                </div>
              </div>
            );
          }

          if (item.type === "removed") {
            return (
              <div key={`removed-${index}`} className="diff-item-card removed">
                <div className="diff-item-left">
                  <span className="diff-pill removed">
                    <MinusCircle size={12} /> REMOVED
                  </span>
                  <div className="diff-time-tag">
                    <Calendar size={13} className="quiet" />
                    <strong>{item.dayLabel}</strong> · {item.slotLabel}
                  </div>
                </div>

                <div className="diff-item-body">
                  <div className="course-line strike">
                    <strong className="course-name">{item.course}</strong>
                    <span className="batch-pill">{item.batch}</span>
                  </div>
                  <div className="meta-line fine quiet strike">
                    <span>Teacher: {item.oldDetails?.teacher || "Unassigned"}</span>
                    <span>Venue: {item.oldDetails?.room || "TBA"}</span>
                  </div>
                </div>
              </div>
            );
          }

          // Modified
          return (
            <div key={`mod-${index}`} className="diff-item-card modified">
              <div className="diff-item-left">
                <span className="diff-pill modified">
                  <AlertCircle size={12} /> MODIFIED
                </span>
                <div className="diff-time-tag">
                  <Calendar size={13} className="quiet" />
                  <strong>{item.dayLabel}</strong> · {item.slotLabel}
                </div>
              </div>

              <div className="diff-item-body">
                <div className="course-line">
                  <strong className="course-name">{item.course}</strong>
                  <span className="batch-pill">{item.batch}</span>
                </div>

                {/* List of field modifications */}
                <div className="modifications-list stack">
                  {item.changes?.map((ch, idx) => (
                    <div key={idx} className="mod-change-pill">
                      <ArrowRight size={12} className="mod-arrow" />
                      <span>{ch}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}

        {filteredItems.length === 0 && (
          <div className="empty-diff-state">
            <CheckCircle2 size={36} className="text-teal" />
            <h4>No differences found for this filter</h4>
            <p className="quiet fine">
              All classes in this selection match identically between versions.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
