import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useGameStore } from '../core/state';
import { startEnemyAI } from './EnemyAI';
import { createCameraRigState } from './render3d/cameraRig';
import { createEffectsState, disposeAllEffects } from './render3d/effects3D';
import { start3DGameLoop } from './render3d/gameLoop';
import { setup3DInputHandlers } from './render3d/inputHandlers';
import { sync3DMeshes } from './render3d/meshSync';
import { createPostProcessing, type PostProcessingState } from './render3d/postprocessing';
import {
  buildForestTrees,
  buildMountainRange,
  buildTerrainFromMap,
  buildWaterSurface,
} from './render3d/terrainBuilders';
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
    // Sky-like gradient background + warmer distance fog for a paradise vibe.
    scene.background = new THREE.Color(0x9bcfe8);
    scene.fog = new THREE.Fog(0x9bcfe8, 1600, 7800);

    // Warmer hemisphere light: sky from above, soft green ground bounce.
    const hemi = new THREE.HemisphereLight(0xddeeff, 0x4d6b3a, 0.55);
    scene.add(hemi);

    const camera = new THREE.PerspectiveCamera(48, 1, 2, 12000);
    const cameraRef = { current: camera };

    const amb = new THREE.AmbientLight(0xb4c6e7, 0.36);
    scene.add(amb);
    const sun = new THREE.DirectionalLight(0xfff5e0, 1.05);
    // Position the sun relative to the (now larger) world center so shadows
    // fall consistently across the entire battlefield.
    sun.position.set(DEFAULT_MAP_WIDTH / 2 + 600, 1400, DEFAULT_MAP_HEIGHT / 2 - 400);
    sun.target.position.set(DEFAULT_MAP_WIDTH / 2, 0, DEFAULT_MAP_HEIGHT / 2);
    scene.add(sun.target);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 100;
    sun.shadow.camera.far = 5000;
    // Expanded shadow frustum to cover the whole 2400x1600 map.
    const shadowExtent = Math.max(DEFAULT_MAP_WIDTH, DEFAULT_MAP_HEIGHT) * 0.85;
    sun.shadow.camera.left = -shadowExtent;
    sun.shadow.camera.right = shadowExtent;
    sun.shadow.camera.top = shadowExtent;
    sun.shadow.camera.bottom = -shadowExtent;
    scene.add(sun);

    const terrain = useGameStore.getState().terrain;
    const terrainBuilt = buildTerrainFromMap(terrain);
    scene.add(terrainBuilt.mesh);

    const forestBuilt = buildForestTrees(terrain);
    if (forestBuilt) scene.add(forestBuilt.mesh);

    const mountainBuilt = buildMountainRange(terrain);
    if (mountainBuilt) scene.add(mountainBuilt.mesh);

    const waterBuilt = buildWaterSurface(terrain);
    if (waterBuilt) scene.add(waterBuilt.mesh);

    // Grid helper removed: with the new continuous terrain texture the
    // dark grid lines were the only thing still revealing the underlying
    // tile structure, making the world look mechanically tiled.

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
    // 3D-only camera pan offset (world units), independent of state.camera
    // which the 2D renderer uses with different (top-left scroll) semantics.
    const panOffsetRef = { current: { x: 0, y: 0 } };
    // Initialize postprocessing lazily — guarded so a shader compile failure
    // doesn't block the entire 3D pipeline. We default to a 1x1 size and let
    // layoutSize resize it on the first frame.
    let postFx: PostProcessingState | null = null;
    try {
      postFx = createPostProcessing(renderer, scene, camera, 1, 1);
    } catch (err) {
      console.warn('[GameCanvas3D] postprocessing unavailable, falling back to direct render', err);
      postFx = null;
    }

    const layoutSize = () => {
      const vv = window.visualViewport;
      const w = Math.max(1, Math.round(vv?.width ?? window.innerWidth));
      const h = Math.max(1, Math.round(vv?.height ?? window.innerHeight));
      if (renderer.domElement.width !== w || renderer.domElement.height !== h) {
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        postFx?.setSize(w, h);
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

    const inputController = setup3DInputHandlers(
      canvasEl,
      pausedRef,
      cameraRef,
      { buildingVisualSize: BUILDING_VISUAL_SIZE, tilePlace: TILE_PLACE },
      panOffsetRef
    );

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
      postFx,
      overlayCtx: overlayCtx ?? null,
      getSelectionBox: inputController.getSelectionBox,
      getTouchIndicator: inputController.getTouchIndicator,
      panOffsetRef,
    });

    return () => {
      stopLoop();
      inputController.cleanup();
      window.removeEventListener('resize', resize);
      window.visualViewport?.removeEventListener('resize', resize);
      window.visualViewport?.removeEventListener('scroll', resize);
      window.clearInterval(economyId);
      stopEnemyAI();

      postFx?.dispose();
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
      if (mountainBuilt) {
        scene.remove(mountainBuilt.mesh);
        mountainBuilt.dispose();
      }
      if (waterBuilt) {
        scene.remove(waterBuilt.mesh);
        waterBuilt.dispose();
      }
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
