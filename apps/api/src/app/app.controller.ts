import { Controller, Get } from '@nestjs/common';
import { Public } from '../auth/decorators';

@Controller()
export class AppController {
  /** Para comprobar que la API está arriba; no toca la base de datos. */
  @Public()
  @Get('health')
  health() {
    return { status: 'ok' };
  }
}
