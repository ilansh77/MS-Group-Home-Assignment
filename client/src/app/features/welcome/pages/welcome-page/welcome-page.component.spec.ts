import {
  signal,
} from '@angular/core';
import {
  ComponentFixture,
  TestBed,
} from '@angular/core/testing';
import {
  Router,
} from '@angular/router';
import {
  of,
} from 'rxjs';
import {
  GameSessionStatus,
} from '../../../../core/session/session.models';
import {
  SessionStoreService,
} from '../../../../core/session/session-store.service';
import {
  WelcomePageComponent,
} from './welcome-page.component';

describe('WelcomePageComponent', () => {
  let fixture:
    ComponentFixture<
      WelcomePageComponent
    >;

  let component:
    WelcomePageComponent;

  let router:
    jasmine.SpyObj<Router>;

  const pendingState =
    signal(false);

  const errorState =
    signal<string | null>(
      null,
    );

  let sessionStore: {
    pending:
      ReturnType<
        typeof pendingState.asReadonly
      >;
    error:
      ReturnType<
        typeof errorState.asReadonly
      >;
    startSession:
      jasmine.Spy;
  };

  beforeEach(async () => {
    pendingState.set(false);
    errorState.set(null);

    router =
      jasmine.createSpyObj<
        Router
      >(
        'Router',
        [
          'navigateByUrl',
        ],
      );

    router.navigateByUrl
      .and.resolveTo(true);

    sessionStore = {
      pending:
        pendingState.asReadonly(),
      error:
        errorState.asReadonly(),
      startSession:
        jasmine.createSpy(
          'startSession',
        ),
    };

    await TestBed
      .configureTestingModule({
        imports: [
          WelcomePageComponent,
        ],
        providers: [
          {
            provide: Router,
            useValue: router,
          },
          {
            provide:
              SessionStoreService,
            useValue:
              sessionStore,
          },
        ],
      })
      .compileComponents();

    fixture =
      TestBed.createComponent(
        WelcomePageComponent,
      );

    component =
      fixture.componentInstance;

    fixture.detectChanges();
  });

  it('creates the component', () => {
    expect(component).toBeTruthy();
  });

  it('starts a session and navigates to game', () => {
    sessionStore.startSession
      .and.returnValue(
        of({
          credits: 10,
          status:
            GameSessionStatus.Active,
        }),
      );

    component.startGame();

    expect(
      sessionStore.startSession,
    ).toHaveBeenCalledTimes(1);

    expect(
      router.navigateByUrl,
    ).toHaveBeenCalledWith(
      '/game',
    );
  });

  it('does not start another session while pending', () => {
    pendingState.set(true);

    component.startGame();

    expect(
      sessionStore.startSession,
    ).not.toHaveBeenCalled();
  });

  it('disables the button while pending', () => {
    pendingState.set(true);

    fixture.detectChanges();

    const button =
      fixture.nativeElement
        .querySelector(
          'button',
        ) as HTMLButtonElement;

    expect(button.disabled)
      .toBeTrue();
  });

  it('displays store errors', () => {
    errorState.set(
      'Unable to start session.',
    );

    fixture.detectChanges();

    const alert =
      fixture.nativeElement
        .querySelector(
          '[role="alert"]',
        ) as HTMLElement;

    expect(
      alert.textContent,
    ).toContain(
      'Unable to start session.',
    );
  });
});