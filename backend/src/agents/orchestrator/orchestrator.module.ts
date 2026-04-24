import { Module } from '@nestjs/common';
import { OrchestratorService } from './orchestrator.agent';
import { GoalModule } from '../goal/goal.module';
import { MetricsModule } from '../metrics/metrics.module';
import { ActionModule } from '../action/action.module';
import { SimplamoModule } from '../../simplamo/simplamo.module';
import { SessionModule } from '../../session/session.module';

@Module({
  imports: [
    GoalModule,
    MetricsModule,
    ActionModule,
    SimplamoModule,
    SessionModule,
  ],
  providers: [OrchestratorService],
  exports: [OrchestratorService],
})
export class OrchestratorModule {}
