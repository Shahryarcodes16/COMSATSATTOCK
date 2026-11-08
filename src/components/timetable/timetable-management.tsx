import { useState, useEffect, useMemo, useRef } from "react";
import {
  Upload,
  FileSpreadsheet,
  FileText,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Calendar,
  Clock,
  ArrowRight,
  History,
  RotateCcw,
  Trash2,
  Download,
  Search,
  Eye,
  Save,
  Sparkles,
  Filter,
  Layers,
  Users,
  DoorOpen,
  BookOpen,
  Info,
  Check,
  X,
  RefreshCw,
  CalendarClock,
  Share2,
} from "lucide-react";
import {
  getActiveTimetableServerFn,
  getAllTimetableVersionsServerFn,
  publishTimetableVersionServerFn,
  rollbackTimetableVersionServerFn,
  saveTimetableDraftServerFn,
  getAllTimetableDraftsServerFn,
  deleteTimetableDraftServerFn,
} from "@/lib/timetable-server-fn";
import {
  parseUploadedTimetableFile,
  exportTimetableToCsv,
  generateSampleCsvTemplate,
  rawToTimetableRows,
} from "@/lib/timetable-parser";
import { validateTimetable } from "@/lib/timetable-validator";
import { setActiveTimetable, DAYS, SLOTS } from "@/lib/schedule";
import type {
  TimetableRaw,
  TimetableVersion,
  TimetableDraft,
  TimetableValidationResult,
  TimetableDiffSummary,
  TimetableClassRow,
} from "@/lib/timetable-types";

type SubTab = "active" | "upload" | "drafts" | "history";

