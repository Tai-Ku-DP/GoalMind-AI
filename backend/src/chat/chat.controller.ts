import { Controller, Post, Body, Res, Patch, Param } from '@nestjs/common';
import type { Response } from 'express';
import { ChatService } from './chat.service';
import { SimplamoClient } from '../simplamo/simplamo.client';
import type { ICreateTodoPayload, IUpdateTodoPayload } from '../simplamo/types';

const TEAM_ID = '60fe00f28ae1ac0057c5422c';
const OWNER_ID = '60fe95b903bf3600570a70ea';

@Controller('api')
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly simplamo: SimplamoClient,
  ) {}

  /** Quick-create a todo — called directly from the FE "Tạo nhanh" button */
  @Post('todos')
  async createTodo(
    @Body()
    body: {
      title: string;
      dueDate?: string;
      priorityType?: 'HIGH' | 'MEDIUM' | 'LOW' | '';
      description?: string;
      ownerId?: string;
      rockId?: string;
    },
  ) {
    const payload: ICreateTodoPayload = {
      teamId: TEAM_ID,
      ownerId: body.ownerId || OWNER_ID,
      title: body.title,
      status: 'NOT_STARTED',
      description: body.description ?? '',
      dueDate: body.dueDate ?? new Date().toISOString(),
      priorityType: body.priorityType || 'MEDIUM',
      rockId: body.rockId ?? undefined,
    };
    const created = await this.simplamo.createTodos([payload]);
    return { success: true, todo: created[0] ?? null };
  }

  /** Update a todo — called from the FE (e.g. quick-complete button) */
  @Patch('todos/:todoId')
  async updateTodo(
    @Param('todoId') todoId: string,
    @Body() body: IUpdateTodoPayload,
  ) {
    const updated = await this.simplamo.updateTodo(todoId, {
      ownerId: OWNER_ID,
      teamId: TEAM_ID,
      ...body,
    });
    return { success: true, todo: updated };
  }

  /** Quick-create an issue — called from the FE "Tạo Issue" button in DiscussionPointsSection */
  @Post('issues')
  async createIssue(
    @Body()
    body: {
      title: string;
      ownerId?: string;
      description?: string;
      interval?: 'SHORT_TERM' | 'LONG_TERM';
      status?: 'PLAN' | 'ON_TRACK' | 'NOT_STARTED' | 'DONE';
    },
  ) {
    const created = await this.simplamo.createIssue({
      title: body.title,
      ownerId: body.ownerId || OWNER_ID,
      teamId: TEAM_ID,
      companyId: '60fd7f693e81570057440b4e',
      description: body.description,
      interval: body.interval ?? 'SHORT_TERM',
      status: body.status ?? 'PLAN',
    });
    return { success: true, issue: created };
  }

  @Post('chat')
  async chat(@Body() body: { message: string }, @Res() res: Response) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    try {
      for await (const chunk of this.chatService.stream(body.message)) {
        if (chunk.startsWith('\x00TOOL_START:') && chunk.endsWith('\x00')) {
          const tool = chunk.slice(12, -1);
          res.write(
            `data: ${JSON.stringify({ type: 'tool_start', tool })}\n\n`,
          );
        } else if (
          chunk.startsWith('\x00TOOL_END:') &&
          chunk.endsWith('\x00')
        ) {
          const tool = chunk.slice(10, -1);
          res.write(`data: ${JSON.stringify({ type: 'tool_end', tool })}\n\n`);
        } else {
          res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
        }
      }
    } finally {
      res.write('data: [DONE]\n\n');
      res.end();
    }
  }
}
