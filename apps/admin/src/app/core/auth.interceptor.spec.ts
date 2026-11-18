import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { authInterceptor } from './auth.interceptor';
import { AuthService } from './auth.service';

describe('authInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let auth: { token: () => string | null; refresh: ReturnType<typeof vi.fn>; expire: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    auth = { token: () => 'viejo', refresh: vi.fn(), expire: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: auth },
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  /** Deja que la promesa de refresh se resuelva y la petición repetida llegue al backend. */
  const flushPromises = () => new Promise((resolve) => setTimeout(resolve));

  it('añade el token a las llamadas a la API', async () => {
    const result = firstValueFrom(http.get('/api/me'));
    const req = backend.expectOne('/api/me');
    expect(req.request.headers.get('Authorization')).toBe('Bearer viejo');
    req.flush({ ok: true });
    await expect(result).resolves.toEqual({ ok: true });
  });

  it('ante un 401 renueva la sesión y repite la petición con el token nuevo', async () => {
    auth.refresh.mockResolvedValue('nuevo');
    const result = firstValueFrom(http.get('/api/stores'));
    backend.expectOne('/api/stores').flush(null, { status: 401, statusText: 'Unauthorized' });
    await flushPromises();
    const retry = backend.expectOne('/api/stores');
    expect(retry.request.headers.get('Authorization')).toBe('Bearer nuevo');
    retry.flush([]);
    await expect(result).resolves.toEqual([]);
    expect(auth.expire).not.toHaveBeenCalled();
  });

  it('si no se puede renovar, da la sesión por vencida', async () => {
    auth.refresh.mockResolvedValue(null);
    const result = firstValueFrom(http.get('/api/stores'));
    backend.expectOne('/api/stores').flush(null, { status: 401, statusText: 'Unauthorized' });
    await expect(result).rejects.toMatchObject({ status: 401 });
    expect(auth.expire).toHaveBeenCalledOnce();
  });

  it('si la repetición también da 401, da la sesión por vencida', async () => {
    auth.refresh.mockResolvedValue('nuevo');
    const result = firstValueFrom(http.get('/api/stores'));
    backend.expectOne('/api/stores').flush(null, { status: 401, statusText: 'Unauthorized' });
    await flushPromises();
    backend.expectOne('/api/stores').flush(null, { status: 401, statusText: 'Unauthorized' });
    await expect(result).rejects.toMatchObject({ status: 401 });
    expect(auth.expire).toHaveBeenCalledOnce();
  });

  it('no toca otros errores ni las rutas públicas', async () => {
    const forbidden = firstValueFrom(http.get('/api/stores'));
    backend.expectOne('/api/stores').flush(null, { status: 403, statusText: 'Forbidden' });
    await expect(forbidden).rejects.toMatchObject({ status: 403 });

    const pub = firstValueFrom(http.get('/api/public/config'));
    backend.expectOne('/api/public/config').flush(null, { status: 401, statusText: 'Unauthorized' });
    await expect(pub).rejects.toMatchObject({ status: 401 });
    expect(auth.refresh).not.toHaveBeenCalled();
  });
});
