import type { AIProfile, GameMode } from '../types/game';

const MODE_LABELS: Record<GameMode, string> = {
  campaign: 'Campaign',
  assault: 'Assault',
  defense: 'Defense',
  raid: 'Raid',
  endless: 'Endless',
};

const MODE_TAGLINES: Record<GameMode, string> = {
  campaign: 'Progress through seeded missions and escalating theaters.',
  assault: 'Break the enemy stronghold before your fortress falls.',
  defense: 'Hold the line and survive until extraction.',
  raid: 'Execute a high-risk strike before time expires.',
  endless: 'Survive forever as waves scale without a timer.',
};

const AI_PROFILE_LABELS: Record<AIProfile, string> = {
  aggressive: 'Aggressive',
  defensive: 'Defensive',
  techrush: 'Tech Rush',
};

const AI_PROFILE_DESCRIPTIONS: Record<AIProfile, string> = {
  aggressive: 'Fast pressure with relentless waves.',
  defensive: 'Stabilizes first, then counter-pushes.',
  techrush: 'Rushes upgrades to unlock stronger units.',
};

const AI_MACRO_PLAN_LABELS: Record<'boom' | 'siege' | 'stabilize' | 'allin', string> = {
  boom: 'Tech Boom',
  siege: 'Siege Pressure',
  stabilize: 'Defensive Stabilize',
  allin: 'All-In Push',
};

const AI_ECONOMY_MODE_LABELS: Record<'starved' | 'balanced' | 'surplus', string> = {
  starved: 'Low Resources',
  balanced: 'Balanced Economy',
  surplus: 'Resource Surplus',
};

export function getModeLabel(mode: GameMode): string {
  return MODE_LABELS[mode];
}

export function getModeTagline(mode: GameMode): string {
  return MODE_TAGLINES[mode];
}

export function getAIProfileLabel(profile: AIProfile): string {
  return AI_PROFILE_LABELS[profile];
}

export function getAIProfileDescription(profile: AIProfile): string {
  return AI_PROFILE_DESCRIPTIONS[profile];
}

export function getAIMacroPlanLabel(plan: 'boom' | 'siege' | 'stabilize' | 'allin'): string {
  return AI_MACRO_PLAN_LABELS[plan];
}

export function getAIEconomyModeLabel(mode: 'starved' | 'balanced' | 'surplus'): string {
  return AI_ECONOMY_MODE_LABELS[mode];
}
