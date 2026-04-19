import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GoalAgentService } from './goal.agent';
import { ToolCacheModule } from '../cache/tool-cache.module';

@Module({
  imports: [ConfigModule, ToolCacheModule],
  providers: [GoalAgentService],
  exports: [GoalAgentService],
})
export class GoalModule {}
