/**
 * Kiko Dash — 3D mode.
 * WebGL diorama: AgX tone mapping, half-float bloom, soft shadows,
 * a room environment for the rings, and a hand-built Japanese Chin.
 * Loaded only when the 3D mode button is pressed.
 */
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

const KX = -2.55;
const LEVEL_M = 250;

const LEVELS = [
  {
    name: "ST ALBANS",
    skyTop: "#5b8fd6", skyMid: "#c9daf6", skyBot: "#f6e3c6",
    fog: "#ddc9a4", sun: "#ffe0a2", cloud: "#fffaf2",
    ground: "#c9b48c", verge: "#5c7a44", runner: "#fff8ee", gold: "#b8924a",
    cloudAmt: 0.5, sunPos: [0.78, 0.7], sunSoft: 18,
    sunIntensity: 1.65, hemi: 0.42, fill: 0.62, exposure: 1.02,
    bloom: 0.2, bloomAt: 1.15, theme: "day", kinds: ["seal", "envelope", "hyd"]
  },
  {
    name: "PALACE GARDENS",
    skyTop: "#e7b56a", skyMid: "#f6d7a4", skyBot: "#d5e3c4",
    fog: "#d7c49a", sun: "#ff9a3c", cloud: "#fff1dc",
    ground: "#c6ae7c", verge: "#6e934e", runner: "#fff6e6", gold: "#c4963e",
    cloudAmt: 0.28, sunPos: [0.18, 0.62], sunSoft: 12,
    sunIntensity: 1.75, hemi: 0.4, fill: 0.5, exposure: 1.04,
    bloom: 0.26, bloomAt: 1.05, theme: "day", kinds: ["cake", "gift", "hyd", "seal"]
  },
  {
    name: "VINKOPLENTINNA",
    skyTop: "#2e2448", skyMid: "#6a5584", skyBot: "#c9b4d6",
    fog: "#b5a4c8", sun: "#f2c7a4", cloud: "#ead6f2",
    ground: "#b4a0c4", verge: "#8a7a9e", runner: "#f4e7f2", gold: "#e6c56a",
    cloudAmt: 0.32, sunPos: [0.74, 0.58], sunSoft: 22,
    sunIntensity: 1.15, hemi: 0.5, fill: 0.55, exposure: 1.06,
    bloom: 0.5, bloomAt: 0.72, theme: "dusk", kinds: ["wreath", "flute", "envelope"]
  },
  {
    name: "AFTER PARTY",
    skyTop: "#070914", skyMid: "#14182e", skyBot: "#1a1e34",
    fog: "#121626", sun: "#d5def8", cloud: "#2a3354",
    ground: "#171b2e", verge: "#121626", runner: "#2a314c", gold: "#f4c64d",
    cloudAmt: 0.12, sunPos: [0.16, 0.78], sunSoft: 36,
    sunIntensity: 0.32, hemi: 0.2, fill: 0.85, exposure: 1.18,
    bloom: 0.72, bloomAt: 0.42, theme: "night", kinds: ["flute", "cake", "gift", "seal"]
  }
];

function hexColors(level){
  const o = {};
  for(const k of ["skyTop","skyMid","skyBot","fog","sun","cloud","ground","verge","runner","gold"]){
    o[k] = new THREE.Color(level[k]);
  }
  return o;
}

