import { useState, type ReactNode } from 'react';

interface Props {
  /** The button that starts it, e.g. "Delete". */
  label: ReactNode;
  /** What will happen, shown in the confirm step. */
  message: ReactNode;
  confirmLabel?: string;
  onConfirm: () => void;
  className?: string;
}

/** A two-step button: first click asks in place, second click does it. No browser confirm(). */
export function InlineConfirm({ label, message, confirmLabel = 'Yes, do it', onConfirm, className = 'btn btn--danger' }: Props) {
  const [asking, setAsking] = useState(false);
  if (!asking) {
    return (
      <button type="button" className={className} onClick={() => setAsking(true)}>
        {label}
      </button>
    );
  }
  return (
    <span className="inline-confirm" role="group" aria-label="Confirm">
      <span className="inline-confirm__msg">{message}</span>
      <button type="button" className="btn btn--primary btn--small" onClick={onConfirm} autoFocus>
        {confirmLabel}
      </button>
      <button type="button" className="btn btn--small" onClick={() => setAsking(false)}>
        Cancel
      </button>
    </span>
  );
}
