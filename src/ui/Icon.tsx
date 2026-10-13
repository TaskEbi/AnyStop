import type { Kind } from '../data/types';

export const ICON_PATHS = {
  orbit: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18M3 12h18M12 3c-6 5-6 13 0 18 6-5 6-13 0-18',
  link: 'M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1',
  video: 'M4 6h12v12H4zM16 10l4-2.5v9L16 14',
  article: 'M5 4h11l3 3v13H5zM8 9h8M8 13h8M8 17h5',
  paper: 'M6 3h9l4 4v14H6zM15 3v4h4M9 12h7M9 16h7',
  photo: 'M4 7h4l1.5-2h5L16 7h4v12H4zM12 16.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7',
  music: 'M9 18V6l10-2v12M9 18a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0M19 16a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0',
  quote: 'M7 11h4v6H5v-4c0-3 1-5 4-6M17 11h4v6h-6v-4c0-3 1-5 4-6',
  note: 'M5 4h14v10l-6 6H5zM13 20v-6h6',
  plus: 'M12 5v14M5 12h14',
  search: 'M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13M15.5 15.5 20 20',
  close: 'M6 6l12 12M18 6 6 18',
  menu: 'M5 7h14M5 12h14M5 17h14',
  filter: 'M4 6h16M7 12h10M10 18h4',
  star: 'M12 3.5l2.6 5.3 5.9.9-4.25 4.1 1 5.8L12 16.9l-5.25 2.7 1-5.8L3.5 9.7l5.9-.9z',
  external: 'M14 4h6v6M20 4l-9 9M18 14v6H4V6h6',
  trash: 'M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13',
  edit: 'M4 20h4L19 9l-4-4L4 16zM13 7l4 4',
  up: 'M12 19V5M6 11l6-6 6 6',
  down: 'M12 5v14M18 13l-6 6-6-6',
  sun: 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.3-1.4M17.7 6.3l1.4-1.4',
  moon: 'M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5',
  shelves: 'M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z',
  collage: 'M3 6l7-2 1 7-7 2zM12 4l8 1-1 8-8-1zM5 15l7-1 1 7-7 1zM14 15h6v6h-6z',
  map: 'M6 6a2 2 0 1 0 0 .01M18 5a2 2 0 1 0 0 .01M12 13a2.5 2.5 0 1 0 0 .01M6 19a2 2 0 1 0 0 .01M18 18a2 2 0 1 0 0 .01M7.5 7l3 4.5M16.5 6.5l-3 4.5M10.5 14.5l-3 3M13.5 14.5l3 2.5',
  dice: 'M5 5h14v14H5zM9 9h.01M15 15h.01M15 9h.01M9 15h.01M12 12h.01',
  cloud: 'M7 18h10a4 4 0 0 0 .5-7.97A6 6 0 0 0 6 9.5 4.25 4.25 0 0 0 7 18',
  offline: 'M7 18h10a4 4 0 0 0 .5-7.97A6 6 0 0 0 6 9.5 4.25 4.25 0 0 0 7 18M4 4l16 16',
} as const;

export type IconName = keyof typeof ICON_PATHS;

export function Icon({ name, size = 18, filled = false, title }: { name: IconName | Kind; size?: number; filled?: boolean; title?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
    >
      {title && <title>{title}</title>}
      <path d={ICON_PATHS[name]} />
    </svg>
  );
}
