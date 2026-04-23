import axios, { AxiosInstance } from 'axios';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  IParamsListRocks,
  IPramsUpdateRockStatus,
  ISimplamoClient,
  ICurrentUser,
  ITodo,
  ICreateTodoPayload,
  IUpdateTodoPayload,
} from './types';
import { IRock } from 'src/agents/goal/types';
import type {
  IScorecardMeasurable,
  IMetricCalculationResponse,
  IMetricCalcPeriod,
} from 'src/agents/metrics/scorecard.types';

@Injectable()
export class SimplamoClient implements ISimplamoClient {
  private readonly http: AxiosInstance;

  constructor(private config: ConfigService) {
    this.http = axios.create({
      baseURL: 'https://api.simplamo.com/api',
      headers: {
        Authorization: `Bearer ${this.config.get<string>('SIMPLAMO_API_TOKEN')}`,
        'Content-Type': 'application/json',
        'tenant-id': 'core',
        'content-language': 'en',
      },
      timeout: 10000,
    });

    this.http.interceptors.response.use(
      (res) => res,
      (err) => {
        const status: number = err.response?.status ?? 0;
        const apiErr = err.response?.data?.error;
        const message: string = apiErr?.message ?? err.message;
        const details = apiErr?.details;
        const detailStr = details?.length
          ? ' — ' +
            details
              .map(
                (d: { path: string; message: string }) =>
                  `${d.path}: ${d.message}`,
              )
              .join(', ')
          : '';
        const clean = new Error(`[Simplamo ${status}] ${message}${detailStr}`);
        return Promise.reject(clean);
      },
    );
  }

  // ── Current User ──

  async getCurrentUser(): Promise<ICurrentUser> {
    const { data } = await this.http.get<ICurrentUser>('/auth/users/me', {
      params: { ignoreTracking: true },
    });
    return data;
  }

  // ── Rocks (Goals) ──
  async listRocks(params: IParamsListRocks): Promise<IRock[]> {
    const { data } = await this.http.get<IRock[]>('/eos-core/rocks', {
      params,
    });

    return data;
  }

  async getRockDetail(rockId: string): Promise<IRock> {
    const { data } = await this.http.get<IRock>(`/eos-core/rocks/${rockId}`);
    return data;
  }

  async updateRockStatus(params: IPramsUpdateRockStatus): Promise<IRock> {
    const { data } = await this.http.patch<IRock>(
      `/eos-core/rocks/${params.rockId}`,
      {
        status: params.status,
      },
    );
    return data;
  }

  // ── Scorecard / Measurables ──

  /**
   * GET /score-cards/measurables
   * Returns measurables with `scores[]` (weekly history) and `goal` for a team.
   * @param interval  Number of weeks of history (default 13)
   * @param periodInterval  "weekly" | "monthly" | "quarterly" | "annual"
   */
  async getScorecardMeasurables(params: {
    teamId: string;
    interval?: number;
    periodInterval?: string;
    isArchived?: boolean;
  }): Promise<IScorecardMeasurable[]> {
    const { data } = await this.http.get<IScorecardMeasurable[]>(
      '/eos-core/score-cards/measurables',
      {
        params: {
          teamId: params.teamId,
          interval: params.interval ?? 13,
          periodInterval: params.periodInterval ?? 'weekly',
          isArchived: params.isArchived ?? false,
        },
      },
    );

    if (Array.isArray(data)) return data;
    return (data as { data: IScorecardMeasurable[] }).data ?? [];
  }

  /**
   * POST /score-cards/metric-calculation
   * Returns rolled-up values (monthly/quarterly/annual) for each measurable.
   */
  async getScorecardMetricCalculation(
    teamId: string,
    periodInterval: string,
    payload: IMetricCalcPeriod[],
  ): Promise<IMetricCalculationResponse> {
    const { data } = await this.http.post<IMetricCalculationResponse>(
      '/eos-core/score-cards/metric-calculation',
      { teamId, periodInterval, payload },
    );
    return data;
  }

