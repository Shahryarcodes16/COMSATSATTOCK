import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { batches, readClock, teachers, type ClockInfo } from "@/lib/schedule";

export type View = "today" | "rooms" | "faculty" | "batches" | "find";
export type ThemeName = "paper" | "ink";

export type Detail =
  | { type: "room"; id: number }
  | { type: "teacher"; id: number }
  | { type: "batch"; id: number }
  | { type: "subject"; id: number };

const KEY = "cui-attock-desk-v1";

type Prefs = {
  theme: ThemeName;
  view: View;
  batchId: number;
  pinnedBatch: number | null;
  pinnedTeachers: number[];
};

const VIEWS: View[] = ["today", "rooms", "faculty", "batches", "find"];

const defaultBatch = Math.max(
  0,
  batches.findIndex((label) => label === "BS(CS)-I"),
);

const DEFAULTS: Prefs = {
  theme: "paper",
  view: "today",
  batchId: defaultBatch,
  pinnedBatch: null,
  pinnedTeachers: [],
};

function inRange(value: unknown, length: number): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value < length;
}

function sanitize(value: unknown): Prefs {
  if (!value || typeof value !== "object") return DEFAULTS;
  const raw = value as Partial<Prefs>;
  const pinnedTeachers = Array.isArray(raw.pinnedTeachers)
    ? raw.pinnedTeachers.filter((id) => inRange(id, teachers.length)).slice(0, 8)
    : [];
  return {
    theme: raw.theme === "ink" ? "ink" : "paper",
    view: VIEWS.includes(raw.view as View) ? (raw.view as View) : "today",
    batchId: inRange(raw.batchId, batches.length) ? raw.batchId : defaultBatch,
    pinnedBatch: inRange(raw.pinnedBatch, batches.length) ? raw.pinnedBatch : null,
    pinnedTeachers,
  };
}

type DeskApi = {
  ready: boolean;
  now: Date | null;
  clock: ClockInfo;
  theme: ThemeName;
  toggleTheme: () => void;
  view: View;
  setView: (view: View) => void;
  day: number;
  slot: number;
  following: boolean;
  setDay: (day: number) => void;
  setSlot: (slot: number) => void;
  backToNow: () => void;
  batchId: number;
  setBatchId: (id: number) => void;
  pinnedBatch: number | null;
  pinBatch: (id: number | null) => void;
  pinnedTeachers: number[];
  togglePinTeacher: (id: number) => void;
  detail: Detail | null;
  open: (detail: Detail) => void;
  close: () => void;
};

const DeskContext = createContext<DeskApi | null>(null);

function urlSelection() {
  const params = new URLSearchParams(window.location.search);
  const view = params.get("view");
  const batch = params.get("batch");
  const day = params.get("day");
  const slot = params.get("slot");
  return {
    view: VIEWS.includes(view as View) ? (view as View) : undefined,
    batchId: batch !== null && inRange(Number(batch), batches.length) ? Number(batch) : undefined,
    pick:
      day !== null && slot !== null && inRange(Number(day), 5) && inRange(Number(slot), 5)
        ? { day: Number(day), slot: Number(slot) }
        : null,
  };
}

