import { useEffect, useMemo, useState } from 'react';
import { data } from '../../data/store';
import { ROAD_STAGES, type RoadStageId } from '../../data/types';
import { useStore } from '../../lib/createStore';
import { shortDay } from '../daily-log/dates';
import { formatMinutes } from '../daily-log/duration';
import { useEntries, useToday, useTopics } from '../daily-log/useLog';
import { dragon, dragonBase, fetchDragon, STALE_MS } from './dragon';
import {
  countdown,
  currentStage,
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
import { SessionSheet, SetupSheet, StageSheet, type SetupFocus } from './RoadSheets';
import './road.css';

const LOW_KEY = 'curio-road-low';

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

function Clock({ when, today }: { when: StageWhen; today: string }) {
  const target = zonedInstant(when.date, when.time, when.zone);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (when.date === today && (!when.time || now >= target)) return <p className="road-clock road-clock--today">Today. Go get it.</p>;
  const c = countdown(target - now);
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    <p className="road-clock" aria-label={`${c.days} days ${c.hours} hours ${c.minutes} minutes to go`}>
      {c.days}
      <small>d</small>
      {pad(c.hours)}
      <small>h</small>
      {pad(c.minutes)}
      <small>m</small>
      {pad(c.seconds)}
      <small>s</small>
    </p>
  );
}

