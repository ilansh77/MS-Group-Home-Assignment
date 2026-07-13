import {
  ChangeDetectionStrategy,
  Component,
  inject,
} from '@angular/core';
import {
  RouterLink,
} from '@angular/router';
import { SessionStoreService } from '../../../../core/session/session-store.service';

@Component({
  selector: 'app-cashout-page',
  standalone: true,
  imports: [RouterLink],
  template: `./cashout-page.component.html`,
  changeDetection:
    ChangeDetectionStrategy.OnPush,
})
export class CashoutPageComponent {
  readonly sessionStore =
    inject(SessionStoreService);
}