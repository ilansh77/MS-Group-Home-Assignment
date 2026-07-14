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
  type SessionState,
} from '../../../../core/session/session.models';
import {
  SessionStoreService,
} from '../../../../core/session/session-store.service';
import {
  CashoutPageComponent,
} from './cashout-page.component';

describe('CashoutPageComponent', () => {
  let fixture:
    ComponentFixture<
      CashoutPageComponent
    >;

  let component:
    CashoutPageComponent;

  let router:
    jasmine.SpyObj<Router>;

  const pendingState =
    signal(false);

  const errorState =
    signal<string | null>(
      null,
    );

  const sessionState =
    signal<SessionState | null>({
      credits: 0,
      status:
        GameSessionStatus.CashedOut,
      cashedOutCredits: 25,
    });

  let sessionStore: {
    pending:
      ReturnType<
        typeof pendingState.asReadonly
      >;
    error:
      ReturnType<
        typeof errorState.asReadonly
      >;
    session:
      ReturnType<
        typeof sessionState.asReadonly
      >;
    clearSession:
      jasmine.Spy;
  };

  beforeEach(async () => {
    pendingState.set(false);
    errorState.set(null);

    sessionState.set({
      credits: 0,
      status:
        GameSessionStatus.CashedOut,
      cashedOutCredits: 25,
    });

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
      session:
        sessionState.asReadonly(),
      clearSession:
        jasmine.createSpy(
          'clearSession',
        ),
    };

    await TestBed
      .configureTestingModule({
        imports: [
          CashoutPageComponent,
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
        CashoutPageComponent,
      );

    component =
      fixture.componentInstance;

    fixture.detectChanges();
  });

  it('creates the component', () => {
    expect(component).toBeTruthy();
  });

  it('renders the cashed-out credits', () => {
    expect(
      fixture.nativeElement
        .textContent,
    ).toContain('25');
  });

  it('clears the session and navigates home', () => {
    sessionStore.clearSession
      .and.returnValue(
        of(undefined),
      );

    component.startNewGame();

    expect(
      sessionStore.clearSession,
    ).toHaveBeenCalledTimes(1);

    expect(
      router.navigateByUrl,
    ).toHaveBeenCalledWith('/');
  });

  it('does not clear while a request is pending', () => {
    pendingState.set(true);

    component.startNewGame();

    expect(
      sessionStore.clearSession,
    ).not.toHaveBeenCalled();
  });

  it('displays an error message', () => {
    errorState.set(
      'Unable to clear session.',
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
      'Unable to clear session.',
    );
  });
});