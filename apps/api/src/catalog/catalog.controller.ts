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
  categoryInputSchema,
  reorderCategoriesSchema,
  type CategoryInput,
  type ReorderCategoriesInput,
  productImageUploadSchema,
  productInputSchema,
  productListQuerySchema,
  setProductStatusSchema,
  updateStoreSettingsSchema,
  type ProductImageUploadInput,
  type ProductInput,
  type ProductListQuery,
  type SetProductStatusInput,
  type UpdateStoreSettingsInput,
} from '@o-stores/contracts';
import { Public, Roles } from '../auth/decorators';
import { ZodBody } from '../common/zod-body.pipe';
import { CategoriesService } from './categories.service';
import { ExchangeRateService } from './exchange-rate.service';
import { ProductsService } from './products.service';

@Controller('stores/:storeId')
export class CatalogController {
  constructor(private readonly products: ProductsService) {}

  @Get('settings')
  @Roles('store_owner', 'store_staff')
  getSettings(@Param('storeId', ParseUUIDPipe) storeId: string) {
    return this.products.getSettings(storeId);
  }

  @Patch('settings')
  @Roles('store_owner')
  updateSettings(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Body(new ZodBody(updateStoreSettingsSchema)) body: UpdateStoreSettingsInput,
  ) {
    return this.products.updateSettings(storeId, body);
  }

  @Get('products')
  @Roles('store_owner', 'store_staff')
  list(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Query(new ZodBody(productListQuerySchema)) query: ProductListQuery,
  ) {
    return this.products.list(storeId, query);
  }

  @Post('products')
  @Roles('store_owner', 'store_staff')
  create(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Body(new ZodBody(productInputSchema)) body: ProductInput,
  ) {
    return this.products.create(storeId, body);
  }

  @Post('products/image-upload')
  @Roles('store_owner', 'store_staff')
  imageUpload(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Body(new ZodBody(productImageUploadSchema)) body: ProductImageUploadInput,
  ) {
    return this.products.createImageUpload(storeId, body.extension);
  }

  @Get('products/:productId')
  @Roles('store_owner', 'store_staff')
  get(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Param('productId', ParseUUIDPipe) productId: string,
  ) {
    return this.products.get(storeId, productId);
  }

  /** Reemplaza el producto completo, variantes incluidas. */
  @Put('products/:productId')
  @Roles('store_owner', 'store_staff')
  update(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Param('productId', ParseUUIDPipe) productId: string,
    @Body(new ZodBody(productInputSchema)) body: ProductInput,
  ) {
    return this.products.update(storeId, productId, body);
  }

  /** Publicar, pasar a borrador o archivar. */
  @Put('products/:productId/status')
  @Roles('store_owner', 'store_staff')
  setStatus(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Param('productId', ParseUUIDPipe) productId: string,
    @Body(new ZodBody(setProductStatusSchema)) body: SetProductStatusInput,
  ) {
    return this.products.setStatus(storeId, productId, body.status);
  }
}

@Controller('stores/:storeId/categories')
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Get()
  @Roles('store_owner', 'store_staff')
  list(@Param('storeId', ParseUUIDPipe) storeId: string) {
    return this.categories.list(storeId);
  }

  @Post()
  @Roles('store_owner', 'store_staff')
  create(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Body(new ZodBody(categoryInputSchema)) body: CategoryInput,
  ) {
    return this.categories.create(storeId, body);
  }

  /** Antes que ':categoryId' para que 'order' no se tome como id. */
  @Put('order')
  @Roles('store_owner', 'store_staff')
  reorder(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Body(new ZodBody(reorderCategoriesSchema)) body: ReorderCategoriesInput,
  ) {
    return this.categories.reorder(storeId, body.ids);
  }

  @Put(':categoryId')
  @Roles('store_owner', 'store_staff')
  update(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
    @Body(new ZodBody(categoryInputSchema)) body: CategoryInput,
  ) {
    return this.categories.update(storeId, categoryId, body);
  }

  @Delete(':categoryId')
  @HttpCode(204)
  @Roles('store_owner', 'store_staff')
  remove(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
  ) {
    return this.categories.remove(storeId, categoryId);
  }
}

@Public()
@Controller('public')
export class PublicCatalogController {
  constructor(private readonly rates: ExchangeRateService) {}

  /** Tipo de cambio oficial USD → BOB, con caché. */
  @Get('exchange-rate')
  exchangeRate() {
    return this.rates.usdBob();
  }
}
