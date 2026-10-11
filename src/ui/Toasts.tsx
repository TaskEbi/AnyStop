import { useEffect, useRef } from 'react';
import { dismissToast, ui } from '../data/ui';
import { useStore } from '../lib/createStore';
import './toasts.css';

/**
 * Little paper slips at the bottom; announced politely to screen readers.
 * Rendered as a manual popover and re-raised on each new toast, so it sits
 * above any open dialog (both live in the browser's top layer).
 */
export function Toasts() {
  const toasts = useStore(ui, (s) => s.toasts);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el?.showPopover) return;
    if (el.matches(':popover-open')) el.hidePopover();
    if (toasts.length) el.showPopover();
  }, [toasts]);

  return (
    <div ref={ref} className="toasts" popover="manual" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className="toast">
          <span className="toast__text">{t.text}</span>
          {t.action && (
            <button
              type="button"
              className="btn btn--small"
              onClick={() => {
                t.action!.run();
                dismissToast(t.id);
              }}
            >
              {t.action.label}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
