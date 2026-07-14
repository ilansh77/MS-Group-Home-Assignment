import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';

@Component({
  selector: 'app-win-modal',
  standalone: true,
  templateUrl:
    './win-modal.component.html',
  styleUrl:
    './win-modal.component.scss',
  changeDetection:
    ChangeDetectionStrategy.OnPush,
  host: {
    '(document:keydown.escape)':
      'close()',
  },
})
export class WinModalComponent {
  readonly reward =
    input.required<number>();

  readonly closed =
    output<void>();

  close(): void {
    this.closed.emit();
  }

  keepOpen(
    event: MouseEvent,
  ): void {
    event.stopPropagation();
  }
}