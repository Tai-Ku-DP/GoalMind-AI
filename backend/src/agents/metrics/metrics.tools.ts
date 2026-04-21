import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { SimplamoClient } from '../../simplamo/simplamo.client';
import { ConfigService } from '@nestjs/config';
import { ToolCacheService } from '../cache/tool-cache.service';
import type {
  IScorecardMeasurable,
  IScorecardScore,
  IScorecardGoal,
  IProcessedScorecardMetric,
  IGoalAdvancedStat,
  OffTrackSeverity,
  TrendDirection,
} from './scorecard.types';

// ─── Shared analysis helpers ───────────────────────────────────────────────────

/**
 * Get the most recent N non-null scores, descending by date (newest first).
 */
function getRecentScores(
  scores: IScorecardScore[],
  take = 13,
): IScorecardScore[] {
  return scores
    .filter((s) => s.value !== null)
    .sort(
      (a, b) =>
        new Date(b.periodStartDate).getTime() -
        new Date(a.periodStartDate).getTime(),
    )
    .slice(0, take);
}

/**
 * Trả về goalAdvanced nếu score nằm trong khoảng thời gian của nó,
 * ngược lại trả về goal mặc định.
 * Tương đương getMeasurableGoal() trong Simplamo frontend.
 */
function getEffectiveGoal(
  score: IScorecardScore,
  mainGoal: IScorecardGoal,
  goalAdvanced?: IScorecardMeasurable['goalAdvanced'],
): IScorecardGoal & { isAdvancedGoal: boolean } {
  if (goalAdvanced?.length) {
    const adv = goalAdvanced.find((a) => {
      const scoreStart = new Date(score.periodStartDate).getTime();
      const scoreEnd = new Date(score.periodEndDate).getTime();
      const advStart = new Date(a.periodStartDate).getTime();
      const advEnd = new Date(a.periodEndDate).getTime();
      return scoreStart >= advStart && scoreEnd <= advEnd;
    });
    if (adv) {
      return {
        value: adv.value,
        orientation: adv.orientation,
        isAdvancedGoal: true,
      };
    }
  }
  return { ...mainGoal, isAdvancedGoal: false };
}

/**
 * Determine trend direction from the last 3–4 weeks.
 * "up"   = strictly increasing (latest > previous > 2-prev)
 * "down" = strictly decreasing
 * "flat" = mixed or insufficient data
 */
function calcTrend(recent: IScorecardScore[]): {
  direction: TrendDirection;
  label: string;
  streakWeeks: number;
} {
  const vals = recent.map((s) => s.value as number);
  if (vals.length < 2)
    return { direction: 'flat', label: '→ không đủ dữ liệu', streakWeeks: 0 };

  // Count how many consecutive weeks in same direction from the top
  let upStreak = 1;
  let downStreak = 1;
  for (let i = 0; i < vals.length - 1; i++) {
    if (vals[i] > vals[i + 1]) upStreak++;
    else break;
  }
  for (let i = 0; i < vals.length - 1; i++) {
    if (vals[i] < vals[i + 1]) downStreak++;
    else break;
  }

  if (upStreak >= 2 && upStreak >= downStreak) {
    return {
      direction: 'up',
      label: `↑ tăng ${upStreak} tuần liên tiếp`,
      streakWeeks: upStreak,
    };
  }
  if (downStreak >= 2 && downStreak > upStreak) {
    return {
      direction: 'down',
      label: `↓ giảm ${downStreak} tuần liên tiếp`,
      streakWeeks: downStreak,
    };
  }
  return {
    direction: 'flat',
    label: '→ đi ngang / không ổn định',
    streakWeeks: 0,
  };
}

/**
 * Count how many of the last N weeks are consecutively off-track.
 * Tự động dùng goalAdvanced nếu score nằm trong khoảng thời gian của nó.
 */
function countConsecutiveOffTrack(
  recent: IScorecardScore[],
  mainGoal: IScorecardGoal,
  goalAdvanced?: IScorecardMeasurable['goalAdvanced'],
): number {
  let count = 0;
  for (const s of recent) {
    const { value: goalValue, orientation } = getEffectiveGoal(
      s,
      mainGoal,
      goalAdvanced,
    );
    const v = s.value as number;
    const isOffTrack = orientation === 'gte' ? v < goalValue : v > goalValue;
    if (isOffTrack) count++;
    else break;
  }
  return count;
}

