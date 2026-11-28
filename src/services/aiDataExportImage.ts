import type {
  DailyExportPayload,
  ExportDietSection,
  ExportMealGroup,
  ExportWorkoutSection,
  ExportBodySection,
} from './aiDataExport';
import type { TFunction } from 'i18next';
import i18n from '@/i18n/config';
import { evaluateNutritionalHighlight } from '../utils/nutritionEvaluation';
import { generateQrMatrix } from '@/utils/qrCode';
import {
  MALE_OUTLINE_FRONT,
  MALE_OUTLINE_BACK,
  BODY_FRONT_PARTS,
  BODY_BACK_PARTS,
} from '../components/workout/bodyModelData';
import {
  getDetailedMusclesForSlug,
  type BodyPartSlug,
} from '../utils/muscleHighlight';

export interface GenerateExportImageOptions {
  theme?: 'dark' | 'light';
  dpr?: number;
  width?: number;
  t?: TFunction;
}

export interface ImagePalette {
  canvasBg: string;
  cardBg: string;
  cardHeaderBg: string;
  cardSubtleBg: string;
  border: string;
  divider: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  pillBg: string;
  pillText: string;
  pillSubtleBg: string;
  pillSubtleBorder: string;
  calories: string;
  caloriesBg: string;
  caloriesBorder: string;
  caloriesText: string;
  calorieLowBg: string;
  calorieLowBorder: string;
  calorieLowText: string;
  carbs: string;
  carbsBg: string;
  carbsBorder: string;
  carbsSubtle: string;
  protein: string;
  proteinBg: string;
  proteinBorder: string;
  proteinSubtle: string;
  fat: string;
  fatBg: string;
  fatBorder: string;
  fatSubtle: string;
  macroNeutralBg: string;
  macroNeutralBorder: string;
  macroNeutralLabel: string;
  trackBg: string;
  progressBar: string;
  muscleBaseFill: string;
  muscleBaseStroke: string;
  muscleOutline: string;
  muscleHighlightFill: string;
  muscleHighlightStroke: string;
  muscleRecoveringPillBg: string;
  muscleRecoveringPillBorder: string;
  muscleRecoveringPillText: string;
}

export const LIGHT_PALETTE: ImagePalette = {
  canvasBg: '#ffffff',
  cardBg: '#ffffff',
  cardHeaderBg: 'rgba(0, 0, 0, 0.025)',
  cardSubtleBg: '#fafafa',
  border: '#eaeaea',
  divider: '#eaeaea',
  textPrimary: '#09090b',
  textSecondary: '#666666',
  textTertiary: '#a1a1aa',
  pillBg: '#09090b',
  pillText: '#ffffff',
  pillSubtleBg: 'rgba(0, 0, 0, 0.03)',
  pillSubtleBorder: 'rgba(0, 0, 0, 0.12)',
  calories: '#e11d48',
  caloriesBg: 'rgba(225, 29, 72, 0.06)',
  caloriesBorder: 'rgba(225, 29, 72, 0.16)',
  caloriesText: '#e11d48',
  calorieLowBg: 'rgba(16, 185, 129, 0.06)',
  calorieLowBorder: 'rgba(16, 185, 129, 0.16)',
  calorieLowText: '#059669',
  carbs: '#d97706',
  carbsBg: 'rgba(217, 119, 6, 0.035)',
  carbsBorder: 'rgba(217, 119, 6, 0.20)',
  carbsSubtle: 'rgba(217, 119, 6, 0.15)',
  protein: '#0284c7',
  proteinBg: 'rgba(2, 132, 199, 0.035)',
  proteinBorder: 'rgba(2, 132, 199, 0.20)',
  proteinSubtle: 'rgba(2, 132, 199, 0.15)',
  fat: '#7c3aed',
  fatBg: 'rgba(124, 58, 237, 0.035)',
  fatBorder: 'rgba(124, 58, 237, 0.20)',
  fatSubtle: 'rgba(124, 58, 237, 0.15)',
  macroNeutralBg: 'rgba(0, 0, 0, 0.02)',
  macroNeutralBorder: '#eaeaea',
  macroNeutralLabel: '#888888',
  trackBg: '#e4e4e7',
  progressBar: '#09090b',
  muscleBaseFill: '#e4e4e7',
  muscleBaseStroke: '#d4d4d8',
  muscleOutline: 'rgba(0, 0, 0, 0.40)',
  muscleHighlightFill: '#f87171',
  muscleHighlightStroke: '#ef4444',
  muscleRecoveringPillBg: 'rgba(239, 68, 68, 0.08)',
  muscleRecoveringPillBorder: 'rgba(239, 68, 68, 0.35)',
  muscleRecoveringPillText: '#e11d48',
};

export const DARK_PALETTE: ImagePalette = {
  canvasBg: '#000000',
  cardBg: '#000000',
  cardHeaderBg: 'rgba(255, 255, 255, 0.03)',
  cardSubtleBg: '#111111',
  border: '#333333',
  divider: '#222222',
  textPrimary: '#ffffff',
  textSecondary: '#a0a0a0',
  textTertiary: '#71717a',
  pillBg: '#ffffff',
  pillText: '#09090b',
  pillSubtleBg: 'rgba(255, 255, 255, 0.04)',
  pillSubtleBorder: 'rgba(255, 255, 255, 0.15)',
  calories: '#f43f5e',
  caloriesBg: 'rgba(244, 63, 94, 0.12)',
  caloriesBorder: 'rgba(244, 63, 94, 0.24)',
  caloriesText: '#f43f5e',
  calorieLowBg: 'rgba(52, 211, 153, 0.12)',
  calorieLowBorder: 'rgba(52, 211, 153, 0.24)',
  calorieLowText: '#34d399',
  carbs: '#f59e0b',
  carbsBg: 'rgba(245, 158, 11, 0.05)',
  carbsBorder: 'rgba(245, 158, 11, 0.20)',
  carbsSubtle: 'rgba(245, 158, 11, 0.18)',
  protein: '#38bdf8',
  proteinBg: 'rgba(56, 189, 248, 0.05)',
  proteinBorder: 'rgba(56, 189, 248, 0.20)',
  proteinSubtle: 'rgba(56, 189, 248, 0.18)',
  fat: '#a78bfa',
  fatBg: 'rgba(167, 139, 250, 0.05)',
  fatBorder: 'rgba(167, 139, 250, 0.20)',
  fatSubtle: 'rgba(167, 139, 250, 0.18)',
  macroNeutralBg: 'rgba(255, 255, 255, 0.03)',
  macroNeutralBorder: '#333333',
  macroNeutralLabel: '#71717a',
  trackBg: '#27272a',
  progressBar: '#ffffff',
  muscleBaseFill: '#27272a',
  muscleBaseStroke: '#3f3f46',
  muscleOutline: 'rgba(255, 255, 255, 0.40)',
  muscleHighlightFill: '#ef4444',
  muscleHighlightStroke: '#f87171',
  muscleRecoveringPillBg: 'rgba(239, 68, 68, 0.16)',
  muscleRecoveringPillBorder: 'rgba(239, 68, 68, 0.45)',
  muscleRecoveringPillText: '#fb7185',
};

const BRAND_FONT =
  '"Geist Variable", Geist, "Inter Variable", Inter, -apple-system, BlinkMacSystemFont, sans-serif';
const SANS_FONT =
  'Inter Variable, Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "PingFang TC", "Microsoft YaHei", sans-serif';
const MONO_FONT =
  'JetBrains Mono Variable, JetBrains Mono, "Roboto Mono", SFMono-Regular, Menlo, Monaco, Consolas, monospace';

function parseAmount(amountStr?: string): { servingSize: number; servingUnit: string } {
  if (!amountStr) return { servingSize: 100, servingUnit: 'g' };
  const match = amountStr.match(/^([\d.]+)\s*([a-zA-Z]+)?/);
  if (!match) return { servingSize: 100, servingUnit: 'g' };
  const size = parseFloat(match[1]);
  const unit = match[2] || 'g';
  return {
    servingSize: isNaN(size) || size <= 0 ? 100 : size,
    servingUnit: unit,
  };
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  if (typeof ctx.roundRect === 'function') {
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, radius);
  } else {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + width - r, y);
    ctx.arcTo(x + width, y, x + width, y + r, r);
    ctx.lineTo(x + width, y + height - r);
    ctx.arcTo(x + width, y + height, x + width - r, y + height, r);
    ctx.lineTo(x + r, y + height);
    ctx.arcTo(x, y + height, x, y + height - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  }
}

function drawRoundedBox(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  fill?: string,
  stroke?: string,
  lineWidth = 1,
  dashed = false
) {
  drawRoundedRect(ctx, x, y, width, height, radius);
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.save();
    if (dashed && typeof ctx.setLineDash === 'function') ctx.setLineDash([2.5, 2.5]);
    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = stroke;
    ctx.stroke();
    ctx.restore();
  }
}

