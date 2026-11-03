import { type ExamEntry } from "@/lib/datesheet";
import crestUrl from "@/assets/crest.png";

export type DatesheetImageFormat = "wallpaper" | "card";
export type DatesheetImageTheme = "navy" | "paper";

export interface DatesheetCanvasOptions {
  className: string;
  exams: ExamEntry[];
  format: DatesheetImageFormat;
  theme: DatesheetImageTheme;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image from ${src}`));
    img.src = src;
  });
}

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
 * Formats time string "1010-1140" -> "10:10 AM – 11:40 AM"
 */
function formatExamTime(raw: string): string {
  if (!raw || !raw.includes("-")) return raw;
  const [start, end] = raw.split("-");
  const sH = parseInt(start.slice(0, 2), 10);
  const sM = start.slice(2, 4);
  const eH = parseInt(end.slice(0, 2), 10);
  const eM = end.slice(2, 4);

  const formatPart = (h: number, m: string) => {
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 || 12;
    return `${h12}:${m} ${ampm}`;
  };

  return `${formatPart(sH, sM)} – ${formatPart(eH, eM)}`;
}

/**
 * Formats "2026-11-12" -> "Thu, 12 Nov 2026"
 */
function formatExamDate(dateStr: string): string {
  try {
    const parts = dateStr.split("-").map(Number);
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    return d.toLocaleDateString("en-US", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

export async function renderDatesheetToCanvas(
  canvas: HTMLCanvasElement,
  options: DatesheetCanvasOptions,
): Promise<void> {
  const { className, exams, format, theme } = options;
  const isWallpaper = format === "wallpaper";

  // Dynamic height based on exam count for card format
  const width = isWallpaper ? 1080 : 1240;
  const minCardHeight = 880;
  const computedCardHeight = Math.max(minCardHeight, 260 + exams.length * 95);
  const height = isWallpaper ? 1920 : computedCardHeight;

  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get 2D context");

  let crestImg: HTMLImageElement | null = null;
  try {
    crestImg = await loadImage(crestUrl);
  } catch (err) {
    console.warn("Could not load crest image", err);
  }

  const isDark = theme === "navy";
  const bgFill = isDark ? "#09121a" : "#f8fafc";
  const cardFill = isDark ? "#12202c" : "#ffffff";
  const cardBorder = isDark ? "#1d3244" : "#e2e8f0";
  const textPrimary = isDark ? "#f1f5f9" : "#0f172a";
  const textSecondary = isDark ? "#94a3b8" : "#64748b";
  const accentColor = "#087f79";
  const goldColor = "#f59e0b";
  const purpleColor = "#8b5cf6";

  // 1. Draw Background
  ctx.fillStyle = bgFill;
  ctx.fillRect(0, 0, width, height);

  // Gradient accents
  const grad = ctx.createLinearGradient(0, 0, width, height);
  if (isDark) {
    grad.addColorStop(0, "rgba(8, 127, 121, 0.18)");
    grad.addColorStop(0.5, "rgba(15, 23, 42, 0)");
    grad.addColorStop(1, "rgba(245, 158, 11, 0.1)");
  } else {
    grad.addColorStop(0, "rgba(8, 127, 121, 0.08)");
    grad.addColorStop(1, "rgba(241, 245, 249, 0)");
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  if (isWallpaper) {
    // -------------------------------------------------------------
    // WALLPAPER LAYOUT (1080 x 1920)
    // -------------------------------------------------------------
    // Top 360px clean for phone lock screen clock
    let y = 370;

    // Header container
    roundRect(ctx, 40, y, width - 80, 155, 24);
    ctx.fillStyle = cardFill;
    ctx.fill();
    ctx.strokeStyle = cardBorder;
    ctx.lineWidth = 2;
    ctx.stroke();

    if (crestImg) {
      ctx.drawImage(crestImg, 65, y + 25, 105, 105);
    }

    const textStartX = crestImg ? 190 : 70;
    ctx.fillStyle = accentColor;
    ctx.font = "bold 20px system-ui, -apple-system, sans-serif";
    ctx.fillText("COMSATS UNIVERSITY ISLAMABAD · ATTOCK CAMPUS", textStartX, y + 48);

    ctx.fillStyle = textPrimary;
    ctx.font = "bold 38px system-ui, -apple-system, sans-serif";
    ctx.fillText(`${className} — Midterm Date Sheet`, textStartX, y + 92);

    ctx.fillStyle = textSecondary;
    ctx.font = "18px system-ui, -apple-system, sans-serif";
    ctx.fillText(`FA26 Exams (Nov 5 – 12) · ${exams.length} Papers Scheduled`, textStartX, y + 128);

    y += 180;

    // Notice pill for shifted papers
    roundRect(ctx, 40, y, width - 80, 48, 14);
    ctx.fillStyle = isDark ? "#291b07" : "#fef3c7";
    ctx.fill();
    ctx.strokeStyle = goldColor;
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = isDark ? "#fbbf24" : "#b45309";
    ctx.font = "bold 17px system-ui, -apple-system, sans-serif";
    ctx.fillText("ℹ️ Notice: Papers originally on 4 Nov are shifted to 12 Nov (same time & room)", 60, y + 30);

    y += 68;

    // List of exam cards
    const maxExamsToShow = Math.min(exams.length, 7);
    const itemH = 150;
    const gap = 16;

    for (let i = 0; i < maxExamsToShow; i++) {
      const exam = exams[i];
      const isShifted = exam.isRescheduled || exam.date === "2026-11-12";
      const isRepeater = exam.className !== className;

      roundRect(ctx, 40, y, width - 80, itemH, 20);
      ctx.fillStyle = cardFill;
      ctx.fill();
      ctx.strokeStyle = isShifted ? goldColor : cardBorder;
      ctx.lineWidth = isShifted ? 2 : 1.5;
      ctx.stroke();

      // Left Date Column Block
      roundRect(ctx, 58, y + 20, 160, 110, 14);
      ctx.fillStyle = isShifted ? (isDark ? "#2a1e05" : "#fef3c7") : (isDark ? "#162e3d" : "#e6f4f2");
      ctx.fill();

      ctx.fillStyle = isShifted ? goldColor : accentColor;
      ctx.font = "bold 15px system-ui, -apple-system, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(formatExamDate(exam.date).split(",")[0].toUpperCase(), 138, y + 46);

      ctx.fillStyle = textPrimary;
      ctx.font = "bold 32px system-ui, -apple-system, sans-serif";
      ctx.fillText(exam.date.split("-")[2], 138, y + 84);

      ctx.fillStyle = textSecondary;
      ctx.font = "bold 15px system-ui, -apple-system, sans-serif";
      ctx.fillText("NOV 2026", 138, y + 110);
      ctx.textAlign = "left";

      // Course details
      const cX = 240;
      ctx.fillStyle = accentColor;
      ctx.font = "bold 18px system-ui, -apple-system, sans-serif";
      ctx.fillText(exam.courseCode, cX, y + 44);

      if (isShifted) {
        roundRect(ctx, cX + 110, y + 26, 170, 26, 8);
        ctx.fillStyle = goldColor;
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 13px system-ui, -apple-system, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("Shifted from 4 Nov", cX + 195, y + 44);
        ctx.textAlign = "left";
      }

      if (isRepeater) {
        const offX = isShifted ? cX + 295 : cX + 110;
        roundRect(ctx, offX, y + 26, 150, 26, 8);
        ctx.fillStyle = purpleColor;
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 13px system-ui, -apple-system, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(`Repeat (${exam.className})`, offX + 75, y + 44);
        ctx.textAlign = "left";
      }

      // Title
      ctx.fillStyle = textPrimary;
      ctx.font = "bold 26px system-ui, -apple-system, sans-serif";
      let displayTitle = exam.courseTitle;
      if (displayTitle.length > 36) {
        displayTitle = displayTitle.slice(0, 34) + "…";
      }
      ctx.fillText(displayTitle, cX, y + 82);

      // Meta: Time and Room
      ctx.fillStyle = textSecondary;
      ctx.font = "18px system-ui, -apple-system, sans-serif";
      ctx.fillText(`⏰ ${formatExamTime(exam.rawTime)}`, cX, y + 118);

      // Room highlight pill on right
      const roomStr = `📍 Room: ${exam.room}`;
      ctx.font = "bold 20px system-ui, -apple-system, sans-serif";
      const roomW = ctx.measureText(roomStr).width + 36;
      const roomX = width - 60 - roomW;

      roundRect(ctx, roomX, y + 80, roomW, 46, 12);
      ctx.fillStyle = isDark ? "#173f40" : "#d1fae5";
      ctx.fill();
      ctx.strokeStyle = accentColor;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = isDark ? "#76d6cd" : "#047857";
      ctx.fillText(roomStr, roomX + 18, y + 110);

      y += itemH + gap;
    }

    // Footer
    y = height - 90;
    ctx.fillStyle = textSecondary;
    ctx.font = "16px system-ui, -apple-system, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Generated from CUI Attock Timetable · Official Midterm Schedule FA26", width / 2, y);
    ctx.fillText("Best of luck with your examinations!", width / 2, y + 26);
    ctx.textAlign = "left";
  } else {
    // -------------------------------------------------------------
    // CARD / EXAM SLIP LAYOUT (Landscape 1240 width)
    // -------------------------------------------------------------
    let y = 40;

    // Header container
    roundRect(ctx, 40, y, width - 80, 160, 20);
    ctx.fillStyle = cardFill;
    ctx.fill();
    ctx.strokeStyle = cardBorder;
    ctx.lineWidth = 2;
    ctx.stroke();

    if (crestImg) {
      ctx.drawImage(crestImg, 65, y + 22, 115, 115);
    }

    const textStartX = crestImg ? 205 : 70;
    ctx.fillStyle = accentColor;
    ctx.font = "bold 22px system-ui, -apple-system, sans-serif";
    ctx.fillText("COMSATS UNIVERSITY ISLAMABAD · ATTOCK CAMPUS", textStartX, y + 48);

    ctx.fillStyle = textPrimary;
    ctx.font = "bold 38px system-ui, -apple-system, sans-serif";
    ctx.fillText(`Midterm Examination Slip — ${className}`, textStartX, y + 94);

    ctx.fillStyle = textSecondary;
    ctx.font = "19px system-ui, -apple-system, sans-serif";
    ctx.fillText(`Fall 2026 Midterms · ${exams.length} Exam${exams.length === 1 ? "" : "s"} · Shifted 4 Nov ➔ 12 Nov applied`, textStartX, y + 132);

    y += 185;

    // Table Header Row
    const rowH = 46;
    roundRect(ctx, 40, y, width - 80, rowH, 12);
    ctx.fillStyle = accentColor;
    ctx.fill();

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 16px system-ui, -apple-system, sans-serif";
    ctx.fillText("DATE", 65, y + 29);
    ctx.fillText("TIME", 240, y + 29);
    ctx.fillText("COURSE CODE & TITLE", 430, y + 29);
    ctx.fillText("ROOM / HALL", 880, y + 29);
    ctx.fillText("INSTRUCTOR", 1040, y + 29);

    y += rowH + 8;

    // Exam rows
    const examRowH = 82;
    for (let i = 0; i < exams.length; i++) {
      const exam = exams[i];
      const isShifted = exam.isRescheduled || exam.date === "2026-11-12";
      const isRepeater = exam.className !== className;

      roundRect(ctx, 40, y, width - 80, examRowH, 14);
      ctx.fillStyle = i % 2 === 0 ? cardFill : (isDark ? "#101d28" : "#f1f5f9");
      ctx.fill();
      ctx.strokeStyle = isShifted ? goldColor : cardBorder;
      ctx.lineWidth = isShifted ? 1.5 : 1;
      ctx.stroke();

      // Date
      ctx.fillStyle = textPrimary;
      ctx.font = "bold 18px system-ui, -apple-system, sans-serif";
      ctx.fillText(formatExamDate(exam.date), 65, y + 36);

      if (isShifted) {
        ctx.fillStyle = goldColor;
        ctx.font = "bold 13px system-ui, -apple-system, sans-serif";
        ctx.fillText("⚡ Shifted (from 4 Nov)", 65, y + 60);
      } else {
        ctx.fillStyle = textSecondary;
        ctx.font = "14px system-ui, -apple-system, sans-serif";
        ctx.fillText("Regular Schedule", 65, y + 60);
      }

      // Time
      ctx.fillStyle = textPrimary;
      ctx.font = "bold 17px system-ui, -apple-system, sans-serif";
      ctx.fillText(formatExamTime(exam.rawTime), 240, y + 38);

      ctx.fillStyle = textSecondary;
      ctx.font = "14px system-ui, -apple-system, sans-serif";
      ctx.fillText(exam.rawTime, 240, y + 60);

      // Course Code & Title
      ctx.fillStyle = accentColor;
      ctx.font = "bold 16px system-ui, -apple-system, sans-serif";
      ctx.fillText(exam.courseCode, 430, y + 34);

      if (isRepeater) {
        ctx.fillStyle = purpleColor;
        ctx.font = "bold 13px system-ui, -apple-system, sans-serif";
        ctx.fillText(`[Repeat: ${exam.className}]`, 520, y + 34);
      }

      ctx.fillStyle = textPrimary;
      ctx.font = "bold 19px system-ui, -apple-system, sans-serif";
      let shortTitle = exam.courseTitle;
      if (shortTitle.length > 36) shortTitle = shortTitle.slice(0, 34) + "…";
      ctx.fillText(shortTitle, 430, y + 62);

      // Hall / Room
      roundRect(ctx, 875, y + 18, 130, 46, 10);
      ctx.fillStyle = isDark ? "#173f40" : "#d1fae5";
      ctx.fill();
      ctx.strokeStyle = accentColor;
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = isDark ? "#76d6cd" : "#047857";
      ctx.font = "bold 19px system-ui, -apple-system, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(exam.room, 875 + 65, y + 47);
      ctx.textAlign = "left";

      // Instructor
      ctx.fillStyle = textSecondary;
      ctx.font = "15px system-ui, -apple-system, sans-serif";
      let instr = exam.instructor || "Faculty";
      if (instr.length > 18) instr = instr.slice(0, 16) + "…";
      ctx.fillText(instr, 1040, y + 46);

      y += examRowH + 8;
    }

    // Footer
    y += 15;
    ctx.fillStyle = textSecondary;
    ctx.font = "15px system-ui, -apple-system, sans-serif";
    ctx.fillText("COMSATS University Islamabad, Attock Campus · Official Midterm Date Sheet FA26", 45, y);
    ctx.textAlign = "right";
    ctx.fillText("Good Luck for your Exams!", width - 45, y);
    ctx.textAlign = "left";
  }
}

export function downloadCanvasImage(
  canvas: HTMLCanvasElement,
  filename: string,
): void {
  const link = document.createElement("a");
  link.download = filename;
  link.href = canvas.toDataURL("image/png");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export async function shareCanvasImage(
  canvas: HTMLCanvasElement,
  title: string,
): Promise<boolean> {
  if (!navigator.share) return false;
  return new Promise((resolve) => {
    canvas.toBlob(async (blob) => {
      if (!blob) {
        resolve(false);
        return;
      }
      const file = new File([blob], "cui-midterm-datesheet.png", { type: "image/png" });
      try {
        await navigator.share({
          title,
          text: `My COMSATS Attock Midterm Examination Date Sheet (FA26)`,
          files: [file],
        });
        resolve(true);
      } catch (err) {
        console.warn("Share cancelled or failed", err);
        resolve(false);
      }
    });
  });
}
