import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

/** Combined vignette + subtle warm-tone post-effect applied after bloom. */
const VignetteContrastShader = {
  uniforms: {
    tDiffuse: { value: null as any },
    uVignetteStrength: { value: 0.55 },
    uVignetteRadius: { value: 0.85 },
    uContrast: { value: 1.06 },
    uWarmth: { value: 0.04 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uVignetteStrength;
    uniform float uVignetteRadius;
    uniform float uContrast;
    uniform float uWarmth;
    varying vec2 vUv;

    void main() {
      vec4 color = texture2D(tDiffuse, vUv);

      // Contrast pivoted around mid-grey for cinematic punch.
      color.rgb = (color.rgb - 0.5) * uContrast + 0.5;

      // Subtle warm/orange tint to lift midtones.
      color.r += uWarmth * 0.55;
      color.g += uWarmth * 0.18;
      color.b -= uWarmth * 0.20;

      // Smooth radial vignette darkening corners.
      vec2 centered = vUv - 0.5;
      float dist = length(centered);
      float vig = smoothstep(uVignetteRadius, uVignetteRadius - 0.55, dist);
      color.rgb *= mix(1.0 - uVignetteStrength, 1.0, vig);

      gl_FragColor = vec4(color.rgb, color.a);
    }
  `,
};

export interface PostProcessingState {
  composer: any;
  bloomPass: any;
  vignettePass: any;
  enabled: boolean;
  setSize: (w: number, h: number) => void;
  render: () => void;
  dispose: () => void;
}

export function createPostProcessing(
  renderer: any,
  scene: any,
  camera: any,
  initialW: number,
  initialH: number
): PostProcessingState {
  const composer = new EffectComposer(renderer);
  composer.setSize(initialW, initialH);

  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);

  // Bloom: emissive headlights, banner trims, projectile sparks pop.
  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(initialW, initialH),
    0.55, // strength
    0.7, // radius
    0.82 // threshold (only bright pixels bloom)
  );
  composer.addPass(bloomPass);

  // Vignette + contrast for depth and focus.
  const vignettePass = new ShaderPass(VignetteContrastShader);
  composer.addPass(vignettePass);

  return {
    composer,
    bloomPass,
    vignettePass,
    enabled: true,
    setSize: (w: number, h: number) => {
      composer.setSize(w, h);
      bloomPass.setSize?.(w, h);
    },
    render: () => composer.render(),
    dispose: () => {
      composer.dispose?.();
      bloomPass.dispose?.();
      vignettePass.material?.dispose?.();
    },
  };
}
