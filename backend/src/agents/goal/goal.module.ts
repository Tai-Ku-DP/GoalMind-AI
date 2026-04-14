import { Module } from '@nestjs/common';
import { GoalAgentService } from './goal.agent';

@Module({
  providers: [GoalAgentService],
  exports: [GoalAgentService],
})
export class GoalModule {}
