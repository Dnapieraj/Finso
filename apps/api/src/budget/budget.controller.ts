import { Body, Controller, Get, HttpStatus, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { BudgetSummary, SimulationResult } from '@vireo/shared';
import {
  budgetSummarySchema,
  simulatePurchaseRequestSchema,
  simulationResultSchema,
} from '@vireo/shared';
import { createZodDto, ZodResponse } from 'nestjs-zod';

import type { AuthUser } from '../auth/decorators.js';
import { CurrentUser } from '../auth/decorators.js';
import { BudgetService } from './budget.service.js';

export class BudgetSummaryDto extends createZodDto(budgetSummarySchema) {}
export class SimulatePurchaseDto extends createZodDto(simulatePurchaseRequestSchema) {}
export class SimulationResultDto extends createZodDto(simulationResultSchema) {}

@ApiTags('budget')
@ApiBearerAuth()
@Controller('budget')
export class BudgetController {
  constructor(private readonly budget: BudgetService) {}

  /** Ile zostało do końca bieżącego okresu i ile dziennie. */
  @Get('current')
  @ZodResponse({ type: BudgetSummaryDto })
  current(@CurrentUser() user: AuthUser): Promise<BudgetSummary> {
    return this.budget.current(user.id);
  }

  /**
   * "Czy stać mnie na to teraz" — nic nie zapisuje, stąd 200, a nie 201.
   * POST, bo to obliczenie z danymi wejściowymi, nie odczyt zasobu.
   */
  @Post('simulate')
  @ZodResponse({ status: HttpStatus.OK, type: SimulationResultDto })
  simulate(
    @CurrentUser() user: AuthUser,
    @Body() body: SimulatePurchaseDto,
  ): Promise<SimulationResult> {
    return this.budget.simulate(user.id, body);
  }
}
