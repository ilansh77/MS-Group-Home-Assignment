import {
  ChangeDetectionStrategy,
  Component,
} from '@angular/core';
import {
  RouterLink,
} from '@angular/router';

@Component({
  selector: 'app-not-found-page',
  standalone: true,
  imports: [RouterLink],
  template: `./not-found-page.component.html`,
  changeDetection:
    ChangeDetectionStrategy.OnPush,
})
export class NotFoundPageComponent {}