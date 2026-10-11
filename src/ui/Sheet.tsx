import { useEffect, useRef, type ReactNode } from 'react';
import { Icon } from './Icon';
import './Sheet.css';

interface Props {
  title: string;
  /** centre: dialog box · side: drawer from the right (full screen on phones) · bottom: sheet from below */
  variant?: 'centre' | 'side' | 'bottom';
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  /** Hide the visible heading (it is still announced). */
  hideTitle?: boolean;
  className?: string;
  /** Non-modal sheets float over the page without a backdrop (used over the canvas views). */
  modal?: boolean;
}

/** Modal panel built on <dialog>: focus trapping, Esc and the top layer come for free. */
export function Sheet({ title, variant = 'centre', onClose, children, footer, hideTitle, className = '', modal = true }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const opener = document.activeElement as HTMLElement | null;
    if (modal) {
      dialog.showModal();
      return () => {
        dialog.close();
        opener?.focus?.({ preventScroll: true });
      };
    }
    dialog.show();
    // Non-modal dialogs don't get Esc for free.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented && !document.querySelector('dialog:modal')) closeRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      dialog.close();
    };
  }, [modal]);

  return (
    <dialog
      ref={ref}
      className={`sheet sheet--${variant} ${modal ? '' : 'sheet--floating'} ${className}`}
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault();
        closeRef.current();
      }}
      onMouseDown={(e) => {
        if (e.target === ref.current) closeRef.current();
      }}
    >
      <div className="sheet__paper">
        <header className={`sheet__head ${hideTitle ? 'sheet__head--bare' : ''}`}>
          <h2 className={hideTitle ? 'visually-hidden' : 'sheet__title hand'}>{title}</h2>
          <button type="button" className="btn btn--ghost btn--icon sheet__close" onClick={onClose} aria-label="Close">
            <Icon name="close" />
          </button>
        </header>
        <div className="sheet__body">{children}</div>
        {footer && <footer className="sheet__foot">{footer}</footer>}
      </div>
    </dialog>
  );
}
