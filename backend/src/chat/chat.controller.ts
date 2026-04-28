import {
  BadRequestException,
  Controller,
  Post,
  Body,
  Res,
  Patch,
  Param,
  HttpCode,
  Headers,
  UnauthorizedException,
} from '@nestjs/common';
import type { Response } from 'express';
import { ChatService } from './chat.service';
import { SimplamoClient } from '../simplamo/simplamo.client';
import { SessionContextService } from '../session/session-context.service';
import { ConfigService } from '@nestjs/config';
import type { ICreateTodoPayload, IUpdateTodoPayload } from '../simplamo/types';
import { IsString, MinLength } from 'class-validator';

class ValidateOpenAIKeyBody {
  @IsString()
  @MinLength(20)
  apiKey!: string;
}

const DEFAULT_OWNER_ID = '60fe95b903bf3600570a70ea';
const DEFAULT_COMPANY_ID = '60fd7f693e81570057440b4e';
const DEFAULT_TEAM_ID = '60fe00f28ae1ac0057c5422c';

@Controller('api')
export class ChatController {
  private readonly ownerId: string;
  private readonly companyId: string;
  private readonly fallbackTeamId: string;

  constructor(
    private readonly chatService: ChatService,
    private readonly simplamo: SimplamoClient,
    private readonly sessionCtx: SessionContextService,
    private readonly config: ConfigService,
  ) {
    this.ownerId = this.config.get<string>(
      'SIMPLAMO_OWNER_ID',
      DEFAULT_OWNER_ID,
    );
    this.companyId = this.config.get<string>(
      'SIMPLAMO_COMPANY_ID',
      DEFAULT_COMPANY_ID,
    );
    this.fallbackTeamId = this.config.get<string>(
      'SIMPLAMO_TEAM_ID',
      DEFAULT_TEAM_ID,
    );
  }

  private get teamId(): string {
    return this.sessionCtx.teamId ?? this.fallbackTeamId;
  }

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
      teamId: this.teamId,
      ownerId: body.ownerId || this.ownerId,
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
      ownerId: this.ownerId,
      teamId: this.teamId,
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
      ownerId: body.ownerId || this.ownerId,
      teamId: this.teamId,
      companyId: this.companyId,
      description: body.description,
      interval: body.interval ?? 'SHORT_TERM',
      status: body.status ?? 'PLAN',
    });
    return { success: true, issue: created };
  }

  @Post('chat')
  async chat(
    @Body() body: { message: string },
    @Headers('x-openai-api-key') apiKey: string | undefined,
    @Res() res: Response,
  ) {
    if (!apiKey?.trim()) {
      throw new UnauthorizedException(
        'Thiếu API key. Vui lòng xác thực OPENAI_API_KEY trước.',
      );
    }
    const trimmedApiKey = apiKey.trim();
    const keyValid = await this.validateOpenAIKey(trimmedApiKey);
    if (!keyValid) {
      throw new UnauthorizedException(
        'OPENAI_API_KEY không hợp lệ hoặc đã hết hạn.',
      );
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    try {
      for await (const chunk of this.chatService.stream(
        body.message,
        trimmedApiKey,
      )) {
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

  @Post('auth/validate-openai-key')
  @HttpCode(200)
  async validateKey(@Body() body: ValidateOpenAIKeyBody) {
    const apiKey = body.apiKey?.trim();
    if (!apiKey) {
      throw new BadRequestException('OPENAI_API_KEY không được để trống.');
    }

    const isValid = await this.validateOpenAIKey(apiKey);
    if (!isValid) {
      throw new UnauthorizedException('OPENAI_API_KEY không hợp lệ.');
    }

    return { success: true };
  }

  /**
   * Reset backend session — called when user clears chat history.
   * Clears team selection and pending intent so the next message starts fresh.
   */
  @Post('session/reset')
  @HttpCode(200)
  resetSession() {
    this.sessionCtx.resetTeam();
    return { success: true };
  }

  private async validateOpenAIKey(apiKey: string): Promise<boolean> {
    if (process.env.OPENAI_API_KEY === apiKey) {
      return true; // Allow the default key for validation to avoid locking users out
    }

    const baseUrl = process.env.OPENAI_BASE_URL || 'https://api.openai.com';
    try {
      const response = await fetch(`${baseUrl.replace(/\/$/, '')}/v1/models`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}
