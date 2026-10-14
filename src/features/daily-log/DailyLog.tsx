import { ui } from '../../data/ui';
import { useStore } from '../../lib/createStore';
import { HistoryView } from './HistoryView';
import { StatsView } from './StatsView';
import { TodayView } from './TodayView';
import './log.css';

/** The Daily Log section: Today (log time), History and Stats. */
export function DailyLog() {
  const view = useStore(ui, (s) => s.logView);
  return (
    <main className="log" id="main">
      {view === 'today' && <TodayView />}
      {view === 'history' && <HistoryView />}
      {view === 'stats' && <StatsView />}
    </main>
  );
}
