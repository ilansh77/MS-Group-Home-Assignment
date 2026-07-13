import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
} from '@angular/core';
import { Router } from '@angular/router';
import {
  takeUntilDestroyed,
} from '@angular/core/rxjs-interop';
import { SessionStoreService } from '../../../../core/session/session-store.service';

@Component({
  selector: 'app-welcome-page',
  standalone: true,
  templateUrl:
'./welcome-page.component.html',
  styleUrl:
    './welcome-page.component.scss',
  changeDetection:
    ChangeDetectionStrategy.OnPush,
})
export class WelcomePageComponent {
  private readonly router =
    inject(Router);

  private readonly destroyRef =
    inject(DestroyRef);

  readonly sessionStore =
    inject(SessionStoreService);

  startGame(): void {
    if (this.sessionStore.pending()) {
      return;
    }

    this.sessionStore
      .startSession()
      .pipe(
        takeUntilDestroyed(
          this.destroyRef,
        ),
      )
      .subscribe({
        next: () => {
          void this.router.navigateByUrl(
            '/game',
          );
        },
        error: () => undefined,
      });
  }
}