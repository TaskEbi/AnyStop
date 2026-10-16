export const KINDS = ['link', 'video', 'article', 'paper', 'photo', 'music', 'quote', 'note'] as const;
export type Kind = (typeof KINDS)[number];

export const STATUSES = ['none', 'up_next', 'in_progress', 'done'] as const;
export type Status = (typeof STATUSES)[number];

export const ROOM_COLORS = [
  'mustard', 'sage', 'blue', 'rose', 'lavender', 'apricot',
  'teal', 'forest', 'olive', 'lemon', 'coral', 'cherry', 'magenta', 'plum', 'sky', 'navy', 'slate', 'charcoal',
] as const;
export type RoomColor = (typeof ROOM_COLORS)[number];

export type ViewName = 'shelves' | 'collage' | 'map' | 'mind';
export type Theme = 'system' | 'light' | 'dark';
/** Colour schemes for the whole cabinet; each has a daylight and a night version. */
export const PALETTES = [
  'kraft', 'reading-room', 'blueprint', 'pressed-rose', 'white-cube', 'observatory',
  'sea-glass', 'terracotta', 'citrus', 'graphite', 'candy', 'sunset',
] as const;
export type Palette = (typeof PALETTES)[number];
/** Design themes: each restyles the whole layout (type, cards, header, sidebar), independent of the colours. */
export const DESIGNS = ['cabinet', 'gallery', 'zine', 'archive', 'soft'] as const;
export type Design = (typeof DESIGNS)[number];

/** Metadata cached from the link-preview function (or filled in by hand for examples). */
export interface Preview {
  site_name?: string;
  description?: string;
  thumbnail?: string;
  favicon?: string;
  embed?: { provider: string; src: string; aspect?: number };
  fetched_at?: string;
  ok?: boolean;
}

export interface Item {
  id: string;
  kind: Kind;
  title: string;
  url: string | null;
  creator: string | null;
  body: string | null;
  note: string | null;
  room_id: string | null;
  tags: string[];
  status: Status;
  favourite: boolean;
  image_path: string | null;
  preview: Preview | null;
  accession_no: number | null;
  collage_pos: { x: number; y: number } | null;
  is_example: boolean;
  created_at: string;
  updated_at: string;
  last_opened_at: string | null;
  deleted_at: string | null;
}

