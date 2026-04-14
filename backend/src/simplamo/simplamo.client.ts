import axios, { AxiosInstance } from 'axios';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SimplamoClient {
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
  }

  // ── Rocks (Goals) ──

  async listRocks(params: {
    teamId: string;
    sessionId: string;
    rock?: string;
    pic?: string;
    rangeStart?: string;
    rangeEnd?: string;
  }) {
    const { data } = await this.http.get('/eos-core/rocks', { params });
    console.log(data);
    return data;
  }

  async getRockDetail(rockId: string) {
    const { data } = await this.http.get(`/eos-core/rocks/${rockId}`);
    return data;
  }

  async updateRockStatus(
    rockId: string,
    status: 'ON_TRACK' | 'OFF_TRACK' | 'AT_RISK' | 'DONE',
  ) {
    const { data } = await this.http.patch(`/eos-core/rocks/${rockId}`, {
      status,
    });
    return data;
  }

  // ── Metrics / Scorecard ──

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

  async getTeamScorecard(teamId: string) {
    const { data } = await this.http.get('/eos-core/metrics/scorecard', {
      params: { teamId },
    });
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
}