function drawSystemEntryIcon(
  ctx: CanvasRenderingContext2D,
  kind: 'estimate' | 'as_planned',
  x: number,
  centerY: number,
  color: string
) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.15;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (kind === 'estimate') {
    // 閃電圖標（估算）
    const top = centerY - 5;
    ctx.beginPath();
    ctx.moveTo(x + 6, top);
    ctx.lineTo(x + 1.5, top + 5.5);
    ctx.lineTo(x + 5, top + 5.5);
    ctx.lineTo(x + 4, top + 10);
    ctx.lineTo(x + 8.5, top + 4.5);
    ctx.lineTo(x + 5, top + 4.5);
    ctx.closePath();
    ctx.stroke();
  } else {
    // 歷史時鐘圖標（推算）
    const cx = x + 5.2;
    const cy = centerY;
    const r = 4.2;
    ctx.beginPath();
    ctx.arc(cx, cy, r, Math.PI * 0.75, Math.PI * 2.55, false);
    ctx.stroke();
    // 箭頭
    ctx.beginPath();
    ctx.moveTo(cx - 4.2, cy - 1);
    ctx.lineTo(cx - 4.2, cy - 3.3);
    ctx.lineTo(cx - 1.9, cy - 3.3);
    ctx.stroke();
    // 時鐘指針
    ctx.beginPath();
    ctx.moveTo(cx, cy - 2);
    ctx.lineTo(cx, cy + 0.3);
    ctx.lineTo(cx + 1.8, cy + 1.2);
    ctx.stroke();
  }

  ctx.restore();
}

function drawRoundedTopBox(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  fill?: string
) {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x, y + height);
  ctx.lineTo(x, y + radius);
  ctx.arcTo(x, y, x + radius, y, radius);
  ctx.lineTo(x + width - radius, y);
  ctx.arcTo(x + width, y, x + width, y + radius, radius);
  ctx.lineTo(x + width, y + height);
  ctx.closePath();
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  ctx.restore();
}

function drawChevronDown(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  stroke: string,
  lineWidth = 1.4
) {
  ctx.save();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  const half = size / 2;
  ctx.moveTo(cx - half, cy - half * 0.4);
  ctx.lineTo(cx, cy + half * 0.5);
  ctx.lineTo(cx + half, cy - half * 0.4);
  ctx.stroke();
  ctx.restore();
}

interface InlineToken {
  text: string;
  font: string;
  color: string;
  gap?: number;
}

function measureInlineTokens(ctx: CanvasRenderingContext2D, tokens: InlineToken[]): number {
  let total = 0;
  tokens.forEach((tk, idx) => {
    if (idx > 0 && tk.gap) total += tk.gap;
    ctx.font = tk.font;
    total += ctx.measureText(tk.text).width;
  });
  return total;
}

function drawInlineTokens(
  ctx: CanvasRenderingContext2D,
  tokens: InlineToken[],
  x: number,
  baselineY: number
): number {
  let curX = x;
  ctx.save();
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  tokens.forEach((tk, idx) => {
    if (idx > 0 && tk.gap) curX += tk.gap;
    ctx.font = tk.font;
    ctx.fillStyle = tk.color;
    ctx.fillText(tk.text, curX, baselineY);
    curX += ctx.measureText(tk.text).width;
  });
  ctx.restore();
  return curX - x;
}

const LOGO_PATHS = [
  {
    d: 'M0 15.2344L0 7.61719C0 5.51376 0.743674 3.71837 2.23102 2.23102C3.71837 0.743674 5.51376 0 7.61719 0L12.6953 0C14.7987 0 16.5941 0.743674 18.0815 2.23102C19.5688 3.71837 20.3125 5.51376 20.3125 7.61719L20.3125 124.414C20.3125 126.517 19.5688 128.313 18.0815 129.8C16.5941 131.288 14.7987 132.031 12.6953 132.031L7.61719 132.031C5.51376 132.031 3.71837 131.288 2.23102 129.8C0.743674 128.313 0 126.517 0 124.414L0 15.2344Z',
    tx: 0,
    ty: 0,
  },
  {
    d: 'M0 15.2344L0 7.61719C0 5.51376 0.743675 3.71837 2.23102 2.23102C3.71837 0.743674 5.51376 0 7.61719 0L12.6953 0C14.7987 0 16.5941 0.743674 18.0815 2.23102C19.5688 3.71837 20.3125 5.51376 20.3125 7.61719L20.3125 124.414C20.3125 126.517 19.5688 128.313 18.0815 129.8C16.5941 131.288 14.7987 132.031 12.6953 132.031L7.61719 132.031C5.51376 132.031 3.71837 131.288 2.23102 129.8C0.743675 128.313 0 126.517 0 124.414L0 15.2344Z',
    tx: 40.625,
    ty: 0,
  },
  {
    d: 'M0 15.2344L0 7.61719C0 5.51376 0.743675 3.71837 2.23103 2.23102C3.71837 0.743674 5.51376 0 7.61719 0L12.6953 0C14.7987 0 16.5941 0.743674 18.0815 2.23102C19.5688 3.71837 20.3125 5.51376 20.3125 7.61719L20.3125 124.414C20.3125 126.517 19.5688 128.313 18.0815 129.8C16.5941 131.288 14.7987 132.031 12.6953 132.031L7.61719 132.031C5.51376 132.031 3.71837 131.288 2.23103 129.8C0.743675 128.313 0 126.517 0 124.414L0 15.2344Z',
    tx: 81.25,
    ty: 0,
  },
  {
    d: 'M0 0L101.562 0C101.562 0 101.562 55.8594 101.562 55.8594C101.562 86.3281 81.25 106.641 50.7812 106.641C20.3125 106.641 0 86.3281 0 55.8594C0 55.8594 0 0 0 0Z',
    tx: 0,
    ty: 111.719,
  },
  {
    d: 'M0 28.111L0 14.0555C0 10.1742 1.23946 6.86128 3.71837 4.11676C6.19728 1.37225 9.1896 0 12.6953 0C16.201 0 19.1933 1.37225 21.6722 4.11676C24.1512 6.86128 25.3906 10.1742 25.3906 14.0555L25.3906 261.433C25.3906 265.314 24.1512 268.627 21.6722 271.371C19.1933 274.116 16.201 275.488 12.6953 275.488C9.1896 275.488 6.19728 274.116 3.71837 271.371C1.23946 268.627 0 265.314 0 261.433L0 28.111Z',
    tx: 38.086,
    ty: 191.699,
  },
  {
    d: 'M0 20.3125L0 10.1562C0 7.35168 0.991562 4.95783 2.9747 2.9747C4.95782 0.991565 7.35168 0 10.1563 0L126.953 0C129.758 0 132.151 0.991565 134.135 2.9747C136.118 4.95783 137.109 7.35168 137.109 10.1562L137.109 55.8594C137.109 58.6639 136.118 61.0578 134.135 63.0409C132.151 65.024 129.758 66.0156 126.953 66.0156L10.1563 66.0156C7.35168 66.0156 4.95782 65.024 2.9747 63.0409C0.991562 61.0578 0 58.6639 0 55.8594L0 20.3125Z',
    tx: 248.828,
    ty: 0,
  },
  {
    d: 'M0 8.88671L0 5.07812C0 3.67583 0.495789 2.47891 1.48734 1.48735C2.47891 0.495781 3.67584 0 5.07813 0L86.3281 0C87.7304 0 88.9273 0.495781 89.9189 1.48735C90.9105 2.47891 91.4063 3.67583 91.4063 5.07812L91.4063 12.6953C91.4063 14.0976 90.9105 15.2945 89.9189 16.2861C88.9273 17.2776 87.7304 17.7734 86.3281 17.7734L5.07813 17.7734C3.67584 17.7734 2.47891 17.2776 1.48734 16.2861C0.495789 15.2945 0 14.0976 0 12.6953L0 8.88671Z',
    tx: 271.68,
    ty: 66.016,
  },
  {
    d: 'M0 17.0418L0 8.52092C0 6.16794 0.743683 4.15953 2.23102 2.49572C3.71838 0.831909 5.51376 0 7.61719 0L27.9297 0C30.0331 0 31.8285 0.831909 33.3159 2.49572C34.8032 4.15953 35.5469 6.16794 35.5469 8.52092L35.5469 326.635C35.5469 328.988 34.8032 330.997 33.3159 332.661C31.8285 334.324 30.0331 335.156 27.9297 335.156L7.61719 335.156C5.51376 335.156 3.71838 334.324 2.23102 332.661C0.743683 330.997 0 328.988 0 326.635L0 17.0418Z',
    tx: 299.609,
    ty: 66.016,
  },
  {
    d: 'M0 8.88672L0 5.07813C0 3.67584 0.495789 2.47891 1.48734 1.48734C2.47891 0.495789 3.67584 0 5.07813 0L86.3281 0C87.7304 0 88.9273 0.495789 89.9189 1.48734C90.9105 2.47891 91.4063 3.67584 91.4063 5.07813L91.4063 12.6953C91.4063 14.0976 90.9105 15.2945 89.9189 16.2861C88.9273 17.2776 87.7304 17.7734 86.3281 17.7734L5.07813 17.7734C3.67584 17.7734 2.47891 17.2776 1.48734 16.2861C0.495789 15.2945 0 14.0976 0 12.6953L0 8.88672Z',
    tx: 271.68,
    ty: 383.398,
  },
  {
    d: 'M0 20.3125L0 10.1563C0 7.35168 0.991562 4.95782 2.9747 2.9747C4.95782 0.991577 7.35168 0 10.1563 0L126.953 0C129.758 0 132.151 0.991577 134.135 2.9747C136.118 4.95782 137.109 7.35168 137.109 10.1563L137.109 55.8594C137.109 58.664 136.118 61.0578 134.135 63.041C132.151 65.0241 129.758 66.0156 126.953 66.0156L10.1563 66.0156C7.35168 66.0156 4.95782 65.0241 2.9747 63.041C0.991562 61.0578 0 58.664 0 55.8594L0 20.3125Z',
    tx: 248.828,
    ty: 401.172,
  },
];

