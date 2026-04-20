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
  orientation: 'gte' | 'lte';
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
    value: number;
    orientation: 'gte' | 'lte';
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

export interface IProcessedScorecardMetric {
  id: string;
  title: string;
  unit: string;
  owner: string;
  goalValue: number;
  goalOrientation: 'gte' | 'lte';
  latestValue: number | null;
  achievementPct: number | null;
  isOnTrack: boolean;
  offTrackSeverity: OffTrackSeverity;
  consecutiveOffTrackWeeks: number;
  trend: TrendDirection;
  trendLabel: string;
  weeklyChangePct: number | null;
  recentScores: Array<{
    weekStart: string;
    weekEnd: string;
    value: number | null;
    achievementPct: number | null;
  }>;
}
