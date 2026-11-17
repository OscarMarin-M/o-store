import { Controller, Get } from '@nestjs/common';
import type { ClientConfigDto } from '@o-stores/contracts';
import { Public } from '../auth/decorators';
import { AppConfig } from '../config/app-config';

@Controller()
export class AppController {
  constructor(private readonly config: AppConfig) {}

  /** Para comprobar que la API está arriba; no toca la base de datos. */
  @Public()
  @Get('health')
  health() {
    return { status: 'ok' };
  }

  /** Datos públicos que los front necesitan para iniciar Supabase (sesión y subidas). */
  @Public()
  @Get('public/config')
  clientConfig(): ClientConfigDto {
    return {
      supabaseUrl: this.config.supabaseUrl,
      supabasePublishableKey: this.config.supabasePublishableKey,
    };
  }
}
