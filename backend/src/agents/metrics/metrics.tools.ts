import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { SimplamoClient } from '../../simplamo/simplamo.client';

export function createMetricsTools(client: SimplamoClient) {
  const listMetrics = tool(
    async ({ teamId }) => {
      try {
        const data = await client.listMetrics({ teamId });
        const metrics = data.metrics ?? data;
        const trimmed = (Array.isArray(metrics) ? metrics : [])
          .slice(0, 20)
          .map((m: Record<string, unknown>) => ({
            id: m.id,
            name: m.name,
            target: m.target,
            unit: m.unit,
            latestValue: Array.isArray(m.values)
              ? (m.values as Record<string, unknown>[]).at(-1)
              : undefined,
          }));
        return JSON.stringify({
          success: true,
          total: data.total ?? trimmed.length,
          metrics: trimmed,
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return JSON.stringify({ success: false, error: message });
      }
    },
    {
      name: 'listMetrics',
      description: `Use to get a list of metrics/KPIs from Simplamo.
        Call when user asks about their KPIs, scorecard overview, or metrics list.
        Returns list with id, name, target, unit, and latest value.`,
      schema: z.object({
        teamId: z
          .string()
          .optional()
          .describe('Team ID to filter, omit for all teams'),
      }),
    },
  );

  const getMetricValues = tool(
    async ({ metricId, from, to }) => {
      try {
        const data = await client.getMetricValues(metricId, { from, to });
        const values = data.values ?? data;
        const trimmed = (Array.isArray(values) ? values : [])
          .slice(-12)
          .map((v: Record<string, unknown>) => ({
            date: v.date,
            value: v.value,
          }));
        return JSON.stringify({ success: true, values: trimmed });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return JSON.stringify({ success: false, error: message });
      }
    },
    {
      name: 'getMetricValues',
      description: `Use to get historical values of a specific metric over time.
        Call when user asks about trends, history, or weekly/monthly performance of a metric.
        Returns date-value pairs for the last 12 periods.`,
      schema: z.object({
        metricId: z.string().describe('The Simplamo metric ID'),
        from: z.string().optional().describe('Start date ISO format'),
        to: z.string().optional().describe('End date ISO format'),
      }),
    },
  );

  const getOffTrackMetrics = tool(
    async ({ teamId }) => {
      try {
        const data = await client.listMetrics({ teamId });
        const metrics = data.metrics ?? data;
        const offTrack = (Array.isArray(metrics) ? metrics : [])
          .filter((m: Record<string, unknown>) => {
            const values = m.values as Record<string, unknown>[] | undefined;
            const latest = values?.at(-1) as
              | Record<string, unknown>
              | undefined;
            const latestValue = latest?.value as number | undefined;
            const target = m.target as number | undefined;
            return (
              latestValue !== undefined &&
              target !== undefined &&
              target > 0 &&
              latestValue < target * 0.8
            );
          })
          .map((m: Record<string, unknown>) => {
            const values = m.values as Record<string, unknown>[];
            const latestValue = (
              values.at(-1) as Record<string, unknown>
            ).value as number;
            const target = m.target as number;
            return {
              id: m.id,
              name: m.name,
              actual: latestValue,
              target,
              unit: m.unit,
              gap: `${Math.round((latestValue / target) * 100)}%`,
            };
          });
        return JSON.stringify({
          success: true,
          offTrack,
          count: offTrack.length,
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return JSON.stringify({ success: false, error: message });
      }
    },
    {
      name: 'getOffTrackMetrics',
      description: `Use when user asks which metrics/KPIs are not meeting targets.
        Returns metrics where actual value is less than 80% of target.`,
      schema: z.object({
        teamId: z
          .string()
          .optional()
          .describe('Team ID to filter, omit for all teams'),
      }),
    },
  );

  const getTeamScorecard = tool(
    async ({ teamId }) => {
      try {
        const data = await client.getTeamScorecard(teamId);
        return JSON.stringify({ success: true, scorecard: data });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return JSON.stringify({ success: false, error: message });
      }
    },
    {
      name: 'getTeamScorecard',
      description: `Use to get the scorecard for a specific team.
        Call when user asks about team scorecard or weekly KPI summary.
        Requires teamId.`,
      schema: z.object({
        teamId: z.string().describe('The Simplamo team ID'),
      }),
    },
  );

  return [listMetrics, getMetricValues, getOffTrackMetrics, getTeamScorecard];
}
