import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import {
  PublicStoresController,
  StoresController,
} from './stores.controller';
import { StoresService } from './stores.service';

@Module({
  imports: [AuthModule],
  controllers: [StoresController, PublicStoresController],
  providers: [StoresService],
})
export class StoresModule {}
