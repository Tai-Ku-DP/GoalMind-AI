import { Global, Module } from '@nestjs/common';
import { SimplamoClient } from './simplamo.client';

@Global()
@Module({
  providers: [SimplamoClient],
  exports: [SimplamoClient],
})
export class SimplamoModule {}
