import { useState, useRef, useEffect } from "react";
import {
  Download,
  Image as ImageIcon,
  Moon,
  Share2,
  Smartphone,
  Sun,
  Table,
  X,
  Check,
} from "lucide-react";
import { type ExamEntry } from "@/lib/datesheet";
import {
  renderDatesheetToCanvas,
  downloadCanvasImage,
  shareCanvasImage,
  type DatesheetImageFormat,
  type DatesheetImageTheme,
} from "@/lib/datesheet-canvas";

export function ExportDatesheetImage({
  className,
  exams,
}: {
  className: string;
  exams: ExamEntry[];
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="btn tap datesheet-export-btn"
        onClick={() => setIsOpen(true)}
        title="Download Datesheet Slip, Card or Phone Wallpaper"
      >
        <ImageIcon size={16} aria-hidden />
        <span>Download Card / Wallpaper</span>
      </button>

      {isOpen && (
        <DatesheetImageModal
          className={className}
          exams={exams}
          onClose={() => setIsOpen(false)}
        />
      )}
    </>
  );
}

function DatesheetImageModal({
  className,
  exams,
  onClose,
}: {
  className: string;
  exams: ExamEntry[];
  onClose: () => void;
}) {
  const [format, setFormat] = useState<DatesheetImageFormat>("card");
  const [theme, setTheme] = useState<DatesheetImageTheme>("navy");
  const [rendering, setRendering] = useState(false);
  const [shared, setShared] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    let active = true;
    const canvas = canvasRef.current;
    if (!canvas) return;

    setRendering(true);
    renderDatesheetToCanvas(canvas, {
      className,
      exams,
      format,
      theme,
    })
      .catch((err) => console.error("Datesheet canvas rendering error", err))
      .finally(() => {
        if (active) setRendering(false);
      });

    return () => {
      active = false;
    };
  }, [className, exams, format, theme]);

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const safeName = className.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const filename = `cui-midterms-${safeName}-${format}.png`;
    downloadCanvasImage(canvas, filename);
  };

  const handleShare = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const success = await shareCanvasImage(canvas, `${className} Midterm Datesheet`);
    if (success) {
      setShared(true);
      setTimeout(() => setShared(false), 2500);
    }
  };

  return (
    <div className="notif-modal-backdrop" onClick={onClose}>
      <div
        className="notif-modal schedule-image-modal datesheet-modal-wide"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="notif-modal-head">
          <div className="notif-modal-title-group">
            <span className="notif-modal-icon">
              <ImageIcon size={22} aria-hidden />
            </span>
            <div>
              <h2 className="section-title">Download Date Sheet Slip</h2>
              <p className="quiet fine">
                Generate high-res PNG slip for WhatsApp sharing or phone lock-screen wallpaper
              </p>
            </div>
          </div>
          <button
            type="button"
            className="icon-btn tap"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={18} aria-hidden />
          </button>
        </div>

        <div className="notif-modal-body stack">
          {/* Format and Theme Selector */}
          <div className="img-controls-bar">
            <div className="img-format-tabs" role="group" aria-label="Image Format">
              <button
                type="button"
                className={`img-tab-btn ${format === "card" ? "active" : ""}`}
                onClick={() => setFormat("card")}
              >
                <Table size={15} aria-hidden />
                <span>Exam Slip Card</span>
              </button>
              <button
                type="button"
                className={`img-tab-btn ${format === "wallpaper" ? "active" : ""}`}
                onClick={() => setFormat("wallpaper")}
              >
                <Smartphone size={15} aria-hidden />
                <span>Phone Wallpaper</span>
              </button>
            </div>

            <div className="img-theme-tabs" role="group" aria-label="Visual Theme">
              <button
                type="button"
                className={`img-theme-btn ${theme === "navy" ? "active" : ""}`}
                onClick={() => setTheme("navy")}
                title="Navy Dark Mode"
              >
                <Moon size={15} aria-hidden />
                <span>Navy</span>
              </button>
              <button
                type="button"
                className={`img-theme-btn ${theme === "paper" ? "active" : ""}`}
                onClick={() => setTheme("paper")}
                title="Paper Light Mode"
              >
                <Sun size={15} aria-hidden />
                <span>Paper</span>
              </button>
            </div>
          </div>

          {/* Canvas Preview Area */}
          <div className={`img-preview-container ${format === "wallpaper" ? "wallpaper-wrap" : "card-wrap"}`}>
            {rendering && (
              <div className="img-render-spinner">
                <span>Generating high-res image…</span>
              </div>
            )}
            <canvas
              ref={canvasRef}
              className="schedule-export-canvas"
              style={{
                maxWidth: "100%",
                height: "auto",
                display: "block",
                margin: "0 auto",
                borderRadius: "12px",
                boxShadow: "0 8px 30px rgba(0,0,0,0.35)",
              }}
            />
          </div>

          {/* Action Buttons */}
          <div className="notif-modal-actions">
            <button
              type="button"
              className="btn tap"
              onClick={handleShare}
              title="Share Date Sheet Image"
            >
              <Share2 size={16} aria-hidden />
              <span>{shared ? "Shared!" : "Share to WhatsApp / Apps"}</span>
            </button>

            <button
              type="button"
              className="btn solid tap"
              onClick={handleDownload}
            >
              <Download size={16} aria-hidden />
              <span>Download PNG Image</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
