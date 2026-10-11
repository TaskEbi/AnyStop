import type { Kind, Status } from '../data/types';
import { stampText } from './labels';
import './Stamp.css';

/** Rubber stamp for status ("TO WATCH", "IN PROGRESS", "DONE"). */
export function Stamp({ kind, status, className = '' }: { kind: Kind; status: Status; className?: string }) {
  const text = stampText(kind, status);
  if (!text) return null;
  return <span className={`stamp stamp--${status} ${className}`}>{text}</span>;
}
