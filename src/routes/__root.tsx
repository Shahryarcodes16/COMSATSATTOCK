import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth/provider";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import appCss from "../styles.css?url";
import { APP_NAME } from "@/lib/campus";

const THEME_BOOT = `try{var p=JSON.parse(localStorage.getItem("cui-attock-desk-v1")||"{}");if(p.theme==="ink"||p.theme==="midnight")document.documentElement.dataset.theme=p.theme;}catch(e){}`;
const PRELOAD_RECOVERY = `window.addEventListener("vite:preloadError",function(e){try{var t=Number(sessionStorage.getItem("cui_chunk_reload_ts")||"0");if(Date.now()-t>15000){sessionStorage.setItem("cui_chunk_reload_ts",String(Date.now()));e.preventDefault();window.location.reload();}}catch(err){}});`;

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: APP_NAME },
      { name: "application-name", content: "FORTIS" },
      { name: "apple-mobile-web-app-title", content: "FORTIS" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "mobile-web-app-capable", content: "yes" },
      {
        name: "description",
        content:
          "FORTIS: Faculty directory, Office hours, Room radar, Timetable, Instant alerts, Schedule of exams for COMSATS University Islamabad, Attock Campus.",
      },
      { name: "theme-color", content: "#087f79" },
    ],
    links: [
      { rel: "icon", type: "image/png", href: "/crest.png" },
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap",
      },
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
      { rel: "apple-touch-icon", sizes: "180x180", href: "/apple-touch-icon.png" },
      { rel: "apple-touch-icon", sizes: "192x192", href: "/pwa-192x192.png" },
      { rel: "apple-touch-icon", sizes: "512x512", href: "/pwa-512x512.png" },
    ],
    scripts: [{ children: THEME_BOOT }, { children: PRELOAD_RECOVERY }],
  }),
  component: () => (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <PreviewHostBridge />
        <AuthProvider>
          <Outlet />
        </AuthProvider>
        <Scripts />
      </body>
    </html>
  ),
});
