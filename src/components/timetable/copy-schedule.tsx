import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { formatSchedule, type ClassEntry } from "@/lib/schedule";

export function CopySchedule({ title, list }: { title: string; list: ClassEntry[] }) {
  const [status, setStatus] = useState<"idle" | "copied" | "manual">("idle");
  const text = formatSchedule(title, list);
  async function copy() {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(text);
      setStatus("copied");
    } catch {
      setStatus("manual");
    }
  }
  return (
    <div className="copy-control">
      <button type="button" className="btn tap" onClick={copy}>
        {status === "copied" ? <Check size={16} aria-hidden /> : <Copy size={16} aria-hidden />}
        {status === "copied" ? "Copied" : "Copy week"}
      </button>
      <span className="sr-only" role="status">
        {status === "copied"
          ? "Schedule copied to clipboard."
          : status === "manual"
            ? "Automatic copy unavailable. Select and copy the schedule below."
            : ""}
      </span>
      {status === "manual" ? (
        <div className="copy-fallback note stack">
          <p>Automatic copy is unavailable. Select the text below to copy your schedule.</p>
          <textarea
            aria-label="Schedule to copy manually"
            readOnly
            value={text}
            onFocus={(event) => event.currentTarget.select()}
          />
          <button className="btn" type="button" onClick={() => setStatus("idle")}>
            Close
          </button>
        </div>
      ) : null}
    </div>
  );
}
