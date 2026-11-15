/**
 * FORTIS QuickShare Export Modal
 * Allows students to generate 1-click shareable URLs, WhatsApp invite links, and QR codes.
 */
import React, { useState, useMemo } from "react";
import {
  Share2,
  Copy,
  Check,
  X,
  Sparkles,
  ExternalLink,
  Smartphone,
  Users,
  CheckCircle2,
  QrCode,
  MessageCircle,
} from "lucide-react";
import {
  generateQuickShareUrl,
  generateWhatsAppShareLink,
} from "@/lib/quick-share";
import { subjects, type ClassEntry } from "@/lib/schedule";
import { getActiveStudentSession } from "@/lib/student";

interface QuickShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  schedule: ClassEntry[];
}

export function QuickShareModal({ isOpen, onClose, schedule }: QuickShareModalProps) {
  const student = getActiveStudentSession();
  const [senderName, setSenderName] = useState(student?.profile?.fullName || "");
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);

  const uniqueCourses = useMemo(() => {
    return new Set(schedule.map((e) => e.subject)).size;
  }, [schedule]);

  const shareUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return generateQuickShareUrl(schedule, {
      senderName: senderName || undefined,
      origin: window.location.origin,
    });
  }, [schedule, senderName]);

  const whatsAppUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return generateWhatsAppShareLink(schedule, {
      senderName: senderName || undefined,
      origin: window.location.origin,
    });
  }, [schedule, senderName]);

  const handleCopy = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleNativeShare = async () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: "FORTIS Timetable Share",
          text: `Check out my clash-free timetable (${uniqueCourses} courses) on FORTIS:`,
          url: shareUrl,
        });
      } catch {
        // User cancelled or share failed
      }
    } else {
      handleCopy();
    }
  };

  // Google Charts QR code API (100% reliable, zero extra dependencies)
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(shareUrl)}`;

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="quickshare-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-lg bg-card border border-border rounded-2xl shadow-2xl flex flex-col text-card-foreground overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-border bg-card/95 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20 shadow-sm">
              <Share2 className="w-5 h-5 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="quickshare-modal-title" className="text-lg sm:text-xl font-bold tracking-tight">FORTIS QuickShare</h2>
                <span className="px-2 py-0.5 text-[11px] font-semibold rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                  1-Click Clone
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Share your exact clash-free schedule with friends on WhatsApp
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

        {/* Content */}
        <div className="p-4 sm:p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {/* Summary Badge */}
          <div className="p-3.5 rounded-xl border border-primary/25 bg-primary/5 flex items-center justify-between">
            <div>
              <div className="text-sm font-bold text-foreground">
                {uniqueCourses} Enrolled Subjects · {schedule.length} Weekly Lectures
              </div>
              <p className="text-xs text-muted-foreground">
                0 Clashes · Auto-synchronized rooms & teachers
              </p>
            </div>
            <span className="px-2.5 py-1 text-xs font-bold rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25">
              Ready to Share
            </span>
          </div>

          {/* Optional Sender Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">
              Your Name (Optional - shown to friends when opening)
            </label>
            <input
              type="text"
              placeholder="e.g. Shahryar / BCS-4A Rep"
              value={senderName}
              onChange={(e) => setSenderName(e.target.value)}
              className="w-full px-3 py-2 text-xs sm:text-sm bg-muted/40 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30"
              maxLength={40}
            />
          </div>

          {/* 1-Click Action Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            {/* WhatsApp Share Button */}
            <a
              href={whatsAppUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="py-3 px-4 rounded-xl font-bold text-sm text-white bg-[#25D366] hover:bg-[#20bd5a] transition-all flex items-center justify-center gap-2.5 shadow-md shadow-[#25D366]/20 active:scale-[0.98]"
            >
              <MessageCircle className="w-5 h-5 fill-white stroke-none" />
              <span>Share to WhatsApp</span>
              <ExternalLink className="w-3.5 h-3.5 opacity-80" />
            </a>

            {/* Native Mobile Share / Copy */}
            <button
              onClick={handleNativeShare}
              className="py-3 px-4 rounded-xl font-bold text-sm bg-primary text-primary-foreground hover:bg-primary/90 transition-all flex items-center justify-center gap-2.5 shadow-md shadow-primary/20 active:scale-[0.98]"
            >
              {copied ? (
                <>
                  <Check className="w-5 h-5 text-emerald-300" />
                  <span>Link Copied!</span>
                </>
              ) : (
                <>
                  <Share2 className="w-5 h-5" />
                  <span>Share / Copy Link</span>
                </>
              )}
            </button>
          </div>

          {/* Raw Link Input */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-muted-foreground">
                Direct Shareable Link
              </label>
              <button
                type="button"
                onClick={() => setShowQr(!showQr)}
                className="text-xs text-primary font-semibold hover:underline flex items-center gap-1"
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>{showQr ? "Hide QR Code" : "Show QR Code"}</span>
              </button>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={shareUrl}
                className="w-full px-3 py-2 text-xs font-mono bg-muted/40 border border-border rounded-lg text-muted-foreground select-all focus:outline-none"
              />
              <button
                onClick={handleCopy}
                className="px-3 py-2 text-xs font-semibold bg-muted hover:bg-muted/80 border border-border rounded-lg text-foreground transition-colors shrink-0 flex items-center gap-1.5"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? "Copied" : "Copy"}</span>
              </button>
            </div>
          </div>

          {/* QR Code Reveal */}
          {showQr && (
            <div className="p-4 rounded-xl border border-border bg-muted/30 text-center space-y-3 animate-in fade-in duration-200">
              <p className="text-xs text-muted-foreground">
                Your friend can point their phone camera at this QR code to clone your schedule instantly:
              </p>
              <div className="w-48 h-48 mx-auto p-2 bg-white rounded-xl shadow-md border border-border flex items-center justify-center">
                <img
                  src={qrImageUrl}
                  alt="Schedule QR Code"
                  className="w-full h-full object-contain"
                  loading="lazy"
                />
              </div>
            </div>
          )}

          {/* Features note */}
          <div className="p-3 rounded-xl bg-muted/20 border border-border/50 text-[11px] text-muted-foreground space-y-1">
            <div className="flex items-center gap-1.5 font-semibold text-foreground">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              <span>How your friends clone it:</span>
            </div>
            <p>
              When your friend taps your link, FORTIS opens and shows a preview of all your sections. With one tap on <strong>&ldquo;Clone to My Schedule&rdquo;</strong>, their timetable is automatically populated with 0 clashes!
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 sm:p-4 border-t border-border bg-card/95 backdrop-blur-md flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold bg-muted hover:bg-muted/80 text-foreground rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
