export type AIStrategy = 'boom' | 'rush' | 'turtle' | 'balanced';

export interface AIPlannerInput {
  currentAge: number;
  ownCastleHealthRatio: number;
  enemyCastleHealthRatio: number;
  ownArmySize: number;
  enemyArmySize: number;
  stockGold: number;
}

export interface AIPlannerDecision {
  strategy: AIStrategy;
  priorityLane: 0 | 1 | 2;
  shouldAgeUp: boolean;
  notes: string;
}

export function planAIStrategy(input: AIPlannerInput): AIPlannerDecision {
  const pressure = input.enemyArmySize - input.ownArmySize;
  const losingCastle = input.ownCastleHealthRatio < input.enemyCastleHealthRatio - 0.1;

  if (losingCastle && pressure > 2) {
    return {
      strategy: 'turtle',
      priorityLane: 1,
      shouldAgeUp: false,
      notes: 'Defensive regroup around center lane.',
    };
  }

  if (input.stockGold > 350 && input.currentAge < 5) {
    return {
      strategy: 'boom',
      priorityLane: 2,
      shouldAgeUp: true,
      notes: 'Economy spike, invest in age progression.',
    };
  }

  if (input.ownArmySize >= input.enemyArmySize + 3) {
    return {
      strategy: 'rush',
      priorityLane: 0,
      shouldAgeUp: false,
      notes: 'Army lead detected, push pressure lane.',
    };
  }

  return {
    strategy: 'balanced',
    priorityLane: 1,
    shouldAgeUp: input.stockGold > 260 && input.currentAge < 5,
    notes: 'Maintain parity while scaling.',
  };
}
