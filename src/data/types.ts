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

export const LOG_METRICS = ['sleep', 'screen'] as const;
/** Sleep (the night before `date`, counted on the morning you wake) and screen time that day. */
export type LogMetric = (typeof LOG_METRICS)[number];

/**
 * One day's sleep or screen time. Unlike entries these aren't added up: there is one row per
 * metric per day, and setting it again replaces the number. Clearing it soft-deletes the row.
 */
export interface LogDayMetric {
  id: string;
  date: string;
  metric: LogMetric;
  minutes: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
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
  updated_at: new Date(0).toISOString(),
};
