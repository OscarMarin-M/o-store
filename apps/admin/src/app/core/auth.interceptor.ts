import { HttpErrorResponse, type HttpInterceptorFn, type HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, from, switchMap, throwError } from 'rxjs';
import { AuthService } from './auth.service';

const is401 = (error: unknown) => error instanceof HttpErrorResponse && error.status === 401;

/**
 * Añade el token de sesión a las llamadas a la API. Si la API responde 401, renueva
 * la sesión una vez y repite la petición; si no se puede, la sesión venció: la cierra
 * y lleva a /entrar (AuthService.expire), recordando la página para volver.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith('/api/')) return next(req);
  const auth = inject(AuthService);
  const withToken = (request: HttpRequest<unknown>, token: string | null) =>
    token ? request.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : request;

  // Las rutas públicas no dependen de la sesión: un 401 ahí no significa que venció.
  if (req.url.startsWith('/api/public/')) return next(withToken(req, auth.token()));

  return next(withToken(req, auth.token())).pipe(
    catchError((error: unknown) => {
      if (!is401(error)) return throwError(() => error);
      return from(auth.refresh()).pipe(
        switchMap((token) => {
          if (!token) {
            auth.expire();
            return throwError(() => error);
          }
          return next(withToken(req, token)).pipe(
            catchError((retryError: unknown) => {
              if (is401(retryError)) auth.expire();
              return throwError(() => retryError);
            }),
          );
        }),
      );
    }),
  );
};
