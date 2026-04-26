import { fetchAndActivate, getRemoteConfig, getValue, type RemoteConfig } from 'firebase/remote-config';
import { getFirebaseApp } from './firebase';

let rc: RemoteConfig | null = null;

const defaults: Record<string, string> = {
  gold_economy_scale: '1',
  gold_mine_cost_multiplier: '1',
  gem_daily_reward_bonus: '0',
  boss_wave_interval_sec: '45',
  boss_health_multiplier: '1',
  xp_per_kill: '25',
  maintenance_mode: 'false',
  tutorial_skip_available: 'true',
};

export async function initRemoteConfig(): Promise<void> {
  const app = getFirebaseApp();
  if (!app) return;
  rc = getRemoteConfig(app);
  rc.defaultConfig = defaults;
  rc.settings.minimumFetchIntervalMillis = import.meta.env.MODE === 'development' ? 60_000 : 3_600_000;
  try {
    await fetchAndActivate(rc);
  } catch (e) {
    console.warn('[remote-config] fetch failed, using defaults', e);
  }
}

function num(key: string, fallback: number): number {
  if (!rc) return fallback;
  const v = getValue(rc, key);
  if (typeof v.asNumber === 'function') {
    const n = v.asNumber();
    return Number.isFinite(n) ? n : fallback;
  }
  const s = v.asString();
  const parsed = Number(s);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function bool(key: string, fallback: boolean): boolean {
  if (!rc) return fallback;
  return getValue(rc, key).asBoolean();
}

export const remoteGameConfig = {
  getGoldEconomyScale: () => num('gold_economy_scale', Number(defaults.gold_economy_scale)),
  getGoldMineCostMultiplier: () => num('gold_mine_cost_multiplier', Number(defaults.gold_mine_cost_multiplier)),
  getGemDailyRewardBonus: () => num('gem_daily_reward_bonus', Number(defaults.gem_daily_reward_bonus)),
  getBossWaveIntervalSec: () => num('boss_wave_interval_sec', Number(defaults.boss_wave_interval_sec)),
  getBossHealthMultiplier: () => num('boss_health_multiplier', Number(defaults.boss_health_multiplier)),
  getXpPerKill: () => num('xp_per_kill', Number(defaults.xp_per_kill)),
  isMaintenanceMode: () => bool('maintenance_mode', defaults.maintenance_mode === 'true'),
  isTutorialSkipAvailable: () => bool('tutorial_skip_available', defaults.tutorial_skip_available === 'true'),
};
