import type { GameMode, MatchObjective, MissionModifiers } from '../../types/game';

export interface CampaignPackDefinition {
  id: 'frontier' | 'warpath' | 'cataclysm';
  title: string;
  missionStart: number;
  missionEnd: number;
  baseDescriptor: string;
  objectiveHint: string;
  modifierAdjust: Partial<MissionModifiers>;
}

export interface CampaignPackResult {
  packId: CampaignPackDefinition['id'];
  packTitle: string;
  nextPackTitle: string;
  descriptor: string;
  objectiveHint: string;
  rotationLabel: string;
  modifiers: MissionModifiers;
  objectives: MatchObjective[];
}

const CAMPAIGN_PACKS: CampaignPackDefinition[] = [
  {
    id: 'frontier',
    title: 'Frontier Trials',
    missionStart: 1,
    missionEnd: 3,
    baseDescriptor: 'Frontier Trials',
    objectiveHint: 'Build momentum and secure your first victories.',
    modifierAdjust: {
      playerGoldRateMult: 0.04,
      playerCastleHealthMult: 0.06,
      aiGoldRateMult: -0.03,
    },
  },
  {
    id: 'warpath',
    title: 'Warpath Escalation',
    missionStart: 4,
    missionEnd: 6,
    baseDescriptor: 'Warpath Escalation',
    objectiveHint: 'Enemy adapts faster. Sustain pressure and efficiency.',
    modifierAdjust: {
      aiGoldRateMult: 0.07,
      aiCastleHealthMult: 0.08,
      objectiveRewardMult: 0.1,
    },
  },
  {
    id: 'cataclysm',
    title: 'Cataclysm Theater',
    missionStart: 7,
    missionEnd: 99,
    baseDescriptor: 'Cataclysm Theater',
    objectiveHint: 'High-risk battlefield. Survival and tempo are critical.',
    modifierAdjust: {
      aiGoldRateMult: 0.12,
      aiCastleHealthMult: 0.12,
      playerCastleHealthMult: -0.05,
      objectiveRewardMult: 0.2,
    },
  },
];

function getPackByMission(missionIndex: number): CampaignPackDefinition {
  return CAMPAIGN_PACKS.find((pack) => missionIndex >= pack.missionStart && missionIndex <= pack.missionEnd) ?? CAMPAIGN_PACKS[0];
}

function getNextPack(current: CampaignPackDefinition): CampaignPackDefinition {
  const idx = CAMPAIGN_PACKS.findIndex((p) => p.id === current.id);
  if (idx < 0 || idx >= CAMPAIGN_PACKS.length - 1) return current;
  return CAMPAIGN_PACKS[idx + 1];
}

function clampModifiers(modifiers: MissionModifiers): MissionModifiers {
  return {
    playerGoldRateMult: Math.max(0.82, Math.min(1.35, modifiers.playerGoldRateMult)),
    aiGoldRateMult: Math.max(0.82, Math.min(1.45, modifiers.aiGoldRateMult)),
    playerCastleHealthMult: Math.max(0.78, Math.min(1.4, modifiers.playerCastleHealthMult)),
    aiCastleHealthMult: Math.max(0.85, Math.min(1.5, modifiers.aiCastleHealthMult)),
    objectiveRewardMult: Math.max(0.9, Math.min(2.2, modifiers.objectiveRewardMult)),
  };
}

