import { IRock, IRockStatusType } from 'src/agents/goal/types';

export interface ISimplamoClient {
  listRocks(params: IParamsListRocks): Promise<IRock[]>;
  getRockDetail(rockId: string): Promise<IRock>;
  updateRockStatus(params: IPramsUpdateRockStatus): Promise<IRock>;
  listMetrics(params?: { teamId?: string }): Promise<any>;
  getMetricValues(
    metricId: string,
    params?: { from?: string; to?: string },
  ): Promise<any>;
}

export type IParamsListRocks = {
  teamId: string;
  sessionId: string;
  rock?: string;
  pic?: string;
  rangeStart?: string;
  rangeEnd?: string;
};

export type IPramsUpdateRockStatus = {
  rockId: string;
  status: IRockStatusType;
};
