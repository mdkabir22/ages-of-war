export type GameModeId = 'campaign' | 'skirmish' | 'endless';

export interface GameModeDefinition {
  id: GameModeId;
  title: string;
  summary: string;
  objective: string;
}

export const GAME_MODES: GameModeDefinition[] = [
  {
    id: 'campaign',
    title: 'Campaign',
    summary: 'Scripted progression across ages and missions.',
    objective: 'Complete mission-specific goals and defeat enemy commanders.',
  },
  {
    id: 'skirmish',
    title: 'Skirmish',
    summary: 'Quick custom match with configurable AI difficulty.',
    objective: 'Destroy enemy castle before they overwhelm your base.',
  },
  {
    id: 'endless',
    title: 'Endless',
    summary: 'Survive escalating enemy waves and scaling economy pressure.',
    objective: 'Hold the line for as long as possible.',
  },
];
