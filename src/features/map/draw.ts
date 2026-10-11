import type { Kind } from '../../data/types';
import type { View } from '../../lib/camera';
import { ICON_PATHS } from '../../ui/Icon';
import type { GLink, GNode } from './graph';

export interface Palette {
  tape: Record<string, string>;
  paper: string;
  ink: string;
  inkSoft: string;
  inkFaint: string;
  thread: string;
  deskInk: string;
}

/** Colours come from the CSS tokens, so the map follows light/dark like everything else. */
export function readPalette(): Palette {
  const css = getComputedStyle(document.documentElement);
  const v = (name: string) => css.getPropertyValue(name).trim();
  return {
    tape: Object.fromEntries(['mustard', 'sage', 'blue', 'rose', 'lavender', 'apricot', 'none'].map((c) => [c, v(`--tape-${c}`)])),
    paper: v('--paper'),
    ink: v('--ink'),
    inkSoft: v('--ink-soft'),
    inkFaint: v('--ink-faint'),
    thread: v('--thread'),
    deskInk: v('--desk-ink'),
  };
}

const iconPaths = new Map<Kind, Path2D>();
const icon = (k: Kind) => {
  let p = iconPaths.get(k);
  if (!p) iconPaths.set(k, (p = new Path2D(ICON_PATHS[k])));
  return p;
};

const short = (s: string, n = 26) => (s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s);

export interface DrawState {
  view: View;
  width: number;
  height: number;
  dpr: number;
  focus: Set<string> | null;
  hovered: GNode | null;
  tieFrom: GNode | null;
  pointer: { x: number; y: number } | null;
  palette: Palette;
}

/** Curve control point: strings sag a little, like real thread. */
function sag(a: GNode, b: GNode) {
  const mx = ((a.x ?? 0) + (b.x ?? 0)) / 2;
  const my = ((a.y ?? 0) + (b.y ?? 0)) / 2;
  const d = Math.hypot((b.x ?? 0) - (a.x ?? 0), (b.y ?? 0) - (a.y ?? 0));
  return { cx: mx, cy: my + Math.min(60, d * 0.14) };
}

