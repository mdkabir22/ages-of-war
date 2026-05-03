declare module 'three' {
  const THREE: any;
  export = THREE;
}

// Wildcard for all three example/jsm helper modules (postprocessing, loaders, controls).
declare module 'three/examples/jsm/*' {
  const value: any;
  export = value;
}

declare module 'three/addons/*' {
  const value: any;
  export = value;
}
