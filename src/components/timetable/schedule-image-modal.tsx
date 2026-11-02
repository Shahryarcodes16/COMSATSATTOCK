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
import { type ClassEntry } from "@/lib/schedule";
import {
  renderScheduleToCanvas,
  downloadCanvasImage,
  shareCanvasImage,
  type ImageFormat,
  type ImageTheme,
} from "@/lib/schedule-canvas";

export function ExportScheduleImage({
  title,
  subtitle,
  list,
}: {
  title: string;
  subtitle?: string;
  list: ClassEntry[];
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="btn tap"
        onClick={() => setIsOpen(true)}
        title="Generate Phone Wallpaper or WhatsApp Share Card"
      >
        <ImageIcon size={16} aria-hidden />
        <span>Wallpaper / Card</span>
      </button>

      {isOpen && (
        <ScheduleImageModal
          title={title}
          subtitle={subtitle}
          list={list}
          onClose={() => setIsOpen(false)}
        />
      )}
    </>
  );
}

function ScheduleImageModal({
  title,
  subtitle,
  list,
  onClose,
}: {
  title: string;
  subtitle?: string;
  list: ClassEntry[];
  onClose: () => void;
}) {
  const [format, setFormat] = useState<ImageFormat>("wallpaper");
  const [theme, setTheme] = useState<ImageTheme>("navy");
  const [rendering, setRendering] = useState(false);
  const [shared, setShared] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    let active = true;
    const canvas = canvasRef.current;
    if (!canvas) return;

    setRendering(true);
    renderScheduleToCanvas(canvas, {
      title,
      subtitle,
      list,
      format,
      theme,
    }).finally(() => {
      if (active) setRendering(false);
    });

    return () => {
      active = false;
    };
  }, [title, subtitle, list, format, theme]);

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const safeTitle = title.replace(/[^a-zA-Z0-9_-]/g, "_");
    downloadCanvasImage(canvas, `${safeTitle}_${format}`);
  };

  const handleShare = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ok = await shareCanvasImage(canvas, title);
    if (ok) {
      setShared(true);
      setTimeout(() => setShared(false), 2500);
    } else {
      // If Web Share API is not supported on desktop, fallback to downloading
      handleDownload();
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-box modal-lg image-export-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3>Timetable Image & Wallpaper Generator</h3>
            <p className="fine quiet">
              Export high-resolution graphic cards for phone lock screens or WhatsApp groups.
            </p>
          </div>
          <button type="button" className="icon-btn tap" onClick={onClose} aria-label="Close modal">
            <X size={18} />
          </button>
        </div>

        <div className="modal-body stack">
          {/* Options controls */}
          <div className="image-export-controls">
            <div className="control-group">
              <span className="group-label">Format / Layout</span>
              <div className="toggle-group" role="group" aria-label="Image format">
                <button
                  type="button"
                  className={`btn tap ${format === "wallpaper" ? "solid" : ""}`}
                  onClick={() => setFormat("wallpaper")}
                >
                  <Smartphone size={15} aria-hidden />
                  <span>📱 Phone Wallpaper (9:16)</span>
                </button>
                <button
                  type="button"
                  className={`btn tap ${format === "card" ? "solid" : ""}`}
                  onClick={() => setFormat("card")}
                >
                  <Table size={15} aria-hidden />
                  <span>💬 WhatsApp Card</span>
                </button>
              </div>
            </div>

            <div className="control-group">
              <span className="group-label">Color Theme</span>
              <div className="toggle-group" role="group" aria-label="Image theme">
                <button
                  type="button"
                  className={`btn tap ${theme === "navy" ? "solid" : ""}`}
                  onClick={() => setTheme("navy")}
                >
                  <Moon size={15} aria-hidden />
                  <span>University Navy</span>
                </button>
                <button
                  type="button"
                  className={`btn tap ${theme === "paper" ? "solid" : ""}`}
                  onClick={() => setTheme("paper")}
                >
                  <Sun size={15} aria-hidden />
                  <span>Clean Light</span>
                </button>
              </div>
            </div>
          </div>

          {/* Canvas Live Preview Container */}
          <div className="image-preview-stage">
            {rendering && (
              <div className="preview-loading-overlay">
                <span>Rendering high-resolution graphic...</span>
              </div>
            )}
            <div className={`canvas-scroll-wrapper ${format === "wallpaper" ? "aspect-wallpaper" : "aspect-card"}`}>
              <canvas ref={canvasRef} className="export-canvas-preview" />
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn tap" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn tap" onClick={handleShare}>
            {shared ? <Check size={16} /> : <Share2 size={16} />}
            <span>{shared ? "Shared!" : "Share to WhatsApp / Apps"}</span>
          </button>
          <button type="button" className="btn solid tap" onClick={handleDownload}>
            <Download size={16} />
            <span>Download High-Res PNG</span>
          </button>
        </div>
      </div>
    </div>
  );
}
