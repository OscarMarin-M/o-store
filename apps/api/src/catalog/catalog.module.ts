import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CatalogController, PublicCatalogController } from './catalog.controller';
import { ExchangeRateService } from './exchange-rate.service';
import { ProductsService } from './products.service';
import { TenantDbService } from './tenant-db.service';

@Module({
  imports: [AuthModule],
  controllers: [CatalogController, PublicCatalogController],
  providers: [TenantDbService, ProductsService, ExchangeRateService],
})
export class CatalogModule {}
