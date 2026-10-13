import { alpha, mix } from '../../lib/color';
import { ICON_PATHS } from '../../ui/Icon';
import { ROOM_COLORS, type Kind } from '../../data/types';
import { projector, type Camera, type Projected, type Space, type SpaceNode } from './space';

/** Colours from the CSS tokens, so the sky follows the lighting and the colour scheme. */
export interface SkyPalette {
  dark: boolean;
  tape: Record<string, string>;
  ink: string;
  paper: string;
  thread: string;
  deskInk: string;
  deskInkSoft: string;
  /** Behind-the-text halo: the sky colour. */
  halo: string;
  /** Font families from the design theme. */
  fonts: { hand: string; serif: string; type: string };
  key: string;
}

export function readSkyPalette(): SkyPalette {
  const root = document.documentElement;
  const css = getComputedStyle(root);
  const v = (name: string) => css.getPropertyValue(name).trim();
  const dark = root.dataset.mode === 'dark';
  const tape = Object.fromEntries([...ROOM_COLORS, 'none'].map((c) => [c, v(`--tape-${c}`)]));
  // Same mix as --sky in palettes.css.
  const halo = dark ? mix(v('--desk-deep'), '#04060b', 0.62) : mix(v('--paper-news'), v('--desk'), 0.42);
  const p = { dark, tape, ink: v('--ink'), paper: v('--paper'), thread: v('--thread'), deskInk: v('--desk-ink'), deskInkSoft: v('--desk-ink-soft'), halo, fonts: { hand: v('--font-hand'), serif: v('--font-serif'), type: v('--font-type') } };
  return { ...p, key: JSON.stringify(p) };
}

// ─── sprites: one pre-rendered planet (and glow) per colour ──────────────────

const SPRITE = 96;
const DISC = 40; // disc radius inside the sprite
interface Sprites {
  key: string;
  disc: Map<string, HTMLCanvasElement>;
  glow: Map<string, HTMLCanvasElement>;
}
let sprites: Sprites | null = null;

function makeCanvas() {
  const c = document.createElement('canvas');
  c.width = c.height = SPRITE;
  return c;
}

function discSprite(colour: string, pal: SkyPalette) {
  const c = makeCanvas();
  const g = c.getContext('2d')!;
  const m = SPRITE / 2;
  const shade = g.createRadialGradient(m - DISC * 0.35, m - DISC * 0.4, 0, m, m, DISC);
  if (pal.dark) {
    shade.addColorStop(0, mix(colour, '#fffaf0', 0.75));
    shade.addColorStop(0.4, colour);
    shade.addColorStop(1, mix(colour, '#000000', 0.55));
  } else {
    shade.addColorStop(0, mix(colour, pal.paper, 0.55));
    shade.addColorStop(0.55, colour);
    shade.addColorStop(1, mix(colour, pal.ink, 0.28));
  }
  g.fillStyle = shade;
  g.beginPath();
  g.arc(m, m, DISC, 0, Math.PI * 2);
  g.fill();
  g.lineWidth = pal.dark ? 1.5 : 3;
  g.strokeStyle = pal.dark ? alpha(mix(colour, '#fffaf0', 0.5), 0.6) : alpha(pal.ink, 0.55);
  g.stroke();
  return c;
}

function glowSprite(colour: string) {
  const c = makeCanvas();
  const g = c.getContext('2d')!;
  const m = SPRITE / 2;
  const glow = g.createRadialGradient(m, m, 0, m, m, m);
  glow.addColorStop(0, alpha(colour, 0.55));
  glow.addColorStop(0.35, alpha(colour, 0.16));
  glow.addColorStop(1, alpha(colour, 0));
  g.fillStyle = glow;
  g.fillRect(0, 0, SPRITE, SPRITE);
  return c;
}

function spritesFor(pal: SkyPalette): Sprites {
  if (sprites?.key === pal.key) return sprites;
  const disc = new Map<string, HTMLCanvasElement>();
  const glow = new Map<string, HTMLCanvasElement>();
  for (const [name, colour] of Object.entries(pal.tape)) {
    disc.set(name, discSprite(colour, pal));
    glow.set(name, glowSprite(colour));
  }
  return (sprites = { key: pal.key, disc, glow });
}

const iconPaths = new Map<Kind, Path2D>();
const icon = (k: Kind) => {
  let p = iconPaths.get(k);
  if (!p) iconPaths.set(k, (p = new Path2D(ICON_PATHS[k])));
  return p;
};

