import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { OS_FORM } from './field';

@Component({
  imports: [OS_FORM],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <os-field label="Nombre" [hint]="hint()" [error]="error()" prefix="Bs" span="half">
      <input osControl />
    </os-field>
  `,
})
class Host {
  readonly hint = signal<string | null>('Ej.: Sobre de Yu-Gi-Oh');
  readonly error = signal<string | null>(null);
}

async function render() {
  const fixture = TestBed.createComponent(Host);
  await fixture.whenStable();
  const el = fixture.nativeElement as HTMLElement;
  return {
    fixture,
    label: () => el.querySelector('label') as HTMLLabelElement,
    input: () => el.querySelector('input') as HTMLInputElement,
    message: () => el.querySelector('.os-field-message'),
    field: () => el.querySelector('os-field') as HTMLElement,
  };
}

describe('os-field', () => {
  it('enlaza la etiqueta y la ayuda con el control', async () => {
    const v = await render();
    expect(v.label().htmlFor).toBe(v.input().id);
    expect(v.input().getAttribute('aria-describedby')).toBe(v.message()?.id);
    expect(v.message()?.textContent).toContain('Ej.: Sobre de Yu-Gi-Oh');
    expect(v.input().classList).toContain('os-control');
    expect(v.field().classList).toContain('os-span-half');
    expect(v.field().textContent).toContain('Bs');
  });

  it('muestra el error en lugar de la ayuda y marca el control como inválido', async () => {
    const v = await render();
    v.fixture.componentInstance.error.set('Escribe el nombre');
    await v.fixture.whenStable();
    expect(v.message()?.querySelector('span')?.textContent?.trim()).toBe('Escribe el nombre');
    // El icono acompaña pero no se lee: el lector de pantalla oye solo el texto.
    expect(v.message()?.querySelector('mat-icon')?.getAttribute('aria-hidden')).toBe('true');
    expect(v.message()?.getAttribute('role')).toBe('alert');
    expect(v.input().getAttribute('aria-invalid')).toBe('true');
  });

  it('sin ayuda ni error no deja un mensaje vacío', async () => {
    const v = await render();
    v.fixture.componentInstance.hint.set(null);
    await v.fixture.whenStable();
    expect(v.message()).toBeNull();
    expect(v.input().hasAttribute('aria-describedby')).toBe(false);
  });
});
