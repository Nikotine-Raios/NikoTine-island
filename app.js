import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { CSS2DRenderer, CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";
import { Sky } from "three/addons/objects/Sky.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

const ZONES = [
  {
    id: "daily",
    name: "Daily Board",
    subtitle: "To-dos and weekday planning",
    schedule: "Weekdays 8:00 AM · America/Chicago",
    color: 0x3f9f6d,
    wall: 0xf4efe4,
    roof: 0xd45b4a,
    x: -18,
    z: -18,
    items: [
      { badge: "now", text: "Answer the 8:00 AM Daily Planning ping" },
      { badge: "next", text: "Voice-note today’s top three outcomes" },
      { badge: "next", text: "Promote one memory candidate — do not auto-save" },
      { badge: "later", text: "Keep Telegram to normal-personal only" },
    ],
  },
  {
    id: "decisions",
    name: "Decision Log",
    subtitle: "Force a choice, then move",
    schedule: "On demand from Telegram or this island",
    color: 0xd4a24a,
    wall: 0xf7eed8,
    roof: 0xc47a2c,
    x: 18,
    z: -18,
    items: [
      { badge: "open", text: "Keep Whisper tiny, or approve a larger local model?" },
      { badge: "parked", text: "Add web / YouTube to the bot? Not yet." },
      { badge: "done", text: "Local STT instead of OpenAI transcription" },
    ],
  },
  {
    id: "reflect",
    name: "Reflection",
    subtitle: "Weekly and monthly reviews",
    schedule: "Sun 10:00 PM · 1st of month 10:00 / 10:15 AM",
    color: 0x6b8cff,
    wall: 0xeaf0fb,
    roof: 0x4c63c7,
    x: -18,
    z: 18,
    items: [
      { badge: "sun", text: "Weekly Reflection · Sundays 10:00 PM" },
      { badge: "month", text: "Career Development · 1st, 10:00 AM" },
      { badge: "month", text: "Personal Project Copilot · 1st, 10:15 AM" },
    ],
  },
  {
    id: "court",
    name: "Rally Court",
    subtitle: "Badminton follow-up",
    schedule: "On demand after a game",
    color: 0xe35d6a,
    x: 19,
    z: 19,
    items: [
      { badge: "idle", text: "Tell the bot after the next game" },
      { badge: "rule", text: "Win or practice only — skip injury detail" },
    ],
  },
];

const BOTS = [
  { name: "Terra", home: null, color: 0x5cbc9a, objective: "Keep main live and check every pod.", need: false },
  { name: "Pulse", home: "daily", objective: "Get today’s top three outcomes from Daily Planning.", need: true },
  { name: "Knot", home: "decisions", objective: "Force a choice on the open Decision Log items.", need: true },
  { name: "Mirror", home: "reflect", objective: "Run Weekly Reflection and the monthly reviews.", need: false },
  { name: "Smash", home: "court", objective: "Ask how badminton went after the next game.", need: false },
  { name: "Drift", home: null, color: 0x8a96a4, objective: "Patrol the colony. No assigned pod.", need: false },
  { name: "Echo", home: null, color: 0x8a96a4, objective: "Listen for a voice note, then pass it to main.", need: false },
];

// Agent status comes from state.live.json (written by agents/run.js) or the committed demo state.json.
const STATUS_GLYPH = { idle: "", working: "●", needs_input: "?", down: "!", unknown: "?" };
const STATUS_LABEL = {
  idle: "idle",
  working: "working",
  needs_input: "needs input",
  down: "down",
  unknown: "no signal",
};
const STATUS_COLOR = { needs_input: 0xffc14d, down: 0xe35d6a, unknown: 0x9aa4ad };
const STATE_URLS = ["./state.live.json", "./state.json"];
const STATE_POLL_MS = 5000;
let agentState = null;
let runnerHealth = "demo";

let selectBot = () => {};

const view = document.getElementById("view");
const zoneList = document.getElementById("zoneList");
const hud = document.getElementById("hud");
const hudToggle = document.getElementById("hudToggle");
const counts = document.getElementById("counts");
const card = document.getElementById("tasks");
const cardKicker = document.getElementById("cardKicker");
const cardTitle = document.getElementById("cardTitle");
const cardMeta = document.getElementById("cardMeta");
const cardItems = document.getElementById("cardItems");
const intro = document.getElementById("intro");
const introLiquid = document.getElementById("introLiquid");
const introMaskRect = document.getElementById("introMaskRect");
const introShadeRect = document.getElementById("introShadeRect");
const introCutout = document.getElementById("introCutout");
const introDroplet = document.getElementById("introDroplet");
const introRim = document.getElementById("introRim");
const introStars = document.getElementById("introStars");
const introHighlight = document.getElementById("introHighlight");
const introHighlightSmall = document.getElementById("introHighlightSmall");
const introLensShade = document.getElementById("introLensShade");
const replayIntro = document.getElementById("replayIntro");
const overviewButton = document.getElementById("overviewButton");

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8ec8ef);
scene.fog = new THREE.Fog(0xb7d8ef, 80, 180);

const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 400);
camera.position.set(26, 16, 30);

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  powerPreference: "high-performance",
  stencil: false,
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
renderer.outputColorSpace = THREE.SRGBColorSpace;
view.appendChild(renderer.domElement);

const labels = new CSS2DRenderer();
labels.domElement.style.position = "absolute";
labels.domElement.style.inset = "0";
labels.domElement.style.pointerEvents = "none";
view.appendChild(labels.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.11;
controls.rotateSpeed = 0.82;
controls.minDistance = 10;
controls.maxDistance = 90;
controls.maxPolarAngle = Math.PI * 0.47;
controls.minPolarAngle = Math.PI * 0.18;
controls.target.set(0, 1.6, 0);

const sky = new Sky();
sky.scale.setScalar(450);
scene.add(sky);
sky.material.uniforms.turbidity.value = 4.5;
sky.material.uniforms.rayleigh.value = 1.6;
sky.material.uniforms.mieCoefficient.value = 0.005;
sky.material.uniforms.mieDirectionalG.value = 0.8;
const sunPos = new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(82), THREE.MathUtils.degToRad(145));
sky.material.uniforms.sunPosition.value.copy(sunPos);

const sun = new THREE.DirectionalLight(0xfff4d8, 2.2);
sun.position.copy(sunPos).multiplyScalar(60);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -55;
sun.shadow.camera.right = 55;
sun.shadow.camera.top = 55;
sun.shadow.camera.bottom = -55;
scene.add(sun);
scene.add(new THREE.HemisphereLight(0xc6e8ff, 0x52653a, 0.78));
scene.add(new THREE.AmbientLight(0xfff1dc, 0.2));

function hex(color) {
  return `#${color.toString(16).padStart(6, "0")}`;
}

function mat(color, extras = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.78, metalness: 0.04, ...extras });
}

function mark(mesh, zoneId) {
  mesh.userData.zoneId = zoneId;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function rbox(w, h, d, color, x, y, z, parent, zoneId, radius = 0.12) {
  const mesh = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, radius), mat(color));
  mesh.position.set(x, y, z);
  if (zoneId) mark(mesh, zoneId);
  else {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
  }
  parent.add(mesh);
  return mesh;
}

function addLabel(object, text, extraClass = "", y = 2.6, color) {
  const el = document.createElement("div");
  el.className = `label ${extraClass}`.trim();
  const dot = color
    ? `<i class="dot" style="background:${typeof color === "number" ? hex(color) : color};color:${typeof color === "number" ? hex(color) : color}"></i>`
    : "";
  el.innerHTML = `${dot}<span>${text}</span>`;
  const tag = new CSS2DObject(el);
  tag.position.set(0, y, 0);
  object.add(tag);
  return el;
}

function paintedTexture(size, painter) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  painter(canvas.getContext("2d"), size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  return texture;
}

function seeded(index, salt = 0) {
  const value = Math.sin((index + 1) * (12.9898 + salt * 9.173)) * 43758.5453;
  return value - Math.floor(value);
}

const grassTexture = paintedTexture(512, (ctx, size) => {
  const wash = ctx.createLinearGradient(0, 0, size, size);
  wash.addColorStop(0, "#72b653");
  wash.addColorStop(0.5, "#5fa447");
  wash.addColorStop(1, "#4b8d3e");
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 1500; i += 1) {
    const x = seeded(i, 1) * size;
    const y = seeded(i, 2) * size;
    const length = 1 + seeded(i, 3) * 5;
    ctx.strokeStyle = seeded(i, 4) > 0.5 ? "rgba(28,92,43,.16)" : "rgba(210,238,143,.1)";
    ctx.lineWidth = 0.5 + seeded(i, 5);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + length, y - length * 0.35);
    ctx.stroke();
  }
});

const sandTexture = paintedTexture(256, (ctx, size) => {
  ctx.fillStyle = "#dfc78e";
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 700; i += 1) {
    const shade = Math.round(160 + seeded(i, 6) * 65);
    ctx.fillStyle = `rgba(${shade},${Math.round(shade * 0.88)},${Math.round(shade * 0.61)},.2)`;
    const r = 0.4 + seeded(i, 7) * 1.25;
    ctx.beginPath();
    ctx.arc(seeded(i, 8) * size, seeded(i, 9) * size, r, 0, Math.PI * 2);
    ctx.fill();
  }
});