// ─── background: stars and the celestial sphere ─────────────────────────────

/** Fixed, far-away stars (unit directions), so turning the sky shows real parallax. */
const STARS = Array.from({ length: 320 }, (_, i) => {
  const y = 1 - (2 * (i + 0.5)) / 320;
  const r = Math.sqrt(1 - y * y);
  const t = i * 2.399963229728653 * 7.3;
  return { x: Math.cos(t) * r, y, z: Math.sin(t) * r, size: i % 11 === 0 ? 1.5 : i % 3 === 0 ? 1 : 0.6, a: 0.25 + ((i * 37) % 10) / 22 };
});

function drawStars(ctx: CanvasRenderingContext2D, cam: Camera, w: number, h: number, pal: SkyPalette) {
  const cy = Math.cos(cam.yaw);
  const sy = Math.sin(cam.yaw);
  const cp = Math.cos(cam.pitch);
  const sp = Math.sin(cam.pitch);
  const f = Math.max(w, h) * 0.7;
  ctx.fillStyle = pal.dark ? '#f4f1ff' : pal.deskInk;
  for (const s of STARS) {
    const x = s.x * cy + s.z * sy;
    const z1 = -s.x * sy + s.z * cy;
    const y = s.y * cp - z1 * sp;
    const z = s.y * sp + z1 * cp;
    if (z < 0.25) continue;
    const px = w / 2 + (x / z) * f;
    const py = h / 2 + (y / z) * f;
    if (px < 0 || py < 0 || px > w || py > h) continue;
    ctx.globalAlpha = pal.dark ? s.a : s.a * 0.22;
    ctx.fillRect(px - s.size / 2, py - s.size / 2, s.size, s.size);
  }
  ctx.globalAlpha = 1;
}

type Project = (p: { x: number; y: number; z: number }) => Projected;

/** A ring in 3D, drawn in short segments so its far side can be fainter than its near side. */
function ring3d(
  ctx: CanvasRenderingContext2D,
  project: Project,
  point: (a: number) => { x: number; y: number; z: number },
  near: number,
  far: number,
  steps = 72,
) {
  let prev = project(point(0));
  for (let i = 1; i <= steps; i++) {
    const next = project(point((i / steps) * Math.PI * 2));
    ctx.globalAlpha = (prev.z + next.z) / 2 < 0 ? near : far;
    ctx.beginPath();
    ctx.moveTo(prev.x, prev.y);
    ctx.lineTo(next.x, next.y);
    ctx.stroke();
    prev = next;
  }
}

// ─── the frame ───────────────────────────────────────────────────────────────

export interface PaintState {
  width: number;
  height: number;
  dpr: number;
  focusId: string | null;
  focus: Set<string> | null;
  selected: string | null;
  hovered: string | null;
  tieFrom: string | null;
  /** Pointer position on screen, for the tie-mode rubber band. */
  pointer: { x: number; y: number } | null;
}

/** Screen positions from the last frame, nearest last, for hit-testing. */
export interface Frame {
  order: SpaceNode[];
  at: Map<string, Projected & { r: number }>;
}

const short = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s);

