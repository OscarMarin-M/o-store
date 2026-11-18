import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { Router, RouterLink } from '@angular/router';
import {
  CURRENCIES,
  productInputSchema,
  variantCode,
  type CategoryDto,
  type Currency,
  type ExchangeRateDto,
  type ProductDto,
  type ProductStatus,
  issuesToFields,
} from '@o-stores/contracts';
import { apiFields, apiMessage, formErrors } from '../../core/api-error';
import { ConfirmService } from '../../core/confirm.service';
import { CURRENCY_LABELS, convert, formatMoney } from '../../core/money';
import { StoresService } from '../../core/stores.service';
import { OS_UI } from '../../ui/ui';
import { CategoriesApi, categoryTree } from '../categories/categories-api';
import { ProductImages, type ImageItem, type RequestUpload } from './product-images';
import { ProductsApi, STATUS_LABELS } from './products-api';

interface OptionDraft {
  name: string;
  values: string[];
  /** Texto que se está escribiendo antes de convertirlo en valor. */
  pending: string;
}

interface VariantDraft {
  price: string;
  stock: string;
}

const MAX_VARIANTS = 100;
const keyOf = (values: string[]) => values.map((v) => v.toLowerCase()).join('\u0000');

/** Todas las combinaciones: [[S, M], [Negro]] → [[S, Negro], [M, Negro]]. */
function combinations(lists: string[][]): string[][] {
  return lists.reduce<string[][]>(
    (acc, values) => acc.flatMap((combo) => values.map((v) => [...combo, v])),
    [[]],
  );
}

/** Campos del formulario que muestran su propio error; el resto va al aviso general. */
const PRODUCT_FIELDS = ['name', 'code', 'price', 'stock', 'optionNames', 'variants'] as const;

@Component({
  selector: 'os-product-form-page',
  imports: [FormsModule, MatButtonModule, RouterLink, ProductImages, OS_UI],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './product-form-page.html',
  styleUrl: './product-form-page.scss',
})
export class ProductFormPage {
  private readonly api = inject(ProductsApi);
  private readonly categoriesApi = inject(CategoriesApi);
  private readonly router = inject(Router);
  private readonly confirm = inject(ConfirmService);
  private readonly stores = inject(StoresService);

  /** Viene de la URL; vacío en "Nuevo producto". */
  readonly productId = input<string>();

  protected readonly store = computed(() => this.stores.active());
  protected readonly currencies = CURRENCIES;
  protected readonly currencyLabels = CURRENCY_LABELS;
  protected readonly statusLabels = STATUS_LABELS;
  protected readonly money = formatMoney;

  protected readonly product = signal<ProductDto | null>(null);
  protected readonly loadState = signal<'loading' | 'ready' | 'error'>('ready');
  protected readonly prefix = signal('P');
  protected readonly rate = signal<ExchangeRateDto | null>(null);

  // Campos
  protected readonly name = signal('');
  protected readonly code = signal('');
  protected readonly description = signal('');
  protected readonly price = signal('');
  protected readonly currency = signal<Currency>('BOB');
  protected readonly stock = signal('0');
  protected readonly status = signal<ProductStatus>('draft');
  protected readonly categoryId = signal<string | null>(null);
  protected readonly categories = signal<CategoryDto[]>([]);
  protected readonly categoryTree = computed(() => categoryTree(this.categories()));
  protected readonly images = signal<ImageItem[]>([]);
  protected readonly hasVariants = signal(false);
  protected readonly options = signal<OptionDraft[]>([]);
  protected readonly variantData = signal<Record<string, VariantDraft>>({});

  protected readonly errors = signal<Record<string, string>>({});
  protected readonly saving = signal(false);
  protected readonly message = signal<{ kind: 'ok' | 'error'; text: string } | null>(null);

  protected readonly isNew = computed(() => !this.productId());
  protected readonly uploading = computed(() => this.images().some((i) => i.state === 'uploading'));

  protected readonly requestUpload: RequestUpload = (extension) => {
    const id = this.store()?.id;
    if (!id) return Promise.reject(new Error('Sin tienda'));
    return this.api.requestImageUpload(id, extension);
  };

  /** Código que se verá: el escrito, el guardado o uno de ejemplo con el prefijo. */
  protected readonly codePreview = computed(
    () => this.code().trim().toUpperCase() || this.product()?.code || `${this.prefix()}-0000`,
  );

  protected readonly variantRows = computed(() => {
    if (!this.hasVariants()) return [];
    const opts = this.options().filter((o) => o.name.trim() && o.values.length);
    if (!opts.length) return [];
    return combinations(opts.map((o) => o.values)).map((values) => ({
      key: keyOf(values),
      values,
      code: variantCode(this.codePreview(), values),
    }));
  });