/**
 * Derive severity from achievement rate and consecutive off-track weeks.
 * Respects metric orientation (gte = bigger is better, lte = smaller is better).
 */
function calcSeverity(
  latestValue: number,
  goalValue: number,
  orientation: IScorecardGoal['orientation'],
  consecutiveOffTrackWeeks: number,
): OffTrackSeverity {
  const isOnTrack =
    orientation === 'lte' ? latestValue <= goalValue : latestValue >= goalValue;

  if (isOnTrack) return 'ON_TRACK';

  const ratio =
    orientation === 'lte' ? goalValue / latestValue : latestValue / goalValue;

  if (ratio < 0.6 || consecutiveOffTrackWeeks >= 3) return 'CRITICAL';
  return 'WARNING';
}

/**
 * Tính tỷ lệ hoàn thành mục tiêu (%) — giống calcGoalRate của Simplamo frontend.
 */
function calcGoalRateHelper(
  actual: number,
  target: number,
  orientation: string,
): number {
  if (['gt', 'gte', 'equal'].includes(orientation)) {
    return actual < target
      ? (actual * 100) / target
      : 100 + ((actual - target) * 100) / target;
  }
  if (['lt', 'lte'].includes(orientation)) {
    return actual < target
      ? 100 - (actual * 100) / target
      : (100 + ((actual - target) * 100) / target) * -1;
  }
  return 0;
}

/**
 * Tính giá trị còn thiếu để đạt mục tiêu — giống calcRemaining của Simplamo frontend.
 */
function calcRemainingHelper(
  actual: number,
  target: number,
  orientation: string,
): number {
  switch (orientation) {
    case 'equal':
      return Math.max(0, target - actual);
    case 'gt':
      return actual > target ? 0 : target - actual + 1;
    case 'gte':
      return actual >= target ? 0 : target - actual;
    case 'lt':
      return actual < target ? 0 : actual - target + 1;
    case 'lte':
      return actual <= target ? 0 : actual - target;
    default:
      return 0;
  }
}

/**
 * Tính giá trị thực đạt trong khoảng thời gian của một goalAdvanced,
 * dùng SUM hoặc AVERAGE tuỳ theo cấu hình của chỉ số.
 */
function computeActualForPeriod(
  scores: IScorecardScore[],
  periodStart: string,
  periodEnd: string,
  metricCalculation: 'SUM' | 'AVERAGE',
): number | null {
  const advStart = new Date(periodStart).getTime();
  const advEnd = new Date(periodEnd).getTime();

  const inPeriod = scores.filter((s) => {
    if (s.value === null) return false;
    const scoreStart = new Date(s.periodStartDate).getTime();
    const scoreEnd = new Date(s.periodEndDate).getTime();
    return scoreStart >= advStart && scoreEnd <= advEnd;
  });

  if (inPeriod.length === 0) return null;

  const values = inPeriod.map((s) => s.value as number);
  const sum = values.reduce((a, b) => a + b, 0);
  return metricCalculation === 'SUM' ? sum : sum / values.length;
}

/**
 * Transform a raw measurable into the AI-facing processed struct.
 */
