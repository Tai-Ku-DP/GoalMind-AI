import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { SimplamoClient } from '../../simplamo/simplamo.client';
import { ConfigService } from '@nestjs/config';
import { computedDeadline } from '../tools';
import { IRockStatusType } from './types';

export function createGoalTools(client: SimplamoClient, config: ConfigService) {
  const defaultTeamId = config.get<string>('SIMPLAMO_TEAM_ID', '');
  const defaultSessionId = config.get<string>('SIMPLAMO_SESSION_ID', '');

  const listGoals = tool(
    async ({ teamId, sessionId }) => {
      console.log('[TOOL] listGoals called', { teamId, sessionId });
      try {
        const rocks = await client.listRocks({
          teamId: teamId || defaultTeamId,
          sessionId: sessionId || defaultSessionId,
        });

        const list = Array.isArray(rocks) ? rocks : [];
        const today = new Date().toLocaleDateString('vi-VN', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        });

        const trimmed = list.slice(0, 20).map((r, idx) => {
          const deadline = computedDeadline(r.dueDate);

          const milestones = Array.isArray(r.milestones)
            ? r.milestones.map((m) => {
                const mDeadline = computedDeadline(m.dueDate ?? '');
                const percentDone =
                  m.currentPercent != null
                    ? Math.round(m.currentPercent * 100)
                    : 0;
                const hasRange =
                  m.fromValue != null &&
                  m.toValue != null &&
                  m.toValue !== m.fromValue;
                const currentValue = hasRange
                  ? Math.round(
                      m.fromValue! +
                        (m.toValue! - m.fromValue!) * (m.currentPercent ?? 0),
                    )
                  : null;
                return {
                  title: m.title,
                  status: m.status,
                  deadline: mDeadline.dueDateFormatted,
                  overdueDays: mDeadline.isOverdue
                    ? Math.abs(mDeadline.daysRemaining)
                    : mDeadline.daysRemaining,
                  isOverdue: mDeadline.isOverdue,
                  percentDone,
                  currentValue,
                  fromValue: m.fromValue ?? null,
                  toValue: m.toValue ?? null,
                  assignee: m.assignee?.fullName ?? null,
                };
              })
            : [];

          return {
            position: idx + 1,
            id: r._id,
            title: r.title,
            status: r.status,
            percentDone: r.percentDone,
            deadline: deadline.dueDateFormatted,
            daysRemaining: deadline.daysRemaining,
            isOverdue: deadline.isOverdue,
            rockType: r.rockType,
            owner: r.rockOwner?.fullName,
            doneMilestones: r.doneMilestones,
            totalMilestones: r.totalMilestones,
            sessionName: r.sessionName,
            milestones,
          };
        });

        return JSON.stringify({
          success: true,
          today,
          total: list.length,
          rocks: trimmed,
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return JSON.stringify({ success: false, error: message });
      }
    },
    {
      name: 'listGoals',
      description: `Use to get a list of rocks/goals from Simplamo.
        Call when user asks about their goals, OKRs, rocks, or progress overview.
        Returns rocks with pre-computed deadline info:
        - position: 1-based display order matching the UI list (use this to resolve "rock số N")
        - daysRemaining: positive = days left, negative = days overdue
        - isOverdue: true if deadline has passed
        teamId and sessionId use defaults from env if omitted.`,
      schema: z.object({
        teamId: z
          .string()
          .optional()
          .describe('Team ID to filter, uses default if omitted'),
        sessionId: z
          .string()
          .optional()
          .describe(
            'Session ID representing the quarter/period, uses default if omitted',
          ),
      }),
    },
  );

  const getGoalDetail = tool(
    async ({ rockId }) => {
      console.log('[TOOL] getGoalDetail called', { rockId });
      try {
        const data = await client.getRockDetail(rockId);
        const deadline = computedDeadline(data.dueDate);
        const milestones = Array.isArray(data.milestones)
          ? data.milestones.map((m) => {
              const mDeadline = computedDeadline(m.dueDate ?? '');
              return {
                id: m._id,
                title: m.title,
                status: m.status,
                deadline: mDeadline.dueDateFormatted,
                daysRemaining: mDeadline.daysRemaining,
                isOverdue: mDeadline.isOverdue,
                type: m.type,
                currentPercent: m.currentPercent,
                fromValue: m.fromValue,
                toValue: m.toValue,
                assignee: m.assignee?.fullName,
              };
            })
          : [];
        const today = new Date().toLocaleDateString('vi-VN', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        });
        const daysOverdue = deadline.isOverdue
          ? Math.abs(deadline.daysRemaining)
          : 0;

        return JSON.stringify({
          success: true,
          today,
          rock: {
            id: data._id,
            title: data.title,
            description: data.description
              ? String(data.description)
                  .replace(/<[^>]*>/g, ' ')
                  .trim()
              : '',
            status: data.status,
            percentDone: data.percentDone,
            deadline: deadline.dueDateFormatted,
            daysRemaining: deadline.daysRemaining,
            isOverdue: deadline.isOverdue,
            daysOverdue,
            startDate: data.startDate,
            rockType: data.rockType,
            owner: data.rockOwner?.fullName,
            doneMilestones: data.doneMilestones,
            totalMilestones: data.totalMilestones,
            milestones,
            parentRock: data.parentRock
              ? {
                  id: data.parentRock._id,
                  title: data.parentRock.title,
                }
              : null,
            sessionName: data.sessionName,
          },
        });
      } catch (err: unknown) {
        console.log('getGoalDetail error', err);
        const error = err as {
          response?: { status?: number };
          message?: string;
        };
        const status = error.response?.status;
        if (status === 404)
          return JSON.stringify({
            success: false,
            error: 'Rock không tồn tại',
          });
        if (status === 401)
          return JSON.stringify({
            success: false,
            error: 'Token Simplamo không hợp lệ',
          });
        return JSON.stringify({
          success: false,
          error: error.message ?? 'Unknown error',
        });
      }
    },
    {
      name: 'getGoalDetail',
      description: `Use to get detailed info about a specific rock/goal.
        MUST call this when user asks about: milestones, milestone progress, stalled milestones,
        root cause analysis, deadline risk, corrective actions, full description, or any deep-dive on a single rock.
        listGoals only returns a summary — this tool returns the full milestone list, description, startDate, and parentRock.
        Requires rockId (_id from listGoals). Call once per rock that needs analysis.`,
      schema: z.object({
        rockId: z.string().describe('The Simplamo rock _id'),
      }),
    },
  );

  const updateGoalStatus = tool(
    async ({ rockId, status }) => {
      console.log('[TOOL] updateGoalStatus called', { rockId, status });
      try {
        await client.updateRockStatus({
          rockId,
          status: status as IRockStatusType,
        });
        const statusMap: Record<string, string> = {
          ON_TRACK: 'Đúng tiến độ',
          OFF_TRACK: 'Trệch tiến độ',
          AT_RISK: 'Có rủi ro',
          DONE: 'Hoàn thành',
        };
        return JSON.stringify({
          success: true,
          message: `Đã cập nhật trạng thái rock thành "${statusMap[status] ?? status}"`,
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return JSON.stringify({ success: false, error: message });
      }
    },
    {
      name: 'updateGoalStatus',
      description: `Use to update the status of a rock/goal.
        Valid statuses: ON_TRACK, OFF_TRACK, AT_RISK, DONE.
        Always confirm with user before calling this tool.`,
      schema: z.object({
        rockId: z.string().describe('The Simplamo rock _id'),
        status: z.enum(['ON_TRACK', 'OFF_TRACK', 'AT_RISK', 'DONE']),
      }),
    },
  );

  return [listGoals, getGoalDetail, updateGoalStatus];
}
