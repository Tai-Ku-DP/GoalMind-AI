import { Module } from '@nestjs/common';
import { ActionAgentService } from './action.agent';

@Module({
  providers: [ActionAgentService],
  exports: [ActionAgentService],
})
export class ActionModule {}
