import { useEffect, useMemo, useState } from 'react';
import { data } from '../../data/store';
import { ROAD_STAGES, type RoadStageId } from '../../data/types';
import { useStore } from '../../lib/createStore';
import { monthName, rangeLabel, shortDay, weekdayLetter } from '../daily-log/dates';
import { formatMinutes } from '../daily-log/duration';
import { useEntries, useToday, useTopics } from '../daily-log/useLog';
import { seasonCalendar, upcoming, type CalendarEntry } from './calendar';
import { dragon, dragonBase, fetchDragon, STALE_MS } from './dragon';
import {
  countdown,
  currentStage,
  daysUntil,
  gatesThisSeason,
  isHardDay,
  lastSeven,
  proofNote,
  seasonYear,
  STAGE_INFO,
  stageWhen,
  trainingByDay,
  upsolveLine,
  zonedInstant,
  type StageWhen,
} from './rules';
import { EventSheet, SessionSheet, SetupSheet, StageSheet, type SetupFocus } from './RoadSheets';
import './road.css';

const LOW_KEY = 'curio-road-low';
/** The path shows this many gates; any more are counted beside it. */
const PATH_MAX = 60;

/** Low-energy mode is a choice for one day: remembered as "on:<date>" or "off:<date>". */
function useLowEnergy(today: string, hardDay: boolean): [boolean, (on: boolean) => void] {
  const read = () => {
    try {
      return localStorage.getItem(LOW_KEY);
    } catch {
      return null;
    }
  };
  const [saved, setSaved] = useState(read);
  const on = saved === `on:${today}` ? true : saved === `off:${today}` ? false : hardDay;
  const set = (v: boolean) => {
    const value = `${v ? 'on' : 'off'}:${today}`;
    setSaved(value);
    try {
      localStorage.setItem(LOW_KEY, value);
    } catch {
      /* private mode: it lasts until the page closes */
    }
  };
  return [on, set];
}

/** Keep DragonCode's summary fresh: on opening, and when the app comes back after a while. */
function useDragonRefresh(url: string, key: string) {
  useEffect(() => {
    if (!key) return;
    const refresh = () => {
      const { fetchedAt, loading } = dragon.get();
      if (!loading && (!fetchedAt || Date.now() - fetchedAt > STALE_MS)) void fetchDragon(url, key);
    };
    void fetchDragon(url, key);
    const onVisible = () => document.visibilityState === 'visible' && refresh();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', refresh);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', refresh);
    };
  }, [url, key]);
}

const KASAGI = 'M1 4 Q20 9 39 4 L38 9 Q20 12 2 9 Z';

/** A torii, 40×36 units: raised (solid), not raised (outline), or today's, still open (dashed). */
function Torii({ variant = 'solid', size = 22, className = '' }: { variant?: 'solid' | 'outline' | 'open'; size?: number; className?: string }) {
  const solid = variant === 'solid';
  return (
    <svg className={`torii torii--${variant} ${className}`} width={size} height={Math.round(size * 0.9)} viewBox="-1 -1 42 38" aria-hidden="true">
      <path d={KASAGI} />
      <rect x="5" y="13" width="30" height="3" />
      <rect x="9" y={solid ? 9 : 16} width="4" height={solid ? 27 : 20} />
      <rect x="27" y={solid ? 9 : 16} width="4" height={solid ? 27 : 20} />
    </svg>
  );
}

/** Where each stage's small gate stands on the hill behind the great torii, nearest first. */
const SPOTS: Record<RoadStageId, { x: number; y: number; s: number; ahead: string; label: [number, number, 'start' | 'end'] }> = {
  joi1: { x: 138, y: 306, s: 0.95, ahead: '#c4461f', label: [182, 330, 'start'] },
  joi2: { x: 199, y: 287, s: 0.75, ahead: '#b4421f', label: [234, 310, 'start'] },
  final: { x: 202, y: 264, s: 0.58, ahead: '#a33f1f', label: [230, 282, 'start'] },
  camp: { x: 181, y: 238, s: 0.45, ahead: '#8f3a22', label: [176, 256, 'end'] },
  ioi: { x: 181, y: 196, s: 0.36, ahead: '#e9c46a', label: [211, 204, 'start'] },
};