function processMeasurable(m: IScorecardMeasurable): IProcessedScorecardMetric {
  const recent = getRecentScores(m.scores);
  const latest = recent[0]?.value ?? null;
  const goal = m.goal;

  // Lấy effective goal cho tuần mới nhất (có thể là goalAdvanced)
  const latestEffectiveGoal = recent[0]
    ? getEffectiveGoal(recent[0], goal, m.goalAdvanced)
    : { ...goal, isAdvancedGoal: false };

  const isOnTrack =
    latest === null
      ? true
      : latestEffectiveGoal.orientation === 'gte'
        ? latest >= latestEffectiveGoal.value
        : latest <= latestEffectiveGoal.value;

  const achievementPct =
    latest === null || latestEffectiveGoal.value === 0
      ? null
      : Math.round(
          latestEffectiveGoal.orientation === 'gte'
            ? (latest / latestEffectiveGoal.value) * 100
            : (latestEffectiveGoal.value / latest) * 100,
        );

  const consecutiveOffTrackWeeks =
    latest === null
      ? 0
      : countConsecutiveOffTrack(recent, goal, m.goalAdvanced);

  const offTrackSeverity =
    latest === null
      ? 'ON_TRACK'
      : calcSeverity(
          latest,
          latestEffectiveGoal.value,
          latestEffectiveGoal.orientation,
          consecutiveOffTrackWeeks,
        );

  const { direction, label: trendLabel, streakWeeks } = calcTrend(recent);

  const weeklyChangePct =
    recent.length >= 2 && recent[1].value !== 0 && recent[1].value !== null
      ? Math.round(
          (((recent[0].value as number) - recent[1].value) /
            Math.abs(recent[1].value)) *
            100,
        )
      : null;

  // Thống kê tổng hợp (overall) cho từng goalAdvanced period
  const goalAdvancedStats: IGoalAdvancedStat[] =
    m.goalAdvanced?.map((adv) => {
      const actual = computeActualForPeriod(
        m.scores,
        adv.periodStartDate,
        adv.periodEndDate,
        m.metricCalculation,
      );
      const target = adv.value;
      const orientation = adv.orientation;
      return {
        periodInterval: adv.periodInterval,
        from: adv.periodStartDate.slice(0, 10),
        to: adv.periodEndDate.slice(0, 10),
        target,
        orientation,
        metricCalculation: m.metricCalculation,
        actual,
        remaining:
          actual === null
            ? null
            : calcRemainingHelper(actual, target, orientation),
        rate:
          actual === null
            ? null
            : calcGoalRateHelper(actual, target, orientation),
      };
    }) ?? [];

  return {
    id: m._id,
    title: m.title.trim(),
    unit: m.unit,
    owner: m.owner?.fullName ?? 'N/A',
    goalValue: goal.value,
    goalOrientation: goal.orientation,
    latestEffectiveGoalValue: latestEffectiveGoal.value,
    latestIsAdvancedGoal: latestEffectiveGoal.isAdvancedGoal,
    latestValue: latest,
    achievementPct,
    isOnTrack,
    offTrackSeverity,
    consecutiveOffTrackWeeks,
    trend: direction,
    trendLabel,
    weeklyChangePct,
    streakWeeks,
    recentScores: recent.slice(0, 6).map((s) => {
      const effGoal = getEffectiveGoal(s, goal, m.goalAdvanced);
      return {
        weekStart: s.periodStartDate.slice(0, 10),
        weekEnd: s.periodEndDate.slice(0, 10),
        value: s.value,
        goalValue: effGoal.value,
        isAdvancedGoal: effGoal.isAdvancedGoal,
        achievementPct:
          s.value === null || effGoal.value === 0
            ? null
            : Math.round(
                effGoal.orientation === 'gte'
                  ? (s.value / effGoal.value) * 100
                  : (effGoal.value / s.value) * 100,
              ),
      };
    }),
    goalAdvancedStats,
  } satisfies IProcessedScorecardMetric;
}

// ─── Tool factory ──────────────────────────────────────────────────────────────

