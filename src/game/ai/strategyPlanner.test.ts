import { describe, expect, it } from 'vitest';
import { planAIStrategy } from './strategyPlanner';

describe('strategy planner', () => {
  it('chooses turtle when castle is losing and outnumbered', () => {
    const decision = planAIStrategy({
      currentAge: 2,
      ownCastleHealthRatio: 0.4,
      enemyCastleHealthRatio: 0.72,
      ownArmySize: 3,
      enemyArmySize: 8,
      stockGold: 120,
    });
    expect(decision.strategy).toBe('turtle');
    expect(decision.priorityLane).toBe(1);
    expect(decision.shouldAgeUp).toBe(false);
  });

  it('chooses boom and age up when economy is strong', () => {
    const decision = planAIStrategy({
      currentAge: 2,
      ownCastleHealthRatio: 0.82,
      enemyCastleHealthRatio: 0.8,
      ownArmySize: 5,
      enemyArmySize: 5,
      stockGold: 420,
    });
    expect(decision.strategy).toBe('boom');
    expect(decision.shouldAgeUp).toBe(true);
  });

  it('chooses rush when army lead is significant', () => {
    const decision = planAIStrategy({
      currentAge: 3,
      ownCastleHealthRatio: 0.76,
      enemyCastleHealthRatio: 0.76,
      ownArmySize: 11,
      enemyArmySize: 6,
      stockGold: 200,
    });
    expect(decision.strategy).toBe('rush');
    expect(decision.priorityLane).toBe(0);
  });
});
