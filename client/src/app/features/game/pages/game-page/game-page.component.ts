import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
} from '@angular/core';
import {
  takeUntilDestroyed,
} from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { SessionStoreService } from '../../../../core/session/session-store.service';

@Component({
  selector: 'app-game-page',
  standalone: true,
  templateUrl:
    './game-page.component.html',
  styleUrl:
    './game-page.component.scss',
  changeDetection:
    ChangeDetectionStrategy.OnPush,
})
export class GamePageComponent {
  private readonly router =
    inject(Router);

  private readonly destroyRef =
    inject(DestroyRef);

  readonly sessionStore =
    inject(SessionStoreService);

  roll(): void {
    if (!this.sessionStore.canRoll()) {
      return;
    }

    this.sessionStore
      .roll()
      .pipe(
        takeUntilDestroyed(
          this.destroyRef,
        ),
      )
      .subscribe({
        error: () => undefined,
      });
  }

  cashOut(): void {
    if (this.sessionStore.pending()) {
      return;
    }

    this.sessionStore
      .cashOut()
      .pipe(
        takeUntilDestroyed(
          this.destroyRef,
        ),
      )
      .subscribe({
        next: () => {
          void this.router.navigateByUrl(
            '/cashout',
          );
        },
        error: () => undefined,
      });
  }
}