import type { Kind, RoomColor, Status } from '../data/types';

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
};

export const tapeVar = (color: RoomColor | null | undefined) => (color ? `var(--tape-${color})` : 'var(--tape-none)');