function sealTexture(){
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d");
  g.fillStyle = "#c6a15a";
  g.beginPath(); g.arc(128, 128, 128, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#f6edd4";
  g.beginPath(); g.arc(128, 128, 102, 0, Math.PI * 2); g.fill();
  g.strokeStyle = "#8a6f3f"; g.lineWidth = 8;
  g.beginPath(); g.arc(128, 128, 102, 0, Math.PI * 2); g.stroke();
  g.fillStyle = "#8a6f3f";
  g.font = "700 62px Georgia, serif";
  g.textAlign = "center"; g.textBaseline = "middle";
  g.fillText("K · M", 128, 134);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function softDisc(){
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d");
  const grd = g.createRadialGradient(64, 64, 4, 64, 64, 64);
  grd.addColorStop(0, "rgba(255,255,255,0.9)");
  grd.addColorStop(0.45, "rgba(255,255,255,0.28)");
  grd.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createKiko3D(wrap, hooks){
  hooks = hooks || {};
  wrap.querySelectorAll("#kiko-canvas-3d, .kd-overlay").forEach(n => n.remove());
  const fancy = Math.min(window.innerWidth, window.innerHeight) >= 700;
  const canvas = document.createElement("canvas");
  canvas.id = "kiko-canvas-3d";
  canvas.setAttribute("aria-label", "Kiko Dash in 3D. Space or up to jump, down to duck.");
  wrap.appendChild(canvas);

  const overlay = document.createElement("div");
  overlay.className = "kd-overlay";
  overlay.innerHTML = '<div class="kd-ov-card" hidden><div class="kd-ov-kicker"></div><div class="kd-ov-title"></div></div>';
  wrap.appendChild(overlay);
  const card = overlay.querySelector(".kd-ov-card");
  const kickEl = overlay.querySelector(".kd-ov-kicker");
  const titleEl = overlay.querySelector(".kd-ov-title");

  const renderer = new THREE.WebGLRenderer({
    canvas, antialias: true, alpha: false, powerPreference: "high-performance"
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.AgXToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor(0xe6d8c2, 1);

  const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0xddc9a4, 18, 46);
  const camera = new THREE.PerspectiveCamera(27, 1, 0.08, 90);

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.5;
  pmrem.dispose();

  const sun = new THREE.DirectionalLight(0xfff1d4, 2.35);
  sun.position.set(-2.5, 9.5, 7.5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(fancy ? 2048 : 1024, fancy ? 2048 : 1024);
  sun.shadow.camera.left = -12;
  sun.shadow.camera.right = 12;
  sun.shadow.camera.top = 8;
  sun.shadow.camera.bottom = -6;
  sun.shadow.camera.near = 0.5;
  sun.shadow.camera.far = 30;
  sun.shadow.bias = -0.0003;
  sun.shadow.normalBias = 0.04;
  scene.add(sun, sun.target);
  sun.target.position.set(-2, 0.4, 0);

  const hemi = new THREE.HemisphereLight(0xfff6e8, 0x8ea4c8, 0.78);
  scene.add(hemi);
  const fill = new THREE.DirectionalLight(0xfff4e8, 0.48);
  fill.position.set(-6, 3.2, 8);
  scene.add(fill);

  const spots = [];
  const disco = new THREE.Group();
  disco.position.set(1.2, 4.15, -1.4);
  const ball = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.46, 1),
    new THREE.MeshPhysicalMaterial({
      color: 0xffffff, metalness: 1, roughness: 0.06, envMapIntensity: 1.6, clearcoat: 1
    })
  );
  ball.castShadow = true;
  disco.add(ball);
  const spotCols = [0xf4c64d, 0x93a8d8, 0xe88aa0];
  spotCols.forEach((col, i)=>{
    const spot = new THREE.SpotLight(col, 0, 16, 0.42, 0.55, 1.1);
    const ang = (i / 3) * Math.PI * 2;
    spot.position.set(Math.cos(ang) * 0.2, -0.05, Math.sin(ang) * 0.2);
    const target = new THREE.Object3D();
    target.position.set(Math.cos(ang) * 5, -3.6, Math.sin(ang) * 2.4);
    disco.add(spot, target);
    spot.target = target;
    spots.push(spot);
  });
  scene.add(disco);

  const candles = [];
  for(let i = 0; i < 2; i++){
    const p = new THREE.PointLight(0xf4c64d, 0, 7, 2);
    p.position.set(i === 0 ? -1 : 6, 1.7, -2.2);
    scene.add(p);
    candles.push(p);
  }

  const skyMat = new THREE.ShaderMaterial({
    uniforms: {
      uTop: { value: new THREE.Color() },
      uMid: { value: new THREE.Color() },
      uBot: { value: new THREE.Color() },
      uSun: { value: new THREE.Color() },
      uCloud: { value: new THREE.Color() },
      uSunPos: { value: new THREE.Vector2(0.78, 0.62) },
      uSunSoft: { value: 18 },
      uCloudAmt: { value: 0.5 },
      uTime: { value: 0 },
      uEye: { value: new THREE.Vector3() }
    },
    side: THREE.BackSide,
    depthWrite: false,
    vertexShader: `
      varying vec3 vDir;
      void main(){
        vec4 w = modelMatrix * vec4(position, 1.0);
        vDir = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }
    `,
    fragmentShader: `
      varying vec3 vDir;
      uniform vec3 uTop, uMid, uBot, uSun, uCloud;
      uniform vec2 uSunPos;
      uniform float uSunSoft, uCloudAmt, uTime;
      uniform vec3 uEye;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p){
        vec2 i = floor(p); vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i+vec2(1.0,0.0)), u.x),
                   mix(hash(i+vec2(0.0,1.0)), hash(i+vec2(1.0,1.0)), u.x), u.y);
      }
      void main(){
        vec3 dir = normalize(vDir - uEye);
        float h = clamp(dir.y * 2.4 + 0.78, 0.0, 1.0);
        vec3 col = mix(uBot, uMid, smoothstep(0.0, 0.28, h));
        col = mix(col, uTop, smoothstep(0.22, 0.8, h));
        vec2 suv = vec2(atan(dir.z, dir.x) / 6.28318 + 0.5, h);
        float d = distance(suv, uSunPos);
        col += uSun * exp(-d * d * uSunSoft);
        float hor = exp(-pow((h - 0.22) * 7.0, 2.0));
        col += uSun * hor * 0.22;
        vec2 cuv = vec2(suv.x * 4.0 + uTime * 0.012, h * 2.2);
        float n = noise(cuv) + 0.5 * noise(cuv * 2.15 + 3.0);
        float cloud = smoothstep(0.55, 0.88, n) * smoothstep(0.35, 0.7, h) * (1.0 - smoothstep(0.88, 1.0, h));
        col = mix(col, uCloud, cloud * uCloudAmt);
        gl_FragColor = vec4(col, 1.0);
      }
    `
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(55, 28, 18), skyMat);
  sky.frustumCulled = false;
  sky.renderOrder = -1;
  scene.add(sky);

  const groundMat = new THREE.ShaderMaterial({
    uniforms: {
      uVerge: { value: new THREE.Color() },
      uRunner: { value: new THREE.Color() },
      uGold: { value: new THREE.Color() },
      uFog: { value: new THREE.Color() },
      uScroll: { value: 0 },
      uCam: { value: new THREE.Vector3() },
      uFogNear: { value: 20 },
      uFogFar: { value: 48 }
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vWorld;
      void main(){
        vUv = uv;
        vec4 w = modelMatrix * vec4(position, 1.0);
        vWorld = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      varying vec3 vWorld;
      uniform vec3 uVerge, uRunner, uGold, uFog;
      uniform float uScroll, uFogNear, uFogFar;
      uniform vec3 uCam;
      void main(){
        float across = abs(vUv.y - 0.5);
        float aisle = smoothstep(0.22, 0.11, across);
        float stitch = smoothstep(0.016, 0.0, abs(across - 0.15));
        float thread = step(0.42, fract(vUv.x * 36.0 + uScroll));
        vec3 col = mix(uVerge, uRunner, aisle);
        col = mix(col, uGold, stitch * (0.8 + thread * 0.7));
        float n = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
        col += (n - 0.5) * 0.035;
        float fogF = smoothstep(uFogNear, uFogFar, distance(vWorld, uCam));
        col = mix(col, uFog, fogF);
        gl_FragColor = vec4(col, 1.0);
      }
    `
  });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(110, 42), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(8, 0, -1);
  ground.receiveShadow = true;
  scene.add(ground);

  const blobMap = softDisc();
  const blob = new THREE.Mesh(
    new THREE.PlaneGeometry(1.5, 1.5),
    new THREE.MeshBasicMaterial({ map: blobMap, transparent: true, depthWrite: false, color: 0x2a3148 })
  );
  blob.rotation.x = -Math.PI / 2;
  blob.position.y = 0.025;
  scene.add(blob);

  const fur = new THREE.MeshPhysicalMaterial({
    color: 0xfffaf3, roughness: 0.7, sheen: 1, sheenRoughness: 0.4,
    sheenColor: new THREE.Color(0xfff0dc)
  });
  const ink = new THREE.MeshPhysicalMaterial({
    color: 0x1b2032, roughness: 0.55, sheen: 0.3, sheenColor: new THREE.Color(0x3a4464)
  });
  const goldMat = new THREE.MeshPhysicalMaterial({
    color: 0xf4d58a, metalness: 1, roughness: 0.16,
    emissive: 0xe8b84a, emissiveIntensity: 0.9,
    clearcoat: 0.45, clearcoatRoughness: 0.18, envMapIntensity: 1.35
  });
  const eyeMat = new THREE.MeshPhysicalMaterial({
    color: 0x0e1016, roughness: 0.05, metalness: 0.08, clearcoat: 1, clearcoatRoughness: 0.04
  });
  const noseMat = new THREE.MeshPhysicalMaterial({ color: 0x2a211c, roughness: 0.32, clearcoat: 0.7 });
  const catchMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

  function mesh(parent, geo, mat, x, y, z, sx, sy, sz, shadow){
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    if(sx) m.scale.set(sx, sy, sz);
    m.castShadow = shadow !== false;
    m.receiveShadow = shadow !== false;
    parent.add(m);
    return m;
  }

  const kiko = new THREE.Group();
  mesh(kiko, new THREE.SphereGeometry(0.42, 36, 28), fur, 0, 0.62, 0, 1.35, 0.78, 0.98);
  mesh(kiko, new THREE.SphereGeometry(0.28, 24, 18), ink, -0.04, 0.8, 0, 1.2, 0.48, 0.82);
  mesh(kiko, new THREE.SphereGeometry(0.22, 20, 14), fur, 0.28, 0.52, 0.05, 1.05, 0.8, 0.9);
  const head = new THREE.Group();
  head.position.set(0.46, 0.98, 0.02);
  kiko.add(head);
  mesh(head, new THREE.SphereGeometry(0.32, 36, 28), fur, 0.02, 0, 0, 1.08, 0.96, 1.05);
  mesh(head, new THREE.SphereGeometry(0.15, 20, 14), fur, 0.22, -0.06, 0.02, 1.15, 0.7, 1.05);
  mesh(head, new THREE.SphereGeometry(0.045, 14, 12), noseMat, 0.36, -0.05, 0.02, 1, 1, 1);
  mesh(head, new THREE.SphereGeometry(0.13, 16, 12), ink, -0.02, 0.24, 0.16, 0.65, 1.45, 0.5);
  mesh(head, new THREE.SphereGeometry(0.13, 16, 12), ink, -0.02, 0.24, -0.14, 0.65, 1.45, 0.5);
  mesh(head, new THREE.SphereGeometry(0.085, 14, 10), ink, 0.14, 0.03, 0.22, 0.9, 1.1, 0.5);
  mesh(head, new THREE.SphereGeometry(0.042, 14, 10), eyeMat, 0.18, 0.035, 0.27, 1, 1, 1);
  mesh(head, new THREE.SphereGeometry(0.014, 8, 8), catchMat, 0.195, 0.05, 0.3, 1, 1, 1, false);
  mesh(head, new THREE.SphereGeometry(0.028, 10, 8), eyeMat, 0.2, 0.03, -0.18, 1, 1, 1);
  const tail = new THREE.Group();
  tail.position.set(-0.46, 0.72, 0);
  kiko.add(tail);
  mesh(tail, new THREE.SphereGeometry(0.1, 12, 10), fur, -0.1, 0.1, 0, 1.2, 0.75, 0.8);
  mesh(tail, new THREE.SphereGeometry(0.14, 12, 10), fur, -0.18, 0.32, 0.02, 1.05, 1.2, 1);
  mesh(tail, new THREE.SphereGeometry(0.17, 14, 12), fur, -0.12, 0.54, 0.02, 1.15, 1.1, 1.05);
  mesh(tail, new THREE.SphereGeometry(0.07, 10, 8), ink, -0.06, 0.7, 0.02, 1, 1, 1);
  const legs = [];
  [[0.22, 0.16], [0.22, -0.16], [-0.2, 0.16], [-0.2, -0.16]].forEach(([x, z])=>{
    const piv = new THREE.Group();
    piv.position.set(x, 0.4, z);
    kiko.add(piv);
    mesh(piv, new THREE.CylinderGeometry(0.055, 0.042, 0.36, 10), fur, 0, -0.18, 0);
    mesh(piv, new THREE.SphereGeometry(0.055, 10, 8), ink, 0.03, -0.36, 0);
    legs.push(piv);
  });
  mesh(kiko, new THREE.TorusGeometry(0.155, 0.012, 10, 28), goldMat, 0.24, 0.78, 0.04, 1, 1, 1);
  const neckRing = kiko.children[kiko.children.length - 1];
  neckRing.rotation.x = Math.PI / 2.4;
  const charms = new THREE.Group();
  charms.position.set(0.36, 0.68, 0.16);
  kiko.add(charms);
  const ringA = mesh(charms, new THREE.TorusGeometry(0.078, 0.013, 12, 28), goldMat, -0.05, -0.14, 0);
  ringA.rotation.set(0.5, 0.2, 0.2);
  const ringB = mesh(charms, new THREE.TorusGeometry(0.078, 0.013, 12, 28), goldMat, 0.06, -0.18, 0.02);
  ringB.rotation.set(0.2, -0.4, 0.6);
  const sparkMat = new THREE.SpriteMaterial({
    map: blobMap, color: 0xfff4c8, transparent: true,
    blending: THREE.AdditiveBlending, depthWrite: false
  });
  const spark = new THREE.Sprite(sparkMat);
  spark.scale.set(0.28, 0.28, 1);
  spark.position.set(0, -0.12, 0.05);
  charms.add(spark);
  const charmGlow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: blobMap, color: 0xffd76a, transparent: true,
    blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.85
  }));
  charmGlow.scale.set(2.8, 2.8, 1);
  charmGlow.position.set(0.05, 0.72, 0.12);
  charmGlow.visible = false;
  kiko.add(charmGlow);
  const charmGlowOuter = new THREE.Sprite(new THREE.SpriteMaterial({
    map: blobMap, color: 0x93a8d8, transparent: true,
    blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.55
  }));
  charmGlowOuter.scale.set(4.2, 4.2, 1);
  charmGlowOuter.position.set(0.05, 0.7, 0.05);
  charmGlowOuter.visible = false;
  kiko.add(charmGlowOuter);
  const charmRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.85, 0.035, 8, 36),
    new THREE.MeshBasicMaterial({ color: 0xf4c64d, transparent: true, opacity: 0.9 })
  );
  charmRing.rotation.x = Math.PI / 2;
  charmRing.position.set(0.05, 0.05, 0.12);
  charmRing.visible = false;
  kiko.add(charmRing);
  const charmLight = new THREE.PointLight(0xffd27a, 0, 5.5, 2);
  charmLight.position.set(0.1, 0.9, 0.3);
  kiko.add(charmLight);
  scene.add(kiko);

  const stone = new THREE.MeshStandardMaterial({ color: 0xc5cce0, roughness: 0.84 });
  const stoneDark = new THREE.MeshStandardMaterial({ color: 0x8d97b6, roughness: 0.7 });
  const glass = new THREE.MeshStandardMaterial({
    color: 0xc5cce0, emissive: 0xf2c98a, emissiveIntensity: 1.6, roughness: 0.35
  });
  const sage = new THREE.MeshStandardMaterial({ color: 0x7d9468, roughness: 0.78 });
  const sageDeep = new THREE.MeshStandardMaterial({ color: 0x5e734c, roughness: 0.8 });
  const peri = new THREE.MeshStandardMaterial({ color: 0x93a8d8, roughness: 0.55 });
  const blush = new THREE.MeshStandardMaterial({ color: 0xe7a0b4, roughness: 0.55 });
  const ivory = new THREE.MeshStandardMaterial({ color: 0xfffaf3, roughness: 0.62 });
  const ribbon = new THREE.MeshStandardMaterial({ color: 0x6b82b8, roughness: 0.45 });
  const leaf = new THREE.MeshStandardMaterial({ color: 0x6d8a5c, roughness: 0.7 });
  const neonA = new THREE.MeshStandardMaterial({ color: 0xffd0de, emissive: 0xe88aa0, emissiveIntensity: 1.4, roughness: 0.3 });
  const neonB = new THREE.MeshStandardMaterial({ color: 0xd5def8, emissive: 0x93a8d8, emissiveIntensity: 1.3, roughness: 0.3 });
  const neonG = new THREE.MeshStandardMaterial({ color: 0xfff1c2, emissive: 0xf4c64d, emissiveIntensity: 1.5, roughness: 0.25 });
  /* hazard mats stay hotter than the soft scenery so admin reads on the lane */
  const hazWax = new THREE.MeshPhysicalMaterial({
    color: 0xb33b48, emissive: 0x7a1828, emissiveIntensity: 0.85,
    roughness: 0.35, metalness: 0.15, clearcoat: 0.55, clearcoatRoughness: 0.35
  });
  const hazGold = new THREE.MeshPhysicalMaterial({
    color: 0xffc04a, emissive: 0xe09a20, emissiveIntensity: 1.1,
    roughness: 0.28, metalness: 0.45, clearcoat: 0.6, clearcoatRoughness: 0.3
  });
  const hazIvory = new THREE.MeshStandardMaterial({
    color: 0xfff0d2, emissive: 0xffb84a, emissiveIntensity: 0.55, roughness: 0.38
  });
  const hazInk = new THREE.MeshStandardMaterial({
    color: 0x1a2238, emissive: 0x0c1222, emissiveIntensity: 0.25, roughness: 0.55
  });
  const hazPeri = new THREE.MeshStandardMaterial({
    color: 0x2f5fc4, emissive: 0x1f48a8, emissiveIntensity: 1.15, roughness: 0.28
  });
  const hazBlush = new THREE.MeshStandardMaterial({
    color: 0xe0245c, emissive: 0xb01040, emissiveIntensity: 1.05, roughness: 0.28
  });
  const hazLeaf = new THREE.MeshStandardMaterial({
    color: 0x2f6a2c, emissive: 0x1a4818, emissiveIntensity: 0.55, roughness: 0.45
  });
  const hazRibbon = new THREE.MeshStandardMaterial({
    color: 0x244a9a, emissive: 0x183878, emissiveIntensity: 0.75, roughness: 0.35
  });
  const hazMark = new THREE.MeshBasicMaterial({
    color: 0x141a2c, transparent: true, opacity: 0.7, depthWrite: false
  });
  const hazHalo = new THREE.MeshBasicMaterial({
    color: 0xffb000, transparent: true, opacity: 1, side: THREE.DoubleSide, depthWrite: false
  });
  const hazGlow = new THREE.MeshBasicMaterial({
    color: 0xff9a1a, transparent: true, opacity: 0.7, depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  const fluteGlass = new THREE.MeshPhysicalMaterial({
    color: 0xb8d0f0, roughness: 0.08, transparent: true, opacity: 0.72,
    clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 1.4,
    emissive: 0x6a90c8, emissiveIntensity: 0.35
  });
  const fizz = new THREE.MeshStandardMaterial({
    color: 0xf4e2a4, emissive: 0xf4c64d, emissiveIntensity: 0.7,
    transparent: true, opacity: 0.85, roughness: 0.2
  });

  function box(parent, w, h, d, mat, x, y, z){
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }

  const decor = {
    abbey: new THREE.Group(),
    garden: new THREE.Group(),
    vinko: new THREE.Group(),
    disco: new THREE.Group()
  };
  Object.values(decor).forEach(g => scene.add(g));
  const movers = [];
  function track(obj, home, span, factor){
    obj.userData.home = home;
    obj.userData.span = span;
    obj.userData.factor = factor;
    movers.push(obj);
  }

  const abbeySpan = 56;
  for(let i = 0; i < 4; i++){
    const g = new THREE.Group();
    box(g, 2.6, 2.5, 1.7, stone, 0.4, 1.25, 0);
    box(g, 0.95, 4.1, 0.95, stone, -0.85, 2.05, 0);
    const spire = new THREE.Mesh(new THREE.ConeGeometry(0.58, 1.7, 5), stoneDark);
    spire.position.set(-0.85, 4.85, 0);
    g.add(spire);
    box(g, 0.28, 0.7, 0.08, glass, 0.55, 1.55, 0.86);
    box(g, 0.22, 0.85, 0.08, glass, -0.85, 2.4, 0.5);
    g.position.z = -8.2;
    g.scale.setScalar(1.15);
    decor.abbey.add(g);
    track(g, i * 14, abbeySpan, 0.28);
  }

  for(let i = 0; i < 8; i++){
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.7, 8), sageDeep);
    trunk.position.y = 0.35;
    const ballT = new THREE.Mesh(new THREE.SphereGeometry(0.42, 18, 14), sage);
    ballT.position.y = 0.95;
    g.add(trunk, ballT);
    g.position.z = i % 2 === 0 ? -2.7 : -3.6;
    decor.garden.add(g);
    track(g, i * 7.5, 60, 0.72);
  }
  for(let i = 0; i < 10; i++){
    const g = new THREE.Group();
    const cols = [peri, blush, ivory, sage];
    for(let p = 0; p < 5; p++){
      const s = new THREE.Mesh(new THREE.SphereGeometry(0.16 + (p % 3) * 0.04, 12, 10), cols[(i + p) % 4]);
      s.position.set((p - 2) * 0.18, 0.2 + (p % 2) * 0.16, (p % 2) * 0.1);
      g.add(s);
    }
    /* keep verge flowers soft and far so lane hazards stay the loud thing */
    g.position.z = -4.4;
    g.scale.setScalar(0.78);
    decor.garden.add(g);
    track(g, 3 + i * 6, 60, 0.9);
  }

  for(let i = 0; i < 6; i++){
    const g = new THREE.Group();
    const wreath = new THREE.Mesh(new THREE.TorusGeometry(0.48, 0.07, 8, 20), leaf);
    wreath.position.y = 3.1;
    g.add(wreath);
    for(let b = 0; b < 6; b++){
      const berry = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), b % 2 ? blush : neonG);
      const a = (b / 6) * Math.PI * 2;
      berry.position.set(Math.cos(a) * 0.48, 3.1 + Math.sin(a) * 0.48, 0.06);
      g.add(berry);
    }
    g.position.z = -3.2;
    g.userData.sway = true;
    decor.vinko.add(g);
    track(g, i * 9, 54, 0.45);
  }
  for(let i = 0; i < 5; i++){
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 2.4, 8), stoneDark);
    post.position.set(0, 1.2, -4.2);
    const flame = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), neonG);
    flame.position.set(0, 2.5, -4.2);
    decor.vinko.add(post, flame);
    track(post, i * 11, 55, 0.4);
    track(flame, i * 11, 55, 0.4);
  }

  for(let i = 0; i < 5; i++){
    const block = box(decor.disco, 1.6, 2.2 + (i % 3) * 0.8, 1.2, stoneDark, 0, 1.2, -6.5);
    block.castShadow = false;
    track(block, i * 12, 60, 0.22);
    const tube = box(decor.disco, 1.3, 0.08, 0.08, i % 2 ? neonA : neonB, 0, 2.3, -5.7);
    tube.castShadow = false;
    track(tube, i * 12, 60, 0.22);
  }

  const sealMap = sealTexture();
  const sealFace = new THREE.MeshStandardMaterial({ map: sealMap, roughness: 0.55, metalness: 0.05 });

  function dressHazard(g, radius){
    const mark = new THREE.Mesh(new THREE.CircleGeometry(radius * 1.2, 32), hazMark);
    mark.rotation.x = -Math.PI / 2;
    mark.position.y = 0.04;
    mark.renderOrder = 1;
    const pad = new THREE.Mesh(new THREE.CircleGeometry(radius * 1.0, 32), hazHalo);
    pad.rotation.x = -Math.PI / 2;
    pad.position.y = 0.055;
    pad.renderOrder = 2;
    const halo = new THREE.Mesh(new THREE.RingGeometry(radius * 1.0, radius * 1.4, 40), hazHalo);
    halo.rotation.x = -Math.PI / 2;
    halo.position.y = 0.07;
    halo.renderOrder = 3;
    const glow = new THREE.Mesh(new THREE.CircleGeometry(radius * 1.55, 28), hazGlow);
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = 0.045;
    glow.renderOrder = 0;
    /* short gold pin so the hazard reads even before the pad fills the frame */
    const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 1.15, 8), hazGold);
    pin.position.y = 0.6;
    pin.castShadow = true;
    const bead = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 10), hazGold);
    bead.position.y = 1.2;
    g.add(glow, mark, pad, halo, pin, bead);
    g.scale.setScalar(1.3);
    g.userData.hazardHalo = halo;
  }
  function makeSeal(){
    const g = new THREE.Group();
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.14, 32), hazWax);
    disc.rotation.x = Math.PI / 2;
    disc.position.y = 0.52;
    disc.castShadow = true;
    g.add(disc);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.04, 8, 28), hazGold);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.52;
    g.add(rim);
    const face = new THREE.Mesh(new THREE.CircleGeometry(0.36, 28), sealFace);
    face.position.set(0, 0.52, 0.08);
    g.add(face);
    dressHazard(g, 0.6);
    return { group: g, w: 0.95, h: 1.0 };
  }
  function makeEnvelope(){
    const g = new THREE.Group();
    box(g, 1.22, 0.76, 0.14, hazGold, 0, 0.42, -0.02);
    box(g, 1.1, 0.66, 0.1, hazIvory, 0, 0.42, 0.02);
    const flap = new THREE.Mesh(new THREE.PlaneGeometry(1.08, 0.38), hazGold);
    flap.position.set(0, 0.6, 0.09);
    flap.rotation.x = -0.5;
    g.add(flap);
    const sealDot = new THREE.Mesh(new THREE.CircleGeometry(0.14, 16), hazWax);
    sealDot.position.set(0, 0.42, 0.09);
    g.add(sealDot);
    dressHazard(g, 0.78);
    return { group: g, w: 1.22, h: 0.85 };
  }
  function makeHyd(){
    const g = new THREE.Group();
    const cols = [hazPeri, hazBlush, hazIvory, hazPeri, hazBlush];
    [[0, 0.4, 0], [0.24, 0.54, 0.05], [-0.22, 0.56, -0.02], [0.05, 0.76, 0.04], [-0.05, 0.3, 0.08]].forEach((p, i)=>{
      const s = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 12), cols[i]);
      s.position.set(p[0], p[1], p[2]);
      s.castShadow = true;
      g.add(s);
    });
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.34, 6), hazLeaf);
    stem.position.y = 0.16;
    g.add(stem);
    dressHazard(g, 0.62);
    return { group: g, w: 0.82, h: 0.98 };
  }
  function makeCake(){
    const g = new THREE.Group();
    const tiers = [[0.52, 0.3, 0.16], [0.38, 0.26, 0.44], [0.26, 0.24, 0.68]];
    tiers.forEach(([r, h, y])=>{
      const t = new THREE.Mesh(new THREE.CylinderGeometry(r, r + 0.02, h, 24), hazIvory);
      t.position.y = y;
      t.castShadow = true;
      g.add(t);
      const band = new THREE.Mesh(new THREE.TorusGeometry(r * 0.96, 0.025, 8, 24), hazWax);
      band.rotation.x = Math.PI / 2;
      band.position.y = y;
      g.add(band);
    });
    [[-0.28, 0.3], [0.05, 0.3], [0.3, 0.3], [-0.12, 0.56], [0.16, 0.56]].forEach(([x, y], i)=>{
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8), i % 2 ? hazPeri : hazBlush);
      dot.position.set(x, y, 0.34);
      g.add(dot);
    });
    const c1 = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.16, 6), goldMat);
    c1.position.set(-0.06, 0.9, 0);
    const c2 = c1.clone();
    c2.position.x = 0.08;
    const flame = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8), neonG);
    flame.position.set(-0.06, 1.02, 0);
    const flame2 = flame.clone();
    flame2.position.x = 0.08;
    g.add(c1, c2, flame, flame2);
    dressHazard(g, 0.72);
    return { group: g, w: 1.12, h: 1.15 };
  }
  function makeFlute(){
    const g = new THREE.Group();
    const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 12), fluteGlass);
    bowl.scale.set(1, 1.35, 1);
    bowl.position.y = 1.12;
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.6, 8), fluteGlass);
    stem.position.y = 0.58;
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 0.06, 12), hazWax);
    base.position.y = 0.06;
    const liquid = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.09, 0.2, 12), fizz);
    liquid.position.y = 1.0;
    g.add(bowl, stem, base, liquid);
    const bubbles = [];
    for(let i = 0; i < 4; i++){
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 8), catchMat);
      g.add(b);
      bubbles.push(b);
    }
    g.userData.tick = (t)=>{
      bubbles.forEach((b, i)=>{
        const y = 0.94 + ((t * 0.35 + i * 0.2) % 0.4);
        b.position.set((i - 1.5) * 0.04, y, 0.02);
      });
    };
    g.traverse(o => { if(o.isMesh) o.castShadow = true; });
    dressHazard(g, 0.48);
    return { group: g, w: 0.42, h: 1.4 };
  }
  function makeWreath(){
    const g = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.085, 8, 20), hazLeaf);
    ring.position.y = 0.52;
    g.add(ring);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.03, 8, 20), hazWax);
    rim.position.y = 0.52;
    g.add(rim);
    for(let i = 0; i < 7; i++){
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8), i % 2 ? hazPeri : neonG);
      const a = (i / 7) * Math.PI * 2;
      b.position.set(Math.cos(a) * 0.4, 0.52 + Math.sin(a) * 0.4, 0.05);
      g.add(b);
    }
    g.traverse(o => { if(o.isMesh) o.castShadow = true; });
    dressHazard(g, 0.65);
    return { group: g, w: 0.95, h: 1.05 };
  }
  function makeGift(){
    const g = new THREE.Group();
    box(g, 0.8, 0.7, 0.8, hazPeri, 0, 0.38, 0);
    box(g, 0.1, 0.72, 0.82, hazRibbon, 0, 0.38, 0);
    box(g, 0.82, 0.1, 0.82, hazRibbon, 0, 0.54, 0);
    const bow = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.03, 8, 12), hazWax);
    bow.position.set(-0.1, 0.8, 0);
    bow.rotation.y = 0.6;
    const bow2 = bow.clone();
    bow2.position.x = 0.1;
    bow2.rotation.y = -0.6;
    g.add(bow, bow2);
    dressHazard(g, 0.65);
    return { group: g, w: 0.88, h: 0.9 };
  }
  const MAKERS = {
    seal: makeSeal, envelope: makeEnvelope, hyd: makeHyd,
    cake: makeCake, flute: makeFlute, wreath: makeWreath, gift: makeGift
  };
  const pools = {};
  const live = [];
  function take(kind){
    pools[kind] = pools[kind] || [];
    const item = pools[kind].pop() || Object.assign(MAKERS[kind](), { kind });
    item.kind = kind;
    item.group.visible = true;
    return item;
  }
  function give(item){
    scene.remove(item.group);
    item.group.visible = false;
    pools[item.kind].push(item);
  }

  const MAXP = 80;
  const petals = [];
  const pPos = new Float32Array(MAXP * 3);
  const pCol = new Float32Array(MAXP * 3);
  for(let i = 0; i < MAXP; i++){
    petals.push({ life: 0, x: 0, y: -30, z: 0, vx: 0, vy: 0, phase: 0, dust: false, r: 1, g: 1, b: 1 });
    pPos[i * 3 + 1] = -30;
  }
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3));
  pGeo.setAttribute("color", new THREE.BufferAttribute(pCol, 3));
  const pMat = new THREE.PointsMaterial({
    size: fancy ? 0.16 : 0.2, vertexColors: true, transparent: true,
    depthWrite: false, map: blobMap, alphaTest: 0.15, sizeAttenuation: true
  });
  const points = new THREE.Points(pGeo, pMat);
  points.frustumCulled = false;
  scene.add(points);
  const PETAL_COLS = LEVELS.map(L => [
    new THREE.Color(L.gold), new THREE.Color("#f7f1e8"), new THREE.Color("#e7b7c8"), new THREE.Color(L.skyTop)
  ]);

  function spawnPetal(scatter, burst){
    const p = petals.find(q => q.life <= 0);
    if(!p) return;
    const cols = PETAL_COLS[level];
    const c = cols[(Math.random() * cols.length) | 0];
    p.dust = !!burst;
    p.life = burst ? 0.45 + Math.random() * 0.35 : 2.8 + Math.random() * 2.4;
    p.x = burst ? KX + (Math.random() - 0.5) * 0.8 : (scatter ? -6 + Math.random() * 18 : 11 + Math.random() * 4);
    p.y = burst ? 0.15 + Math.random() * 0.4 : 0.25 + Math.random() * 2.5;
    p.z = (Math.random() - 0.5) * (burst ? 0.6 : 3);
    p.vx = burst ? (Math.random() - 0.5) * 2.4 : 0;
    p.vy = burst ? 0.4 + Math.random() * 1.6 : 0;
    p.phase = Math.random() * 6.28;
    p.r = c.r; p.g = c.g; p.b = c.b;
  }
  function puff(){
    for(let i = 0; i < 10; i++) spawnPetal(false, true);
  }

  let level = 0;
  let state = "idle";
  let score = 0;
  let runDist = 0;
  let clockDist = 0;
  let y = 0;
  let vy = 0;
  let ducking = false;
  let grace = 0;
  let banner = 0;
  let coyote = 0;
  let buffer = 0;
  let spawnIn = 0;
  let shake = 0;
  let time = 0;
  let lastShown = -1;
  let lastRings = -1;
  let lastCharm = false;
  let bonus = 0;
  let rings = 0;
  let streak = 0;
  let charm = 0;
  let milestone = 0;
  let bestSung = false;
  let runBest = 0;
  const gemLive = [];
  const ringPool = [];
  const charmPool = [];
  const charmMat = new THREE.MeshStandardMaterial({
    color: 0x93a8d8, emissive: 0x6b82b8, emissiveIntensity: 0.9, roughness: 0.4
  });
  let visible = false;
  let raf = 0;
  let lastT = 0;
  let ready = false;
  const cur = hexColors(LEVELS[0]);
  const goal = hexColors(LEVELS[0]);
  const mix = {
    cloudAmt: LEVELS[0].cloudAmt, sunSoft: LEVELS[0].sunSoft,
    exposure: LEVELS[0].exposure, bloom: LEVELS[0].bloom, bloomAt: LEVELS[0].bloomAt,
    sunPos: new THREE.Vector2().fromArray(LEVELS[0].sunPos)
  };
  const goalN = Object.assign({}, mix, { sunPos: mix.sunPos.clone() });

  function copyGoal(i){
    const L = LEVELS[i];
    const cols = hexColors(L);
    for(const k in cols) goal[k].copy(cols[k]);
    goalN.cloudAmt = L.cloudAmt;
    goalN.sunSoft = L.sunSoft;
    goalN.exposure = L.exposure;
    goalN.bloom = fancy ? L.bloom : L.bloom * 0.65;
    goalN.bloomAt = L.bloomAt;
    goalN.sunPos.fromArray(L.sunPos);
  }
  function pushLook(){
    const u = skyMat.uniforms;
    u.uTop.value.copy(cur.skyTop);
    u.uMid.value.copy(cur.skyMid);
    u.uBot.value.copy(cur.skyBot);
    u.uSun.value.copy(cur.sun);
    u.uCloud.value.copy(cur.cloud);
    u.uSunPos.value.copy(mix.sunPos);
    u.uSunSoft.value = mix.sunSoft;
    u.uCloudAmt.value = mix.cloudAmt;
    groundMat.uniforms.uVerge.value.copy(cur.verge);
    groundMat.uniforms.uRunner.value.copy(cur.runner);
    groundMat.uniforms.uGold.value.copy(cur.gold);
    groundMat.uniforms.uFog.value.copy(cur.fog);
    scene.fog.color.copy(cur.fog);
    scene.fog.near = level === 3 ? 14 : 18;
    scene.fog.far = level === 3 ? 36 : 48;
    renderer.setClearColor(cur.skyMid, 1);
    renderer.toneMappingExposure = mix.exposure;
    hemi.color.copy(cur.skyMid);
    hemi.groundColor.copy(cur.verge);
    sun.color.copy(cur.sun);
    bloomPass.strength = mix.bloom;
    bloomPass.threshold = mix.bloomAt;
  }
  function snapLook(){
    for(const k in cur) cur[k].copy(goal[k]);
    mix.cloudAmt = goalN.cloudAmt;
    mix.sunSoft = goalN.sunSoft;
    mix.exposure = goalN.exposure;
    mix.bloom = goalN.bloom;
    mix.bloomAt = goalN.bloomAt;
    mix.sunPos.copy(goalN.sunPos);
    pushLook();
  }
  function easeLook(dt){
    const k = 1 - Math.exp(-dt * 2.2);
    for(const key in cur) cur[key].lerp(goal[key], k);
    mix.cloudAmt += (goalN.cloudAmt - mix.cloudAmt) * k;
    mix.sunSoft += (goalN.sunSoft - mix.sunSoft) * k;
    mix.exposure += (goalN.exposure - mix.exposure) * k;
    mix.bloom += (goalN.bloom - mix.bloom) * k;
    mix.bloomAt += (goalN.bloomAt - mix.bloomAt) * k;
    mix.sunPos.lerp(goalN.sunPos, k);
    pushLook();
  }
  function applyTheme(i){
    level = i;
    const L = LEVELS[i];
    copyGoal(i);
    wrap.dataset.kdTheme = L.theme === "night" ? "night" : L.theme === "dusk" ? "dusk" : "day";
    decor.abbey.visible = i === 0;
    decor.garden.visible = i === 0 || i === 1;
    decor.vinko.visible = i === 2;
    decor.disco.visible = i === 3;
    disco.visible = i === 3;
    spots.forEach(s => { s.visible = i === 3; s.intensity = i === 3 ? 22 : 0; });
    candles.forEach(s => { s.visible = i === 2; s.intensity = i === 2 ? 2.4 : 0; });
    sun.intensity = L.sunIntensity;
    hemi.intensity = L.hemi;
    fill.intensity = L.fill;
    scene.environmentIntensity = i === 3 ? 0.28 : 0.52;
    hooks.onLevel?.(i, L.name);
  }

  function setCard(mode, kicker, title, opacity){
    if(mode === "none"){ card.hidden = true; return; }
    card.hidden = false;
    kickEl.textContent = kicker || "";
    titleEl.textContent = title || "";
    card.style.opacity = opacity == null ? "1" : String(opacity);
  }
  function clearLive(){
    while(live.length) give(live.pop());
  }
  function beginLevel(i){
    applyTheme(i);
    clearLive();
    clearGems();
    grace = 1.8;
    banner = 1.85;
    spawnIn = 0.35;
    setCard("banner", "Level " + (i + 1), LEVELS[i].name, 1);
    if(i > 0) puff();
  }
  function total(){ return (score | 0) + (bonus | 0); }
  function publishScore(){
    const s = total();
    const on = charm > 0;
    if(s !== lastShown || rings !== lastRings || on !== lastCharm){
      lastShown = s; lastRings = rings; lastCharm = on;
      hooks.onScore?.(s, { rings, charm: on });
    }
    if(runBest > 0 && s > runBest){
      if(!bestSung){ bestSung = true; hooks.onCheer?.("New best"); }
      hooks.onBest?.(s);
      runBest = s;
    }
  }
  function reset(){
    state = "idle";
    score = 0;
    runDist = 0;
    bonus = 0; rings = 0; streak = 0; charm = 0;
    milestone = 0; bestSung = false; runBest = 0;
    lastShown = -1; lastRings = -1; lastCharm = false;
    y = 0; vy = 0;
    grace = 0; banner = 0;
    coyote = 0; buffer = 0;
    spawnIn = 0;
    clearLive();
    clearGems();
    wrap.classList.remove("is-charmed");
    applyTheme(0);
    snapLook();
    publishScore();
    setCard("prompt", "Kiko Dash", "Tap or press space");
  }
  function doJump(){
    vy = 10.2;
    y = Math.max(y, 0.02);
    coyote = 0;
    buffer = 0;
  }
  function jumpPress(){
    if(state === "over"){ reset(); return; }
    if(state === "idle"){
      state = "run";
      runBest = hooks.best?.() || 0;
      bestSung = false;
      beginLevel(0);
      return;
    }
    if(coyote > 0) doJump();
    else buffer = 0.12;
  }
  function jumpRelease(){
    if(vy > 4.4) vy = 4.4;
  }
  function setDuck(on){
    const next = !!on;
    if(next && !ducking && vy > 3.4) vy = 3.4;
    ducking = next;
  }
  function die(){
    if(state !== "run") return;
    state = "over";
    charm = 0;
    wrap.classList.remove("is-charmed");
    shake = 0.18;
    puff();
    const extra = rings ? " · ✦ " + rings : "";
    setCard("over", "Paws", total() + "m" + extra + " — tap to try again", 1);
    hooks.onFinish?.(total());
  }
  function makeRingMesh(){
    const m = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.028, 8, 18), goldMat);
    m.rotation.x = Math.PI / 2.4;
    return m;
  }
  function makeCharmMesh(){
    const g = new THREE.Group();
    [[0, 0, 0], [0.11, 0.07, 0], [-0.09, 0.05, 0.02], [0.03, -0.1, 0.02], [-0.05, 0.12, -0.02]].forEach((p, i) => {
      const s = new THREE.Mesh(new THREE.SphereGeometry(i === 0 ? 0.09 : 0.055, 10, 8), charmMat);
      s.position.set(p[0], p[1], p[2]);
      g.add(s);
    });
    return g;
  }
  function takeGemMesh(kind){
    const pool = kind === "charm" ? charmPool : ringPool;
    let mesh = pool.pop();
    if(!mesh) mesh = kind === "charm" ? makeCharmMesh() : makeRingMesh();
    mesh.visible = true;
    scene.add(mesh);
    return mesh;
  }
  function giveGem(gem){
    scene.remove(gem.mesh);
    gem.mesh.visible = false;
    (gem.kind === "charm" ? charmPool : ringPool).push(gem.mesh);
  }
  function clearGems(){
    while(gemLive.length) giveGem(gemLive.pop());
  }
  function spawnGem(){
    let kind = null;
    if(Math.random() < 0.08) kind = "charm";
    else if(Math.random() < 0.55) kind = "ring";
    if(!kind) return;
    gemLive.push({
      kind,
      x: 15.1 + Math.random() * 1.3,
      y: 1.15 + Math.random() * 0.7,
      mesh: takeGemMesh(kind)
    });
  }
  function spawnObs(){
    const kinds = LEVELS[level].kinds;
    const kind = kinds[(Math.random() * kinds.length) | 0];
    const item = take(kind);
    item.x = 13.4;
    item.lift = (kind === "hyd" && Math.random() < 0.62) ? 0.9 : 0;
    item.near = false;
    scene.add(item.group);
    live.push(item);
    spawnGem();
  }
  function resize(){
    const w = wrap.clientWidth || 800;
    const h = wrap.clientHeight || 480;
    if(w < 2 || h < 2) return;
    const pr = Math.min(fancy ? 1.65 : 1.2, window.devicePixelRatio || 1);
    renderer.setPixelRatio(pr);
    renderer.setSize(w, h, false);
    composer.setPixelRatio(pr);
    composer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  const composer = new EffectComposer(renderer);
  const renderPass = new RenderPass(scene, camera);
  const bloomPass = new UnrealBloomPass(new THREE.Vector2(512, 512), 0.32, 0.55, 0.98);
  composer.addPass(renderPass);
  composer.addPass(bloomPass);
  composer.addPass(new OutputPass());
  applyTheme(0);
  snapLook();
  setCard("prompt", "Kiko Dash", "Tap or press space");
  for(let i = 0; i < 28; i++) spawnPetal(true, false);

  const ro = new ResizeObserver(()=>resize());
  ro.observe(wrap);
  resize();

  canvas.addEventListener("pointerdown", e => { e.preventDefault(); jumpPress(); });
  canvas.addEventListener("pointerup", e => { e.preventDefault(); jumpRelease(); });
  canvas.addEventListener("pointercancel", jumpRelease);

  function frame(now){
    if(!visible){ raf = 0; return; }
    raf = requestAnimationFrame(frame);
    const dt = lastT ? Math.min(0.05, (now - lastT) / 1000) : 0.016;
    lastT = now;
    time += dt;
    try{
      const pace = state === "run" ? 7.15 + Math.min(8.2, score / 48) : (state === "over" ? 0 : 0.42);
      clockDist += pace * dt;
      skyMat.uniforms.uTime.value = time;
      skyMat.uniforms.uEye.value.copy(camera.position);
      groundMat.uniforms.uScroll.value = clockDist * 0.42;
      groundMat.uniforms.uCam.value.copy(camera.position);

      if(state === "run"){
        runDist += pace * dt;
        score = Math.floor(runDist * 1.15);
        const nextLv = Math.min(LEVELS.length - 1, Math.floor(score / LEVEL_M));
        if(nextLv !== level) beginLevel(nextLv);
        const mark = Math.floor(score / 100) * 100;
        if(mark >= 100 && mark > milestone){
          milestone = mark;
          hooks.onCheer?.(mark + " m");
        }
        if(charm > 0) charm -= dt;
        if(grace > 0) grace -= dt;
        else {
          spawnIn -= dt;
          if(spawnIn <= 0){
            spawnObs();
            spawnIn = Math.max(0.68, 1.32 - Math.min(0.55, score / 400)) * (0.78 + Math.random() * 0.5);
          }
        }
        if(banner > 0){
          banner -= dt;
          setCard("banner", "Level " + (level + 1), LEVELS[level].name, Math.min(1, Math.max(0, banner / 0.4)));
          if(banner <= 0) setCard("none");
        }
        const grav = ducking && y > 0.06 && vy < 1.2 ? 62 : 26.5;
        const prevY = y;
        const fallV = vy;
        vy -= grav * dt;
        y += vy * dt;
        if(y <= 0){
          if(prevY > 0.08 && fallV < -3.5) puff();
          y = 0; vy = 0; coyote = 0.1;
        } else coyote = Math.max(0, coyote - dt);
        if(buffer > 0){
          buffer -= dt;
          if(coyote > 0) doJump();
        }
        for(let i = live.length - 1; i >= 0; i--){
          const o = live[i];
          o.x -= pace * dt;
          if(o.x < -12){ give(o); live.splice(i, 1); continue; }
          const bob = o.lift ? Math.sin(time * 2.4 + o.x) * 0.05 : 0;
          o.group.position.set(o.x, o.lift + bob, 0);
          if(o.kind === "hyd") o.group.rotation.y += dt * 0.6;
          if(o.group.userData.hazardHalo){
            const pulse = 1 + Math.sin(time * 6 + o.x) * 0.12;
            o.group.userData.hazardHalo.scale.set(pulse, pulse, 1);
          }
          if(o.group.userData.tick) o.group.userData.tick(time);
        }
        const chest = y + ((ducking && y < 0.05) ? 0.32 : 0.72);
        for(let i = gemLive.length - 1; i >= 0; i--){
          const g = gemLive[i];
          g.x -= pace * dt;
          const bob = Math.sin(time * 3.2 + g.y) * 0.06;
          g.mesh.position.set(g.x, g.y + bob, 0.15);
          if(g.kind === "ring") g.mesh.rotation.y += dt * 2.4;
          const hit = Math.abs(g.x - KX) < 0.48 && Math.abs(g.y - chest) < 0.42;
          if(hit){
            if(g.kind === "charm"){ charm = 2.4; bonus += 12; hooks.onCheer?.("Barvinok"); }
            else {
              rings++; streak++;
              if(streak >= 3){ streak = 0; bonus += 24; hooks.onCheer?.("The set!"); }
              else { bonus += 8; hooks.onCheer?.("✦ +8"); }
            }
            giveGem(g); gemLive.splice(i, 1);
            continue;
          }
          if(g.kind === "ring" && g.x < KX - 0.6){ streak = 0; giveGem(g); gemLive.splice(i, 1); continue; }
          if(g.x < -8){ giveGem(g); gemLive.splice(i, 1); }
        }
        if(grace <= 0 && charm <= 0){
          const ducked = ducking && y < 0.05;
          const height = ducked ? 0.55 : 1.2;
          for(const o of live){
            const half = o.w * 0.36;
            const xHit = (KX + 0.42) > o.x - half && (KX - 0.36) < o.x + half;
            const top = o.lift + o.h * 0.86;
            const bot = o.lift + 0.02;
            const yHit = y < top && (y + height) > bot;
            if(xHit && yHit){ publishScore(); die(); break; }
            if(xHit && !o.near){
              const closeOver = y >= top && y < top + 0.28;
              const closeUnder = o.lift > 0.2 && (y + height) <= bot && (y + height) > bot - 0.28;
              if(closeOver || closeUnder){ o.near = true; bonus += 5; hooks.onCheer?.("Close!"); }
            }
          }
        }
        publishScore();
      } else if(state === "idle"){
        y += (0 - y) * Math.min(1, dt * 6);
      }

      easeLook(dt);
      const ducked = ducking && y < 0.05;
      const stretch = ducked ? 0.52 : 1 + Math.max(-0.14, Math.min(0.16, vy * 0.03));
      kiko.scale.y += (stretch - kiko.scale.y) * Math.min(1, dt * 12);
      kiko.scale.x = 1.02 - (kiko.scale.y - 1) * 0.45;
      kiko.scale.z = kiko.scale.x;
      kiko.position.set(KX, y, 0.2);
      if(state === "over") kiko.rotation.z += (-1.05 - kiko.rotation.z) * Math.min(1, dt * 6);
      else kiko.rotation.z += (0 - kiko.rotation.z) * Math.min(1, dt * 8);

      const moving = state === "run" && y < 0.05 && !ducked;
      const phase = moving ? runDist * 2.5 : time * 1.7;
      const amp = moving ? 0.72 : 0.1;
      if(y > 0.1){
        legs.forEach((leg, i) => { leg.rotation.z = i < 2 ? -0.45 : 0.35; });
      } else {
        legs[0].rotation.z = Math.sin(phase) * amp;
        legs[1].rotation.z = Math.sin(phase + Math.PI) * amp;
        legs[2].rotation.z = Math.sin(phase + Math.PI) * amp;
        legs[3].rotation.z = Math.sin(phase) * amp;
      }
      tail.rotation.z = -0.5 + Math.sin(time * 3.1) * (moving ? 0.28 : 0.16);
      tail.rotation.y = Math.sin(time * 2.2) * 0.18;
      head.rotation.z = Math.sin(time * 1.8) * 0.04;
      head.rotation.y = Math.sin(time * 1.2) * 0.06;
      charms.rotation.z = Math.sin(time * 5.2 + runDist) * 0.45;
      charms.rotation.x = Math.cos(time * 4.1) * 0.12;
      const tw = 0.2 + Math.sin(time * 9) * 0.08 + (level === 3 ? 0.08 : 0);
      spark.scale.set(tw, tw, 1);
      const charmed = charm > 0 && state === "run";
      charmGlow.visible = charmed;
      charmGlowOuter.visible = charmed;
      charmRing.visible = charmed;
      charmLight.intensity = charmed ? 4.2 + Math.sin(time * 9) * 1.2 : 0;
      wrap.classList.toggle("is-charmed", charmed);
      if(charmed){
        const pulse = 1 + Math.sin(time * 9) * 0.18;
        charmGlow.scale.set(2.6 * pulse, 2.6 * pulse, 1);
        charmGlow.material.opacity = 0.7 + Math.sin(time * 9) * 0.25;
        charmGlowOuter.scale.set(4.1 * pulse, 4.1 * pulse, 1);
        charmGlowOuter.material.opacity = 0.4 + Math.sin(time * 7) * 0.2;
        charmRing.rotation.z = time * 3.2;
        charmRing.scale.setScalar(0.95 + Math.sin(time * 8) * 0.12);
        charmRing.material.opacity = 0.65 + Math.sin(time * 8) * 0.3;
      }

      blob.position.set(KX, 0.03, 0.2);
      const air = Math.min(1, y / 1.7);
      const bsc = 1 + air * 0.55;
      blob.scale.set(bsc, bsc, 1);
      blob.material.opacity = 0.55 * (1 - air * 0.65);

      disco.rotation.y = time * 0.85;
      ball.rotation.y = time * 1.4;
      ball.rotation.z = time * 0.4;

      for(const m of movers){
        const span = m.userData.span;
        const shifted = m.userData.home - clockDist * m.userData.factor;
        m.position.x = ((shifted % span) + span) % span - 22;
        if(m.userData.sway) m.rotation.z = Math.sin(time * 1.3 + m.userData.home) * 0.15;
      }

      if(state !== "over" && Math.random() < (level === 1 ? 0.85 : 0.4)) spawnPetal(false, false);
      for(let i = 0; i < MAXP; i++){
        const p = petals[i];
        if(p.life <= 0){ pPos[i * 3 + 1] = -40; continue; }
        p.life -= dt;
        if(p.dust){
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.vy -= 2.4 * dt;
        } else {
          p.x -= pace * dt;
          p.y += Math.sin(time * 2 + p.phase) * dt * 0.45;
          p.z += Math.cos(time * 1.2 + p.phase) * dt * 0.18;
          if(p.x < -12) p.life = 0;
        }
        pPos[i * 3] = p.x;
        pPos[i * 3 + 1] = p.y;
        pPos[i * 3 + 2] = p.z;
        pCol[i * 3] = p.r;
        pCol[i * 3 + 1] = p.g;
        pCol[i * 3 + 2] = p.b;
      }
      pGeo.attributes.position.needsUpdate = true;
      pGeo.attributes.color.needsUpdate = true;

      shake *= Math.exp(-dt * 5);
      const bob = moving ? Math.abs(Math.sin(runDist * 2.5)) * 0.028 : 0;
      const drift = Math.sin(time * 0.45) * 0.05;
      camera.position.set(
        -3.9 + (Math.random() - 0.5) * shake,
        1.95 + y * 0.18 + bob,
        8.6
      );
      camera.lookAt(0.35 + drift, 0.9 + y * 0.14, -1.1);
      const wantFov = 36 + (state === "run" ? Math.min(3.5, (pace - 7) * 0.3) : 0);
      camera.fov += (wantFov - camera.fov) * Math.min(1, dt * 2);
      camera.updateProjectionMatrix();

      composer.render(dt);
      if(!ready){
        ready = true;
        wrap.classList.add("is-3d-ready");
      }
    }catch(err){
      console.error(err);
      visible = false;
      hooks.onError?.(err);
    }
  }

  function show(){
    visible = true;
    resize();
    publishScore();
    hooks.onLevel?.(level, LEVELS[level].name);
    if(!raf){
      lastT = 0;
      raf = requestAnimationFrame(frame);
    }
  }
  function hide(){ visible = false; }

  reset();
  return {
    show, hide, jumpPress, jumpRelease, setDuck,
    playing(){ return state === "run"; }
  };
}