export function createMetricsTools(
  client: SimplamoClient,
  config: ConfigService,
  cache: ToolCacheService,
) {
  const defaultTeamId = config.get<string>(
    'SIMPLAMO_TEAM_ID',
    // '60fd7f693e81570057440b4f',
    '60fe00f28ae1ac0057c5422c',
  );

  // ── Shared raw-data cache ───────────────────────────────────────────────────
  // Cache the raw getScorecardMeasurables API response once (5 min TTL).
  // All 3 tools reuse this — no duplicate API calls within the TTL window.
  async function getRawMeasurables(
    teamId: string,
    interval = 13,
  ): Promise<IScorecardMeasurable[]> {
    const rawKey = `rawMeasurables:${teamId}:${interval}`;
    const hit = cache.get<IScorecardMeasurable[]>(rawKey);
    if (hit) return hit;
    const raw = await client.getScorecardMeasurables({
      teamId,
      interval,
      periodInterval: 'weekly',
    });
    cache.set(rawKey, raw);
    return raw;
  }

  // ── Tool 1: getScorecardMetrics ─────────────────────────────────────────────
  const getScorecardMetrics = tool(
    async ({ teamId, interval }) => {
      const tid = teamId || defaultTeamId;
      const cacheKey = `scorecardMetrics:${tid}:${interval ?? 13}`;
      const cached = cache.get<string>(cacheKey);
      if (cached) return cached;

      try {
        const raw = await getRawMeasurables(tid, interval ?? 13);

        const processed = raw.map(processMeasurable);

        const summary = {
          total: processed.length,
          onTrack: processed.filter((m) => m.isOnTrack).length,
          warning: processed.filter((m) => m.offTrackSeverity === 'WARNING')
            .length,
          critical: processed.filter((m) => m.offTrackSeverity === 'CRITICAL')
            .length,
          noData: processed.filter((m) => m.latestValue === null).length,
        };

        const result = JSON.stringify({
          success: true,
          summary,
          metrics: processed,
        });
        cache.set(cacheKey, result);
        return result;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return JSON.stringify({ success: false, error: message });
      }
    },
    {
      name: 'getScorecardMetrics',
      description: `Get the team's Scorecard measurables from Simplamo with weekly history (13 weeks).
        Returns each metric with: title, unit, owner, goal (value + orientation), latestValue,
        achievementPct, isOnTrack, offTrackSeverity (CRITICAL/WARNING/ON_TRACK),
        consecutiveOffTrackWeeks, trend direction and label, recentScores[].
        Call this when user asks about KPIs, scorecard overview, or wants to see all metrics.`,
      schema: z.object({
        teamId: z
          .string()
          .optional()
          .nullable()
          .describe('Team ID to filter, uses default from env if omitted'),
        interval: z
          .number()
          .optional()
          .nullable()
          .describe('Number of weeks of history to fetch (default 13)'),
      }),
    },
  );

  // ── Tool 2: getOffTrackScorecardMetrics ────────────────────────────────────
  const getOffTrackScorecardMetrics = tool(
    async ({ teamId, severityFilter }) => {
      const tid = teamId || defaultTeamId;
      const cacheKey = `offtrackMetrics:${tid}:${severityFilter ?? 'all'}`;
      const cached = cache.get<string>(cacheKey);
      if (cached) return cached;

      try {
        const raw = await getRawMeasurables(tid, 13);

        const processed = raw.map(processMeasurable);
        const offTrack = processed.filter((m) => !m.isOnTrack);

        // Apply optional severity filter
        const filtered = severityFilter
          ? offTrack.filter((m) => m.offTrackSeverity === severityFilter)
          : offTrack;

        // Sort: CRITICAL first, then by consecutiveOffTrackWeeks desc
        filtered.sort((a, b) => {
          const severityOrder = { CRITICAL: 0, WARNING: 1, ON_TRACK: 2 };
          const diff =
            severityOrder[a.offTrackSeverity] -
            severityOrder[b.offTrackSeverity];
          if (diff !== 0) return diff;
          return b.consecutiveOffTrackWeeks - a.consecutiveOffTrackWeeks;
        });

        const criticalCount = filtered.filter(
          (m) => m.offTrackSeverity === 'CRITICAL',
        ).length;
        const warningCount = filtered.filter(
          (m) => m.offTrackSeverity === 'WARNING',
        ).length;

        const result = JSON.stringify({
          success: true,
          totalOffTrack: filtered.length,
          criticalCount,
          warningCount,
          offTrackMetrics: filtered,
        });
        cache.set(cacheKey, result);
        return result;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return JSON.stringify({ success: false, error: message });
      }
    },
    {
      name: 'getOffTrackScorecardMetrics',
      description: `Get all off-track metrics from the Scorecard, sorted by severity.
        CRITICAL 🔴: actual < 60% of goal OR off-track ≥ 3 consecutive weeks.
        WARNING  🟡: actual < 80% of goal OR off-track ≥ 2 consecutive weeks.
        Each result includes consecutiveOffTrackWeeks and trend direction.
        Call when user asks which KPIs are failing, off-track, or need attention.`,
      schema: z.object({
        teamId: z
          .string()
          .optional()
          .nullable()
          .describe('Team ID to filter, uses default from env if omitted'),
        severityFilter: z
          .enum(['CRITICAL', 'WARNING'])
          .optional()
          .nullable()
          .describe('Filter to only CRITICAL or WARNING metrics'),
      }),
    },
  );

  // ── Tool 3: getScorecardTrend ──────────────────────────────────────────────
  const getScorecardTrend = tool(
    async ({ teamId, metricId, includeRollup }) => {
      const tid = teamId || defaultTeamId;
      const cacheKey = `scorecardTrend:${tid}:${metricId}:${includeRollup ? 'rollup' : 'norollup'}`;
      const cached = cache.get<string>(cacheKey);
      if (cached) return cached;

      try {
        const raw = await getRawMeasurables(tid, 13);

        const measurable = raw.find((m) => m._id === metricId);
        if (!measurable) {
          return JSON.stringify({
            success: false,
            error: `Metric ${metricId} not found in team scorecard`,
          });
        }

        const processed = processMeasurable(measurable);
        const recentFull = getRecentScores(measurable.scores, 13);

        // Week-over-week change for each period
        const weeklyChanges = recentFull
          .slice(0, -1)
          .map((s, i) => {
            const prev = recentFull[i + 1].value;
            if (prev === null || prev === 0) return null;
            return Math.round(
              (((s.value as number) - prev) / Math.abs(prev)) * 100,
            );
          })
          .filter((v) => v !== null);

        const avgWeeklyChange =
          weeklyChanges.length > 0
            ? Math.round(
                weeklyChanges.reduce((a, b) => a + b, 0) / weeklyChanges.length,
              )
            : null;

        // Rollup from metric-calculation API
        let rollup: Record<string, number> | null = null;
        if (includeRollup) {
          const now = new Date();
          const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
          const quarterMonth = Math.floor(now.getMonth() / 3) * 3;
          const quarterStart = new Date(now.getFullYear(), quarterMonth, 1);
          const yearStart = new Date(now.getFullYear(), 0, 1);

          const calcResult = await client.getScorecardMetricCalculation(
            teamId || defaultTeamId,
            'weekly',
            [
              { type: 'monthly', date: monthStart.toISOString() },
              { type: 'quarterly', date: quarterStart.toISOString() },
              { type: 'annual', date: yearStart.toISOString() },
            ],
          );

          const entry = calcResult.data?.find((d) => d._id === metricId);
          if (entry) {
            rollup = entry.metricCalculations.reduce(
              (acc, c) => {
                acc[c.type] = c.value;
                return acc;
              },
              {} as Record<string, number>,
            );
          }
        }

        const result = JSON.stringify({
          success: true,
          metric: {
            id: processed.id,
            title: processed.title,
            unit: processed.unit,
            owner: processed.owner,
            goal: {
              value: processed.goalValue,
              orientation: processed.goalOrientation,
            },
            latestEffectiveGoalValue: processed.latestEffectiveGoalValue,
            latestIsAdvancedGoal: processed.latestIsAdvancedGoal,
            advancedGoals:
              measurable.goalAdvanced?.map((adv) => ({
                periodInterval: adv.periodInterval,
                from: adv.periodStartDate.slice(0, 10),
                to: adv.periodEndDate.slice(0, 10),
                value: adv.value,
                orientation: adv.orientation,
              })) ?? [],
            goalAdvancedStats: processed.goalAdvancedStats,
            latestValue: processed.latestValue,
            achievementPct: processed.achievementPct,
            offTrackSeverity: processed.offTrackSeverity,
            consecutiveOffTrackWeeks: processed.consecutiveOffTrackWeeks,
            trend: processed.trend,
            trendLabel: processed.trendLabel,
            avgWeeklyChangePct: avgWeeklyChange,
            history: recentFull.map((s) => {
              const effGoal = getEffectiveGoal(
                s,
                measurable.goal,
                measurable.goalAdvanced,
              );
              return {
                weekStart: s.periodStartDate.slice(0, 10),
                weekEnd: s.periodEndDate.slice(0, 10),
                value: s.value,
                goalValue: effGoal.value,
                isAdvancedGoal: effGoal.isAdvancedGoal,
                achievementPct:
                  s.value === null || effGoal.value === 0
                    ? null
                    : Math.round(
                        effGoal.orientation === 'gte'
                          ? (s.value / effGoal.value) * 100
                          : (effGoal.value / s.value) * 100,
                      ),
              };
            }),
            rollup,
          },
        });
        cache.set(cacheKey, result);
        return result;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return JSON.stringify({ success: false, error: message });
      }
    },
    {
      name: 'getScorecardTrend',
      description: `Get detailed trend analysis for a single scorecard metric (by its ID).
        Returns 13-week history, week-over-week % change, average weekly change,
        trend direction (up/down/flat), streak count, and optionally monthly/quarterly/annual rollup.
        Call when user asks about trend, history, or deep analysis of a specific KPI.`,
      schema: z.object({
        teamId: z
          .string()
          .optional()
          .nullable()
          .describe('Team ID to filter, uses default from env if omitted'),
        metricId: z.string().describe('The Simplamo measurable _id'),
        includeRollup: z
          .boolean()
          .optional()
          .nullable()
          .describe(
            'Include monthly/quarterly/annual rollup values from metric-calculation API',
          ),
      }),
    },
  );

  return [getScorecardMetrics, getOffTrackScorecardMetrics, getScorecardTrend];
}
