import {
  SlotSymbol,
  type GameRollResult,
} from './game.types';
import { GameEngineService } from './game-engine.service';
import { RandomSource } from './random-source';

describe('GameEngineService', () => {
  let gameEngine: GameEngineService;

  const randomSourceMock = {
    integer: jest.fn<number, [number]>(),
    chance: jest.fn<boolean, [number]>(),
  };

  beforeEach(() => {
    randomSourceMock.integer.mockReset();
    randomSourceMock.chance.mockReset();

    gameEngine = new GameEngineService(
      randomSourceMock as RandomSource,
    );
  });

  it('deducts one credit for a losing roll', () => {
    randomSourceMock.integer
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(1)
      .mockReturnValueOnce(2);

    const result = gameEngine.roll(10);

    expect(result).toEqual<GameRollResult>({
      symbols: [
        SlotSymbol.Cherry,
        SlotSymbol.Lemon,
        SlotSymbol.Orange,
      ],
      won: false,
      reward: 0,
      credits: 9,
      rerolled: false,
    });

    expect(
      randomSourceMock.chance,
    ).not.toHaveBeenCalled();
  });

  it('adds the reward after deducting the roll cost', () => {
    randomSourceMock.integer.mockReturnValue(0);

    const result = gameEngine.roll(10);

    expect(result.credits).toBe(19);
    expect(result.reward).toBe(10);
    expect(result.won).toBe(true);
    expect(result.rerolled).toBe(false);
  });

  it('uses a 30 percent reroll chance at 40 credits', () => {
    randomSourceMock.integer
      // Initial winning cherry roll
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0)
      // Losing reroll
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(1)
      .mockReturnValueOnce(2);

    randomSourceMock.chance.mockReturnValue(true);

    const result = gameEngine.roll(40);

    expect(
      randomSourceMock.chance,
    ).toHaveBeenCalledWith(0.3);

    expect(result).toEqual({
      symbols: [
        SlotSymbol.Cherry,
        SlotSymbol.Lemon,
        SlotSymbol.Orange,
      ],
      won: false,
      reward: 0,
      credits: 39,
      rerolled: true,
    });
  });

  it('uses a 30 percent reroll chance at 60 credits', () => {
    randomSourceMock.integer.mockReturnValue(0);
    randomSourceMock.chance.mockReturnValue(false);

    gameEngine.roll(60);

    expect(
      randomSourceMock.chance,
    ).toHaveBeenCalledWith(0.3);
  });

  it('uses a 60 percent reroll chance above 60 credits', () => {
    randomSourceMock.integer.mockReturnValue(0);
    randomSourceMock.chance.mockReturnValue(false);

    gameEngine.roll(61);

    expect(
      randomSourceMock.chance,
    ).toHaveBeenCalledWith(0.6);
  });

  it('accepts the second result even when it is another win', () => {
    randomSourceMock.integer
      // Initial cherry win
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0)
      // Watermelon reroll win
      .mockReturnValueOnce(3)
      .mockReturnValueOnce(3)
      .mockReturnValueOnce(3);

    randomSourceMock.chance.mockReturnValue(true);

    const result = gameEngine.roll(61);

    expect(result.symbols).toEqual([
      SlotSymbol.Watermelon,
      SlotSymbol.Watermelon,
      SlotSymbol.Watermelon,
    ]);

    expect(result.reward).toBe(40);
    expect(result.credits).toBe(100);
    expect(result.rerolled).toBe(true);

    expect(
      randomSourceMock.chance,
    ).toHaveBeenCalledTimes(1);
  });
});