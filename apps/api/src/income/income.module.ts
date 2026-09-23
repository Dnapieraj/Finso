import { Module } from '@nestjs/common';

import { IncomeEntriesController, IncomeSourcesController } from './income.controllers.js';
import { IncomeEntriesService } from './income-entries.service.js';
import { IncomeSourcesService } from './income-sources.service.js';

@Module({
  controllers: [IncomeSourcesController, IncomeEntriesController],
  providers: [IncomeSourcesService, IncomeEntriesService],
})
export class IncomeModule {}
