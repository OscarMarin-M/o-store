import { createHmac } from 'node:crypto';

/** Nombre del registro TXT que prueba que el dueño controla el dominio. */
export function verificationRecordName(domain: string): string {
  return `_ostores.${domain}`;
}

/**
 * Código que el dueño pone en el TXT. Se deriva del id del dominio con una firma,
 * así no hace falta guardarlo en la base y nadie puede adivinarlo.
 */
export function verificationToken(secret: string, domainId: string): string {
  const digest = createHmac('sha256', secret)
    .update(`domain:${domainId}`)
    .digest('hex');
  return `ostores-verify=${digest.slice(0, 32)}`;
}

/** Quita espacios, mayúsculas y puerto: "Tienda.CL:443" → "tienda.cl". */
export function normalizeHost(host: string): string {
  return host.trim().toLowerCase().replace(/:\d+$/, '').replace(/\.$/, '');
}

/** true si el dominio es la plataforma o cualquier subdominio suyo. */
export function isPlatformDomain(domain: string, platformDomain: string): boolean {
  return domain === platformDomain || domain.endsWith(`.${platformDomain}`);
}

/** "tcg.ostores.cl" → "tcg" si la plataforma es "ostores.cl"; si no, null. */
export function platformSlugFromHost(
  host: string,
  platformDomain: string,
): string | null {
  const suffix = `.${platformDomain}`;
  if (!host.endsWith(suffix)) return null;
  const slug = host.slice(0, -suffix.length);
  return /^[a-z][a-z0-9-]{1,38}[a-z0-9]$/.test(slug) ? slug : null;
}

/** El TXT puede venir partido en trozos; se unen antes de comparar. */
export function txtRecordsContain(records: string[][], expected: string): boolean {
  return records.some((chunks) => chunks.join('').trim() === expected);
}
