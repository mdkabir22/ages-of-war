import { AGES } from '../game/ages';

function preloadAudioFiles(files: string[]): Promise<void[]> {
  return Promise.all(
    files.map(
      (file) =>
        new Promise<void>((resolve, reject) => {
          const audio = new Audio();
          audio.addEventListener('canplaythrough', () => resolve(), { once: true });
          audio.addEventListener('error', () => reject(new Error(file)), { once: true });
          audio.src = file;
          audio.load();
        })
    )
  );
}

function preloadImageUrls(urls: string[]): Promise<void[]> {
  return Promise.all(
    urls.map(
      (url) =>
        new Promise<void>((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve();
          img.onerror = () => reject(new Error(url));
          img.src = url;
        })
    )
  );
}

/** Collect first-age + shared UI assets (Web Audio is procedural — no MP3 list required). */
export function collectCriticalImageUrls(): string[] {
  const urls: string[] = ['/assets/ui/title-bg.jpg'];
  for (const age of AGES) {
    urls.push(age.bgImage, age.castleImage);
    for (const u of age.units) urls.push(u.image);
  }
  return [...new Set(urls)];
}

export async function preloadCriticalAssets(onProgress?: (percent: number) => void): Promise<void> {
  const images = collectCriticalImageUrls();
  const audio: string[] = [];
  const total = images.length + audio.length || 1;
  let done = 0;
  const bump = () => {
    done++;
    onProgress?.(Math.min(100, (done / total) * 100));
  };

  await Promise.all([
    ...audio.map((f) => preloadAudioFiles([f]).then(bump).catch(bump)),
    ...images.map((u) => preloadImageUrls([u]).then(bump).catch(bump)),
  ]);
}
