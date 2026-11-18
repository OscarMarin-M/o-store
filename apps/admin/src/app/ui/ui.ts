import { MatIcon } from '@angular/material/icon';
import { OsColorInput } from './color-input';
import { OS_FORM } from './form/field';
import { OsPager } from './list/pager';
import { OsSortHeader } from './list/sort-header';
import { OsNotice } from './notice';

/**
 * Piezas genéricas del admin: formularios (os-form-section, os-field, osControl, osHint,
 * os-color-input), listas (os-pager, th[osSort]; estado con injectListState y listData),
 * avisos (os-notice) e iconos (<mat-icon>nombre</mat-icon>, Material Symbols).
 * Se importa en el componente: imports: [OS_UI].
 */
export const OS_UI = [OS_FORM, OsColorInput, OsNotice, OsPager, OsSortHeader, MatIcon] as const;

export { OS_FORM } from './form/field';
export { OsNotice } from './notice';
export { injectListState, listData, type ListState } from './list/list-state';
