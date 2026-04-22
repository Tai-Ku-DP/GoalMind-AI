import { Module } from '@nestjs/common';
import { ActionAgentService } from './action.agent';
import { ToolCacheModule } from '../cache/tool-cache.module';

@Module({
  imports: [ToolCacheModule],
  providers: [ActionAgentService],
  exports: [ActionAgentService],
})
export class ActionModule {}
