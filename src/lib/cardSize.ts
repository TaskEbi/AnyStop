import type { Item } from '../data/types';

/** Rough rendered height of a card, so columns come out even without measuring the DOM. */
export function estimateCardHeight(item: Item, width: number): number {
  const text = (item.body ?? '').length + (item.preview?.description ?? '').length * 0.6 + item.title.length;
  const lines = (n: number) => (n / Math.max(20, width / 8.5)) * 20;
  switch (item.kind) {
    case 'video':
      return width * 0.56 + 110 + lines(item.title.length);
    case 'photo':
      return width + 80;
    case 'music':
      return width / 1.42 + 40;
    case 'quote':
      return 110 + lines(text) * 1.3;
    case 'note':
      return Math.max(160, 70 + lines(text) * 1.2);
    default:
      return 110 + lines(text);
  }
}

