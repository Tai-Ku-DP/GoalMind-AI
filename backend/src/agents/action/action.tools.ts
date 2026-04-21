import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { SimplamoClient } from '../../simplamo/simplamo.client';

export function createActionTools(client: SimplamoClient) {
  const listActions = tool(
    async ({ goalId, status, teamId }) => {
      try {
        const data = await client.listActions({
          goalId: goalId ?? undefined,
          status: status ?? undefined,
          teamId: teamId ?? undefined,
        });
        const actions = data.actions ?? data;
        const trimmed = (Array.isArray(actions) ? actions : [])
          .slice(0, 30)
          .map((a: Record<string, unknown>) => ({
            id: a.id,
            title: a.title,
            done: a.done,
            dueDate: a.dueDate,
            priority: a.priority,
            owner: a.owner,
            goalId: a.goalId,
          }));
        return JSON.stringify({
          success: true,
          total: data.total ?? trimmed.length,
          actions: trimmed,
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return JSON.stringify({ success: false, error: message });
      }
    },
    {
      name: 'listActions',
      description: `Use to get a list of actions/todos from Simplamo.
        Call when user asks about their tasks, to-dos, issues, or what needs to be done.
        Can filter by goalId, status, or teamId.`,
      schema: z.object({
        goalId: z.string().optional().nullable().describe('Filter by goal ID'),
        status: z
          .string()
          .optional()
          .nullable()
          .describe('Filter by status: "done" or "undone"'),
        teamId: z.string().optional().nullable().describe('Filter by team ID'),
      }),
    },
  );

  const createAction = tool(
    async ({ title, goalId, dueDate, priority, owner }) => {
      try {
        const data = await client.createAction({
          title,
          goalId: goalId ?? undefined,
          dueDate: dueDate ?? undefined,
          priority: priority ?? undefined,
          owner: owner ?? undefined,
        });
        return JSON.stringify({
          success: true,
          action: {
            id: data.id,
            title: data.title,
            dueDate: data.dueDate,
            priority: data.priority,
          },
          message: `Đã tạo action "${title}"`,
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return JSON.stringify({ success: false, error: message });
      }
    },
    {
      name: 'createAction',
      description: `Use to create a new action/todo in Simplamo.
        Call when user wants to add a new task. Requires title at minimum.
        dueDate must be ISO 8601 format — use parseNaturalDate first if user gives natural language date.`,
      schema: z.object({
        title: z.string().describe('Action title'),
        goalId: z
          .string()
          .optional()
          .nullable()
          .describe('Goal ID to link this action to'),
        dueDate: z
          .string()
          .optional()
          .nullable()
          .describe('Due date in ISO 8601 format (YYYY-MM-DD)'),
        priority: z
          .enum(['low', 'medium', 'high'])
          .optional()
          .nullable()
          .describe('Priority level, defaults to medium'),
        owner: z.string().optional().nullable().describe('Owner user ID'),
      }),
    },
  );

  const updateActionStatus = tool(
    async ({ actionId, done }) => {
      try {
        await client.updateActionStatus(actionId, done);
        const statusText = done ? 'hoàn thành' : 'chưa hoàn thành';
        return JSON.stringify({
          success: true,
          message: `Đã đánh dấu action là ${statusText}`,
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return JSON.stringify({ success: false, error: message });
      }
    },
    {
      name: 'updateActionStatus',
      description: `Use to mark an action as done or undone.
        Call when user wants to complete or reopen a task.`,
      schema: z.object({
        actionId: z.string().describe('The Simplamo action ID'),
        done: z.boolean().describe('true to mark done, false to mark undone'),
      }),
    },
  );

  const parseNaturalDate = tool(
    async ({ text }) => {
      const today = new Date().toISOString().split('T')[0];
      return JSON.stringify({
        success: true,
        isoDate: text,
        hint: `Today is ${today}. Parse "${text}" to ISO date.`,
      });
    },
    {
      name: 'parseNaturalDate',
      description: `Convert natural language date expressions in Vietnamese to ISO 8601 date.
        Examples: "thứ 6" → nearest Friday, "cuối tháng" → last day of current month,
        "tuần sau" → next Monday, "30/12" → 2025-12-30.
        Always call this before createAction when dueDate is in natural language.`,
      schema: z.object({
        text: z
          .string()
          .describe('Natural language date expression in Vietnamese'),
      }),
    },
  );

  return [listActions, createAction, updateActionStatus, parseNaturalDate];
}
