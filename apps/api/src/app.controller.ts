import { Controller, Get } from '@nestjs/common';

import { Public } from './auth/decorators.js';

@Controller()
export class AppController {
  /** Health check dla load balancera / Dockera — bez bazy, bez auth. */
  @Public()
  @Get('health')
  health(): { status: 'ok' } {
    return { status: 'ok' };
  }
}
