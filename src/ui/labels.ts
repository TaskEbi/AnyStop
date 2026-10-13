import type { Design, Kind, Palette, RoomColor, Status } from '../data/types';

export const KIND_LABEL: Record<Kind, string> = {
  link: 'Link',
  video: 'Video',
  article: 'Article',
  paper: 'Paper',
  photo: 'Photo',
  music: 'Music',
  quote: 'Quote',
  note: 'Note',
};

export const STATUS_LABEL: Record<Status, string> = {
  none: 'No status',
  up_next: 'Up next',
  in_progress: 'In progress',
  done: 'Done',
};

const UP_NEXT_STAMP: Record<Kind, string> = {
  link: 'To visit',
  video: 'To watch',
  article: 'To read',
  paper: 'To read',
  photo: 'To study',
  music: 'To listen',
  quote: 'To ponder',
  note: 'To do',
};

/** Rubber-stamp wording that fits the kind: "TO WATCH", "TO READ", "IN PROGRESS", "DONE". */
export function stampText(kind: Kind, status: Status): string | null {
  if (status === 'up_next') return UP_NEXT_STAMP[kind];
  if (status === 'in_progress') return 'In progress';
  if (status === 'done') return 'Done';
  return null;
}

export const COLOR_LABEL: Record<RoomColor, string> = {
  mustard: 'Mustard',
  sage: 'Sage',
  blue: 'Dusty blue',
  rose: 'Rose',
  lavender: 'Lavender',
  apricot: 'Apricot',
  teal: 'Teal',
  forest: 'Forest',
  olive: 'Olive',
  lemon: 'Lemon',
  coral: 'Coral',
  cherry: 'Cherry',
  magenta: 'Magenta',
  plum: 'Plum',
  sky: 'Sky',
  navy: 'Navy',
  slate: 'Slate',
  charcoal: 'Charcoal',
};

export const tapeVar = (color: RoomColor | null | undefined) => (color ? `var(--tape-${color})` : 'var(--tape-none)');

/** Colour schemes as shown in the menu: daylight desk, night desk, paper and thread. */
export const PALETTE_INFO: Record<Palette, { label: string; desk: string; night: string; paper: string; thread: string }> = {
  kraft: { label: 'Kraft', desk: '#c8a77b', night: '#2a1e16', paper: '#fbf7ee', thread: '#b3261e' },
  'reading-room': { label: 'Reading room', desk: '#93a98c', night: '#1a291f', paper: '#fbf8ee', thread: '#9b2c2c' },
  blueprint: { label: 'Blueprint', desk: '#a6bbd0', night: '#12213a', paper: '#f9faf6', thread: '#c2410c' },
  'pressed-rose': { label: 'Pressed rose', desk: '#d6aea7', night: '#2a181e', paper: '#fdf8f4', thread: '#8e1f3d' },
  'white-cube': { label: 'White cube', desk: '#e6e3dc', night: '#1c1c1e', paper: '#ffffff', thread: '#d0342c' },
  observatory: { label: 'Observatory', desk: '#b4aecb', night: '#16132b', paper: '#fbf9f3', thread: '#f2a541' },
  'sea-glass': { label: 'Sea glass', desk: '#9cc5bd', night: '#0f2826', paper: '#f8fbf8', thread: '#d0553f' },
  terracotta: { label: 'Terracotta', desk: '#cf9473', night: '#2b1811', paper: '#fdf7f1', thread: '#2f4f7f' },
  citrus: { label: 'Citrus', desk: '#e2cd72', night: '#232110', paper: '#fffdf2', thread: '#0f766e' },
  graphite: { label: 'Graphite', desk: '#b8b6b2', night: '#141414', paper: '#fafafa', thread: '#c58b00' },
  candy: { label: 'Candy', desk: '#f1b9cb', night: '#2a1630', paper: '#fffafc', thread: '#2b59c3' },
  sunset: { label: 'Sunset', desk: '#eeaa80', night: '#26142e', paper: '#fff8f0', thread: '#6b2a8f' },
};

/** Design themes as shown in the menu. */
export const DESIGN_INFO: Record<Design, { label: string; blurb: string }> = {
  cabinet: { label: 'Cabinet', blurb: 'Scrapbook: tape, tilted paper, handwriting' },
  gallery: { label: 'Gallery', blurb: 'Clean modern gallery, filters on the right' },
  zine: { label: 'Zine', blurb: 'Bold print, thick ink outlines, hard shadows' },
  archive: { label: 'Archive', blurb: 'Typewritten catalogue, compact and dense' },
  soft: { label: 'Soft', blurb: 'Rounded and airy, frosted-glass panels' },
};