  protected readonly tooManyVariants = computed(() => this.variantRows().length > MAX_VARIANTS);

  /** Precio en la otra moneda, al tipo oficial. */
  protected readonly equivalent = computed(() => {
    const rate = this.rate()?.rate;
    const amount = Number(this.price().replace(',', '.'));
    if (!rate || !this.price() || !Number.isFinite(amount)) return null;
    const other: Currency = this.currency() === 'BOB' ? 'USD' : 'BOB';
    return formatMoney(convert(amount, this.currency(), other, rate), other);
  });

  constructor() {
    const storeId = computed(() => this.store()?.id ?? null);
    effect(() => {
      const id = storeId();
      const productId = this.productId();
      if (id) untracked(() => void this.load(id, productId));
    });
  }

  // ---- Opciones de variantes ----

  protected toggleVariants(on: boolean): void {
    this.hasVariants.set(on);
    if (on && !this.options().length) this.addOption();
  }

  protected addOption(): void {
    if (this.options().length >= 3) return;
    const suggestions = ['Talla', 'Color', 'Material'];
    const used = new Set(this.options().map((o) => o.name.toLowerCase()));
    const name = suggestions.find((s) => !used.has(s.toLowerCase())) ?? '';
    this.options.update((list) => [...list, { name, values: [], pending: '' }]);
  }

  protected removeOption(index: number): void {
    this.options.update((list) => list.filter((_, i) => i !== index));
    if (!this.options().length) this.hasVariants.set(false);
  }

  protected setOptionName(index: number, name: string): void {
    this.patchOption(index, { name });
  }

  protected setPending(index: number, pending: string): void {
    // Una coma cierra el valor, como pulsar Enter.
    if (pending.includes(',')) {
      const parts = pending.split(',');
      parts.slice(0, -1).forEach((p) => this.addValue(index, p));
      this.patchOption(index, { pending: parts[parts.length - 1] ?? '' });
      return;
    }
    this.patchOption(index, { pending });
  }

