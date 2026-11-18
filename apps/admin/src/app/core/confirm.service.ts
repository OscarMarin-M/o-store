import { ChangeDetectionStrategy, Component, Injectable, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { firstValueFrom } from 'rxjs';

export interface ConfirmOptions {
  title: string;
  message: string;
  /** Texto del botón que confirma; nombra la acción ("Quitar dominio"). */
  confirmLabel: string;
  destructive?: boolean;
}

@Component({
  selector: 'os-confirm-dialog',
  imports: [MatDialogModule, MatButtonModule, MatIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title class="title">
      @if (data.destructive) {
        <mat-icon class="warn" aria-hidden="true">warning</mat-icon>
      }
      {{ data.title }}
    </h2>
    <mat-dialog-content>{{ data.message }}</mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button [mat-dialog-close]="false">Cancelar</button>
      <button
        mat-flat-button
        [class.danger]="data.destructive"
        [class.os-primary]="!data.destructive"
        [mat-dialog-close]="true"
        cdkFocusInitial
      >
        {{ data.confirmLabel }}
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .title {
      display: flex;
      align-items: center;
      gap: var(--os-space-2);
    }
    .warn {
      color: var(--os-color-danger);
    }
    .danger {
      --mat-button-filled-container-color: var(--os-color-danger);
      --mat-button-filled-label-text-color: var(--os-color-bg);
    }
  `,
})
class ConfirmDialog {
  protected readonly data = inject<ConfirmOptions>(MAT_DIALOG_DATA);
}

/** Confirmación antes de acciones que no se deshacen o que se notan fuera del admin. */
@Injectable({ providedIn: 'root' })
export class ConfirmService {
  private readonly dialog = inject(MatDialog);

  async ask(options: ConfirmOptions): Promise<boolean> {
    const ref = this.dialog.open<ConfirmDialog, ConfirmOptions, boolean>(ConfirmDialog, {
      data: options,
      width: '420px',
      maxWidth: 'calc(100vw - 32px)',
    });
    return (await firstValueFrom(ref.afterClosed())) === true;
  }
}