function ago(ms: number): string {
  const min = Math.round((Date.now() - ms) / 60_000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  return h < 24 ? `${h} hr ago` : `${Math.round(h / 24)} days ago`;
}

type Open = { kind: 'session' } | { kind: 'stage'; id: RoadStageId } | { kind: 'setup'; focus: SetupFocus } | null;

/** Road to IOI: the training arc in the "Verdict" design. A session saved here is a submission, and it comes back AC. */
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
  const [stamp, setStamp] = useState<{ minutes: number; note: string; count: number } | null>(null);

  const linked = !!road.dragon_key;
  const base = dragonBase(road.dragon_url);
  const dragonData = linked ? summary : null;
  useDragonRefresh(road.dragon_url, road.dragon_key);

  // The page is night-black from edge to edge, the iPhone's overscroll included.
  useEffect(() => {
    document.documentElement.dataset.section = 'road';
    return () => {
      delete document.documentElement.dataset.section;
    };
  }, []);

  const trained = useMemo(() => trainingByDay(entries.values(), road.topic_id, dragonData), [entries, road.topic_id, dragonData]);
  const week = lastSeven(trained, today);
  const count = week.filter((d) => d.state === 'ac').length;
  const hardDay = isHardDay(trained, today);
  const [low, setLow] = useLowEnergy(today, hardDay);
  const note = useMemo(() => proofNote(entries.values(), road.topic_id, dragonData, today), [entries, road.topic_id, dragonData, today]);
  const upsolve = upsolveLine(dragonData);
  const acToday = dragonData?.days.find((d) => d.date === today)?.ac ?? 0;
  const minutesToday = trained.get(today) ?? 0;

  const stageId = currentStage(road);
  const when = stageId ? stageWhen(stageId, road.stages[stageId], dragonData, today) : null;
  const topic = road.topic_id ? topics.get(road.topic_id) : undefined;
  const topicMissing = !topic || !!topic.deleted_at || !!topic.archived_at;

  useEffect(() => {
    if (!stamp) return;
    const t = setTimeout(() => setStamp(null), 3200);
    return () => clearTimeout(t);
  }, [stamp]);

  return (
    <main className="road" id="main">
      <div className="road__top">
        <b>ROAD TO IOI</b>
        <span>{seasonYear(road, today)}</span>
      </div>

      {!road.why ? (
        <button type="button" className="road-why road-why--ask" onClick={() => setOpen({ kind: 'setup', focus: 'why' })}>
          <span className="road-eye">BEFORE YOU START</span>
          <span className="road-why__text">Why do I want this? Write it in one sentence.</span>
          <span className="road-why__hint">It comes back on the hard days, in your own words.</span>
        </button>
      ) : (
        hardDay && (
          <button type="button" className="road-why" onClick={() => setOpen({ kind: 'setup', focus: 'why' })} aria-label="Your why (edit)">
            <span className="road-eye">REMEMBER WHY</span>
            <span className="road-why__text">“{road.why}”</span>
            <span className="road-why__hint">Two quiet days. One small session gets you back on the board.</span>
          </button>
        )
      )}

      <section className="road-contest" aria-label="Next contest">
        {stageId ? (
          <>
            <span className="road-eye">NEXT CONTEST · {STAGE_INFO[stageId].letter}</span>
            <h2 className="road-contest__name">{STAGE_INFO[stageId].name}</h2>
            {when && when.date < today ? (
              <div className="road-asked">
                <p>
                  {STAGE_INFO[stageId].name} was on {shortDay(when.date)}. How did it go?
                </p>
                <div className="road-asked__btns">
                  <button type="button" className="road-btn road-btn--ac" onClick={() => setOpen({ kind: 'stage', id: stageId })}>
                    I qualified
                  </button>
                  <button type="button" className="road-btn" onClick={() => setOpen({ kind: 'stage', id: stageId })}>
                    Change the date
                  </button>
                </div>
              </div>
            ) : when ? (
              <>
                <Clock when={when} today={today} />
                <p className="road-contest__when">
                  {shortDay(when.date)}
                  {when.time ? ` · ${when.time} Japan time` : ''}
                  {when.from === 'dragon' ? ' · from DragonCode' : ''}
                </p>
              </>
            ) : (
              <button type="button" className="road-btn" onClick={() => setOpen({ kind: 'stage', id: stageId })}>
                Set the contest date
              </button>
            )}
          </>
        ) : (
          <>
            <span className="road-eye">ALL STAGES CLEARED</span>
            <h2 className="road-contest__name">You made it to the IOI.</h2>
          </>
        )}
      </section>

      <section aria-labelledby="road-set">
        <h2 id="road-set" className="road-eye">
          {low ? "TODAY'S PROBLEMSET · LOW-ENERGY DAY" : "TODAY'S PROBLEMSET"}
        </h2>
        <ol className="road-set">
          {low ? (
            <li className="road-set__item road-set__item--sub">
              <b>1</b>
              <span>
                Subtask 1: spend ten minutes understanding one solution.
                <small>Partial score is still score.</small>
              </span>
              <em>10</em>
            </li>
          ) : (
            <>
              <li className={`road-set__item${acToday ? ' road-set__item--ac' : ''}`}>
                <b>A</b>
                <span>
                  Solve one problem that makes you think.
                  {linked && base && (
                    <a href={`${base}/today`} target="_blank" rel="noreferrer">
                      Open DragonCode
                    </a>
                  )}
                </span>
                <em>{acToday ? 'AC' : '100'}</em>
              </li>
              <li className="road-set__item">
                <b>B</b>
                <span>
                  {upsolve.problemId ? `Upsolve: ${upsolve.title}` : upsolve.title}
                  {upsolve.detail && <small>{upsolve.detail}</small>}
                  {upsolve.problemId && base && (
                    <a href={`${base}/workspace/${encodeURIComponent(upsolve.problemId)}`} target="_blank" rel="noreferrer">
                      Open in DragonCode
                    </a>
                  )}
                </span>
                <em>100</em>
              </li>
            </>
          )}
        </ol>
      </section>

      <button type="button" className="road-submit" onClick={() => setOpen({ kind: 'session' })}>
        Submit session ▸
      </button>
      <button type="button" className="road-low" aria-pressed={low} onClick={() => setLow(!low)}>
        {low ? 'Back to the full problemset' : 'Low-energy day? Take subtask 1'}
      </button>

      <section aria-labelledby="road-week" className="road-week-wrap">
        <h2 id="road-week" className="road-eye">
          LAST 7 DAYS
        </h2>
        <ol className="road-week">
          {week.map((d) => (
            <li key={d.date} className={`road-week__day road-week__day--${d.state}`} title={shortDay(d.date)}>
              <span aria-hidden="true">{d.state === 'ac' ? 'AC' : d.state === 'now' ? '?' : '—'}</span>
              <span className="visually-hidden">
                {shortDay(d.date)}: {d.state === 'ac' ? 'trained' : d.state === 'now' ? 'not yet today' : 'rest day'}
              </span>
            </li>
          ))}
        </ol>
        <p className="road-week__label">
          Trained <b>{count}</b> of the last 7 days{minutesToday > 0 && <> · {formatMinutes(minutesToday)} today</>}
        </p>
      </section>

      {note && (
        <figure className="road-proof">
          <span className="road-eye">FROM YOUR PAST SELF · {shortDay(note.date).toUpperCase()}</span>
          <blockquote>{note.text}</blockquote>
        </figure>
      )}

      <section aria-labelledby="road-standings">
        <h2 id="road-standings" className="road-eye">
          STANDINGS · THE ROAD
        </h2>
        <ol className="road-standings">
          {ROAD_STAGES.map((id) => {
            const s = road.stages[id];
            const state = s.cleared_on ? 'ac' : id === stageId ? 'try' : 'locked';
            return (
              <li key={id}>
                <button type="button" className={`road-cell road-cell--${state}`} onClick={() => setOpen({ kind: 'stage', id })}>
                  <span className="road-cell__letter">{STAGE_INFO[id].letter}</span>
                  <span className="road-cell__name">{STAGE_INFO[id].short}</span>
                  <span className="road-cell__state">{state === 'ac' ? 'AC' : state === 'try' ? 'trying' : ''}</span>
                  <span className="visually-hidden">
                    {STAGE_INFO[id].name}: {state === 'ac' ? `cleared ${shortDay(s.cleared_on!)}` : state === 'try' ? 'current stage' : 'ahead'}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </section>

      <footer className="road-foot">
        {road.why && !hardDay && (
          <button type="button" className="road-foot__why" onClick={() => setOpen({ kind: 'setup', focus: 'why' })}>
            Why: “{road.why}”
          </button>
        )}
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
            Sessions saved here go to a Daily Log topic. <button type="button" className="road-link" onClick={() => setOpen({ kind: 'setup', focus: 'topic' })}>Choose one</button>
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
            const after = lastSeven(new Map(trained).set(today, minutesToday + minutes), today).filter((d) => d.state === 'ac').length;
            setStamp({ minutes, note: text, count: after });
          }}
        />
      )}
      {open?.kind === 'stage' && <StageSheet id={open.id} today={today} dragonData={dragonData} onClose={() => setOpen(null)} />}
      {open?.kind === 'setup' && <SetupSheet focus={open.focus} onClose={() => setOpen(null)} />}

      {stamp && (
        <button type="button" className="road-stamp" onClick={() => setStamp(null)} aria-label="Accepted. Close">
          <span className="road-stamp__mark">AC</span>
          <span className="road-stamp__meta">
            <b>
              {formatMinutes(stamp.minutes)} · trained {stamp.count} of the last 7 days
            </b>
            {stamp.note && <>What clicked: “{stamp.note}”</>}
          </span>
        </button>
      )}
    </main>
  );
}
