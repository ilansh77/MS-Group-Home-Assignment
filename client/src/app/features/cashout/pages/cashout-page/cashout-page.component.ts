import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
} from '@angular/core';
import {
  takeUntilDestroyed,
} from '@angular/core/rxjs-interop';
import {
  Router,
} from '@angular/router';
import {
  SessionStoreService,
} from '../../../../core/session/session-store.service';

@Component({
  selector:
    'app-cashout-page',
  standalone: true,
  templateUrl:
    './cashout-page.component.html',
  styleUrl:
    './cashout-page.component.scss',
  changeDetection:
    ChangeDetectionStrategy.OnPush,
})
export class CashoutPageComponent {
  private readonly router =
    inject(Router);

  private readonly destroyRef =
    inject(DestroyRef);

  readonly sessionStore =
    inject(SessionStoreService);

  startNewGame(): void {
    if (
      this.sessionStore.pending()
    ) {
      return;
    }

    this.sessionStore
      .clearSession()
      .pipe(
        takeUntilDestroyed(
          this.destroyRef,
        ),
      )
      .subscribe({
        next: () => {
          void this.router.navigateByUrl(
            '/',
          );
        },
      });
  }
}