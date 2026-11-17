import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CatalogModule } from '../catalog/catalog.module';
import { DatabaseModule } from '../database/database.module';
import { MembershipsModule } from '../memberships/memberships.module';
import { StoresModule } from '../stores/stores.module';
import { AppController } from './app.controller';

@Module({
  imports: [DatabaseModule, AuthModule, StoresModule, MembershipsModule, CatalogModule],
  controllers: [AppController],
})
export class AppModule {}
