import { useState, useEffect } from "react";
import { AlertCircle, AlertTriangle, Info, CheckCircle2, X } from "lucide-react";
import { getCampusNotice, type CampusNotice } from "@/lib/admin";

export function CampusNoticeBanner() {
  const [notice, setNotice] = useState<CampusNotice | null>(() => getCampusNotice());
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const handleUpdate = () => {
      setNotice(getCampusNotice());
      setDismissed(false);
    };

    window.addEventListener("cui:campus-notice-update", handleUpdate);
    window.addEventListener("storage", handleUpdate);
    return () => {
      window.removeEventListener("cui:campus-notice-update", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, []);

  if (!notice || !notice.enabled || dismissed) return null;

  const getIcon = () => {
    switch (notice.type) {
      case "urgent":
        return <AlertTriangle size={18} aria-hidden />;
      case "warning":
        return <AlertCircle size={18} aria-hidden />;
      case "success":
        return <CheckCircle2 size={18} aria-hidden />;
      default:
        return <Info size={18} aria-hidden />;
    }
  };

  return (
    <div className={`campus-global-notice ${notice.type}`} role="alert">
      <div className="campus-notice-icon">{getIcon()}</div>
      <div className="campus-notice-body">
        {notice.title && <b>{notice.title}: </b>}
        <span>{notice.message}</span>
      </div>
      <button
        type="button"
        className="campus-notice-close"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss notice"
      >
        <X size={15} aria-hidden />
      </button>
    </div>
  );
}
