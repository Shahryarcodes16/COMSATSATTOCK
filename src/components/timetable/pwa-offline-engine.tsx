import { useState, useEffect, useCallback } from "react";
import {
  Smartphone,
  Download,
  WifiOff,
  Wifi,
  X,
  Share,
  PlusSquare,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import crest from "@/assets/crest.png";

// Storage keys
const PWA_DISMISSED_KEY = "fortis-pwa-prompt-dismissed-v1";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export function usePwaEngine() {
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    return typeof navigator !== "undefined" ? navigator.onLine : true;
  });
  const [showOnlineToast, setShowOnlineToast] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [showIosModal, setShowIosModal] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Check if running in standalone display mode (already installed)
    const checkStandalone = () => {
      const isStandaloneMode =
        window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
        document.referrer.includes("android-app://");
      setIsStandalone(Boolean(isStandaloneMode));
    };

    checkStandalone();

    // Check if iOS Safari
    const ua = window.navigator.userAgent;
    const isIosDevice = /iPad|iPhone|iPod/.test(ua) && !(window as unknown as { MSStream?: unknown }).MSStream;
    const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|Chrome|Edg/.test(ua);
    setIsIos(Boolean(isIosDevice && isSafari));

    // Check if user previously dismissed banner recently
    const dismissedTimestamp = localStorage.getItem(PWA_DISMISSED_KEY);
    if (dismissedTimestamp) {
      const daysPassed = (Date.now() - Number(dismissedTimestamp)) / (1000 * 60 * 60 * 24);
      if (daysPassed < 5) {
        setIsDismissed(true);
      }
    }

    // Network status listeners
    const handleOnline = () => {
      setIsOnline(true);
      setShowOnlineToast(true);
      const timer = setTimeout(() => setShowOnlineToast(false), 3500);
      return () => clearTimeout(timer);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowOnlineToast(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Capture native PWA install prompt on Chromium / Android / Edge
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    // App installed event
    const handleAppInstalled = () => {
      setIsStandalone(true);
      setDeferredPrompt(null);
    };

    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const triggerInstall = useCallback(async () => {
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice.outcome === "accepted") {
          setIsStandalone(true);
        }
        setDeferredPrompt(null);
      } catch (err) {
        console.warn("PWA install error:", err);
      }
    } else if (isIos) {
      setShowIosModal(true);
    }
  }, [deferredPrompt, isIos]);

  const dismissPrompt = useCallback(() => {
    setIsDismissed(true);
    try {
      localStorage.setItem(PWA_DISMISSED_KEY, String(Date.now()));
    } catch {}
  }, []);

  const canInstall = !isStandalone && (Boolean(deferredPrompt) || isIos);

  return {
    isOnline,
    showOnlineToast,
    isStandalone,
    canInstall,
    isIos,
    showIosModal,
    setShowIosModal,
    isDismissed,
    triggerInstall,
    dismissPrompt,
  };
}

/**
 * Topbar install button shown on supported browsers when app is not yet installed
 */
export function PwaInstallTopbarButton() {
  const { canInstall, triggerInstall } = usePwaEngine();

  if (!canInstall) return null;

  return (
    <button
      type="button"
      className="pwa-topbar-install-btn tap"
      onClick={triggerInstall}
      title="Install FORTIS as a native app on your device"
      aria-label="Install App"
    >
      <Download size={15} />
      <span>Install App</span>
    </button>
  );
}

/**
 * Global offline status banner + floating install prompt
 */