export function DeskProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULTS);
  const [ready, setReady] = useState(false);
  const [now, setNow] = useState<Date | null>(null);
  const [pick, setPick] = useState<{ day: number; slot: number } | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);

  useEffect(() => {
    let saved = DEFAULTS;
    try {
      saved = sanitize(JSON.parse(localStorage.getItem(KEY) || "null"));
    } catch {
      /* Preferences remain available for this session when storage is blocked. */
    }
    const selection = urlSelection();
    setPrefs({
      ...saved,
      view: selection.view ?? saved.view,
      batchId: selection.batchId ?? saved.batchId,
    });
    setPick(selection.pick);
    setReady(true);
  }, []);

  useEffect(() => {
    let timer: number;
    const tick = () => {
      const date = new Date();
      setNow(date);
      window.clearTimeout(timer);
      timer = window.setTimeout(tick, 60000 - (date.getSeconds() * 1000 + date.getMilliseconds()));
    };
    tick();
    const resume = () => {
      if (!document.hidden) tick();
    };
    document.addEventListener("visibilitychange", resume);
    window.addEventListener("focus", resume);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("focus", resume);
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(prefs));
    } catch {
      /* Keep working without persistent storage. */
    }
    if (prefs.theme === "ink") document.documentElement.dataset.theme = "ink";
    else delete document.documentElement.dataset.theme;
  }, [prefs, ready]);

  const historyReady = useRef(false);
  useEffect(() => {
    if (!ready) return;
    const url = new URL(window.location.href);
    url.searchParams.set("view", prefs.view);
    url.searchParams.set("batch", String(prefs.batchId));
    if (pick) {
      url.searchParams.set("day", String(pick.day));
      url.searchParams.set("slot", String(pick.slot));
    } else {
      url.searchParams.delete("day");
      url.searchParams.delete("slot");
    }
    if (url.href !== window.location.href) {
      if (historyReady.current) window.history.pushState(null, "", url);
      else window.history.replaceState(null, "", url);
    }
    historyReady.current = true;
  }, [ready, prefs.view, prefs.batchId, pick]);

  useEffect(() => {
    const restore = () => {
      const selection = urlSelection();
      setPrefs((current) => ({
        ...current,
        view: selection.view ?? "today",
        batchId: selection.batchId ?? current.batchId,
      }));
      setPick(selection.pick);
      setDetail(null);
    };
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, []);

  const clock = useMemo(() => readClock(now), [now]);
  const clockRef = useRef(clock);
  clockRef.current = clock;
  const day = pick?.day ?? clock.focusDay;
  const slot = pick?.slot ?? clock.focusSlot;

  const toggleTheme = useCallback(() => {
    setPrefs((current) => ({
      ...current,
      theme: current.theme === "ink" ? "paper" : "ink",
    }));
  }, []);
  const setView = useCallback((view: View) => {
    setPrefs((current) => ({ ...current, view }));
    setDetail(null);
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);
  const setDay = useCallback((nextDay: number) => {
    setPick((current) => ({
      day: nextDay,
      slot: current?.slot ?? clockRef.current.focusSlot,
    }));
  }, []);
  const setSlot = useCallback((nextSlot: number) => {
    setPick((current) => ({
      day: current?.day ?? clockRef.current.focusDay,
      slot: nextSlot,
    }));
  }, []);
  const backToNow = useCallback(() => setPick(null), []);
  const setBatchId = useCallback((batchId: number) => {
    setPrefs((current) => ({ ...current, batchId }));
  }, []);
  const pinBatch = useCallback((pinnedBatch: number | null) => {
    setPrefs((current) => ({
      ...current,
      pinnedBatch,
      batchId: pinnedBatch ?? current.batchId,
    }));
  }, []);
  const togglePinTeacher = useCallback((id: number) => {
    setPrefs((current) => {
      const has = current.pinnedTeachers.includes(id);
      const pinnedTeachers = has
        ? current.pinnedTeachers.filter((item) => item !== id)
        : [...current.pinnedTeachers, id].slice(-8);
      return { ...current, pinnedTeachers };
    });
  }, []);
  const open = useCallback((next: Detail) => setDetail(next), []);
  const close = useCallback(() => setDetail(null), []);

  const api = useMemo<DeskApi>(
    () => ({
      ready,
      now,
      clock,
      theme: prefs.theme,
      toggleTheme,
      view: prefs.view,
      setView,
      day,
      slot,
      following: pick === null,
      setDay,
      setSlot,
      backToNow,
      batchId: prefs.batchId,
      setBatchId,
      pinnedBatch: prefs.pinnedBatch,
      pinBatch,
      pinnedTeachers: prefs.pinnedTeachers,
      togglePinTeacher,
      detail,
      open,
      close,
    }),
    [
      ready,
      now,
      clock,
      prefs,
      day,
      slot,
      pick,
      detail,
      toggleTheme,
      setView,
      setDay,
      setSlot,
      backToNow,
      setBatchId,
      pinBatch,
      togglePinTeacher,
      open,
      close,
    ],
  );

  return <DeskContext.Provider value={api}>{children}</DeskContext.Provider>;
}

export function useDesk(): DeskApi {
  const api = useContext(DeskContext);
  if (!api) throw new Error("Desk is not available");
  return api;
}
