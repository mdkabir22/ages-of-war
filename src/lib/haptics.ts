import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

async function triggerImpact(style: ImpactStyle): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await Haptics.impact({ style });
  } catch (e) {
    console.debug('[haptics]', e);
  }
}

export const hapticFeedback = {
  lightTap: () => triggerImpact(ImpactStyle.Light),
  unitSpawn: () => triggerImpact(ImpactStyle.Medium),
  castleHit: () => triggerImpact(ImpactStyle.Heavy),
  gameEnd: async () => {
    if (!Capacitor.isNativePlatform()) return;
    await triggerImpact(ImpactStyle.Heavy);
    window.setTimeout(() => void triggerImpact(ImpactStyle.Heavy), 100);
    window.setTimeout(() => void triggerImpact(ImpactStyle.Heavy), 200);
  },
  success: () => triggerImpact(ImpactStyle.Medium),
  warning: () => triggerImpact(ImpactStyle.Heavy),
  selection: () => triggerImpact(ImpactStyle.Light),
};