type StageState = 'cleared' | 'now' | 'ahead';

/** The great torii at night, framing the hill path; the five stages are the small gates climbing to the summit. */
function GatesScene({ states }: { states: Record<RoadStageId, StageState> }) {
  const order = [...ROAD_STAGES].reverse();
  return (
    <svg className="gates-scene" viewBox="0 0 390 470" aria-hidden="true">
      <defs>
        <filter id="gates-blur" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="9" />
        </filter>
      </defs>
      <circle cx="318" cy="30" r="44" fill="#f2e3c6" opacity="0.12" filter="url(#gates-blur)" />
      <circle cx="318" cy="30" r="28" fill="#f2e3c6" />
      <g fill="#f4ede1">
        <circle cx="40" cy="22" r="1.3" opacity="0.7" />
        <circle cx="150" cy="14" r="1.1" opacity="0.6" />
        <circle cx="232" cy="26" r="1.4" opacity="0.7" />
        <circle cx="112" cy="182" r="1.2" opacity="0.5" />
        <circle cx="282" cy="196" r="1.3" opacity="0.6" />
        <circle cx="126" cy="236" r="1" opacity="0.45" />
        <circle cx="268" cy="232" r="1.1" opacity="0.5" />
      </g>
      <polygon points="0,470 0,330 120,270 195,212 270,262 390,320 390,470" fill="#181c28" />
      <circle cx="195" cy="208" r="26" fill="#ffb65c" opacity="0.18" filter="url(#gates-blur)" />
      <path
        d="M150 470 C 150 420, 150 380, 156 352 C 166 330, 228 322, 214 296 C 204 278, 182 272, 190 252 C 196 238, 206 232, 200 222"
        fill="none"
        stroke="#252a37"
        strokeWidth="9"
        strokeLinecap="round"
      />
      {order.map((id) => {
        const p = SPOTS[id];
        const state = states[id];
        const fill = id === 'ioi' ? '#e9c46a' : state === 'ahead' ? p.ahead : '#ff6a3d';
        return (
          <g key={id}>
            {state === 'now' && <circle className="gates-scene__glow" cx={p.x + 20 * p.s} cy={p.y + 18 * p.s} r={24 * Math.max(p.s, 0.6)} fill="#ffb65c" filter="url(#gates-blur)" />}
            <g transform={`translate(${p.x} ${p.y}) scale(${p.s})`} fill={fill}>
              <path d={KASAGI} />
              <rect x="5" y="13" width="30" height="3" />
              <rect x="9" y="9" width="4" height="27" />
              <rect x="27" y="9" width="4" height="27" />
            </g>
            <text
              x={p.label[0]}
              y={p.label[1]}
              textAnchor={p.label[2]}
              className={`gates-scene__label gates-scene__label--${state}${id === 'ioi' ? ' gates-scene__label--ioi' : ''}`}
            >
              {STAGE_INFO[id].short}
              {state === 'cleared' ? ' ✓' : ''}
            </text>
          </g>
        );
      })}
      <path d="M4 44 Q195 66 386 44 L380 80 Q195 90 10 80 Z" fill="#e04a23" />
      <path d="M4 44 Q195 66 386 44 L386 51 Q195 73 4 51 Z" fill="#1b1312" />
      <rect x="30" y="88" width="330" height="12" fill="#b53a1b" />
      <polygon points="58,92 84,92 88,470 54,470" fill="#e04a23" />
      <polygon points="306,92 332,92 336,470 302,470" fill="#e04a23" />
      <rect x="22" y="148" width="346" height="18" fill="#e04a23" />
      <rect x="167" y="100" width="56" height="46" fill="#1b1312" stroke="#e9c46a" strokeWidth="2" />
      <text x="195" y="133" textAnchor="middle" className="gates-scene__plaque">
        道
      </text>
      <rect x="52" y="446" width="38" height="24" fill="#1b1312" />
      <rect x="300" y="446" width="38" height="24" fill="#1b1312" />
      {[30, 360].map((x) => (
        <g key={x}>
          <circle cx={x} cy="434" r="18" fill="#ffb65c" opacity="0.3" filter="url(#gates-blur)" />
          <rect x={x - 12} y="420" width="24" height="6" fill="#3a3f4d" />
          <rect x={x - 8} y="426" width="16" height="16" fill="#2a2f3d" />
          <rect x={x - 4} y="430" width="8" height="8" fill="#ffb65c" />
          <rect x={x - 4} y="442" width="8" height="18" fill="#2a2f3d" />
          <rect x={x - 12} y="460" width="24" height="10" fill="#3a3f4d" />
        </g>
      ))}
    </svg>
  );
}

