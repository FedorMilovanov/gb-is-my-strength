declare module 'react-force-graph-3d' {
  const ForceGraph3D: any;
  export default ForceGraph3D;
}

declare module 'three-spritetext' {
  import * as THREE from 'three';

  export default class SpriteText extends THREE.Sprite {
    constructor(text?: string);
    text: string;
    color: string;
    textHeight: number;
    fontFace: string;
    fontWeight: string;
    padding: number;
    borderRadius: number;
    backgroundColor: string;
    strokeColor: string;
    strokeWidth: number;
  }
}
