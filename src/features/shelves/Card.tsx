import { memo, type ComponentType, type CSSProperties, type KeyboardEvent } from 'react';
import type { Item, Kind, Room } from '../../data/types';
import { accession } from '../../lib/format';
import { jitter } from '../../lib/random';
import { KIND_LABEL, STATUS_LABEL } from '../../ui/labels';
import { Stamp } from '../../ui/Stamp';
import { Tape } from '../../ui/Tape';
import { ArticleCard } from './cards/ArticleCard';
import { LinkCard } from './cards/LinkCard';
import { MusicCard } from './cards/MusicCard';
import { NoteCard } from './cards/NoteCard';
import { PaperCard } from './cards/PaperCard';
import { PhotoCard } from './cards/PhotoCard';
import { QuoteCard } from './cards/QuoteCard';
import { VideoCard } from './cards/VideoCard';
import './cards.css';

export interface CardBodyProps {
  item: Item;
  room: Room | undefined;
}

const BODIES: Record<Kind, ComponentType<CardBodyProps>> = {
  link: LinkCard,
  video: VideoCard,
  article: ArticleCard,
  paper: PaperCard,
  photo: PhotoCard,
  music: MusicCard,
  quote: QuoteCard,
  note: NoteCard,
};

interface Props extends CardBodyProps {
  /** Max tilt in degrees: ±1 on shelves, ±4 in the collage, 0 in the drawer. */
  tilt?: number;
  /** Position in the list, for the staggered settle-in animation. */
  index?: number;
  onOpen?: (id: string) => void;
  className?: string;
}

function CardImpl({ item, room, tilt = 1, index = 0, onOpen, className = '' }: Props) {
  const Body = BODIES[item.kind];
  const interactive = !!onOpen;
  const style = {
    '--tilt': `${(jitter(item.id) * tilt).toFixed(2)}deg`,
    '--i': Math.min(index, 14),
  } as CSSProperties;

  const label = [
    KIND_LABEL[item.kind],
    item.title,
    item.creator && `by ${item.creator}`,
    room?.name ?? 'Unsorted',
    item.status !== 'none' && STATUS_LABEL[item.status],
    item.favourite && 'favourite',
    accession(item.accession_no),
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <article
      className={`card card--${item.kind} ${interactive ? 'card--interactive' : ''} ${className}`}
      style={style}
      data-id={item.id}
      tabIndex={interactive ? 0 : undefined}
      role={interactive ? 'button' : undefined}
      aria-label={interactive ? label : undefined}
      onClick={interactive ? () => onOpen(item.id) : undefined}
      onKeyDown={
        interactive
          ? (e: KeyboardEvent) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onOpen(item.id);
              }
            }
          : undefined
      }
    >
      <Tape color={room?.color} seed={item.id} className={item.kind === 'note' ? 'tape--short' : ''} />
      <Stamp kind={item.kind} status={item.status} />
      {item.favourite && <span className="card__star" aria-hidden="true">★</span>}
      <Body item={item} room={room} />
    </article>
  );
}

export const Card = memo(CardImpl);
