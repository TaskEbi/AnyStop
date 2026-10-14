import { useMemo } from 'react';
import type { LogMetric } from '../../data/types';
import { ChartTable, ColumnChart, type Column } from './charts';
import { dayOfMonth, daysBetween, monthName, shortDay, weekdayLetter } from './dates';
import { METRICS } from './DayMetrics';
import { metricByDay, metricMonthly, metricSummary, type MetricSummary } from './stats';
import { useMetrics } from './useLog';

/** A metric's per-day values and summary for the period on show. */
export function useMetricPeriod(metric: LogMetric, from: string, to: string): { byDay: Map<string, number>; summary: MetricSummary } {
  const metrics = useMetrics();
  return useMemo(() => {
    const byDay = metricByDay(metrics.values(), metric, from, to);
    return { byDay, summary: metricSummary(byDay) };
  }, [metrics, metric, from, to]);
}

/** Sleep, sleep score or screen time, day by day (or, over a year, each month's average). */
export function MetricCard({ metric, period, from, to, today }: { metric: LogMetric; period: 'week' | 'month' | 'year'; from: string; to: string; today: string }) {
  const info = METRICS[metric];
  const year = period === 'year';
  const metrics = useMetrics();
  const { byDay, summary } = useMetricPeriod(metric, from, to);
  const { long } = info.scale;
  const series = { colourOf: () => info.colour, nameOf: () => (year ? `${info.label} (daily average)` : info.label) };

  const columns: Column[] = useMemo(() => {
    if (year) {
      return metricMonthly(metrics.values(), metric, from.slice(0, 4)).map((m) => ({
        key: m.key,
        tick: monthName(m.key).slice(0, 3),
        title: `${monthName(m.key, true)} ${m.key.slice(0, 4)}${m.days ? ` · average of ${m.days} ${m.days === 1 ? 'day' : 'days'}` : ''}`,
        future: m.key > today,
        segments: [{ id: metric, minutes: m.average ?? 0 }],
      }));
    }
    return daysBetween(from, to).map((d, i) => ({
      key: d,
      tick: period === 'week' ? weekdayLetter(d) : i === 0 || dayOfMonth(d) % 5 === 0 ? String(dayOfMonth(d)) : '',
      title: shortDay(d, today),
      future: d > today,
      segments: [{ id: metric, minutes: byDay.get(d) ?? 0 }],
    }));
  }, [metrics, metric, period, from, to, today, year, byDay]);

  const titleId = `${metric}-chart-title`;
  return (
    <section className="log-card" aria-labelledby={titleId}>
      <h3 className="log-card__title hand" id={titleId}>
        {info.label}
      </h3>
      {summary.days === 0 ? (
        <p className="log-quiet">
          No {info.label.toLowerCase()} logged this {period}. Add it on Today.
        </p>
      ) : (
        <>
          <p className="log-quiet type">
            Average {long(summary.average ?? 0)} over {summary.days} {summary.days === 1 ? 'day' : 'days'}
            {summary.days > 1 && summary.low && summary.high && ` · lowest ${long(summary.low.minutes)}, highest ${long(summary.high.minutes)}`}
          </p>
          <ColumnChart columns={columns} series={series} scale={info.scale} label={`${info.label} per ${year ? 'month, daily average' : 'day'}`} />
          <ChartTable columns={columns} ids={[metric]} series={series} scale={info.scale} caption={`${info.label} per ${year ? 'month' : 'day'}`} />
        </>
      )}
    </section>
  );
}
