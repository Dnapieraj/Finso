import { Global, Module } from '@nestjs/common';

import { CLOCK, systemClock } from './clock.js';
import { OwnedReferencesService } from './owned-references.service.js';

@Global()
@Module({
  providers: [OwnedReferencesService, { provide: CLOCK, useValue: systemClock }],
  exports: [OwnedReferencesService, CLOCK],
})
export class CommonModule {}
