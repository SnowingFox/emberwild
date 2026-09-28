import * as THREE from 'three';
import { ATLAS_TILE_COUNT } from './ProceduralTextures';

export type MaterialBundle = {
  terrain: THREE.MeshStandardMaterial;
  water: THREE.ShaderMaterial;
  glow: THREE.MeshStandardMaterial;
  update(time: number, sunDirection: THREE.Vector3, fogColor: THREE.Color, cameraPosition: THREE.Vector3): void;
};

export function createMaterials(atlas: THREE.Texture): MaterialBundle {
  const terrain = new THREE.MeshStandardMaterial({
    map: atlas,
    roughness: 0.86,
    metalness: 0.02,
    vertexColors: true,
    alphaTest: 0.35,
    side: THREE.FrontSide,
  });

  let terrainShader: { uniforms: Record<string, { value: unknown }> } | null = null;
  terrain.onBeforeCompile = (shader) => {
    terrainShader = shader;
    shader.uniforms.uEmberTime = { value: 0 };
    shader.vertexShader = `attribute float aWind;\nuniform float uEmberTime;\n${shader.vertexShader}`;
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>\n      if (aWind > 0.5) {\n        float sway = sin(uEmberTime * 1.45 + transformed.y * 1.7 + transformed.z * 0.65) * 0.045;\n        transformed.x += sway * smoothstep(0.0, 1.0, transformed.y);\n        transformed.z += cos(uEmberTime * 1.1 + transformed.x * 1.4) * 0.028;\n      }`,
    );
    shader.fragmentShader = `uniform float uEmberTime;\n${shader.fragmentShader}`;
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <map_fragment>',
      `#include <map_fragment>\n      float emberPulse = 1.0;\n      if (diffuseColor.a > 0.1 && vNormal.y < 0.9) { emberPulse = 1.0; }`,
    );
  };
  terrain.customProgramCacheKey = () => 'emberwild-terrain-v2';

  const water = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uSunDirection: { value: new THREE.Vector3(0.4, 0.8, 0.2).normalize() },
      uSunColor: { value: new THREE.Color('#ffe2b4') },
      uFogColor: { value: new THREE.Color('#b5c8be') },
      uCameraPosition: { value: new THREE.Vector3() },
      uFogNear: { value: 45 },
      uFogFar: { value: 150 },
    },
    vertexShader: `
      uniform float uTime;
      varying vec3 vWorldPosition;
      varying vec3 vNormalWorld;
      void main() {
        vec3 transformed = position;
        float ripple = sin(position.x * 1.7 + uTime * 0.9) * 0.035 + cos(position.z * 1.25 + uTime * 0.7) * 0.028;
        transformed.y += ripple;
        vec4 worldPosition = modelMatrix * vec4(transformed, 1.0);
        vWorldPosition = worldPosition.xyz;
        vNormalWorld = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uSunDirection;
      uniform vec3 uSunColor;
      uniform vec3 uFogColor;
      uniform vec3 uCameraPosition;
      uniform float uFogNear;
      uniform float uFogFar;
      varying vec3 vWorldPosition;
      varying vec3 vNormalWorld;
      void main() {
        vec3 viewDirection = normalize(uCameraPosition - vWorldPosition);
        float fresnel = pow(1.0 - max(dot(viewDirection, normalize(vNormalWorld)), 0.0), 3.0);
        float sparkle = pow(max(dot(reflect(-normalize(uSunDirection), normalize(vNormalWorld)), viewDirection), 0.0), 18.0);
        vec3 deep = vec3(0.035, 0.18, 0.23);
        vec3 shallow = vec3(0.11, 0.39, 0.41);
        vec3 color = mix(deep, shallow, fresnel * 0.65 + 0.18);
        color += uSunColor * sparkle * 0.55;
        float distanceToCamera = distance(uCameraPosition, vWorldPosition);
        float fog = smoothstep(uFogNear, uFogFar, distanceToCamera);
        color = mix(color, uFogColor, fog * 0.72);
        gl_FragColor = vec4(color, 0.73);
      }
    `,
  });

  const glow = new THREE.MeshStandardMaterial({
    map: atlas,
    emissive: new THREE.Color('#ff8c4c'),
    emissiveIntensity: 1.8,
    roughness: 0.42,
    metalness: 0.08,
    vertexColors: true,
  });

  return {
    terrain,
    water,
    glow,
    update(time, sunDirection, fogColor, cameraPosition) {
      if (terrainShader) terrainShader.uniforms.uEmberTime.value = time;
      water.uniforms.uTime.value = time;
      water.uniforms.uSunDirection.value.copy(sunDirection);
      water.uniforms.uFogColor.value.copy(fogColor);
      water.uniforms.uCameraPosition.value.copy(cameraPosition);
    },
  };
}

export function tileUv(tile: number, u: number, v: number): { u: number; v: number } {
  const inset = 0.0015;
  return {
    u: (tile + Math.min(1 - inset, Math.max(inset, u))) / ATLAS_TILE_COUNT,
    v: Math.min(1 - inset, Math.max(inset, v)),
  };
}
