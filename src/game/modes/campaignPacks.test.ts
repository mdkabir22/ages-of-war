import { describe, expect, it } from 'vitest';
import { applyCampaignPack } from './campaignPacks';

const baseModifiers = {
  playerGoldRateMult: 1,
  aiGoldRateMult: 1,
  playerCastleHealthMult: 1,
  aiCastleHealthMult: 1,
  objectiveRewardMult: 1,
};

describe('campaign pack rotations', () => {
  it('produces different objective rotations across nearby campaign missions', () => {
    const mission4 = applyCampaignPack(4, 'campaign', 'Mission 4', baseModifiers, []);
    const mission5 = applyCampaignPack(5, 'campaign', 'Mission 5', baseModifiers, []);

    const ids4 = mission4.objectives.map((o) => o.id).join(',');
    const ids5 = mission5.objectives.map((o) => o.id).join(',');
    expect(ids4).not.toBe(ids5);
    expect(mission4.rotationLabel).not.toBe(mission5.rotationLabel);
  });

  it('keeps rotation deterministic for same mission input', () => {
    const a = applyCampaignPack(8, 'campaign', 'Mission 8', baseModifiers, []);
    const b = applyCampaignPack(8, 'campaign', 'Mission 8', baseModifiers, []);
    expect(a.rotationLabel).toBe(b.rotationLabel);
    expect(a.objectives).toEqual(b.objectives);
  });
});
