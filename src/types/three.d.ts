declare module 'three' {
  const THREE: any;
  export = THREE;
}

// Individual JSM postprocessing modules — declared with `export const X: any`
// so consumers can use named imports (the wildcard form below uses `export =`
// which can't expose named exports).
declare module 'three/examples/jsm/postprocessing/EffectComposer.js' {
  export const EffectComposer: any;
}

declare module 'three/examples/jsm/postprocessing/RenderPass.js' {
  export const RenderPass: any;
}

declare module 'three/examples/jsm/postprocessing/UnrealBloomPass.js' {
  export const UnrealBloomPass: any;
}

declare module 'three/examples/jsm/postprocessing/ShaderPass.js' {
  export const ShaderPass: any;
}

declare module 'three/examples/jsm/postprocessing/OutputPass.js' {
  export const OutputPass: any;
}

// Catch-all for any other JSM helper we may pull in later (loaders, controls).
declare module 'three/examples/jsm/*' {
  const value: any;
  export = value;
}

declare module 'three/addons/*' {
  const value: any;
  export = value;
}