export function TimetableManagement() {
  const [subTab, setSubTab] = useState<SubTab>("active");

  // Server state
  const [activeVersion, setActiveVersion] = useState<{
    versionName: string;
    timetableData: TimetableRaw;
    publishedAt: string;
  } | null>(null);
  const [versions, setVersions] = useState<TimetableVersion[]>([]);
  const [drafts, setDrafts] = useState<TimetableDraft[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Upload & Preview state
  const [uploadedFileName, setUploadedFileName] = useState("");
  const [isParsing, setIsParsing] = useState(false);
  const [parsedRaw, setParsedRaw] = useState<TimetableRaw | null>(null);
  const [parsedRows, setParsedRows] = useState<TimetableClassRow[]>([]);
  const [validation, setValidation] = useState<TimetableValidationResult | null>(null);
  const [versionNameInput, setVersionNameInput] = useState("");
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledDate, setScheduledDate] = useState("");
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishFeedback, setPublishFeedback] = useState("");
  const [publishError, setPublishError] = useState("");
  const [lastDiffSummary, setLastDiffSummary] = useState<TimetableDiffSummary | null>(null);

  // Table filters for preview & active views
  const [previewSearch, setPreviewSearch] = useState("");
  const [previewDayFilter, setPreviewDayFilter] = useState<number>(-1);
  const [previewSlotFilter, setPreviewSlotFilter] = useState<number>(-1);

  // Draft saving state
  const [draftNameInput, setDraftNameInput] = useState("");
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [draftFeedback, setDraftFeedback] = useState("");

  // Rollback confirmation state
  const [confirmRollbackVer, setConfirmRollbackVer] = useState<TimetableVersion | null>(null);
  const [isRollingBack, setIsRollingBack] = useState(false);
  const [rollbackFeedback, setRollbackFeedback] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load all initial data from server
  const loadData = async () => {
    setIsLoading(true);
    try {
      const [activeRes, versionsRes, draftsRes] = await Promise.all([
        getActiveTimetableServerFn(),
        getAllTimetableVersionsServerFn(),
        getAllTimetableDraftsServerFn(),
      ]);

      if (activeRes) {
        setActiveVersion(activeRes);
      }
      if (versionsRes) {
        setVersions(versionsRes);
      }
      if (draftsRes) {
        setDrafts(draftsRes);
      }
    } catch (err) {
      console.error("[timetable-management] Failed to load data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Auto-generate next version name when activeVersion changes
  useEffect(() => {
    if (activeVersion?.versionName && !versionNameInput) {
      const match = activeVersion.versionName.match(/V(\d+)/i);
      if (match) {
        const nextNum = parseInt(match[1], 10) + 1;
        setVersionNameInput(activeVersion.versionName.replace(/V\d+/i, `V${nextNum}`));
      } else {
        setVersionNameInput("Fall-2026-V2");
      }
    }
  }, [activeVersion, versionNameInput]);

  // Handle file upload and smart parsing
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedFileName(file.name);
    setIsParsing(true);
    setPublishError("");
    setPublishFeedback("");
    setLastDiffSummary(null);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const result = await parseUploadedTimetableFile(arrayBuffer, file.name);
      const valResult = validateTimetable(result.raw);

      setParsedRaw(result.raw);
      setParsedRows(result.rows);
      setValidation(valResult);

      if (!draftNameInput) {
        setDraftNameInput(`Draft - ${file.name.replace(/\.[^/.]+$/, "")}`);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to parse file";
      setPublishError(`Error parsing file: ${message}. Please check format.`);
    } finally {
      setIsParsing(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Publish timetable version
  const handlePublish = async () => {
    if (!parsedRaw) return;
    if (!versionNameInput.trim()) {
      setPublishError("Please provide a version name before publishing.");
      return;
    }

    if (validation && !validation.isValid) {
      setPublishError("Cannot publish while critical conflicts or clashes exist.");
      return;
    }

    setIsPublishing(true);
    setPublishError("");
    setPublishFeedback("");

    try {
      const res = await publishTimetableVersionServerFn({
        data: {
          versionName: versionNameInput.trim(),
          timetableData: parsedRaw,
          scheduledFor: isScheduled && scheduledDate ? scheduledDate : null,
        },
      });

      if (!res.success || !res.version) {
        setPublishError(res.error || "Failed to publish timetable.");
        return;
      }

      // Automatically update client state in real-time
      if (!res.version.scheduledFor) {
        setActiveTimetable(parsedRaw, res.version.versionName);
      }

      if (res.diff) {
        setLastDiffSummary(res.diff);
      }

      setPublishFeedback(
        isScheduled
          ? `✓ Timetable scheduled for deployment on ${new Date(scheduledDate).toLocaleString()}`
          : `✓ Version "${res.version.versionName}" published successfully! All student schedules and free rooms have updated.`,
      );

      // Refresh list
      await loadData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Publication failed";
      setPublishError(message);
    } finally {
      setIsPublishing(false);
    }
  };

  // Save current parsed data as a draft
  const handleSaveDraft = async () => {
    if (!parsedRaw) return;
    const name = draftNameInput.trim() || `Draft - ${new Date().toLocaleDateString()}`;

    setIsSavingDraft(true);
    setDraftFeedback("");
    try {
      const res = await saveTimetableDraftServerFn({
        data: {
          name,
          timetableData: parsedRaw,
        },
      });

      if (res.success && res.draft) {
        setDraftFeedback(`✓ Draft "${res.draft.name}" saved successfully.`);
        await loadData();
      } else {
        setPublishError(res.error || "Failed to save draft.");
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to save draft";
      setPublishError(message);
    } finally {
      setIsSavingDraft(false);
    }
  };

  // Load an existing draft into the upload preview tab
  const handleLoadDraft = (draft: TimetableDraft) => {
    setParsedRaw(draft.timetableData);
    setParsedRows(rawToTimetableRows(draft.timetableData));
    setValidation(validateTimetable(draft.timetableData));
    setUploadedFileName(`Loaded Draft: ${draft.name}`);
    setDraftNameInput(draft.name);
    setPublishFeedback(`✓ Draft "${draft.name}" loaded into editor.`);
    setPublishError("");
    setLastDiffSummary(null);
    setSubTab("upload");
  };

  // Delete a draft
  const handleDeleteDraft = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete draft "${name}"?`)) return;
    try {
      await deleteTimetableDraftServerFn({ data: { id } });
      await loadData();
    } catch (err) {
      console.error("Failed to delete draft:", err);
    }
  };

  // Rollback to historical version
  const handleRollback = async () => {
    if (!confirmRollbackVer) return;

    setIsRollingBack(true);
    setRollbackFeedback("");
    try {
      const res = await rollbackTimetableVersionServerFn({
        data: { versionId: confirmRollbackVer.id },
      });

      if (res.success && res.version) {
        setActiveTimetable(res.version.timetableData, res.version.versionName);
        setRollbackFeedback(`✓ System rolled back to "${res.version.versionName}"! Campus timetable updated.`);
        setConfirmRollbackVer(null);
        await loadData();
      } else {
        alert(res.error || "Failed to rollback.");
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Rollback failed";
      alert(message);
    } finally {
      setIsRollingBack(false);
    }
  };

  // Download helpers
  const handleDownloadActiveCsv = () => {
    if (!activeVersion?.timetableData) return;
    const csv = exportTimetableToCsv(activeVersion.timetableData);
    downloadBlob(csv, `COMSATS-Attock-Timetable-${activeVersion.versionName}.csv`, "text/csv");
  };

  const handleDownloadSampleCsv = () => {
    const csv = generateSampleCsvTemplate();
    downloadBlob(csv, "COMSATS-Attock-Timetable-Template.csv", "text/csv");
  };

  const downloadBlob = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Filtered rows for the preview table
  const displayedRows = useMemo(() => {
    return parsedRows.filter((row) => {
      if (previewDayFilter >= 0 && row.day !== previewDayFilter) return false;
      if (previewSlotFilter >= 0 && row.slot !== previewSlotFilter) return false;
      if (previewSearch.trim()) {
        const q = previewSearch.toLowerCase();
        const matches =
          row.batch.toLowerCase().includes(q) ||
          row.course.toLowerCase().includes(q) ||
          row.teacher.toLowerCase().includes(q) ||
          row.room.toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    });
  }, [parsedRows, previewDayFilter, previewSlotFilter, previewSearch]);

  return (
    <div className="timetable-mgmt-container stack">
      {/* Sub-Navigation Header */}
      <div className="timetable-mgmt-header">
        <div>
          <h2 className="section-title">Timetable Management</h2>
          <p className="quiet">
            Upload new timetable spreadsheets, audit clashes, manage drafts, and rollback versions in real time.
          </p>
        </div>
        <div className="timetable-mgmt-actions">
          <button
            type="button"
            className="btn tap fine admin-export-btn"
            onClick={handleDownloadActiveCsv}
            disabled={!activeVersion}
            title="Download active schedule as CSV"
          >
            <Download size={14} aria-hidden />
            <span>Export CSV</span>
          </button>
          <button
            type="button"
            className="btn tap fine admin-export-btn"
            onClick={handleDownloadSampleCsv}
            title="Download formatted Excel/CSV template"
          >
            <FileSpreadsheet size={14} aria-hidden />
            <span>Sample Template</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="timetable-subtabs">
        <button
          type="button"
          className={`timetable-subtab-btn ${subTab === "active" ? "active" : ""}`}
          onClick={() => setSubTab("active")}
        >
          <Layers size={15} aria-hidden />
          <span>Current Active</span>
          {activeVersion && <span className="admin-tab-pill">{activeVersion.versionName}</span>}
        </button>

        <button
          type="button"
          className={`timetable-subtab-btn ${subTab === "upload" ? "active" : ""}`}
          onClick={() => setSubTab("upload")}
        >
          <Upload size={15} aria-hidden />
          <span>Upload & Preview</span>
          {parsedRaw && <span className="admin-tab-pill ready">Ready</span>}
        </button>

        <button
          type="button"
          className={`timetable-subtab-btn ${subTab === "drafts" ? "active" : ""}`}
          onClick={() => setSubTab("drafts")}
        >
          <Save size={15} aria-hidden />
          <span>Drafts</span>
          {drafts.length > 0 && <span className="admin-tab-pill">{drafts.length}</span>}
        </button>

        <button
          type="button"
          className={`timetable-subtab-btn ${subTab === "history" ? "active" : ""}`}
          onClick={() => setSubTab("history")}
        >
          <History size={15} aria-hidden />
          <span>Version History & Rollback</span>
          {versions.length > 0 && <span className="admin-tab-pill">{versions.length}</span>}
        </button>
      </div>

      {/* ========================================================= */}
      {/* 1. CURRENT ACTIVE TIMETABLE SECTION                      */}
      {/* ========================================================= */}
      {subTab === "active" && (
        <div className="timetable-tab-pane stack">
          {activeVersion ? (
            <div className="active-timetable-card">
              <div className="active-card-top">
                <div className="active-card-meta">
                  <span className="live-pill">
                    <span className="live-dot" /> Live In Production
                  </span>
                  <h3>{activeVersion.versionName}</h3>
                  <p className="quiet fine">
                    Published on {new Date(activeVersion.publishedAt).toLocaleString()}
                  </p>
                </div>
                <div className="active-card-quick-actions">
                  <button
                    type="button"
                    className="btn solid tap"
                    onClick={() => setSubTab("upload")}
                  >
                    <Upload size={15} aria-hidden />
                    <span>Upload New Version</span>
                  </button>
                </div>
              </div>

              {/* Stats Grid */}
              <div className="timetable-stats-grid">
                <div className="stat-box">
                  <BookOpen size={18} className="stat-icon" aria-hidden />
                  <div className="stat-val">{activeVersion.timetableData.e.length}</div>
                  <div className="stat-lbl">Scheduled Lectures</div>
                </div>
                <div className="stat-box">
                  <Users size={18} className="stat-icon" aria-hidden />
                  <div className="stat-val">{activeVersion.timetableData.b.length}</div>
                  <div className="stat-lbl">Academic Batches</div>
                </div>
                <div className="stat-box">
                  <DoorOpen size={18} className="stat-icon" aria-hidden />
                  <div className="stat-val">{activeVersion.timetableData.r.length}</div>
                  <div className="stat-lbl">Rooms & Labs</div>
                </div>
                <div className="stat-box">
                  <CheckCircle2 size={18} className="stat-icon" aria-hidden />
                  <div className="stat-val">{activeVersion.timetableData.t.length}</div>
                  <div className="stat-lbl">Active Faculty</div>
                </div>
              </div>

              {/* Batches Preview Tags */}
              <div className="active-batches-section">
                <span className="fine quiet">Covered Programs & Batches:</span>
                <div className="active-batch-tags">
                  {activeVersion.timetableData.b.map((batch) => (
                    <span key={batch} className="batch-tag">
                      {batch}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="admin-loading-state">
              <RefreshCw className="spin" size={20} aria-hidden />
              <span>Loading current timetable...</span>
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* 2. UPLOAD & PREVIEW SECTION                               */}
      {/* ========================================================= */}
      {subTab === "upload" && (
        <div className="timetable-tab-pane stack">
          {/* Dropzone */}
          <div className="timetable-dropzone">
            <input
              ref={fileInputRef}
              type="file"
              id="timetable-file-input"
              accept=".xlsx, .xls, .csv, .json"
              onChange={handleFileUpload}
              style={{ display: "none" }}
            />
            <label htmlFor="timetable-file-input" className="dropzone-label">
              <div className="dropzone-icon-circle">
                <Upload size={28} aria-hidden />
              </div>
              <div className="dropzone-text">
                <b>Click to upload or drag & drop timetable file</b>
                <span>Supports Excel (.xlsx, .xls), CSV (.csv), or backup JSON</span>
              </div>
              <span className="btn solid tap fine">Select File</span>
            </label>
          </div>

          {/* Loading or Feedback */}
          {isParsing && (
            <div className="admin-feedback-banner info">
              <RefreshCw className="spin" size={16} aria-hidden />
              <span>Analyzing spreadsheet and checking clash matrix...</span>
            </div>
          )}

          {publishError && (
            <div className="admin-feedback-banner error">
              <AlertCircle size={18} aria-hidden />
              <span>{publishError}</span>
            </div>
          )}

          {publishFeedback && (
            <div className="admin-feedback-banner success">
              <CheckCircle2 size={18} aria-hidden />
              <span>{publishFeedback}</span>
            </div>
          )}

          {draftFeedback && (
            <div className="admin-feedback-banner success">
              <Save size={18} aria-hidden />
              <span>{draftFeedback}</span>
            </div>
          )}

          {/* Change Summary Diff Card (Post-Publication) */}
          {lastDiffSummary && (
            <div className="change-summary-card stack">
              <div className="change-summary-head">
                <Sparkles size={18} className="accent-color" aria-hidden />
                <h3>Change Summary vs Previous Active Version</h3>
              </div>
              <div className="change-metrics-grid">
                <div className="change-metric-pill added">
                  <b>+{lastDiffSummary.addedCount}</b> Classes Added
                </div>
                <div className="change-metric-pill modified">
                  <b>~{lastDiffSummary.modifiedCount}</b> Classes Rescheduled
                </div>
                <div className="change-metric-pill removed">
                  <b>-{lastDiffSummary.removedCount}</b> Classes Removed
                </div>
              </div>
              <div className="change-details-split">
                <div>
                  <span className="fine quiet">Affected Faculty ({lastDiffSummary.affectedTeachers.length}):</span>
                  <div className="affected-names-list">
                    {lastDiffSummary.affectedTeachers.slice(0, 10).map((t) => (
                      <span key={t} className="affected-chip">
                        {t}
                      </span>
                    ))}
                    {lastDiffSummary.affectedTeachers.length > 10 && (
                      <span className="fine quiet">
                        +{lastDiffSummary.affectedTeachers.length - 10} more
                      </span>
                    )}
                  </div>
                </div>
                <div>
                  <span className="fine quiet">Affected Batches ({lastDiffSummary.affectedBatches.length}):</span>
                  <div className="affected-names-list">
                    {lastDiffSummary.affectedBatches.slice(0, 10).map((b) => (
                      <span key={b} className="affected-chip">
                        {b}
                      </span>
                    ))}
                    {lastDiffSummary.affectedBatches.length > 10 && (
                      <span className="fine quiet">
                        +{lastDiffSummary.affectedBatches.length - 10} more
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Validation & Clash Detection Results */}
          {validation && (
            <div
              className={`validation-card ${
                validation.isValid ? "valid" : "invalid"
              } stack`}
            >
              <div className="validation-card-head">
                <div className="val-icon-wrap">
                  {validation.isValid ? (
                    <CheckCircle2 size={24} className="val-check-icon" aria-hidden />
                  ) : (
                    <AlertTriangle size={24} className="val-warn-icon" aria-hidden />
                  )}
                </div>
                <div>
                  <h4>
                    {validation.isValid
                      ? "Validation Passed: Ready for Deployment"
                      : `Validation Failed: ${validation.totalErrors} Conflict(s) Detected`}
                  </h4>
                  <p className="quiet fine">
                    {validation.isValid
                      ? "No room clashes, teacher double-bookings, or batch overlaps were found."
                      : "Please resolve the room and instructor double-bookings below before publishing live."}
                  </p>
                </div>
              </div>

              {/* List of Detected Conflicts */}
              {validation.clashes.length > 0 && (
                <div className="clashes-list stack">
                  {validation.clashes.map((c) => (
                    <div key={c.id} className={`clash-item ${c.severity}`}>
                      <div className="clash-badge">{c.type.replace("_", " ").toUpperCase()}</div>
                      <div className="clash-details">
                        <b>{c.message}</b>
                        {c.classA && c.classB && (
                          <div className="clash-comparison">
                            <span className="class-pill">
                              {c.classA.course} ({c.classA.batch}) — {c.classA.teacher} in {c.classA.room}
                            </span>
                            <span className="clash-vs">vs</span>
                            <span className="class-pill">
                              {c.classB.course} ({c.classB.batch}) — {c.classB.teacher} in {c.classB.room}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Parsed Preview Table & Publish Form */}
          {parsedRaw && (
            <div className="timetable-preview-card stack">
              <div className="preview-card-head">
                <div>
                  <h3>Spreadsheet Preview ({parsedRows.length} Lectures)</h3>
                  <p className="quiet fine">
                    Review parsed slots, rooms, and batches before deploying live.
                  </p>
                </div>

                {/* Filter Controls */}
                <div className="preview-filter-row">
                  <div className="search-box">
                    <Search size={14} aria-hidden />
                    <input
                      type="text"
                      placeholder="Filter course, teacher, room, batch..."
                      value={previewSearch}
                      onChange={(e) => setPreviewSearch(e.target.value)}
                    />
                  </div>
                  <select
                    value={previewDayFilter}
                    onChange={(e) => setPreviewDayFilter(Number(e.target.value))}
                    className="select-filter"
                  >
                    <option value={-1}>All Days</option>
                    {DAYS.map((d, idx) => (
                      <option key={d} value={idx}>
                        {d}
                      </option>
                    ))}
                  </select>
                  <select
                    value={previewSlotFilter}
                    onChange={(e) => setPreviewSlotFilter(Number(e.target.value))}
                    className="select-filter"
                  >
                    <option value={-1}>All Slots</option>
                    {SLOTS.map((s, idx) => (
                      <option key={s.label} value={idx}>
                        {s.label} ({s.start})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Scrollable Preview Table */}
              <div className="preview-table-wrapper">
                <table className="preview-table">
                  <thead>
                    <tr>
                      <th>Day</th>
                      <th>Slot</th>
                      <th>Batch</th>
                      <th>Course / Subject</th>
                      <th>Teacher / Instructor</th>
                      <th>Room</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedRows.slice(0, 100).map((row, idx) => (
                      <tr key={idx}>
                        <td>
                          <b>{DAYS[row.day] || `Day ${row.day}`}</b>
                        </td>
                        <td>
                          <span className="slot-pill">
                            {SLOTS[row.slot]?.label || `L${row.slot + 1}`}
                          </span>
                        </td>
                        <td>
                          <span className="batch-pill">{row.batch}</span>
                        </td>
                        <td>{row.course}</td>
                        <td>{row.teacher}</td>
                        <td>
                          <span className="room-pill">{row.room}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {displayedRows.length > 100 && (
                  <div className="table-more-hint">
                    Showing first 100 of {displayedRows.length} classes matching filter.
                  </div>
                )}
              </div>

              {/* Publish Controls */}
              <div className="publish-form-bar stack">
                <div className="admin-grid-2">
                  <div className="input-group">
                    <label>
                      <b>Version Name</b>
                    </label>
                    <input
                      type="text"
                      className="input"
                      value={versionNameInput}
                      onChange={(e) => setVersionNameInput(e.target.value)}
                      placeholder="e.g. Fall-2026-V2"
                    />
                  </div>
                  <div className="input-group">
                    <label>
                      <b>Draft Name (Optional)</b>
                    </label>
                    <input
                      type="text"
                      className="input"
                      value={draftNameInput}
                      onChange={(e) => setDraftNameInput(e.target.value)}
                      placeholder="Name to save draft under"
                    />
                  </div>
                </div>

                {/* Scheduled Publish Switch */}
                <div className="schedule-publish-toggle">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={isScheduled}
                      onChange={(e) => setIsScheduled(e.target.checked)}
                    />
                    <span>Schedule for future date instead of publishing immediately</span>
                  </label>
                  {isScheduled && (
                    <input
                      type="datetime-local"
                      className="input scheduled-datetime-input"
                      value={scheduledDate}
                      onChange={(e) => setScheduledDate(e.target.value)}
                    />
                  )}
                </div>

                {/* Final Action Buttons */}
                <div className="publish-action-buttons">
                  <button
                    type="button"
                    className="btn tap fine"
                    onClick={handleSaveDraft}
                    disabled={isSavingDraft || !parsedRaw}
                  >
                    <Save size={16} aria-hidden />
                    <span>{isSavingDraft ? "Saving Draft..." : "Save as Draft"}</span>
                  </button>

                  <button
                    type="button"
                    className="btn solid tap deploy-btn"
                    onClick={handlePublish}
                    disabled={isPublishing || !parsedRaw || (validation ? !validation.isValid : false)}
                    title={validation && !validation.isValid ? "Resolve clashes before deploying" : undefined}
                  >
                    <Sparkles size={16} aria-hidden />
                    <span>
                      {isPublishing
                        ? "Deploying..."
                        : isScheduled
                        ? "Schedule Timetable Deployment"
                        : "Deploy This Timetable Live to All Students"}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* 3. DRAFTS SECTION                                        */}
      {/* ========================================================= */}
      {subTab === "drafts" && (
        <div className="timetable-tab-pane stack">
          <div className="drafts-header">
            <h3>Saved Timetable Drafts ({drafts.length})</h3>
            <p className="quiet fine">
              Work-in-progress timetables saved for review or future scheduling.
            </p>
          </div>

          {drafts.length === 0 ? (
            <div className="admin-empty-state">
              <FileSpreadsheet size={32} className="quiet" aria-hidden />
              <b>No drafts saved yet</b>
              <p className="quiet fine">
                Upload a timetable and click "Save as Draft" to keep revisions here.
              </p>
            </div>
          ) : (
            <div className="drafts-grid">
              {drafts.map((d) => (
                <div key={d.id} className="draft-card stack">
                  <div className="draft-card-top">
                    <h4>{d.name}</h4>
                    <span className="fine quiet">
                      Updated {new Date(d.updatedAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="draft-stats-row">
                    <span><b>{d.stats.totalLectures}</b> classes</span>
                    <span>•</span>
                    <span><b>{d.stats.batchesCount}</b> batches</span>
                    <span>•</span>
                    <span><b>{d.stats.roomsCount}</b> rooms</span>
                  </div>
                  <div className="draft-actions">
                    <button
                      type="button"
                      className="btn tap fine"
                      onClick={() => handleLoadDraft(d)}
                    >
                      <Eye size={14} aria-hidden />
                      <span>Load & Review</span>
                    </button>
                    <button
                      type="button"
                      className="btn tap fine danger"
                      onClick={() => handleDeleteDraft(d.id, d.name)}
                    >
                      <Trash2 size={14} aria-hidden />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* 4. VERSION HISTORY & ROLLBACK SECTION                    */}
      {/* ========================================================= */}
      {subTab === "history" && (
        <div className="timetable-tab-pane stack">
          <div className="history-header">
            <h3>Timetable Version History ({versions.length})</h3>
            <p className="quiet fine">
              All deployed timetable releases. Rollback to any past release with a single click.
            </p>
          </div>

          {rollbackFeedback && (
            <div className="admin-feedback-banner success">
              <CheckCircle2 size={18} aria-hidden />
              <span>{rollbackFeedback}</span>
            </div>
          )}

          <div className="versions-list stack">
            {versions.map((ver) => (
              <div
                key={ver.id}
                className={`version-card ${ver.isActive ? "active-version" : ""}`}
              >
                <div className="version-card-main">
                  <div className="version-title-row">
                    <h4>{ver.versionName}</h4>
                    {ver.isActive ? (
                      <span className="live-pill">
                        <span className="live-dot" /> Active Live
                      </span>
                    ) : (
                      <span className="archived-pill">Archived</span>
                    )}
                  </div>
                  <div className="version-meta-row quiet fine">
                    <span>Published: {new Date(ver.publishedAt).toLocaleString()}</span>
                    <span>•</span>
                    <span>By: {ver.publishedBy}</span>
                    <span>•</span>
                    <span>
                      {ver.summary?.totalLectures || ver.timetableData.e.length} classes across{" "}
                      {ver.summary?.batchesCount || ver.timetableData.b.length} batches
                    </span>
                  </div>

                  {ver.summary?.changes && (
                    <div className="version-changes-row">
                      <span className="change-chip added">
                        +{ver.summary.changes.addedCount} Added
                      </span>
                      <span className="change-chip modified">
                        ~{ver.summary.changes.modifiedCount} Modified
                      </span>
                      <span className="change-chip removed">
                        -{ver.summary.changes.removedCount} Removed
                      </span>
                    </div>
                  )}
                </div>

                <div className="version-card-actions">
                  {!ver.isActive && (
                    <button
                      type="button"
                      className="btn tap fine rollback-btn"
                      onClick={() => setConfirmRollbackVer(ver)}
                      title="Rollback to this timetable"
                    >
                      <RotateCcw size={14} aria-hidden />
                      <span>Rollback</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Rollback Confirmation Modal */}
          {confirmRollbackVer && (
            <div className="admin-modal-backdrop">
              <div className="admin-modal-card stack">
                <div className="modal-title-row">
                  <AlertTriangle size={24} className="danger-color" aria-hidden />
                  <h3>Confirm Timetable Rollback</h3>
                </div>
                <p>
                  Are you sure you want to rollback the active campus timetable to{" "}
                  <b>"{confirmRollbackVer.versionName}"</b>?
                </p>
                <p className="fine quiet">
                  This will immediately update all student lecture timetables, faculty teaching desks, and room radars across the entire campus.
                </p>
                <div className="modal-actions-row">
                  <button
                    type="button"
                    className="btn tap"
                    onClick={() => setConfirmRollbackVer(null)}
                    disabled={isRollingBack}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn solid tap danger"
                    onClick={handleRollback}
                    disabled={isRollingBack}
                  >
                    <RotateCcw size={16} aria-hidden />
                    <span>{isRollingBack ? "Rolling back..." : "Yes, Rollback Now"}</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
