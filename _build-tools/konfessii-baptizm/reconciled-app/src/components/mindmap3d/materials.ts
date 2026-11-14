import * as THREE from 'three';

export function createPremiumMaterial(
  hex: string,
  overrides: Partial<THREE.MeshPhysicalMaterialParameters> = {},
): THREE.MeshPhysicalMaterial {
  const color = new THREE.Color(hex);
  return new THREE.MeshPhysicalMaterial({
    color,
    roughness: 0.22,
    metalness: 0.75,
    clearcoat: 0.8,
    clearcoatRoughness: 0.12,
    emissive: color,
    emissiveIntensity: 0.3,
    envMapIntensity: 1.2,
    ...overrides,
  });
}

export function createGlowMaterial(hex: string, opacity = 0.7): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color: new THREE.Color(hex),
    transparent: true,
    opacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
}