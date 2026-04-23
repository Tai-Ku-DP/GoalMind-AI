import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import dayjs from 'dayjs';
import { SimplamoClient } from '../../simplamo/simplamo.client';
import { ToolCacheService } from '../cache/tool-cache.service';
import type { ITodo } from '../../simplamo/types';

const TEAM_ID = '60fe00f28ae1ac0057c5422c';
const CURRENT_USER_CACHE_KEY = 'currentUser';

function isoDateOnly(iso: string): string {
  return iso.split('T')[0];
}

function todayISO(): string {
  return dayjs().format('YYYY-MM-DD');
}

function defaultDueDate(): string {
  return dayjs().add(7, 'day').toISOString();
}

function normalizePriority(p: string): 'HIGH' | 'MEDIUM' | 'LOW' {
  if (p === 'HIGH' || p === 'MEDIUM' || p === 'LOW') return p;
  return 'MEDIUM';
}

function normalizeStatus(s: string): string {
  // Simplamo dùng 'ON_TRACK' thay cho 'IN_PROGRESS' trong một số trường hợp
  if (s === 'DONE') return 'DONE';
  if (s === 'IN_PROGRESS' || s === 'ON_TRACK') return 'IN_PROGRESS';
  return 'NOT_STARTED';
}

function mapTodo(t: ITodo) {
  return {
    id: t._id,
    title: t.title,
    status: normalizeStatus(t.status),
    dueDate: t.dueDate ? isoDateOnly(t.dueDate) : null,
    priorityType: normalizePriority(t.priorityType),
    description: t.description ?? '',
    isOverdue: !!t.isOverduedate,
  };
}

async function resolveCurrentUserId(
  client: SimplamoClient,
  cache: ToolCacheService,
): Promise<string> {
  const cached = cache.get<{ _id: string }>(CURRENT_USER_CACHE_KEY);
  if (cached) return cached._id;
  const user = await client.getCurrentUser();
  cache.set(CURRENT_USER_CACHE_KEY, user, 30 * 60 * 1000); // 30-min TTL per session
  return user._id;
}

function isOwnedBy(todo: ITodo, userId: string): boolean {
  return todo.ownerId === userId;
}

