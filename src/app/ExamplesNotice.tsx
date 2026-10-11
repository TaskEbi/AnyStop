import { clearExamples } from '../data/seed';
import { data, liveItems } from '../data/store';
import { toast } from '../data/ui';
import { useStore } from '../lib/createStore';
import { InlineConfirm } from '../ui/InlineConfirm';

/** Placard saying the example exhibits are examples, with a way to clear them. */
export function ExamplesNotice() {
  const count = useStore(data, (s) => liveItems(s.items).filter((i) => i.is_example).length);
  if (!count) return null;
  return (
    <aside className="examples-notice">
      <p>
        <strong className="hand">Example exhibits.</strong> The {count} items marked <span className="type">example</span> are here to show how
        everything looks. Add your own, then clear them away.
      </p>
      <InlineConfirm
        label="Clear examples"
        className="btn btn--small"
        message="Remove all example items, rooms and strings?"
        confirmLabel="Clear"
        onConfirm={() => {
          clearExamples();
          toast('Examples cleared');
        }}
      />
    </aside>
  );
}
