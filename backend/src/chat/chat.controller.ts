import { Controller, Post, Body, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ChatService } from './chat.service';

@Controller('api')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('chat')
  async chat(
    @Body() body: { message: string },
    @Res() res: Response,
  ) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    try {
      for await (const chunk of this.chatService.stream(body.message)) {
        if (chunk.startsWith('\x00TOOL_START:') && chunk.endsWith('\x00')) {
          const tool = chunk.slice(12, -1);
          res.write(`data: ${JSON.stringify({ type: 'tool_start', tool })}\n\n`);
        } else if (chunk.startsWith('\x00TOOL_END:') && chunk.endsWith('\x00')) {
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
