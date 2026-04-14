import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SimplamoModule } from './simplamo/simplamo.module';
import { GoalModule } from './agents/goal/goal.module';
import { MetricsModule } from './agents/metrics/metrics.module';
import { ActionModule } from './agents/action/action.module';
import { OrchestratorModule } from './agents/orchestrator/orchestrator.module';
import { ChatModule } from './chat/chat.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    SimplamoModule,
    GoalModule,
    MetricsModule,
    ActionModule,
    OrchestratorModule,
    ChatModule,
  ],
})
export class AppModule {}
