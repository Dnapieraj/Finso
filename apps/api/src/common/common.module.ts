import { Global, Module } from '@nestjs/common';

import { OwnedReferencesService } from './owned-references.service.js';

@Global()
@Module({
  providers: [OwnedReferencesService],
  exports: [OwnedReferencesService],
})
export class CommonModule {}
