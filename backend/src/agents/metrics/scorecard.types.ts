// ─── Simplamo Scorecard API Types ─────────────────────────────────────────────

export interface IScorecardScore {
  periodStartDate: string;
  periodEndDate: string;
  periodInterval: string;
  value: number | null;
  _id: string | null;
  editable?: boolean;
  viewMode?: string;
}

export interface IScorecardGoal {
  value: number;
  orientation: 'gte' | 'lte' | 'gt' | 'lt' | 'equal';
}

export interface IScorecardOwner {
  _id: string;
  fullName: string;
  email: string;
  avatar?: string;
  isActive?: boolean;
}

/** One row from GET /score-cards/measurables */
export interface IScorecardMeasurable {
  _id: string;
  title: string;
  description?: string;
  unit: string;
  currency?: string;
  periodInterval: 'weekly' | 'monthly' | 'quarterly' | 'annual';
  goal: IScorecardGoal;
  goalAdvanced?: Array<{
    id?: string;
    value: number;
    orientation: 'gte' | 'lte' | 'gt' | 'lt' | 'equal';
    periodStartDate: string;
    periodEndDate: string;
    periodInterval: string;
  }>;
  metricCalculation: 'SUM' | 'AVERAGE';
  scores: IScorecardScore[];
  owner?: IScorecardOwner;
  isArchived?: boolean;
  cumulative?: boolean;
  average?: boolean;
  priority?: number;
}

// ─── Metric Calculation API Types ─────────────────────────────────────────────

export interface IMetricCalcPeriod {
  type: 'monthly' | 'quarterly' | 'annual';
  date: string;
}

export interface IMetricCalculationEntry {
  _id: string;
  metricCalculations: Array<{
    type: 'monthly' | 'quarterly' | 'annual';
    date: string;
    value: number;
  }>;
}

export interface IMetricCalculationResponse {
  headers: IMetricCalcPeriod[];
  data: IMetricCalculationEntry[];
}

// ─── Processed / AI-facing types ──────────────────────────────────────────────

export type TrendDirection = 'up' | 'down' | 'flat';
export type OffTrackSeverity = 'CRITICAL' | 'WARNING' | 'ON_TRACK';

export interface IGoalAdvancedStat {
  periodInterval: string;
  from: string;
  to: string;
  target: number;
  orientation: string;
  metricCalculation: string;
  actual: number | null;
  remaining: number | null;
  rate: number | null;
}

export interface IProcessedScorecardMetric {
  id: string;
  title: string;
  unit: string;
  owner: string;
  ownerId: string;
  goalValue: number;
  goalOrientation: 'gte' | 'lte' | 'gt' | 'lt' | 'equal';
  /** Goal thực tế cho tuần mới nhất — có thể là goalAdvanced */
  latestEffectiveGoalValue: number;
  latestIsAdvancedGoal: boolean;
  latestValue: number | null;
  achievementPct: number | null;
  isOnTrack: boolean;
  offTrackSeverity: OffTrackSeverity;
  consecutiveOffTrackWeeks: number;
  trend: TrendDirection;
  trendLabel: string;
  weeklyChangePct: number | null;
  streakWeeks: number;
  recentScores: Array<{
    weekStart: string;
    weekEnd: string;
    value: number | null;
    goalValue: number;
    isAdvancedGoal: boolean;
    achievementPct: number | null;
  }>;
  /** Thống kê tổng hợp (overall) cho từng goalAdvanced period — hiển thị dạng tab */
  goalAdvancedStats: IGoalAdvancedStat[];
}
