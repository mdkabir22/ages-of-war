import * as THREE from 'three';

interface CameraRigState {
  camPosSmoothed: any;
  lookSmoothed: any;
  desiredCam: any;
  desiredLook: any;
  cameraSmoothedReady: boolean;
}

export function createCameraRigState(): CameraRigState {
  return {
    camPosSmoothed: new THREE.Vector3(),
    lookSmoothed: new THREE.Vector3(),
    desiredCam: new THREE.Vector3(),
    desiredLook: new THREE.Vector3(),
    cameraSmoothedReady: false,
  };
}

export function updateCameraRig(
  camera: any,
  state: CameraRigState,
  centerX: number,
  centerZ: number,
  dt: number
): void {
  // Cinematic isometric-style angle: closer + lower so units have presence
  // while still seeing a wide swath of the battlefield.
  state.desiredCam.set(centerX, 520, centerZ + 540);
  state.desiredLook.set(centerX, 0, centerZ - 40);
  const k = Math.min(1, dt * 7.5);

  if (!state.cameraSmoothedReady) {
    state.camPosSmoothed.copy(state.desiredCam);
    state.lookSmoothed.copy(state.desiredLook);
    state.cameraSmoothedReady = true;
  } else {
    state.camPosSmoothed.lerp(state.desiredCam, k);
    state.lookSmoothed.lerp(state.desiredLook, k);
  }

  camera.position.copy(state.camPosSmoothed);
  camera.lookAt(state.lookSmoothed);
}
