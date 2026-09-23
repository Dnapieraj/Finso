import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ZodSerializerInterceptor } from 'nestjs-zod';

import { AppController } from './app.controller.js';
import { AuthModule } from './auth/auth.module.js';
import { BudgetModule } from './budget/budget.module.js';
import { CategoriesModule } from './categories/categories.module.js';
import { CommonModule } from './common/common.module.js';
import { PrismaNotFoundFilter } from './common/prisma-not-found.filter.js';
import { ZodValidationPipe } from './common/zod-validation.pipe.js';
import { validateEnv } from './config/env.js';
import { GoalsModule } from './goals/goals.module.js';
import { IncomeModule } from './income/income.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { RecurringRulesModule } from './recurring-rules/recurring-rules.module.js';
import { TransactionsModule } from './transactions/transactions.module.js';
import { UsersModule } from './users/users.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    PrismaModule,
    CommonModule,
    AuthModule,
    UsersModule,
    CategoriesModule,
    TransactionsModule,
    GoalsModule,
    IncomeModule,
    RecurringRulesModule,
    BudgetModule,
  ],
  controllers: [AppController],
  providers: [
    // Rejestracja przez APP_* zamiast app.useGlobalPipes() w main.ts:
    // działa też w testach e2e, które budują aplikację z AppModule
    // i nigdy nie wywołują main.ts.
    { provide: APP_PIPE, useClass: ZodValidationPipe },
    { provide: APP_INTERCEPTOR, useClass: ZodSerializerInterceptor },
    { provide: APP_FILTER, useClass: PrismaNotFoundFilter },
  ],
})
export class AppModule {}
