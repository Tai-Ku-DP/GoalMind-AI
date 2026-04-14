import { Module } from '@nestjs/common';
import { MetricsAgentService } from './metrics.agent';

@Module({
  providers: [MetricsAgentService],
  exports: [MetricsAgentService],
})
export class MetricsModule {}