  // ── Legacy metric endpoints (kept for backward compat) ──

  async listMetrics(params?: { teamId?: string }) {
    const { data } = await this.http.get('/eos-core/metrics', { params });
    return data;
  }

  async getMetricValues(
    metricId: string,
    params?: { from?: string; to?: string },
  ) {
    const { data } = await this.http.get(
      `/eos-core/metrics/${metricId}/values`,
      { params },
    );
    return data;
  }

  // ── Actions (Todos / Issues) ──

  async listActions(params?: {
    goalId?: string;
    status?: string;
    teamId?: string;
  }) {
    const { data } = await this.http.get('/eos-core/actions', { params });
    return data;
  }

  async createAction(payload: {
    title: string;
    goalId?: string;
    dueDate?: string;
    priority?: string;
    owner?: string;
  }) {
    const { data } = await this.http.post('/eos-core/actions', payload);
    return data;
  }

  async updateActionStatus(actionId: string, done: boolean) {
    const { data } = await this.http.patch(`/eos-core/actions/${actionId}`, {
      done,
    });
    return data;
  }

  // ── Todos ──

  async listTodos(params: {
    teamId: string;
    getAll?: boolean;
    isArchived?: boolean;
    inMeeting?: boolean;
  }): Promise<ITodo[]> {
    const { data } = await this.http.get<
      ITodo[] | { items: ITodo[] } | { data: ITodo[] }
    >('/eos-core/todos', {
      params: {
        getAll: params.getAll ?? true,
        inMeeting: params.inMeeting ?? false,
        isArchived: params.isArchived ?? false,
        teamIds: params.teamId,
      },
      headers: { 'Content-Language': 'vi' },
    });

    if (Array.isArray(data)) return data;
    // API trả về { items: [...], total, page, itemPerPage }
    const wrapped = data as { items?: ITodo[]; data?: ITodo[] };
    return wrapped.items ?? wrapped.data ?? [];
  }

  async createTodos(todos: ICreateTodoPayload[]): Promise<ITodo[]> {
    console.log('[createTodos] payload:', JSON.stringify(todos));
    const { data } = await this.http.post<ITodo[]>(
      '/eos-core/todos/many',
      todos,
      { headers: { 'Content-Language': 'vi' } },
    );
    return Array.isArray(data) ? data : [data as unknown as ITodo];
  }

  async updateTodo(
    todoId: string,
    payload: IUpdateTodoPayload,
  ): Promise<ITodo> {
    const { data } = await this.http.patch<ITodo>(
      `/eos-core/todos/${todoId}`,
      {
        saveHistoryDescription: true,
        teamIds: [],
        linkAttachments: [],
        ...payload,
      },
      { headers: { 'Content-Language': 'vi' } },
    );
    return data;
  }
  async createIssue(payload: {
    title: string;
    ownerId: string;
    teamId: string;
    companyId: string;
    description?: string;
    status?: 'PLAN' | 'ON_TRACK' | 'NOT_STARTED' | 'DONE';
    interval?: 'SHORT_TERM' | 'LONG_TERM';
  }): Promise<{ _id: string; title: string }> {
    const { data } = await this.http.post<{ _id: string; title: string }>(
      '/eos-core/issues',
      {
        ownerId: payload.ownerId,
        teamId: payload.teamId,
        companyId: payload.companyId,
        title: payload.title,
        status: payload.status ?? 'PLAN',
        interval: payload.interval ?? 'SHORT_TERM',
        description:
          payload.description ??
          '<p><strong>Nhận diện nguyên nhân cốt lõi:</strong></p><ul><li> </li></ul><p><strong>Bàn luận phương án:</strong></p><ul><li> </li></ul><p><strong>Chốt hành động:</strong></p><ul><li> </li></ul>',
      },
      { headers: { 'Content-Language': 'vi' } },
    );
    return data;
  }
}
