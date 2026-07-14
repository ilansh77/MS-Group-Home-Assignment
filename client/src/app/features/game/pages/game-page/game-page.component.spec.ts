import {
  signal,
} from '@angular/core';
import {
  ComponentFixture,
  fakeAsync,
  TestBed,
  tick,
} from '@angular/core/testing';
import {
  Router,
} from '@angular/router';
import {
  of,
  throwError,
} from 'rxjs';
import {
  GameSessionStatus,
  type RollSessionResponse,
  type SessionState,
  SlotSymbol,
} from '../../../../core/session/session.models';
import {
  SessionStoreService,
} from '../../../../core/session/session-store.service';
import {
  GamePageComponent,
} from './game-page.component';

describe('GamePageComponent', () => {
  let fixture:
    ComponentFixture<GamePageComponent>;

  let component:
    GamePageComponent;

  let router:
    jasmine.SpyObj<Router>;

  const sessionState =
    signal<SessionState | null>({
      credits: 10,
      status:
        GameSessionStatus.Active,
    });

  const creditsState =
    signal(10);

  const lastRollState =
    signal<
      RollSessionResponse | null
    >(null);

  const errorState =
    signal<string | null>(null);

  const canRollState =
    signal(true);

  const canCashOutState =
    signal(true);

  let sessionStoreMock: {
    session:
      ReturnType<
        typeof sessionState.asReadonly
      >;
    credits:
      ReturnType<
        typeof creditsState.asReadonly
      >;
    lastRoll:
      ReturnType<
        typeof lastRollState.asReadonly
      >;
    error:
      ReturnType<
        typeof errorState.asReadonly
      >;
    canRoll:
      ReturnType<
        typeof canRollState.asReadonly
      >;
    canCashOut:
      ReturnType<
        typeof canCashOutState.asReadonly
      >;
    roll:
      jasmine.Spy;
    cashOut:
      jasmine.Spy;
  };

  beforeEach(async () => {
    sessionState.set({
      credits: 10,
      status:
        GameSessionStatus.Active,
    });

    creditsState.set(10);
    lastRollState.set(null);
    errorState.set(null);
    canRollState.set(true);
    canCashOutState.set(true);

    router =
      jasmine.createSpyObj<Router>(
        'Router',
        [
          'navigateByUrl',
        ],
      );

    router.navigateByUrl
      .and.returnValue(
        Promise.resolve(true),
      );

    sessionStoreMock = {
      session:
        sessionState.asReadonly(),

      credits:
        creditsState.asReadonly(),

      lastRoll:
        lastRollState.asReadonly(),

      error:
        errorState.asReadonly(),

      canRoll:
        canRollState.asReadonly(),

      canCashOut:
        canCashOutState.asReadonly(),

      roll:
        jasmine.createSpy('roll'),

      cashOut:
        jasmine.createSpy(
          'cashOut',
        ),
    };

    await TestBed
      .configureTestingModule({
        imports: [
          GamePageComponent,
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
              sessionStoreMock,
          },
        ],
      })
      .compileComponents();

    fixture =
      TestBed.createComponent(
        GamePageComponent,
      );

    component =
      fixture.componentInstance;

    fixture.detectChanges();
  });

  it('creates the component', () => {
    expect(component).toBeTruthy();
  });

  it('renders the current credit balance', () => {
    expect(
      fixture.nativeElement
        .textContent,
    ).toContain('10');
  });

  it('starts a roll when rolling is allowed', () => {
    const result:
      RollSessionResponse = {
        symbols: [
          SlotSymbol.Cherry,
          SlotSymbol.Lemon,
          SlotSymbol.Orange,
        ],
        won: false,
        reward: 0,
        credits: 9,
      };

    sessionStoreMock.roll
      .and.returnValue(
        of(result),
      );

    component.roll();

    expect(
      sessionStoreMock.roll,
    ).toHaveBeenCalledTimes(1);
  });

  it('does not roll when rolling is unavailable', () => {
    canRollState.set(false);

    component.roll();

    expect(
      sessionStoreMock.roll,
    ).not.toHaveBeenCalled();
  });

  it('reveals the server symbols one reel at a time', fakeAsync(() => {
    const result:
      RollSessionResponse = {
        symbols: [
          SlotSymbol.Cherry,
          SlotSymbol.Lemon,
          SlotSymbol.Orange,
        ],
        won: false,
        reward: 0,
        credits: 9,
      };

    sessionStoreMock.roll
      .and.returnValue(
        of(result),
      );

    component.roll();

    expect(
      component.rolling(),
    ).toBeTrue();

    tick(1_000);

    expect(
      component
        .displayedSymbols()[0],
    ).toBe(
      SlotSymbol.Cherry,
    );

    expect(
      component.rolling(),
    ).toBeTrue();

    tick(1_000);

    expect(
      component
        .displayedSymbols()[1],
    ).toBe(
      SlotSymbol.Lemon,
    );

    tick(1_000);

    expect(
      component
        .displayedSymbols()[2],
    ).toBe(
      SlotSymbol.Orange,
    );

    expect(
      component.rolling(),
    ).toBeFalse();
  }));

  it('opens the win modal after a winning result is revealed', fakeAsync(() => {
    const result:
      RollSessionResponse = {
        symbols: [
          SlotSymbol.Cherry,
          SlotSymbol.Cherry,
          SlotSymbol.Cherry,
        ],
        won: true,
        reward: 10,
        credits: 19,
      };

    sessionStoreMock.roll
      .and.returnValue(
        of(result),
      );

    component.roll();

    tick(3_000);

    expect(
      component.winModalOpen(),
    ).toBeTrue();

    expect(
      component.winReward(),
    ).toBe(10);

    expect(
      component
        .displayedSymbols(),
    ).toEqual(
      result.symbols,
    );
  }));

  it('does not open the win modal after a losing result', fakeAsync(() => {
    sessionStoreMock.roll
      .and.returnValue(
        of({
          symbols: [
            SlotSymbol.Cherry,
            SlotSymbol.Lemon,
            SlotSymbol.Orange,
          ],
          won: false,
          reward: 0,
          credits: 9,
        }),
      );

    component.roll();

    tick(3_000);

    expect(
      component.winModalOpen(),
    ).toBeFalse();

    expect(
      component.rolling(),
    ).toBeFalse();
  }));

  it('closes the win modal', fakeAsync(() => {
    sessionStoreMock.roll
      .and.returnValue(
        of({
          symbols: [
            SlotSymbol.Cherry,
            SlotSymbol.Cherry,
            SlotSymbol.Cherry,
          ],
          won: true,
          reward: 10,
          credits: 19,
        }),
      );

    component.roll();

    tick(3_000);

    expect(
      component.winModalOpen(),
    ).toBeTrue();

    component.closeWinModal();

    expect(
      component.winModalOpen(),
    ).toBeFalse();
  }));

  it('cashes out and navigates to the cashout route', () => {
    sessionStoreMock.cashOut
      .and.returnValue(
        of({
          cashedOutCredits: 10,
          status:
            GameSessionStatus.CashedOut,
        }),
      );

    component.cashOut();

    expect(
      sessionStoreMock.cashOut,
    ).toHaveBeenCalledTimes(1);

    expect(
      router.navigateByUrl,
    ).toHaveBeenCalledWith(
      '/cashout',
    );
  });

  it('does not cash out when cash-out is unavailable', () => {
    canCashOutState.set(false);

    component.cashOut();

    expect(
      sessionStoreMock.cashOut,
    ).not.toHaveBeenCalled();
  });

  it('redirects home when the session expires during a roll', () => {
    sessionState.set(null);

    sessionStoreMock.roll
      .and.returnValue(
        throwError(
          () =>
            new Error(
              'Session expired',
            ),
        ),
      );

    component.roll();

    expect(
      router.navigateByUrl,
    ).toHaveBeenCalledWith('/');
  });

  it('does not redirect home for a non-session roll error', () => {
    sessionState.set({
      credits: 10,
      status:
        GameSessionStatus.Active,
    });

    sessionStoreMock.roll
      .and.returnValue(
        throwError(
          () =>
            new Error(
              'Temporary failure',
            ),
        ),
      );

    component.roll();

    expect(
      router.navigateByUrl,
    ).not.toHaveBeenCalled();
  });

  it('displays store errors', () => {
    errorState.set(
      'Unable to complete the roll.',
    );

    fixture.detectChanges();

    const alert =
      fixture.nativeElement
        .querySelector(
          '[role="alert"]',
        ) as HTMLElement;

    expect(alert).not.toBeNull();

    expect(
      alert.textContent,
    ).toContain(
      'Unable to complete the roll.',
    );
  });
});