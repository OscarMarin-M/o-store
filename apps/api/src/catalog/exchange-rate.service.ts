import { Injectable, Logger } from '@nestjs/common';
import type { ExchangeRateDto } from '@o-stores/contracts';

/** Una fuente del tipo de cambio USD → BOB. */
export interface ExchangeRateProvider {
  readonly source: string;
  /** Devuelve cuántos BOB vale 1 USD, o null si no pudo obtenerlo. */
  fetchUsdBob(): Promise<number | null>;
}

/**
 * Tipo fijado en la variable de entorno USD_BOB_RATE. Es el respaldo siempre
 * disponible; el proveedor del Banco Central de Bolivia se añadirá delante.
 */
export class ManualRateProvider implements ExchangeRateProvider {
  readonly source = 'manual';

  constructor(private readonly rate: number) {}

  async fetchUsdBob(): Promise<number | null> {
    return this.rate;
  }
}

const CACHE_MS = 6 * 60 * 60 * 1000;

/**
 * Tipo de cambio oficial con caché: se consulta a lo sumo cada 6 horas.
 * Prueba los proveedores en orden y usa el primero que responda.
 */
@Injectable()
export class ExchangeRateService {
  private readonly logger = new Logger(ExchangeRateService.name);
  private readonly providers: ExchangeRateProvider[];
  private cached: ExchangeRateDto | null = null;

  constructor() {
    const manual = Number(process.env['USD_BOB_RATE'] ?? '6.96');
    this.providers = [new ManualRateProvider(Number.isFinite(manual) && manual > 0 ? manual : 6.96)];
  }

  async usdBob(): Promise<ExchangeRateDto> {
    if (this.cached && Date.now() - Date.parse(this.cached.fetchedAt) < CACHE_MS) {
      return this.cached;
    }
    for (const provider of this.providers) {
      try {
        const rate = await provider.fetchUsdBob();
        if (rate && rate > 0) {
          this.cached = {
            base: 'USD',
            quote: 'BOB',
            rate,
            source: provider.source,
            fetchedAt: new Date().toISOString(),
          };
          return this.cached;
        }
      } catch (error) {
        this.logger.warn(`El proveedor ${provider.source} falló: ${String(error)}`);
      }
    }
    // El manual nunca falla, pero si se quitara, mejor un error claro que un precio inventado.
    throw new Error('No hay tipo de cambio disponible');
  }
}
