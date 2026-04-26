import { describe, expect, it } from 'vitest';
import { applyCampaignMissionConfig, createInitialState, setPlayerBattleStance, setPlayerLaneFocus, updateGame } from './engine';

function createStateWithSinglePlayerUnit() {
  const state = createInitialState(1000, 600, 'assault');
  state.units.push({
    id: 'test_player_unit',
    type: 0,
    age: 0,
    x: state.playerCastle.x + 60,
    y: 180,
    health: 100,
    maxHealth: 100,
    damage: 20,
    speed: 100,
    range: 40,
    attackSpeed: 1,
    lastAttackTime: 0,
    isPlayer: true,
    target: null,
    isAttacking: false,
    isDead: false,
    deathTime: 0,
    attackAnim: 0,
  });
  return state;
}

describe('engine tactical controls', () => {
  it('moves faster with aggressive stance than defensive', () => {
    const aggressiveState = createStateWithSinglePlayerUnit();
    const defensiveState = createStateWithSinglePlayerUnit();

    setPlayerBattleStance(aggressiveState, 'aggressive');
    setPlayerBattleStance(defensiveState, 'defensive');

    updateGame(aggressiveState, 1, 1000, 600);
    updateGame(defensiveState, 1, 1000, 600);

    const aggressiveX = aggressiveState.units[0].x;
    const defensiveX = defensiveState.units[0].x;
    expect(aggressiveX).toBeGreaterThan(defensiveX);
  });

  it('steers unit vertical position based on lane focus', () => {
    const leftFocusState = createStateWithSinglePlayerUnit();
    const rightFocusState = createStateWithSinglePlayerUnit();

    leftFocusState.units[0].y = 220;
    rightFocusState.units[0].y = 220;

    setPlayerLaneFocus(leftFocusState, 'left');
    setPlayerLaneFocus(rightFocusState, 'right');

    updateGame(leftFocusState, 1, 1000, 600);
    updateGame(rightFocusState, 1, 1000, 600);

    expect(rightFocusState.units[0].y).toBeGreaterThan(leftFocusState.units[0].y);
  });

  it('assigns campaign pack metadata based on mission index', () => {
    const state = createInitialState(1000, 600, 'campaign');
    state.campaignMissionIndex = 5;
    applyCampaignMissionConfig(state);

    expect(state.campaignPackId).toBe('warpath');
    expect(state.campaignPackTitle).toContain('Warpath');
    expect(state.nextCampaignPackTitle).toContain('Cataclysm');
  });

  it('claims destroy_enemies objective reward only once', () => {
    const state = createInitialState(1000, 600, 'campaign');
    state.objectives = [
      {
        id: 'destroy_enemies',
        label: 'Eliminate 10 attackers',
        completed: false,
        progress: 0,
        target: 10,
      },
    ];
    state.missions.destroyEnemies = 12;

    const beforeGold = state.playerGold;
    const beforeGems = state.playerGems;
    updateGame(state, 0.1, 1000, 600);

    const afterFirstGold = state.playerGold;
    const afterFirstGems = state.playerGems;
    expect(afterFirstGold).toBeGreaterThan(beforeGold);
    expect(afterFirstGems).toBeGreaterThan(beforeGems);
    expect(state.claimedObjectiveRewards).toContain('destroy_enemies');

    updateGame(state, 0.1, 1000, 600);
    expect(state.playerGold).toBeGreaterThanOrEqual(afterFirstGold);
    expect(state.playerGems).toBe(afterFirstGems);
    expect(state.claimedObjectiveRewards.filter((id) => id === 'destroy_enemies')).toHaveLength(1);
  });
});
