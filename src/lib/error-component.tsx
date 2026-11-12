import { useEffect } from "react";
import type { ErrorComponentProps } from "@tanstack/react-router";
import { RefreshCw, TriangleAlert } from "lucide-react";

const FALLBACK_MESSAGE = "An unexpected error occurred. Try reloading the page.";
const RELOAD_GUARD_KEY = "cui_chunk_reload_ts";

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error) return error;
  return FALLBACK_MESSAGE;
}

function isChunkLoadError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("failed to fetch dynamically imported module") ||
    lower.includes("importing a module script failed") ||
    lower.includes("chunkloaderror") ||
    lower.includes("loading chunk") ||
    lower.includes("unable to preload css")
  );
}

function performCleanReload() {
  if (typeof window === "undefined") return;
  try {
    if ("caches" in window) {
      caches.keys().then((keys) => {
        for (const k of keys) caches.delete(k);
      });
    }
  } catch {
    // Ignore cache errors
  }
  const url = new URL(window.location.href);
  url.searchParams.set("_r", String(Date.now()));
  window.location.replace(url.toString());
}

export function AppErrorComponent({ error }: ErrorComponentProps) {
  const msg = errorMessage(error);
  const chunkError = isChunkLoadError(msg);

  useEffect(() => {
    if (!chunkError || typeof window === "undefined") return;
    try {
      const last = Number(sessionStorage.getItem(RELOAD_GUARD_KEY) || "0");
      if (Date.now() - last > 15_000) {
        sessionStorage.setItem(RELOAD_GUARD_KEY, String(Date.now()));
        performCleanReload();
      }
    } catch {
      // Ignore storage errors
    }
  }, [chunkError]);

  return (
    <main
      className={
        "flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center " +
        "bg-canvas text-ink"
      }
    >
      <span className="text-red-500" aria-hidden="true">
        <TriangleAlert className="size-10" strokeWidth={2} />
      </span>
      <h1 className="text-lg font-semibold">
        {chunkError ? "Updating timetable to latest version" : "Something went wrong"}
      </h1>
      <p className="max-w-md text-sm break-words text-muted">
        {chunkError
          ? "A newer deployment just went live or your connection interrupted loading a module. Tap below to load the latest version."
          : msg}
      </p>
      <button
        type="button"
        className="btn solid"
        onClick={performCleanReload}
        style={{ display: "inline-flex", alignItems: "center", gap: "0.45rem" }}
      >
        <RefreshCw size={15} aria-hidden />
        <span>Reload timetable</span>
      </button>
    </main>
  );
}