export function paint(ctx: CanvasRenderingContext2D, space: Space, cam: Camera, s: PaintState, pal: SkyPalette): Frame {
  const { width: w, height: h, dpr } = s;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  const { project } = projector(cam, space.extent, w, h);
  const ext = space.extent;
  const sp = spritesFor(pal);
  const depthAlpha = (z: number) => 1 - 0.55 * Math.min(1, Math.max(0, (z + ext) / (2 * ext)));
  const dim = (id: string) => (s.focus && !s.focus.has(id) ? 0.14 : 1);

  drawStars(ctx, cam, w, h, pal);

  // The celestial sphere: equator, two latitudes and three meridians.
  const G = ext * 1.08;
  ctx.lineWidth = 1;
  ctx.strokeStyle = pal.dark ? pal.deskInkSoft : pal.deskInk;
  const near = pal.dark ? 0.16 : 0.2;
  const far = pal.dark ? 0.06 : 0.07;
  for (const lat of [0, 0.7, -0.7]) {
    const r = G * Math.cos(lat);
    const y = G * Math.sin(lat);
    ring3d(ctx, project, (a) => ({ x: Math.cos(a) * r, y, z: Math.sin(a) * r }), near, far);
  }
  for (const lon of [0, Math.PI / 3, (2 * Math.PI) / 3]) {
    ring3d(ctx, project, (a) => ({ x: Math.cos(a) * Math.cos(lon) * G, y: Math.sin(a) * G, z: Math.cos(a) * Math.sin(lon) * G }), near * 0.7, far * 0.7);
  }

  // Project every node once.
  const at = new Map<string, Projected & { r: number }>();
  for (const n of space.nodes) {
    const p = project(n);
    at.set(n.id, { ...p, r: Math.max(n.room ? 7 : 2.5, n.radius * p.s) });
  }

  // Each room's orbit: a dashed ellipse in its room colour.
  ctx.setLineDash([3, 5]);
  for (const n of space.nodes) {
    if (!n.room || !n.orbit) continue;
    ctx.strokeStyle = pal.dark ? mix(pal.tape[n.color], '#ffffff', 0.15) : mix(pal.tape[n.color], pal.ink, 0.35);
    const a = dim(n.id) * (pal.dark ? 1 : 1.2);
    const o = n.orbit;
    ring3d(ctx, project, (t) => ({ x: n.x + Math.cos(t) * o, y: n.y, z: n.z + Math.sin(t) * o }), 0.4 * a, 0.16 * a, 64);
  }
  ctx.setLineDash([]);

  // Links: faint spokes, then strings as curved thread (finer when there are lots).
  const stringCount = space.links.length - (space.nodes.length - space.nodes.filter((n) => n.room).length);
  const busy = Math.min(1, Math.max(0, (stringCount - 40) / 200));
  for (const l of space.links) {
    const a = at.get(l.a)!;
    const b = at.get(l.b)!;
    const fade = Math.min(dim(l.a), dim(l.b)) * depthAlpha((a.z + b.z) / 2);
    if (!l.string) {
      const room = space.byId.get(l.a)!;
      ctx.globalAlpha = fade * (pal.dark ? 0.28 : 0.3);
      ctx.strokeStyle = pal.dark ? pal.tape[room.color] : mix(pal.tape[room.color], pal.ink, 0.4);
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      continue;
    }
    const na = space.byId.get(l.a)!;
    const nb = space.byId.get(l.b)!;
    const d = Math.hypot(nb.x - na.x, nb.y - na.y, nb.z - na.z);
    const mid = project({ x: (na.x + nb.x) / 2, y: (na.y + nb.y) / 2 + Math.min(80, d * 0.18), z: (na.z + nb.z) / 2 });
    const lit = s.focusId === l.a || s.focusId === l.b;
    ctx.globalAlpha = lit ? 0.95 : fade * (0.9 - busy * 0.6);
    ctx.strokeStyle = pal.thread;
    ctx.lineWidth = lit ? 2.4 : 1.5 - busy * 0.6;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.quadraticCurveTo(mid.x, mid.y, b.x, b.y);
    ctx.stroke();
    if (lit && l.label) {
      const tx = (a.x + 2 * mid.x + b.x) / 4;
      const ty = (a.y + 2 * mid.y + b.y) / 4;
      ctx.font = `11px ${pal.fonts.type}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const tw = ctx.measureText(l.label).width + 10;
      ctx.globalAlpha = 1;
      ctx.fillStyle = pal.paper;
      ctx.fillRect(tx - tw / 2, ty - 8, tw, 16);
      ctx.lineWidth = 0.8;
      ctx.strokeRect(tx - tw / 2, ty - 8, tw, 16);
      ctx.fillStyle = pal.thread;
      ctx.fillText(l.label, tx, ty + 0.5);
    }
  }

  // Tie mode: a dashed thread from the first pick to the pointer.
  const from = s.tieFrom ? at.get(s.tieFrom) : null;
  if (from && s.pointer) {
    ctx.globalAlpha = 0.9;
    ctx.strokeStyle = pal.thread;
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 5]);
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(s.pointer.x, s.pointer.y);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Nodes, far to near.
  const order = [...space.nodes].sort((a, b) => at.get(b.id)!.z - at.get(a.id)!.z);
  for (const n of order) {
    const p = at.get(n.id)!;
    if (p.x < -60 || p.y < -60 || p.x > w + 60 || p.y > h + 60) continue;
    const a = dim(n.id) * depthAlpha(p.z);
    const r = p.r;
    if (pal.dark) {
      ctx.globalAlpha = a * (n.room ? 0.9 : 0.75);
      const g = r * (n.room ? 3.4 : 3.8);
      ctx.drawImage(sp.glow.get(n.color)!, p.x - g, p.y - g, g * 2, g * 2);
    } else {
      // a soft shadow on the chart
      ctx.globalAlpha = a * 0.18;
      ctx.fillStyle = pal.ink;
      ctx.beginPath();
      ctx.arc(p.x + r * 0.12, p.y + r * 0.22, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = a;
    const size = (r / DISC) * SPRITE;
    ctx.drawImage(sp.disc.get(n.color)!, p.x - size / 2, p.y - size / 2, size, size);

    if (n.kind && r >= 8.5) {
      ctx.save();
      const k = (r * 1.15) / 24;
      ctx.translate(p.x - 12 * k, p.y - 12 * k);
      ctx.scale(k, k);
      ctx.lineWidth = 2.2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = alpha('#241c16', 0.72);
      ctx.stroke(icon(n.kind));
      ctx.restore();
    }
    if (n.favourite) {
      ctx.fillStyle = '#e8b938';
      ctx.beginPath();
      ctx.arc(p.x + r * 0.78, p.y - r * 0.78, Math.max(2, r * 0.3), 0, Math.PI * 2);
      ctx.fill();
    }
    const ringed = n.id === s.selected || n.id === s.tieFrom || (n.id === s.hovered && !!s.tieFrom);
    if (ringed) {
      ctx.globalAlpha = 1;
      ctx.strokeStyle = n.id === s.tieFrom || s.tieFrom ? pal.thread : pal.dark ? pal.paper : pal.ink;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r + 5, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // Labels, most important first, skipping any that would collide.
  const few = space.nodes.length <= 160;
  const candidates = order
    .filter((n) => {
      if (n.id === s.hovered || n.id === s.selected || n.room) return true;
      if (s.focus) return s.focus.has(n.id);
      return few || at.get(n.id)!.r >= 7;
    })
    .map((n) => ({ n, p: at.get(n.id)!, rank: n.id === s.hovered || n.id === s.selected ? 0 : n.room ? 1 : 2 }))
    .sort((a, b) => a.rank - b.rank || a.p.z - b.p.z)
    .slice(0, 140);
  const boxes: { x0: number; x1: number; y0: number; y1: number }[] = [];
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.lineJoin = 'round';
  for (const { n, p, rank } of candidates) {
    if (p.x < -40 || p.y < -40 || p.x > w + 40 || p.y > h + 40) continue;
    const loud = rank === 0;
    ctx.font = n.room ? `700 ${Math.round(Math.min(19, 13 + p.s * 3))}px ${pal.fonts.hand}` : `${loud ? 600 : 400} 12px ${pal.fonts.serif}`;
    const text = n.room ? n.label : short(n.label, loud ? 60 : 28);
    const tw = ctx.measureText(text).width;
    const y = p.y + p.r + (n.room ? 6 : 4);
    const lh = n.room ? 20 : 15;
    const box = { x0: p.x - tw / 2 - 3, x1: p.x + tw / 2 + 3, y0: y, y1: y + lh };
    if (!loud && boxes.some((b) => b.x0 < box.x1 && box.x0 < b.x1 && b.y0 < box.y1 && box.y0 < b.y1)) continue;
    boxes.push(box);
    ctx.globalAlpha = loud ? 1 : dim(n.id) * Math.max(0.55, depthAlpha(p.z));
    ctx.lineWidth = 4;
    ctx.strokeStyle = pal.halo;
    ctx.strokeText(text, p.x, y);
    ctx.fillStyle = n.room ? (pal.dark ? mix(pal.tape[n.color], '#ffffff', 0.3) : pal.deskInk) : pal.dark ? mix(pal.paper, '#ffffff', 0.3) : pal.deskInk;
    ctx.fillText(text, p.x, y);
  }
  ctx.globalAlpha = 1;
  return { order, at };
}

/** The node under a screen point: nearest first, with a little slop for small ones. */
export function hitTest(frame: Frame | null, x: number, y: number): SpaceNode | null {
  if (!frame) return null;
  for (let i = frame.order.length - 1; i >= 0; i--) {
    const n = frame.order[i];
    const p = frame.at.get(n.id)!;
    if (Math.hypot(p.x - x, p.y - y) <= Math.max(p.r + 3, 11)) return n;
  }
  return null;
}
