import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { MembershipsModule } from '../memberships/memberships.module';
import { StoresModule } from '../stores/stores.module';
import { AppController } from './app.controller';

@Module({
  imports: [DatabaseModule, AuthModule, StoresModule, MembershipsModule],
  controllers: [AppController],
})
export class AppModule {}
