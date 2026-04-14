import { Injectable } from '@nestjs/common';
import { OrchestratorService } from '../agents/orchestrator/orchestrator.agent';

@Injectable()
export class ChatService {
  constructor(private readonly orchestrator: OrchestratorService) {}

  async *stream(message: string): AsyncGenerator<string> {
    yield* this.orchestrator.stream(message);
  }
}
