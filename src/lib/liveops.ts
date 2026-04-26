import { applyLiveOpsConfig, DEFAULT_LIVE_OPS_CONFIG, type LiveOpsConfig } from '../game/progression';
import { ensureAnonymousAuth, isFirebaseEnabled, loadLiveOpsConfigFromCloud } from './firebase';

const LIVE_OPS_CACHE_KEY = 'ages_of_war_liveops_v1';

function readCachedConfig(): Partial<LiveOpsConfig> {
  try {
    const raw = localStorage.getItem(LIVE_OPS_CACHE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Partial<LiveOpsConfig>;
  } catch {
    return {};
  }
}

function writeCachedConfig(config: LiveOpsConfig): void {
  localStorage.setItem(LIVE_OPS_CACHE_KEY, JSON.stringify(config));
}

export function loadCachedLiveOpsConfig(): LiveOpsConfig {
  const merged = applyLiveOpsConfig({
    ...DEFAULT_LIVE_OPS_CONFIG,
    ...readCachedConfig(),
  });
  return merged;
}

export async function refreshLiveOpsConfig(): Promise<LiveOpsConfig> {
  let merged = loadCachedLiveOpsConfig();
  if (!isFirebaseEnabled()) return merged;

  try {
    const uid = await ensureAnonymousAuth();
    if (!uid) return merged;
    const cloud = await loadLiveOpsConfigFromCloud();
    if (cloud) {
      merged = applyLiveOpsConfig(cloud);
      writeCachedConfig(merged);
    }
  } catch (error) {
    console.error('LiveOps config refresh failed:', error);
  }

  return merged;
}
