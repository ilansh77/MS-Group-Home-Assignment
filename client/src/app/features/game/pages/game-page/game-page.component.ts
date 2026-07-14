import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import {
  takeUntilDestroyed,
} from '@angular/core/rxjs-interop';
import {
  Router,
} from '@angular/router';
import {
  concatMap,
  endWith,
  finalize,
  from,
  ignoreElements,
  interval,
  Observable,
  Subscription,
  switchMap,
  tap,
  timer,
} from 'rxjs';
import {
  SessionStoreService,
} from '../../../../core/session/session-store.service';
import {
  SlotSymbol,
  type RollSessionResponse,
} from '../../../../core/session/session.models';
import {
  WinModalComponent,
} from '../../../../shared/ui/win-modal/win-modal.component';

type ReelIndex = 0 | 1 | 2;

type DisplaySymbol =
  | SlotSymbol
  | '★';

type DisplaySymbols = readonly [
  DisplaySymbol,
  DisplaySymbol,
  DisplaySymbol,
];

type RevealedReels = readonly [
  boolean,
  boolean,
  boolean,
];

const REEL_TICK_MS = 90;
const REEL_STOP_DELAY_MS = 1_000;

const SLOT_SYMBOLS =
  Object.values(
    SlotSymbol,
  ) as SlotSymbol[];

const INITIAL_SYMBOLS:
  DisplaySymbols = [
    '★',
    '★',
    '★',
  ];

const SYMBOL_GLYPHS:
  Readonly<
    Record<
      DisplaySymbol,
      string
    >
  > = {
    [SlotSymbol.Cherry]: '🍒',
    [SlotSymbol.Lemon]: '🍋',
    [SlotSymbol.Orange]: '🍊',
    [SlotSymbol.Watermelon]: '🍉',
    '★': '★',
  };

@Component({
  selector: 'app-game-page',
  standalone: true,
  imports: [
    WinModalComponent,
  ],
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

  private readonly rollingState =
    signal(false);

  private readonly displayedSymbolsState =
    signal<DisplaySymbols>(
      INITIAL_SYMBOLS,
    );

  private readonly revealedReelsState =
    signal<RevealedReels>([
      true,
      true,
      true,
    ]);

  private readonly winModalOpenState =
    signal(false);

  private readonly winRewardState =
    signal(0);

  private spinSubscription:
    Subscription | null = null;

  readonly rolling =
    this.rollingState.asReadonly();

  readonly displayedSymbols =
    this.displayedSymbolsState
      .asReadonly();

  readonly revealedReels =
    this.revealedReelsState
      .asReadonly();

  readonly winModalOpen =
    this.winModalOpenState
      .asReadonly();

  readonly winReward =
    this.winRewardState
      .asReadonly();

  readonly symbolGlyphs =
    SYMBOL_GLYPHS;

  readonly canRoll =
    computed(() => {
      return (
        this.sessionStore.canRoll() &&
        !this.rollingState()
      );
    });

  readonly canCashOut =
    computed(() => {
      return (
        this.sessionStore
          .canCashOut() &&
        !this.rollingState()
      );
    });

  roll(): void {
    if (!this.canRoll()) {
      return;
    }

    this.beginSpin();

    this.sessionStore
      .roll()
      .pipe(
        switchMap((result) =>
          this.revealResult(
            result,
          ),
        ),
        finalize(() => {
          this.finishSpin();
        }),
        takeUntilDestroyed(
          this.destroyRef,
        ),
      )
      .subscribe({
        next: (result) => {
          if (result.won) {
            this.winRewardState.set(
              result.reward,
            );

            this.winModalOpenState.set(
              true,
            );
          }
        },
        error: () => {
          this.restorePreviousSymbols();
          this.redirectWhenSessionIsMissing();
        },
      });
  }

  cashOut(): void {
    if (!this.canCashOut()) {
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
        error: () => {
          this.redirectWhenSessionIsMissing();
        },
      });
  }

  closeWinModal(): void {
    this.winModalOpenState.set(false);
  }

  private beginSpin(): void {
    this.spinSubscription
      ?.unsubscribe();

    this.rollingState.set(true);

    this.revealedReelsState.set([
      false,
      false,
      false,
    ]);

    this.spinSubscription =
      interval(REEL_TICK_MS)
        .pipe(
          takeUntilDestroyed(
            this.destroyRef,
          ),
        )
        .subscribe(() => {
          this.randomizeUnrevealedReels();
        });
  }

  private revealResult(
    result: RollSessionResponse,
  ): Observable<RollSessionResponse> {
    return from(
      result.symbols,
    ).pipe(
      concatMap(
        (symbol, index) =>
          timer(
            REEL_STOP_DELAY_MS,
          ).pipe(
            tap(() => {
              this.revealReel(
                index as ReelIndex,
                symbol,
              );
            }),
          ),
      ),
      ignoreElements(),
      endWith(result),
    );
  }

  private revealReel(
    index: ReelIndex,
    symbol: SlotSymbol,
  ): void {
    const displayed = [
      ...this.displayedSymbolsState(),
    ] as [
      DisplaySymbol,
      DisplaySymbol,
      DisplaySymbol,
    ];

    displayed[index] = symbol;

    this.displayedSymbolsState.set(
      displayed,
    );

    const revealed = [
      ...this.revealedReelsState(),
    ] as [
      boolean,
      boolean,
      boolean,
    ];

    revealed[index] = true;

    this.revealedReelsState.set(
      revealed,
    );
  }

  private randomizeUnrevealedReels():
    void {
    const displayed = [
      ...this.displayedSymbolsState(),
    ] as [
      DisplaySymbol,
      DisplaySymbol,
      DisplaySymbol,
    ];

    const revealed =
      this.revealedReelsState();

    for (
      let index = 0;
      index < displayed.length;
      index += 1
    ) {
      if (!revealed[index]) {
        displayed[index] =
          this.getRandomVisualSymbol();
      }
    }

    this.displayedSymbolsState.set(
      displayed,
    );
  }

  private getRandomVisualSymbol():
    SlotSymbol {
    const index = Math.floor(
      Math.random() *
        SLOT_SYMBOLS.length,
    );

    return (
      SLOT_SYMBOLS[index] ??
      SlotSymbol.Cherry
    );
  }

  private finishSpin(): void {
    this.spinSubscription
      ?.unsubscribe();

    this.spinSubscription = null;
    this.rollingState.set(false);
  }

  private restorePreviousSymbols():
    void {
    const previousSymbols =
      this.sessionStore
        .lastRoll()
        ?.symbols;

    this.displayedSymbolsState.set(
      previousSymbols ??
        INITIAL_SYMBOLS,
    );

    this.revealedReelsState.set([
      true,
      true,
      true,
    ]);
  }

  private redirectWhenSessionIsMissing():
    void {
    if (
      this.sessionStore.session()
    ) {
      return;
    }

    void this.router.navigateByUrl(
      '/',
    );
  }
}