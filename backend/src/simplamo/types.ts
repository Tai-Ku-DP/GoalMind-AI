import { IRock, IRockStatusType } from 'src/agents/goal/types';

export interface ICurrentUser {
  _id: string;
  email?: string;
  fullName?: string;
  name?: string;
}

export interface ISimplamoClient {
  getCurrentUser(): Promise<ICurrentUser>;
  listRocks(params: IParamsListRocks): Promise<IRock[]>;
  getRockDetail(rockId: string): Promise<IRock>;
  updateRockStatus(params: IPramsUpdateRockStatus): Promise<IRock>;
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

// ── Todo types ──

export type ITodoStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'DONE' | 'ON_TRACK';
export type ITodoPriority = 'HIGH' | 'MEDIUM' | 'LOW' | '';

export interface ITodoOwner {
  _id: string;
  email?: string;
  fullName?: string;
  avatar?: string;
}

export interface ITodo {
  _id: string;
  title: string;
  status: ITodoStatus;
  dueDate: string;
  priorityType: ITodoPriority;
  teamId: string;
  ownerId: string;
  owner?: ITodoOwner;
  description?: string;
  isArchived?: boolean;
  isOverduedate?: number;
}

export interface ICreateTodoPayload {
  teamId: string;
  ownerId: string;
  title: string;
  status: ITodoStatus;
  description?: string;
  dueDate: string;
  priorityType: ITodoPriority;
  rockId?: string;
}

export interface IUpdateTodoPayload {
  title?: string;
  description?: string;
  dueDate?: string;
  ownerId?: string;
  teamId?: string;
  teamIds?: string[];
  linkAttachments?: unknown[];
  status?: ITodoStatus;
  priorityType?: ITodoPriority;
  saveHistoryDescription?: boolean;
}
