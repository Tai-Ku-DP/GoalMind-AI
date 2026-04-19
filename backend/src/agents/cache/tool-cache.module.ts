import { Module } from '@nestjs/common';
import { ToolCacheService } from './tool-cache.service';

@Module({
  providers: [ToolCacheService],
  exports: [ToolCacheService],
})
export class ToolCacheModule {}