const ZONE_NAMES: Record<string, string> = {
  'Asia/Tokyo': 'Japan time',
  'Asia/Singapore': 'Singapore time',
  'Europe/Berlin': 'Germany time',
  'America/New_York': 'US Eastern time',
};
const zoneName = (zone: string) => ZONE_NAMES[zone] ?? zone.replace(/^.*\//, '').replace(/_/g, ' ') + ' time';

/** あと 9 日: whole days while there are days left, then hours, then minutes. */
function Countdown({ when, today }: { when: StageWhen; today: string }) {
  const target = zonedInstant(when.date, when.time, when.zone);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  if (now >= target || (when.date === today && !when.time)) {
    return (
      <p className="gates-sign__count gates-sign__count--today">
        <b>今日</b>
        <span>Today. Go get it.</span>
      </p>
    );
  }
  const c = countdown(target - now);
  const [n, unit, label] = c.days > 0 ? [c.days, '日', `${c.days} days`] : c.hours > 0 ? [c.hours, '時間', `${c.hours} hours`] : [c.minutes, '分', `${c.minutes} minutes`];
  return (
    <p className={`gates-sign__count${String(n).length > 2 ? ' gates-sign__count--long' : ''}`} aria-label={`${label} to go`}>
      <span aria-hidden="true">あと</span>
      <b aria-hidden="true">{n}</b>
      <span aria-hidden="true">{unit}</span>
    </p>
  );
}

function whenLine(when: StageWhen): string {
  const days = when.until && when.until !== when.date ? rangeLabel(when.date, when.until) : shortDay(when.date);
  return `${days}${when.time ? ` · ${when.time} ${zoneName(when.zone)}` : ''}${when.from === 'dragon' ? ' · from DragonCode' : ''}`;
}

function ago(ms: number): string {
  const min = Math.round((Date.now() - ms) / 60_000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  return h < 24 ? `${h} hr ago` : `${Math.round(h / 24)} days ago`;
}

/** "in 9 days", or "about 8 weeks" while the day is only a placeholder. */
function inDays(c: CalendarEntry, today: string): string {
  const d = daysUntil(c.date, today);
  if (d <= 0) return 'Today';
  if (c.approx) return d < 14 ? 'Soon' : d < 60 ? `About ${Math.round(d / 7)} weeks` : `About ${Math.round(d / 30)} months`;
  return d === 1 ? 'Tomorrow' : `In ${d} days`;
}

/** The ema: my why, written on a wooden plaque. */
function Ema({ why, onEdit, hint }: { why: string; onEdit: () => void; hint?: string }) {
  return (
    <button type="button" className={`ema${why ? '' : ' ema--ask'}`} onClick={onEdit} aria-label={why ? `My wish: ${why} (edit)` : 'Write my why'}>
      <span className="ema__cord" aria-hidden="true" />
      <span className="ema__board">
        <span className="ema__hole" aria-hidden="true" />
        <span className="ema__label">MY WISH · 絵馬</span>
        <span className="ema__text">{why || 'Why do I want this? Write it in one sentence.'}</span>
        {hint && <span className="ema__hint">{hint}</span>}
      </span>
    </button>
  );
}

type Open = { kind: 'session' } | { kind: 'stage'; id: RoadStageId } | { kind: 'event'; id: string } | { kind: 'setup'; focus: SetupFocus } | null;

/** Road to IOI as the thousand gates: a night path up the mountain. Every day of training raises a gate. */
export function Road() {
  const road = useStore(data, (s) => s.settings.road);
  const entries = useEntries();
  const topics = useTopics();
  const today = useToday();
  const summary = useStore(dragon, (s) => s.summary);
  const fetchedAt = useStore(dragon, (s) => s.fetchedAt);
  const loading = useStore(dragon, (s) => s.loading);
  const dragonError = useStore(dragon, (s) => s.error);
  const [open, setOpen] = useState<Open>(null);
  const [raised, setRaised] = useState<{ minutes: number; note: string; gates: number } | null>(null);
  const [showHidden, setShowHidden] = useState(false);

  const linked = !!road.dragon_key;
  const base = dragonBase(road.dragon_url);
  const dragonData = linked ? summary : null;
  useDragonRefresh(road.dragon_url, road.dragon_key);

  // The page is night from edge to edge, the iPhone's overscroll included.
  useEffect(() => {
    document.documentElement.dataset.section = 'road';
    return () => {
      delete document.documentElement.dataset.section;
    };
  }, []);

  const trained = useMemo(() => trainingByDay(entries.values(), road.topic_id, dragonData), [entries, road.topic_id, dragonData]);
  const week = lastSeven(trained, today);
  const count = week.filter((d) => d.state === 'ac').length;
  const weekMinutes = week.reduce((sum, d) => sum + (trained.get(d.date) ?? 0), 0);
  const gates = gatesThisSeason(trained, today);
  const hardDay = isHardDay(trained, today);
  const [low, setLow] = useLowEnergy(today, hardDay);
  const note = useMemo(() => proofNote(entries.values(), road.topic_id, dragonData, today), [entries, road.topic_id, dragonData, today]);
  const upsolve = upsolveLine(dragonData);
  const acToday = dragonData?.days.find((d) => d.date === today)?.ac ?? 0;
  const minutesToday = trained.get(today) ?? 0;

  const stageId = currentStage(road);
  const when = stageId ? stageWhen(stageId, road.stages[stageId], dragonData, today) : null;
  const states = Object.fromEntries(ROAD_STAGES.map((id) => [id, road.stages[id].cleared_on ? 'cleared' : id === stageId ? 'now' : 'ahead'])) as Record<RoadStageId, StageState>;
  const topic = road.topic_id ? topics.get(road.topic_id) : undefined;
  const topicMissing = !topic || !!topic.deleted_at || !!topic.archived_at;
  const calendar = useMemo(() => upcoming(seasonCalendar(road.events), today), [road.events, today]);

  useEffect(() => {
    if (!raised) return;
    const t = setTimeout(() => setRaised(null), 3600);
    return () => clearTimeout(t);
  }, [raised]);

  const editWhy = () => setOpen({ kind: 'setup', focus: 'why' });

  return (
    <main className="road" id="main">
      {(!road.why || hardDay) && (
        <Ema
          why={road.why}
          onEdit={editWhy}
          hint={road.why ? 'Two quiet days. One small session raises the next gate.' : 'It comes back on the hard days, in your own words.'}
        />
      )}

      <section className="gates-hero" aria-labelledby="road-next">
        <p className="road-eye">ROAD TO IOI · SEASON {seasonYear(road, today)}</p>
        <div className="gates-hero__scene">
          <GatesScene states={states} />
          <div className="gates-sign">
            {stageId ? (
              when && (when.until ?? when.date) < today ? (
                <>
                  <h2 id="road-next" className="gates-sign__name">
                    {STAGE_INFO[stageId].name}
                  </h2>
                  <p className="gates-sign__when">Was on {shortDay(when.date)}. How did it go?</p>
                  <div className="gates-sign__btns">
                    <button type="button" className="gates-btn gates-btn--main" onClick={() => setOpen({ kind: 'stage', id: stageId })}>
                      I qualified
                    </button>
                    <button type="button" className="gates-btn" onClick={() => setOpen({ kind: 'stage', id: stageId })}>
                      Change the date
                    </button>
                  </div>
                </>
              ) : when ? (
                <>
                  <Countdown when={when} today={today} />
                  <h2 id="road-next" className="gates-sign__name">
                    to the {STAGE_INFO[stageId].name}
                  </h2>
                  <p className="gates-sign__when">{whenLine(when)}</p>
                </>
              ) : (
                <>
                  <h2 id="road-next" className="gates-sign__name">
                    {STAGE_INFO[stageId].name}
                  </h2>
                  <button type="button" className="gates-btn gates-btn--main" onClick={() => setOpen({ kind: 'stage', id: stageId })}>
                    Set the date
                  </button>
                </>
              )
            ) : (
              <>
                <p className="gates-sign__count gates-sign__count--today">
                  <b>頂</b>
                </p>
                <h2 id="road-next" className="gates-sign__name">
                  You made it to the IOI.
                </h2>
              </>
            )}
          </div>
        </div>
      </section>

      <section className="gates-card gates-path" aria-labelledby="road-path">
        <div className="gates-card__head">
          <h2 id="road-path" className="gates-title">
            Your path
          </h2>
          <span>
            {gates} {gates === 1 ? 'gate' : 'gates'} this season
          </span>
        </div>
        <p className="gates-card__sub">Every day you train raises one more gate.</p>
        {gates > 0 && (
          <div className="gates-path__row" aria-hidden="true">
            {Array.from({ length: Math.min(gates, PATH_MAX) }, (_, i) => (
              <Torii key={i} className={i === Math.min(gates, PATH_MAX) - 1 && minutesToday > 0 ? 'torii--new' : ''} />
            ))}
            {gates > PATH_MAX && <span className="gates-path__more">+{gates - PATH_MAX}</span>}
          </div>
        )}
      </section>

      <section className="gates-card gates-today" aria-labelledby="road-today">
        <svg className="gates-today__beam" viewBox="0 0 374 18" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0 2 Q187 10 374 2 L370 14 Q187 19 4 14 Z" />
        </svg>
        <div className="gates-card__head">
          <h2 id="road-today" className="gates-title gates-title--big">
            Today <small>本日</small>
          </h2>
          <span>{low ? 'Low-energy day' : shortDay(today)}</span>
        </div>
        <ol className="gates-tasks">
          {low ? (
            <li>
              <span className="gates-tasks__num" aria-hidden="true">
                一
              </span>
              <span className="gates-tasks__body">
                <span className="gates-tasks__title">Spend ten minutes understanding one solution.</span>
                <small>Partial score is still score.</small>
              </span>
            </li>
          ) : (
            <>
              <li className={acToday ? 'gates-tasks--done' : ''}>
                <span className="gates-tasks__num" aria-hidden="true">
                  一
                </span>
                <span className="gates-tasks__body">
                  <span className="gates-tasks__title">
                    Solve one problem that makes you think.
                    {acToday > 0 && <em> Done today.</em>}
                  </span>
                  {linked && base && (
                    <a href={`${base}/today`} target="_blank" rel="noreferrer">
                      Open DragonCode
                    </a>
                  )}
                </span>
              </li>
              <li>
                <span className="gates-tasks__num" aria-hidden="true">
                  二
                </span>
                <span className="gates-tasks__body">
                  <span className="gates-tasks__title">{upsolve.problemId ? `Upsolve: ${upsolve.title}` : upsolve.title}</span>
                  {upsolve.detail && <small>{upsolve.detail}</small>}
                  {upsolve.problemId && base && (
                    <a href={`${base}/workspace/${encodeURIComponent(upsolve.problemId)}`} target="_blank" rel="noreferrer">
                      Open in DragonCode
                    </a>
                  )}
                </span>
              </li>
            </>
          )}
        </ol>
        <button type="button" className="gates-raise" onClick={() => setOpen({ kind: 'session' })}>
          Log a session · raise a gate
        </button>
        <button type="button" className="gates-low" aria-pressed={low} onClick={() => setLow(!low)}>
          {low ? 'Back to the full day' : 'Tired? Ten minutes still raises a gate.'}
        </button>
      </section>

      <section className="gates-card" aria-labelledby="road-week">
        <div className="gates-card__head">
          <h2 id="road-week" className="gates-title">
            This week
          </h2>
          <span>
            {count} of 7 days{weekMinutes > 0 && <> · {formatMinutes(weekMinutes)}</>}
          </span>
        </div>
        <ol className="gates-week">
          {week.map((d) => (
            <li key={d.date} className={`gates-week__day gates-week__day--${d.state}`}>
              <Torii variant={d.state === 'ac' ? 'solid' : d.state === 'now' ? 'open' : 'outline'} size={34} />
              <span aria-hidden="true">{d.state === 'now' ? 'Today' : weekdayLetter(d.date).slice(0, 1)}</span>
              <span className="visually-hidden">
                {shortDay(d.date)}: {d.state === 'ac' ? `trained${trained.get(d.date) ? `, ${formatMinutes(trained.get(d.date)!)}` : ''}` : d.state === 'now' ? 'not yet today' : 'rest day'}
              </span>
            </li>
          ))}
        </ol>
      </section>

      {note && (
        <figure className="omikuji">
          <span className="omikuji__seal" aria-hidden="true">
            大吉
          </span>
          <figcaption>TODAY'S FORTUNE · おみくじ</figcaption>
          <blockquote>{note.text}</blockquote>
          <p>A note from you, {shortDay(note.date, today)}</p>
        </figure>
      )}

      <section className="gates-card" aria-labelledby="road-climb">
        <h2 id="road-climb" className="gates-title">
          The climb
        </h2>
        <ol className="climb">
          {[...ROAD_STAGES].reverse().map((id) => {
            const s = road.stages[id];
            const w = stageWhen(id, s, dragonData, today);
            const state = states[id];
            return (
              <li key={id}>
                <button type="button" className={`climb__step climb__step--${state}${id === 'ioi' ? ' climb__step--ioi' : ''}`} onClick={() => setOpen({ kind: 'stage', id })}>
                  <span className="climb__lantern" aria-hidden="true" />
                  <span className="climb__name">
                    <b>{id === 'ioi' ? `IOI ${seasonYear(road, today)}` : STAGE_INFO[id].name}</b>
                    {state === 'now' && <small className="climb__here">You are here</small>}
                    {state === 'cleared' && <small>Cleared {shortDay(s.cleared_on!, today)}</small>}
                    {id === 'ioi' && state === 'ahead' && <small>The summit{seasonYear(road, today) === 2027 ? ' · Potsdam' : ''}</small>}
                  </span>
                  <span className="climb__date">{w ? (w.until && w.until !== w.date ? rangeLabel(w.date, w.until).replace(/ \d{4}$/, '') : shortDay(w.date, today)) : 'Set date'}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </section>

      <section className="gates-card" aria-labelledby="road-side">
        <div className="gates-card__head">
          <h2 id="road-side" className="gates-title">
            Side paths
          </h2>
          <span>NOI · USACO · APIO</span>
        </div>
        {calendar.shown.length ? (
          <ol className="side">
            {calendar.shown.map((c) => (
              <li key={c.event.id}>
                <button type="button" className="side__row" onClick={() => setOpen({ kind: 'event', id: c.event.id })}>
                  <span className="side__date" aria-hidden="true">
                    {c.approx ? (
                      <>
                        <small>~</small>
                        {monthName(c.date)}
                      </>
                    ) : (
                      <>
                        <b>{c.date.slice(8, 10).replace(/^0/, '')}</b>
                        {monthName(c.date)}
                      </>
                    )}
                  </span>
                  <span className="side__name">
                    <b>{c.event.name}</b>
                    <small>{c.event.where}</small>
                  </span>
                  <span className={`side__when${c.approx ? ' side__when--approx' : ''}`}>{inDays(c, today)}</span>
                  <span className="visually-hidden">
                    {c.approx ? `around ${monthName(c.date, true)}, exact day not announced yet` : shortDay(c.date, today)}
                  </span>
                </button>
              </li>
            ))}
          </ol>
        ) : (
          <p className="gates-card__sub">Nothing else ahead this season.</p>
        )}
        <p className="side__key">~ means the organisers haven't announced the day yet. Tap one to set it.</p>
        {calendar.hidden.length > 0 && (
          <button type="button" className="road-link" onClick={() => setShowHidden(!showHidden)} aria-expanded={showHidden}>
            {showHidden ? 'Hide' : 'Show'} {calendar.hidden.length} hidden
          </button>
        )}
        {showHidden && (
          <ol className="side side--hidden">
            {calendar.hidden.map((c) => (
              <li key={c.event.id}>
                <button type="button" className="side__row" onClick={() => setOpen({ kind: 'event', id: c.event.id })}>
                  <span className="side__date" aria-hidden="true">
                    {monthName(c.date)}
                  </span>
                  <span className="side__name">
                    <b>{c.event.name}</b>
                    <small>Hidden</small>
                  </span>
                </button>
              </li>
            ))}
          </ol>
        )}
      </section>

      {road.why && !hardDay && <Ema why={road.why} onEdit={editWhy} />}

      <footer className="road-foot">
        <p className="road-foot__line">
          {linked ? (
            <>
              <span className={`road-dot${dragonError ? ' road-dot--warn' : ''}`} aria-hidden="true" />
              DragonCode {loading ? 'updating…' : fetchedAt ? `updated ${ago(fetchedAt)}` : 'linked'}
              {dragonData?.mockOpen && ' · mock in progress, names hidden'}
              <button type="button" className="road-link" onClick={() => void fetchDragon(road.dragon_url, road.dragon_key)} disabled={loading}>
                Refresh
              </button>
            </>
          ) : (
            <button type="button" className="road-link" onClick={() => setOpen({ kind: 'setup', focus: 'dragon' })}>
              Link DragonCode
            </button>
          )}
          <button type="button" className="road-link" onClick={() => setOpen({ kind: 'setup', focus: 'topic' })}>
            Settings
          </button>
        </p>
        {linked && dragonError && <p className="road-foot__error">{dragonError}</p>}
        {topicMissing && (
          <p className="road-foot__error">
            Sessions saved here go to a Daily Log topic.{' '}
            <button type="button" className="road-link" onClick={() => setOpen({ kind: 'setup', focus: 'topic' })}>
              Choose one
            </button>
          </p>
        )}
      </footer>

      {open?.kind === 'session' && (
        <SessionSheet
          today={today}
          linked={linked}
          onClose={() => setOpen(null)}
          onSaved={(minutes, text) => {
            setOpen(null);
            setRaised({ minutes, note: text, gates: minutesToday > 0 ? gates : gates + 1 });
          }}
        />
      )}
      {open?.kind === 'stage' && <StageSheet id={open.id} today={today} dragonData={dragonData} onClose={() => setOpen(null)} />}
      {open?.kind === 'event' && <EventSheet id={open.id} onClose={() => setOpen(null)} />}
      {open?.kind === 'setup' && <SetupSheet focus={open.focus} onClose={() => setOpen(null)} />}

      {raised && (
        <button type="button" className="gates-raised" onClick={() => setRaised(null)} aria-label="A gate is raised. Close">
          <Torii size={46} className="gates-raised__gate" />
          <span className="gates-raised__text">
            <span className="gates-raised__title">A gate is raised</span>
            <b className="gates-raised__meta">
              {formatMinutes(raised.minutes)} · {raised.gates} {raised.gates === 1 ? 'gate' : 'gates'} this season
            </b>
            {raised.note && <span className="gates-raised__note">What clicked: “{raised.note}”</span>}
          </span>
        </button>
      )}
    </main>
  );
}
