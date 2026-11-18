import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CatalogController, CategoriesController, PublicCatalogController } from './catalog.controller';
import { CategoriesService } from './categories.service';
import { ExchangeRateService } from './exchange-rate.service';
import { ProductsService } from './products.service';
import { TenantDbService } from './tenant-db.service';

@Module({
  imports: [AuthModule],
  controllers: [CatalogController, CategoriesController, PublicCatalogController],
  providers: [TenantDbService, ProductsService, CategoriesService, ExchangeRateService],
})
export class CatalogModule {}
