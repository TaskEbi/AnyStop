import type { CardBodyProps } from '../Card';
import { CardMeta } from './parts';

/** Yellow sticky note. Shows the title only when it adds something beyond the text. */
export function NoteCard({ item, room }: CardBodyProps) {
  const body = item.body ?? '';
  const titleStem = item.title.replace(/…$/, '');
  const showTitle = item.title && !body.startsWith(titleStem);
  return (
    <div className="sticky">
      {showTitle && <h3 className="sticky__title">{item.title}</h3>}
      <p className="sticky__text">{body || item.title}</p>
      <CardMeta item={item} room={room} />
    </div>
  );
}
