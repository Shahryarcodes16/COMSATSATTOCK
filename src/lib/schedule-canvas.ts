import {
  DAYS,
  SLOTS,
  batches,
  rooms,
  subjects,
  teachers,
  type ClassEntry,
} from "@/lib/schedule";
import crestUrl from "@/assets/crest.png";

export type ImageFormat = "wallpaper" | "card";
export type ImageTheme = "navy" | "paper";

export interface CanvasRenderOptions {
  title: string;
  subtitle?: string;
  list: ClassEntry[];
  format: ImageFormat;
  theme: ImageTheme;
}

// Pre-load the crest image
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image from ${src}`));
    img.src = src;
  });
}

// Rounded rectangle helper
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  if (w < 2 * r) r = w / 2;
  if (h < 2 * r) r = h / 2;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * Main function that renders the timetable into the given HTML5 canvas.
 */
export async function renderScheduleToCanvas(
  canvas: HTMLCanvasElement,
  options: CanvasRenderOptions,
): Promise<void> {
  const { title, subtitle, list, format, theme } = options;
  const isWallpaper = format === "wallpaper";

  // Calculate day layouts upfront
  function getDayLayout(count: number) {
    if (count === 0) {
      return { cols: 0, rows: 0, height: 115 };
    }
    if (count <= 4) {
      return { cols: count, rows: 1, height: 245 };
    }
    // count >= 5: wrap into multiple rows
    const cols = count <= 6 ? 3 : 4;
    const rows = Math.ceil(count / cols);
    const rowH = 145;
    const rowGap = 12;
    const height = 76 + rows * rowH + (rows - 1) * rowGap + 20;
    return { cols, rows, height };
  }

  const daysData = [0, 1, 2, 3, 4].map((dayIdx) => {
    const dayClasses = list
      .filter((e) => e.day === dayIdx)
      .sort((a, b) => a.slot - b.slot);
    return {
      dayIdx,
      dayName: DAYS[dayIdx],
      classes: dayClasses,
      layout: getDayLayout(dayClasses.length),
    };
  });

  const startY = 280;
  const headerH = 145;
  const gapAfterHeader = 22;
  const dayGap = 16;
  const footerH = 65;

  let totalDaysH = 0;
  for (let i = 0; i < 5; i++) {
    totalDaysH += daysData[i].layout.height;
    if (i < 4) totalDaysH += dayGap;
  }

  const minWallpaperH = 1920;
  const totalContentH = startY + headerH + gapAfterHeader + totalDaysH + footerH + 30;

  // Canvas dimensions
  const width = isWallpaper ? 1080 : 1240;
  const height = isWallpaper ? Math.max(minWallpaperH, totalContentH) : 880;

  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get 2D context");

  // Load crest
  let crestImg: HTMLImageElement | null = null;
  try {
    crestImg = await loadImage(crestUrl);
  } catch (err) {
    console.warn("Could not load crest image", err);
  }

  // Theme palettes
  const isDark = theme === "navy";
  const bgFill = isDark ? "#09121a" : "#f8fafc";
  const cardFill = isDark ? "#12202c" : "#ffffff";
  const cardBorder = isDark ? "#1d3244" : "#e2e8f0";
  const textPrimary = isDark ? "#f1f5f9" : "#0f172a";
  const textSecondary = isDark ? "#94a3b8" : "#64748b";
  const accentColor = "#087f79";
  const goldColor = "#f59e0b";
  const slotBadgeBg = isDark ? "#1e3a4e" : "#e0f2fe";
  const slotBadgeText = isDark ? "#38bdf8" : "#0369a1";

  // 1. Draw Background
  ctx.fillStyle = bgFill;
  ctx.fillRect(0, 0, width, height);

  // Subtle gradient decoration
  const grad = ctx.createLinearGradient(0, 0, width, height);
  if (isDark) {
    grad.addColorStop(0, "rgba(8, 127, 121, 0.15)");
    grad.addColorStop(0.5, "rgba(15, 23, 42, 0)");
    grad.addColorStop(1, "rgba(245, 158, 11, 0.08)");
  } else {
    grad.addColorStop(0, "rgba(8, 127, 121, 0.06)");
    grad.addColorStop(1, "rgba(241, 245, 249, 0)");
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  // Organize classes by Day (0..4) and Slot (0..4) for grid view
  const cellMap = new Map<string, ClassEntry[]>();
  for (const entry of list) {
    const key = `${entry.day}-${entry.slot}`;
    const cur = cellMap.get(key) || [];
    cur.push(entry);
    cellMap.set(key, cur);
  }

  if (isWallpaper) {
    // -------------------------------------------------------------
    // WALLPAPER LAYOUT (9:16 Portrait, 1080 x 1920 minimum)
    // -------------------------------------------------------------
    let y = startY;

    // Header container
    roundRect(ctx, 40, y, width - 80, headerH, 24);
    ctx.fillStyle = cardFill;
    ctx.fill();
    ctx.strokeStyle = cardBorder;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw crest if available
    if (crestImg) {
      ctx.drawImage(crestImg, 65, y + 22, 100, 100);
    }

    // Title text
    const textStartX = crestImg ? 185 : 70;
    ctx.fillStyle = accentColor;
    ctx.font = "bold 22px system-ui, -apple-system, sans-serif";
    ctx.fillText("COMSATS UNIVERSITY ISLAMABAD · ATTOCK CAMPUS", textStartX, y + 48);

    ctx.fillStyle = textPrimary;
    ctx.font = "bold 40px system-ui, -apple-system, sans-serif";
    ctx.fillText(title, textStartX, y + 92);

    ctx.fillStyle = textSecondary;
    ctx.font = "20px system-ui, -apple-system, sans-serif";
    ctx.fillText(subtitle || "Weekly Class Timetable · 5 Oct 2026", textStartX, y + 124);

    y += headerH + gapAfterHeader;

    // Days (Monday to Friday)
    for (let dayIdx = 0; dayIdx < 5; dayIdx++) {
      const dayData = daysData[dayIdx];
      const { dayName, classes: dayClasses, layout } = dayData;
      const dayCardHeight = layout.height;

      roundRect(ctx, 40, y, width - 80, dayCardHeight, 20);
      ctx.fillStyle = cardFill;
      ctx.fill();
      ctx.strokeStyle = cardBorder;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Day Badge on Left
      roundRect(ctx, 60, y + 18, 110, 42, 12);
      ctx.fillStyle = accentColor;
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 20px system-ui, -apple-system, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(dayName.slice(0, 3).toUpperCase(), 115, y + 46);
      ctx.textAlign = "left";

      // Count indicator
      ctx.fillStyle = textSecondary;
      ctx.font = "17px system-ui, -apple-system, sans-serif";
      ctx.fillText(
        `${dayClasses.length} lecture${dayClasses.length !== 1 ? "s" : ""}`,
        185,
        y + 46,
      );

      // Render day classes
      if (dayClasses.length === 0) {
        ctx.fillStyle = textSecondary;
        ctx.font = "italic 19px system-ui, -apple-system, sans-serif";
        ctx.fillText("No classes scheduled — Free Day", 310, y + 46);
      } else {
        const cols = layout.cols;
        const rowH = 145;
        const gapY = 12;

        let itemW: number;
        let gapX: number;
        if (cols === 1) {
          itemW = 420;
          gapX = 0;
        } else if (cols === 2) {
          gapX = 20;
          itemW = Math.floor((960 - gapX) / 2);
        } else if (cols === 3) {
          gapX = 16;
          itemW = Math.floor((960 - 2 * gapX) / 3);
        } else {
          // cols === 4
          gapX = 14;
          itemW = Math.floor((960 - 3 * gapX) / 4);
        }

        // Render ALL classes without truncation or +1 more
        for (let i = 0; i < dayClasses.length; i++) {
          const entry = dayClasses[i];
          const colIdx = i % cols;
          const rowIdx = Math.floor(i / cols);

          const itemX = 60 + colIdx * (itemW + gapX);
          const itemY = y + 78 + rowIdx * (rowH + gapY);

          const subName = subjects[entry.subject] || "Subject";
          const roomName = entry.room >= 0 ? rooms[entry.room] : "Room TBA";
          const teacherName = entry.teacher >= 0 ? teachers[entry.teacher] : "";

          roundRect(ctx, itemX, itemY, itemW, rowH, 14);
          ctx.fillStyle = isDark ? "#172b3c" : "#f1f5f9";
          ctx.fill();
          ctx.strokeStyle = cardBorder;
          ctx.lineWidth = 1;
          ctx.stroke();

          // 1. Slot badge
          const badgeW = cols === 4 ? 36 : 46;
          const badgeH = 22;
          roundRect(ctx, itemX + 10, itemY + 12, badgeW, badgeH, 6);
          ctx.fillStyle = slotBadgeBg;
          ctx.fill();

          ctx.fillStyle = slotBadgeText;
          ctx.font =
            cols === 4
              ? "bold 12px system-ui, -apple-system, sans-serif"
              : "bold 13px system-ui, -apple-system, sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(
            SLOTS[entry.slot]?.label || `L${entry.slot + 1}`,
            itemX + 10 + badgeW / 2,
            itemY + 27,
          );
          ctx.textAlign = "left";

          // 2. Time
          ctx.fillStyle = textSecondary;
          ctx.font =
            cols === 4
              ? "11.5px system-ui, -apple-system, sans-serif"
              : "13px system-ui, -apple-system, sans-serif";
          const slotDef = SLOTS[entry.slot];
          const timeStr = slotDef ? `${slotDef.start} – ${slotDef.end}` : "";
          ctx.fillText(timeStr, itemX + 10 + badgeW + 8, itemY + 27);

          // Make-up indicator if applicable
          if (entry.isMakeup) {
            const extraW = 50;
            roundRect(ctx, itemX + itemW - extraW - 8, itemY + 12, extraW, 20, 5);
            ctx.fillStyle = "rgba(245, 158, 11, 0.18)";
            ctx.fill();
            ctx.fillStyle = goldColor;
            ctx.font = "bold 10px system-ui, -apple-system, sans-serif";
            ctx.textAlign = "center";
            ctx.fillText("⭐ Extra", itemX + itemW - extraW / 2 - 8, itemY + 26);
            ctx.textAlign = "left";
          }

          // 3. Subject Name
          ctx.fillStyle = textPrimary;
          ctx.font =
            cols === 4
              ? "bold 13.5px system-ui, -apple-system, sans-serif"
              : "bold 16px system-ui, -apple-system, sans-serif";
          const maxChar = cols === 4 ? 22 : cols === 3 ? 24 : cols === 2 ? 34 : 32;
          const displaySub =
            subName.length > maxChar ? subName.slice(0, maxChar - 1) + "…" : subName;
          ctx.fillText(displaySub, itemX + 10, itemY + 62);

          // 4. Room tag
          ctx.fillStyle = accentColor;
          ctx.font =
            cols === 4
              ? "bold 12px system-ui, -apple-system, sans-serif"
              : "bold 13px system-ui, -apple-system, sans-serif";
          const maxRoomLen = cols === 4 ? 18 : 24;
          const displayRoom =
            roomName.length > maxRoomLen ? roomName.slice(0, maxRoomLen - 1) + "…" : roomName;
          ctx.fillText(`📍 ${displayRoom}`, itemX + 10, itemY + 92);

          // 5. Full Teacher Name
          if (teacherName) {
            ctx.fillStyle = textSecondary;
            ctx.font =
              cols === 4
                ? "11.5px system-ui, -apple-system, sans-serif"
                : "13px system-ui, -apple-system, sans-serif";
            const maxTeacherLen = cols === 4 ? 20 : cols === 3 ? 24 : 30;
            const displayTeacher =
              teacherName.length > maxTeacherLen
                ? teacherName.slice(0, maxTeacherLen - 1) + "…"
                : teacherName;
            ctx.fillText(`👤 ${displayTeacher}`, itemX + 10, itemY + 120);
          }
        }
      }

      y += dayCardHeight + dayGap;
    }

    // Footer Watermark
    ctx.textAlign = "center";
    ctx.fillStyle = textSecondary;
    ctx.font = "18px system-ui, -apple-system, sans-serif";
    ctx.fillText(
      "Generated with CUI Attock Campus Timetable · Developer: Shahryar",
      width / 2,
      height - 45,
    );
    ctx.textAlign = "left";
  } else {
    // -------------------------------------------------------------
    // WHATSAPP / SOCIAL CARD LAYOUT (1240 x 880 Landscape)
    // -------------------------------------------------------------
    // Top Bar Header
    let y = 30;

    roundRect(ctx, 35, y, width - 70, 100, 18);
    ctx.fillStyle = cardFill;
    ctx.fill();
    ctx.strokeStyle = cardBorder;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    if (crestImg) {
      ctx.drawImage(crestImg, 55, y + 15, 70, 70);
    }

    const hx = crestImg ? 145 : 60;
    ctx.fillStyle = accentColor;
    ctx.font = "bold 16px system-ui, -apple-system, sans-serif";
    ctx.fillText("COMSATS UNIVERSITY ISLAMABAD · ATTOCK CAMPUS", hx, y + 36);

    ctx.fillStyle = textPrimary;
    ctx.font = "bold 32px system-ui, -apple-system, sans-serif";
    ctx.fillText(title, hx, y + 74);

    ctx.fillStyle = textSecondary;
    ctx.font = "15px system-ui, -apple-system, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(subtitle || "Timetable from 5 Oct 2026", width - 60, y + 42);
    ctx.fillText("Created with CUI Attock App", width - 60, y + 72);
    ctx.textAlign = "left";

    // Grid Layout (5 columns for Mon..Fri, 5 rows for Slots)
    const gridX = 35;
    const gridY = 150;
    const gridW = width - 70;
    const colHeaderH = 42;
    const rowHeaderW = 90;

    const slotCols = 5;
    const colW = (gridW - rowHeaderW) / slotCols;
    const rowH = 125;

    // Draw Column Headers (Monday to Friday)
    for (let c = 0; c < 5; c++) {
      const cx = gridX + rowHeaderW + c * colW;
      roundRect(ctx, cx + 4, gridY, colW - 8, colHeaderH, 10);
      ctx.fillStyle = accentColor;
      ctx.fill();

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 17px system-ui, -apple-system, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(DAYS[c], cx + colW / 2, gridY + 27);
      ctx.textAlign = "left";
    }

    // Draw Slots and Cells
    for (let s = 0; s < 5; s++) {
      const ry = gridY + colHeaderH + 8 + s * (rowH + 8);

      // Slot Row Header (L1, L2, etc.)
      roundRect(ctx, gridX, ry, rowHeaderW - 10, rowH, 12);
      ctx.fillStyle = cardFill;
      ctx.fill();
      ctx.strokeStyle = cardBorder;
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = slotBadgeText;
      ctx.font = "bold 18px system-ui, -apple-system, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(SLOTS[s].label, gridX + (rowHeaderW - 10) / 2, ry + 40);

      ctx.fillStyle = textSecondary;
      ctx.font = "12px system-ui, -apple-system, sans-serif";
      ctx.fillText(SLOTS[s].start, gridX + (rowHeaderW - 10) / 2, ry + 68);
      ctx.fillText(SLOTS[s].end, gridX + (rowHeaderW - 10) / 2, ry + 88);
      ctx.textAlign = "left";

      // Day Columns for this slot
      for (let d = 0; d < 5; d++) {
        const cx = gridX + rowHeaderW + d * colW;
        const cellItems = cellMap.get(`${d}-${s}`) || [];

        roundRect(ctx, cx + 4, ry, colW - 8, rowH, 12);
        ctx.fillStyle = cardFill;
        ctx.fill();
        ctx.strokeStyle = cardBorder;
        ctx.lineWidth = 1;
        ctx.stroke();

        if (cellItems.length > 0) {
          const entry = cellItems[0];
          const subName = subjects[entry.subject] || "";
          const roomName = entry.room >= 0 ? rooms[entry.room] : "";
          const teacherName = entry.teacher >= 0 ? teachers[entry.teacher] : "";

          // Accent strip on left of cell
          roundRect(ctx, cx + 4, ry, 6, rowH, 3);
          ctx.fillStyle = accentColor;
          ctx.fill();

          // Subject text
          ctx.fillStyle = textPrimary;
          ctx.font = "bold 14px system-ui, -apple-system, sans-serif";
          const maxLen = 20;
          const displaySub = subName.length > maxLen ? subName.slice(0, maxLen) + "…" : subName;
          ctx.fillText(displaySub, cx + 18, ry + 28);

          if (cellItems.length > 1) {
            roundRect(ctx, cx + colW - 55, ry + 12, 45, 18, 4);
            ctx.fillStyle = "rgba(245, 158, 11, 0.2)";
            ctx.fill();
            ctx.fillStyle = goldColor;
            ctx.font = "bold 10px system-ui, -apple-system, sans-serif";
            ctx.textAlign = "center";
            ctx.fillText(`+${cellItems.length - 1} more`, cx + colW - 32, ry + 25);
            ctx.textAlign = "left";
          }

          // Room tag
          if (roomName) {
            roundRect(ctx, cx + 18, ry + 38, 85, 22, 6);
            ctx.fillStyle = isDark ? "#1e3a4e" : "#e0f2fe";
            ctx.fill();
            ctx.fillStyle = accentColor;
            ctx.font = "bold 11px system-ui, -apple-system, sans-serif";
            ctx.fillText(roomName, cx + 25, ry + 53);
          }

          // Full Teacher Name
          if (teacherName) {
            ctx.fillStyle = textSecondary;
            ctx.font = "12px system-ui, -apple-system, sans-serif";
            const maxTeacherLen = 25;
            const displayTeacher =
              teacherName.length > maxTeacherLen
                ? teacherName.slice(0, maxTeacherLen - 1) + "…"
                : teacherName;
            ctx.fillText(`👤 ${displayTeacher}`, cx + 18, ry + 88);
          }
        } else {
          // Free slot
          ctx.fillStyle = isDark ? "#334155" : "#cbd5e1";
          ctx.font = "13px system-ui, -apple-system, sans-serif";
          ctx.textAlign = "center";
          ctx.fillText("—", cx + colW / 2, ry + rowH / 2 + 4);
          ctx.textAlign = "left";
        }
      }
    }

    // Footer Watermark
    ctx.fillStyle = textSecondary;
    ctx.font = "13px system-ui, -apple-system, sans-serif";
    ctx.fillText("Official Timetable · COMSATS Attock Campus · CUI Attock App", gridX + 10, height - 15);
  }
}

/**
 * Download the canvas as a PNG image file
 */
export function downloadCanvasImage(canvas: HTMLCanvasElement, filename: string): void {
  const link = document.createElement("a");
  link.download = `${filename}.png`;
  link.href = canvas.toDataURL("image/png");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Share the canvas image via Web Share API if supported
 */
export async function shareCanvasImage(
  canvas: HTMLCanvasElement,
  title: string,
): Promise<boolean> {
  if (!navigator.share || !navigator.canShare) {
    return false;
  }

  try {
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/png"),
    );
    if (!blob) return false;

    const file = new File([blob], `${title.replace(/\s+/g, "_")}_schedule.png`, {
      type: "image/png",
    });

    if (navigator.canShare({ files: [file] })) {
      await navigator.share({
        title: `${title} Timetable`,
        text: `Check out the timetable for ${title} on COMSATS Attock Timetable!`,
        files: [file],
      });
      return true;
    }
  } catch (err) {
    // User cancelled or share failed
    console.warn("Share cancelled or failed", err);
  }
  return false;
}
