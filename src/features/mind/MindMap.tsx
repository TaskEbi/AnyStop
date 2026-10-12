import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as RKeyboardEvent, type MouseEvent as RMouseEvent, type PointerEvent as RPointerEvent } from 'react';
import { data, liveConnections } from '../../data/store';
import { toast, ui } from '../../data/ui';
import type { Item, Room } from '../../data/types';
import { useStore } from '../../lib/createStore';
import { drawerShift } from '../../lib/drawerOverlap';
import { Icon } from '../../ui/Icon';
import { TieHint, TiePrompt } from '../canvas/TiePrompt';
import { hitTest, paint, readSkyPalette, type Frame, type SkyPalette } from './paint';
import { Placard } from './Placard';
import { buildSpace, facingYaw, HOME, neighbourhood, nextStop, projector, unrotate, type Camera } from './space';
import '../canvas/canvas.css';
import './mind.css';

/** The camera survives switching views. */
let savedCamera: Camera | null = null;
const ORBIT_KEY = 'curio-mind-orbit';
const ZOOM = { min: 0.35, max: 7 };
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const clampPitch = (p: number) => Math.max(-1.35, Math.min(1.35, p));

function readOrbit() {
  try {
    return localStorage.getItem(ORBIT_KEY) !== 'off';
  } catch {
    return true;
  }
}

interface Tween {
  from: Camera;
  to: Camera;
  start: number;
  duration: number;
}