function drawE2CalLogo(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  stroke?: string
) {
  ctx.save();
  const radius = size * 0.225;
  drawRoundedBox(ctx, x, y, size, size, radius, '#000000', stroke, 1);

  if (typeof Path2D !== 'undefined') {
    const scale = (size / 1024) * 1.227;
    ctx.save();
    ctx.translate(x + size / 2, y + size / 2);
    ctx.scale(scale, scale);
    ctx.translate(-192.9685, -233.594);
    ctx.fillStyle = '#ffffff';

    for (const item of LOGO_PATHS) {
      ctx.save();
      ctx.translate(item.tx, item.ty);
      const p = new Path2D(item.d);
      ctx.fill(p);
      ctx.restore();
    }
    ctx.restore();
  }
  ctx.restore();
}

function truncateText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string {
  if (ctx.measureText(text).width <= maxWidth) {
    return text;
  }
  let truncated = text;
  while (truncated.length > 0 && ctx.measureText(`${truncated}…`).width > maxWidth) {
    truncated = truncated.slice(0, -1);
  }
  return `${truncated}…`;
}

interface RenderContext {
  ctx: CanvasRenderingContext2D;
  palette: ImagePalette;
  width: number;
  paddingX: number;
  cardWidth: number;
  cardGap: number;
  isMeasureOnly: boolean;
  t: TFunction;
}

/**
 * 頂部 Header（方案 1 · 報表雙行對齊，全比例字體無等寬）：
 * 左側：Logo + e2Cal + 每日數據快照；右側：數據範圍標題 + 日期
 */
