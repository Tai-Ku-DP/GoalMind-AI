export type IRockType = 'company' | 'department' | 'individual';

export type IRockStatusType = 'OFF_TRACK' | 'ON_TRACK' | 'NOT_DONE' | 'DONE';

export type IRockLinkType = 'ROCK' | 'STRATEGY';

export type IMilestoneStatus = 'ON_TRACK' | 'DONE';

export type IMilestoneType = 'MEASURABLE' | 'TRACKED';

export type IMilestoneUnit = 'NUMBER' | 'PERCENT' | 'CURRENCY' | 'ACHIEVABLE';

export interface ITeamIcon {
  name: string | null;
  bg: string | null;
}

export interface ITeamOwner {
  _id: string;
  icon: ITeamIcon | null;
  name: string;
  companyId: string;
  isLeaderShip: boolean | null;
  isPrivate: boolean;
  autoMapMetrics: boolean | null;
  alignWithMeasurables: boolean | null;
  priority: number;
}

export interface IRockOwner {
  _id: string;
  fullName: string | null;
  avatar: string | null;
  email: string | null;
  isDeactivate?: boolean;
}

export interface IProcessAttachment {
  id: string;
  mimeType: string;
  size: number;
  name: string;
  url: string;
}

export type IRockAttachment = IProcessAttachment;
export type IMilestoneAttachment = IProcessAttachment;

export interface IParentRock {
  _id: string;
  title: string;
}

export interface IChildRock2 {
  _id: string;
  title: string;
  companyId: string;
  teamId: string;
  ownerId: string;
  rockOwner: IRockOwner;
  sessionId: string | null;
  sessionName: string | null;
  parentId: string | null;
  dueDate: string;
  rockType: IRockType;
  status: IRockStatusType;
  percentDone: number;
}

export interface IMilestoneOwner {
  _id: string;
  fullName: string | null;
  avatar: string | null;
}

export interface IMilestoneRecordOwner {
  _id: string;
  fullName: string | null;
  avatar: string | null;
}

export interface IMilestoneRecord {
  percent: number | null;
  dateTime: string;
  description: string | null;
  updatedBy: IMilestoneRecordOwner;
}

export interface IMilestoneStep {
  _id: string;
  title: string;
  startDay: string;
  endDay: string;
  percentDone: number;
}

export interface IUser {
  _id: string;
  fullName: string;
  avatar: string;
}

export interface ITeam {
  _id: string;
  name: string;
}

export interface IMilestone {
  _id: string;
  title: string;
  type: IMilestoneType;
  unit: IMilestoneUnit;
  currency: string | null;
  fromValue: number | null;
  toValue: number | null;
  currentPercent: number | null;
  isManualStatus: boolean;
  status: IMilestoneStatus;
  steps: IMilestoneStep[];
  records: IMilestoneRecord[];

  // Using any[] for issues and todos as they belong to different domains out of rock
  // Replace `any` with `IIssue` and `ITodo` if you have their TS interface exported globally
  issues: any[];
  todos: any[];

  linkAttachments: IMilestoneAttachment[] | null;
  totalComments: number;
  rockId: string;
  priority: number;
  startDate: string;
  dueDate: string;
  description: string;
  assigneeId: string;
  assignee: IMilestoneOwner;
  updatedAt: string;
}

export interface IRockHistory {
  _id: string;
  fieldId: string;
  fieldDisplay: string;
  from: string;
  to: string;
  fieldType: 'string' | 'object' | 'number' | 'array' | 'undefined';
  action: 'create' | 'update' | 'change' | 'archive' | 'unarchive';
  actor: IUser;
  fromUser: IUser;
  user: IUser;
  fromTeam: ITeam;
  team: ITeam;
  fromTeams: ITeam[];
  teams: ITeam[];
  fromUsers: IUser[];
  users: IUser[];
  createdAt: string;
  updatedAt: string;
}

export interface IRock {
  _id: string;
  title: string;

  companyId: string;
  teamId: string;
  teamIds: string[] | null;

  ownerId: string;
  rockOwner: IRockOwner;

  sessionId: string | null;
  sessionName: string | null;
  sessionIds: string[] | null;
  sessionShared: Record<string, string>;

  linkType: IRockLinkType;
  parentId: string | null;
  parentRock: IParentRock | null;
  calculateForParent: boolean | null;
  strategyId: string | null;

  startDate: string;
  dueDate: string;
  rockType: IRockType;
  isManualStatus: boolean;
  status: IRockStatusType | null;
  isArchived: boolean;
  description: string;

  milestones: IMilestone[];
  alignChildRocks: IChildRock2[];
  linkAttachments: IRockAttachment[] | null;

  priority: number | null;
  doneMilestones: number;
  totalMilestones: number;
  totalComments: number;
  progress: number;
  percentDone: number | null;
  weight: number | null;
  isPerformance: boolean;
  isShowMilestones: boolean;
  teamOwner: ITeamOwner | null;

  createdAt: string;
  updatedAt: string;
}