export function PwaOfflineEngine() {
  const {
    isOnline,
    showOnlineToast,
    isStandalone,
    canInstall,
    isDismissed,
    showIosModal,
    setShowIosModal,
    triggerInstall,
    dismissPrompt,
  } = usePwaEngine();

  return (
    <>
      {/* 1. Offline Notification Pill (Active when disconnected) */}
      {!isOnline && (
        <div className="pwa-offline-banner" role="status" aria-live="polite">
          <div className="pwa-offline-content">
            <WifiOff size={16} className="pwa-pulse-icon" />
            <span>
              <strong>Offline Mode</strong> — Viewing cached campus timetable & datesheet
            </span>
          </div>
        </div>
      )}

      {/* 2. Back Online Toast */}
      {showOnlineToast && (
        <div className="pwa-online-banner" role="status">
          <div className="pwa-online-content">
            <Wifi size={16} />
            <span>
              <strong>Back Online</strong> — Timetable updated & synced with server
            </span>
          </div>
        </div>
      )}

      {/* 3. Floating 1-Tap Install Prompt (Shown to mobile/desktop users when not installed) */}
      {canInstall && !isDismissed && !isStandalone && isOnline && (
        <div className="pwa-floating-install-card">
          <div className="pwa-install-icon-wrap">
            <img src={crest} alt="FORTIS Crest" className="pwa-install-crest" />
          </div>
          <div className="pwa-install-copy">
            <div className="pwa-install-title">
              <span>Install FORTIS App</span>
              <span className="pwa-badge-pwa">Offline Ready</span>
            </div>
            <p className="pwa-install-desc">
              Add to your home screen for 1-tap instant access even without campus internet.
            </p>
          </div>
          <div className="pwa-install-actions">
            <button
              type="button"
              className="btn solid tap pwa-btn-install"
              onClick={triggerInstall}
            >
              <Smartphone size={16} />
              <span>Install</span>
            </button>
            <button
              type="button"
              className="icon-btn tap pwa-btn-dismiss"
              onClick={dismissPrompt}
              title="Dismiss for now"
              aria-label="Dismiss install prompt"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* 4. iOS Safari Add to Home Screen Instructions Modal */}
      {showIosModal && (
        <div className="modal-backdrop" onClick={() => setShowIosModal(false)}>
          <div
            className="modal-card pwa-ios-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pwa-ios-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <img src={crest} alt="FORTIS" style={{ width: 28, height: 28, objectFit: "contain" }} />
                <h3 id="pwa-ios-title" style={{ margin: 0, fontSize: "1.1rem", fontWeight: 800 }}>
                  Install FORTIS on iPhone / iPad
                </h3>
              </div>
              <button
                type="button"
                className="icon-btn tap"
                onClick={() => setShowIosModal(false)}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body stack" style={{ gap: "1rem", padding: "1.25rem 1.5rem" }}>
              <p style={{ margin: 0, fontSize: "0.9rem", color: "var(--muted, #64748b)", lineHeight: 1.5 }}>
                Install FORTIS on your home screen for native full-screen experience and zero-internet offline access in basement rooms & labs:
              </p>

              <div className="pwa-ios-step">
                <div className="pwa-ios-step-num">1</div>
                <div className="pwa-ios-step-text">
                  Tap the <strong>Share</strong> button{" "}
                  <span className="pwa-inline-icon">
                    <Share size={15} />
                  </span>{" "}
                  at the bottom of your Safari screen.
                </div>
              </div>

              <div className="pwa-ios-step">
                <div className="pwa-ios-step-num">2</div>
                <div className="pwa-ios-step-text">
                  Scroll down the menu and select{" "}
                  <span className="pwa-inline-icon">
                    <PlusSquare size={15} />
                  </span>{" "}
                  <strong>Add to Home Screen</strong>.
                </div>
              </div>

              <div className="pwa-ios-step">
                <div className="pwa-ios-step-num">3</div>
                <div className="pwa-ios-step-text">
                  Tap <strong>Add</strong> in the top-right corner. FORTIS will appear on your home screen as a full app!
                </div>
              </div>

              <div style={{ background: "color-mix(in srgb, var(--c-accent) 8%, var(--c-canvas))", padding: "0.85rem 1rem", borderRadius: "0.75rem", border: "1px solid color-mix(in srgb, var(--c-accent) 25%, transparent)", display: "flex", alignItems: "center", gap: "0.6rem", fontSize: "0.82rem" }}>
                <Sparkles size={18} color="var(--c-accent)" style={{ flexShrink: 0 }} />
                <span>
                  <strong>Tip:</strong> Once installed, you can launch FORTIS instantly with zero loading delay!
                </span>
              </div>
            </div>

            <div className="modal-footer" style={{ justifyContent: "flex-end", padding: "0.85rem 1.5rem" }}>
              <button
                type="button"
                className="btn solid tap"
                onClick={() => setShowIosModal(false)}
              >
                <CheckCircle2 size={16} />
                <span>Got It!</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