const waterTexture = paintedTexture(512, (ctx, size) => {
  const ocean = ctx.createLinearGradient(0, 0, size, size);
  ocean.addColorStop(0, "#2f88b8");
  ocean.addColorStop(0.48, "#4bafd0");
  ocean.addColorStop(1, "#1f6e9f");
  ctx.fillStyle = ocean;
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 48; i += 1) {
    const y = (i / 48) * size;
    ctx.strokeStyle = `rgba(204,242,255,${0.025 + (i % 5) * 0.012})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= size; x += 8) {
      const wave = Math.sin(x * 0.045 + i * 1.7) * 2.5;
      if (x === 0) ctx.moveTo(x, y + wave);
      else ctx.lineTo(x, y + wave);
    }
    ctx.stroke();
  }
});
waterTexture.wrapS = THREE.RepeatWrapping;
waterTexture.wrapT = THREE.RepeatWrapping;
waterTexture.repeat.set(2.2, 2.2);

const islandBase = new THREE.Mesh(
  new THREE.CylinderGeometry(46, 47.5, 1.25, 80),
  mat(0x596540, { roughness: 0.96 }),
);
islandBase.position.y = -0.66;
islandBase.receiveShadow = true;
scene.add(islandBase);

const island = new THREE.Mesh(
  new THREE.CircleGeometry(46, 80),
  mat(0xffffff, { map: grassTexture, roughness: 0.86 }),
);
island.rotation.x = -Math.PI / 2;
island.receiveShadow = true;
scene.add(island);

const sand = new THREE.Mesh(
  new THREE.RingGeometry(44, 50, 80),
  mat(0xffffff, { map: sandTexture, roughness: 0.92 }),
);
sand.rotation.x = -Math.PI / 2;
sand.position.y = 0.02;
sand.receiveShadow = true;
scene.add(sand);

const water = new THREE.Mesh(
  new THREE.CircleGeometry(78, 80),
  new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    map: waterTexture,
    roughness: 0.2,
    metalness: 0.05,
    clearcoat: 0.9,
    clearcoatRoughness: 0.16,
    transparent: true,
    opacity: 0.94,
  }),
);
water.rotation.x = -Math.PI / 2;
water.position.y = -0.35;
scene.add(water);

function tree(x, z, s = 1) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18 * s, 0.24 * s, 1.1 * s, 8), mat(0x8a5a32));
  trunk.position.y = 0.55 * s;
  trunk.castShadow = true;
  g.add(trunk);
  const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(0.85 * s, 0), mat(0x3f8f45));
  leaf.position.y = 1.45 * s;
  leaf.castShadow = true;
  g.add(leaf);
  g.position.set(x, 0, z);
  scene.add(g);
}
function flower(x, z, color = 0xf2d45c, s = 1) {
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.03 * s, 0.04 * s, 0.28 * s, 5), mat(0x3f8f45));
  stem.position.set(x, 0.16 * s, z);
  stem.castShadow = true;
  scene.add(stem);
  const bloom = new THREE.Mesh(new THREE.IcosahedronGeometry(0.12 * s, 0), mat(color));
  bloom.position.set(x, 0.34 * s, z);
  bloom.castShadow = true;
  scene.add(bloom);
}

function rock(x, z, s = 1, color = 0xb8b2a6) {
  const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42 * s, 0), mat(color, { roughness: 0.95 }));
  mesh.position.set(x, 0.22 * s, z);
  mesh.scale.set(1.2, 0.7, 1);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
}

[
  [-8, -8, 1.1],
  [7, -10, 0.9],
  [-10, 8, 1],
  [9, 6, 0.85],
  [-32, -4, 1.2],
  [32, 3, 1],
  [4, 32, 1.15],
  [-3, -32, 0.95],
  [-28, -28, 1.05],
  [28, -30, 0.88],
  [-30, 28, 1.18],
  [30, 30, 0.92],
  [0, -36, 1.08],
  [36, -8, 0.8],
  [-36, 10, 1],
].forEach(([x, z, s]) => tree(x, z, s));

[
  [-6, 0, 0xf2d45c],
  [-5.2, 1.1, 0xe35d6a],
  [-4.4, -0.6, 0x6b8cff],
  [5.4, 1.4, 0xf2d45c],
  [6.2, -0.8, 0xe35d6a],
  [4.8, 2.2, 0xffffff],
  [-22, -6, 0xf2d45c],
  [-24, -8, 0xe35d6a],
  [22, -8, 0xd4a24a],
  [24, -6, 0xe35d6a],
  [-22, 8, 0x6b8cff],
  [-24, 10, 0xffffff],
  [22, 8, 0xe35d6a],
  [8, -24, 0x3f9f6d],
  [-8, 24, 0x6b8cff],
].forEach(([x, z, color]) => flower(x, z, color));

[
  [-12, -2, 1.1],
  [12, 3, 0.85],
  [-2, 14, 1],
  [3, -14, 0.7],
  [34, 16, 1.2],
  [-34, -16, 0.9],
].forEach(([x, z, s]) => rock(x, z, s));

function house(parent, x, z, zone, w = 6.2, d = 4.8) {
  rbox(w, 2.5, d, zone.wall, x, 1.55, z, parent, zone.id, 0.2);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.max(w, d) * 0.62, 1.7, 4), mat(zone.roof, { roughness: 0.55 }));
  roof.position.set(x, 3.55, z);
  roof.rotation.y = Math.PI / 4;
  mark(roof, zone.id);
  parent.add(roof);
  rbox(0.72, 1.25, 0.1, 0x4a3422, x, 0.95, z + d / 2 + 0.02, parent, zone.id, 0.04);
  rbox(0.55, 0.48, 0.08, 0x7ec8e8, x - w * 0.24, 1.85, z + d / 2 + 0.02, parent, zone.id, 0.04);
  rbox(0.55, 0.48, 0.08, 0x7ec8e8, x + w * 0.24, 1.85, z + d / 2 + 0.02, parent, zone.id, 0.04);
}

function lampPost(parent, x, z, zoneId) {
  rbox(0.14, 2.05, 0.14, 0x5a5348, x, 1.15, z, parent, zoneId, 0.03);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), mat(0xfff1b8, { emissive: 0xffd27a, emissiveIntensity: 0.55 }));
  bulb.position.set(x, 2.3, z);
  mark(bulb, zoneId);
  parent.add(bulb);
}

function fence(parent, x, z, rot, zoneId) {
  const g = new THREE.Group();
  rbox(3.2, 0.1, 0.1, 0x8b5a2b, 0, 0.82, 0, g, zoneId, 0.03);
  rbox(3.2, 0.1, 0.1, 0x8b5a2b, 0, 0.5, 0, g, zoneId, 0.03);
  [-1.4, 0, 1.4].forEach((px) => rbox(0.12, 1, 0.12, 0x6b4428, px, 0.52, 0, g, zoneId, 0.03));
  g.position.set(x, 0.12, z);
  g.rotation.y = rot;
  parent.add(g);
}

function boardStand(parent, x, z, zoneId, color = 0xfff6df) {
  rbox(0.14, 1.2, 0.14, 0x6b4428, x - 1, 0.72, z, parent, zoneId, 0.03);
  rbox(0.14, 1.2, 0.14, 0x6b4428, x + 1, 0.72, z, parent, zoneId, 0.03);
  rbox(2.4, 1.55, 0.12, color, x, 1.62, z, parent, zoneId, 0.05);
}

function crate(parent, x, z, zoneId, color = 0xc47a2c) {
  rbox(0.85, 0.7, 0.85, color, x, 0.95, z, parent, zoneId, 0.08);
}

function bush(parent, x, z, zoneId, color = 0x3f8f45, s = 1) {
  const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(0.38 * s, 0), mat(color));
  leaf.position.set(x, 0.85, z);
  mark(leaf, zoneId);
  parent.add(leaf);
}

function paintTexture(w, h, draw) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  draw(canvas.getContext("2d"));
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function paintYinYang() {
  return paintTexture(256, 256, (ctx) => {
    ctx.clearRect(0, 0, 256, 256);
    ctx.beginPath();
    ctx.arc(128, 128, 120, 0, Math.PI * 2);
    ctx.fillStyle = "#1a1a22";
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.fillStyle = "#f4f0e6";
    ctx.beginPath();
    ctx.arc(128, 128, 120, -Math.PI / 2, Math.PI / 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(128, 68, 60, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#1a1a22";
    ctx.beginPath();
    ctx.arc(128, 188, 60, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(128, 68, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#f4f0e6";
    ctx.beginPath();
    ctx.arc(128, 188, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.beginPath();
    ctx.arc(128, 128, 120, 0, Math.PI * 2);
    ctx.strokeStyle = "#d7d2c8";
    ctx.lineWidth = 6;
    ctx.stroke();
  });
}

function signPlane(w, h, tex, x, y, z, parent, zoneId) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex }));
  mesh.position.set(x, y, z);
  mark(mesh, zoneId);
  parent.add(mesh);
  return mesh;
}

function lantern(parent, x, z, zoneId, glow = 0xffd27a) {
  rbox(0.1, 1.55, 0.1, 0x4a4036, x, 1.05, z, parent, zoneId, 0.03);
  const bulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 12, 10),
    mat(0xfff1b8, { emissive: glow, emissiveIntensity: 0.85 }),
  );
  bulb.position.set(x, 1.95, z);
  mark(bulb, zoneId);
  parent.add(bulb);
}

function dressDaily(group, zone) {
  house(group, -4.8, 3.2, zone, 7.2, 5.2);
  rbox(1.7, 6.1, 1.7, 0xf4efe4, 6.2, 3.55, 4.4, group, zone.id, 0.14);
  rbox(2.05, 0.3, 2.05, 0xd45b4a, 6.2, 6.7, 4.4, group, zone.id, 0.08);
  const clockTex = paintTexture(256, 256, (ctx) => {
    ctx.fillStyle = "#fff6df";
    ctx.beginPath();
    ctx.arc(128, 128, 120, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#245c40";
    ctx.lineWidth = 12;
    ctx.stroke();
    ctx.fillStyle = "#3f9f6d";
    for (let i = 0; i < 12; i += 1) {
      const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
      ctx.beginPath();
      ctx.arc(128 + Math.cos(a) * 96, 128 + Math.sin(a) * 96, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = "#d45b4a";
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(128, 128);
    ctx.lineTo(128, 52);
    ctx.stroke();
    ctx.strokeStyle = "#245c40";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(128, 128);
    ctx.lineTo(188, 128);
    ctx.stroke();
    ctx.fillStyle = "#d45b4a";
    ctx.beginPath();
    ctx.arc(128, 128, 9, 0, Math.PI * 2);
    ctx.fill();
  });
  const clock = new THREE.Mesh(new THREE.CircleGeometry(0.58, 24), new THREE.MeshBasicMaterial({ map: clockTex }));
  clock.position.set(6.2, 4.9, 5.29);
  mark(clock, zone.id);
  group.add(clock);

  rbox(5.4, 2.55, 0.22, 0x245c40, 2.2, 2.12, -1.1, group, zone.id, 0.06);
  const todayTex = paintTexture(512, 256, (ctx) => {
    ctx.fillStyle = "#e8f6ee";
    ctx.fillRect(0, 0, 512, 256);
    ctx.fillStyle = "#245c40";
    ctx.font = "800 64px Segoe UI, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("TODAY", 256, 78);
    ctx.font = "700 28px Segoe UI, sans-serif";
    ["top 3 outcomes", "one memory pick", "keep Telegram calm"].forEach((line, i) => {
      ctx.fillStyle = "#3f9f6d";
      ctx.beginPath();
      ctx.arc(86, 128 + i * 36, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#245c40";
      ctx.textAlign = "left";
      ctx.fillText(line, 108, 138 + i * 36);
    });
  });
  signPlane(4.5, 1.95, todayTex, 2.2, 2.14, -0.96, group, zone.id);

  [-0.2, 1.5, 3.2, 4.9].forEach((x, i) => {
    const colors = [0xe8f6ee, 0xfff6df, 0xffe08a, 0xf4c7b8];
    boardStand(group, x - 3.4, 5.5, zone.id, colors[i]);
  });

  rbox(0.55, 1.05, 0.42, 0x3f9f6d, 6.9, 1.28, -2.4, group, zone.id, 0.06);
  rbox(0.62, 0.18, 0.22, 0xd45b4a, 6.9, 1.88, -2.4, group, zone.id, 0.04);
  crate(group, 6.6, -1.15, zone.id, 0xd4a24a);
  crate(group, 5.45, -0.35, zone.id, 0xc47a2c);
  crate(group, 7.05, 0.35, zone.id, 0x3f9f6d);

  rbox(0.22, 2.9, 0.22, 0x8a5a32, -7.2, 1.9, 5.6, group, zone.id, 0.04);
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.55, 0.78), mat(0x3f9f6d, { side: THREE.DoubleSide }));
  flag.position.set(-6.35, 2.95, 5.6);
  mark(flag, zone.id);
  group.add(flag);
  [-2.4, 0.2, 2.8].forEach((x, i) => {
    const pennant = new THREE.Mesh(
      new THREE.PlaneGeometry(0.7, 0.38),
      mat([0xffe08a, 0xe35d6a, 0x7ec8e8][i], { side: THREE.DoubleSide }),
    );
    pennant.position.set(x, 3.15, 6.05);
    mark(pennant, zone.id);
    group.add(pennant);
  });
  rbox(6.2, 0.06, 0.06, 0x8a5a32, 0.2, 3.38, 6.05, group, zone.id, 0.02);
  bush(group, 7.2, 5.8, zone.id, 0x3f9f6d, 1.25);
  bush(group, -7.4, -3.2, zone.id, 0x2f7a48, 1);
}

function dressDecisions(group, zone) {
  house(group, -5.4, 3.4, zone, 5.6, 4.6);
  rbox(4.2, 3.4, 4.2, 0xf7eed8, 5.2, 2, 3.2, group, zone.id, 0.18);
  rbox(4.6, 0.4, 4.6, 0xc47a2c, 5.2, 3.85, 3.2, group, zone.id, 0.1);
  rbox(0.7, 1.6, 0.12, 0x4a3422, 5.2, 1.15, 5.35, group, zone.id, 0.04);

  const makeGate = (x, color, label, banner) => {
    rbox(0.28, 2.5, 0.28, color, x - 1.15, 1.55, -1.4, group, zone.id, 0.05);
    rbox(0.28, 2.5, 0.28, color, x + 1.15, 1.55, -1.4, group, zone.id, 0.05);
    rbox(2.7, 0.28, 0.28, color, x, 2.9, -1.4, group, zone.id, 0.06);
    const tex = paintTexture(256, 128, (ctx) => {
      ctx.fillStyle = banner;
      ctx.fillRect(0, 0, 256, 128);
      ctx.fillStyle = "#3a2a12";
      ctx.font = "800 56px Segoe UI, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(label, 128, 68);
    });
    signPlane(1.7, 0.5, tex, x, 3.32, -1.4, group, zone.id);
  };
  makeGate(-2.15, 0xe0b35a, "YES", "#ffe7a8");
  makeGate(2.15, 0xb8bec8, "NO", "#e8eaee");

  rbox(0.22, 1.7, 0.22, 0x6b4428, 0, 1.55, 0.55, group, zone.id, 0.04);
  rbox(3.2, 0.12, 0.16, 0xd4a24a, 0, 2.45, 0.55, group, zone.id, 0.03);
  rbox(0.7, 0.08, 0.7, 0xe0b35a, -1.35, 2.05, 0.55, group, zone.id, 0.08);
  rbox(0.7, 0.08, 0.7, 0xc8c8c8, 1.35, 2.05, 0.55, group, zone.id, 0.08);
  rbox(0.06, 0.42, 0.06, 0x6b4428, -1.35, 2.24, 0.55, group, zone.id, 0.02);
  rbox(0.06, 0.42, 0.06, 0x6b4428, 1.35, 2.24, 0.55, group, zone.id, 0.02);

  rbox(1.6, 1.05, 1.6, 0xe8d9b0, 0, 1.22, 2.35, group, zone.id, 0.1);
  rbox(0.32, 1.55, 0.32, 0x6b4428, 0, 2.2, 2.35, group, zone.id, 0.05);
  const markQ = new THREE.Mesh(
    new THREE.TorusGeometry(0.52, 0.12, 8, 20, Math.PI * 1.35),
    mat(0xd4a24a, { emissive: 0xd4a24a, emissiveIntensity: 0.35 }),
  );
  markQ.position.set(0, 3.55, 2.35);
  mark(markQ, zone.id);
  group.add(markQ);
  const qDot = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), mat(0xd4a24a, { emissive: 0xd4a24a, emissiveIntensity: 0.4 }));
  qDot.position.set(0, 2.95, 2.35);
  mark(qDot, zone.id);
  group.add(qDot);

  crate(group, -6.6, -4.8, zone.id, 0xe0b35a);
  crate(group, 6.6, -4.4, zone.id, 0x9a9a9a);
  crate(group, 5.5, -5.2, zone.id, 0xd4a24a);
  boardStand(group, -4.6, -5.8, zone.id, 0xfff1c8);
  boardStand(group, 4.8, -5.8, zone.id, 0xe8e8e8);
  const boardLabel = (x, z, text, bg) => {
    const tex = paintTexture(256, 160, (ctx) => {
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, 256, 160);
      ctx.fillStyle = "#3a2a12";
      ctx.font = "800 78px Segoe UI, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(text, 128, 86);
    });
    signPlane(2.05, 1.15, tex, x, 1.62, z + 0.08, group, zone.id);
  };
  boardLabel(-4.6, -5.8, "YES", "#ffe7a8");
  boardLabel(4.8, -5.8, "NO", "#eceff3");
  lantern(group, -3.4, -3.2, zone.id, 0xffc14d);
  lantern(group, 3.4, -3.2, zone.id, 0xd7dee4);
}

function dressReflect(group, zone) {
  house(group, -5.6, 3.1, zone, 5.4, 4.4);
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(2.7, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({
      color: 0xa8c4ff,
      transparent: true,
      opacity: 0.48,
      roughness: 0.08,
      metalness: 0.28,
      emissive: 0x6b8cff,
      emissiveIntensity: 0.12,
    }),
  );
  dome.position.set(4.4, 1.2, 3.4);
  mark(dome, zone.id);
  group.add(dome);
  rbox(4.7, 0.7, 4.7, 0xeaf0fb, 4.4, 0.95, 3.4, group, zone.id, 0.14);
  const pond = new THREE.Mesh(
    new THREE.CircleGeometry(2.35, 28),
    mat(0x4f8ec4, { roughness: 0.08, metalness: 0.35, emissive: 0x245c80, emissiveIntensity: 0.18 }),
  );
  pond.rotation.x = -Math.PI / 2;
  pond.position.set(0.1, 0.73, -3.4);
  mark(pond, zone.id);
  group.add(pond);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(2.45, 0.1, 8, 28), mat(0xb8d4e8));
  rim.rotation.x = Math.PI / 2;
  rim.position.set(0.1, 0.74, -3.4);
  mark(rim, zone.id);
  group.add(rim);
  rbox(2.9, 0.2, 0.8, 0x6b5b8c, -0.15, 0.9, -1.05, group, zone.id, 0.08);
  [-1.7, -0.4, 0.9, 2.0].forEach((x, i) => {
    const stone = new THREE.Mesh(new THREE.IcosahedronGeometry(0.28 + (i % 2) * 0.07, 0), mat(0xc5c0d4));
    stone.position.set(x, 0.86, -5.15);
    mark(stone, zone.id);
    group.add(stone);
  });
  [-1.1, 0.35, 1.55].forEach((x, i) => {
    const lily = new THREE.Mesh(new THREE.CircleGeometry(0.22 + i * 0.04, 10), mat(0xd9ecff, { emissive: 0x8cb4ff, emissiveIntensity: 0.25 }));
    lily.rotation.x = -Math.PI / 2;
    lily.position.set(x, 0.76, -3.15 + i * 0.15);
    mark(lily, zone.id);
    group.add(lily);
  });
  rbox(0.12, 2.35, 0.12, 0x4a4036, 0.15, 1.55, 6.05, group, zone.id, 0.03);
  const moon = new THREE.Mesh(
    new THREE.SphereGeometry(0.48, 18, 14),
    mat(0xfff4cc, { emissive: 0xffe7a0, emissiveIntensity: 0.7 }),
  );
  moon.position.set(0.15, 2.95, 6.05);
  mark(moon, zone.id);
  group.add(moon);
  const crescent = new THREE.Mesh(new THREE.SphereGeometry(0.4, 16, 12), mat(0x4c63c7, { roughness: 0.45 }));
  crescent.position.set(0.32, 2.98, 6.22);
  mark(crescent, zone.id);
  group.add(crescent);
  lantern(group, -2.6, -1.6, zone.id, 0xb7c8ff);
  lantern(group, 2.7, -1.8, zone.id, 0xffd27a);
  lantern(group, -2.2, -5.2, zone.id, 0xb7c8ff);
  lantern(group, 2.4, -5.1, zone.id, 0xffd27a);

  const yinTex = paintYinYang();
  const yinFloor = new THREE.Mesh(new THREE.CircleGeometry(0.95, 32), new THREE.MeshBasicMaterial({ map: yinTex }));
  yinFloor.rotation.x = -Math.PI / 2;
  yinFloor.position.set(-6.55, 0.64, -6.15);
  mark(yinFloor, zone.id);
  group.add(yinFloor);
  rbox(0.1, 1.35, 0.1, 0x4a4036, 7.15, 1.02, -6.2, group, zone.id, 0.03);
  const yinStand = new THREE.Mesh(new THREE.CircleGeometry(0.62, 32), new THREE.MeshBasicMaterial({ map: yinTex }));
  yinStand.position.set(7.15, 1.95, -6.12);
  mark(yinStand, zone.id);
  group.add(yinStand);

  rbox(1.45, 0.05, 0.58, 0x7eb8a2, 6.15, 0.66, -0.15, group, zone.id, 0.02);
  rbox(1.45, 0.05, 0.58, 0xc9b8e8, 6.55, 0.66, 0.85, group, zone.id, 0.02);
  const cushionA = new THREE.Mesh(new THREE.SphereGeometry(0.32, 14, 10), mat(0x6b8cff));
  cushionA.scale.set(1, 0.38, 1);
  cushionA.position.set(5.85, 0.78, 2.15);
  mark(cushionA, zone.id);
  group.add(cushionA);
  const cushionB = new THREE.Mesh(new THREE.SphereGeometry(0.28, 14, 10), mat(0xeaf0fb));
  cushionB.scale.set(1, 0.36, 1);
  cushionB.position.set(6.55, 0.76, 2.55);
  mark(cushionB, zone.id);
  group.add(cushionB);
  const bowl = new THREE.Mesh(
    new THREE.SphereGeometry(0.2, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2),
    mat(0xe0b35a, { metalness: 0.45, roughness: 0.28 }),
  );
  bowl.position.set(3.55, 0.72, 0.35);
  mark(bowl, zone.id);
  group.add(bowl);
  rbox(0.04, 0.28, 0.04, 0x6b4428, 3.82, 0.84, 0.35, group, zone.id, 0.01);
  rbox(0.55, 0.16, 0.55, 0xd8c4a0, 3.55, 0.7, 0.35, group, zone.id, 0.08);

  bush(group, 6.8, -5.2, zone.id, 0x4c63c7, 1.3);
  bush(group, 7.2, 5.6, zone.id, 0x6b8cff, 1.15);
  bush(group, -7.2, -5, zone.id, 0x5a7adf, 1.2);
}

function buildVillageDeck(zone) {
  const group = new THREE.Group();
  group.position.set(zone.x, 0.15, zone.z);
  group.userData.zoneId = zone.id;

  if (zone.id === "daily") {
    rbox(18.4, 0.55, 18.4, 0x7a4f28, 0, 0.18, 0, group, zone.id, 0.16);
    rbox(17.2, 0.22, 17.2, 0xf3e2b8, 0, 0.48, 0, group, zone.id, 0.1);
    rbox(18.8, 0.22, 18.8, 0x3f9f6d, 0, 0.08, 0, group, zone.id, 0.08);
    for (let i = -3; i <= 3; i += 1) {
      rbox(14.6, 0.04, 0.1, 0x3f9f6d, 0, 0.61, i * 1.75, group, zone.id, 0.02);
    }
  } else if (zone.id === "decisions") {
    rbox(18.4, 0.55, 18.4, 0x6a4a22, 0, 0.18, 0, group, zone.id, 0.16);
    rbox(8.35, 0.22, 17.2, 0xf3c453, -4.35, 0.48, 0, group, zone.id, 0.1);
    rbox(8.35, 0.22, 17.2, 0x8e97a8, 4.35, 0.48, 0, group, zone.id, 0.1);
    rbox(1.2, 0.26, 17.2, 0xf7f2e6, 0, 0.52, 0, group, zone.id, 0.06);
    rbox(18.8, 0.22, 18.8, 0xd4a24a, 0, 0.08, 0, group, zone.id, 0.08);
  } else {
    rbox(18.4, 0.55, 18.4, 0x3a4560, 0, 0.18, 0, group, zone.id, 0.16);
    rbox(17.2, 0.22, 17.2, 0xc5d0e6, 0, 0.48, 0, group, zone.id, 0.1);
    rbox(18.8, 0.22, 18.8, 0x6b8cff, 0, 0.08, 0, group, zone.id, 0.08);
  }

  lampPost(group, -7.2, -2, zone.id);
  lampPost(group, 7.2, -2, zone.id);
  fence(group, -7.4, 6.2, 0, zone.id);
  fence(group, 7.4, 6.2, 0, zone.id);

  if (zone.id === "daily") dressDaily(group, zone);
  else if (zone.id === "decisions") dressDecisions(group, zone);
  else dressReflect(group, zone);

  addLabel(group, zone.name, "pod", 5.1, zone.color);
  scene.add(group);
}

function paintCourt() {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 2048;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#2f9a57";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const m = 48;
  const left = m;
  const right = canvas.width - m;
  const top = m;
  const bottom = canvas.height - m;
  const midY = canvas.height / 2;
  const midX = canvas.width / 2;
  const singles = 92;
  const short = 302;
  const long = 116;

  ctx.strokeStyle = "#ffffff";
  ctx.lineJoin = "miter";
  ctx.lineCap = "butt";
  ctx.lineWidth = 16;
  ctx.strokeRect(left, top, right - left, bottom - top);
  ctx.lineWidth = 12;
  ctx.strokeRect(left + singles, top, right - left - singles * 2, bottom - top);

  ctx.beginPath();
  ctx.moveTo(left, midY);
  ctx.lineTo(right, midY);
  ctx.moveTo(left + singles, midY - short);
  ctx.lineTo(right - singles, midY - short);
  ctx.moveTo(left + singles, midY + short);
  ctx.lineTo(right - singles, midY + short);
  ctx.moveTo(left, top + long);
  ctx.lineTo(right, top + long);
  ctx.moveTo(left, bottom - long);
  ctx.lineTo(right, bottom - long);
  ctx.moveTo(midX, midY - short);
  ctx.lineTo(midX, top + long);
  ctx.moveTo(midX, midY + short);
  ctx.lineTo(midX, bottom - long);
  ctx.stroke();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

function buildCourt() {
  const group = new THREE.Group();
  group.position.set(19, 0.18, 19);
  group.userData.zoneId = "court";

  const length = 20.4;
  const width = 9.3;
  const halfW = width / 2;

  rbox(width + 2.4, 0.28, length + 2.4, 0xc9a36a, 0, 0.1, 0, group, "court", 0.12);
  rbox(width + 2.8, 0.1, length + 2.8, 0xe35d6a, 0, 0.02, 0, group, "court", 0.06);

  const surface = new THREE.Mesh(
    new THREE.PlaneGeometry(width, length),
    new THREE.MeshStandardMaterial({ map: paintCourt(), roughness: 0.48, metalness: 0.02 }),
  );
  surface.rotation.x = -Math.PI / 2;
  surface.position.y = 0.28;
  mark(surface, "court");
  group.add(surface);

  rbox(0.11, 2.2, 0.11, 0xf4f4f4, -halfW, 1.38, 0, group, "court", 0.03);
  rbox(0.11, 2.2, 0.11, 0xf4f4f4, halfW, 1.38, 0, group, "court", 0.03);
  rbox(width + 0.1, 0.07, 0.07, 0xf4f4f4, 0, 2.48, 0, group, "court", 0.02);

  const net = new THREE.Mesh(
    new THREE.PlaneGeometry(width - 0.2, 1.12, 16, 8),
    new THREE.MeshStandardMaterial({
      color: 0xf2f2f2,
      transparent: true,
      opacity: 0.4,
      side: THREE.DoubleSide,
      roughness: 0.85,
    }),
  );
  net.position.set(0, 1.9, 0);
  mark(net, "court");
  group.add(net);
  rbox(width - 0.12, 0.05, 0.05, 0xf4f4f4, 0, 1.32, 0, group, "court", 0.02);

  rbox(2.2, 0.22, 0.62, 0x6b4428, -halfW - 1.2, 0.52, 3.8, group, "court", 0.06);
  rbox(0.55, 0.18, 0.55, 0xf4f1ea, -halfW - 1.2, 0.68, 3.8, group, "court", 0.08);
  rbox(2.2, 0.22, 0.62, 0x6b4428, halfW + 1.2, 0.52, -3.6, group, "court", 0.06);

  const benchX = halfW + 3.05;
  for (let row = 0; row < 4; row += 1) {
    const rx = benchX + row * 0.7;
    const ry = 0.42 + row * 0.4;
    rbox(1.15, 0.14, 12.4, 0x3a4a3c, rx, ry - 0.12, 0, group, "court", 0.04);
    rbox(0.98, 0.07, 12.2, 0xd7dee4, rx, ry + 0.04, 0, group, "court", 0.02);
    rbox(0.1, 0.34, 12.2, 0xd7dee4, rx - 0.4, ry + 0.22, 0, group, "court", 0.02);
    [-5.4, -1.8, 1.8, 5.4].forEach((sz) => {
      rbox(0.12, ry + 0.08, 0.12, 0x2f3c32, rx, (ry + 0.08) / 2, sz, group, "court", 0.03);
    });
  }
  rbox(2.6, 0.12, 12.6, 0x3a4a3c, benchX + 1.05, 0.18, 0, group, "court", 0.04);
  rbox(0.12, 1.85, 0.12, 0x2f3c32, benchX + 0.2, 1.05, -6.3, group, "court", 0.03);
  rbox(0.12, 1.85, 0.12, 0x2f3c32, benchX + 2.0, 1.05, -6.3, group, "court", 0.03);
  rbox(2.1, 0.08, 0.08, 0xd7dee4, benchX + 1.1, 1.95, -6.3, group, "court", 0.02);
  rbox(0.12, 1.85, 0.12, 0x2f3c32, benchX + 0.2, 1.05, 6.3, group, "court", 0.03);
  rbox(0.12, 1.85, 0.12, 0x2f3c32, benchX + 2.0, 1.05, 6.3, group, "court", 0.03);
  rbox(2.1, 0.08, 0.08, 0xd7dee4, benchX + 1.1, 1.95, 6.3, group, "court", 0.02);

  rbox(2.6, 1.55, 0.16, 0x243038, -halfW - 1.55, 1.45, -6.4, group, "court", 0.04);
  const scoreCanvas = document.createElement("canvas");
  scoreCanvas.width = 512;
  scoreCanvas.height = 256;
  const scoreCtx = scoreCanvas.getContext("2d");
  scoreCtx.fillStyle = "#e35d6a";
  scoreCtx.fillRect(0, 0, 512, 256);
  scoreCtx.fillStyle = "#fff8f2";
  scoreCtx.font = "800 140px Segoe UI, sans-serif";
  scoreCtx.textAlign = "center";
  scoreCtx.textBaseline = "middle";
  scoreCtx.fillText("2 / 8", 256, 128);
  const scoreTex = new THREE.CanvasTexture(scoreCanvas);
  scoreTex.colorSpace = THREE.SRGBColorSpace;
  const score = new THREE.Mesh(
    new THREE.PlaneGeometry(2.15, 1.05),
    new THREE.MeshBasicMaterial({ map: scoreTex }),
  );
  score.position.set(-halfW - 1.55, 1.48, -6.3);
  mark(score, "court");
  group.add(score);
  const stringCanvas = document.createElement("canvas");
  stringCanvas.width = 128;
  stringCanvas.height = 128;
  const stringCtx = stringCanvas.getContext("2d");
  stringCtx.strokeStyle = "rgba(255,248,240,0.78)";
  stringCtx.lineWidth = 1.15;
  for (let i = 12; i <= 116; i += 8) {
    stringCtx.beginPath();
    stringCtx.moveTo(i, 10);
    stringCtx.lineTo(i, 118);
    stringCtx.stroke();
    stringCtx.beginPath();
    stringCtx.moveTo(10, i);
    stringCtx.lineTo(118, i);
    stringCtx.stroke();
  }
  const stringTex = new THREE.CanvasTexture(stringCanvas);
  stringTex.colorSpace = THREE.SRGBColorSpace;

  const addRacket = (x, z, yaw, tilt, frameColor) => {
    const racket = new THREE.Group();
    const frame = new THREE.Mesh(
      new THREE.TorusGeometry(0.38, 0.03, 10, 28),
      mat(frameColor, { roughness: 0.32, metalness: 0.28 }),
    );
    frame.scale.set(1, 1.22, 1);
    frame.position.y = 0.98;
    mark(frame, "court");
    racket.add(frame);

    const strings = new THREE.Mesh(
      new THREE.CircleGeometry(0.35, 24),
      new THREE.MeshStandardMaterial({
        map: stringTex,
        transparent: true,
        opacity: 0.88,
        side: THREE.DoubleSide,
        roughness: 0.95,
      }),
    );
    strings.scale.set(1, 1.22, 1);
    strings.position.y = 0.98;
    mark(strings, "court");
    racket.add(strings);

    const shaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.02, 0.026, 0.52, 8),
      mat(0xf0ebe3, { roughness: 0.38, metalness: 0.18 }),
    );
    shaft.position.y = 0.36;
    mark(shaft, "court");
    racket.add(shaft);

    const throat = new THREE.Mesh(
      new THREE.CylinderGeometry(0.045, 0.022, 0.1, 8),
      mat(frameColor, { roughness: 0.35, metalness: 0.22 }),
    );
    throat.position.y = 0.64;
    mark(throat, "court");
    racket.add(throat);

    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.032, 0.2, 8), mat(0x2c3338, { roughness: 0.72 }));
    grip.position.y = 0.02;
    mark(grip, "court");
    racket.add(grip);

    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.032, 8, 8), mat(0x1c2124, { roughness: 0.6 }));
    cap.position.y = -0.09;
    mark(cap, "court");
    racket.add(cap);

    racket.position.set(x, 0.36, z);
    racket.rotation.order = "YXZ";
    racket.rotation.y = yaw;
    racket.rotation.z = tilt;
    group.add(racket);
  };

  addRacket(halfW + 2.05, 5.2, 0.55, -0.42, 0xe35d6a);
  addRacket(halfW + 2.4, 5.95, 0.92, -0.34, 0x3d8bfd);
  crate(group, -halfW - 1.3, 6.4, "court", 0xffffff);
  const shuttle = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), mat(0xf4f1ea));
  shuttle.position.set(-halfW - 1.3, 1.38, 6.4);
  mark(shuttle, "court");
  group.add(shuttle);

  addLabel(group, "Rally Court", "pod", 3.2, 0xe35d6a);
  scene.add(group);
}

ZONES.filter((z) => z.id !== "court").forEach(buildVillageDeck);
buildCourt();

const OBSTACLES = [];

function addCircle(x, z, r) {
  OBSTACLES.push({ x, z, r });
}

function addBox(x, z, hx, hz) {
  OBSTACLES.push({ x, z, hx, hz });
}

function registerObstacles() {
  addBox(-18 - 4.8, -18 + 3.2, 3.8, 2.8);
  addCircle(-18 + 6.2, -18 + 4.4, 1.35);
  addBox(-18 + 2.2, -18 - 1.1, 2.8, 0.55);
  addBox(-18 - 0.8, -18 + 5.5, 4.4, 0.7);
  addBox(18 - 5.4, -18 + 3.4, 3.1, 2.5);
  addBox(18 + 5.2, -18 + 3.2, 2.5, 2.4);
  addCircle(18, -18 + 2.35, 1.15);
  addBox(18 - 2.15, -18 - 1.4, 1.35, 0.4);
  addBox(18 + 2.15, -18 - 1.4, 1.35, 0.4);
  addBox(-18 - 5.6, 18 + 3.1, 3, 2.4);
  addCircle(-18 + 4.4, 18 + 3.4, 2.5);
  addCircle(-18 + 0.1, 18 - 3.6, 2.2);
  addCircle(-18 + 7.15, 18 - 6.2, 0.55);
  addBox(19, 19, 4.9, 0.32);
  addBox(19 + 7.8, 19, 1.9, 6.4);
  addCircle(-8, 32, 1.6);
  addCircle(32, -8, 1.5);
  [
    [-8, -8, 1.1],
    [7, -10, 0.9],
    [-10, 8, 1],
    [9, 6, 0.85],
    [-32, -4, 1.2],
    [32, 3, 1],
    [4, 32, 1.15],
    [-3, -32, 0.95],
  ].forEach(([x, z, s]) => addCircle(x, z, 0.7 * s));
}
registerObstacles();

function obstacleGap(x, z, o) {
  if (o.hx != null) {
    const dx = Math.max(Math.abs(x - o.x) - o.hx, 0);
    const dz = Math.max(Math.abs(z - o.z) - o.hz, 0);
    return Math.hypot(dx, dz);
  }
  return Math.hypot(x - o.x, z - o.z) - o.r;
}

function blocked(x, z, pad = 0.75) {
  return OBSTACLES.some((o) => obstacleGap(x, z, o) < pad);
}

function shoveOut(x, z) {
  let best = null;
  let bestGap = -1;
  for (let i = 0; i < 20; i += 1) {
    const a = (i / 20) * Math.PI * 2;
    const px = x + Math.cos(a) * 3.2;
    const pz = z + Math.sin(a) * 3.2;
    if (px * px + pz * pz > 37 * 37 || blocked(px, pz, 0.9)) continue;
    let gap = 99;
    for (const obstacle of OBSTACLES) gap = Math.min(gap, obstacleGap(px, pz, obstacle));
    if (gap > bestGap) {
      bestGap = gap;
      best = { x: px, z: pz };
    }
  }
  return best || nearestOpen(x, z);
}

function nearestOpen(x, z) {
  if (!blocked(x, z, 0.9) && x * x + z * z < 38 * 38) return { x, z };
  for (let ring = 1; ring <= 8; ring += 1) {
    for (let i = 0; i < 16; i += 1) {
      const a = (i / 16) * Math.PI * 2 + ring;
      const px = x + Math.cos(a) * ring * 1.8;
      const pz = z + Math.sin(a) * ring * 1.8;
      if (px * px + pz * pz < 38 * 38 && !blocked(px, pz, 0.9)) return { x: px, z: pz };
    }
  }
  return { x: 0, z: 8 };
}

function openPoint(x, z) {
  return nearestOpen(x, z);
}

function steerDir(x, z, tx, tz) {
  let vx = tx - x;
  let vz = tz - z;
  let len = Math.hypot(vx, vz) || 1;
  vx /= len;
  vz /= len;
  for (const o of OBSTACLES) {
    const gap = obstacleGap(x, z, o);
    const feel = 1.05;
    if (gap >= feel) continue;
    const toX = o.x - x;
    const toZ = o.z - z;
    if (toX * vx + toZ * vz <= 0) continue;
    let px = -vz;
    let pz = vx;
    if (toX * px + toZ * pz > 0) {
      px = -px;
      pz = -pz;
    }
    const w = (1 - Math.max(gap, 0) / feel) ** 2;
    vx += px * 1.9 * w;
    vz += pz * 1.9 * w;
    const away = Math.hypot(x - o.x, z - o.z) || 1;
    vx += ((x - o.x) / away) * 0.7 * w;
    vz += ((z - o.z) / away) * 0.7 * w;
  }
  len = Math.hypot(vx, vz) || 1;
  return { x: vx / len, z: vz / len };
}

function path(x1, z1, x2, z2) {
  const dx = x2 - x1;
  const dz = z2 - z1;
  const mesh = new THREE.Mesh(new RoundedBoxGeometry(1.35, 0.1, Math.hypot(dx, dz), 2, 0.05), mat(0xd2b48c));
  mesh.position.set((x1 + x2) / 2, 0.08, (z1 + z2) / 2);
  mesh.rotation.y = Math.atan2(dx, dz);
  mesh.receiveShadow = true;
  scene.add(mesh);
}
path(-18, -18, 0, 0);
path(18, -18, 0, 0);
path(-18, 18, 0, 0);
path(19, 19, 0, 0);

function lookout(x, z) {
  const g = new THREE.Group();
  rbox(1.1, 4.2, 1.1, 0xc9a36a, 0, 2.2, 0, g, null, 0.1);
  rbox(2.4, 0.18, 2.4, 0x8a5a32, 0, 4.4, 0, g, null, 0.06);
  rbox(0.12, 0.7, 2.2, 0x6b4428, -1.05, 4.8, 0, g, null, 0.03);
  rbox(0.12, 0.7, 2.2, 0x6b4428, 1.05, 4.8, 0, g, null, 0.03);
  rbox(2.2, 0.7, 0.12, 0x6b4428, 0, 4.8, -1.05, g, null, 0.03);
  rbox(2.2, 0.7, 0.12, 0x6b4428, 0, 4.8, 1.05, g, null, 0.03);
  g.position.set(x, 0, z);
  scene.add(g);
}
lookout(-8, 32);

function windmill(x, z) {
  const g = new THREE.Group();
  rbox(1.4, 6.2, 1.4, 0xf4efe4, 0, 3.2, 0, g, null, 0.12);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(1.15, 1.3, 4), mat(0xd45b4a, { roughness: 0.55 }));
  cap.position.y = 6.9;
  cap.rotation.y = Math.PI / 4;
  g.add(cap);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.4, 10), mat(0x8a5a32));
  hub.rotation.z = Math.PI / 2;
  hub.position.set(0.85, 5.4, 0);
  g.add(hub);
  for (let i = 0; i < 4; i += 1) {
    const blade = new THREE.Mesh(new RoundedBoxGeometry(0.28, 3.4, 0.08, 2, 0.04), mat(0xfff6df));
    blade.position.set(1.05, 5.4, 0);
    blade.rotation.x = (i * Math.PI) / 2;
    g.add(blade);
  }
  g.position.set(x, 0, z);
  scene.add(g);
}
windmill(32, -8);

function pier() {
  const g = new THREE.Group();
  rbox(2.4, 0.16, 8.2, 0xc9a36a, 0, 0.18, 0, g, null, 0.06);
  [-3.4, -1.1, 1.1, 3.4].forEach((z) => {
    rbox(0.16, 0.7, 0.16, 0x8a5a32, -1, -0.1, z, g, null, 0.03);
    rbox(0.16, 0.7, 0.16, 0x8a5a32, 1, -0.1, z, g, null, 0.03);
  });
  g.position.set(0, 0, 44);
  scene.add(g);
}
pier();

const STATION = {
  id: "station",
  name: "UFO Dock",
  subtitle: "Agents pop in from the saucer",
  schedule: "Beam down, wander, beam back up",
  color: 0x5cbc9a,
  x: 0,
  z: 0,
  items: [
    { badge: "beam", text: "New agents pop out of the UFO light" },
    { badge: "loop", text: "The crew can walk under it and get picked back up" },
  ],
};

const HATCH = { x: 0, z: 0 };
const UFO_Y = 5.6;

const cinemaCanvas = document.createElement("canvas");
cinemaCanvas.width = 512;
cinemaCanvas.height = 288;
const cinemaCtx = cinemaCanvas.getContext("2d");
const cinemaTex = new THREE.CanvasTexture(cinemaCanvas);
cinemaTex.colorSpace = THREE.SRGBColorSpace;
let lastCinemaFrame = -Infinity;

function paintCinema(t, force = false) {
  // Uploading a 512x288 canvas texture every render frame is expensive on
  // integrated GPUs. Ten updates per second still looks animated.
  if (!force && t - lastCinemaFrame < 0.1) return;
  lastCinemaFrame = t;
  const ctx = cinemaCtx;
  ctx.fillStyle = "#071018";
  ctx.fillRect(0, 0, 512, 288);
  for (let i = 0; i < 50; i += 1) {
    const x = (i * 73 + t * 40) % 520;
    const y = (i * 37 + Math.sin(t + i) * 8) % 288;
    ctx.fillStyle = `rgba(255,255,255,${0.25 + (i % 5) * 0.12})`;
    ctx.fillRect(x, y, 2, 2);
  }
  ctx.fillStyle = "rgba(80, 200, 180, 0.18)";
  ctx.fillRect(0, 210, 512, 78);
  const walk = (t * 70) % 640 - 60;
  ctx.fillStyle = "#d8fff4";
  ctx.beginPath();
  ctx.ellipse(walk, 232, 16, 28, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(walk - 11, 232, 22, 36);
  ctx.fillStyle = "#7fd3c0";
  ctx.font = "700 28px Segoe UI, sans-serif";
  ctx.fillText("NEW ARRIVAL", 150, 48);
  ctx.fillStyle = "rgba(255,255,255,0.72)";
  ctx.font = "16px Segoe UI, sans-serif";
  ctx.fillText("popping out of the UFO", 158, 82);
  cinemaTex.needsUpdate = true;
}
paintCinema(0, true);

function buildUfo() {
  const root = new THREE.Group();
  root.userData.zoneId = "station";

  const pad = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.4, 0.16, 36), mat(0xd7c49a));
  pad.position.y = 0.08;
  mark(pad, "station");
  root.add(pad);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(3.15, 0.1, 10, 40),
    mat(0x5cbc9a, { emissive: 0x2a8f7c, emissiveIntensity: 0.45 }),
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.16;
  mark(ring, "station");
  root.add(ring);

  const craft = new THREE.Group();
  craft.position.y = UFO_Y;
  root.add(craft);

  const saucer = new THREE.Mesh(
    new THREE.SphereGeometry(3.15, 36, 20),
    mat(0xe8eef4, { metalness: 0.28, roughness: 0.32 }),
  );
  saucer.scale.set(1, 0.26, 1);
  mark(saucer, "station");
  craft.add(saucer);

  const lip = new THREE.Mesh(
    new THREE.TorusGeometry(2.55, 0.16, 10, 40),
    mat(0x5cbc9a, { emissive: 0x2a8f7c, emissiveIntensity: 0.55 }),
  );
  lip.rotation.x = Math.PI / 2;
  mark(lip, "station");
  craft.add(lip);

  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(1.25, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({
      color: 0xb9d7ff,
      transparent: true,
      opacity: 0.38,
      roughness: 0.06,
      metalness: 0.28,
    }),
  );
  dome.position.y = 0.35;
  mark(dome, "station");
  craft.add(dome);

  const lights = [];
  for (let i = 0; i < 10; i += 1) {
    const bulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 10, 8),
      mat(0xfff1b0, { emissive: 0xffd56a, emissiveIntensity: 0.9 }),
    );
    const a = (i / 10) * Math.PI * 2;
    bulb.position.set(Math.cos(a) * 2.55, -0.05, Math.sin(a) * 2.55);
    craft.add(bulb);
    lights.push(bulb);
  }

  const screen = new THREE.Mesh(
    new THREE.CircleGeometry(0.72, 24),
    new THREE.MeshBasicMaterial({ map: cinemaTex }),
  );
  screen.position.set(0, -0.55, 0);
  screen.rotation.x = -Math.PI / 2;
  mark(screen, "station");
  craft.add(screen);

  const beam = new THREE.Mesh(
    new THREE.ConeGeometry(1.55, 5.3, 28, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0x7fffd4,
      transparent: true,
      opacity: 0.16,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  beam.position.y = -2.65;
  mark(beam, "station");
  craft.add(beam);

  const glow = new THREE.PointLight(0x7fd3c0, 2.2, 16);
  glow.position.set(0, -1.4, 0);
  craft.add(glow);

  addLabel(root, "UFO Dock", "pod", 8.2, 0x5cbc9a);
  scene.add(root);
  return { root, craft, beam, lights, ring };
}

const ship = buildUfo();

function tagBot(root, data) {
  root.traverse((child) => {
    child.userData.isBot = true;
    child.userData.botName = data.name;
  });
}

function makeBot(spec) {
  const home = ZONES.find((z) => z.id === spec.home);
  const accent = home ? home.color : spec.color;
  const g = new THREE.Group();

  const vinyl = new THREE.MeshPhysicalMaterial({
    color: 0xf4f6f8,
    roughness: 0.42,
    metalness: 0.02,
    clearcoat: 0.55,
    clearcoatRoughness: 0.28,
    sheen: 0.4,
    sheenColor: new THREE.Color(0xffffff),
  });

  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.5, 28, 22), vinyl);
  belly.scale.set(1.02, 1.08, 0.92);
  belly.position.y = 0.78;
  belly.castShadow = true;
  g.add(belly);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.34, 26, 20), vinyl);
  head.scale.set(1.08, 0.92, 1);
  head.position.y = 1.42;
  head.castShadow = true;
  g.add(head);

  const visor = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.055, 0.28, 8, 16),
    mat(0x14181c, { roughness: 0.35, metalness: 0.15 }),
  );
  visor.rotation.z = Math.PI / 2;
  visor.position.set(0, 1.44, 0.3);
  g.add(visor);

  const glint = new THREE.Mesh(
    new THREE.SphereGeometry(0.018, 8, 8),
    mat(0xffffff, { emissive: 0xffffff, emissiveIntensity: 0.9 }),
  );
  glint.position.set(-0.1, 1.455, 0.35);
  g.add(glint);
  const glintR = glint.clone();
  glintR.position.x = 0.1;
  g.add(glintR);

  const armor = new THREE.MeshPhysicalMaterial({
    color: accent,
    roughness: 0.4,
    metalness: 0.08,
    clearcoat: 0.5,
    clearcoatRoughness: 0.32,
    sheen: 0.35,
    sheenColor: new THREE.Color(0xffffff),
    emissive: accent,
    emissiveIntensity: 0.04,
  });

  const vest = new THREE.Mesh(
    new THREE.SphereGeometry(0.54, 28, 18, 0, Math.PI * 2, 0.55, 1.85),
    armor,
  );
  vest.scale.set(1.02, 1.08, 0.94);
  vest.position.y = 0.78;
  vest.castShadow = true;
  g.add(vest);

  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.048, 10, 22), armor);
  collar.rotation.x = Math.PI / 2;
  collar.position.y = 1.16;
  collar.castShadow = true;
  g.add(collar);

  const shoulderL = new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 12), armor);
  shoulderL.scale.set(1.15, 0.7, 1);
  shoulderL.position.set(-0.4, 1.08, 0.02);
  shoulderL.castShadow = true;
  g.add(shoulderL);
  const shoulderR = shoulderL.clone();
  shoulderR.position.x = 0.4;
  g.add(shoulderR);

  const armL = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.18, 8, 12), vinyl);
  armL.position.set(-0.52, 0.78, 0.02);
  armL.castShadow = true;
  g.add(armL);
  const armR = armL.clone();
  armR.position.x = 0.52;
  g.add(armR);

  const legL = new THREE.Mesh(new THREE.CapsuleGeometry(0.14, 0.12, 8, 12), vinyl);
  legL.position.set(-0.16, 0.28, 0.02);
  legL.castShadow = true;
  g.add(legL);
  const legR = legL.clone();
  legR.position.x = 0.16;
  g.add(legR);

  const lamp = new THREE.Mesh(
    new THREE.SphereGeometry(0.046, 12, 10),
    mat(0xfff6df, { roughness: 0.25, metalness: 0.2, emissive: 0xfff1c8, emissiveIntensity: 0.35 }),
  );
  lamp.position.set(0, 0.86, 0.5);
  g.add(lamp);

  const fromShip = spec.fromShip !== false;
  g.position.set(HATCH.x, fromShip ? UFO_Y - 0.4 : 0.12, HATCH.z);
  if (fromShip) g.scale.setScalar(0.12);

  const bubble = document.createElement("div");
  bubble.className = "speech";
  const bubbleObj = new CSS2DObject(bubble);
  bubbleObj.position.set(0, 3.15, 0);
  g.add(bubbleObj);

  g.userData = {
    ...spec,
    color: accent,
    isBot: true,
    tx: HATCH.x,
    tz: HATCH.z,
    wait: 0.2,
    mode: fromShip ? "beamDown" : "roam",
    beamT: spec.beamDelay ?? 0,
    aboard: false,
    visitor: !!spec.visitor,
    armL,
    armR,
    lamp,
    armor,
    bubble,
    nameTag: null,
    selected: false,
    walkY: 0.12,
    status: null,
    agent: null,
    tilt: 0,
  };
  const first = plotTarget(g);
  g.userData.tx = first.x;
  g.userData.tz = first.z;
  tagBot(g, spec);
  const nameTag = addLabel(g, spec.name, "bot", 2.05, accent);
  g.userData.nameTag = nameTag;
  g.userData.nameSpan = nameTag.querySelector("span:last-child");
  setBotStatus(g, spec.need ? "needs_input" : "idle");
  nameTag.dataset.bot = spec.name;
  nameTag.addEventListener("pointerdown", (event) => {
    event.stopPropagation();
    selectBot(g);
  });
  if (fromShip) {
    g.visible = (g.userData.beamT ?? 0) >= 0;
    nameTag.style.display = "none";
  }
  scene.add(g);
  return g;
}

const botMeshes = [];
BOTS.forEach((spec, i) => botMeshes.push(makeBot({ ...spec, beamDelay: -0.35 * i })));

const VISITORS = [
  { name: "Nova", home: null, color: 0xc084fc, objective: "Just popped out of the UFO.", need: false, visitor: true },
  { name: "Quill", home: null, color: 0xf4a261, objective: "Beam in, check the plots, beam back up.", need: false, visitor: true },
];
let nextVisitor = 0;
let visitorCooldown = 36;

function plotTarget(bot) {
  const home = ZONES.find((z) => z.id === bot.userData.home);
  const dest = home && Math.random() < 0.7 ? home : ZONES[Math.floor(Math.random() * ZONES.length)];
  const spread = dest.id === "court" ? 3.4 : 6.2;
  const raw = { x: dest.x + (Math.random() - 0.5) * spread, z: dest.z + (Math.random() - 0.5) * spread };
  if (dest.id === "court") raw.x = dest.x + (Math.random() < 0.5 ? -2.8 : 2.4);
  return openPoint(raw.x, raw.z);
}

function shipTarget() {
  return { x: HATCH.x + (Math.random() - 0.5) * 0.35, z: HATCH.z + (Math.random() - 0.5) * 0.35 };
}

function pickTarget(bot) {
  if (bot.userData.visitor && Math.random() < 0.45) return shipTarget();
  if (Math.random() < 0.28) return shipTarget();
  return plotTarget(bot);
}

function setBotAboard(bot, aboard) {
  bot.visible = !aboard;
  bot.userData.aboard = aboard;
  if (bot.userData.nameTag) bot.userData.nameTag.style.display = aboard ? "none" : "";
  if (aboard) {
    bot.userData.bubble.className = "speech";
    bot.userData.bubble.textContent = "";
  }
}

function spawnVisitor() {
  if (botMeshes.some((bot) => bot.userData.visitor)) return;
  const spec = VISITORS[nextVisitor % VISITORS.length];
  nextVisitor += 1;
  botMeshes.push(makeBot({ ...spec, fromShip: true, beamDelay: 0 }));
  refreshCounts();
}

function dismissVisitor(bot) {
  const idx = botMeshes.indexOf(bot);
  if (idx >= 0) botMeshes.splice(idx, 1);
  scene.remove(bot);
  refreshCounts();
}

function deckHeightAt(x, z) {
  for (const zone of ZONES) {
    if (zone.id === "court") {
      if (Math.abs(x - zone.x) < 6.4 && Math.abs(z - zone.z) < 11.4) return 0.42;
      continue;
    }
    if (Math.abs(x - zone.x) < 9.15 && Math.abs(z - zone.z) < 9.15) return 0.72;
  }
  return 0.12;
}

function homeSpot(bot) {
  const home = ZONES.find((z) => z.id === bot.userData.home);
  if (!home) return { x: HATCH.x, z: HATCH.z };
  if (home.id === "court") return openPoint(home.x - 3.1, home.z + 5.2);
  return openPoint(home.x, home.z + 1.4);
}

function sendHome(bot) {
  const dest = homeSpot(bot);
  const data = bot.userData;
  data.mode = "goHome";
  data.tx = dest.x;
  data.tz = dest.z;
  data.wait = 60;
  data.afterBeam = null;
}

function clearBotSelection() {
  botMeshes.forEach((bot) => {
    bot.userData.selected = false;
    bot.userData.bubble.className = "speech";
    bot.userData.bubble.textContent = "";
  });
}

function setBotStatus(bot, status) {
  const data = bot.userData;
  if (!STATUS_GLYPH.hasOwnProperty(status)) status = "idle";
  if (data.status === status) return;
  data.status = status;
  const tint = STATUS_COLOR[status] ?? data.color;
  data.armor.color.set(tint);
  data.armor.emissive.set(tint);
  data.armor.emissiveIntensity = STATUS_COLOR[status] ? 0.18 : 0.04;
  data.lamp.material.emissive.set(status === "down" ? 0xff5a5a : STATUS_COLOR[status] ?? 0xfff1c8);
  if (data.nameSpan) {
    const glyph = STATUS_GLYPH[status];
    data.nameSpan.innerHTML = `${glyph ? `<span class="status ${status}">${glyph}</span>` : ""}${data.name}`;
  }
  if (status === "down") {
    if (!["beamDown", "beamUp"].includes(data.mode) && !data.aboard) {
      data.mode = "down";
      data.tilt = 0;
    }
  } else if (data.mode === "down") {
    data.mode = "roam";
    data.wait = 0.5;
  }
}

function relativeTime(iso) {
  if (!iso) return "never";
  const diff = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(diff)) return "unknown";
  const abs = Math.abs(diff);
  const unit =
    abs < 60_000 ? [Math.round(abs / 1000), "s"] :
    abs < 3_600_000 ? [Math.round(abs / 60_000), "m"] :
    abs < 86_400_000 ? [Math.round(abs / 3_600_000), "h"] :
    [Math.round(abs / 86_400_000), "d"];
  return diff >= 0 ? `${unit[0]}${unit[1]} ago` : `in ${unit[0]}${unit[1]}`;
}

function runnerIsStale(state) {
  if (state.demo) return false;
  const beat = state.runner?.heartbeatAt ? new Date(state.runner.heartbeatAt).getTime() : 0;
  const grace = Math.max(90, (state.runner?.tickSec ?? 10) * 6) * 1000;
  return Date.now() - beat > grace;
}

function applyState(state) {
  agentState = state;
  const stale = runnerIsStale(state);
  runnerHealth = state.demo ? "demo" : stale ? "stale" : state.runner?.ollama === "down" ? "ollama down" : "live";
  const seen = new Set();
  for (const agent of state.agents ?? []) {
    const id = String(agent.id ?? agent.name ?? "").toLowerCase();
    if (!id) continue;
    seen.add(id);
    let bot = botMeshes.find((b) => !b.userData.visitor && b.userData.name.toLowerCase() === id);
    if (!bot) {
      const home = ZONES.find((z) => z.id === agent.home);
      bot = makeBot({
        name: agent.name ?? id,
        home: home ? home.id : null,
        color: 0x8a96a4,
        objective: agent.task || "No task assigned.",
        fromShip: true,
        beamDelay: 0,
      });
      botMeshes.push(bot);
    }
    const data = bot.userData;
    data.agent = agent;
    if (agent.task) data.objective = agent.task;
    setBotStatus(bot, stale ? "unknown" : agent.status ?? "idle");
  }
  for (const bot of botMeshes) {
    if (bot.userData.visitor || seen.has(bot.userData.name.toLowerCase())) continue;
    bot.userData.agent = null;
    setBotStatus(bot, "idle");
  }
  refreshCounts();
  if (followBot?.userData) renderBotCard(followBot);
}

async function loadState() {
  for (const url of STATE_URLS) {
    try {
      const res = await fetch(`${url}?t=${Date.now()}`, { cache: "no-store" });
      if (!res.ok) continue;
      return await res.json();
    } catch {
      // try the next source
    }
  }
  return null;
}

async function pollState() {
  if (document.hidden) {
    window.setTimeout(pollState, STATE_POLL_MS);
    return;
  }
  const state = await loadState();
  if (state) applyState(state);
  else if (agentState && !agentState.demo) applyState({ ...agentState, runner: { ...agentState.runner, heartbeatAt: 0 } });
  window.setTimeout(pollState, STATE_POLL_MS);
}

function setHudOpen(open) {
  hud.classList.toggle("collapsed", !open);
  hudToggle.setAttribute("aria-expanded", open ? "true" : "false");
  hudToggle.setAttribute("aria-label", open ? "Hide colony panel" : "Show colony panel");
}

function markActive(id) {
  document.querySelectorAll(".zone-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.id === id);
  });
}

function refreshCounts() {
  const live = botMeshes.filter((bot) => !bot.userData.aboard).length;
  const agents = botMeshes.filter((bot) => bot.userData.agent);
  const down = agents.filter((bot) => bot.userData.status === "down").length;
  const asking = agents.filter((bot) => bot.userData.status === "needs_input").length;
  const bits = [`${live} astronaut${live === 1 ? "" : "s"}`, `${agents.length} agent${agents.length === 1 ? "" : "s"}`];
  if (down) bits.push(`${down} down`);
  if (asking) bits.push(`${asking} asking`);
  bits.push(`runner ${runnerHealth}`);
  counts.textContent = bits.join(" · ");
  counts.dataset.health = runnerHealth;
}

function renderBotCard(bot) {
  const data = bot.userData;
  const home = ZONES.find((z) => z.id === data.home);
  const agent = data.agent;
  const status = data.status ?? "idle";
  cardKicker.textContent = `${home ? home.name : "Roaming"} ${agent ? "agent" : "astronaut"} · ${STATUS_LABEL[status]}`;
  cardTitle.textContent = data.name;
  cardMeta.textContent = data.objective;
  if (agent) {
    const rows = [];
    if (status === "down") rows.push({ badge: "down", text: agent.error || "Agent stopped reporting." });
    if (status === "unknown") rows.push({ badge: "lost", text: "The runner has stopped sending heartbeats." });
    rows.push({ badge: "last", text: agent.summary ? agent.summary : "No output yet." });
    rows.push({ badge: "ran", text: `${relativeTime(agent.lastRunAt)}${agent.runs ? ` · ${agent.runs} run${agent.runs === 1 ? "" : "s"}` : ""}` });
    if (agent.nextRunAt) rows.push({ badge: "next", text: relativeTime(agent.nextRunAt) });
    if (agent.model) rows.push({ badge: "model", text: agent.model });
    cardItems.innerHTML = rows
      .map((row) => `<li><span class="badge ${row.badge}">${row.badge}</span><span>${escapeHtml(row.text)}</span></li>`)
      .join("");
  } else {
    cardItems.innerHTML = home
      ? home.items.map((item) => `<li><span class="badge">${item.badge}</span><span>${item.text}</span></li>`).join("")
      : '<li><span class="badge">idle</span><span>No assigned plot. Patrol only.</span></li>';
  }
  markActive(data.home || "station");
}

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);
}

function showZone(zone) {
  clearBotSelection();
  followBot = null;
  cardKicker.textContent =
    zone.id === "station" ? "UFO dock" : zone.id === "court" ? "Badminton court" : "Colony plot";
  cardTitle.textContent = zone.name;
  cardMeta.textContent = `${zone.subtitle} · ${zone.schedule}`;
  cardItems.innerHTML = zone.items
    .map((item) => `<li><span class="badge">${item.badge}</span><span>${item.text}</span></li>`)
    .join("");
  markActive(zone.id);
  refreshCounts();
}

function showBot(bot) {
  const data = bot.userData;
  clearBotSelection();
  data.selected = true;
  data.bubble.className = "speech open";
  data.bubble.textContent = data.objective;
  renderBotCard(bot);
  refreshCounts();
  followBot = bot;
  flyGoal = null;
  controls.enabled = true;
  if (data.mode === "down") {
    // A downed agent stays where it fell; just look at it.
  } else if (data.aboard) {
    setBotAboard(bot, false);
    data.mode = "beamDown";
    data.beamT = 0;
    data.afterBeam = "goHome";
    bot.position.set(HATCH.x, UFO_Y - 0.4, HATCH.z);
    bot.scale.setScalar(0.12);
  } else if (data.mode === "beamDown") {
    data.afterBeam = "goHome";
  } else if (data.mode === "beamUp") {
    bot.scale.setScalar(1);
    bot.position.y = 0.12;
    sendHome(bot);
  } else {
    sendHome(bot);
  }
  window.clearTimeout(showBot.hudTimer);
  showBot.hudTimer = window.setTimeout(() => setHudOpen(true), 280);
}
selectBot = showBot;

let flyGoal = null;
let followBot = null;
const followPos = new THREE.Vector3();
const followLook = new THREE.Vector3();
const overviewPos = new THREE.Vector3(26, 16, 30);
const overviewTarget = new THREE.Vector3(0, 1.6, 0);

function easeInOutCubic(u) {
  return u < 0.5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2;
}

function settleControls(position, target) {
  // Drop leftover orbit inertia, then let OrbitControls adopt the pose we
  // just flew to. Updating before the copy would yank the camera away.
  controls._sphericalDelta.set(0, 0, 0);
  controls._panOffset.set(0, 0, 0);
  controls._scale = 1;
  camera.position.copy(position);
  controls.target.copy(target);
  const damping = controls.enableDamping;
  controls.enableDamping = false;
  controls.update();
  controls.enableDamping = damping;
}

const flightDir = new THREE.Vector3();
const flightSpin = new THREE.Quaternion();
const flightTurn = new THREE.Quaternion();

function startCameraFlight(toPos, toTarget, duration) {
  followBot = null;
  controls.enabled = false;
  const fromOffset = camera.position.clone().sub(controls.target);
  const toOffset = toPos.clone().sub(toTarget);
  if (fromOffset.lengthSq() < 0.01) fromOffset.set(0, 12, 18);
  if (toOffset.lengthSq() < 0.01) toOffset.copy(fromOffset);
  flyGoal = {
    fromTarget: controls.target.clone(),
    toTarget: toTarget.clone(),
    toPos: toPos.clone(),
    fromOffset,
    toOffset,
    fromDir: fromOffset.clone().normalize(),
    toDir: toOffset.clone().normalize(),
    fromRadius: fromOffset.length(),
    toRadius: toOffset.length(),
    t: 0,
    dur: duration,
  };
}

function placeFlightCamera(goal, ease) {
  // One move: the look point and the camera offset share the same ease,
  // and the offset turns in place instead of cutting across the island.
  controls.target.lerpVectors(goal.fromTarget, goal.toTarget, ease);
  flightSpin.setFromUnitVectors(goal.fromDir, goal.toDir);
  flightTurn.identity().slerp(flightSpin, ease);
  flightDir.copy(goal.fromDir).applyQuaternion(flightTurn);
  const radius = THREE.MathUtils.lerp(goal.fromRadius, goal.toRadius, ease);
  camera.position.copy(controls.target).addScaledVector(flightDir, radius);
  camera.lookAt(controls.target);
}

function framingFor(x, z, kind) {
  const lookY = kind === "bot" ? 1.05 : 1.6;
  const distance = kind === "bot" ? 10 : 15;
  const height = kind === "bot" ? 5.6 : 8.2;
  const yaw = Math.atan2(camera.position.x - x, camera.position.z - z);
  return {
    pos: new THREE.Vector3(x + Math.sin(yaw) * distance, height, z + Math.cos(yaw) * distance),
    target: new THREE.Vector3(x, lookY, z),
  };
}

function flyTo(x, z, kind = "plot") {
  const shot = framingFor(x, z, kind);
  startCameraFlight(shot.pos, shot.target, kind === "bot" ? 1.15 : 1.35);
}

function returnToOverview() {
  clearBotSelection();
  showZone(STATION);
  startCameraFlight(overviewPos.clone(), overviewTarget.clone(), 1.45);
}

zoneList.innerHTML = [STATION, ...ZONES].map(
  (zone) => `
    <button class="zone-btn" data-id="${zone.id}">
      <i class="swatch" style="background:${hex(zone.color)}"></i>
      <span>
        <strong>${zone.name}</strong>
        <span>${zone.subtitle}</span>
      </span>
    </button>
  `,
).join("");

function pickListedZone(event) {
  const btn = event.target.closest("[data-id]");
  if (!btn) return;
  if (btn.classList.contains("active")) {
    returnToOverview();
    return;
  }
  const zone = [STATION, ...ZONES].find((item) => item.id === btn.dataset.id);
  if (!zone) return;
  showZone(zone);
  flyTo(zone.x, zone.z, "plot");
}

zoneList.addEventListener("click", pickListedZone);
hudToggle.addEventListener("click", () => setHudOpen(hud.classList.contains("collapsed")));
overviewButton?.addEventListener("click", returnToOverview);
window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") returnToOverview();
});

controls.addEventListener("start", () => {
  if (introFlight || flyGoal) return;
  if (followBot) {
    followBot.userData.selected = false;
    followBot.userData.bubble.className = "speech";
    followBot.userData.bubble.textContent = "";
    followBot = null;
  }
});

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

function ancestor(obj, pred) {
  let node = obj;
  while (node) {
    if (pred(node)) return node;
    node = node.parent;
  }
  return null;
}

function hitsFromEvent(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  return raycaster.intersectObjects(scene.children, true);
}

renderer.domElement.addEventListener("pointermove", (event) => {
  const hits = hitsFromEvent(event);
  renderer.domElement.style.cursor = hits.some((hit) => ancestor(hit.object, (node) => node.userData.isBot))
    ? "pointer"
    : "grab";
});

renderer.domElement.addEventListener("pointerdown", (event) => {
  const hits = hitsFromEvent(event);
  for (const hit of hits) {
    const bot = ancestor(hit.object, (node) => node.userData.isBot && node.userData.objective && !node.userData.aboard);
    if (bot) {
      showBot(bot);
      return;
    }
  }
  for (const hit of hits) {
    const pod = ancestor(hit.object, (node) => node.userData.zoneId && !node.userData.isBot);
    if (pod) {
      const zone = [STATION, ...ZONES].find((item) => item.id === pod.userData.zoneId);
      if (zone) {
        const active = document.querySelector(".zone-btn.active")?.dataset.id;
        if (active === zone.id && !flyGoal) {
          returnToOverview();
        } else {
          showZone(zone);
          flyTo(zone.x, zone.z, "plot");
        }
      }
      return;
    }
  }
});

const introTimers = [];
let introFlight = null;

function clearIntroTimers() {
  while (introTimers.length) window.clearTimeout(introTimers.pop());
}

function layoutIntro() {
  if (!introLiquid) return;
  const w = window.innerWidth;
  const h = window.innerHeight;
  // Size the sphere by both axes so it never crowds the titles on wide or
  // short windows, then place the titles relative to its real edge.
  const radius = w > 760 ? Math.min(h * 0.28, w * 0.17, 270) : Math.min(h * 0.24, w * 0.36, 270);
  const dropH = radius * 2;
  const dropW = dropH;
  const x = (w - dropW) / 2;
  const y = (h - dropH) / 2 - Math.min(10, h * 0.015);
  const cx = w / 2;
  const cy = y + dropH / 2;
  const bottom = y + dropH;
  const textGap = Math.max(28, w * 0.03);
  const sideWidth = Math.max(140, w / 2 - radius - textGap - 24);
  intro.style.setProperty("--intro-text-offset", `${(radius + textGap).toFixed(1)}px`);
  intro.style.setProperty("--intro-side-width", `${sideWidth.toFixed(1)}px`);
  // "THE WORLD" must fit on one line beside the sphere so the title reads
  // left to right in one pass; shrink until the wider side fits.
  let titleSize = Math.min(64, Math.max(20, sideWidth / 7.4));
  intro.style.setProperty("--intro-title-size", `${titleSize.toFixed(1)}px`);
  const titleSides = intro.querySelectorAll(".intro-copy");
  const widest = () => Math.max(...[...titleSides].map((el) => el.scrollWidth));
  while (w > 760 && titleSize > 20 && widest() > sideWidth) {
    titleSize -= 2;
    intro.style.setProperty("--intro-title-size", `${titleSize.toFixed(1)}px`);
  }
  intro.style.setProperty("--intro-tagline-top", `${(cy + radius + 36).toFixed(1)}px`);
  const drop = [
    `M ${cx} ${y}`,
    `A ${radius} ${radius} 0 1 1 ${cx} ${bottom}`,
    `A ${radius} ${radius} 0 1 1 ${cx} ${y}`,
    "Z",
  ].join(" ");
  const highlight = [
    `M ${x + dropW * 0.23} ${y + dropH * 0.27}`,
    `C ${x + dropW * 0.12} ${y + dropH * 0.4}, ${x + dropW * 0.1} ${y + dropH * 0.58}, ${x + dropW * 0.18} ${y + dropH * 0.7}`,
  ].join(" ");
  const highlightSmall = [
    `M ${x + dropW * 0.3} ${y + dropH * 0.14}`,
    `C ${x + dropW * 0.36} ${y + dropH * 0.1}, ${x + dropW * 0.44} ${y + dropH * 0.08}, ${x + dropW * 0.5} ${y + dropH * 0.085}`,
  ].join(" ");

  introLiquid.setAttribute("viewBox", `0 0 ${w} ${h}`);
  introMaskRect.setAttribute("width", w);
  introMaskRect.setAttribute("height", h);
  introShadeRect.setAttribute("width", w);
  introShadeRect.setAttribute("height", h);
  introCutout.setAttribute("d", drop);
  introDroplet.setAttribute("d", drop);
  introRim.setAttribute("d", drop);
  introLensShade.setAttribute("d", drop);
  introHighlight.setAttribute("d", highlight);
  introHighlightSmall.setAttribute("d", highlightSmall);

  const origin = `${cx}px ${cy}px`;
  [introCutout, introDroplet, introRim, introLensShade, introHighlight, introHighlightSmall].forEach((node) => {
    node.style.transformOrigin = origin;
  });
  const zoom = (Math.hypot(w, h) / dropW) * 1.35;
  intro.style.setProperty("--intro-zoom", zoom.toFixed(2));

  if (introStars) {
    introStars.replaceChildren();
    for (let i = 0; i < 150; i += 1) {
      const random = (salt) => {
        const value = Math.sin((i + 1) * (12.9898 + salt * 7.31)) * 43758.5453;
        return value - Math.floor(value);
      };
      const star = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      const size = 0.45 + random(3) * (random(4) > 0.94 ? 2.2 : 1.15);
      const opacity = 0.28 + random(5) * 0.7;
      star.setAttribute("cx", random(1) * w);
      star.setAttribute("cy", random(2) * h);
      star.setAttribute("r", size);
      star.setAttribute("fill", random(6) > 0.78 ? "#b8d7ff" : "#ffffff");
      star.classList.add("intro-star");
      star.style.setProperty("--star-opacity", opacity.toFixed(2));
      star.style.setProperty("--twinkle", `${2 + random(7) * 4}s`);
      star.style.animationDelay = `${-random(8) * 5}s`;
      introStars.appendChild(star);
    }
  }
}

function finishIntro() {
  clearIntroTimers();
  intro?.classList.add("finished");
  intro?.classList.remove("ready", "zooming");
  if (introFlight) {
    camera.position.copy(introFlight.toPos);
    controls.target.copy(introFlight.toTarget);
    settleControls(introFlight.toPos, introFlight.toTarget);
    introFlight = null;
  }
  controls.enabled = true;
}

function playIntro(force = false) {
  if (!intro) return;
  clearIntroTimers();
  layoutIntro();
  intro.classList.remove("finished", "zooming", "ready");
  controls.enabled = false;

  const toPos = camera.position.clone();
  const toTarget = controls.target.clone();
  const fromPos = toTarget.clone().add(toPos.clone().sub(toTarget).multiplyScalar(1.34));
  camera.position.copy(fromPos);
  introFlight = {
    startedAt: performance.now(),
    duration: 7200,
    fromPos,
    toPos,
    fromTarget: toTarget.clone().add(new THREE.Vector3(0, 2.6, 0)),
    toTarget,
  };
  controls.target.copy(introFlight.fromTarget);

  requestAnimationFrame(() => intro.classList.add("ready"));
  introTimers.push(window.setTimeout(() => intro.classList.add("zooming"), 3900));
  introTimers.push(window.setTimeout(finishIntro, 7350));
}

replayIntro?.addEventListener("click", () => playIntro(true));

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  labels.setSize(w, h);
  if (intro?.classList.contains("ready")) layoutIntro();
}
window.addEventListener("resize", resize);
resize();

const clock = new THREE.Clock();
let lastFrameAt = 0;
let lastInteractionAt = performance.now();
let tickScheduled = false;

["pointerdown", "pointermove", "wheel", "keydown"].forEach((type) =>
  window.addEventListener(type, () => (lastInteractionAt = performance.now()), { passive: true }),
);

function frameInterval(now) {
  if (introFlight || flyGoal || now - lastInteractionAt < 3000) return 0;
  return document.hasFocus() ? 1000 / 30 : 1000 / 15;
}

function scheduleTick() {
  if (tickScheduled || document.hidden) return;
  tickScheduled = true;
  requestAnimationFrame(tick);
}

document.addEventListener("visibilitychange", () => {
  if (document.hidden) return;
  clock.getDelta();
  scheduleTick();
});

function tick(now = performance.now()) {
  tickScheduled = false;
  if (document.hidden) return;
  if (now - lastFrameAt < frameInterval(now) - 1) {
    scheduleTick();
    return;
  }
  lastFrameAt = now;
  try {
  // Keep motion time-based even if a frame stalls; the old 50ms cap made the
  // entire colony appear to run in slow motion at low frame rates.
  const dt = Math.min(clock.getDelta(), 0.1);
  const t = performance.now() * 0.001;
  waterTexture.offset.set((t * 0.006) % 1, (t * 0.0035) % 1);
  if (introFlight) {
    const u = Math.min(1, (performance.now() - introFlight.startedAt) / introFlight.duration);
    const ease = easeInOutCubic(u);
    camera.position.lerpVectors(introFlight.fromPos, introFlight.toPos, ease);
    controls.target.lerpVectors(introFlight.fromTarget, introFlight.toTarget, ease);
    camera.lookAt(controls.target);
  } else if (followBot) {
    const at = followBot.userData.aboard || !followBot.visible ? HATCH : followBot.position;
    followPos.set(at.x + 8.5, 6.8, at.z + 10.5);
    followLook.set(at.x, 1.05, at.z);
    const catchup = 1 - Math.exp(-dt * 2.35);
    camera.position.lerp(followPos, catchup);
    controls.target.lerp(followLook, catchup);
    camera.lookAt(controls.target);
  } else if (flyGoal) {
    flyGoal.t += dt;
    const u = Math.min(1, flyGoal.t / flyGoal.dur);
    placeFlightCamera(flyGoal, easeInOutCubic(u));
    if (u >= 1) {
      const destination = flyGoal;
      placeFlightCamera(destination, 1);
      settleControls(camera.position.clone(), controls.target.clone());
      flyGoal = null;
      controls.enabled = true;
    }
  } else {
    controls.update();
  }

  visitorCooldown -= dt;
  if (visitorCooldown <= 0) {
    spawnVisitor();
    visitorCooldown = 50;
  }

  paintCinema(t);
  ship.craft.position.y = UFO_Y + Math.sin(t * 1.35) * 0.22;
  ship.craft.rotation.y = t * 0.28;
  const beaming = botMeshes.some((bot) => ["beamDown", "beamUp"].includes(bot.userData.mode));
  ship.beam.material.opacity = (beaming ? 0.28 : 0.12) + Math.sin(t * 5) * 0.04;
  ship.lights.forEach((bulb, i) => {
    bulb.material.emissiveIntensity = 0.55 + Math.sin(t * 6 + i) * 0.45;
  });

  for (const bot of [...botMeshes]) {
    if (!bot?.userData) continue;
    const data = bot.userData;
    data.wait -= dt;

    if (data.aboard) {
      if (!data.visitor && (data.status === "working" || data.status === "needs_input" || data.status === "down")) data.wait = 0;
      if (data.wait > 0) continue;
      if (data.visitor) {
        dismissVisitor(bot);
        continue;
      }
      setBotAboard(bot, false);
      data.mode = "beamDown";
      data.beamT = 0;
      bot.position.set(HATCH.x, UFO_Y - 0.4, HATCH.z);
      bot.scale.setScalar(0.12);
      continue;
    }

    if (data.mode === "beamDown") {
      data.beamT += dt * 1.35;
      if (data.beamT < 0) {
        bot.visible = false;
        if (data.nameTag) data.nameTag.style.display = "none";
        continue;
      }
      bot.visible = true;
      if (data.nameTag) data.nameTag.style.display = "";
      const k = Math.min(1, data.beamT);
      const ease = 1 - (1 - k) ** 3;
      bot.position.set(HATCH.x, UFO_Y - 0.4 + (0.12 - (UFO_Y - 0.4)) * ease, HATCH.z);
      bot.scale.setScalar(0.12 + 0.88 * ease);
      if (k >= 1) {
        bot.scale.setScalar(1);
        if (data.afterBeam === "goHome" || data.selected) {
          sendHome(bot);
        } else {
          data.mode = "exit";
          const next = plotTarget(bot);
          data.tx = next.x;
          data.tz = next.z;
          data.wait = 6;
        }
      }
      continue;
    }

    if (data.mode === "beamUp") {
      data.beamT += dt * 1.55;
      const k = Math.min(1, data.beamT);
      const ease = k * k;
      bot.position.x = HATCH.x;
      bot.position.z = HATCH.z;
      bot.position.y = 0.12 + (UFO_Y - 0.5) * ease;
      bot.scale.setScalar(1 - 0.88 * ease);
      if (data.nameTag) data.nameTag.style.display = k > 0.35 ? "none" : "";
      if (k >= 1) {
        bot.scale.setScalar(1);
        setBotAboard(bot, true);
        data.wait = 2.4 + Math.random() * 2;
      }
      continue;
    }

    if (data.status === "down" && data.mode !== "down") {
      data.mode = "down";
      data.tilt = 0;
    }

    if (data.mode === "down") {
      // Fall over and stay down until the agent reports again.
      data.tilt = Math.min(1, data.tilt + dt * 2.4);
      const fall = 1 - (1 - data.tilt) ** 3;
      bot.rotation.x = (-Math.PI / 2) * fall;
      const groundY = deckHeightAt(bot.position.x, bot.position.z);
      data.walkY += (groundY - data.walkY) * Math.min(1, dt * 7);
      bot.position.y = data.walkY + 0.5 * fall;
      bot.scale.setScalar(1);
      data.armL.rotation.x = -1.3 * fall;
      data.armR.rotation.x = -1.3 * fall;
      if (data.lamp?.material) data.lamp.material.emissiveIntensity = 0.5 + Math.sin(t * 3) * 0.4;
      if (data.selected) data.wait = 20;
      continue;
    }

    if (data.tilt > 0) {
      data.tilt = Math.max(0, data.tilt - dt * 2.4);
      bot.rotation.x = (-Math.PI / 2) * (1 - (1 - data.tilt) ** 3);
    }

    const post = data.agent && data.home && (data.status === "working" || data.status === "needs_input");
    if (post && data.mode !== "goHome" && data.mode !== "homeStay") {
      const spot = homeSpot(bot);
      data.mode = "goHome";
      data.tx = spot.x;
      data.tz = spot.z;
      data.wait = 20;
    } else if (!post && !data.selected && (data.mode === "goHome" || data.mode === "homeStay")) {
      data.wait = 0;
    }

    if (data.selected && (data.mode === "goHome" || data.mode === "homeStay")) {
      data.wait = 20;
    } else if (!post && data.wait <= 0) {
      const goShip = data.mode !== "exit" && (data.visitor ? Math.random() < 0.5 : Math.random() < 0.3);
      const next = goShip ? shipTarget() : plotTarget(bot);
      data.mode = goShip ? "toShip" : "roam";
      data.tx = next.x;
      data.tz = next.z;
      data.wait = 3.5 + Math.random() * 5;
    }

    const dx = data.tx - bot.position.x;
    const dz = data.tz - bot.position.z;
    const dist = Math.hypot(dx, dz);
    const walking = dist > 0.25;
    if (walking) {
      const pace = data.mode === "goHome" ? 2.35 : 1.7;
      const dir = steerDir(bot.position.x, bot.position.z, data.tx, data.tz);
      const nextX = bot.position.x + dir.x * pace * dt;
      const nextZ = bot.position.z + dir.z * pace * dt;
      let stepX = nextX;
      let stepZ = nextZ;
      if (blocked(stepX, stepZ, 0.55)) {
        stepX = bot.position.x + -dir.z * pace * dt;
        stepZ = bot.position.z + dir.x * pace * dt;
      }
      if (!blocked(stepX, stepZ, 0.55)) {
        bot.position.x = stepX;
        bot.position.z = stepZ;
      }
      const desiredTurn = Math.atan2(dir.x, dir.z);
      const turnDelta = Math.atan2(
        Math.sin(desiredTurn - bot.rotation.y),
        Math.cos(desiredTurn - bot.rotation.y),
      );
      bot.rotation.y += turnDelta * Math.min(1, dt * 8);
    } else if (data.mode === "goHome") {
      data.mode = "homeStay";
      data.wait = 30;
    } else if (data.mode === "toShip") {
      const atPad = Math.hypot(bot.position.x - HATCH.x, bot.position.z - HATCH.z) < 0.9;
      if (atPad) {
        data.mode = "beamUp";
        data.beamT = 0;
        continue;
      }
    }

    const wantY = deckHeightAt(bot.position.x, bot.position.z);
    data.walkY += (wantY - data.walkY) * Math.min(1, dt * 7);
    bot.position.y = data.walkY + (walking ? Math.sin(t * 10 + bot.id) * 0.05 : 0) + (data.selected ? 0.22 : 0);
    bot.scale.setScalar(1);
    const swing = walking ? Math.sin(t * 10 + bot.id) * 0.4 : 0;
    data.armL.rotation.x = swing;
    data.armR.rotation.x = -swing;
    if (data.lamp?.material) {
      data.lamp.material.emissiveIntensity = data.selected
        ? 1.4 + Math.sin(t * 8) * 0.4
        : data.status === "working"
          ? 1.2 + Math.sin(t * 6) * 0.6
          : 0.9;
    }
  }

  renderer.render(scene, camera);
  labels.render(scene, camera);
  } catch (err) {
    window.__tickErr = String(err && err.stack ? err.stack : err);
  }
  scheduleTick();
}

// The sun and architecture are static, so render their shadow map once.
// This removes a full second scene render from every animation frame.
renderer.shadowMap.autoUpdate = false;
renderer.shadowMap.needsUpdate = true;
renderer.compile(scene, camera);

showZone(STATION);
setHudOpen(false);
scheduleTick();
pollState();
playIntro();