/** Rooms and exhibits as a turning constellation: drag to orbit, scroll to zoom, follow the threads. */
export function MindMap({ items, rooms }: { items: Item[]; rooms: Map<string, Room> }) {
  const connections = useStore(data, (s) => liveConnections(s.connections));
  const settings = useStore(data, (s) => s.settings);
  const tying = useStore(ui, (s) => s.tying);
  const flight = useStore(ui, (s) => s.flight);
  const space = useMemo(() => buildSpace(items, rooms, connections), [items, rooms, connections]);

  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [orbit, setOrbit] = useState(readOrbit);
  const [touring, setTouring] = useState(false);
  const [pendingTie, setPendingTie] = useState<{ a: string; b: string } | null>(null);
  const [query, setQuery] = useState('');
  const [match, setMatch] = useState<{ q: string; i: number; total: number } | null>(null);

  // Everything the frame loop reads lives in one ref, so hovering never re-renders React.
  const st = useRef({
    cam: savedCamera ?? { ...HOME },
    space,
    size: { w: 0, h: 0, dpr: 1 },
    frame: null as Frame | null,
    palette: null as SkyPalette | null,
    hovered: null as string | null,
    selected: null as string | null,
    tieFrom: null as string | null,
    pointer: null as { x: number; y: number } | null,
    orbit,
    /** Auto-orbit waits until I've left the controls alone for a moment. */
    idleUntil: 0,
    dragging: false,
    spin: { yaw: 0, pitch: 0 },
    tween: null as Tween | null,
    raf: 0,
    last: 0,
  });
  const s = st.current;
  s.space = space;
  s.selected = selected;
  s.tieFrom = tying?.from ?? null;
  s.orbit = orbit;

  const reduced = useMemo(() => window.matchMedia('(prefers-reduced-motion: reduce)'), []);

  const drawNow = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !s.size.w) return;
    s.palette ??= readSkyPalette();
    const focusId = s.hovered ?? s.selected;
    s.frame = paint(
      ctx,
      s.space,
      s.cam,
      {
        width: s.size.w,
        height: s.size.h,
        dpr: s.size.dpr,
        focusId,
        focus: focusId ? neighbourhood(s.space, focusId) : null,
        selected: s.selected,
        hovered: s.hovered,
        tieFrom: s.tieFrom,
        pointer: s.pointer,
      },
      s.palette,
    );
  }, [s]);

  /** One frame loop: auto-orbit, the spin left after a flick, and camera flights. */
  const tick = useCallback(
    (now: number) => {
      s.raf = 0;
      const dt = Math.min(50, s.last ? now - s.last : 16);
      s.last = now;
      let busy = false;
      const c = s.cam;
      if (s.tween) {
        const { from, to, start, duration } = s.tween;
        const t = Math.min(1, (now - start) / duration);
        const e = ease(t);
        const lerp = (a: number, b: number) => a + (b - a) * e;
        let dYaw = (to.yaw - from.yaw) % (Math.PI * 2);
        if (dYaw > Math.PI) dYaw -= Math.PI * 2;
        if (dYaw < -Math.PI) dYaw += Math.PI * 2;
        s.cam = {
          yaw: from.yaw + dYaw * e,
          pitch: lerp(from.pitch, to.pitch),
          zoom: Math.exp(lerp(Math.log(from.zoom), Math.log(to.zoom))),
          target: { x: lerp(from.target.x, to.target.x), y: lerp(from.target.y, to.target.y), z: lerp(from.target.z, to.target.z) },
          shift: lerp(from.shift, to.shift),
          rise: lerp(from.rise, to.rise),
        };
        if (t < 1) busy = true;
        else s.tween = null;
      } else if (!s.dragging && (Math.abs(s.spin.yaw) > 1e-5 || Math.abs(s.spin.pitch) > 1e-5)) {
        c.yaw += s.spin.yaw * dt;
        c.pitch = clampPitch(c.pitch + s.spin.pitch * dt);
        const decay = Math.pow(0.94, dt / 16);
        s.spin.yaw *= decay;
        s.spin.pitch *= decay;
        busy = true;
      } else if (s.orbit && !s.dragging && !reduced.matches && !document.hidden) {
        if (now > s.idleUntil) c.yaw += dt * 0.00011;
        busy = true;
      }
      drawNow();
      savedCamera = s.cam;
      if (busy) s.raf = requestAnimationFrame(tick);
      else s.last = 0;
    },
    [s, drawNow, reduced],
  );
  const kick = useCallback(() => {
    if (!s.raf) s.raf = requestAnimationFrame(tick);
  }, [s, tick]);

  useEffect(() => () => cancelAnimationFrame(s.raf), [s]);
  useEffect(kick, [kick, space, selected, tying, orbit]);
  // Re-read colours when the lighting or scheme changes.
  useEffect(() => {
    s.palette = null;
    kick();
  }, [s, kick, settings.theme, settings.palette]);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    // useTheme updates data-mode in its own listener; read colours after it has run.
    const onChange = () => setTimeout(() => ((s.palette = null), kick()));
    mq.addEventListener('change', onChange);
    reduced.addEventListener('change', kick);
    void document.fonts?.ready.then(kick);
    return () => {
      mq.removeEventListener('change', onChange);
      reduced.removeEventListener('change', kick);
    };
  }, [s, kick, reduced]);

  // Canvas size follows its box.
  useEffect(() => {
    const wrap = wrapRef.current!;
    const canvas = canvasRef.current!;
    const ro = new ResizeObserver(([entry]) => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const { width, height } = entry.contentRect;
      s.size = { w: width, h: height, dpr };
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      drawNow();
    });
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [s, drawNow]);

  // ── camera moves ──────────────────────────────────────────────────────────
  const flyCamera = useCallback(
    (to: Partial<Camera>, duration = 750) => {
      s.spin = { yaw: 0, pitch: 0 };
      s.tween = { from: { ...s.cam }, to: { ...s.cam, ...to }, start: performance.now(), duration: reduced.matches ? 1 : duration };
      kick();
    },
    [s, kick, reduced],
  );

  const stopMotion = useCallback(() => {
    s.idleUntil = performance.now() + 6000;
    s.tween = null;
    s.spin = { yaw: 0, pitch: 0 };
    setTouring(false);
  }, [s]);

  /** Glide to a node (turning it to face me if it's on the far side of its room) and select it. */
  const goTo = useCallback(
    (id: string, open = false) => {
      const n = s.space.byId.get(id);
      if (!n) {
        if (open) ui.set({ openItemId: id });
        return;
      }
      setSelected(id);
      const room = s.space.byId.get(n.group)!;
      const shift = open ? drawerShift(wrapRef.current) : ui.get().openItemId ? drawerShift(wrapRef.current) : 0;
      const to: Partial<Camera> = {
        target: { x: n.x, y: n.y, z: n.z },
        zoom: n.room ? Math.max(1.5, Math.min(2.6, (s.space.extent / (n.orbit ?? 100)) * 0.6)) : Math.max(s.cam.zoom, 2.6),
        shift,
        // On a phone the placard covers the lower half: lift the star above it.
        rise: window.innerWidth <= 720 ? s.size.h * 0.24 : 0,
      };
      if (!n.room) {
        const p = projector(s.cam, s.space.extent, s.size.w, s.size.h).project(room);
        const q = projector(s.cam, s.space.extent, s.size.w, s.size.h).project(n);
        // Hidden behind its own room's cloud: swing round to its side.
        if (q.z > p.z) to.yaw = facingYaw(n, room);
      }
      flyCamera(to);
      if (open) setTimeout(() => ui.set({ openItemId: id }), reduced.matches ? 0 : 650);
    },
    [s, flyCamera, reduced],
  );

  const home = useCallback(() => {
    stopMotion();
    setSelected(null);
    flyCamera({ ...HOME, yaw: s.cam.yaw });
  }, [s, flyCamera, stopMotion]);

  const zoomBy = useCallback(
    (factor: number, at?: { x: number; y: number }) => {
      const c = s.cam;
      const next = Math.min(ZOOM.max, Math.max(ZOOM.min, c.zoom * factor));
      if (at) {
        // Keep the point under the pointer still: slide the target in the screen plane.
        const { base, cx, cy } = projector(c, s.space.extent, s.size.w, s.size.h);
        const k = 1 - c.zoom / next;
        const move = unrotate({ x: ((at.x - cx) / base) * k, y: ((at.y - cy) / base) * k, z: 0 }, c.yaw, c.pitch);
        c.target = { x: c.target.x + move.x, y: c.target.y + move.y, z: c.target.z + move.z };
      }
      c.zoom = next;
      s.tween = null;
      s.idleUntil = performance.now() + 6000;
      kick();
    },
    [s, kick],
  );

  const pan = useCallback(
    (dx: number, dy: number) => {
      const c = s.cam;
      const { base } = projector(c, s.space.extent, s.size.w, s.size.h);
      const move = unrotate({ x: -dx / base, y: -dy / base, z: 0 }, c.yaw, c.pitch);
      c.target = { x: c.target.x + move.x, y: c.target.y + move.y, z: c.target.z + move.z };
      kick();
    },
    [s, kick],
  );

  const turn = useCallback(
    (dx: number, dy: number) => {
      s.cam.yaw += dx * 0.0065;
      s.cam.pitch = clampPitch(s.cam.pitch + dy * 0.0065);
      kick();
    },
    [s, kick],
  );

  // A selection that has been filtered away disappears.
  useEffect(() => {
    if (selected && !space.byId.has(selected)) setSelected(null);
  }, [space, selected]);

  // Make room only for what's on screen: the placard (phones) and the drawer.
  const drawerOpen = useStore(ui, (u) => !!u.openItemId);
  useEffect(() => {
    if (s.tween) return;
    const rise = selected ? s.cam.rise : 0;
    const shift = drawerOpen ? s.cam.shift : 0;
    if (s.cam.rise !== rise || s.cam.shift !== shift) flyCamera({ rise, shift }, 400);
  }, [s, selected, drawerOpen, flyCamera]);

  // "Surprise me" and jumps from the drawer.
  useEffect(() => {
    if (flight) goTo(flight.id, true);
  }, [flight, goTo]);

  // ── guided tour ───────────────────────────────────────────────────────────
  const seen = useRef(new Set<string>());
  useEffect(() => {
    if (!touring) return;
    const step = () => {
      const current = st.current.selected;
      if (current) seen.current.add(current);
      const next = nextStop(st.current.space, current && !st.current.space.byId.get(current)?.room ? current : null, seen.current);
      if (!next) {
        setTouring(false);
        toast('Tour complete: you have seen everything on show');
        return;
      }
      seen.current.add(next);
      goTo(next);
    };
    step();
    const timer = setInterval(step, reduced.matches ? 5000 : 3800);
    return () => clearInterval(timer);
  }, [touring, goTo, reduced]);

  // Esc: leave tie mode, stop the tour, then clear the selection.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented || pendingTie || document.querySelector('dialog[open]')) return;
      if (ui.get().tying) ui.set({ tying: null });
      else if (touring) setTouring(false);
      else setSelected(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pendingTie, touring]);

  // Wheel and trackpad pinch (ctrl+wheel) zoom towards the pointer.
  useEffect(() => {
    const wrap = wrapRef.current!;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = wrap.getBoundingClientRect();
      const speed = e.ctrlKey ? 0.012 : e.deltaMode === 1 ? 0.05 : 0.0016;
      zoomBy(Math.exp(-e.deltaY * speed), { x: e.clientX - rect.left, y: e.clientY - rect.top });
    };
    wrap.addEventListener('wheel', onWheel, { passive: false });
    return () => wrap.removeEventListener('wheel', onWheel);
  }, [zoomBy]);

  // ── pointer ───────────────────────────────────────────────────────────────
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ x0: number; y0: number; moved: boolean; pan: boolean; t: number; pinch?: { d: number; mx: number; my: number } } | null>(null);
  const local = (e: { clientX: number; clientY: number }) => {
    const r = wrapRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  function choose(id: string | null) {
    const t = ui.get().tying;
    const n = id ? s.space.byId.get(id) : null;
    if (t) {
      if (!n || n.room) return;
      if (!t.from) ui.set({ tying: { from: n.id } });
      else if (t.from !== n.id) setPendingTie({ a: t.from, b: n.id });
      return;
    }
    setSelected(id);
  }

  function pinchState() {
    const [a, b] = [...pointers.current.values()];
    return { d: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
  }

  function onPointerDown(e: RPointerEvent) {
    if (e.target !== e.currentTarget && e.target !== canvasRef.current) return;
    const p = local(e);
    pointers.current.set(e.pointerId, p);
    stopMotion();
    if (pointers.current.size === 2) {
      gesture.current = { x0: p.x, y0: p.y, moved: true, pan: false, t: performance.now(), pinch: pinchState() };
      return;
    }
    gesture.current = { x0: p.x, y0: p.y, moved: false, pan: e.shiftKey || e.button === 1 || e.button === 2, t: performance.now() };
  }

  function onPointerMove(e: RPointerEvent) {
    const p = local(e);
    s.pointer = p;
    const prev = pointers.current.get(e.pointerId);
    const g = gesture.current;
    if (!prev || !g) {
      if (e.pointerType === 'mouse') {
        const h = hitTest(s.frame, p.x, p.y)?.id ?? null;
        if (h !== s.hovered) {
          s.hovered = h;
          wrapRef.current!.style.cursor = h ? 'pointer' : '';
          kick();
        } else if (s.tieFrom) kick();
      }
      return;
    }
    pointers.current.set(e.pointerId, p);
    if (g.pinch && pointers.current.size === 2) {
      const now = pinchState();
      zoomBy(now.d / g.pinch.d, { x: now.mx, y: now.my });
      pan(now.mx - g.pinch.mx, now.my - g.pinch.my);
      g.pinch = now;
      return;
    }
    if (!g.moved) {
      if (Math.hypot(p.x - g.x0, p.y - g.y0) < 4) return;
      g.moved = true;
      s.dragging = true;
      s.hovered = null;
      wrapRef.current!.setPointerCapture(e.pointerId);
      wrapRef.current!.classList.add('is-panning');
    }
    const dx = p.x - prev.x;
    const dy = p.y - prev.y;
    if (g.pan) pan(dx, dy);
    else {
      turn(dx, dy);
      // Remember the flick so the sky keeps turning a little after I let go.
      const now = performance.now();
      const dt = Math.max(8, now - g.t);
      g.t = now;
      s.spin = { yaw: ((dx * 0.0065) / dt) * 0.9, pitch: ((dy * 0.0065) / dt) * 0.9 };
    }
  }

  function onPointerUp(e: RPointerEvent) {
    const g = gesture.current;
    pointers.current.delete(e.pointerId);
    if (pointers.current.size) {
      // Lifting one finger of a pinch: carry on with the other as a fresh drag.
      const [rest] = [...pointers.current.values()];
      gesture.current = { x0: rest.x, y0: rest.y, moved: true, pan: false, t: performance.now() };
      return;
    }
    gesture.current = null;
    s.dragging = false;
    wrapRef.current!.classList.remove('is-panning');
    if (!g) return;
    s.idleUntil = performance.now() + 6000;
    if (!g.moved) {
      const p = local(e);
      choose(hitTest(s.frame, p.x, p.y)?.id ?? null);
    } else if (performance.now() - g.t > 80 || g.pan) s.spin = { yaw: 0, pitch: 0 };
    kick();
  }

  function onDoubleClick(e: RMouseEvent) {
    const p = local(e);
    const n = hitTest(s.frame, p.x, p.y);
    if (!n || ui.get().tying) return;
    if (n.room) goTo(n.id);
    else goTo(n.id, true);
  }

  function onKeyDown(e: RKeyboardEvent) {
    const step = e.shiftKey ? 40 : 0.14;
    const k = e.key;
    if (k.startsWith('Arrow')) {
      e.preventDefault();
      stopMotion();
      const dx = k === 'ArrowLeft' ? -1 : k === 'ArrowRight' ? 1 : 0;
      const dy = k === 'ArrowUp' ? -1 : k === 'ArrowDown' ? 1 : 0;
      if (e.shiftKey) pan(-dx * step, -dy * step);
      else flyCamera({ yaw: s.cam.yaw + dx * step, pitch: clampPitch(s.cam.pitch + dy * step) }, 220);
    } else if (k === '+' || k === '=') zoomBy(1.25);
    else if (k === '-' || k === '_') zoomBy(0.8);
    else if (k === '0' || k === 'Home') home();
    else if (k === 'Enter' && selected && !s.space.byId.get(selected)?.room) ui.set({ openItemId: selected });
  }

  // ── search: Enter jumps to the first match, Enter again to the next ───────
  function search() {
    const q = query.trim().toLowerCase();
    if (!q) return;
    const hits = s.space.nodes
      .filter((n) => n.label.toLowerCase().includes(q))
      .sort((a, b) => Number(a.room) - Number(b.room));
    if (!hits.length) {
      setMatch({ q, i: -1, total: 0 });
      return;
    }
    const i = match && match.q === q && match.total === hits.length ? (match.i + 1) % hits.length : 0;
    setMatch({ q, i, total: hits.length });
    stopMotion();
    goTo(hits[i].id);
  }

  const stringCount = useMemo(() => space.links.filter((l) => l.string).length, [space]);
  const roomCount = useMemo(() => space.nodes.filter((n) => n.room).length, [space]);
  const selectedNode = selected ? space.byId.get(selected) : undefined;

  return (
    <section className="mind-wrap" aria-label="Mind Map 3D">
      <div
        ref={wrapRef}
        className={`canvas-view mind-view ${tying ? 'is-tying' : ''}`}
        tabIndex={0}
        aria-label={`3D mind map of ${items.length} exhibits in ${roomCount} rooms. Arrow keys turn it, plus and minus zoom, 0 resets.`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={() => {
          if (gesture.current) return;
          s.hovered = null;
          s.pointer = null;
          kick();
        }}
        onDoubleClick={onDoubleClick}
        onContextMenu={(e) => e.preventDefault()}
        onKeyDown={onKeyDown}
      >
        <canvas ref={canvasRef} className="mind-view__canvas" aria-hidden="true" />
        <div className="mind-cartouche" aria-hidden="true">
          <p className="mind-cartouche__title hand">{settings.museum_name}</p>
          <p className="mind-cartouche__sub type">
            {items.length} exhibits · {roomCount} rooms · {stringCount} strings
          </p>
        </div>
        {!items.length && (
          <div className="mind-empty">
            <p className="hand">An empty sky</p>
            <p>Add exhibits, or clear the filters, to light it up.</p>
          </div>
        )}
        <p className="mind-hint type" aria-hidden="true">
          <span className="mind-hint--mouse">Drag to turn · Shift-drag to pan · Scroll to zoom · Double-click to open</span>
          <span className="mind-hint--touch">Drag to turn · Pinch to zoom · Two fingers to pan</span>
        </p>
      </div>

      <div className="canvas-tools" onPointerDown={() => setTouring(false)}>
        <form
          className="canvas-tools__search"
          onSubmit={(e) => {
            e.preventDefault();
            search();
          }}
        >
          <Icon name="search" size={15} />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setMatch(null);
            }}
            placeholder="Find a star"
            aria-label="Find in the 3D map (Enter for the next match)"
          />
          {match && match.q === query.trim().toLowerCase() && (
            <span className="mind-match type" role="status">
              {match.total ? `${match.i + 1}/${match.total}` : 'none'}
            </span>
          )}
        </form>
        <div className="canvas-tools__group">
          <button type="button" className="btn btn--icon" onClick={() => zoomBy(1 / 1.35)} aria-label="Zoom out" title="Zoom out (−)">
            −
          </button>
          <button type="button" className="btn btn--icon" onClick={() => zoomBy(1.35)} aria-label="Zoom in" title="Zoom in (+)">
            +
          </button>
          <button type="button" className="btn" onClick={home} title="Back to the whole sky (0)">
            Reset
          </button>
        </div>
        <div className="canvas-tools__group">
          <button
            type="button"
            className="btn"
            aria-pressed={orbit}
            title="Slowly turn the sky"
            onClick={() => {
              const next = !orbit;
              setOrbit(next);
              try {
                localStorage.setItem(ORBIT_KEY, next ? 'on' : 'off');
              } catch {
                /* fine */
              }
            }}
          >
            <Icon name="orbit" size={15} /> Orbit
          </button>
          <button
            type="button"
            className="btn"
            aria-pressed={touring}
            disabled={!items.length}
            title="A guided tour along your strings"
            onClick={(e) => {
              e.stopPropagation();
              if (touring) return setTouring(false);
              seen.current = new Set();
              ui.set({ tying: null });
              setTouring(true);
            }}
          >
            {touring ? 'Stop tour' : 'Tour'}
          </button>
          <button
            type="button"
            className="btn"
            aria-pressed={!!tying}
            onClick={() => ui.set(tying ? { tying: null } : { tying: { from: null }, openItemId: null })}
            title="Tie a string between two exhibits"
          >
            Tie a string
          </button>
        </div>
      </div>

      {selectedNode && !tying && !pendingTie && (
        <Placard
          node={selectedNode}
          space={space}
          touring={touring}
          onGo={(id) => {
            setTouring(false);
            goTo(id);
          }}
          onOpen={(id) => goTo(id, true)}
          onClose={() => setSelected(null)}
        />
      )}
      {tying && !pendingTie && <TieHint picked={!!tying.from} />}
      {pendingTie && <TiePrompt a={pendingTie.a} b={pendingTie.b} onDone={() => setPendingTie(null)} />}
    </section>
  );
}
