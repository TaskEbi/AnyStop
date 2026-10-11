import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as RPointerEvent } from 'react';
import { resetCollage, updateItem } from '../../data/actions';
import { data, liveConnections } from '../../data/store';
import { toast, ui } from '../../data/ui';
import type { Item, Room } from '../../data/types';
import { useCamera, type View } from '../../lib/camera';
import { estimateCardHeight } from '../../lib/cardSize';
import { useStore } from '../../lib/createStore';
import { drawerShift } from '../../lib/drawerOverlap';
import { Icon } from '../../ui/Icon';
import { InlineConfirm } from '../../ui/InlineConfirm';
import { tapeVar } from '../../ui/labels';
import { TieHint, TiePrompt } from '../canvas/TiePrompt';
import { Card } from '../shelves/Card';
import { autoLayout, CARD_W, groupByRoom, matRect, union, type Rect } from './layout';
import { Yarn } from './Yarn';
import '../canvas/canvas.css';
import './collage.css';

let savedView: View | null = null;
const LOD_BELOW = 0.3;
const CULL_MARGIN = 450;
const SNAP = 400;

interface Props {
  items: Item[];
  rooms: Map<string, Room>;
}

/** The scrapbook spread: room mats on a corkboard, cards you can drag anywhere, red yarn between them. */
export function Collage({ items, rooms }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const connections = useStore(data, (s) => liveConnections(s.connections));
  const tying = useStore(ui, (s) => s.tying);
  const flight = useStore(ui, (s) => s.flight);
  const [showStrings, setShowStrings] = useState(true);
  const [pendingTie, setPendingTie] = useState<{ a: string; b: string } | null>(null);
  const [drag, setDrag] = useState<{ id: string; x: number; y: number } | null>(null);
  const [pinned, setPinned] = useState<string | null>(null);
  const [heights, setHeights] = useState<Map<string, number>>(() => new Map());
  const [window_, setWindow] = useState<{ rect: Rect; lod: boolean } | null>(null);

  // ── layout ───────────────────────────────────────────────────────────────
  const groups = useMemo(() => groupByRoom(items, rooms), [items, rooms]);
  const auto = useMemo(() => autoLayout(groups), [groups]);
  const rects = useMemo(() => {
    const m = new Map<string, Rect>();
    for (const i of items) {
      const p = i.collage_pos ?? auto.get(i.id) ?? { x: 0, y: 0 };
      m.set(i.id, { x: p.x, y: p.y, w: CARD_W, h: heights.get(i.id) ?? estimateCardHeight(i, CARD_W) });
    }
    return m;
  }, [items, auto, heights]);
  const liveRects = useMemo(() => {
    if (!drag) return rects;
    const m = new Map(rects);
    const r = m.get(drag.id);
    if (r) m.set(drag.id, { ...r, x: drag.x, y: drag.y });
    return m;
  }, [rects, drag]);
  const mats = useMemo(() => groups.map((g) => ({ g, rect: matRect(g.items.map((i) => liveRects.get(i.id)!)) })), [groups, liveRects]);
  const everything = useMemo(() => union(mats.map((m) => m.rect)), [mats]);
  const strings = useMemo(() => connections.filter((c) => rects.has(c.item_a) && rects.has(c.item_b)), [connections, rects]);

  // ── camera + culling ─────────────────────────────────────────────────────
  const cullFor = useCallback((v: View) => {
    const wrap = wrapRef.current;
    const w = wrap?.clientWidth ?? window.innerWidth;
    const h = wrap?.clientHeight ?? window.innerHeight;
    const m = CULL_MARGIN / v.k;
    const x0 = Math.floor((-v.x / v.k - m) / SNAP) * SNAP;
    const y0 = Math.floor((-v.y / v.k - m) / SNAP) * SNAP;
    const x1 = Math.ceil(((w - v.x) / v.k + m) / SNAP) * SNAP;
    const y1 = Math.ceil(((h - v.y) / v.k + m) / SNAP) * SNAP;
    return { rect: { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }, lod: v.k < LOD_BELOW };
  }, []);
  const cullRaf = useRef(0);
  const camera = useCamera(wrapRef, {
    min: 0.08,
    max: 2.5,
    initial: savedView ?? undefined,
    onChange: (v) => {
      savedView = v;
      if (worldRef.current) worldRef.current.style.transform = `translate(${v.x}px, ${v.y}px) scale(${v.k})`;
      if (!cullRaf.current) {
        cullRaf.current = requestAnimationFrame(() => {
          cullRaf.current = 0;
          const next = cullFor(v);
          setWindow((prev) => (prev && prev.lod === next.lod && JSON.stringify(prev.rect) === JSON.stringify(next.rect) ? prev : next));
        });
      }
    },
    canPan: (e) => !(e.target as Element).closest('.collage-card, .collage-ui'),
  });

  useLayoutEffect(() => {
    if (savedView) camera.set(savedView);
    else {
      camera.set({ x: 0, y: 0, k: 0.5 });
      requestAnimationFrame(() => camera.fit(everything, 40));
    }
    return () => cancelAnimationFrame(cullRaf.current);
    // Only on mount: later fits are the user's call.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera]);

  // ── measure real card heights so mats and strings fit snugly ─────────────
  const pendingHeights = useRef(new Map<string, number>());
  const observer = useMemo(
    () =>
      new ResizeObserver((entries) => {
        for (const e of entries) {
          const id = (e.target as HTMLElement).dataset.id;
          if (id) pendingHeights.current.set(id, Math.round(e.contentRect.height));
        }
        requestAnimationFrame(() => {
          if (!pendingHeights.current.size) return;
          const batch = pendingHeights.current;
          pendingHeights.current = new Map();
          setHeights((prev) => {
            let changed = false;
            for (const [id, h] of batch) if (Math.abs((prev.get(id) ?? 0) - h) > 2) changed = true;
            return changed ? new Map([...prev, ...batch]) : prev;
          });
        });
      }),
    [],
  );
  useEffect(() => () => observer.disconnect(), [observer]);

  // ── fly-to requests (random wander, jumping along a string) ──────────────
  useEffect(() => {
    if (!flight) return;
    const r = rects.get(flight.id);
    if (r) {
      camera.flyTo(r.x + r.w / 2, r.y + r.h / 2, Math.max(camera.get().k, 0.95), drawerShift(wrapRef.current));
      setTimeout(() => ui.set({ openItemId: flight.id }), 620);
    } else ui.set({ openItemId: flight.id });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flight]);

  useEffect(() => {
    if (!tying) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !pendingTie) ui.set({ tying: null });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tying, pendingTie]);

  // ── dragging cards ───────────────────────────────────────────────────────
  const press = useRef<{ id: string; sx: number; sy: number; ox: number; oy: number; moved: boolean } | null>(null);
  const justDragged = useRef(false);

  function onCardDown(e: RPointerEvent, id: string) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const r = rects.get(id);
    if (!r) return;
    press.current = { id, sx: e.clientX, sy: e.clientY, ox: r.x, oy: r.y, moved: false };
  }
  function onCardMove(e: RPointerEvent) {
    const p = press.current;
    if (!p) return;
    const k = camera.get().k;
    const dx = (e.clientX - p.sx) / k;
    const dy = (e.clientY - p.sy) / k;
    if (!p.moved && Math.hypot(e.clientX - p.sx, e.clientY - p.sy) > 5) {
      p.moved = true;
      // Capture only once it's a drag, so a plain click still reaches the card.
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    }
    if (p.moved) setDrag({ id: p.id, x: p.ox + dx, y: p.oy + dy });
  }
  function onCardUp() {
    const p = press.current;
    press.current = null;
    if (!p?.moved || !drag) return;
    justDragged.current = true;
    setTimeout(() => (justDragged.current = false), 50);
    updateItem(p.id, { collage_pos: { x: Math.round(drag.x), y: Math.round(drag.y) } });
    setDrag(null);
    setPinned(p.id);
    setTimeout(() => setPinned((cur) => (cur === p.id ? null : cur)), 700);
  }

  const activate = useCallback(
    (id: string) => {
      if (justDragged.current) return;
      const t = ui.get().tying;
      if (t) {
        if (!t.from) ui.set({ tying: { from: id } });
        else if (t.from !== id) setPendingTie({ a: t.from, b: id });
        return;
      }
      ui.set({ openItemId: id });
    },
    [],
  );

  // ── render ───────────────────────────────────────────────────────────────
  const view = window_ ?? cullFor(camera.get());
  const inView = (r: Rect) => r.x + r.w > view.rect.x && r.x < view.rect.x + view.rect.w && r.y + r.h > view.rect.y && r.y < view.rect.y + view.rect.h;
  const roomOf = (i: Item) => (i.room_id ? rooms.get(i.room_id) : undefined);

  return (
    <section className="collage-wrap" aria-label="Collage">
      <div ref={wrapRef} className={`canvas-view collage ${tying ? 'is-tying' : ''}`}>
        <div ref={worldRef} className="collage__world">
          {mats.map(({ g, rect }) => (
            <div
              key={g.key}
              className="mat"
              style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h, '--mat': tapeVar(g.room?.color) } as CSSProperties}
            >
              <span className="mat__label hand">{g.room?.name ?? 'Unsorted'}</span>
            </div>
          ))}

          {items.map((item) => {
            const r = liveRects.get(item.id)!;
            if (!inView(r) && drag?.id !== item.id) return null;
            const dragging = drag?.id === item.id;
            return (
              <div
                key={item.id}
                data-id={item.id}
                className={`collage-card ${dragging ? 'is-dragging' : ''} ${pinned === item.id ? 'is-pinned' : ''} ${tying?.from === item.id ? 'is-tie-from' : ''}`}
                style={{ left: r.x, top: r.y, width: CARD_W }}
                ref={(el) => {
                  if (el && !view.lod) observer.observe(el);
                }}
                onPointerDown={(e) => onCardDown(e, item.id)}
                onPointerMove={onCardMove}
                onPointerUp={onCardUp}
                onPointerCancel={() => {
                  press.current = null;
                  setDrag(null);
                }}
              >
                {view.lod ? (
                  <div className="collage-card__lod" style={{ height: r.h, '--mat': tapeVar(roomOf(item)?.color) } as CSSProperties}>
                    <span>{item.title}</span>
                  </div>
                ) : (
                  <Card item={item} room={roomOf(item)} tilt={4} onOpen={activate} />
                )}
              </div>
            );
          })}

          {showStrings && <Yarn connections={strings} rects={rects} override={drag} />}
        </div>
      </div>

      <div className="canvas-tools collage-ui">
        <div className="canvas-tools__group">
          <button type="button" className="btn btn--icon" onClick={() => camera.zoomBy(1 / 1.4)} aria-label="Zoom out" title="Zoom out">
            −
          </button>
          <button type="button" className="btn btn--icon" onClick={() => camera.zoomBy(1.4)} aria-label="Zoom in" title="Zoom in">
            +
          </button>
          <button type="button" className="btn" onClick={() => camera.fit(everything, 40)} title="Fit everything">
            Fit
          </button>
        </div>
        <div className="canvas-tools__group">
          <button type="button" className="btn" aria-pressed={showStrings} onClick={() => setShowStrings((v) => !v)} title="Show or hide strings">
            Strings
          </button>
          <button
            type="button"
            className="btn"
            aria-pressed={!!tying}
            onClick={() => ui.set(tying ? { tying: null } : { tying: { from: null }, openItemId: null })}
            title="Tie a string between two cards"
          >
            Tie a string
          </button>
        </div>
        <div className="canvas-tools__group">
          <InlineConfirm
            label="Tidy up"
            className="btn"
            message="Put every card back in its room's spread?"
            confirmLabel="Tidy"
            onConfirm={() => {
              resetCollage(items.map((i) => i.id));
              toast('Tidied up');
            }}
          />
        </div>
      </div>

      {groups.length > 0 && (
        <nav className="collage-legend collage-ui" aria-label="Rooms">
          {mats.map(({ g, rect }) => (
            <button key={g.key} type="button" className="collage-legend__room" onClick={() => camera.fit(rect, 30)} style={{ '--mat': tapeVar(g.room?.color) } as CSSProperties}>
              <span className="collage-legend__swatch" aria-hidden="true" />
              <span className="hand">{g.room?.name ?? 'Unsorted'}</span>
              <span className="collage-legend__n type">{g.items.length}</span>
            </button>
          ))}
        </nav>
      )}

      {tying && !pendingTie && <TieHint picked={!!tying.from} />}
      {pendingTie && <TiePrompt a={pendingTie.a} b={pendingTie.b} onDone={() => setPendingTie(null)} />}
      {!items.length && (
        <p className="collage-empty hand">Nothing to pin up. {rooms.size ? 'Try clearing the filters.' : 'Add something first.'}</p>
      )}
      <p className="visually-hidden">
        <Icon name="collage" /> Drag cards to arrange them; positions are saved. Use Tab to reach cards and Enter to open one.
      </p>
    </section>
  );
}
