import { useState, useMemo } from "react";
import {
  Sparkles,
  Search,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  Clock,
  Users,
  Plus,
  Trash2,
  X,
  ArrowRight,
  Filter,
  Check,
  Share2,
  BookmarkPlus,
  RefreshCw,
  Layers,
  GraduationCap,
  CalendarCheck,
} from "lucide-react";
import {
  getAllAvailableSubjects,
  getOfferingsForSubject,
  getSubjectsForBatch,
  generateZeroClashSchedules,
  type ZeroClashResult,
  type SubjectOffering,
} from "@/lib/zero-clash";
import { batches, DAYS, SLOTS, type ClassEntry } from "@/lib/schedule";
import { saveCustomSchedule } from "@/lib/my-schedule";
import { getActiveStudentSession } from "@/lib/student";

interface ZeroClashViewProps {
  onAppliedSchedule?: () => void;
}

export function ZeroClashView({ onAppliedSchedule }: ZeroClashViewProps) {
  const allSubjects = useMemo(() => getAllAvailableSubjects(), []);

  // Selected subject IDs
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<number[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [results, setResults] = useState<ZeroClashResult[] | null>(null);
  const [isSolving, setIsSolving] = useState(false);
  const [selectedBatchId, setSelectedBatchId] = useState<number>(() => {
    const student = getActiveStudentSession();
    if (student?.profile?.defaultBatch) {
      const idx = batches.indexOf(student.profile.defaultBatch);
      if (idx >= 0) return idx;
    }
    return 0;
  });
  const [appliedNotice, setAppliedNotice] = useState<string>("");

  // Filtered subjects for search dropdown
  const filteredSubjects = useMemo(() => {
    if (!searchTerm.trim()) return allSubjects.slice(0, 40);
    const q = searchTerm.toLowerCase();
    return allSubjects.filter((s) => s.name.toLowerCase().includes(q));
  }, [allSubjects, searchTerm]);

  // Toggle subject selection
  const toggleSubject = (id: number) => {
    setSelectedSubjectIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
    setResults(null);
    setAppliedNotice("");
  };

  // Pre-fill subjects from selected batch
  const handlePreFillBatch = () => {
    const batchSubjects = getSubjectsForBatch(selectedBatchId);
    if (batchSubjects.length > 0) {
      setSelectedSubjectIds(batchSubjects);
      setResults(null);
      setAppliedNotice(`Loaded ${batchSubjects.length} subjects from ${batches[selectedBatchId]}. You can now add repeat courses!`);
      setTimeout(() => setAppliedNotice(""), 4000);
    }
  };

  // Run the ZeroClash Solver
  const handleSolve = () => {
    if (selectedSubjectIds.length === 0) return;
    setIsSolving(true);
    setAppliedNotice("");

    setTimeout(() => {
      const computed = generateZeroClashSchedules(selectedSubjectIds, 15);
      setResults(computed);
      setIsSolving(false);
    }, 150);
  };

  // 1-Click Apply to My Schedule
  const handleApplySchedule = (res: ZeroClashResult) => {
    saveCustomSchedule(res.entries);
    setAppliedNotice(`Schedule applied! ${res.entries.length} classes added to your My Schedule routine.`);
    if (onAppliedSchedule) {
      setTimeout(() => {
        onAppliedSchedule();
      }, 900);
    }
  };

  return (
    <div className="zero-clash-view stack" style={{ gap: "1.75rem" }}>
      {/* Hero Banner */}
      <div className="zero-clash-hero">
        <div className="zero-clash-badge">
          <Sparkles size={14} />
          <span>FORTIS ZeroClash Engine</span>
        </div>
        <h2 className="zero-clash-title">Smart Course Conflict Resolver & Semester Builder</h2>
        <p className="zero-clash-desc">
          Mix & match regular courses, repeat subjects, and electives. FORTIS computes all <strong>100% clash-free section combinations</strong> with minimum waiting hours on campus.
        </p>
      </div>

      {/* Applied Feedback Toast */}
      {appliedNotice && (
        <div className="admin-feedback-banner" role="alert" style={{ margin: 0 }}>
          <CheckCircle2 size={16} />
          <span>{appliedNotice}</span>
        </div>
      )}

      {/* Step 1: Subject Selection Box */}
      <div className="zero-clash-card">
        <div className="zero-clash-card-header">
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <span className="zero-clash-step-num">1</span>
            <div>
              <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 800 }}>Select Courses for This Semester</h3>
              <p style={{ margin: "0.15rem 0 0", fontSize: "0.78rem", color: "var(--muted, #64748b)" }}>
                Pick all regular and repeat/elective subjects you want to register for ({selectedSubjectIds.length} selected).
              </p>
            </div>
          </div>

          {/* Quick Pre-fill from Batch */}
          <div className="zero-clash-prefill">
            <span style={{ fontSize: "0.78rem", color: "var(--muted, #64748b)" }}>Pre-fill batch:</span>
            <select
              className="input select"
              value={selectedBatchId}
              onChange={(e) => setSelectedBatchId(Number(e.target.value))}
              style={{ fontSize: "0.82rem", padding: "0.35rem 0.65rem" }}
            >
              {batches.map((b, idx) => (
                <option key={b} value={idx}>
                  {b}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn tap"
              onClick={handlePreFillBatch}
              style={{ fontSize: "0.8rem", padding: "0.35rem 0.75rem" }}
            >
              Load Batch Courses
            </button>
          </div>
        </div>

        {/* Selected Subjects Chips */}
        {selectedSubjectIds.length > 0 && (
          <div className="zero-clash-selected-chips">
            {selectedSubjectIds.map((id) => {
              const subObj = allSubjects.find((s) => s.id === id);
              if (!subObj) return null;
              return (
                <span key={id} className="zero-clash-chip">
                  <span className="zero-clash-chip-name">{subObj.name}</span>
                  <span className="zero-clash-chip-sections">{subObj.sectionCount} sections</span>
                  <button
                    type="button"
                    className="zero-clash-chip-remove"
                    onClick={() => toggleSubject(id)}
                    aria-label={`Remove ${subObj.name}`}
                  >
                    <X size={13} />
                  </button>
                </span>
              );
            })}
            <button
              type="button"
              className="zero-clash-clear-chips link-btn"
              onClick={() => {
                setSelectedSubjectIds([]);
                setResults(null);
              }}
            >
              Clear all
            </button>
          </div>
        )}

        {/* Search & Subject Picker */}
        <div style={{ position: "relative", marginTop: "0.85rem" }}>
          <Search
            size={16}
            style={{ position: "absolute", left: 12, top: 12, color: "var(--muted, #64748b)" }}
          />
          <input
            type="text"
            className="input"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search and add courses (e.g. Programming, Discrete, Calculus, Database...)"
            style={{ paddingLeft: "2.35rem" }}
          />
        </div>

        {/* Search Results List */}
        <div className="zero-clash-subjects-grid">
          {filteredSubjects.map((sub) => {
            const isSelected = selectedSubjectIds.includes(sub.id);
            return (
              <button
                key={sub.id}
                type="button"
                className={`zero-clash-sub-pill tap ${isSelected ? "selected" : ""}`}
                onClick={() => toggleSubject(sub.id)}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  {isSelected ? (
                    <CheckCircle2 size={15} color="var(--c-accent)" />
                  ) : (
                    <Plus size={15} color="var(--muted, #64748b)" />
                  )}
                  <span className="zero-clash-sub-title">{sub.name}</span>
                </div>
                <span className="zero-clash-sub-count">{sub.sectionCount} sections</span>
              </button>
            );
          })}
        </div>

        {/* Big Action Button */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "1rem" }}>
          <button
            type="button"
            className="btn solid tap zero-clash-solve-btn"
            disabled={selectedSubjectIds.length < 2 || isSolving}
            onClick={handleSolve}
          >
            {isSolving ? <RefreshCw size={17} className="spin" /> : <Sparkles size={17} />}
            <span>
              {isSolving
                ? "Calculating Clash-Free Combinations..."
                : selectedSubjectIds.length < 2
                  ? "Select At Least 2 Subjects"
                  : `Find Clash-Free Schedules for ${selectedSubjectIds.length} Courses →`}
            </span>
          </button>
        </div>
      </div>

      {/* Step 2: Results Display */}
      {results && (
        <div className="zero-clash-results-container stack" style={{ gap: "1.25rem" }}>
          {results.length > 0 ? (
            <>
              <div className="zero-clash-results-header">
                <div>
                  <h3 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 800 }}>
                    {results.filter((r) => r.isClashFree).length > 0 ? (
                      <span style={{ color: "#16a34a" }}>
                        🎉 Found {results.filter((r) => r.isClashFree).length} 100% Conflict-Free Schedules!
                      </span>
                    ) : (
                      <span style={{ color: "#ea580c" }}>
                        ⚠️ Timetable Constraint: Showing Nearest Options with Minimal Clashes
                      </span>
                    )}
                  </h3>
                  <p style={{ margin: "0.2rem 0 0", fontSize: "0.85rem", color: "var(--muted, #64748b)" }}>
                    Ranked by minimum dead waiting hours between classes on campus.
                  </p>
                </div>
              </div>

              {/* Schedules Cards Grid */}
              <div className="zero-clash-cards-grid">
                {results.map((res, idx) => (
                  <div
                    key={res.id}
                    className={`zero-clash-option-card ${res.isClashFree ? "clash-free" : "has-clash"}`}
                  >
                    <div className="zero-clash-option-head">
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span className="zero-clash-option-label">Option #{idx + 1}</span>
                          {res.isClashFree ? (
                            <span className="zero-clash-badge-free">
                              <CheckCircle2 size={13} /> 0 Clashes Guaranteed
                            </span>
                          ) : (
                            <span className="zero-clash-badge-conflict">
                              <AlertTriangle size={13} /> {res.clashCount} Clash{res.clashCount > 1 ? "es" : ""}
                            </span>
                          )}
                          {res.hasFreeFriday && (
                            <span className="zero-clash-badge-friday">🏖️ Free Friday</span>
                          )}
                        </div>
                        <div className="zero-clash-option-metrics">
                          <span>📅 {res.activeDays} Days/Week</span>
                          <span>•</span>
                          <span>⏱️ {res.gapSlots} Waiting Gap Slot{res.gapSlots !== 1 ? "s" : ""}</span>
                          <span>•</span>
                          <span>📚 {res.entries.length} Total Weekly Lectures</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        className="btn solid tap zero-clash-apply-btn"
                        onClick={() => handleApplySchedule(res)}
                        title="Save this combination into My Schedule"
                      >
                        <CalendarCheck size={16} />
                        <span>Apply to My Schedule</span>
                      </button>
                    </div>

                    {/* Section Mapping List */}
                    <div className="zero-clash-sections-list">
                      <div className="fine quiet" style={{ fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
                        Sections to pick during registration:
                      </div>
                      <div className="zero-clash-offering-tags">
                        {res.offerings.map((off) => (
                          <div key={off.subjectId} className="zero-clash-offering-row">
                            <span className="zero-clash-off-sub">{off.subjectName}</span>
                            <ArrowRight size={13} color="var(--muted, #64748b)" />
                            <span className="zero-clash-off-batch">{off.batchName}</span>
                            {off.teachers.length > 0 && (
                              <span className="zero-clash-off-teacher">({off.teachers.join(", ")})</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Mini Weekly Grid Preview */}
                    <div className="zero-clash-mini-grid">
                      {DAYS.map((dayName, dayIndex) => {
                        const dayClasses = res.entries.filter((e) => e.day === dayIndex);
                        return (
                          <div key={dayName} className="zero-clash-mini-col">
                            <div className="zero-clash-mini-day">{dayName.slice(0, 3)}</div>
                            <div className="zero-clash-mini-slots">
                              {SLOTS.map((s, slotIndex) => {
                                const classInSlot = dayClasses.find((e) => e.slot === slotIndex);
                                if (!classInSlot) {
                                  return <div key={s.label} className="zero-clash-slot-empty" />;
                                }
                                const sub = res.offerings.find((o) => o.subjectId === classInSlot.subject);
                                return (
                                  <div
                                    key={s.label}
                                    className="zero-clash-slot-filled"
                                    title={`${sub?.subjectName || "Class"} (${s.label}) in ${batches[classInSlot.batch]}`}
                                  >
                                    <span className="fine" style={{ fontWeight: 800 }}>
                                      {s.label}
                                    </span>
                                    <span className="zero-clash-slot-subname">
                                      {sub?.subjectName.slice(0, 14)}...
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="zero-clash-empty-state">
              <AlertCircle size={32} color="#ea580c" />
              <h3>No Valid Combinations Found</h3>
              <p>
                None of the available sections for these selected subjects could be combined. Try swapping one of the subjects or removing an elective.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
