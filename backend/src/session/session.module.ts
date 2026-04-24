import { Global, Module } from '@nestjs/common';
import { SessionContextService } from './session-context.service';

@Global()
@Module({
  providers: [SessionContextService],
  exports: [SessionContextService],
})
export class SessionModule {}