export function createActionTools(
  client: SimplamoClient,
  cache: ToolCacheService,
) {
  // ── 1. List today's todos ──────────────────────────────────────────────────
  const listTodosToday = tool(
    async ({ onlyMine }) => {
      try {
        const currentUserId = onlyMine
          ? await resolveCurrentUserId(client, cache)
          : null;
        const todos = await client.listTodos({ teamId: TEAM_ID });
        const today = todayISO();
        const filtered = todos.filter(
          (t) =>
            (!onlyMine || (currentUserId && isOwnedBy(t, currentUserId))) &&
            t.dueDate &&
            isoDateOnly(t.dueDate) === today &&
            t.status !== 'DONE',
        );

        const ndjsonHeader = JSON.stringify({
          _ndjson: 'todo-list',
          type: 'today',
          count: filtered.length,
          date: today,
        });
        const lines = filtered.map((t) => JSON.stringify(mapTodo(t)));
        return `\`\`\`ndjson\n${[ndjsonHeader, ...lines].join('\n')}\n\`\`\``;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return JSON.stringify({ success: false, error: message });
      }
    },
    {
      name: 'listTodosToday',
      description: `Lấy danh sách todo hôm nay — tất cả todo có dueDate là ngày hôm nay.
        Gọi khi user hỏi "hôm nay có việc gì", "todo hôm nay", "công việc hôm nay".
        Nếu onlyMine=true thì chỉ trả về todo của user hiện tại, ngược lại trả về toàn bộ.`,
      schema: z.object({
        onlyMine: z
          .boolean()
          .optional()
          .nullable()
          .describe(
            'true: chỉ lấy todo của tôi; false/omit: lấy todo của toàn bộ team',
          ),
      }),
    },
  );

  // ── 2. List ALL todos ─────────────────────────────────────────────────────
  const listAllTodos = tool(
    async ({ onlyMine }) => {
      try {
        const currentUserId = onlyMine
          ? await resolveCurrentUserId(client, cache)
          : null;
        const todos = await client.listTodos({ teamId: TEAM_ID });
        const today = todayISO();
        const filtered = onlyMine
          ? todos.filter((t) => currentUserId && isOwnedBy(t, currentUserId))
          : todos;

        const ndjsonHeader = JSON.stringify({
          _ndjson: 'todo-list',
          type: 'all',
          count: filtered.length,
          date: today,
        });
        const lines = filtered.map((t) => JSON.stringify(mapTodo(t)));
        return `\`\`\`ndjson\n${[ndjsonHeader, ...lines].join('\n')}\n\`\`\``;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return JSON.stringify({ success: false, error: message });
      }
    },
    {
      name: 'listAllTodos',
      description: `Lấy toàn bộ danh sách todo trong team (không lọc theo ngày).
        Gọi khi user hỏi "tất cả todo", "liệt kê todo", "danh sách công việc", "show all todos".
        Nếu onlyMine=true thì chỉ trả về todo của user hiện tại.`,
      schema: z.object({
        onlyMine: z
          .boolean()
          .optional()
          .nullable()
          .describe(
            'true: chỉ lấy todo của tôi; false/omit: lấy todo của toàn bộ team',
          ),
      }),
    },
  );

  // ── 4. List overdue todos ──────────────────────────────────────────────────
  const listOverdueTodos = tool(
    async ({ onlyMine }) => {
      try {
        const currentUserId = onlyMine
          ? await resolveCurrentUserId(client, cache)
          : null;
        const todos = await client.listTodos({ teamId: TEAM_ID });
        const today = todayISO();
        const filtered = todos.filter(
          (t) =>
            (!onlyMine || (currentUserId && isOwnedBy(t, currentUserId))) &&
            t.dueDate &&
            isoDateOnly(t.dueDate) < today &&
            t.status !== 'DONE',
        );

        const ndjsonHeader = JSON.stringify({
          _ndjson: 'todo-list',
          type: 'overdue',
          count: filtered.length,
          date: today,
        });
        const lines = filtered.map((t) => JSON.stringify(mapTodo(t)));
        return `\`\`\`ndjson\n${[ndjsonHeader, ...lines].join('\n')}\n\`\`\``;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return JSON.stringify({ success: false, error: message });
      }
    },
    {
      name: 'listOverdueTodos',
      description: `Tìm các todo trễ hạn — dueDate < hôm nay và status != DONE.
        Gọi khi user hỏi "trễ hạn", "quá hạn", "overdue", "chưa làm mà đã qua hạn".
        Nếu onlyMine=true thì chỉ trả về todo của user hiện tại.`,
      schema: z.object({
        onlyMine: z
          .boolean()
          .optional()
          .nullable()
          .describe(
            'true: chỉ lấy todo của tôi; false/omit: lấy todo của toàn bộ team',
          ),
      }),
    },
  );

  // ── 3. Create todo(s) ──────────────────────────────────────────────────────
  const createTodo = tool(
    async ({ title, dueDate, priorityType, description, rockId }) => {
      try {
        const currentUserId = await resolveCurrentUserId(client, cache);
        const created = await client.createTodos([
          {
            teamId: TEAM_ID,
            ownerId: currentUserId,
            title,
            status: 'NOT_STARTED',
            description: description ?? '',
            dueDate: dueDate ? dayjs(dueDate).toISOString() : defaultDueDate(),
            priorityType: priorityType ?? 'MEDIUM',
            ...(rockId ? { rockId } : {}),
          },
        ]);

        const todo = created[0];
        return JSON.stringify({
          success: true,
          todo: todo ? mapTodo(todo) : null,
          message: `✅ Đã tạo todo: "${title}"`,
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return JSON.stringify({ success: false, error: message });
      }
    },
    {
      name: 'createTodo',
      description: `Tạo một todo mới trên Simplamo.
        Gọi khi user muốn tạo việc cần làm. Yêu cầu tối thiểu là title.
        dueDate phải ở dạng ISO 8601 — dùng parseNaturalDate trước nếu user dùng ngôn ngữ tự nhiên.
        Nếu không có dueDate, mặc định 7 ngày kể từ hôm nay.`,
      schema: z.object({
        title: z.string().describe('Tiêu đề todo'),
        dueDate: z
          .string()
          .optional()
          .nullable()
          .describe('Deadline dạng ISO 8601 (YYYY-MM-DDTHH:mm:ss.sssZ)'),
        priorityType: z
          .enum(['HIGH', 'MEDIUM', 'LOW'])
          .optional()
          .nullable()
          .describe('Độ ưu tiên: HIGH | MEDIUM | LOW, mặc định MEDIUM'),
        description: z
          .string()
          .optional()
          .nullable()
          .describe('Mô tả thêm cho todo'),
        rockId: z
          .string()
          .optional()
          .nullable()
          .describe('ID của Rock (Goal) liên kết với todo này'),
      }),
    },
  );

  // ── 4. Update todo ─────────────────────────────────────────────────────────
  const updateTodo = tool(
    async ({ todoId, title, status, dueDate, priorityType }) => {
      try {
        const currentUserId = await resolveCurrentUserId(client, cache);
        const updated = await client.updateTodo(todoId, {
          ...(title !== undefined && title !== null ? { title } : {}),
          ...(status !== undefined && status !== null ? { status } : {}),
          ...(dueDate ? { dueDate: dayjs(dueDate).toISOString() } : {}),
          ...(priorityType !== undefined && priorityType !== null
            ? { priorityType }
            : {}),
          ownerId: currentUserId,
          teamId: TEAM_ID,
        });

        return JSON.stringify({
          success: true,
          todo: mapTodo(updated),
          message: `✅ Đã cập nhật todo "${updated.title}"`,
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return JSON.stringify({ success: false, error: message });
      }
    },
    {
      name: 'updateTodo',
      description: `Cập nhật một todo: đổi status, tiêu đề, dueDate hoặc priority.
        Gọi khi user muốn đánh dấu DONE, đổi deadline, đổi tên, v.v.
        status hợp lệ: NOT_STARTED | IN_PROGRESS | DONE.`,
      schema: z.object({
        todoId: z.string().describe('ID của todo cần cập nhật'),
        title: z.string().optional().nullable().describe('Tiêu đề mới'),
        status: z
          .enum(['NOT_STARTED', 'IN_PROGRESS', 'DONE'])
          .optional()
          .nullable()
          .describe('Trạng thái mới'),
        dueDate: z
          .string()
          .optional()
          .nullable()
          .describe('Deadline mới dạng ISO 8601'),
        priorityType: z
          .enum(['HIGH', 'MEDIUM', 'LOW'])
          .optional()
          .nullable()
          .describe('Độ ưu tiên mới'),
      }),
    },
  );

  // ── 5. Parse natural date (kept for LLM convenience) ──────────────────────
  const parseNaturalDate = tool(
    ({ text }) => {
      const today = dayjs().format('YYYY-MM-DD');
      return Promise.resolve(
        JSON.stringify({
          success: true,
          hint: `Today is ${today}. Parse "${text}" into a full ISO 8601 datetime string (e.g. 2026-04-30T17:00:00.000Z).`,
        }),
      );
    },
    {
      name: 'parseNaturalDate',
      description: `Chuyển ngày tháng dạng tự nhiên (tiếng Việt) sang ISO 8601.
        VD: "thứ 6" → thứ Sáu gần nhất, "cuối tháng" → ngày cuối tháng hiện tại,
        "tuần sau" → thứ Hai tuần sau, "30/12" → 2026-12-30.
        Luôn gọi hàm này TRƯỚC createTodo khi dueDate ở dạng ngôn ngữ tự nhiên.`,
      schema: z.object({
        text: z
          .string()
          .describe('Biểu thức ngày tháng tự nhiên bằng tiếng Việt'),
      }),
    },
  );

  return [
    listAllTodos,
    listTodosToday,
    listOverdueTodos,
    createTodo,
    updateTodo,
    parseNaturalDate,
  ];
}
