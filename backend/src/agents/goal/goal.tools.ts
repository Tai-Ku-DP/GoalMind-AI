/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { SimplamoClient } from '../../simplamo/simplamo.client';
import { ConfigService } from '@nestjs/config';
import { computedDeadline } from '../tools';

export function createGoalTools(client: SimplamoClient, config: ConfigService) {
  const defaultTeamId = config.get<string>('SIMPLAMO_TEAM_ID', '');
  const defaultSessionId = config.get<string>('SIMPLAMO_SESSION_ID', '');

  const listGoals = tool(
    async ({ teamId, sessionId }) => {
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

        const trimmed = list.slice(0, 20).map((r: Record<string, unknown>) => {
          const deadline = computedDeadline(r?.dueDate as string);
          return {
            id: r._id,
            title: r.title,
            status: r.status,
            percentDone: r.percentDone,
            deadline: deadline.dueDateFormatted,
            daysRemaining: deadline.daysRemaining,
            isOverdue: deadline.isOverdue,
            rockType: r.rockType,
            owner: (r.rockOwner as Record<string, unknown>)?.fullName,
            doneMilestones: r.doneMilestones,
            totalMilestones: r.totalMilestones,
            sessionName: r.sessionName,
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
      try {
        const data = await client.getRockDetail(rockId);
        const deadline = computedDeadline(data.dueDate);
        const milestones = Array.isArray(data.milestones)
          ? (data.milestones as Record<string, unknown>[]).map((m) => {
              const mDeadline = computedDeadline(m.dueDate);
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
                assignee: (m.assignee as Record<string, unknown>)?.fullName,
              };
            })
          : [];
        const today = new Date().toLocaleDateString('vi-VN', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        });
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
                  percentDone: data.parentRock.percentDone,
                }
              : null,
            sessionName: data.sessionName,
          },
        });
      } catch (err: unknown) {
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
      description: `Use to get detailed info about a specific rock/goal including milestones.
        Requires rockId (_id from listGoals). Returns pre-computed deadline info with daysRemaining and isOverdue.`,
      schema: z.object({
        rockId: z.string().describe('The Simplamo rock _id'),
      }),
    },
  );

  const updateGoalStatus = tool(
    async ({ rockId, status }) => {
      try {
        await client.updateRockStatus(rockId, status);
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
