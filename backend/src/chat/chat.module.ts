import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { OrchestratorModule } from '../agents/orchestrator/orchestrator.module';

@Module({
  imports: [OrchestratorModule],
  controllers: [ChatController],
  providers: [ChatService],
})
export class ChatModule {}