  protected onValueKey(index: number, event: KeyboardEvent): void {
    const option = this.options()[index];
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      this.addValue(index, option.pending);
      this.patchOption(index, { pending: '' });
    } else if (event.key === 'Backspace' && !option.pending && option.values.length) {
      this.removeValue(index, option.values.length - 1);
    }
  }

  protected commitPending(index: number): void {
    const option = this.options()[index];
    if (option.pending.trim()) {
      this.addValue(index, option.pending);
      this.patchOption(index, { pending: '' });
    }
  }

  protected removeValue(index: number, valueIndex: number): void {
    const option = this.options()[index];
    this.patchOption(index, { values: option.values.filter((_, i) => i !== valueIndex) });
  }

  protected variant(key: string): VariantDraft {
    return this.variantData()[key] ?? { price: '', stock: '0' };
  }

  protected setVariant(key: string, field: keyof VariantDraft, value: string): void {
    this.variantData.update((data) => ({ ...data, [key]: { ...this.variant(key), [field]: value } }));
  }

  // ---- Guardar ----

  protected async save(): Promise<void> {
    const store = this.store();
    if (!store || this.saving()) return;
    for (let i = 0; i < this.options().length; i++) this.commitPending(i);

    const input = this.buildInput();
    const parsed = productInputSchema.safeParse(input);
    if (!parsed.success) {
      this.showErrors(issuesToFields(parsed.error.issues, 1));
      return;
    }
    if (this.tooManyVariants()) {
      this.message.set({ kind: 'error', text: `Hay más de ${MAX_VARIANTS} combinaciones. Quita valores o separa en varios productos.` });
      return;
    }

    this.errors.set({});
    this.saving.set(true);
    this.message.set(null);
    try {
      const saved = this.isNew()
        ? await this.api.create(store.id, parsed.data)
        : await this.api.update(store.id, this.productId() as string, parsed.data);
      this.fill(saved);
      this.message.set({ kind: 'ok', text: `Producto guardado con el código ${saved.code}.` });
      if (this.isNew()) {
        await this.router.navigate(['/tienda', store.id, 'productos', saved.id], { replaceUrl: true });
      }
    } catch (error) {
      const fields = apiFields(error, 1);
      if (Object.keys(fields).length) this.showErrors(fields);
      else this.message.set({ kind: 'error', text: apiMessage(error, 'No se pudo guardar el producto. Inténtalo de nuevo.') });
    } finally {
      this.saving.set(false);
    }
  }

  /** Marca cada error junto a su campo; los de campos sin hueco propio van al aviso general. */
  private showErrors(fields: Record<string, string>): void {
    const { form, ...shown } = formErrors(fields, PRODUCT_FIELDS);
    this.errors.set(shown);
    const marked = Object.keys(shown).length > 0;
    const text = form ? (marked ? `${form}. Revisa también los campos marcados.` : `${form}.`) : 'Revisa los campos marcados.';
    this.message.set({ kind: 'error', text });
  }

  protected async changeStatus(status: ProductStatus): Promise<void> {
    const store = this.store();
    const product = this.product();
    if (!store || !product) return;
    if (status === 'archived') {
      const ok = await this.confirm.ask({
        title: `¿Archivar ${product.name}?`,
        message: 'Dejará de verse en la tienda y en la lista habitual. Lo encuentras en «Archivados» y puedes restaurarlo cuando quieras.',
        confirmLabel: 'Archivar producto',
        destructive: true,
      });
      if (!ok) return;
    }
    try {
      const saved = await this.api.setStatus(store.id, product.id, status);
      this.product.set(saved);
      this.status.set(saved.status);
      this.message.set({
        kind: 'ok',
        text: status === 'archived' ? 'Producto archivado.' : status === 'active' ? 'Producto publicado.' : 'Producto pasado a borrador.',
      });
    } catch (error) {
      this.message.set({ kind: 'error', text: apiMessage(error, 'No se pudo cambiar el estado.') });
    }
  }

  // ---- Interno ----

  private async load(storeId: string, productId: string | undefined): Promise<void> {
    this.loadState.set(productId ? 'loading' : 'ready');
    this.api.settings(storeId).then((s) => this.prefix.set(s.productCodePrefix), () => undefined);
    this.api.exchangeRate().then((r) => this.rate.set(r), () => undefined);
    this.categoriesApi.list(storeId).then((c) => this.categories.set(c), () => this.categories.set([]));
    if (!productId) {
      this.reset();
      return;
    }
    try {
      this.fill(await this.api.get(storeId, productId));
      this.loadState.set('ready');
    } catch {
      this.loadState.set('error');
    }
  }

  private reset(): void {
    this.product.set(null);
    this.name.set('');
    this.code.set('');
    this.description.set('');
    this.price.set('');
    this.currency.set('BOB');
    this.stock.set('0');
    this.status.set('draft');
    this.categoryId.set(null);
    this.images.set([]);
    this.hasVariants.set(false);
    this.options.set([]);
    this.variantData.set({});
    this.errors.set({});
  }

  private fill(p: ProductDto): void {
    this.product.set(p);
    this.name.set(p.name);
    this.code.set(p.code);
    this.description.set(p.description ?? '');
    this.price.set(String(p.price));
    this.currency.set(p.priceCurrency);
    this.stock.set(String(p.stock));
    this.status.set(p.status);
    this.categoryId.set(p.categoryId);
    this.images.set(
      p.images.map((img) => ({ key: img.path, path: img.path, url: img.url, state: 'done', progress: 1 })),
    );
    this.hasVariants.set(p.optionNames.length > 0);
    this.options.set(
      p.optionNames.map((name, i) => ({
        name,
        values: [...new Set(p.variants.map((v) => v.optionValues[i]))],
        pending: '',
      })),
    );
    this.variantData.set(
      Object.fromEntries(
        p.variants.map((v) => [
          keyOf(v.optionValues),
          { price: v.price === null ? '' : String(v.price), stock: String(v.stock) },
        ]),
      ),
    );
  }

  private buildInput() {
    const number = (value: string) => (value.trim() === '' ? NaN : Number(value.replace(',', '.')));
    const variants = this.hasVariants();
    return {
      name: this.name(),
      code: this.code().trim() ? this.code().trim().toUpperCase() : undefined,
      description: this.description().trim() || null,
      price: number(this.price()),
      priceCurrency: this.currency(),
      stock: variants ? 0 : number(this.stock()),
      status: this.status(),
      categoryId: this.categoryId(),
      images: this.images()
        .filter((i) => i.state === 'done' && i.path)
        .map((i) => i.path as string),
      optionNames: variants ? this.options().map((o) => o.name.trim()) : [],
      variants: variants
        ? this.variantRows().map((row) => {
            const d = this.variant(row.key);
            return {
              optionValues: row.values,
              price: d.price.trim() === '' ? null : number(d.price),
              stock: number(d.stock),
            };
          })
        : [],
    };
  }

  private addValue(index: number, raw: string): void {
    const value = raw.trim();
    const option = this.options()[index];
    if (!value || option.values.some((v) => v.toLowerCase() === value.toLowerCase())) return;
    this.patchOption(index, { values: [...option.values, value] });
  }

  private patchOption(index: number, changes: Partial<OptionDraft>): void {
    this.options.update((list) => list.map((o, i) => (i === index ? { ...o, ...changes } : o)));
  }
}
