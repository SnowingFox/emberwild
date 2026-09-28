import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { createBlockAtlas } from './ProceduralTextures';
import { createMaterials, MaterialBundle } from './Materials';

export class SceneRenderer {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(72, 1, 0.1, 220);
  readonly renderer: THREE.WebGLRenderer;
  readonly materials: MaterialBundle;
  readonly sun = new THREE.DirectionalLight('#ffe0b2', 3.4);
  readonly ambient = new THREE.HemisphereLight('#b9d8da', '#17261c', 1.55);
  readonly composer: EffectComposer;
  readonly bloom: UnrealBloomPass;
  readonly sky = new THREE.Mesh();
  private readonly skyMaterial: THREE.ShaderMaterial;
  private readonly fillLight = new THREE.PointLight('#e6834b', 1.5, 18, 2);
  private renderScale = 1;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.65));

    this.scene.fog = new THREE.Fog('#9bb3b1', 38, 156);
    this.scene.background = new THREE.Color('#9bb3b1');

    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.left = -52;
    this.sun.shadow.camera.right = 52;
    this.sun.shadow.camera.top = 52;
    this.sun.shadow.camera.bottom = -52;
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 160;
    this.sun.shadow.bias = -0.00018;
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);
    this.scene.add(this.ambient);

    this.fillLight.position.set(0, 30, 0);
    this.scene.add(this.fillLight);

    this.skyMaterial = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        uTop: { value: new THREE.Color('#6b9bb1') },
        uHorizon: { value: new THREE.Color('#e6c29a') },
        uBottom: { value: new THREE.Color('#6f7c71') },
        uSunDirection: { value: new THREE.Vector3(0.25, 0.7, 0.3).normalize() },
        uSunColor: { value: new THREE.Color('#ffd2a2') },
        uTime: { value: 0 },
      },
      vertexShader: `varying vec3 vDirection; void main() { vec4 worldPosition = modelMatrix * vec4(position, 1.0); vDirection = normalize(worldPosition.xyz - cameraPosition); gl_Position = projectionMatrix * viewMatrix * worldPosition; }`,
      fragmentShader: `
        uniform vec3 uTop; uniform vec3 uHorizon; uniform vec3 uBottom; uniform vec3 uSunDirection; uniform vec3 uSunColor; uniform float uTime;
        varying vec3 vDirection;
        void main() {
          float height = clamp(vDirection.y * 0.5 + 0.5, 0.0, 1.0);
          vec3 sky = mix(uBottom, uHorizon, smoothstep(0.0, 0.48, height));
          sky = mix(sky, uTop, smoothstep(0.42, 1.0, height));
          float sunGlow = pow(max(dot(vDirection, uSunDirection), 0.0), 18.0);
          float haze = pow(max(dot(vDirection, uSunDirection), 0.0), 2.0);
          sky += uSunColor * sunGlow * 0.5 + uSunColor * haze * 0.06;
          gl_FragColor = vec4(sky, 1.0);
        }
      `,
    });
    this.sky.geometry = new THREE.SphereGeometry(180, 32, 16);
    this.sky.material = this.skyMaterial;
    this.scene.add(this.sky);

    const atlas = createBlockAtlas();
    this.materials = createMaterials(atlas);

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.24, 0.52, 1.16);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());

    window.addEventListener('resize', () => this.resize());
    this.resize();
  }

  updateEnvironment(timeOfDay: number, elapsed: number, focus: THREE.Vector3): { fogColor: THREE.Color; sunDirection: THREE.Vector3; label: string } {
    const angle = timeOfDay * Math.PI * 2 - Math.PI * 0.5;
    const sunDirection = new THREE.Vector3(Math.cos(angle), Math.sin(angle), 0.28).normalize();
    const daylight = THREE.MathUtils.clamp(sunDirection.y * 0.5 + 0.55, 0.12, 1);
    const dawn = THREE.MathUtils.smoothstep(sunDirection.y, -0.2, 0.55);
    const fogColor = new THREE.Color().lerpColors(new THREE.Color('#172b35'), new THREE.Color('#b1c4bc'), daylight);
    const skyTop = new THREE.Color().lerpColors(new THREE.Color('#081522'), new THREE.Color('#5c98b1'), daylight);
    const skyHorizon = new THREE.Color().lerpColors(new THREE.Color('#2b3345'), new THREE.Color('#edc096'), daylight);
    const skyBottom = new THREE.Color().lerpColors(new THREE.Color('#10191d'), new THREE.Color('#778d7d'), daylight);

    this.scene.background = fogColor;
    (this.scene.fog as THREE.Fog).color.copy(fogColor);
    (this.skyMaterial.uniforms.uTop.value as THREE.Color).copy(skyTop);
    (this.skyMaterial.uniforms.uHorizon.value as THREE.Color).copy(skyHorizon);
    (this.skyMaterial.uniforms.uBottom.value as THREE.Color).copy(skyBottom);
    (this.skyMaterial.uniforms.uSunDirection.value as THREE.Vector3).copy(sunDirection);
    (this.skyMaterial.uniforms.uSunColor.value as THREE.Color).set('#ffd2a2');
    this.skyMaterial.uniforms.uTime.value = elapsed;

    this.sun.position.copy(focus).addScaledVector(sunDirection, 58);
    this.sun.target.position.copy(focus);
    this.sun.intensity = 0.35 + daylight * 3.15;
    this.ambient.intensity = 0.56 + daylight * 1.16;
    this.ambient.color.copy(new THREE.Color().lerpColors(new THREE.Color('#34466c'), new THREE.Color('#b9d8da'), daylight));
    this.ambient.groundColor.copy(new THREE.Color().lerpColors(new THREE.Color('#080e16'), new THREE.Color('#1b2a20'), daylight));
    this.fillLight.position.set(focus.x + 2, focus.y + 1, focus.z + 2);
    this.fillLight.intensity = Math.max(0.1, (1 - daylight) * 1.5);
    this.materials.update(elapsed, sunDirection, fogColor, this.camera.position);

    const hour = (timeOfDay * 24 + 24) % 24;
    const hourText = `${String(Math.floor(hour)).padStart(2, '0')}:${String(Math.floor((hour % 1) * 60)).padStart(2, '0')}`;
    const label = hour < 5 || hour > 20 ? `NIGHT  ·  ${hourText}` : hour < 8 ? `DAWN  ·  ${hourText}` : hour > 17 ? `DUSK  ·  ${hourText}` : `DAY 01  ·  ${hourText}`;
    return { fogColor, sunDirection, label };
  }

  render(): void {
    this.composer.render();
  }

  resize(): void {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width * this.renderScale, height * this.renderScale, false);
    this.composer.setSize(width * this.renderScale, height * this.renderScale);
  }

  setQuality(quality: 'cinematic' | 'balanced'): void {
    this.renderScale = quality === 'cinematic' ? 1 : 0.82;
    this.renderer.setPixelRatio(quality === 'cinematic' ? Math.min(window.devicePixelRatio, 1.65) : Math.min(window.devicePixelRatio, 1.15));
    this.bloom.strength = quality === 'cinematic' ? 0.24 : 0.12;
    this.resize();
  }
}