function wrap(ctx: CanvasRenderingContext2D, text: string, max: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (ctx.measureText(next).width > max && line) {
      lines.push(line);
      line = w;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines.slice(0, 3);
}

export function drawMap(ctx: CanvasRenderingContext2D, nodes: GNode[], links: GLink[], s: DrawState) {
  const { view, dpr, palette: pal } = s;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, s.width, s.height);
  ctx.setTransform(dpr * view.k, 0, 0, dpr * view.k, dpr * view.x, dpr * view.y);

  // Visible world rectangle (with margin) for culling.
  const vx0 = -view.x / view.k - 80;
  const vy0 = -view.y / view.k - 80;
  const vx1 = (s.width - view.x) / view.k + 80;
  const vy1 = (s.height - view.y) / view.k + 80;
  const onScreen = (n: GNode) => (n.x ?? 0) > vx0 - n.r && (n.x ?? 0) < vx1 + n.r && (n.y ?? 0) > vy0 - n.r && (n.y ?? 0) < vy1 + n.r;
  const dim = (id: string) => (s.focus && !s.focus.has(id) ? 0.13 : 1);
  const px = 1 / view.k; // one screen pixel in world units

  // ── links: faint room lines, dotted tag lines, red strings ───────────────
  for (const l of links) {
    const a = l.source as GNode;
    const b = l.target as GNode;
    if (!onScreen(a) && !onScreen(b)) continue;
    const alpha = Math.min(dim(a.id), dim(b.id));
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    if (l.type === 'string') {
      const { cx, cy } = sag(a, b);
      ctx.moveTo(a.x!, a.y!);
      ctx.quadraticCurveTo(cx, cy, b.x!, b.y!);
      ctx.strokeStyle = pal.thread;
      ctx.lineWidth = Math.max(1.8, 1.6 * px);
      ctx.setLineDash([]);
      ctx.stroke();
    } else {
      ctx.moveTo(a.x!, a.y!);
      ctx.lineTo(b.x!, b.y!);
      ctx.strokeStyle = pal.deskInk;
      ctx.globalAlpha = alpha * (l.type === 'room' ? 0.22 : 0.3);
      ctx.lineWidth = px;
      ctx.setLineDash(l.type === 'tag' ? [3 * px, 4 * px] : []);
      ctx.stroke();
    }
  }
  ctx.setLineDash([]);

  // string labels on little paper tags
  if (view.k > 0.55) {
    ctx.font = `${10}px "Courier Prime", monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const l of links) {
      if (l.type !== 'string' || !l.label) continue;
      const a = l.source as GNode;
      const b = l.target as GNode;
      if (!onScreen(a) && !onScreen(b)) continue;
      const { cx, cy } = sag(a, b);
      const tx = (a.x! + 2 * cx + b.x!) / 4;
      const ty = (a.y! + 2 * cy + b.y!) / 4;
      const w = ctx.measureText(l.label).width + 10;
      ctx.globalAlpha = Math.min(dim(a.id), dim(b.id));
      ctx.fillStyle = pal.paper;
      ctx.fillRect(tx - w / 2, ty - 7, w, 14);
      ctx.strokeStyle = pal.thread;
      ctx.lineWidth = 0.8;
      ctx.strokeRect(tx - w / 2, ty - 7, w, 14);
      ctx.fillStyle = pal.thread;
      ctx.fillText(l.label, tx, ty + 0.5);
    }
  }

  // tie-mode rubber band from the first pick to the pointer
  if (s.tieFrom && s.pointer) {
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.moveTo(s.tieFrom.x!, s.tieFrom.y!);
    ctx.lineTo(s.pointer.x, s.pointer.y);
    ctx.strokeStyle = pal.thread;
    ctx.lineWidth = 2 * px;
    ctx.setLineDash([6 * px, 5 * px]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // ── nodes ────────────────────────────────────────────────────────────────
  const showLabels = view.k >= 0.85;
  for (const n of nodes) {
    if (!onScreen(n)) continue;
    const x = n.x!;
    const y = n.y!;
    ctx.globalAlpha = dim(n.id);
    const colour = pal.tape[n.color ?? 'none'];

    if (n.type === 'room') {
      // paper disc with a band of room-coloured tape around it
      ctx.shadowColor = 'rgba(40,25,10,.35)';
      ctx.shadowBlur = 12;
      ctx.shadowOffsetY = 4;
      ctx.beginPath();
      ctx.arc(x, y, n.r, 0, Math.PI * 2);
      ctx.fillStyle = pal.paper;
      ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.lineWidth = 7;
      ctx.strokeStyle = colour;
      ctx.beginPath();
      ctx.arc(x, y, n.r - 3.5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = pal.ink;
      ctx.font = `700 ${Math.max(13, Math.min(20, n.r / 2.4))}px Kalam, cursive`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const lines = wrap(ctx, n.label, n.r * 1.6);
      const lh = Math.max(13, Math.min(20, n.r / 2.4)) * 1.05;
      lines.forEach((line, i) => ctx.fillText(line, x, y + (i - (lines.length - 1) / 2) * lh + 1));
    } else if (n.type === 'tag') {
      ctx.font = `11px "Courier Prime", monospace`;
      const w = ctx.measureText(n.label).width + 12;
      ctx.fillStyle = pal.paper;
      ctx.strokeStyle = pal.inkFaint;
      ctx.lineWidth = px;
      ctx.beginPath();
      ctx.roundRect(x - w / 2, y - 9, w, 18, 9);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = pal.inkSoft;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(n.label, x, y + 0.5);
    } else {
      // a map pin: coloured head with the kind icon (offset disc for a shadow: blur is too slow for 1000s)
      ctx.beginPath();
      ctx.arc(x + 0.6, y + 2, n.r + 0.5, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(40,25,10,.28)';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x, y, n.r, 0, Math.PI * 2);
      ctx.fillStyle = colour;
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(40,25,10,.45)';
      ctx.stroke();
      if (n.kind && view.k > 0.35) {
        ctx.save();
        ctx.translate(x - 6, y - 6);
        ctx.scale(0.5, 0.5);
        ctx.lineWidth = 2.4;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = '#2a221c';
        ctx.stroke(icon(n.kind));
        ctx.restore();
      }
      if (n.favourite) {
        ctx.fillStyle = '#e0b23c';
        ctx.beginPath();
        ctx.arc(x + n.r * 0.75, y - n.r * 0.75, 3.2, 0, Math.PI * 2);
        ctx.fill();
      }
      const emphasised = s.hovered === n || (s.focus?.has(n.id) ?? false);
      if (showLabels || emphasised) {
        ctx.font = `${emphasised ? 600 : 400} 11px Literata, Georgia, serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        const text = short(n.label);
        const w = ctx.measureText(text).width;
        ctx.fillStyle = pal.paper;
        ctx.globalAlpha = dim(n.id) * 0.85;
        ctx.fillRect(x - w / 2 - 3, y + n.r + 2, w + 6, 14);
        ctx.globalAlpha = dim(n.id);
        ctx.fillStyle = pal.ink;
        ctx.fillText(text, x, y + n.r + 3);
      }
    }

    if (s.tieFrom === n || (s.hovered === n && s.tieFrom)) {
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.arc(x, y, n.r + 5, 0, Math.PI * 2);
      ctx.strokeStyle = pal.thread;
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
}
