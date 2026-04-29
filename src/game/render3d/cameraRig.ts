import * as THREE from 'three';

interface CameraRigState {
  camPosSmoothed: THREE.Vector3;
  lookSmoothed: THREE.Vector3;
  desiredCam: THREE.Vector3;
  desiredLook: THREE.Vector3;
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
  camera: THREE.PerspectiveCamera,
  state: CameraRigState,
  centerX: number,
  centerZ: number,
  dt: number
): void {
  state.desiredCam.set(centerX, 620, centerZ + 480);
  state.desiredLook.set(centerX, 0, centerZ);
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
