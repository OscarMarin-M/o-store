import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import type { Page } from '@o-stores/contracts';
import { injectListState, listData } from './list-state';

@Component({ template: '' })
class Host {
  readonly list = injectListState({
    sorts: ['updatedAt', 'name'] as const,
    sort: 'updatedAt',
    dir: 'desc',
    filters: { estado: 'current', categoria: '' },
  });
}

async function setup(url: string) {
  TestBed.configureTestingModule({ providers: [provideRouter([{ path: '**', component: Host }])] });
  const router = TestBed.inject(Router);
  await router.navigateByUrl(url);
  const host = TestBed.createComponent(Host).componentInstance;
  return { router, list: host.list };
}

function page<T>(items: T[], pageNo = 1): Page<T> {
  return { items, total: items.length, page: pageNo, pageSize: 50 };
}

describe('ListState', () => {
  it('lee la vista de la URL y descarta valores no válidos', async () => {
    const { list } = await setup('/x?pagina=3&por_pagina=999&orden=name&dir=asc&estado=draft&buscar=%20polera%20');
    expect(list.page()).toBe(3);
    expect(list.pageSize()).toBe(50);
    expect(list.sort()).toBe('name');
    expect(list.dir()).toBe('asc');
    expect(list.filters()).toEqual({ estado: 'draft', categoria: '' });
    expect(list.q()).toBe('polera');
    expect(list.filtered()).toBe(true);
  });

  it('al filtrar vuelve a la página 1 y no escribe los valores por defecto', async () => {
    const { list, router } = await setup('/x?pagina=4&orden=name');
    list.setFilter('estado', 'active');
    await new Promise((r) => setTimeout(r));
    expect(router.url).toBe('/x?orden=name&estado=active');

    list.set({ sort: 'updatedAt', filters: { estado: 'current' } });
    await new Promise((r) => setTimeout(r));
    expect(router.url).toBe('/x');
  });

  it('invierte el sentido al pulsar dos veces la misma columna', async () => {
    const { list } = await setup('/x');
    list.toggleSort('name');
    await new Promise((r) => setTimeout(r));
    expect([list.sort(), list.dir()]).toEqual(['name', 'asc']);
    list.toggleSort('name');
    await new Promise((r) => setTimeout(r));
    expect(list.dir()).toBe('desc');
  });
});

describe('listData', () => {
  it('ignora una respuesta lenta que llega después de la nueva', async () => {
    TestBed.configureTestingModule({});
    const term = signal('a');
    const pending = new Map<string, (p: Page<string>) => void>();
    const result = TestBed.runInInjectionContext(() =>
      listData(
        () => term(),
        (q) => new Promise<Page<string>>((resolve) => pending.set(q, resolve)),
      ),
    );

    TestBed.tick();
    term.set('ab');
    TestBed.tick();

    pending.get('ab')?.(page(['nueva']));
    pending.get('a')?.(page(['vieja']));
    await new Promise((r) => setTimeout(r));

    expect(result.data()?.items).toEqual(['nueva']);
    expect(result.status()).toBe('ready');
  });
});
