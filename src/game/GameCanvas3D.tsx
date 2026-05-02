import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useGameStore } from '../core/state';
import { startEnemyAI } from './EnemyAI';
import { createCameraRigState } from './render3d/cameraRig';
import { createEffectsState, disposeAllEffects } from './render3d/effects3D';
import { start3DGameLoop } from './render3d/gameLoop';
import { setup3DInputHandlers } from './render3d/inputHandlers';
import { sync3DMeshes } from './render3d/meshSync';
import { buildForestTrees, buildTerrainFromMap, buildWaterSurface } from './render3d/terrainBuilders';
import {
  DEFAULT_MAP_HEIGHT,
  DEFAULT_MAP_WIDTH,
} from '../core/map';
import { audio } from '../audio/manager';

/** Fog grid matches GameCanvas / engine/state */
const FOG_TILE_SIZE = 40;
const BUILDING_VISUAL_SIZE = 48;
const TILE_PLACE = 40;

interface GameCanvas3DProps {
  paused?: boolean;
}

export function GameCanvas3D({ paused = false }: GameCanvas3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const pausedRef = useRef(paused);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    void audio.preload();
    const container = containerRef.current;
    if (!container) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.06;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    const overlayCanvas = overlayRef.current;
    const overlayCtx = overlayCanvas?.getContext('2d');

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x64748b);
    scene.fog = new THREE.Fog(0x64748b, 900, 5200);

    const hemi = new THREE.HemisphereLight(0xc9e8ff, 0x334155, 0.42);
    scene.add(hemi);

    const camera = new THREE.PerspectiveCamera(48, 1, 2, 12000);
    const cameraRef = { current: camera };

    const amb = new THREE.AmbientLight(0xb4c6e7, 0.36);
    scene.add(amb);
    const sun = new THREE.DirectionalLight(0xfff5e0, 1.05);
    sun.position.set(420, 900, 280);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 100;
    sun.shadow.camera.far = 3200;
    sun.shadow.camera.left = -1400;
    sun.shadow.camera.right = 1400;
    sun.shadow.camera.top = 1400;
    sun.shadow.camera.bottom = -1400;
    scene.add(sun);

    const terrain = useGameStore.getState().terrain;
    const terrainBuilt = buildTerrainFromMap(terrain);
    scene.add(terrainBuilt.mesh);

    const forestBuilt = buildForestTrees(terrain);
    if (forestBuilt) scene.add(forestBuilt.mesh);

    const waterBuilt = buildWaterSurface(terrain);
    if (waterBuilt) scene.add(waterBuilt.mesh);

    const grid = new THREE.GridHelper(
      Math.max(DEFAULT_MAP_WIDTH, DEFAULT_MAP_HEIGHT),
      32,
      0x1e293b,
      0x0f172a
    );
    grid.position.set(DEFAULT_MAP_WIDTH / 2, 0.02, DEFAULT_MAP_HEIGHT / 2);
    (grid.material as { transparent?: boolean; opacity?: number }).transparent = true;
    (grid.material as { opacity?: number }).opacity = 0.18;
    scene.add(grid);

    const terrainGridHelper = grid;

    const unitMeshes = new Map<string, any>();
    const buildingMeshes = new Map<string, any>();
    const selectionRings = new Map<string, any>();

    const ringGeo = new THREE.RingGeometry(18, 26, 52);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xfbbf24,
      transparent: true,
      opacity: 0.88,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    const cameraRigState = createCameraRigState();
    const effectsState = createEffectsState(scene);

    const layoutSize = () => {
      const vv = window.visualViewport;
      const w = Math.max(1, Math.round(vv?.width ?? window.innerWidth));
      const h = Math.max(1, Math.round(vv?.height ?? window.innerHeight));
      if (renderer.domElement.width !== w || renderer.domElement.height !== h) {
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      }
      if (overlayCanvas && overlayCtx) {
        overlayCanvas.width = w;
        overlayCanvas.height = h;
      }
    };

    const canvasEl = renderer.domElement;
    canvasEl.style.display = 'block';
    canvasEl.style.width = '100%';
    canvasEl.style.height = '100%';

    const inputController = setup3DInputHandlers(canvasEl, pausedRef, cameraRef, {
      buildingVisualSize: BUILDING_VISUAL_SIZE,
      tilePlace: TILE_PLACE,
    });

    const economyId = window.setInterval(() => {
      const state = useGameStore.getState();
      state.tickEconomy();
      state.tickMissionTime(1);
    }, 1000);

    const stopEnemyAI = startEnemyAI(
      () => useGameStore.getState(),
      (updater) => useGameStore.setState((prev) => updater(prev))
    );

    const resize = () => layoutSize();
    window.addEventListener('resize', resize);
    window.visualViewport?.addEventListener('resize', resize);
    window.visualViewport?.addEventListener('scroll', resize);

    const syncMeshes = () =>
      sync3DMeshes({
        fogTileSize: FOG_TILE_SIZE,
        scene,
        unitMeshes,
        buildingMeshes,
        selectionRings,
        ringGeo,
        ringMat,
        effects: effectsState,
      });

    layoutSize();
    const stopLoop = start3DGameLoop({
      layoutSize,
      pausedRef,
      scene,
      renderer,
      camera,
      cameraRef,
      cameraRigState,
      waterMesh: waterBuilt?.mesh ?? null,
      syncMeshes,
      effects: effectsState,
      overlayCtx: overlayCtx ?? null,
      getSelectionBox: inputController.getSelectionBox,
      getTouchIndicator: inputController.getTouchIndicator,
    });

    return () => {
      stopLoop();
      inputController.cleanup();
      window.removeEventListener('resize', resize);
      window.visualViewport?.removeEventListener('resize', resize);
      window.visualViewport?.removeEventListener('scroll', resize);
      window.clearInterval(economyId);
      stopEnemyAI();

      disposeAllEffects(effectsState);
      unitMeshes.forEach((entry) => {
        scene.remove(entry.group);
        entry.geometries.forEach((g: { dispose?: () => void }) => g.dispose?.());
        entry.materials.forEach((m: { dispose?: () => void }) => m.dispose?.());
      });
      unitMeshes.clear();
      buildingMeshes.forEach((entry) => {
        scene.remove(entry.group);
        entry.geometries.forEach((g: { dispose?: () => void }) => g.dispose?.());
        entry.materials.forEach((m: { dispose?: () => void }) => m.dispose?.());
      });
      buildingMeshes.clear();
      selectionRings.forEach((ring) => {
        scene.remove(ring);
        ring.material.dispose();
      });
      selectionRings.clear();
      ringGeo.dispose();
      ringMat.dispose();

      terrainBuilt.dispose();
      if (forestBuilt) {
        scene.remove(forestBuilt.mesh);
        forestBuilt.dispose();
      }
      if (waterBuilt) {
        scene.remove(waterBuilt.mesh);
        waterBuilt.dispose();
      }
      scene.remove(terrainGridHelper);
      terrainGridHelper.geometry.dispose();
      const gm = terrainGridHelper.material;
      if (Array.isArray(gm)) gm.forEach((m) => m.dispose());
      else gm.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div ref={containerRef} className="relative h-full w-full touch-none">
      <canvas
        ref={overlayRef}
        className="pointer-events-none absolute inset-0 z-10 block h-full w-full"
        aria-hidden
      />
    </div>
  );
}
