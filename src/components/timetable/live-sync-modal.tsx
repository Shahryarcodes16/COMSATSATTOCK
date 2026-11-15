/**
 * FORTIS LiveSync Modal Component
 * Dynamic WebCal Calendar Cloud Bridge for Google Calendar, Apple Calendar, and Microsoft Outlook.
 */
import React, { useState, useEffect } from "react";
import {
  Calendar,
  Sparkles,
  Copy,
  Check,
  ExternalLink,
  RefreshCw,
  X,
  Bell,
  Layers,
  CheckCircle2,
  Radio,
  Share2,
  Smartphone,
  Globe,
  Info,
} from "lucide-react";
import {
  createOrUpdateCalendarSyncServerFn,
  getCalendarSyncStatusServerFn,
  getBatchSectionSyncUrlsServerFn,
} from "@/lib/calendar-sync-server-fn";
import { loadCustomSchedule, type ClassEntry } from "@/lib/my-schedule";
import { batches } from "@/lib/schedule";

interface LiveSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialBatch?: string;
}

const LOCAL_SYNC_TOKEN_KEY = "fortis_live_sync_token_v1";

export function LiveSyncModal({ isOpen, onClose, initialBatch }: LiveSyncModalProps) {
  const [activeTab, setActiveTab] = useState<"myschedule" | "batch">("myschedule");
  const [scheduleList, setScheduleList] = useState<ClassEntry[]>([]);
  const [token, setToken] = useState<string>("");
  const [syncData, setSyncData] = useState<{
    token: string;
    httpsUrl: string;
    webcalUrl: string;
    googleCalendarUrl: string;
    appleCalendarUrl: string;
    outlookCalendarUrl: string;
    accessCount: number;
    lastAccessedAt?: string;
    entriesCount: number;
  } | null>(null);

  const [loading, setLoading] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  // Batch section sync state
  const [selectedBatch, setSelectedBatch] = useState<string>(initialBatch || (batches[0] ?? "BCS-4A"));
  const [batchSyncData, setBatchSyncData] = useState<{
    batchName: string;
    httpsUrl: string;
    webcalUrl: string;
    googleCalendarUrl: string;
    appleCalendarUrl: string;
    outlookCalendarUrl: string;
    entriesCount: number;
  } | null>(null);
  const [batchLoading, setBatchLoading] = useState(false);

  // Load schedule and existing sync token on mount
  useEffect(() => {
    if (!isOpen) return;
    const current = loadCustomSchedule();
    setScheduleList(current);

    const savedToken = typeof window !== "undefined" ? localStorage.getItem(LOCAL_SYNC_TOKEN_KEY) || "" : "";
    if (savedToken) {
      setToken(savedToken);
      fetchSyncStatus(savedToken, current);
    } else if (current.length > 0) {
      // Auto-generate sync link for non-empty schedule
      createNewSync(current);
    }
  }, [isOpen]);

  // Sync batch when batch tab is opened or batch selection changes
  useEffect(() => {
    if (!isOpen || activeTab !== "batch" || !selectedBatch) return;
    fetchBatchSyncUrls(selectedBatch);
  }, [isOpen, activeTab, selectedBatch]);

  async function createNewSync(list: ClassEntry[]) {
    if (typeof window === "undefined") return;
    setLoading(true);
    try {
      const clientOrigin = window.location.origin;
      const res = await createOrUpdateCalendarSyncServerFn({
        data: {
          token: token || undefined,
          title: "My Schedule",
          entries: list,
          clientOrigin,
        },
      });

      if (res.success) {
        setToken(res.token);
        localStorage.setItem(LOCAL_SYNC_TOKEN_KEY, res.token);
        setSyncData({
          token: res.token,
          httpsUrl: res.httpsUrl,
          webcalUrl: res.webcalUrl,
          googleCalendarUrl: res.googleCalendarUrl,
          appleCalendarUrl: res.appleCalendarUrl,
          outlookCalendarUrl: res.outlookCalendarUrl,
          accessCount: res.accessCount,
          lastAccessedAt: res.lastAccessedAt,
          entriesCount: res.entriesCount,
        });
      }
    } catch (err) {
      console.error("Failed to create calendar sync:", err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchSyncStatus(syncToken: string, currentEntries: ClassEntry[]) {
    if (typeof window === "undefined") return;
    setLoading(true);
    try {
      const clientOrigin = window.location.origin;
      const status = await getCalendarSyncStatusServerFn({
        data: {
          token: syncToken,
          clientOrigin,
        },
      });

      if (status.success && status.found) {
        setSyncData({
          token: status.token!,
          httpsUrl: status.httpsUrl!,
          webcalUrl: status.webcalUrl!,
          googleCalendarUrl: status.googleCalendarUrl!,
          appleCalendarUrl: status.appleCalendarUrl!,
          outlookCalendarUrl: status.outlookCalendarUrl!,
          accessCount: status.accessCount,
          lastAccessedAt: status.lastAccessedAt,
          entriesCount: status.entriesCount,
        });

        // If local schedule was updated, refresh the cloud sync record
        if (currentEntries.length > 0 && currentEntries.length !== status.entriesCount) {
          createNewSync(currentEntries);
        }
      } else {
        // Token was invalid or expired, generate a new one
        if (currentEntries.length > 0) {
          createNewSync(currentEntries);
        }
      }
    } catch (err) {
      console.error("Failed to fetch sync status:", err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchBatchSyncUrls(batchName: string) {
    if (typeof window === "undefined") return;
    setBatchLoading(true);
    try {
      const clientOrigin = window.location.origin;
      const res = await getBatchSectionSyncUrlsServerFn({
        data: {
          batchName,
          clientOrigin,
        },
      });

      if (res.success) {
        setBatchSyncData(res);
      }
    } catch (err) {
      console.error("Failed to load batch sync urls:", err);
    } finally {
      setBatchLoading(false);
    }
  }

  function handleCopy(url: string, type: string) {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(url);
      setCopiedUrl(type);
      setTimeout(() => setCopiedUrl(null), 2500);
    }
  }

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="livesync-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-2xl max-h-[92vh] overflow-y-auto bg-card border border-border rounded-2xl shadow-2xl flex flex-col text-card-foreground">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between p-4 sm:p-5 border-b border-border bg-card/95 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20 shadow-sm shadow-primary/10">
              <Radio className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="livesync-modal-title" className="text-lg sm:text-xl font-bold tracking-tight">FORTIS LiveSync</h2>
                <span className="px-2 py-0.5 text-[11px] font-semibold rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                  Real-Time WebCal
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Sync live timetable updates directly into Apple, Google & Outlook calendars
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="px-4 sm:px-6 pt-4 pb-2 border-b border-border bg-muted/20">
          <div className="grid grid-cols-2 gap-2 p-1 bg-muted/60 rounded-xl">
            <button
              onClick={() => setActiveTab("myschedule")}
              className={`py-2 px-3 text-xs sm:text-sm font-semibold rounded-lg transition-all flex items-center justify-center gap-2 ${
                activeTab === "myschedule"
                  ? "bg-card text-foreground shadow-sm border border-border/80 font-bold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Smartphone className="w-4 h-4" />
              <span>My Schedule Sync</span>
              {scheduleList.length > 0 && (
                <span className="px-1.5 py-0.2 text-[10px] rounded-full bg-primary/20 text-primary font-bold">
                  {scheduleList.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab("batch")}
              className={`py-2 px-3 text-xs sm:text-sm font-semibold rounded-lg transition-all flex items-center justify-center gap-2 ${
                activeTab === "batch"
                  ? "bg-card text-foreground shadow-sm border border-border/80 font-bold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Globe className="w-4 h-4" />
              <span>Batch / Section Feed</span>
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 space-y-6">
          {activeTab === "myschedule" ? (
            /* TAB 1: MY SCHEDULE LIVE SYNC */
            <>
              {scheduleList.length === 0 ? (
                <div className="p-6 text-center border-2 border-dashed border-border rounded-xl bg-muted/10 space-y-3">
                  <div className="w-12 h-12 mx-auto rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center">
                    <Info className="w-6 h-6" />
                  </div>
                  <h3 className="text-base font-semibold">Your Schedule is Empty</h3>
                  <p className="text-xs text-muted-foreground max-w-md mx-auto">
                    Please add courses to <strong>My Schedule</strong> or use <strong>FORTIS ZeroClash</strong> first. Once classes are enrolled, your live WebCal subscription link will be generated automatically!
                  </p>
                </div>
              ) : (
                <div className="space-y-5">
                  {/* Status Banner */}
                  <div className="p-4 rounded-xl border border-emerald-500/25 bg-emerald-500/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                      <div>
                        <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                          <span>Live Cloud Bridge Active</span>
                          <span className="text-[11px] font-normal text-muted-foreground">• {scheduleList.length} classes synced</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {syncData?.lastAccessedAt ? (
                            <>
                              Last checked by calendar app:{" "}
                              <span className="font-semibold text-foreground">
                                {new Date(syncData.lastAccessedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              </span>{" "}
                              ({syncData.accessCount} total syncs)
                            </>
                          ) : (
                            "Ready to connect. Tap an option below to subscribe on your phone."
                          )}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => createNewSync(scheduleList)}
                      disabled={loading}
                      className="px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground bg-card hover:bg-muted border border-border rounded-lg transition-colors flex items-center gap-1.5 shrink-0"
                      title="Force update cloud cache"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
                      <span>Refresh Feed</span>
                    </button>
                  </div>

                  {/* 1-Click Action Buttons */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      1-Click Calendar Subscription
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      {/* Apple Calendar */}
                      <a
                        href={syncData?.appleCalendarUrl || "#"}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-3 rounded-xl border border-border bg-card hover:border-zinc-500/50 hover:bg-zinc-500/5 transition-all flex items-center sm:flex-col justify-center gap-2 group text-center"
                      >
                        <div className="w-9 h-9 rounded-lg bg-black text-white flex items-center justify-center p-1.5 shadow-sm overflow-hidden border border-white/10 shrink-0">
                          <img
                            src="/apple-calendar-logo.png"
                            alt="Apple Logo"
                            className="w-full h-full object-contain"
                          />
                        </div>
                        <div className="text-left sm:text-center">
                          <div className="text-xs font-bold group-hover:text-foreground transition-colors flex items-center gap-1 justify-center">
                            Apple Calendar
                            <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                          <div className="text-[11px] text-muted-foreground">iPhone, iPad & Mac</div>
                        </div>
                      </a>

                      {/* Google Calendar */}
                      <a
                        href={syncData?.googleCalendarUrl || "#"}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-3 rounded-xl border border-border bg-card hover:border-blue-500/50 hover:bg-blue-500/5 transition-all flex items-center sm:flex-col justify-center gap-2 group text-center"
                      >
                        <div className="w-9 h-9 rounded-lg bg-blue-600/10 text-blue-600 flex items-center justify-center p-1.5 shadow-sm border border-blue-500/20 shrink-0">
                          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
                            <rect x="3" y="4" width="18" height="18" rx="3" fill="#4285F4"/>
                            <rect x="7" y="2" width="2" height="4" rx="1" fill="#EA4335"/>
                            <rect x="15" y="2" width="2" height="4" rx="1" fill="#EA4335"/>
                            <path d="M3 9H21" stroke="white" strokeWidth="1.5"/>
                            <circle cx="8" cy="13" r="1.2" fill="white"/>
                            <circle cx="12" cy="13" r="1.2" fill="white"/>
                            <circle cx="16" cy="13" r="1.2" fill="white"/>
                            <circle cx="8" cy="17" r="1.2" fill="white"/>
                            <circle cx="12" cy="17" r="1.2" fill="white"/>
                            <circle cx="16" cy="17" r="1.2" fill="white"/>
                          </svg>
                        </div>
                        <div className="text-left sm:text-center">
                          <div className="text-xs font-bold group-hover:text-blue-500 transition-colors flex items-center gap-1 justify-center">
                            Google Calendar
                            <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                          <div className="text-[11px] text-muted-foreground">Android, Web & Wearables</div>
                        </div>
                      </a>

                      {/* Microsoft Outlook */}
                      <a
                        href={syncData?.outlookCalendarUrl || "#"}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-3 rounded-xl border border-border bg-card hover:border-sky-500/50 hover:bg-sky-500/5 transition-all flex items-center sm:flex-col justify-center gap-2 group text-center"
                      >
                        <div className="w-9 h-9 rounded-lg bg-[#0078D4]/10 text-[#0078D4] flex items-center justify-center p-1.5 shadow-sm border border-[#0078D4]/20 shrink-0">
                          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
                            <rect x="3" y="4" width="18" height="16" rx="2" fill="#0078D4"/>
                            <path d="M3 7L12 13L21 7" stroke="white" strokeWidth="1.5"/>
                          </svg>
                        </div>
                        <div className="text-left sm:text-center">
                          <div className="text-xs font-bold group-hover:text-sky-500 transition-colors flex items-center gap-1 justify-center">
                            MS Outlook
                            <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                          <div className="text-[11px] text-muted-foreground">Office 365 & Windows</div>
                        </div>
                      </a>
                    </div>
                  </div>

                  {/* Raw URL Copy Boxes */}
                  <div className="space-y-3 pt-2">
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                          <Radio className="w-3.5 h-3.5 text-primary" /> WebCal Subscription URL (Recommended)
                        </span>
                        <span className="text-[11px] text-muted-foreground">Universal protocol</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          readOnly
                          value={syncData?.webcalUrl || "Generating..."}
                          className="w-full px-3 py-2 text-xs font-mono bg-muted/40 border border-border rounded-lg text-muted-foreground select-all focus:outline-none"
                        />
                        <button
                          onClick={() => syncData && handleCopy(syncData.webcalUrl, "webcal")}
                          className="px-3 py-2 text-xs font-semibold bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors shrink-0 flex items-center gap-1.5 shadow-sm"
                        >
                          {copiedUrl === "webcal" ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-300" />
                              <span>Copied!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                          <Globe className="w-3.5 h-3.5" /> Direct HTTPS Feed URL
                        </span>
                        <span className="text-[11px] text-muted-foreground">For Google Calendar URL import</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          readOnly
                          value={syncData?.httpsUrl || "Generating..."}
                          className="w-full px-3 py-2 text-xs font-mono bg-muted/40 border border-border rounded-lg text-muted-foreground select-all focus:outline-none"
                        />
                        <button
                          onClick={() => syncData && handleCopy(syncData.httpsUrl, "https")}
                          className="px-3 py-2 text-xs font-semibold bg-muted text-foreground hover:bg-muted/80 border border-border rounded-lg transition-colors shrink-0 flex items-center gap-1.5"
                        >
                          {copiedUrl === "https" ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-500" />
                              <span>Copied!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            /* TAB 2: BATCH / SECTION PRESET FEED */
            <div className="space-y-5">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Select Section to Subscribe
                </label>
                <div className="flex items-center gap-3">
                  <select
                    value={selectedBatch}
                    onChange={(e) => setSelectedBatch(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm font-semibold bg-muted/50 border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    {batches.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>
                <p className="text-xs text-muted-foreground">
                  Subscribing to a section gives you the entire batch schedule with auto-updating rooms and teachers whenever department revisions are published.
                </p>
              </div>

              {batchSyncData && (
                <div className="space-y-4 pt-2">
                  <div className="p-3.5 rounded-xl border border-primary/20 bg-primary/5 flex items-center justify-between">
                    <div>
                      <div className="text-sm font-bold text-foreground">
                        {batchSyncData.batchName} Section Feed
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {batchSyncData.entriesCount} scheduled lectures this semester
                      </div>
                    </div>
                    <span className="px-2.5 py-1 text-xs font-bold rounded-lg bg-primary/20 text-primary">
                      Ready to Sync
                    </span>
                  </div>

                  {/* Batch 1-Click Buttons */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <a
                      href={batchSyncData.appleCalendarUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-3 rounded-xl border border-border bg-card hover:border-zinc-500/50 hover:bg-zinc-500/5 transition-all flex items-center justify-center gap-2.5 group text-sm font-semibold"
                    >
                      <div className="w-5 h-5 rounded-md bg-black text-white flex items-center justify-center p-0.5 border border-white/10 shrink-0">
                        <img
                          src="/apple-calendar-logo.png"
                          alt="Apple"
                          className="w-full h-full object-contain"
                        />
                      </div>
                      <span>Subscribe in Apple Calendar</span>
                      <ExternalLink className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100" />
                    </a>

                    <a
                      href={batchSyncData.googleCalendarUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-3 rounded-xl border border-border bg-card hover:border-blue-500/50 hover:bg-blue-500/5 transition-all flex items-center justify-center gap-2.5 group text-sm font-semibold"
                    >
                      <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none">
                        <rect x="3" y="4" width="18" height="18" rx="3" fill="#4285F4"/>
                        <rect x="7" y="2" width="2" height="4" rx="1" fill="#EA4335"/>
                        <rect x="15" y="2" width="2" height="4" rx="1" fill="#EA4335"/>
                        <path d="M3 9H21" stroke="white" strokeWidth="1.5"/>
                      </svg>
                      <span>Add to Google Calendar</span>
                      <ExternalLink className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100" />
                    </a>
                  </div>

                  {/* Copy Link */}
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground block mb-1">
                      WebCal URL for {batchSyncData.batchName}
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={batchSyncData.webcalUrl}
                        className="w-full px-3 py-2 text-xs font-mono bg-muted/40 border border-border rounded-lg text-muted-foreground select-all focus:outline-none"
                      />
                      <button
                        onClick={() => handleCopy(batchSyncData.webcalUrl, "batchWebcal")}
                        className="px-3 py-2 text-xs font-semibold bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors shrink-0 flex items-center gap-1.5 shadow-sm"
                      >
                        {copiedUrl === "batchWebcal" ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-300" />
                            <span>Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Superpower Features Checklist */}
          <div className="pt-4 border-t border-border">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
              Live Cloud Bridge Superpowers
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
              <div className="flex items-start gap-2 p-2.5 rounded-lg bg-muted/30 border border-border/50">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-foreground">Auto Room & Teacher Sync</div>
                  <div className="text-muted-foreground text-[11px]">
                    Department timetable revisions update on your phone automatically.
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-2 p-2.5 rounded-lg bg-muted/30 border border-border/50">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-foreground">Real-Time Cancellations</div>
                  <div className="text-muted-foreground text-[11px]">
                    Faculty-cancelled lectures appear marked as ❌ [CANCELLED].
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-2 p-2.5 rounded-lg bg-muted/30 border border-border/50">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-foreground">Make-up Lecture Alerts</div>
                  <div className="text-muted-foreground text-[11px]">
                    Rescheduled and Saturday makeup classes are automatically injected.
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-2 p-2.5 rounded-lg bg-muted/30 border border-border/50">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-foreground">15-Minute Class Reminders</div>
                  <div className="text-muted-foreground text-[11px]">
                    Pop-up alarm on iPhone, Android, and Apple/Galaxy watches.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 p-3 sm:p-4 border-t border-border bg-card/95 backdrop-blur-md flex items-center justify-between text-xs text-muted-foreground">
          <span>RFC 5545 iCalendar Compliant</span>
          <button
            onClick={onClose}
            className="px-4 py-2 font-semibold bg-muted hover:bg-muted/80 text-foreground rounded-lg transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
