import { useEffect, useMemo, useRef, type RefObject } from 'react';

/** screen = world × k + (x, y) */
export interface View {
  x: number;
  y: number;
  k: number;
}

export interface Bounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Options {
  min?: number;
  max?: number;
  initial?: View;
  /** Called on every change (keep it cheap: write a transform or schedule a draw). */
  onChange: (v: View) => void;
  /** Whether a one-finger/mouse drag starting here should pan (false when it's on a card or node). */
  canPan?: (e: PointerEvent) => boolean;
}

export interface Camera {
  get(): View;
  set(v: View): void;
  zoomBy(factor: number, cx?: number, cy?: number): void;
  /** Glide so the world point (wx, wy) sits in the middle of the viewport. */
  flyTo(wx: number, wy: number, k?: number): void;
  fit(b: Bounds, padding?: number): void;
  toWorld(clientX: number, clientY: number): { x: number; y: number };
}

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/**
 * Pan & zoom for a viewport element: drag to pan, wheel or trackpad pinch to zoom,
 * two-finger touch pinch, and animated fly-to / fit.
 */
export function useCamera(ref: RefObject<HTMLElement | null>, opts: Options): Camera {
  const view = useRef<View>(opts.initial ?? { x: 0, y: 0, k: 1 });
  const optsRef = useRef(opts);
  optsRef.current = opts;
  const anim = useRef(0);

  const camera = useMemo<Camera>(() => {
    const clampK = (k: number) => Math.min(optsRef.current.max ?? 3, Math.max(optsRef.current.min ?? 0.08, k));
    const rect = () => ref.current?.getBoundingClientRect() ?? new DOMRect(0, 0, window.innerWidth, window.innerHeight);
    const apply = (v: View) => {
      view.current = v;
      optsRef.current.onChange(v);
    };
    const animateTo = (target: View) => {
      cancelAnimationFrame(anim.current);
      if (reducedMotion()) return apply(target);
      const from = view.current;
      const start = performance.now();
      const dur = 650;
      const step = (now: number) => {
        const t = Math.min(1, (now - start) / dur);
        const e = ease(t);
        // Interpolate zoom geometrically so it feels even.
        const k = from.k * (target.k / from.k) ** e;
        // Keep the world point under the viewport centre moving on a straight line.
        const r = rect();
        const c0 = { x: (r.width / 2 - from.x) / from.k, y: (r.height / 2 - from.y) / from.k };
        const c1 = { x: (r.width / 2 - target.x) / target.k, y: (r.height / 2 - target.y) / target.k };
        const cx = c0.x + (c1.x - c0.x) * e;
        const cy = c0.y + (c1.y - c0.y) * e;
        apply({ k, x: r.width / 2 - cx * k, y: r.height / 2 - cy * k });
        if (t < 1) anim.current = requestAnimationFrame(step);
      };
      anim.current = requestAnimationFrame(step);
    };
    return {
      get: () => view.current,
      set: (v) => {
        cancelAnimationFrame(anim.current);
        apply(v);
      },
      zoomBy(factor, cx, cy) {
        const r = rect();
        const px = cx ?? r.width / 2;
        const py = cy ?? r.height / 2;
        const v = view.current;
        const k = clampK(v.k * factor);
        animateTo({ k, x: px - ((px - v.x) / v.k) * k, y: py - ((py - v.y) / v.k) * k });
      },
      flyTo(wx, wy, k) {
        const r = rect();
        const kk = clampK(k ?? view.current.k);
        animateTo({ k: kk, x: r.width / 2 - wx * kk, y: r.height / 2 - wy * kk });
      },
      fit(b, padding = 60) {
        const r = rect();
        const k = clampK(Math.min((r.width - padding * 2) / Math.max(b.w, 1), (r.height - padding * 2) / Math.max(b.h, 1), 1.4));
        animateTo({ k, x: r.width / 2 - (b.x + b.w / 2) * k, y: r.height / 2 - (b.y + b.h / 2) * k });
      },
      toWorld(clientX, clientY) {
        const r = rect();
        const v = view.current;
        return { x: (clientX - r.left - v.x) / v.k, y: (clientY - r.top - v.y) / v.k };
      },
    };
  }, [ref]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const pointers = new Map<number, { x: number; y: number }>();
    let pinch: { d: number; mx: number; my: number } | null = null;

    const local = (e: { clientX: number; clientY: number }) => {
      const r = el.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const zoomAt = (factor: number, p: { x: number; y: number }) => {
      const v = view.current;
      const k = Math.min(optsRef.current.max ?? 3, Math.max(optsRef.current.min ?? 0.08, v.k * factor));
      camera.set({ k, x: p.x - ((p.x - v.x) / v.k) * k, y: p.y - ((p.y - v.y) / v.k) * k });
    };

    function onWheel(e: WheelEvent) {
      e.preventDefault();
      const p = local(e);
      const lines = e.deltaMode === 1 ? 16 : 1;
      if (e.ctrlKey) {
        // Trackpad pinch (and ctrl+wheel)
        zoomAt(Math.exp(-e.deltaY * lines * 0.01), p);
      } else if (e.deltaMode === 1 || (e.deltaX === 0 && Number.isInteger(e.deltaY) && Math.abs(e.deltaY) >= 40)) {
        // Mouse wheel notches
        zoomAt(Math.exp(-e.deltaY * lines * 0.0018), p);
      } else {
        // Two-finger trackpad scroll pans
        const v = view.current;
        camera.set({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY });
      }
    }

    function onDown(e: PointerEvent) {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      const second = pointers.size === 1;
      if (!second && optsRef.current.canPan && !optsRef.current.canPan(e)) return;
      cancelAnimationFrame(anim.current);
      pointers.set(e.pointerId, local(e));
      el!.setPointerCapture(e.pointerId);
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
      }
      el!.classList.add('is-panning');
    }
    function onMove(e: PointerEvent) {
      const prev = pointers.get(e.pointerId);
      if (!prev) return;
      const p = local(e);
      pointers.set(e.pointerId, p);
      const v = view.current;
      if (pointers.size >= 2 && pinch) {
        const [a, b] = [...pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        const mx = (a.x + b.x) / 2;
        const my = (a.y + b.y) / 2;
        const k = Math.min(optsRef.current.max ?? 3, Math.max(optsRef.current.min ?? 0.08, v.k * (d / pinch.d)));
        const wx = (pinch.mx - v.x) / v.k;
        const wy = (pinch.my - v.y) / v.k;
        camera.set({ k, x: mx - wx * k, y: my - wy * k });
        pinch = { d, mx, my };
      } else {
        camera.set({ ...v, x: v.x + p.x - prev.x, y: v.y + p.y - prev.y });
      }
    }
    function onUp(e: PointerEvent) {
      if (!pointers.delete(e.pointerId)) return;
      if (pointers.size < 2) pinch = null;
      if (!pointers.size) el!.classList.remove('is-panning');
    }

    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
    return () => {
      cancelAnimationFrame(anim.current);
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
    };
  }, [ref, camera]);

  return camera;
}