function renderHeader(rc: RenderContext, payload: DailyExportPayload, y: number): number {
  const { ctx, palette, paddingX, cardWidth, isMeasureOnly } = rc;
  const headerHeight = 44;
  const edgeInset = 8;
  const contentLeft = paddingX + edgeInset;
  const contentRight = paddingX + cardWidth - edgeInset;

  if (!isMeasureOnly) {
    ctx.save();

    const centerY = y + Math.round(headerHeight / 2);

    // 左側：官方 Logo (32x32)
    const logoSize = 32;
    const logoY = centerY - Math.round(logoSize / 2);
    drawE2CalLogo(ctx, contentLeft, logoY, logoSize, palette.border);

    const brandTextX = contentLeft + logoSize + 10;

    // 主名稱 e2Cal (Geist Sans SemiBold 17px，字距 -0.03em)
    ctx.save();
    ctx.font = `600 17px ${BRAND_FONT}`;
    ctx.fillStyle = palette.textPrimary;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    if ('letterSpacing' in ctx) {
      (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = '-0.51px';
    }
    ctx.fillText('e2Cal', brandTextX, centerY - 7);
    ctx.restore();

    // 副標：比例字體（多語系）
    ctx.font = `400 11px ${SANS_FONT}`;
    ctx.fillStyle = palette.textTertiary;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillText(rc.t('aiExport.image.snapshotSubtitle', '每日數據快照'), brandTextX, centerY + 9);

    // 右側：雙行右對齊比例字體排版（移除雙膠囊與等寬字體）
    const scopeFallbackMap: Record<string, string> = {
      diet: '當日飲食數據',
      workout: '當日訓練數據',
      body: '當日身體數據',
      all: '當日完整數據',
    };
    const scopeText = rc.t(
      `aiExport.scope.${payload.scope}`,
      scopeFallbackMap[payload.scope] || payload.scope
    );
    const rightX = contentRight;

    ctx.font = `600 12px ${SANS_FONT}`;
    ctx.fillStyle = palette.textPrimary;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(scopeText, rightX, centerY - 7);

    ctx.font = `400 11px ${SANS_FONT}`;
    ctx.fillStyle = palette.textSecondary;
    ctx.fillText(payload.date, rightX, centerY + 9);

    ctx.restore();
  }

  return y + headerHeight + rc.cardGap;
}

/**
 * 頂部熱量統計卡片 (100% 像素級還原 App 真實 UI)
 */
function renderCaloriesHeroCard(
  rc: RenderContext,
  diet: ExportDietSection,
  startY: number
): number {
  const { ctx, palette, paddingX, cardWidth, isMeasureOnly } = rc;
  const innerPad = 16;
  const innerWidth = cardWidth - innerPad * 2;

  let curY = startY + innerPad;

  // 1. 卡片頂部 Bar: 左側活動係數膠囊、中間「熱量統計」、右側供能比膠囊（1:1 對齊 DietView）
  if (!isMeasureOnly) {
    ctx.save();
    const pillH = 22;
    const pillCenterY = curY + pillH / 2;

    // 左側：活動係數膠囊
    const palText = diet.activityLabel || `PAL ${diet.activityLevel}`;
    ctx.font = `400 11px ${SANS_FONT}`;
    const palTextW = ctx.measureText(palText).width;
    const palPillW = palTextW + 18;
    const palPillX = paddingX + innerPad;
    drawRoundedBox(
      ctx,
      palPillX,
      curY,
      palPillW,
      pillH,
      11,
      palette.cardSubtleBg,
      palette.border,
      1
    );
    ctx.fillStyle = palette.textSecondary;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(palText, palPillX + 9, pillCenterY);

    // 右側：供能比膠囊 (C/P/F)
    const splitText = `${diet.macroSplit.carbs}/${diet.macroSplit.protein}/${diet.macroSplit.fat}`;
    ctx.font = `400 11px ${MONO_FONT}`;
    const splitTextW = ctx.measureText(splitText).width;
    const splitPillW = splitTextW + 18;
    const splitPillX = paddingX + cardWidth - innerPad - splitPillW;
    drawRoundedBox(
      ctx,
      splitPillX,
      curY,
      splitPillW,
      pillH,
      11,
      palette.cardSubtleBg,
      palette.border,
      1
    );
    ctx.fillStyle = palette.textSecondary;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(splitText, splitPillX + 9, pillCenterY);

    // 中間：熱量統計
    ctx.font = `400 13px ${SANS_FONT}`;
    ctx.fillStyle = palette.textSecondary;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(rc.t('diet.calorieStats', '熱量統計'), paddingX + cardWidth / 2, pillCenterY);
    ctx.restore();
  }
  curY += 28;

  // 2. 居中超大熱量數值與單位（MetricValue 雙字體 + 4px 微距）
  const actualCal = diet.actual.calories;
  const targetCal = diet.target.calories;
  const remainingCal = targetCal - actualCal;
  const eUnit = diet.target.energyUnit;

  if (!isMeasureOnly) {
    ctx.save();
    ctx.font = `700 36px ${MONO_FONT}`;
    const calStr = actualCal.toLocaleString();
    const calStrW = ctx.measureText(calStr).width;

    ctx.font = `400 14px ${SANS_FONT}`;
    const unitStr = `${eUnit}`;
    const unitStrW = ctx.measureText(unitStr).width;
    const heroUnitGap = 4;

    const totalHeroW = calStrW + heroUnitGap + unitStrW;
    const heroStartX = paddingX + (cardWidth - totalHeroW) / 2;

    ctx.font = `700 36px ${MONO_FONT}`;
    ctx.fillStyle = palette.textPrimary;
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    ctx.fillText(calStr, heroStartX, curY + 34);

    ctx.font = `400 14px ${SANS_FONT}`;
    ctx.fillStyle = palette.textSecondary;
    ctx.fillText(unitStr, heroStartX + calStrW + heroUnitGap, curY + 34);

    // 下方居中小字：剩餘 / 超額（中文 SANS + 6px + 數字 MONO + 2px + 單位 SANS）
    const diffLabel =
      remainingCal >= 0
        ? rc.t('dietPlan.underBudget', '剩餘')
        : rc.t('dietPlan.overBudget', '超額');
    const diffNum =
      remainingCal >= 0
        ? remainingCal.toLocaleString()
        : `+${Math.abs(remainingCal).toLocaleString()}`;
    const diffColor = remainingCal >= 0 ? palette.textSecondary : palette.calories;

    ctx.font = `400 13px ${SANS_FONT}`;
    const diffLabelW = ctx.measureText(diffLabel).width;
    ctx.font = `400 13px ${MONO_FONT}`;
    const diffNumW = ctx.measureText(diffNum).width;
    ctx.font = `400 12px ${SANS_FONT}`;
    const diffUnitW = ctx.measureText(eUnit).width;

    const diffTotalW = diffLabelW + 6 + diffNumW + 2 + diffUnitW;
    const diffStartX = paddingX + (cardWidth - diffTotalW) / 2;
    const diffY = curY + 55;

    ctx.font = `400 13px ${SANS_FONT}`;
    ctx.fillStyle = diffColor;
    ctx.fillText(diffLabel, diffStartX, diffY);

    ctx.font = `400 13px ${MONO_FONT}`;
    ctx.fillText(diffNum, diffStartX + diffLabelW + 6, diffY);

    ctx.font = `400 12px ${SANS_FONT}`;
    ctx.fillStyle = remainingCal >= 0 ? palette.textTertiary : palette.calories;
    ctx.fillText(eUnit, diffStartX + diffLabelW + 6 + diffNumW + 2, diffY);

    ctx.restore();
  }
  curY += 66;

  // 3. 居中熱量進度條 (h-2 w-full max-w-[220px] mx-auto bg-track rounded-full)
  const calBarH = 8;
  const calBarMaxW = Math.min(220, innerWidth * 0.55);
  const calBarX = paddingX + (cardWidth - calBarMaxW) / 2;
  const calRatio = targetCal > 0 ? Math.min(1, Math.max(0, actualCal / targetCal)) : 0;
  if (!isMeasureOnly) {
    ctx.save();
    // 軌道 (rounded-full)
    drawRoundedBox(ctx, calBarX, curY, calBarMaxW, calBarH, 4, palette.trackBg);
    // 黑色/前景色進度條 (rounded-full)
    if (calRatio > 0) {
      drawRoundedBox(ctx, calBarX, curY, Math.max(calBarH, calBarMaxW * calRatio), calBarH, 4, palette.progressBar);
    }
    ctx.restore();
  }
  curY += calBarH + 20;

  // 4. 三大營養素三等分欄 (grid-cols-3 divide-x divide-border border-t border-border)
  const macroBarH = 78;
  const colW = cardWidth / 3;

  if (!isMeasureOnly) {
    ctx.save();
    // 頂部水平分割線 (滿版卡片寬度)
    ctx.lineWidth = 1;
    ctx.strokeStyle = palette.divider;
    ctx.beginPath();
    ctx.moveTo(paddingX, curY);
    ctx.lineTo(paddingX + cardWidth, curY);
    ctx.stroke();

    // 垂直分割線 1 & 2
    ctx.beginPath();
    ctx.moveTo(paddingX + colW, curY);
    ctx.lineTo(paddingX + colW, curY + macroBarH);
    ctx.moveTo(paddingX + colW * 2, curY);
    ctx.lineTo(paddingX + colW * 2, curY + macroBarH);
    ctx.stroke();

    const cols = [
      {
        label: rc.t('dietPlan.carbsShort', '碳水化合物'),
        actual: diet.actual.carbs,
        target: diet.target.carbs,
        color: palette.carbs,
        trackColor: palette.carbsSubtle,
      },
      {
        label: rc.t('diet.protein', '蛋白質'),
        actual: diet.actual.protein,
        target: diet.target.protein,
        color: palette.protein,
        trackColor: palette.proteinSubtle,
      },
      {
        label: rc.t('diet.fat', '脂肪'),
        actual: diet.actual.fat,
        target: diet.target.fat,
        color: palette.fat,
        trackColor: palette.fatSubtle,
      },
    ];

    cols.forEach((col, idx) => {
      const colStartX = paddingX + idx * colW + 14;
      const colInnerW = colW - 28;
      const colY = curY + 12;

      // 彩色標籤 (text-xs font-medium)
      ctx.font = `500 12px ${SANS_FONT}`;
      ctx.fillStyle = col.color;
      ctx.textBaseline = 'top';
      ctx.textAlign = 'left';
      ctx.fillText(col.label, colStartX, colY);

      // 數值與目標 (對齊 MetricValue 雙字體 + 2px 微距: 107 g / 200 g)
      const valY = colY + 32;
      const actNumStr = `${Math.round(col.actual)}`;
      const unitG = 'g';
      const targetNumStr = `${col.target}`;

      ctx.textBaseline = 'alphabetic';

      ctx.font = `400 15px ${MONO_FONT}`;
      ctx.fillStyle = palette.textPrimary;
      ctx.fillText(actNumStr, colStartX, valY);
      const actNumW = ctx.measureText(actNumStr).width;

      ctx.font = `400 11px ${SANS_FONT}`;
      ctx.fillStyle = palette.textSecondary;
      ctx.fillText(unitG, colStartX + actNumW + 2, valY);
      const actUnitW = ctx.measureText(unitG).width;

      const slashX = colStartX + actNumW + 2 + actUnitW + 3;
      ctx.font = `400 11px ${SANS_FONT}`;
      ctx.fillStyle = palette.textTertiary;
      ctx.fillText('/', slashX, valY);
      const slashW = ctx.measureText('/').width;

      const tgtNumX = slashX + slashW + 3;
      ctx.font = `400 12px ${MONO_FONT}`;
      ctx.fillText(targetNumStr, tgtNumX, valY);
      const tgtNumW = ctx.measureText(targetNumStr).width;

      ctx.font = `400 10px ${SANS_FONT}`;
      ctx.fillText(unitG, tgtNumX + tgtNumW + 2, valY);

      // 底部彩色進度條 (h-2, rounded-full)
      const barY = colY + 42;
      const progressH = 8;
      drawRoundedBox(ctx, colStartX, barY, colInnerW, progressH, 4, col.trackColor);
      const ratio = col.target > 0 ? Math.min(1, Math.max(0, col.actual / col.target)) : 0;
      if (ratio > 0) {
        drawRoundedBox(ctx, colStartX, barY, Math.max(progressH, colInnerW * ratio), progressH, 4, col.color);
      }
    });

    ctx.restore();
  }
  curY += macroBarH;

  const totalCardH = curY - startY;

  return startY + totalCardH + rc.cardGap;
}

/**
 * 獨立餐次卡片 (灰底橫欄表頭 + divide-y 食物條目 + 柔和點亮 MacroSquares)
 */
function renderMealCard(
  rc: RenderContext,
  meal: ExportMealGroup,
  startY: number
): number {
  const { ctx, palette, paddingX, cardWidth, isMeasureOnly } = rc;
  const headerHeight = 40;
  let curY = startY;

  // 1. 餐次標題欄 (灰底橫欄 h-10 px-4 bg-muted/40 border-b border-border)
  if (!isMeasureOnly) {
    ctx.save();
    // 頂部圓角灰色背景 (8px 圓角)
    drawRoundedTopBox(ctx, paddingX, startY, cardWidth, headerHeight, 8, palette.cardHeaderBg);

    // 底部水平分割線
    ctx.lineWidth = 1;
    ctx.strokeStyle = palette.border;
    ctx.beginPath();
    ctx.moveTo(paddingX, startY + headerHeight);
    ctx.lineTo(paddingX + cardWidth, startY + headerHeight);
    ctx.stroke();

    // 左側：餐別名稱 (font-semibold text-sm)，與熱量數值同一基線對齊
    const headerInnerX = paddingX + 16;
    const headerTextBaselineY = startY + 22;
    ctx.font = `600 14px ${SANS_FONT}`;
    ctx.fillStyle = palette.textPrimary;
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    ctx.fillText(meal.mealLabel, headerInnerX, headerTextBaselineY);
    const mealLabelW = ctx.measureText(meal.mealLabel).width;

    if (meal.items.length > 0 && meal.calories > 0) {
      // 點號 ·
      const dotX = headerInnerX + mealLabelW + 6;
      ctx.font = `400 12px ${SANS_FONT}`;
      ctx.fillStyle = palette.textTertiary;
      ctx.fillText('·', dotX, headerTextBaselineY);

      // 熱量 popover trigger（數值 MONO + 2px + 單位 SANS，與餐別標題同基線）
      const popoverX = dotX + 10;
      const calNumText = `${meal.calories}`;
      const calUnitText = 'kcal';
      ctx.font = `500 12px ${MONO_FONT}`;
      ctx.fillStyle = palette.textSecondary;
      ctx.fillText(calNumText, popoverX, headerTextBaselineY);
      const calNumW = ctx.measureText(calNumText).width;

      ctx.font = `400 11px ${SANS_FONT}`;
      ctx.fillStyle = palette.textTertiary;
      ctx.fillText(calUnitText, popoverX + calNumW + 2, headerTextBaselineY);
      const calUnitW = ctx.measureText(calUnitText).width;
      const calTextW = calNumW + 2 + calUnitW;

      // 微型箭頭（垂直對齊數字中心）
      drawChevronDown(ctx, popoverX + calTextW + 8, headerTextBaselineY - 4, 6, palette.textSecondary);

      // 下半部：與數值同寬之供能色彩微標尺 (3px 高度, rounded-[1.5px])
      const totalPopW = calTextW + 14;
      const miniBarY = startY + 28;
      const miniBarH = 3;

      const carbCals = meal.carbs * 4;
      const proteinCals = meal.protein * 4;
      const fatCals = meal.fat * 9;
      const totalMacroCal = carbCals + proteinCals + fatCals;

      let cPercent = 0;
      let pPercent = 0;

      if (totalMacroCal > 0) {
        cPercent = Math.round((carbCals / totalMacroCal) * 100);
        pPercent = Math.round((proteinCals / totalMacroCal) * 100);
      }

      const cW = Math.max(1, Math.round(totalPopW * (cPercent / 100)));
      const pW = Math.max(1, Math.round(totalPopW * (pPercent / 100)));
      const fW = Math.max(1, totalPopW - cW - pW);

      drawRoundedRect(ctx, popoverX, miniBarY, totalPopW, miniBarH, 1.5);
      ctx.clip();
      ctx.fillStyle = palette.carbs;
      ctx.fillRect(popoverX, miniBarY, cW, miniBarH);
      ctx.fillStyle = palette.protein;
      ctx.fillRect(popoverX + cW, miniBarY, pW, miniBarH);
      ctx.fillStyle = palette.fat;
      ctx.fillRect(popoverX + cW + pW, miniBarY, fW, miniBarH);
    }

    ctx.restore();
  }

  curY += headerHeight;

  // 2. 食物列表項目 (每筆項目高度約 58px，divide-y divide-border)
  if (meal.items.length === 0) {
    if (!isMeasureOnly) {
      ctx.save();
      ctx.font = `400 12px ${SANS_FONT}`;
      ctx.fillStyle = palette.textTertiary;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(rc.t('common.noRecord', '無記錄'), paddingX + cardWidth / 2, curY + 24);
      ctx.restore();
    }
    curY += 48;
  } else {
    meal.items.forEach((item, itemIdx) => {
      // 項目上方分割線 (第一項已有 header border)
      if (itemIdx > 0) {
        if (!isMeasureOnly) {
          ctx.save();
          ctx.lineWidth = 1;
          ctx.strokeStyle = palette.divider;
          ctx.beginPath();
          ctx.moveTo(paddingX, curY);
          ctx.lineTo(paddingX + cardWidth, curY);
          ctx.stroke();
          ctx.restore();
        }
      }

      const itemRowH = 58;
      if (!isMeasureOnly) {
        ctx.save();

        // 營養評價：算出 highlights 與 high/low calorie 標籤
        const amountInfo = parseAmount('amount' in item ? item.amount : undefined);
        const evalRes = evaluateNutritionalHighlight({
          calories: item.calories,
          carbs: item.carbs,
          protein: item.protein,
          fat: item.fat,
          servingSize: amountInfo.servingSize,
          servingUnit: amountInfo.servingUnit,
        });

        const isSystemEntry = item.type === 'estimate' || item.type === 'as_planned';

        // --- (A) 右側 MacroSquares：3 個方塊矩陣 (碳 / 蛋 / 脂；系統估算/推算條目採虛線邊框) ---
        // 寬度 w-11 (44px), 高度 38px, 間距 gap-2 (8px), 圓角 4px
        const sqW = 44;
        const sqH = 38;
        const sqGap = 8;
        const squaresTotalW = sqW * 3 + sqGap * 2; // 148px
        const squaresStartX = paddingX + cardWidth - 16 - squaresTotalW;
        const sqY = curY + (itemRowH - sqH) / 2;

        const squares = [
          {
            tag: rc.t('aiExport.image.macroTagCarbs', '碳'),
            num: `${roundNum(item.carbs)}`,
            isHighlighted: evalRes.highlights.carbs,
            color: palette.carbs,
            bg: palette.carbsBg,
            border: palette.carbsBorder,
          },
          {
            tag: rc.t('aiExport.image.macroTagProtein', '蛋'),
            num: `${roundNum(item.protein)}`,
            isHighlighted: evalRes.highlights.protein,
            color: palette.protein,
            bg: palette.proteinBg,
            border: palette.proteinBorder,
          },
          {
            tag: rc.t('aiExport.image.macroTagFat', '脂'),
            num: `${roundNum(item.fat)}`,
            isHighlighted: evalRes.highlights.fat,
            color: palette.fat,
            bg: palette.fatBg,
            border: palette.fatBorder,
          },
        ];

        squares.forEach((sq, sIdx) => {
          const sX = squaresStartX + sIdx * (sqW + sqGap);
          const boxFill = sq.isHighlighted ? sq.bg : palette.macroNeutralBg;
          const boxBorder = sq.isHighlighted ? sq.border : palette.macroNeutralBorder;
          const tagColor = sq.isHighlighted ? sq.color : palette.macroNeutralLabel;
          const tagWeight = sq.isHighlighted ? '600' : '500';

          drawRoundedBox(ctx, sX, sqY, sqW, sqH, 4, boxFill, boxBorder, 1, isSystemEntry);

          // 頂部標籤 (SANS_FONT)
          ctx.font = `${tagWeight} 9.5px ${SANS_FONT}`;
          ctx.fillStyle = tagColor;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(sq.tag, sX + sqW / 2, sqY + 11);

          // 底部數值 + 1.5px 微距 + g (SANS_FONT)
          ctx.font = `400 12px ${MONO_FONT}`;
          const numW = ctx.measureText(sq.num).width;
          ctx.font = `400 9.5px ${SANS_FONT}`;
          const unitW = ctx.measureText('g').width;
          const totalValW = numW + 1.5 + unitW;
          const valStartX = sX + (sqW - totalValW) / 2;

          ctx.textAlign = 'left';
          ctx.textBaseline = 'alphabetic';
          ctx.font = `400 12px ${MONO_FONT}`;
          ctx.fillStyle = palette.textPrimary;
          ctx.fillText(sq.num, valStartX, sqY + 30);

          ctx.font = `400 9.5px ${SANS_FONT}`;
          ctx.fillStyle = palette.textSecondary;
          ctx.fillText('g', valStartX + numW + 1.5, sqY + 30);
        });

        // --- (B) 左側品名與份量熱量副標（復刻 App 真實樣式，無標題前綴膠囊） ---
        const leftX = paddingX + 16;
        const maxTitleW = squaresStartX - leftX - 12;

        ctx.font = `500 14px ${SANS_FONT}`;
        ctx.fillStyle = palette.textPrimary;
        ctx.textBaseline = 'top';
        ctx.textAlign = 'left';
        const displayTitle = truncateText(ctx, item.name, maxTitleW);
        ctx.fillText(displayTitle, leftX, curY + 12);

        // 第二行：系統條目顯示「[圖標] 估算/推算 · xxx kcal」；實體食物/食譜顯示「份量 · 熱量標籤」
        const subBaselineY = curY + 40;
        let curSubX = leftX;

        if (isSystemEntry) {
          const systemKind = item.type === 'estimate' ? 'estimate' : 'as_planned';
          const systemLabel =
            systemKind === 'estimate'
              ? rc.t('diet.placeholder.badge', '估算')
              : rc.t('diet.placeholder.asPlannedBadge', '推算');
          drawSystemEntryIcon(ctx, systemKind, curSubX, curY + 36, palette.textSecondary);
          curSubX += 13;
          drawInlineTokens(
            ctx,
            [
              { text: systemLabel, font: `400 11px ${SANS_FONT}`, color: palette.textSecondary },
              { text: '·', font: `400 11px ${SANS_FONT}`, color: palette.textTertiary, gap: 5 },
              { text: `${item.calories}`, font: `400 11px ${MONO_FONT}`, color: palette.textSecondary, gap: 5 },
              { text: 'kcal', font: `400 10.5px ${SANS_FONT}`, color: palette.textTertiary, gap: 2 },
            ],
            curSubX,
            subBaselineY
          );
        } else {
          if ('amount' in item && item.amount) {
            const amountParts = item.amount.trim().match(/^([\d.,]+)\s*(.+)$/);
            const amountTokens: InlineToken[] = amountParts
              ? [
                  { text: amountParts[1], font: `400 11px ${MONO_FONT}`, color: palette.textSecondary },
                  { text: amountParts[2], font: `400 10.5px ${SANS_FONT}`, color: palette.textTertiary, gap: 2 },
                  { text: '·', font: `400 11px ${SANS_FONT}`, color: palette.textTertiary, gap: 5 },
                ]
              : [
                  { text: item.amount, font: `400 11px ${SANS_FONT}`, color: palette.textSecondary },
                  { text: '·', font: `400 11px ${SANS_FONT}`, color: palette.textTertiary, gap: 5 },
                ];

            curSubX += drawInlineTokens(ctx, amountTokens, curSubX, subBaselineY) + 5;
          }

          const isHighCal = evalRes.labels.includes('high-calorie');
          const isLowCal = evalRes.labels.includes('low-calorie');
          const calColor = isHighCal
            ? palette.caloriesText
            : isLowCal
              ? palette.calorieLowText
              : palette.textSecondary;
          const calUnitColor = isHighCal
            ? palette.caloriesText
            : isLowCal
              ? palette.calorieLowText
              : palette.textTertiary;

          const calTokens: InlineToken[] = [
            {
              text: `${item.calories}`,
              font: `${isHighCal || isLowCal ? '500' : '400'} 11px ${MONO_FONT}`,
              color: calColor,
            },
            {
              text: 'kcal',
              font: `400 10.5px ${SANS_FONT}`,
              color: calUnitColor,
              gap: 2,
            },
          ];

          if (isHighCal || isLowCal) {
            const calTagW = measureInlineTokens(ctx, calTokens) + 8;
            drawRoundedBox(
              ctx,
              curSubX,
              curY + 28,
              calTagW,
              17,
              3,
              isHighCal ? palette.caloriesBg : palette.calorieLowBg,
              undefined,
              0
            );
            drawInlineTokens(ctx, calTokens, curSubX + 4, subBaselineY);
          } else {
            drawInlineTokens(ctx, calTokens, curSubX, subBaselineY);
          }
        }

        ctx.restore();
      }

      curY += itemRowH;
    });
  }

  const totalCardH = curY - startY;

  return startY + totalCardH + rc.cardGap;
}

function roundNum(val: number): number | string {
  if (typeof val !== 'number' || isNaN(val)) return 0;
  return Math.round(val * 10) / 10;
}

const NON_MUSCLE_SLUGS = new Set<string>([
  'head',
  'hair',
  'neck',
  'knees',
  'ankles',
  'feet',
  'hands',
]);

/**
 * 在 Canvas 2D 上繪製雙向人體解剖熱力圖 (ANTERIOR + POSTERIOR)
 * 100% 像素級還原 App 中的 BodyHighlighter
 */
function drawBodyHighlighterOnCanvas(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  intensityMap: Partial<Record<string, number>>,
  palette: ImagePalette
): number {
  const mapHeight = width;
  const scale = width / 1448;

  ctx.save();
  if (typeof ctx.translate === 'function') {
    ctx.translate(x, y);
  }

  if (typeof Path2D !== 'undefined') {
    ctx.save();
    if (typeof ctx.scale === 'function') {
      ctx.scale(scale, scale);
    }

    const renderPartGroup = (slug: string, paths: string[], view: 'anterior' | 'posterior') => {
      const isNonMuscle = NON_MUSCLE_SLUGS.has(slug);
      let intensity = 0;
      if (!isNonMuscle) {
        const muscles = getDetailedMusclesForSlug(slug as BodyPartSlug, view);
        for (const m of muscles) {
          const val = intensityMap[m];
          if (typeof val === 'number' && val > intensity) {
            intensity = val;
          }
        }
      }

      const isStimulated = intensity > 0;
      const fill = isStimulated ? palette.muscleHighlightFill : palette.muscleBaseFill;
      const stroke = isStimulated ? palette.muscleHighlightStroke : palette.muscleBaseStroke;
      const strokeW = isStimulated ? 1.0 : 0.6;

      ctx.fillStyle = fill;
      ctx.strokeStyle = stroke;
      ctx.lineWidth = strokeW;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      for (const d of paths) {
        const p = new Path2D(d);
        ctx.fill(p);
        ctx.stroke(p);
      }
    };

    // 1. 正面肌肉與部位
    for (const group of BODY_FRONT_PARTS) {
      renderPartGroup(group.slug, group.paths, 'anterior');
    }

    // 2. 背面肌肉與部位
    for (const group of BODY_BACK_PARTS) {
      renderPartGroup(group.slug, group.paths, 'posterior');
    }

    // 3. 外圍人體精確剪影輪廓線
    ctx.strokeStyle = palette.muscleOutline;
    ctx.lineWidth = 1.0;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const pFront = new Path2D(MALE_OUTLINE_FRONT);
    ctx.stroke(pFront);

    const pBack = new Path2D(MALE_OUTLINE_BACK);
    ctx.stroke(pBack);

    ctx.restore();
  }

  ctx.restore();

  return mapHeight + 8;
}

/**
 * 訓練 Hero 卡片 (1:1 復刻 App 頂部 WorkoutRecoveryDashboard：人體解剖熱力圖 + 3 欄指標)
 */
function renderWorkoutHeroCard(
  rc: RenderContext,
  workout: ExportWorkoutSection,
  startY: number
): number {
  const { ctx, palette, paddingX, cardWidth, isMeasureOnly } = rc;

  const topBarH = 38;
  const mapW = Math.min(210, cardWidth - 40);
  const mapH = mapW + 8;
  const statH = 68;
  const totalHeroH = topBarH + mapH + statH;

  if (!isMeasureOnly) {
    ctx.save();

    // 1. 頂部狀態膠囊 (右上角，數值 MONO + 4px + 多語系文字 SANS，上右邊距統一為 16px)
    const recoveringCount = workout.recovery?.recoveringCount ?? 0;
    if (recoveringCount > 0) {
      const pillTokens: InlineToken[] = [
        { text: `${recoveringCount}`, font: `500 11px ${MONO_FONT}`, color: palette.muscleRecoveringPillText },
        {
          text: rc.t('aiExport.image.recoveringMusclesSuffix', '個肌群恢復中'),
          font: `500 11px ${SANS_FONT}`,
          color: palette.muscleRecoveringPillText,
          gap: 4,
        },
      ];
      const pillW = measureInlineTokens(ctx, pillTokens) + 16;
      const pillX = paddingX + cardWidth - 16 - pillW;
      const pillY = startY + 16;

      drawRoundedBox(
        ctx,
        pillX,
        pillY,
        pillW,
        22,
        11,
        palette.muscleRecoveringPillBg,
        palette.muscleRecoveringPillBorder,
        1
      );
      drawInlineTokens(ctx, pillTokens, pillX + 8, pillY + 15);
    } else {
      const pillText = rc.t('aiExport.image.allMusclesReady', '全部肌群已就緒');
      ctx.font = `500 11px ${SANS_FONT}`;
      const pillW = ctx.measureText(pillText).width + 16;
      const pillX = paddingX + cardWidth - 16 - pillW;
      const pillY = startY + 16;

      drawRoundedBox(
        ctx,
        pillX,
        pillY,
        pillW,
        22,
        11,
        palette.pillSubtleBg,
        palette.border,
        1
      );
      ctx.fillStyle = palette.textTertiary;
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';
      ctx.fillText(pillText, pillX + 8, pillY + 11);
    }

    // 2. 中央人體解剖熱力圖
    const mapX = paddingX + (cardWidth - mapW) / 2;
    const mapY = startY + topBarH + 2;
    drawBodyHighlighterOnCanvas(
      ctx,
      mapX,
      mapY,
      mapW,
      workout.recovery?.intensityMap || {},
      palette
    );

    // 3. 底部 3 欄客觀指標 (動作 / 完成組數 / 總容量)
    const bottomDividerY = startY + topBarH + mapH;
    ctx.lineWidth = 1;
    ctx.strokeStyle = palette.divider;
    ctx.beginPath();
    ctx.moveTo(paddingX, bottomDividerY);
    ctx.lineTo(paddingX + cardWidth, bottomDividerY);
    ctx.stroke();

    const colW = cardWidth / 3;
    // 兩條垂直分割線
    ctx.beginPath();
    ctx.moveTo(paddingX + colW, bottomDividerY);
    ctx.lineTo(paddingX + colW, bottomDividerY + statH);
    ctx.moveTo(paddingX + colW * 2, bottomDividerY);
    ctx.lineTo(paddingX + colW * 2, bottomDividerY + statH);
    ctx.stroke();

    const statsData = [
      {
        label: rc.t('aiExport.image.exercisesLabel', '動作'),
        val: `${workout.summary.totalExercises}`,
        unit: rc.t('aiExport.image.exercisesUnit', '項'),
      },
      {
        label: rc.t('aiExport.image.setsLabel', '完成組數'),
        val: `${workout.summary.totalSets}`,
        unit: rc.t('aiExport.image.setsUnit', '組'),
      },
      {
        label: rc.t('aiExport.image.totalVolumeLabel', '總容量'),
        val: `${workout.summary.totalVolume.toLocaleString()}`,
        unit: `${workout.summary.weightUnit}`,
      },
    ];

    statsData.forEach((st, idx) => {
      const colX = paddingX + idx * colW + 16;
      const labelY = bottomDividerY + 14;
      const valY = bottomDividerY + 36;

      ctx.font = `500 12px ${SANS_FONT}`;
      ctx.fillStyle = palette.textSecondary;
      ctx.textBaseline = 'top';
      ctx.textAlign = 'left';
      ctx.fillText(st.label, colX, labelY);

      // 數值大字 (font-mono font-bold 18px) + 3px 微距 + SANS 單位
      ctx.font = `700 18px ${MONO_FONT}`;
      const numW = ctx.measureText(st.val).width;
      ctx.fillStyle = palette.textPrimary;
      ctx.fillText(st.val, colX, valY);

      // 單位小字
      ctx.font = `400 12px ${SANS_FONT}`;
      ctx.fillStyle = palette.textSecondary;
      ctx.fillText(st.unit, colX + numW + 3, valY + 5);
    });

    ctx.restore();
  }

  return startY + totalHeroH + rc.cardGap;
}

/**
 * 訓練記錄明細卡片 (動作、組數、重量次數清單)
 */
function renderWorkoutExercisesCard(
  rc: RenderContext,
  workout: ExportWorkoutSection,
  startY: number
): number {
  const { ctx, palette, paddingX, cardWidth, isMeasureOnly } = rc;
  const headerHeight = 40;
  let curY = startY;

  // 1. 標題欄 (灰底標頭)
  if (!isMeasureOnly) {
    ctx.save();
    drawRoundedTopBox(ctx, paddingX, startY, cardWidth, headerHeight, 8, palette.cardHeaderBg);

    ctx.lineWidth = 1;
    ctx.strokeStyle = palette.border;
    ctx.beginPath();
    ctx.moveTo(paddingX, startY + headerHeight);
    ctx.lineTo(paddingX + cardWidth, startY + headerHeight);
    ctx.stroke();

    const innerX = paddingX + 16;
    ctx.font = `600 14px ${SANS_FONT}`;
    ctx.fillStyle = palette.textPrimary;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillText(rc.t('aiExport.image.workoutLogTitle', '訓練日誌'), innerX, startY + 20);

    // 右側總組數膠囊（數值 MONO + 2px + 單位 SANS）
    const setsTokens: InlineToken[] = [
      { text: `${workout.summary.totalSets}`, font: `500 11px ${MONO_FONT}`, color: palette.textSecondary },
      { text: rc.t('aiExport.image.setsUnit', '組'), font: `400 11px ${SANS_FONT}`, color: palette.textSecondary, gap: 2 },
    ];
    const setsW = measureInlineTokens(ctx, setsTokens) + 16;
    const setsX = paddingX + cardWidth - 16 - setsW;
    drawRoundedBox(ctx, setsX, startY + 9, setsW, 22, 11, palette.pillSubtleBg, palette.border, 1);
    drawInlineTokens(ctx, setsTokens, setsX + 8, startY + 24);
    ctx.restore();
  }
  curY += headerHeight + 14;

  const innerPad = 16;
  const innerWidth = cardWidth - innerPad * 2;
  const innerX = paddingX + innerPad;

  // 2. 動作清單
  if (workout.sessions.length === 0) {
    if (!isMeasureOnly) {
      ctx.save();
      ctx.font = `500 11px ${SANS_FONT}`;
      ctx.fillStyle = palette.textTertiary;
      ctx.textBaseline = 'top';
      ctx.fillText(rc.t('aiExport.workout.noLogs', '當日無訓練記錄'), innerX, curY);
      ctx.restore();
    }
    curY += 24;
  } else {
    for (const session of workout.sessions) {
      if (session.routineTitle) {
        if (!isMeasureOnly) {
          ctx.save();
          ctx.font = `500 11px ${SANS_FONT}`;
          const rText = `${rc.t('aiExport.workout.routinePrefix', '課表')} · ${session.routineTitle}`;
          const rW = ctx.measureText(rText).width + 16;
          drawRoundedBox(ctx, innerX, curY, rW, 22, 6, palette.pillSubtleBg, palette.border, 1);
          ctx.fillStyle = palette.textSecondary;
          ctx.textBaseline = 'middle';
          ctx.fillText(rText, innerX + 8, curY + 11);
          ctx.restore();
        }
        curY += 28;
      }

      for (const ex of session.exercises) {
        if (!isMeasureOnly) {
          ctx.save();
          ctx.font = `600 13px ${SANS_FONT}`;
          const displayExName = truncateText(ctx, ex.name, innerWidth);
          ctx.fillStyle = palette.textPrimary;
          ctx.textBaseline = 'top';
          ctx.textAlign = 'left';
          ctx.fillText(displayExName, innerX, curY);
          ctx.restore();
        }
        curY += 20;

        // 組數清單（雙字體分離 + 2px/3px 微距，支援多語系前綴/後綴）
        const setPrefix = rc.t('aiExport.image.setPrefix', '第');
        const setSuffix = rc.t('aiExport.image.setSuffix', '組');
        const repsUnit = rc.t('aiExport.image.repsUnit', '次');

        for (const s of ex.sets) {
          if (!isMeasureOnly) {
            const baselineY = curY + 13;
            const setLabelTokens: InlineToken[] = [
              { text: setPrefix, font: `400 11px ${SANS_FONT}`, color: palette.textSecondary },
              { text: `${s.setNumber}`, font: `500 11px ${MONO_FONT}`, color: palette.textSecondary, gap: 3 },
            ];
            if (setSuffix) {
              setLabelTokens.push({
                text: setSuffix,
                font: `400 11px ${SANS_FONT}`,
                color: palette.textSecondary,
                gap: 3,
              });
            }
            drawInlineTokens(ctx, setLabelTokens, innerX + 8, baselineY);

            const detailTokens: InlineToken[] = [
              { text: `${s.weight}`, font: `500 11px ${MONO_FONT}`, color: palette.textPrimary },
              { text: `${s.unit}`, font: `400 10.5px ${SANS_FONT}`, color: palette.textSecondary, gap: 2 },
              { text: '×', font: `400 11px ${SANS_FONT}`, color: palette.textTertiary, gap: 5 },
              { text: `${s.reps}`, font: `500 11px ${MONO_FONT}`, color: palette.textPrimary, gap: 5 },
              { text: repsUnit, font: `400 10.5px ${SANS_FONT}`, color: palette.textSecondary, gap: 2 },
            ];
            if (s.rpe) {
              detailTokens.push({
                text: `@ RPE ${s.rpe}`,
                font: `400 10.5px ${MONO_FONT}`,
                color: palette.textTertiary,
                gap: 6,
              });
            }
            const detailW = measureInlineTokens(ctx, detailTokens);
            drawInlineTokens(ctx, detailTokens, innerX + innerWidth - detailW - 8, baselineY);
          }
          curY += 18;
        }
        curY += 8;
      }
    }
  }

  curY += innerPad - 6;
  const totalCardH = curY - startY;

  return startY + totalCardH + rc.cardGap;
}

/**
 * 身體數據卡片 (對齊真實 APP 儀表板 3 欄格線：體重 / 平滑趨勢 / 體脂率 + 圍度紀錄)
 */
function renderBodyCard(
  rc: RenderContext,
  body: ExportBodySection,
  startY: number
): number {
  const { ctx, palette, paddingX, cardWidth, isMeasureOnly } = rc;
  const headerHeight = 40;
  let curY = startY;

  // 1. 標題 (灰底橫欄，不顯示日期)
  if (!isMeasureOnly) {
    ctx.save();
    drawRoundedTopBox(ctx, paddingX, startY, cardWidth, headerHeight, 8, palette.cardHeaderBg);

    ctx.lineWidth = 1;
    ctx.strokeStyle = palette.border;
    ctx.beginPath();
    ctx.moveTo(paddingX, startY + headerHeight);
    ctx.lineTo(paddingX + cardWidth, startY + headerHeight);
    ctx.stroke();

    const innerX = paddingX + 16;
    ctx.font = `600 14px ${SANS_FONT}`;
    ctx.fillStyle = palette.textPrimary;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillText(rc.t('aiExport.sections.body', '身體數據'), innerX, startY + 20);
    ctx.restore();
  }
  curY += headerHeight;

  const hasData =
    body.weight !== undefined ||
    body.trendWeight !== undefined ||
    body.bodyFat !== undefined ||
    body.circumferences.length > 0;

  if (!hasData) {
    if (!isMeasureOnly) {
      ctx.save();
      ctx.font = `400 12px ${SANS_FONT}`;
      ctx.fillStyle = palette.textTertiary;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(rc.t('aiExport.body.noLogs', '當日無身體數據記錄'), paddingX + cardWidth / 2, curY + 24);
      ctx.restore();
    }
    curY += 48;
  } else {
    // 2. 核心指標 3 等分欄 (體重 | 平滑趨勢 | 體脂率，與訓練卡片 3 欄完全對齊)
    const statH = 68;
    const colW = cardWidth / 3;

    if (!isMeasureOnly) {
      ctx.save();
      ctx.lineWidth = 1;
      ctx.strokeStyle = palette.divider;
      ctx.beginPath();
      ctx.moveTo(paddingX + colW, curY);
      ctx.lineTo(paddingX + colW, curY + statH);
      ctx.moveTo(paddingX + colW * 2, curY);
      ctx.lineTo(paddingX + colW * 2, curY + statH);
      ctx.stroke();

      const bodyStats = [
        {
          label: rc.t('body.weight', '體重'),
          val: body.weight !== undefined ? `${body.weight}` : '-',
          unit: body.weight !== undefined ? body.weightUnit : '',
          gap: 3,
          isHistorical: Boolean(body.weightIsHistorical || body.isHistoricalFallback),
        },
        {
          label: rc.t('aiExport.image.trendLabel', '平滑趨勢'),
          val: body.trendWeight !== undefined ? `${body.trendWeight}` : '-',
          unit: body.trendWeight !== undefined ? body.weightUnit : '',
          gap: 3,
          isHistorical: Boolean(
            body.weight === undefined || body.weightIsHistorical || body.isHistoricalFallback
          ),
        },
        {
          label: rc.t('aiExport.body.bodyFat', '體脂率'),
          val: body.bodyFat !== undefined ? `${body.bodyFat}` : '-',
          unit: body.bodyFat !== undefined ? '%' : '',
          gap: 2,
          isHistorical: Boolean(body.bodyFatIsHistorical || body.isHistoricalFallback),
        },
      ];

      bodyStats.forEach((st, idx) => {
        const colX = paddingX + idx * colW + 16;
        const labelY = curY + 14;
        const valBaselineY = curY + 51;

        ctx.font = `500 12px ${SANS_FONT}`;
        ctx.fillStyle = palette.textSecondary;
        ctx.textBaseline = 'top';
        ctx.textAlign = 'left';
        ctx.fillText(st.label, colX, labelY);

        if (st.unit) {
          const valColor = st.isHistorical ? palette.textTertiary : palette.textPrimary;
          const unitColor = st.isHistorical ? palette.textTertiary : palette.textSecondary;
          drawInlineTokens(
            ctx,
            [
              { text: st.val, font: `700 18px ${MONO_FONT}`, color: valColor },
              { text: st.unit, font: `400 12px ${SANS_FONT}`, color: unitColor, gap: st.gap },
            ],
            colX,
            valBaselineY
          );
        } else {
          ctx.font = `400 18px ${MONO_FONT}`;
          ctx.fillStyle = palette.textTertiary;
          ctx.textBaseline = 'alphabetic';
          ctx.fillText(st.val, colX, valBaselineY);
        }
      });

      ctx.restore();
    }
    curY += statH;

    // 3. 圍度紀錄區 (對齊真實 APP Body.tsx 等分格線網格，最多每行 4 欄，歷史數據顯示為灰色)
    if (body.circumferences.length > 0) {
      const colsPerRow = Math.min(4, body.circumferences.length);
      const rowCount = Math.ceil(body.circumferences.length / colsPerRow);
      const cellH = 60;
      const gridCellW = cardWidth / colsPerRow;

      if (!isMeasureOnly) {
        ctx.save();
        ctx.lineWidth = 1;
        ctx.strokeStyle = palette.divider;

        // 頂部水平分割線
        ctx.beginPath();
        ctx.moveTo(paddingX, curY);
        ctx.lineTo(paddingX + cardWidth, curY);
        ctx.stroke();

        // 繪製每一列的水平線與欄垂直分割線
        for (let r = 0; r < rowCount; r++) {
          const rowY = curY + r * cellH;
          if (r > 0) {
            ctx.beginPath();
            ctx.moveTo(paddingX, rowY);
            ctx.lineTo(paddingX + cardWidth, rowY);
            ctx.stroke();
          }

          for (let c = 1; c < colsPerRow; c++) {
            const lineX = paddingX + c * gridCellW;
            ctx.beginPath();
            ctx.moveTo(lineX, rowY);
            ctx.lineTo(lineX, rowY + cellH);
            ctx.stroke();
          }
        }

        // 繪製每個圍度儲存格（置中對齊 Body.tsx）
        body.circumferences.forEach((circ, idx) => {
          const r = Math.floor(idx / colsPerRow);
          const c = idx % colsPerRow;
          const cellCenterX = paddingX + c * gridCellW + gridCellW / 2;
          const rowY = curY + r * cellH;

          ctx.font = `400 11px ${SANS_FONT}`;
          ctx.fillStyle = palette.textSecondary;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';
          ctx.fillText(circ.label, cellCenterX, rowY + 12);

          const isHist = Boolean(circ.isHistorical || body.isHistoricalFallback);
          const valColor = isHist ? palette.textTertiary : palette.textPrimary;
          const unitColor = isHist ? palette.textTertiary : palette.textSecondary;
          const circTokens: InlineToken[] = [
            { text: `${circ.value}`, font: `500 15px ${MONO_FONT}`, color: valColor },
            { text: circ.unit, font: `400 11px ${SANS_FONT}`, color: unitColor, gap: 2 },
          ];
          const totalW = measureInlineTokens(ctx, circTokens);
          drawInlineTokens(ctx, circTokens, cellCenterX - totalW / 2, rowY + 44);
        });

        ctx.restore();
      }
      curY += rowCount * cellH;
    }
  }

  return curY + rc.cardGap;
}

/**
 * 底部 Footer
 */
const SHARE_SITE_URL = 'https://e2cal.pages.dev/';
const CACHED_QR_MATRIX = generateQrMatrix(SHARE_SITE_URL);

function renderFooter(rc: RenderContext, y: number): number {
  const { ctx, palette, paddingX, cardWidth, isMeasureOnly } = rc;
  const topPad = 2;
  const qrBoxSize = 54;
  const footerH = topPad + qrBoxSize;
  const edgeInset = 8;
  const contentLeft = paddingX + edgeInset;
  const contentRight = paddingX + cardWidth - edgeInset;

  if (!isMeasureOnly) {
    ctx.save();

    const contentTop = y + topPad;
    const centerY = contentTop + qrBoxSize / 2;

    // 左側：品牌描述與網站連結（比例字體）
    ctx.font = `600 12px ${BRAND_FONT}`;
    const brandName = 'e2Cal';
    const brandW = ctx.measureText(brandName).width;
    ctx.fillStyle = palette.textPrimary;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(brandName, contentLeft, centerY - 9);

    ctx.font = `400 11px ${SANS_FONT}`;
    ctx.fillStyle = palette.textSecondary;
    ctx.fillText(
      rc.t('aiExport.image.footerTagline', ' · Local-First 個人飲食與訓練追蹤'),
      contentLeft + brandW,
      centerY - 9
    );

    ctx.font = `400 11px ${SANS_FONT}`;
    ctx.fillStyle = palette.textTertiary;
    ctx.fillText(SHARE_SITE_URL, contentLeft, centerY + 10);

    // 右側：純白底高對比 QR Code 二維碼
    const qrX = contentRight - qrBoxSize;
    const qrY = contentTop;
    drawRoundedBox(ctx, qrX, qrY, qrBoxSize, qrBoxSize, 6, '#ffffff', palette.border, 1);

    const moduleCount = CACHED_QR_MATRIX.length;
    const innerPad = 4;
    const innerSize = qrBoxSize - innerPad * 2;
    const cellSize = innerSize / moduleCount;

    ctx.fillStyle = '#09090b';
    for (let r = 0; r < moduleCount; r++) {
      const y0 = Math.round(qrY + innerPad + r * cellSize);
      const y1 = Math.round(qrY + innerPad + (r + 1) * cellSize);
      for (let c = 0; c < moduleCount; c++) {
        if (CACHED_QR_MATRIX[r][c]) {
          const x0 = Math.round(qrX + innerPad + c * cellSize);
          const x1 = Math.round(qrX + innerPad + (c + 1) * cellSize);
          ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
        }
      }
    }

    ctx.restore();
  }

  return y + footerH + 20;
}

/**
 * 核心渲染程序：透過 Two-pass 計算高度並繪製「獨立卡片流 (Separated Card Stack)」
 */
export function renderDailyExportToCanvas(
  payload: DailyExportPayload,
  options?: GenerateExportImageOptions
): HTMLCanvasElement {
  const isDark =
    options?.theme === 'dark' ||
    (options?.theme === undefined &&
      typeof document !== 'undefined' &&
      document.documentElement.classList.contains('dark'));

  const palette = isDark ? DARK_PALETTE : LIGHT_PALETTE;
  const width = options?.width || 480;
  const dpr = options?.dpr || 2;
  const paddingX = 16;
  const cardWidth = width - paddingX * 2;
  const cardGap = 16;
  const cardRadius = 8;

  const t: TFunction = options?.t || i18n.t.bind(i18n);

  // 1. Pass 1: 測量總高度
  const measureCanvas =
    typeof document !== 'undefined'
      ? document.createElement('canvas')
      : ({
          getContext: () => ({
            measureText: (txt: string) => ({ width: txt.length * 7 }),
          }),
        } as unknown as HTMLCanvasElement);

  const measureCtx = measureCanvas.getContext('2d') as CanvasRenderingContext2D;

  const measureRc: RenderContext = {
    ctx: measureCtx,
    palette,
    width,
    paddingX,
    cardWidth,
    cardGap,
    isMeasureOnly: true,
    t,
  };

  let measuredY = 24;
  measuredY = renderHeader(measureRc, payload, measuredY);

  if (payload.diet) {
    // 頂部熱量 Hero Card
    measuredY = renderCaloriesHeroCard(measureRc, payload.diet, measuredY);

    // 各餐次獨立卡片
    for (const meal of payload.diet.meals) {
      measuredY = renderMealCard(measureRc, meal, measuredY);
    }
  }

  if (payload.workout) {
    measuredY = renderWorkoutHeroCard(measureRc, payload.workout, measuredY);
    if (payload.workout.sessions.length > 0) {
      measuredY = renderWorkoutExercisesCard(measureRc, payload.workout, measuredY);
    }
  }

  if (payload.body) {
    measuredY = renderBodyCard(measureRc, payload.body, measuredY);
  }

  measuredY = renderFooter(measureRc, measuredY);
  const totalHeight = measuredY;

  // 2. Pass 2: 建立目標 Canvas 並繪製底色與卡片
  const canvas =
    typeof document !== 'undefined'
      ? document.createElement('canvas')
      : (measureCanvas as HTMLCanvasElement);

  canvas.width = Math.ceil(width * dpr);
  canvas.height = Math.ceil(totalHeight * dpr);

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2D context not available');
  }

  ctx.scale(dpr, dpr);

  // 繪製畫布底色
  ctx.fillStyle = palette.canvasBg;
  ctx.fillRect(0, 0, width, totalHeight);

  const drawRc: RenderContext = {
    ctx,
    palette,
    width,
    paddingX,
    cardWidth,
    cardGap,
    isMeasureOnly: false,
    t,
  };

  let drawY = 24;
  drawY = renderHeader(drawRc, payload, drawY);

  if (payload.diet) {
    // 先畫卡片背景底色，再畫內部文字與進度條
    const startHeroY = drawY;
    const endHeroY = renderCaloriesHeroCard(measureRc, payload.diet, startHeroY);
    const heroCardH = endHeroY - startHeroY - cardGap;
    drawRoundedBox(ctx, paddingX, startHeroY, cardWidth, heroCardH, cardRadius, palette.cardBg, palette.border, 1);
    renderCaloriesHeroCard(drawRc, payload.diet, startHeroY);
    drawY = endHeroY;

    // 各餐次獨立卡片
    for (const meal of payload.diet.meals) {
      const startMealY = drawY;
      const endMealY = renderMealCard(measureRc, meal, startMealY);
      const mealCardH = endMealY - startMealY - cardGap;
      drawRoundedBox(ctx, paddingX, startMealY, cardWidth, mealCardH, cardRadius, palette.cardBg, palette.border, 1);
      renderMealCard(drawRc, meal, startMealY);
      drawY = endMealY;
    }
  }

  if (payload.workout) {
    // 1. 訓練 Hero Card (人體解剖圖與 3 欄指標)
    const startHeroY = drawY;
    const endHeroY = renderWorkoutHeroCard(measureRc, payload.workout, startHeroY);
    const heroCardH = endHeroY - startHeroY - cardGap;
    drawRoundedBox(ctx, paddingX, startHeroY, cardWidth, heroCardH, cardRadius, palette.cardBg, palette.border, 1);
    renderWorkoutHeroCard(drawRc, payload.workout, startHeroY);
    drawY = endHeroY;

    // 2. 訓練動作紀錄卡片 (若有訓練動作)
    if (payload.workout.sessions.length > 0) {
      const startExY = drawY;
      const endExY = renderWorkoutExercisesCard(measureRc, payload.workout, startExY);
      const exCardH = endExY - startExY - cardGap;
      drawRoundedBox(ctx, paddingX, startExY, cardWidth, exCardH, cardRadius, palette.cardBg, palette.border, 1);
      renderWorkoutExercisesCard(drawRc, payload.workout, startExY);
      drawY = endExY;
    }
  }

  if (payload.body) {
    const startBodyY = drawY;
    const endBodyY = renderBodyCard(measureRc, payload.body, startBodyY);
    const bodyCardH = endBodyY - startBodyY - cardGap;
    drawRoundedBox(ctx, paddingX, startBodyY, cardWidth, bodyCardH, cardRadius, palette.cardBg, palette.border, 1);
    renderBodyCard(drawRc, payload.body, startBodyY);
    drawY = endBodyY;
  }

  renderFooter(drawRc, drawY);

  return canvas;
}

/**
 * 生成 PNG Blob
 */
export async function generateDailyExportImageBlob(
  payload: DailyExportPayload,
  options?: GenerateExportImageOptions
): Promise<Blob> {
  if (typeof document !== 'undefined' && document.fonts?.load) {
    try {
      await document.fonts.load(`600 16px ${BRAND_FONT}`);
    } catch {
      // 忽略離線或測試環境字體載入 API 限制
    }
  }
  const canvas = renderDailyExportToCanvas(payload, options);
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error('Failed to generate image blob from canvas'));
      }
    }, 'image/png');
  });
}

/**
 * 生成 Data URL (用於預覽)
 */
export function generateDailyExportImageDataUrl(
  payload: DailyExportPayload,
  options?: GenerateExportImageOptions
): string {
  const canvas = renderDailyExportToCanvas(payload, options);
  return canvas.toDataURL('image/png');
}