export interface Room {
  id: string;
  name: string;
  color: RoomColor;
  description: string | null;
  sort_order: number;
  is_example: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface Connection {
  id: string;
  item_a: string;
  item_b: string;
  label: string | null;
  is_example: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

/** A Daily Log topic (parent_id null) or one of its subcategories (one level only). */
export interface LogTopic {
  id: string;
  parent_id: string | null;
  name: string;
  /** Only top-level topics' colours are shown; subcategories use their topic's. */
  color: RoomColor;
  sort_order: number;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

/** Time spent on a topic on one calendar day, entered by hand after the fact. */
export interface LogEntry {
  id: string;
  /** Calendar date YYYY-MM-DD in the Daily Log time zone; never derived from a timestamp. */
  date: string;
  topic_id: string;
  subcategory_id: string | null;
  minutes: number;
  note: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

/**
 * A weekly goal for a top-level topic, in force from week_start (a Monday) until a later
 * revision. minutes null means the goal was removed from that week on.
 */
export interface LogGoal {
  id: string;
  topic_id: string;
  week_start: string;
  minutes: number | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export const LOG_METRICS = ['sleep', 'screen', 'sleep_score'] as const;
/**
 * Sleep (the night before `date`, counted on the morning you wake), that night's sleep
 * score out of 100, and screen time that day.
 */
export type LogMetric = (typeof LOG_METRICS)[number];

/**
 * One day's sleep or screen time. Unlike entries these aren't added up: there is one row per
 * metric per day, and setting it again replaces the number. Clearing it soft-deletes the row.
 */
export interface LogDayMetric {
  id: string;
  date: string;
  metric: LogMetric;
  /** Minutes for sleep and screen time; for sleep_score, the score (0–100). */
  minutes: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

/** The five stages of the Road to IOI page, in order. */
export const ROAD_STAGES = ['joi1', 'joi2', 'final', 'camp', 'ioi'] as const;
export type RoadStageId = (typeof ROAD_STAGES)[number];

export interface RoadStage {
  /** Contest day (YYYY-MM-DD), or null until known; DragonCode's targets fill a missing one. */
  date: string | null;
  /** Start time in Japan time (HH:MM), or null. */
  time: string | null;
  target: string;
  /** Why this stage matters, in my words. */
  reason: string;
  /** The day I qualified (cleared the stage), or null. */
  cleared_on: string | null;
  /** A line about the moment, written once it is cleared. */
  memory: string;
}

/** Road to IOI: my training arc. Training days come from a Daily Log topic and from DragonCode. */
export interface RoadSettings {
  /** "Why do I want this?", in one sentence. */
  why: string;
  /** The Daily Log topic whose entries count as training (sessions saved on the page go there too). */
  topic_id: string | null;
  /** DragonCode's address and the read-only link key from its Settings. Empty when not linked. */
  dragon_url: string;
  dragon_key: string;
  stages: Record<RoadStageId, RoadStage>;
  /** My own dates for the season's other contests (NOI, USACO, APIO), keyed by calendar id, over the built-in ones. */
  events: Record<string, RoadEvent>;
}

/** A contest on the season calendar as I set it: an exact day replacing a rough one, or hidden from the page. */
export interface RoadEvent {
  date: string | null;
  /** Start time (HH:MM) in the contest's own time zone, or null. */
  time: string | null;
  hidden: boolean;
}

const stage = (date: string | null = null, time: string | null = null): RoadStage => ({ date, time, target: '', reason: '', cleared_on: null, memory: '' });

export const DEFAULT_DRAGON_URL = 'https://dragon-academy-sigma.vercel.app';

export const DEFAULT_ROAD: RoadSettings = {
  why: '',
  topic_id: null,
  dragon_url: DEFAULT_DRAGON_URL,
  dragon_key: '',
  // JOI 2027 qualifier dates from the official schedule (ioi-jp.org/joi-2027/tournament_info); the rest are set on the page.
  // Later stages fall back to the published schedule in features/road/calendar.ts until a date is set here.
  stages: { joi1: stage('2026-10-25', '14:00'), joi2: stage('2026-11-29', '13:00'), final: stage(), camp: stage(), ioi: stage() },
  events: {},
};

/** Fill in anything an older or partial copy is missing, so the page can trust the shape. */
export function normaliseRoad(raw: unknown): RoadSettings {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<RoadSettings>;
  const str = (v: unknown, fallback = '') => (typeof v === 'string' ? v : fallback);
  const orNull = (v: unknown) => (typeof v === 'string' && v ? v : null);
  const stages = {} as Record<RoadStageId, RoadStage>;
  for (const id of ROAD_STAGES) {
    const given = (r.stages?.[id] ?? null) as Partial<RoadStage> | null;
    const base = DEFAULT_ROAD.stages[id];
    stages[id] = given
      ? { date: orNull(given.date), time: orNull(given.time), target: str(given.target), reason: str(given.reason), cleared_on: orNull(given.cleared_on), memory: str(given.memory) }
      : { ...base };
  }
  const events: Record<string, RoadEvent> = {};
  if (r.events && typeof r.events === 'object') {
    for (const [id, raw] of Object.entries(r.events as Record<string, unknown>)) {
      if (!raw || typeof raw !== 'object') continue;
      const e = raw as Partial<RoadEvent>;
      events[id] = { date: orNull(e.date), time: orNull(e.time), hidden: e.hidden === true };
    }
  }
  return {
    why: str(r.why),
    topic_id: orNull(r.topic_id),
    dragon_url: str(r.dragon_url, DEFAULT_DRAGON_URL) || DEFAULT_DRAGON_URL,
    dragon_key: str(r.dragon_key),
    stages,
    events,
  };
}

export interface Settings {
  museum_name: string;
  default_view: ViewName;
  theme: Theme;
  palette: Palette;
  design: Design;
  examples_seeded: boolean;
  /** IANA zone that decides what "today" and week boundaries mean in the Daily Log. */
  log_timezone: string;
  road: RoadSettings;
  updated_at: string;
}

interface Records {
  rooms: Room;
  items: Item;
  connections: Connection;
  log_topics: LogTopic;
  log_entries: LogEntry;
  log_goals: LogGoal;
  log_metrics: LogDayMetric;
}
export type TableName = keyof Records;
export type RecordOf<T extends TableName> = Records[T];
/** Push order matters: rooms before the items that use them, items before strings, topics before entries. */
export const TABLES: TableName[] = ['rooms', 'items', 'connections', 'log_topics', 'log_entries', 'log_goals', 'log_metrics'];

export const DEFAULT_SETTINGS: Settings = {
  museum_name: 'Curio Cabinet',
  default_view: 'shelves',
  theme: 'system',
  palette: 'kraft',
  design: 'cabinet',
  examples_seeded: false,
  log_timezone: 'Asia/Singapore',
  road: DEFAULT_ROAD,
  updated_at: new Date(0).toISOString(),
};
