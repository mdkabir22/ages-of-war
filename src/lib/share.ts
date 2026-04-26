import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';

async function shareProgress(achievement: string, url = 'https://agesofwar.app'): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: 'Ages of War', text: achievement, url });
      } catch {
        /* dismissed */
      }
    }
    return;
  }
  try {
    await Share.share({
      title: 'Ages of War',
      text: achievement,
      url: `${url}?ref=share`,
      dialogTitle: 'Share your progress',
    });
  } catch {
    /* dismissed */
  }
}

export const shareActions = {
  shareAgeUp: (ageName: string) =>
    shareProgress(`I just reached the ${ageName} age in Ages of War! Can you beat my progress?`),
  shareVictory: (mode: string, kills: number) =>
    shareProgress(`Victory! ${kills} eliminations in ${mode} mode in Ages of War — join the fight!`),
  shareHighScore: (score: number) => shareProgress(`New high score: ${score} in Ages of War!`),
  shareLegendaryChest: () => shareProgress('Just opened a big reward chest in Ages of War!'),
  inviteFriend: () => shareProgress('Join me in Ages of War — castle siege strategy on mobile!'),
};
