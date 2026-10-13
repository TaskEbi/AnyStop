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

export interface Settings {
  museum_name: string;
  default_view: ViewName;
  theme: Theme;
  palette: Palette;
  design: Design;
  examples_seeded: boolean;
  updated_at: string;
}

export type TableName = 'rooms' | 'items' | 'connections';
export type RecordOf<T extends TableName> = T extends 'rooms' ? Room : T extends 'items' ? Item : Connection;

export const DEFAULT_SETTINGS: Settings = {
  museum_name: 'Curio Cabinet',
  default_view: 'shelves',
  theme: 'system',
  palette: 'kraft',
  design: 'cabinet',
  examples_seeded: false,
  updated_at: new Date(0).toISOString(),
};