export function applyCampaignPack(
  missionIndex: number,
  mode: GameMode,
  baseDescriptor: string,
  baseModifiers: MissionModifiers,
  baseObjectives: MatchObjective[]
): CampaignPackResult {
  const pack = getPackByMission(missionIndex);
  const nextPack = getNextPack(pack);
  const packMissionNumber = missionIndex - pack.missionStart + 1;

  const adjusted = clampModifiers({
    playerGoldRateMult: baseModifiers.playerGoldRateMult + (pack.modifierAdjust.playerGoldRateMult ?? 0),
    aiGoldRateMult: baseModifiers.aiGoldRateMult + (pack.modifierAdjust.aiGoldRateMult ?? 0),
    playerCastleHealthMult: baseModifiers.playerCastleHealthMult + (pack.modifierAdjust.playerCastleHealthMult ?? 0),
    aiCastleHealthMult: baseModifiers.aiCastleHealthMult + (pack.modifierAdjust.aiCastleHealthMult ?? 0),
    objectiveRewardMult: baseModifiers.objectiveRewardMult + (pack.modifierAdjust.objectiveRewardMult ?? 0),
  });

  const descriptor = `${baseDescriptor} | ${pack.title} M${packMissionNumber}`;
  let objectives = [...baseObjectives];
  let objectiveHint = pack.objectiveHint;
  let rotationLabel = 'standard';
  if (mode === 'campaign') {
    if (pack.id === 'frontier') {
      const variant = missionIndex % 3;
      if (variant === 0) {
        rotationLabel = 'eco-rush';
        objectiveHint = 'Build economy quickly, then convert into fast siege timing.';
        objectives = [
          { id: 'build_economy', label: `Establish ${2 + missionIndex} economy structures`, completed: false, progress: 0, target: 2 + missionIndex },
          { id: 'advance_age', label: `Reach Age ${Math.min(3, 1 + Math.floor(missionIndex / 2)) + 1} milestone`, completed: false, progress: 0, target: Math.min(3, 1 + Math.floor(missionIndex / 2)) },
          { id: 'destroy_enemy_castle', label: 'Destroy enemy castle', completed: false, progress: 0, target: 1 },
        ];
      } else if (variant === 1) {
        rotationLabel = 'eco-defense';
        objectiveHint = 'Stabilize with structures, secure kills, then finish fortress.';
        objectives = [
          { id: 'build_economy', label: `Establish ${1 + missionIndex} economy structures`, completed: false, progress: 0, target: 1 + missionIndex },
          { id: 'destroy_enemies', label: `Eliminate ${14 + missionIndex * 2} attackers`, completed: false, progress: 0, target: 14 + missionIndex * 2 },
          { id: 'destroy_enemy_castle', label: 'Destroy enemy castle', completed: false, progress: 0, target: 1 },
        ];
      } else {
        rotationLabel = 'age-tempo';
        objectiveHint = 'Prioritize age timing and keep kill momentum for map control.';
        objectives = [
          { id: 'advance_age', label: `Reach Age ${Math.min(3, 1 + Math.floor((missionIndex + 1) / 2)) + 1} milestone`, completed: false, progress: 0, target: Math.min(3, 1 + Math.floor((missionIndex + 1) / 2)) },
          { id: 'destroy_enemies', label: `Eliminate ${16 + missionIndex * 2} attackers`, completed: false, progress: 0, target: 16 + missionIndex * 2 },
          { id: 'destroy_enemy_castle', label: 'Destroy enemy castle', completed: false, progress: 0, target: 1 },
        ];
      }
    } else if (pack.id === 'warpath') {
      const variant = missionIndex % 2;
      if (variant === 0) {
        rotationLabel = 'kill-chain';
        objectiveHint = 'Maintain relentless eliminations before castle collapse.';
        objectives = [
          { id: 'destroy_enemies', label: `Eliminate ${24 + missionIndex * 3} attackers`, completed: false, progress: 0, target: 24 + missionIndex * 3 },
          { id: 'advance_age', label: `Reach Age ${Math.min(4, 2 + Math.floor((missionIndex - 3) / 2)) + 1} milestone`, completed: false, progress: 0, target: Math.min(4, 2 + Math.floor((missionIndex - 3) / 2)) },
          { id: 'destroy_enemy_castle', label: 'Destroy enemy castle', completed: false, progress: 0, target: 1 },
        ];
      } else {
        rotationLabel = 'pressure-surge';
        objectiveHint = 'Sustain lane pressure and force castle damage early.';
        objectives = [
          { id: 'destroy_enemies', label: `Eliminate ${20 + missionIndex * 2} attackers`, completed: false, progress: 0, target: 20 + missionIndex * 2 },
          { id: 'damage_castle', label: `Deal at least ${58 + missionIndex * 3}% castle damage`, completed: false, progress: 0, target: 58 + missionIndex * 3 },
          { id: 'destroy_enemy_castle', label: 'Destroy enemy castle', completed: false, progress: 0, target: 1 },
        ];
      }
    } else {
      const variant = missionIndex % 3;
      if (variant === 0) {
        rotationLabel = 'survival-siege';
        objectiveHint = 'Survive the chaos, then crack the fortress with siege tempo.';
        objectives = [
          { id: 'survive_duration', label: `Survive for ${140 + missionIndex * 12}s`, completed: false, progress: 0, target: 140 + missionIndex * 12 },
          { id: 'damage_castle', label: `Deal at least ${68 + Math.min(20, missionIndex * 2)}% castle damage`, completed: false, progress: 0, target: 68 + Math.min(20, missionIndex * 2) },
          { id: 'destroy_enemy_castle', label: 'Destroy enemy castle', completed: false, progress: 0, target: 1 },
        ];
      } else if (variant === 1) {
        rotationLabel = 'attrition-line';
        objectiveHint = 'Win attrition fights first, then siege after lane control.';
        objectives = [
          { id: 'survive_duration', label: `Survive for ${130 + missionIndex * 10}s`, completed: false, progress: 0, target: 130 + missionIndex * 10 },
          { id: 'destroy_enemies', label: `Eliminate ${28 + missionIndex * 3} attackers`, completed: false, progress: 0, target: 28 + missionIndex * 3 },
          { id: 'destroy_enemy_castle', label: 'Destroy enemy castle', completed: false, progress: 0, target: 1 },
        ];
      } else {
        rotationLabel = 'cataclysm-race';
        objectiveHint = 'Race objective tempo under heavy pressure before fortress fails.';
        objectives = [
          { id: 'damage_castle', label: `Deal at least ${72 + Math.min(20, missionIndex * 2)}% castle damage`, completed: false, progress: 0, target: 72 + Math.min(20, missionIndex * 2) },
          { id: 'destroy_enemies', label: `Eliminate ${24 + missionIndex * 2} attackers`, completed: false, progress: 0, target: 24 + missionIndex * 2 },
          { id: 'destroy_enemy_castle', label: 'Destroy enemy castle', completed: false, progress: 0, target: 1 },
        ];
      }
    }
  } else {
    if ((mode === 'campaign' || mode === 'assault') && missionIndex >= 5) {
      objectives.push({
        id: 'destroy_enemies',
        label: `Eliminate ${22 + missionIndex * 2} attackers`,
        completed: false,
        progress: 0,
        target: 22 + missionIndex * 2,
      });
    }
    if (mode === 'raid' && missionIndex >= 4) {
      objectives.push({
        id: 'survive_duration',
        label: `Stay operational for ${120 + missionIndex * 10}s`,
        completed: false,
        progress: 0,
        target: 120 + missionIndex * 10,
      });
    }
  }

  return {
    packId: pack.id,
    packTitle: pack.title,
    nextPackTitle: nextPack.title,
    descriptor,
    objectiveHint,
    rotationLabel,
    modifiers: adjusted,
    objectives,
  };
}
