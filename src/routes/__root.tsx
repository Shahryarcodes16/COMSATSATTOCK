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
      { name: "application-name", content: "CUI Attock" },
      { name: "apple-mobile-web-app-title", content: APP_NAME },
      {
        name: "description",
        content:
          "COMSATS University Islamabad, Attock Campus timetable from 5 October 2026. Free rooms, free faculty, and batch schedules.",
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
      { rel: "manifest", href: "/__grok/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/crest.png" },
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
