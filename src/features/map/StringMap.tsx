import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { forceCollide, forceLink, forceManyBody, forceSimulation, forceX, forceY, type ForceLink } from 'd3-force';
import { data, liveConnections } from '../../data/store';
import { ui } from '../../data/ui';
import type { Item, Room } from '../../data/types';
import { useCamera, type View } from '../../lib/camera';
import { useStore } from '../../lib/createStore';
import { drawerShift } from '../../lib/drawerOverlap';
import { Icon } from '../../ui/Icon';
import { TieHint, TiePrompt } from '../canvas/TiePrompt';
import { drawMap, readPalette } from './draw';
import { bounds, buildGraph, rememberPositions, type GLink, type GNode } from './graph';
import '../canvas/canvas.css';
import './map.css';

let savedView: View | null = null;

interface Props {
  items: Item[];
  rooms: Map<string, Room>;
}

/** The whole collection as a force-directed mind map, drawn on canvas. */
export function StringMap({ items, rooms }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const connections = useStore(data, (s) => liveConnections(s.connections));
  const theme = useStore(data, (s) => s.settings.theme);
  const tying = useStore(ui, (s) => s.tying);
  const flight = useStore(ui, (s) => s.flight);
  const [showTags, setShowTags] = useState(false);
  const [pendingTie, setPendingTie] = useState<{ a: string; b: string } | null>(null);
  const [query, setQuery] = useState('');

  const st = useRef({
    nodes: [] as GNode[],
    links: [] as GLink[],
    byId: new Map<string, GNode>(),
    focusId: null as string | null,
    focus: null as Set<string> | null,
    hovered: null as GNode | null,
    pointer: null as { x: number; y: number } | null,
    size: { w: 0, h: 0, dpr: 1 },
    tieFrom: null as string | null,
  });
  st.current.tieFrom = tying?.from ?? null;

  const sim = useMemo(() => forceSimulation<GNode, GLink>().stop(), []);
  /** Re-frame once the first layout settles, unless I've already moved the view. */
  const autoFit = useRef(!savedView);
  const raf = useRef(0);
  const cameraRef = useRef<ReturnType<typeof useCamera> | null>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const cam = cameraRef.current;
    if (!canvas || !cam) return;
    const s = st.current;
    drawMap(canvas.getContext('2d')!, s.nodes, s.links, {
      view: cam.get(),
      width: s.size.w,
      height: s.size.h,
      dpr: s.size.dpr,
      focus: s.focus,
      hovered: s.hovered,
      tieFrom: s.tieFrom ? (s.byId.get(s.tieFrom) ?? null) : null,
      pointer: s.pointer,
      palette: readPalette(),
    });
  }, []);
  const requestDraw = useCallback(() => {
    if (raf.current) return;
    raf.current = requestAnimationFrame(() => {
      raf.current = 0;
      draw();
    });
  }, [draw]);

  /** Node under a client point: small nodes first, then the big room discs. */
  const hit = useCallback((clientX: number, clientY: number): GNode | null => {
    const cam = cameraRef.current;
    if (!cam) return null;
    const p = cam.toWorld(clientX, clientY);
    const slop = 6 / cam.get().k;
    let best: GNode | null = null;
    let bestD = 0;
    for (const pass of ['small', 'room'] as const) {
      for (const n of st.current.nodes) {
        if ((n.type === 'room') !== (pass === 'room')) continue;
        const d = Math.hypot((n.x ?? 0) - p.x, (n.y ?? 0) - p.y) - n.r - (pass === 'room' ? 0 : slop);
        if (d <= bestD) {
          best = n;
          bestD = d;
        }
      }
      if (best) return best;
    }
    return null;
  }, []);

  const camera = useCamera(wrapRef, {
    min: 0.08,
    max: 4,
    initial: savedView ?? undefined,
    onChange: (v) => {
      savedView = v;
      requestDraw();
    },
    canPan: (e) => !hit(e.clientX, e.clientY),
  });
  cameraRef.current = camera;

  const setFocus = useCallback(
    (id: string | null) => {
      const s = st.current;
      s.focusId = id;
      if (!id) s.focus = null;
      else {
        const set = new Set([id]);
        for (const l of s.links) {
          const a = (l.source as GNode).id;
          const b = (l.target as GNode).id;
          if (a === id) set.add(b);
          if (b === id) set.add(a);
        }
        s.focus = set;
      }
      requestDraw();
    },
    [requestDraw],
  );

  // Forces, once.
  useEffect(() => {
    sim
      .force('charge', forceManyBody<GNode>().strength((n) => (n.type === 'room' ? -650 : n.type === 'tag' ? -140 : -48)).theta(0.9).distanceMax(800))
      .force(
        'link',
        forceLink<GNode, GLink>()
          .id((n) => n.id)
          .distance((l) => (l.type === 'room' ? (l.target as GNode).r + 48 : l.type === 'string' ? 95 : 60))
          .strength((l) => (l.type === 'room' ? 0.45 : l.type === 'string' ? 0.18 : 0.06)),
      )
      .force('collide', forceCollide<GNode>((n) => n.r + (n.type === 'item' ? 7 : 12)).iterations(1))
      .force('x', forceX(0).strength(0.025))
      .force('y', forceY(0).strength(0.025))
      .alphaDecay(0.03)
      .velocityDecay(0.38)
      .on('tick', requestDraw)
      .on('end.fit', () => {
        if (!autoFit.current) return;
        autoFit.current = false;
        cameraRef.current?.fit(bounds(st.current.nodes), 70);
      });
    return () => {
      sim.stop();
      rememberPositions(st.current.nodes);
      cancelAnimationFrame(raf.current);
    };
  }, [sim, requestDraw]);

  // (Re)build the graph when data or filters change, keeping positions so nothing jumps.
  useEffect(() => {
    const { nodes, links } = buildGraph(items, rooms, connections, showTags);
    const s = st.current;
    const firstOpen = s.nodes.length === 0;
    const fresh = nodes.filter((n) => !s.byId.has(n.id)).length;
    s.nodes = nodes;
    s.links = links;
    s.byId = new Map(nodes.map((n) => [n.id, n]));
    sim.nodes(nodes);
    (sim.force('link') as ForceLink<GNode, GLink>).links(links);
    if (firstOpen && !savedView) {
      sim.alpha(1);
      for (let i = 0; i < 140; i++) sim.tick();
      sim.alpha(0.12).restart();
      requestAnimationFrame(() => camera.fit(bounds(nodes), 70));
    } else {
      sim.alpha(firstOpen ? 0.1 : Math.min(0.5, Math.max(sim.alpha(), 0.06 + fresh * 0.02))).restart();
    }
    if (s.focusId && !s.byId.has(s.focusId)) setFocus(null);
    else setFocus(s.focusId);
  }, [items, rooms, connections, showTags, sim, camera, setFocus]);

  // Canvas size follows the element.
  useEffect(() => {
    const wrap = wrapRef.current!;
    const canvas = canvasRef.current!;
    const ro = new ResizeObserver(([entry]) => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const { width, height } = entry.contentRect;
      st.current.size = { w: width, h: height, dpr };
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      requestDraw();
    });
    ro.observe(wrap);
    void document.fonts?.ready.then(requestDraw);
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', requestDraw);
    return () => {
      ro.disconnect();
      mq.removeEventListener('change', requestDraw);
    };
  }, [requestDraw]);

  useEffect(requestDraw, [theme, tying, requestDraw]);

  const goTo = useCallback(
    (id: string, open: boolean) => {
      const n = st.current.byId.get(id);
      if (!n) {
        if (open) ui.set({ openItemId: id });
        return;
      }
      camera.flyTo(n.x ?? 0, n.y ?? 0, Math.max(camera.get().k, 1.3), open ? drawerShift(wrapRef.current) : 0);
      setFocus(id);
      if (open) setTimeout(() => ui.set({ openItemId: id }), 600);
    },
    [camera, setFocus],
  );

  useEffect(() => {
    if (flight) goTo(flight.id, true);
  }, [flight, goTo]);

  // Esc leaves tie mode.
  useEffect(() => {
    if (!tying) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !pendingTie) ui.set({ tying: null });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tying, pendingTie]);

  // ── pointer: drag nodes, click to focus / tie ─────────────────────────────
  const drag = useRef<{ node: GNode; sx: number; sy: number; moved: boolean } | null>(null);
  const downEmpty = useRef<{ sx: number; sy: number } | null>(null);

  function clickNode(n: GNode) {
    const t = ui.get().tying;
    if (t) {
      if (n.type !== 'item') return;
      if (!t.from) ui.set({ tying: { from: n.id } });
      else if (t.from !== n.id) setPendingTie({ a: t.from, b: n.id });
      return;
    }
    setFocus(n.id);
    if (n.type === 'item') ui.set({ openItemId: n.id });
  }

  function onPointerDown(e: RPointerEvent) {
    autoFit.current = false;
    const n = hit(e.clientX, e.clientY);
    if (n) {
      drag.current = { node: n, sx: e.clientX, sy: e.clientY, moved: false };
      wrapRef.current!.setPointerCapture(e.pointerId);
    } else downEmpty.current = { sx: e.clientX, sy: e.clientY };
  }
  function onPointerMove(e: RPointerEvent) {
    const s = st.current;
    const w = camera.toWorld(e.clientX, e.clientY);
    s.pointer = w;
    const d = drag.current;
    if (d) {
      if (!d.moved && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) > 4) {
        d.moved = true;
        sim.alphaTarget(0.22).restart();
      }
      if (d.moved) {
        d.node.fx = w.x;
        d.node.fy = w.y;
      }
      return;
    }
    if (e.pointerType === 'mouse') {
      const h = hit(e.clientX, e.clientY);
      if (h !== s.hovered) {
        s.hovered = h;
        wrapRef.current!.style.cursor = h ? 'pointer' : '';
        requestDraw();
      } else if (s.tieFrom) requestDraw();
    }
  }
  function onPointerUp(e: RPointerEvent) {
    const d = drag.current;
    if (d) {
      drag.current = null;
      if (!d.moved) clickNode(d.node);
      else {
        d.node.fx = null;
        d.node.fy = null;
        sim.alphaTarget(0);
      }
      return;
    }
    const down = downEmpty.current;
    downEmpty.current = null;
    if (down && Math.hypot(e.clientX - down.sx, e.clientY - down.sy) < 5 && !ui.get().tying) setFocus(null);
  }

  function search() {
    const q = query.trim().toLowerCase();
    if (!q) return;
    const match = st.current.nodes.find((n) => n.type === 'item' && n.label.toLowerCase().includes(q)) ?? st.current.nodes.find((n) => n.label.toLowerCase().includes(q));
    if (match) goTo(match.id, match.type === 'item' && !ui.get().tying);
  }

  return (
    <section className="map-view-wrap" aria-label="String map">
      <div
        ref={wrapRef}
        className={`canvas-view map-view ${tying ? 'is-tying' : ''}`}
        onPointerDown={onPointerDown}
        onWheel={() => (autoFit.current = false)}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          drag.current = null;
          downEmpty.current = null;
        }}
        onPointerLeave={() => {
          st.current.hovered = null;
          st.current.pointer = null;
          requestDraw();
        }}
      >
        <canvas ref={canvasRef} className="map-view__canvas" role="img" aria-label={`String map of ${items.length} exhibits. Use the search box to find one.`} />
      </div>

      <div className="canvas-tools" onPointerDown={() => (autoFit.current = false)}>
        <form
          className="canvas-tools__search"
          onSubmit={(e) => {
            e.preventDefault();
            search();
          }}
        >
          <Icon name="search" size={15} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find on the map" aria-label="Find on the map" />
        </form>
        <div className="canvas-tools__group">
          <button type="button" className="btn btn--icon" onClick={() => camera.zoomBy(1 / 1.4)} aria-label="Zoom out" title="Zoom out">
            −
          </button>
          <button type="button" className="btn btn--icon" onClick={() => camera.zoomBy(1.4)} aria-label="Zoom in" title="Zoom in">
            +
          </button>
          <button type="button" className="btn" onClick={() => camera.fit(bounds(st.current.nodes), 50)} title="Fit everything">
            Fit
          </button>
        </div>
        <div className="canvas-tools__group">
          <button type="button" className="btn" aria-pressed={showTags} onClick={() => setShowTags((v) => !v)} title="Show tags as nodes">
            # Tags
          </button>
          <button
            type="button"
            className="btn"
            aria-pressed={!!tying}
            onClick={() => ui.set(tying ? { tying: null } : { tying: { from: null }, openItemId: null })}
            title="Tie a string between two items"
          >
            Tie a string
          </button>
        </div>
      </div>

      {tying && !pendingTie && <TieHint picked={!!tying.from} />}
      {pendingTie && <TiePrompt a={pendingTie.a} b={pendingTie.b} onDone={() => setPendingTie(null)} />}
    </section>
  );
}
