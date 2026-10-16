/**
 * The season's calendar, as published when it was written (16 Oct 2026). Exact dates come from the organisers;
 * `approx` dates are placeholders for contests that hadn't announced their day yet, and the page shows only their
 * month. A date set on the page (settings.road) always wins over these.
 */
import type { RoadEvent, RoadSettings, RoadStageId } from '../../data/types';

export interface ScheduledDate {
  date: string;
  time: string | null;
  zone: string;
  /** The last day, for contests that run over several days. */
  until?: string;
  approx: boolean;
}

/**
 * Later stages of the road, used until a date is set on the page or found in DragonCode.
 * JOI 2027 (ioi-jp.org/joi-2027/tournament_info): semifinal stage 24 & 31 Jan, final stage 20–24 Mar.
 * IOI 2027: Potsdam, Germany, 12–19 Sep (Hasso Plattner Institute announcement, Sep 2026).
 */
export const STAGE_SCHEDULE: Partial<Record<RoadStageId, ScheduledDate>> = {
  final: { date: '2027-01-24', time: null, zone: 'Asia/Tokyo', until: '2027-01-31', approx: false },
  camp: { date: '2027-03-20', time: null, zone: 'Asia/Tokyo', until: '2027-03-24', approx: false },
  ioi: { date: '2027-09-12', time: null, zone: 'Europe/Berlin', until: '2027-09-19', approx: false },
};

export interface SeasonEvent extends ScheduledDate {
  id: string;
  name: string;
  /** Who runs it, shown small: "Singapore", "USA". */
  where: string;
  url: string;
  /** Where the date comes from, for the sheet. */
  source: string;
}

export const SEASON_EVENTS: SeasonEvent[] = [
  {
    id: 'usaco-1',
    name: 'USACO Contest 1',
    where: 'USA · online',
    date: '2026-12-12',
    time: null,
    zone: 'America/New_York',
    approx: true,
    url: 'https://usaco.org/',
    source: 'The 2026–27 schedule isn’t out yet. Placeholder: the first contest usually runs in December.',
  },
  {
    id: 'usaco-2',
    name: 'USACO Contest 2',
    where: 'USA · online',
    date: '2027-01-16',
    time: null,
    zone: 'America/New_York',
    approx: true,
    url: 'https://usaco.org/',
    source: 'Placeholder until USACO posts its schedule: usually January.',
  },
  {
    id: 'usaco-3',
    name: 'USACO Contest 3',
    where: 'USA · online',
    date: '2027-02-13',
    time: null,
    zone: 'America/New_York',
    approx: true,
    url: 'https://usaco.org/',
    source: 'Placeholder until USACO posts its schedule: usually February.',
  },
  {
    id: 'usaco-open',
    name: 'USACO US Open',
    where: 'USA · proctored',
    date: '2027-03-27',
    time: null,
    zone: 'America/New_York',
    approx: true,
    url: 'https://usaco.org/',
    source: 'Placeholder: the 2026 US Open was on 28 March.',
  },
  {
    id: 'noi-prelim',
    name: 'NOI Preliminary',
    where: 'Singapore · online',
    date: '2027-02-20',
    time: null,
    zone: 'Asia/Singapore',
    approx: true,
    url: 'https://noisg.comp.nus.edu.sg/',
    source: 'NUS lists it for a Saturday in February 2027, day not set yet. 2026’s was on 21 Feb.',
  },
  {
    id: 'noi-final',
    name: 'NOI Final',
    where: 'Singapore',
    date: '2027-03-13',
    time: null,
    zone: 'Asia/Singapore',
    approx: true,
    url: 'https://noisg.comp.nus.edu.sg/',
    source: 'NUS lists it for a Saturday in March 2027, day not set yet. 2026’s was on 14 Mar.',
  },
  {
    id: 'apio',
    name: 'APIO 2027',
    where: 'Asia-Pacific · online',
    date: '2027-05-08',
    time: null,
    zone: 'Asia/Singapore',
    approx: true,
    url: 'https://cence.comp.nus.edu.sg/cence/events.html',
    source: 'NUS lists it for a Saturday in May 2027. APIO 2026 was on 9–10 May.',
  },
];

export interface CalendarEntry {
  event: SeasonEvent;
  date: string;
  time: string | null;
  /** Still the built-in placeholder (no exact day known). */
  approx: boolean;
  hidden: boolean;
  /** Set on the page rather than built in. */
  mine: boolean;
}

/** The season's other contests as I see them: my dates over the built-in ones, in date order. */
export function seasonCalendar(events: RoadSettings['events']): CalendarEntry[] {
  return SEASON_EVENTS.map((event) => {
    const own: RoadEvent | undefined = events[event.id];
    const mine = !!own?.date;
    return {
      event,
      date: mine ? own!.date! : event.date,
      time: mine ? own!.time : event.time,
      approx: mine ? false : event.approx,
      hidden: own?.hidden ?? false,
      mine,
    };
  }).sort((a, b) => a.date.localeCompare(b.date));
}

/** Contests still ahead (or on today), and the ones I hid. Past contests drop off. */
export function upcoming(calendar: CalendarEntry[], today: string): { shown: CalendarEntry[]; hidden: CalendarEntry[] } {
  const ahead = calendar.filter((c) => c.date >= today);
  return { shown: ahead.filter((c) => !c.hidden), hidden: ahead.filter((c) => c.hidden) };
}
