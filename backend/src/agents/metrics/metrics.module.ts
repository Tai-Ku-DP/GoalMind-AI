import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MetricsAgentService } from './metrics.agent';
import { ToolCacheModule } from '../cache/tool-cache.module';

@Module({
  imports: [ConfigModule, ToolCacheModule],
  providers: [MetricsAgentService],
  exports: [MetricsAgentService],
})
export class MetricsModule {}
