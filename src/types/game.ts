export interface UnitStats {
  name: string;
  health: number;
  damage: number;
  speed: number;
  range: number;
  attackSpeed: number; // attacks per second
  cost: number;
  image: string;
  type: 'melee' | 'ranged' | 'tank' | 'siege';
  description: string;
}

export interface AgeConfig {
  name: string;
  era: string;
  themeColor: string;
  bgImage: string;
  castleImage: string;
  units: UnitStats[];
  xpRequired: number;
  goldBonus: number;
}

export interface GameUnit {
  id: string;
  type: number; // unit index in age
  age: number;
  x: number;
  y: number;
  health: number;
  maxHealth: number;
  damage: number;
  speed: number;
  range: number;
  attackSpeed: number;
  lastAttackTime: number;
  isPlayer: boolean;
  target: GameUnit | null;
  isAttacking: boolean;
  isDead: boolean;
  deathTime: number;
  attackAnim: number;
  aiStrategyTag?: AIProfile;
}

export interface Castle {
  x: number;
  health: number;
  maxHealth: number;
  age: number;
  isPlayer: boolean;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
  type: 'blood' | 'explosion' | 'spark' | 'levelup' | 'coin' | 'dust';
}

export interface Projectile {
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  targetX: number;
  targetY: number;
  speed: number;
  damage: number;
  color: string;
  isPlayer: boolean;
  attackType: 'melee' | 'ranged' | 'tank' | 'siege';
}

export interface FloatingText {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
  size: number;
}

export interface ResourceStock {
  food: number;
  wood: number;
  stone: number;
  gold: number;
}

export type BuildingType =
  | 'town_center'
  | 'barracks'
  | 'farm'
  | 'house'
  | 'lumber_camp'
  | 'mill'
  | 'mine'
  | 'temple'
  | 'blacksmith';

export interface BuildingInstance {
  id: string;
  type: BuildingType;
  level: number;
  health: number;
  maxHealth: number;
  x: number;
  y: number;
  isPlayer: boolean;
  constructedAt: number;
}

export interface ResourceNodeState {
  id: string;
  type: 'tree' | 'gold_mine' | 'stone_mine' | 'berry_bush';
  position: { x: number; y: number };
  resourceAmount: number;
  gatherRate: number;
}

export interface VillagerWorkerState {
  id: string;
  position: { x: number; y: number };
  assignedNode: string | null;
  carriedResource: { type: ResourceType; amount: number } | null;
  state: 'idle' | 'moving_to_node' | 'gathering' | 'returning_to_dropoff';
  owner: 'player' | 'enemy';
}

export interface MatchObjective {
  id: string;
  label: string;
  completed: boolean;
  progress: number;
  target: number;
}

export interface MissionModifiers {
  playerGoldRateMult: number;
  aiGoldRateMult: number;
  playerCastleHealthMult: number;
  aiCastleHealthMult: number;
  objectiveRewardMult: number;
}

export interface MatchRewardSummary {
  objectiveGold: number;
  objectiveGems: number;
  objectiveBattlePassXP: number;
}

export type GameMode = 'campaign' | 'assault' | 'defense' | 'raid' | 'endless';
export type AIProfile = 'aggressive' | 'defensive' | 'techrush';
export type GameScreen = 'menu' | 'playing' | 'paused' | 'gameover' | 'howto';
export type BattleStance = 'aggressive' | 'balanced' | 'defensive';
export type LaneFocus = 'auto' | 'left' | 'center' | 'right';

export interface GameState {
  mode: GameMode;
  aiProfile: AIProfile;
  modeTimeLimit: number;
  raidInitialCastleHealth: number;
  surgeWarningUntil: number;
  screen: GameScreen;
  playerGold: number;
  playerGems: number;
  playerXP: number;
  playerAge: number;
  aiGold: number;
  aiAge: number;
  aiDirector: {
    skillEstimate: number;
    pressureScore: number;
    economyMode: 'starved' | 'balanced' | 'surplus';
    macroPlan: 'boom' | 'siege' | 'stabilize' | 'allin';
    personalityVariance: number;
    microRetreatThreshold: number;
    reserveGold: number;
    nextSpawnAt: number;
    nextMacroDecisionAt: number;
    nextAgeCheckAt: number;
    visualTelegraphUntil: number;
    visualTelegraph: AIProfile;
    liveOpsDifficultyBias: number;
    plannerNotes: string;
  };
  premiumPass: boolean;
  adFree: boolean;
  goldMineLevel: number;
  speedBoostUntil: number;
  purchasedOffers: string[];
  missions: {
    spawnUnits: number;
    destroyEnemies: number;
  };
  claimedMissionRewards: {
    spawnUnits: boolean;
    destroyEnemies: boolean;
  };
  dailyChallenge: {
    targetKills: number;
    targetSpawns: number;
    rewardGems: number;
    claimed: boolean;
    dayKey: string;
  };
  weeklyChallenge: {
    targetKills: number;
    rewardGems: number;
    claimed: boolean;
    weekKey: string;
  };
  onboardingSteps: {
    spawnedUnit: boolean;
    usedTactic: boolean;
    claimedReward: boolean;
  };
  rewardChestProgress: number;
  unclaimedChests: number;
  winStreak: number;
  lossStreak: number;
  tutorialStep: number;
  tutorialDismissed: boolean;
  adaptiveAssistUntil: number;
  adaptiveAssistCooldownUntil: number;
  adaptiveAssistActivations: number;
  onboardingBonusClaimed: boolean;
  lastMatchGrade: 'S' | 'A' | 'B' | 'C';
  lastMatchBonusGold: number;
  lastMatchBonusGems: number;
  lastMatchTip: string;
  seasonalTokens: number;
  seasonXP: number;
  battlePassXP: number;
  lifetimeSpendUsd: number;
  lastDailyRewardAt: number;
  matchesPlayed: number;
  playerCastle: Castle;
  aiCastle: Castle;
  playerResources: ResourceStock;
  aiResources: ResourceStock;
  populationCap: number;
  currentPopulation: number;
  unlockedTechs: string[];
  claimedObjectiveRewards: string[];
  campaignMissionIndex: number;
  campaignSeed: number;
  campaignProgressAwarded: boolean;
  campaignPackId: 'frontier' | 'warpath' | 'cataclysm';
  campaignPackTitle: string;
  nextCampaignPackTitle: string;
  campaignPackHint: string;
  campaignEventTitle: string;
  campaignEventEffect: string;
  missionDescriptor: string;
  missionModifiers: MissionModifiers;
  matchRewardSummary: MatchRewardSummary;
  objectiveNotice: string;
  objectiveNoticeUntil: number;
  objectives: MatchObjective[];
  playerBuildings: BuildingInstance[];
  aiBuildings: BuildingInstance[];
  resourceNodes: ResourceNodeState[];
  villagers: VillagerWorkerState[];
  units: GameUnit[];
  particles: Particle[];
  projectiles: Projectile[];
  floatingTexts: FloatingText[];
  wave: number;
  kills: number;
  isVictory: boolean;
  ageUpAnim: number;
  shakeScreen: number;
  playerBattleStance: BattleStance;
  playerLaneFocus: LaneFocus;
  rallyUntil: number;
  rallyCooldownUntil: number;
  fortifyCooldownUntil: number;
  time: number;
}
