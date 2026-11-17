import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  createDomainSchema,
  createStoreSchema,
  logoUploadSchema,
  setStoreEnabledSchema,
  setStoreModulesSchema,
  updateDomainSchema,
  updateStoreSchema,
  type CreateDomainInput,
  type CreateStoreInput,
  type LogoUploadInput,
  type SetStoreEnabledInput,
  type SetStoreModulesInput,
  type UpdateDomainInput,
  type UpdateStoreInput,
} from '@o-stores/contracts';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser, IsSuperAdmin, Public, Roles } from '../auth/decorators';
import { ZodBody } from '../common/zod-body.pipe';
import { StoresService } from './stores.service';

@Controller('stores')
export class StoresController {
  constructor(private readonly stores: StoresService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.stores.listFor(user.id);
  }

  @Post()
  @Roles('super_admin')
  create(@Body(new ZodBody(createStoreSchema)) body: CreateStoreInput) {
    return this.stores.create(body);
  }

  @Get(':storeId')
  @Roles('store_owner', 'store_staff')
  get(@Param('storeId', ParseUUIDPipe) storeId: string) {
    return this.stores.get(storeId);
  }

  /** Nombre, logo y tema. */
  @Patch(':storeId')
  @Roles('store_owner')
  update(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Body(new ZodBody(updateStoreSchema)) body: UpdateStoreInput,
  ) {
    return this.stores.update(storeId, body);
  }

  @Put(':storeId/enabled')
  @Roles('super_admin')
  setEnabled(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Body(new ZodBody(setStoreEnabledSchema)) body: SetStoreEnabledInput,
  ) {
    return this.stores.setEnabled(storeId, body.enabled);
  }

  @Put(':storeId/modules')
  @Roles('super_admin')
  setModules(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Body(new ZodBody(setStoreModulesSchema)) body: SetStoreModulesInput,
  ) {
    return this.stores.setModules(storeId, body.modules);
  }

  @Post(':storeId/logo-upload')
  @Roles('store_owner')
  logoUpload(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Body(new ZodBody(logoUploadSchema)) body: LogoUploadInput,
  ) {
    return this.stores.createLogoUpload(storeId, body.extension);
  }

  @Get(':storeId/domains')
  @Roles('store_owner', 'store_staff')
  listDomains(@Param('storeId', ParseUUIDPipe) storeId: string) {
    return this.stores.listDomains(storeId);
  }

  @Post(':storeId/domains')
  @Roles('store_owner')
  addDomain(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Body(new ZodBody(createDomainSchema)) body: CreateDomainInput,
  ) {
    return this.stores.addDomain(storeId, body);
  }

  @Patch(':storeId/domains/:domainId')
  @Roles('store_owner')
  updateDomain(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Param('domainId', ParseUUIDPipe) domainId: string,
    @Body(new ZodBody(updateDomainSchema)) body: UpdateDomainInput,
    @IsSuperAdmin() isSuperAdmin: boolean,
  ) {
    return this.stores.updateDomain(storeId, domainId, body, isSuperAdmin);
  }

  /** Comprueba en el DNS el registro TXT de verificación. */
  @Post(':storeId/domains/:domainId/check')
  @Roles('store_owner')
  @HttpCode(200)
  checkDomain(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Param('domainId', ParseUUIDPipe) domainId: string,
  ) {
    return this.stores.checkDomain(storeId, domainId);
  }

  @Delete(':storeId/domains/:domainId')
  @Roles('store_owner')
  @HttpCode(204)
  removeDomain(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Param('domainId', ParseUUIDPipe) domainId: string,
  ) {
    return this.stores.removeDomain(storeId, domainId);
  }
}

/** Lo consumen las tiendas públicas, sin sesión. */
@Public()
@Controller('public/stores')
export class PublicStoresController {
  constructor(private readonly stores: StoresService) {}

  @Get('resolve')
  resolve(@Query('host') host?: string) {
    return this.stores.resolveByHost(typeof host === 'string' ? host : '');
  }
}
