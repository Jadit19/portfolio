/**
 * C++ for fun (v2, open world): a Dussehra mela on a Gangetic riverside, at night.
 *
 * No start or finish. The mela road is a figure-eight that crosses itself at
 * the marigold mela gate (the arrival gateway and first-visit spawn). The west
 * lobe holds the Ramlila maidan and the old riverside town, whose havelis and
 * temples step down to the ghats; a spur leads down to the aarti ghat. The
 * east lobe holds the rides and the Ravan dahan ground, the hero landmark
 * under fireworks. A food lane loops north between the lobes, past the
 * village; mustard fields, a mango orchard, a well and a hand-pump fill the
 * outskirts. The river bends past sandbanks to a faint far bank with temples
 * and tree lines. Direction boards are NHAI-style (Hindi above English).
 * The 3 stops (chat booth, piano stall, TV-wall stall) are spread out.
 */

import * as THREE from "three";
import {
  beside,
  branchPoints,
  carve,
  cornerSign,
  flattenPads,
  type HeightFn,
  type JourneyDef,
  kmStone,
  makeRoad,
  nhaiSign,
  placeOnGround,
  type Road,
  roadMesh,
  type SignLine,
  terrain,
  type V2,
} from "../journey";
import { box, disc, type Kit, sphere, tube } from "../kit";
import { BG, nightLight } from "../zones";

const CENTRE: V2 = [0, 4];

/** The figure-eight: the east lobe first, then back through the gate into the west lobe. */
const LOOP: V2[] = [
  CENTRE,
  [12, 12],
  [26, 20],
  [44, 26],
  [60, 18],
  [64, 2],
  [56, -10],
  [38, -11],
  [20, -10],
  [9, -4],
  CENTRE,
  [-10, 12],
  [-26, 20],
  [-44, 26],
  [-60, 18],
  [-64, 2],
  [-56, -10],
  [-38, -11],
  [-20, -10],
  [-9, -4],
];

const WATER_Y = -1.5;
/** The river's near bank bends gently along x. */
const bankZ = (x: number) => -27 + 2.5 * Math.sin(x * 0.035 + 0.6);

const g2 = (x: number, z: number, cx: number, cz: number, rx: number, rz = rx) =>
  Math.exp(-(((x - cx) / rx) ** 2) - ((z - cz) / rz) ** 2);

const base: HeightFn = (x, z) => {
  const bz = bankZ(x);
  const onLand = THREE.MathUtils.smoothstep(z, bz - 5, bz + 2);
  // Gentle plain: soft swells, a raised village terrace to the north, and
  // the old town's promenade falling gently towards the ghats.
  const swell =
    0.28 * Math.sin(x * 0.08) * Math.cos(z * 0.11) +
    0.5 * g2(x, z, -30, 2, 14) +
    0.4 * g2(x, z, 34, 6, 16);
  const terrace = 1.3 * THREE.MathUtils.smoothstep(z, 28, 46);
  const promenade = -1.0 * (1 - THREE.MathUtils.smoothstep(z, bz + 2, -12));
  const land = swell + terrace + promenade;
  // Riverbed with two long sandbanks breaking the surface.
  const sand = 1.95 * g2(x, z, -8, -44, 22, 3.8) + 1.75 * g2(x, z, 42, -53, 14, 3.2);
  const bed = -2.9 + sand;
  return THREE.MathUtils.lerp(bed, land, onLand);
};

const FESTIVE = ["#ff9933", "#e63946", "#ffd166", "#06d6a0", "#118ab2", "#ef476f", "#9b5de5"];
const HINDI_FONT =
  "'Noto Sans Devanagari', 'Devanagari Sangam MN', 'Kohinoor Devanagari', 'ITF Devanagari', sans-serif";

// ── Labels ──────────────────────────────────────────────────────────────────

/** Hindi on top, English below; sized to the text, optional camera icon. */
function bilingual(hi: string, en: string, fg: string, bg: string, icon?: "camera"): THREE.Sprite {
  const probe = document.createElement("canvas").getContext("2d");
  const hiFont = `700 64px ${HINDI_FONT}`;
  const enFont = "800 44px Outfit, Arial, sans-serif";
  let w = 280;
  if (probe) {
    probe.font = hiFont;
    w = Math.max(w, probe.measureText(hi).width + 90);
    probe.font = enFont;
    w = Math.max(w, probe.measureText(en).width + 90);
  }
  if (icon) w += 110;
  w = Math.ceil(w);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = 180;
  const ctx = c.getContext("2d");
  if (ctx) {
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.roundRect(6, 6, w - 12, 168, 34);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,214,102,0.7)";
    ctx.lineWidth = 5;
    ctx.stroke();
    const cx = icon ? (w + 110) / 2 : w / 2;
    if (icon === "camera") {
      ctx.fillStyle = fg;
      ctx.beginPath();
      ctx.roundRect(36, 64, 84, 60, 12);
      ctx.fill();
      ctx.fillRect(58, 52, 36, 16);
      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.arc(78, 94, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = fg;
      ctx.beginPath();
      ctx.arc(78, 94, 10, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = fg;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = hiFont;
    ctx.fillText(hi, cx, 66);
    ctx.font = enFont;
    ctx.fillText(en, cx, 134);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false }));
  sp.scale.set((w / 180) * 1.3, 1.3, 1);
  return sp;
}

function signPost(kit: Kit, sprite: THREE.Sprite, h = 2.6): THREE.Group {
  const g = new THREE.Group();
  g.add(tube(kit, "#5a3b28", [0, 0, 0], [0, h, 0], 0.06));
  sprite.position.set(0, h + 0.75, 0);
  g.add(sprite);
  return g;
}

// ── Light helpers ───────────────────────────────────────────────────────────

function emissiveDots(
  kit: Kit,
  colour: string,
  points: THREE.Vector3[],
  r: number,
): THREE.InstancedMesh {
  const mesh = new THREE.InstancedMesh(
    new THREE.SphereGeometry(r, 8, 6),
    kit.mat(colour, { emissive: true }),
    points.length,
  );
  const m = new THREE.Matrix4();
  points.forEach((p, i) => {
    m.makeTranslation(p.x, p.y, p.z);
    mesh.setMatrixAt(i, m);
  });
  return mesh;
}

function lanternString(
  kit: Kit,
  a: THREE.Vector3,
  b: THREE.Vector3,
  n = 14,
  sag = 0.7,
): THREE.Group {
  const g = new THREE.Group();
  const pts: Record<string, THREE.Vector3[]> = {};
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const p = a.clone().lerp(b, t);
    p.y -= Math.sin(t * Math.PI) * sag;
    const c = FESTIVE[i % FESTIVE.length] ?? "#ffd166";
    pts[c] ??= [];
    pts[c].push(p);
  }
  for (const [c, list] of Object.entries(pts)) g.add(emissiveDots(kit, c, list, 0.12));
  return g;
}

// ── Stalls ──────────────────────────────────────────────────────────────────

function stripedStall(kit: Kit, colour: string): THREE.Group {
  const g = new THREE.Group();
  g.add(box(kit, "#8a7a68", [-1.5, -1.0, -1.1], [1.5, 0.06, 1.4]));
  g.add(box(kit, "#f5efe6", [-1.3, 0, -0.9], [1.3, 1.15, 0.9]));
  for (let i = 0; i < 7; i++)
    g.add(
      box(
        kit,
        i % 2 ? "#fff6e6" : colour,
        [-1.45 + i * 0.42, 1.95, -1.1],
        [-1.03 + i * 0.42, 2.1, 1.25],
      ),
    );
  for (const x of [-1.35, 1.35]) g.add(tube(kit, "#f5efe6", [x, 1.15, 1.15], [x, 2.0, 1.15], 0.04));
  g.add(box(kit, "#8a5a3a", [-1.25, 1.05, 0.85], [1.25, 1.2, 1.2]));
  const bulbs: THREE.Vector3[] = [];
  for (let i = 0; i < 9; i++) bulbs.push(new THREE.Vector3(-1.35 + i * 0.34, 1.9, 1.27));
  g.add(emissiveDots(kit, "#ffe08a", bulbs, 0.07));
  return g;
}

function chatBooth(kit: Kit): THREE.Group {
  const g = stripedStall(kit, "#118ab2");
  g.add(box(kit, "#ffffff", [-0.7, 2.5, 0.2], [0.7, 3.3, 0.35]));
  g.add(box(kit, "#ffffff", [-0.3, 2.3, 0.2], [0.0, 2.5, 0.35]));
  for (let i = 0; i < 3; i++)
    g.add(sphere(kit, "#118ab2", [-0.35 + i * 0.35, 2.9, 0.4], 0.1, { emissive: true }));
  return g;
}

function pianoStall(kit: Kit): THREE.Group {
  const g = stripedStall(kit, "#e63946");
  for (let i = 0; i < 12; i++)
    g.add(box(kit, "#fbfbf8", [-1.15 + i * 0.19, 1.2, 0.9], [-0.99 + i * 0.19, 1.26, 1.18]));
  for (const i of [0, 1, 3, 4, 5, 7, 8, 10])
    g.add(box(kit, "#1d1f24", [-1.03 + i * 0.19, 1.26, 0.9], [-0.93 + i * 0.19, 1.31, 1.05]));
  return g;
}

function tvWallStall(kit: Kit): THREE.Group {
  const g = stripedStall(kit, "#9b5de5");
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 4; c++) {
      const x0 = -1.1 + c * 0.56;
      const y0 = 2.25 + r * 0.42;
      // The wall faces the road (+z) so the "bits" read from the road.
      g.add(box(kit, "#2b2d33", [x0, y0, 0.3], [x0 + 0.5, y0 + 0.38, 0.48]));
      g.add(
        box(kit, "#5a6a8a", [x0 + 0.03, y0 + 0.03, 0.48], [x0 + 0.47, y0 + 0.35, 0.49], {
          emissive: true,
        }),
      );
      for (let k = 0; k < 6; k++) {
        const on = (r * 7 + c * 3 + k * 5) % 3 === 0;
        g.add(
          box(
            kit,
            on ? "#ffffff" : "#20232a",
            [x0 + 0.05 + (k % 3) * 0.14, y0 + 0.05 + Math.floor(k / 3) * 0.14, 0.49],
            [x0 + 0.17 + (k % 3) * 0.14, y0 + 0.17 + Math.floor(k / 3) * 0.14, 0.51],
            { emissive: on },
          ),
        );
      }
    }
  }
  return g;
}

type Food = "golgappe" | "jalebi" | "kulfi" | "candyfloss";

function foodStall(kit: Kit, kind: Food): THREE.Group {
  const colours: Record<Food, string> = {
    golgappe: "#ff9933",
    jalebi: "#ffd166",
    kulfi: "#06d6a0",
    candyfloss: "#ef476f",
  };
  const labels: Record<Food, [string, string]> = {
    golgappe: ["गोलगप्पे", "GOL GAPPE"],
    jalebi: ["जलेबी", "JALEBI"],
    kulfi: ["कुल्फ़ी", "KULFI"],
    candyfloss: ["बुढ़िया के बाल", "CANDY FLOSS"],
  };
  const g = new THREE.Group();
  if (kind === "kulfi") {
    // A push-cart with a red cloth-wrapped matka.
    g.add(box(kit, "#c97b3d", [-1.0, 0.5, -0.6], [1.0, 1.1, 0.6]));
    for (const z of [-0.65, 0.65]) g.add(disc(kit, "#3a2a1e", [-0.5, 0.45, z], 0.45, 0.08));
    g.add(tube(kit, "#6b4a32", [1.0, 0.9, 0], [1.9, 0.75, 0], 0.05));
    g.add(sphere(kit, "#b8322a", [0, 1.45, 0], 0.45, undefined, [1, 0.85, 1]));
    for (let i = 0; i < 4; i++)
      g.add(tube(kit, "#fff1d6", [-0.5 + i * 0.3, 1.1, 0.5], [-0.5 + i * 0.3, 1.45, 0.5], 0.05));
  } else if (kind === "candyfloss") {
    g.add(tube(kit, "#e9ecef", [0, 0, 0], [0, 1.0, 0], 0.05));
    g.add(box(kit, "#ef476f", [-0.5, 1.0, -0.4], [0.5, 1.25, 0.4]));
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      g.add(
        tube(
          kit,
          "#f5efe6",
          [Math.cos(a) * 0.2, 1.25, Math.sin(a) * 0.2],
          [Math.cos(a) * 0.45, 2.1, Math.sin(a) * 0.45],
          0.015,
        ),
      );
      g.add(
        sphere(
          kit,
          i % 2 ? "#ffb3d9" : "#ffd1e8",
          [Math.cos(a) * 0.45, 2.25, Math.sin(a) * 0.45],
          0.2,
        ),
      );
    }
  } else {
    g.add(stripedStall(kit, colours[kind]));
    if (kind === "golgappe") {
      for (let i = 0; i < 10; i++)
        g.add(
          sphere(kit, "#d9a05b", [-0.9 + (i % 5) * 0.2, 1.3 + Math.floor(i / 5) * 0.16, 1.0], 0.09),
        );
      g.add(tube(kit, "#c9d0d6", [0.6, 1.2, 1.0], [0.6, 1.5, 1.0], 0.18, { metal: true }));
    } else {
      for (let i = 0; i < 6; i++) {
        const j = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.035, 6, 16), kit.mat("#ff8f00"));
        j.rotation.x = Math.PI / 2;
        j.position.set(-0.8 + i * 0.3, 1.25, 1.0);
        g.add(j);
      }
      g.add(disc(kit, "#2b2d33", [0.7, 1.25, 0.95], 0.3, 0.1));
    }
  }
  const [hi, en] = labels[kind];
  const label = bilingual(
    hi,
    en,
    "#ffffff",
    kind === "kulfi" ? "#1f6b5a" : kind === "candyfloss" ? "#a4235a" : "#a4161a",
  );
  label.position.set(0, 3.1, 0.5);
  label.scale.multiplyScalar(0.8);
  g.add(label);
  return g;
}

// ── Rides ───────────────────────────────────────────────────────────────────

function giantWheel(kit: Kit): THREE.Group {
  const g = new THREE.Group();
  const R = 4.2;
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(R, 0.09, 8, 64),
    kit.mat("#ef476f", { emissive: true }),
  );
  rim.position.y = 5.2;
  g.add(rim);
  const bulbs: THREE.Vector3[] = [];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    g.add(
      tube(kit, "#ffd166", [0, 5.2, 0], [Math.cos(a) * R, 5.2 + Math.sin(a) * R, 0], 0.04, {
        emissive: true,
      }),
    );
    g.add(
      box(
        kit,
        FESTIVE[i % FESTIVE.length] ?? "#fff",
        [Math.cos(a) * R - 0.32, 4.75 + Math.sin(a) * R, -0.3],
        [Math.cos(a) * R + 0.32, 5.2 + Math.sin(a) * R, 0.3],
      ),
    );
    for (let k = 0; k < 3; k++) {
      const b = a + (k / 3) * ((Math.PI * 2) / 12);
      bulbs.push(new THREE.Vector3(Math.cos(b) * (R + 0.15), 5.2 + Math.sin(b) * (R + 0.15), 0));
    }
  }
  g.add(emissiveDots(kit, "#fff1b3", bulbs, 0.09));
  for (const s of [-1, 1]) g.add(tube(kit, "#3a2a4a", [s * 2.2, 0, 0.5], [0, 5.2, 0.5], 0.12));
  return g;
}

/** The "break dance": a spinning platform with arms of twin cars. */
function breakDance(kit: Kit): THREE.Group {
  const g = new THREE.Group();
  g.add(disc(kit, "#3a2a4a", [0, 0.15, 0], 3.6, 0.3));
  const plat = new THREE.Mesh(
    new THREE.CylinderGeometry(3.4, 3.4, 0.12, 48),
    kit.mat("#ffd166", { emissive: true }),
  );
  plat.position.y = 0.35;
  g.add(plat);
  g.add(tube(kit, "#c9d0d6", [0, 0.35, 0], [0, 2.4, 0], 0.18, { metal: true }));
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.3;
    const ex = Math.cos(a) * 2.4;
    const ez = Math.sin(a) * 2.4;
    g.add(tube(kit, "#e63946", [0, 2.2, 0], [ex, 1.1, ez], 0.08, { emissive: true }));
    for (const d of [-0.6, 0.6]) {
      const cx = ex + Math.cos(a + Math.PI / 2) * d;
      const cz = ez + Math.sin(a + Math.PI / 2) * d;
      g.add(
        sphere(
          kit,
          FESTIVE[(i * 2 + (d > 0 ? 1 : 0)) % FESTIVE.length] ?? "#fff",
          [cx, 0.85, cz],
          0.38,
          undefined,
          [1, 0.7, 1],
        ),
      );
    }
  }
  const bulbs: THREE.Vector3[] = [];
  for (let i = 0; i < 36; i++)
    bulbs.push(
      new THREE.Vector3(
        Math.cos((i / 36) * Math.PI * 2) * 3.55,
        0.45,
        Math.sin((i / 36) * Math.PI * 2) * 3.55,
      ),
    );
  g.add(emissiveDots(kit, "#fff1b3", bulbs, 0.07));
  return g;
}

/** The Columbus swing: a pirate-ship boat on an A-frame. */
function columbus(kit: Kit): THREE.Group {
  const g = new THREE.Group();
  for (const z of [-1.2, 1.2]) {
    g.add(tube(kit, "#3a2a4a", [-2.2, 0, z], [0, 5.2, z], 0.12));
    g.add(tube(kit, "#3a2a4a", [2.2, 0, z], [0, 5.2, z], 0.12));
  }
  g.add(tube(kit, "#c9d0d6", [0, 5.2, -1.3], [0, 5.2, 1.3], 0.1, { metal: true }));
  const swing = new THREE.Group();
  for (const z of [-0.9, 0.9])
    swing.add(tube(kit, "#c9d0d6", [0, 0, z], [0, -3.4, z], 0.06, { metal: true }));
  const hull = new THREE.Mesh(
    new THREE.SphereGeometry(1.0, 24, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
    kit.mat("#118ab2"),
  );
  hull.scale.set(2.6, 0.9, 1.0);
  hull.position.y = -3.0;
  swing.add(hull);
  swing.add(box(kit, "#ffd166", [-2.5, -3.05, -0.95], [2.5, -2.9, 0.95], { emissive: true }));
  swing.position.y = 5.2;
  swing.rotation.z = 0.45;
  g.add(swing);
  return g;
}

/** A little toy train on an oval track. */
function toyTrain(kit: Kit): THREE.Group {
  const g = new THREE.Group();
  const track = new THREE.Mesh(new THREE.TorusGeometry(3.0, 0.12, 6, 64), kit.mat("#8a8f98"));
  track.rotation.x = Math.PI / 2;
  track.scale.set(1.6, 1, 1);
  track.position.y = 0.08;
  g.add(track);
  const cars = 4;
  for (let i = 0; i < cars; i++) {
    const a = 0.6 + i * 0.42;
    const x = Math.cos(a) * 4.8;
    const z = Math.sin(a) * 3.0;
    const car = new THREE.Group();
    car.add(
      box(
        kit,
        i === 0 ? "#e63946" : (FESTIVE[i + 2] ?? "#ffd166"),
        [-0.5, 0.15, -0.35],
        [0.5, 0.8, 0.35],
      ),
    );
    if (i === 0) car.add(tube(kit, "#2b2d33", [0.3, 0.8, 0], [0.3, 1.15, 0], 0.1));
    car.add(sphere(kit, "#ffe08a", [0.55, 0.55, 0], 0.08, { emissive: true }));
    car.position.set(x, 0.1, z);
    car.rotation.y = -a + Math.PI;
    g.add(car);
  }
  return g;
}

// ── Stage, ghats, effigy ────────────────────────────────────────────────────

function figure(kit: Kit, cloth: string, skin = "#d9a066", h = 1.2): THREE.Group {
  const g = new THREE.Group();
  g.add(tube(kit, cloth, [0, 0, 0], [0, h, 0], 0.17));
  g.add(sphere(kit, skin, [0, h + 0.24, 0], 0.2));
  return g;
}

/** Ramlila: Ram with his bow, Sita, and Hanuman with his gada, mid-scene. */
function ramlilaStage(kit: Kit): THREE.Group {
  const g = new THREE.Group();
  g.add(box(kit, "#7a4a2e", [-4.4, -1.2, -2.4], [4.4, 1.1, 2.4]));
  for (const x of [-4.1, 4.1]) g.add(tube(kit, "#ffd166", [x, 1.1, 2.1], [x, 5.4, 2.1], 0.14));
  g.add(box(kit, "#c9a227", [-4.5, 5.4, 1.8], [4.5, 6.0, 2.4]));
  g.add(box(kit, "#a4161a", [-4.0, 1.1, 2.05], [-3.0, 5.4, 2.2]));
  g.add(box(kit, "#a4161a", [3.0, 1.1, 2.05], [4.0, 5.4, 2.2]));
  g.add(box(kit, "#f2c14e", [-3.9, 1.1, -2.2], [3.9, 5.0, -2.05]));
  for (const x of [-2.4, 0, 2.4]) {
    g.add(sphere(kit, "#e63946", [x, 4.2, -2.0], 0.55, undefined, [1, 1.25, 0.2]));
    g.add(box(kit, "#c9a227", [x - 0.6, 1.1, -2.04], [x + 0.6, 3.2, -1.98]));
  }
  // Ram (blue, crown, bow)
  const ram = figure(kit, "#4f7cff", "#6f8fff");
  ram.position.set(-1.2, 1.1, 0.2);
  const crown = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.4, 8), kit.mat("#ffd166"));
  crown.position.set(0, 1.75, 0);
  ram.add(crown);
  const bow = new THREE.Mesh(
    new THREE.TorusGeometry(0.62, 0.03, 4, 16, Math.PI),
    kit.mat("#8a5a3a"),
  );
  bow.position.set(0.45, 0.85, 0);
  bow.rotation.z = -Math.PI / 2;
  ram.add(bow);
  g.add(ram);
  // Sita (red saree, veil)
  const sita = figure(kit, "#c1121f");
  sita.position.set(0.2, 1.1, -0.4);
  sita.add(sphere(kit, "#ff9f1c", [0, 1.5, 0], 0.24, undefined, [1, 0.6, 1]));
  g.add(sita);
  // Hanuman (saffron, gada, tail)
  const han = figure(kit, "#ff7b00", "#c9773a");
  han.position.set(1.7, 1.1, 0.3);
  han.add(tube(kit, "#ffd166", [0.25, 0.9, 0], [0.55, 1.7, 0], 0.05));
  han.add(sphere(kit, "#ffd166", [0.58, 1.85, 0], 0.22));
  han.add(tube(kit, "#c9773a", [-0.15, 0.3, -0.1], [-0.6, 0.9, -0.3], 0.05));
  han.add(tube(kit, "#c9773a", [-0.6, 0.9, -0.3], [-0.45, 1.3, -0.4], 0.05));
  g.add(han);
  const label = bilingual("रामलीला", "RAMLILA", "#ffd166", "#5a1414");
  label.position.set(0, 6.9, 2.2);
  g.add(label);
  return g;
}

/** An aarti platform on the ghat: a priest raising a tiered brass lamp. */
function aartiPriest(kit: Kit): THREE.Group {
  const g = new THREE.Group();
  g.add(box(kit, "#7a4a2e", [-0.8, 0, -0.8], [0.8, 0.45, 0.8]));
  const p = figure(kit, "#ffb703", "#a9693f", 1.25);
  p.position.y = 0.45;
  g.add(p);
  g.add(sphere(kit, "#ff6b00", [0, 1.55, -0.05], 0.22, undefined, [1.3, 0.5, 1.1]));
  // Tiered brass lamp held up and out, flames lit.
  const lampX = 0.55;
  g.add(tube(kit, "#c9a227", [0.15, 1.5, 0], [lampX, 2.2, 0.15], 0.04, { metal: true }));
  for (let t = 0; t < 4; t++) {
    const r = 0.45 - t * 0.1;
    const y = 2.2 + t * 0.2;
    g.add(disc(kit, "#c9a227", [lampX, y, 0.15], r, 0.04, { metal: true }));
    const flames: THREE.Vector3[] = [];
    for (let k = 0; k < 6 - t; k++) {
      const a = (k / (6 - t)) * Math.PI * 2;
      flames.push(new THREE.Vector3(lampX + Math.cos(a) * r, y + 0.1, 0.15 + Math.sin(a) * r));
    }
    g.add(emissiveDots(kit, "#ffb347", flames, 0.07));
  }
  // A brass bell on a small stand
  g.add(tube(kit, "#c9a227", [-0.55, 0.45, 0.4], [-0.55, 1.3, 0.4], 0.03, { metal: true }));
  const bell = new THREE.Mesh(
    new THREE.ConeGeometry(0.16, 0.25, 12),
    kit.mat("#c9a227", { metal: true }),
  );
  bell.position.set(-0.55, 1.18, 0.4);
  g.add(bell);
  return g;
}

/** A tall paper-and-bamboo Ravan, festive and detailed. */
function ravanEffigy(kit: Kit): THREE.Group {
  const g = new THREE.Group();
  // Brick platform and a hint of bamboo scaffold.
  g.add(box(kit, "#7a4a2e", [-3, -1.2, -1.8], [3, 0.7, 1.8]));
  for (const x of [-2.7, 2.7])
    g.add(tube(kit, "#c9a46a", [x, 0.7, -1.5], [x * 0.6, 8, -1.2], 0.05));
  // Legs: dhoti with pleats in bands.
  for (const x of [-0.9, 0.9]) {
    g.add(box(kit, "#c1121f", [x - 0.55, 0.7, -0.55], [x + 0.55, 5.4, 0.55]));
    for (let i = 0; i < 6; i++)
      g.add(
        box(
          kit,
          ["#ffd166", "#06d6a0", "#ff9933"][i % 3] ?? "#ffd166",
          [x - 0.57, 1.0 + i * 0.75, -0.57],
          [x + 0.57, 1.18 + i * 0.75, 0.57],
        ),
      );
    g.add(box(kit, "#3a2a1e", [x - 0.6, 0.7, -0.7], [x + 0.6, 1.0, 0.75]));
  }
  // Skirt frill and belt
  g.add(box(kit, "#9d0208", [-1.9, 5.2, -0.95], [1.9, 6.0, 0.95]));
  for (let i = 0; i < 10; i++) {
    const frill = new THREE.Mesh(
      new THREE.ConeGeometry(0.22, 0.6, 6),
      kit.mat(i % 2 ? "#ffd166" : "#ff9933"),
    );
    frill.position.set(-1.7 + i * 0.38, 5.0, 0.95);
    frill.rotation.x = Math.PI;
    g.add(frill);
  }
  g.add(box(kit, "#ffd166", [-1.95, 5.95, -1.0], [1.95, 6.25, 1.0]));
  // Torso with armour plates, a marigold garland and a cape
  g.add(box(kit, "#7b0a0a", [-1.7, 6.2, -0.85], [1.7, 10.4, 0.85]));
  for (let i = 0; i < 4; i++)
    g.add(
      box(
        kit,
        "#ffd166",
        [-1.2 + (i % 2) * 1.4, 7.0 + Math.floor(i / 2) * 1.5, 0.85],
        [-0.2 + (i % 2) * 1.4, 8.1 + Math.floor(i / 2) * 1.5, 0.92],
      ),
    );
  const garland = new THREE.Mesh(
    new THREE.TorusGeometry(1.25, 0.16, 8, 32, Math.PI),
    kit.mat("#ff9f1c"),
  );
  garland.position.set(0, 10.1, 0.9);
  garland.rotation.z = Math.PI;
  g.add(garland);
  g.add(box(kit, "#06d6a0", [-1.9, 6.4, -1.0], [1.9, 10.3, -0.85]));
  // Shoulders with paper frills
  g.add(box(kit, "#ffd166", [-2.6, 9.9, -0.95], [2.6, 10.7, 0.95]));
  for (let i = 0; i < 12; i++) {
    const f = new THREE.Mesh(
      new THREE.ConeGeometry(0.16, 0.5, 6),
      kit.mat(FESTIVE[i % FESTIVE.length] ?? "#ffd166"),
    );
    f.position.set(-2.5 + i * 0.45, 10.85, 0);
    g.add(f);
  }
  // Arms: a sword with a golden hilt; a shield with a sunburst.
  g.add(tube(kit, "#9d0208", [-1.8, 10.2, 0], [-3.6, 7.6, 0.4], 0.38));
  g.add(tube(kit, "#9d0208", [1.8, 10.2, 0], [3.6, 7.6, 0.4], 0.38));
  g.add(box(kit, "#d9dee6", [3.5, 7.2, 0.25], [3.75, 11.6, 0.55]));
  g.add(box(kit, "#ffd166", [3.2, 7.5, 0.2], [4.05, 7.75, 0.6]));
  g.add(disc(kit, "#ffd166", [-3.7, 7.7, 0.75], 1.0, 0.2));
  g.add(disc(kit, "#e63946", [-3.7, 7.7, 0.88], 0.6, 0.06));
  // Ten heads: the central one largest, sizes falling away outwards.
  for (let i = 0; i < 10; i++) {
    const offset = i - 4.5;
    const big = Math.abs(offset) < 1;
    const r = big ? 0.66 : 0.56 - Math.abs(offset) * 0.025;
    const x = offset * 1.05;
    const y = 11.6 + (big ? 0.25 : 0) - Math.abs(offset) * 0.06;
    g.add(sphere(kit, "#e8a96b", [x, y, 0], r, undefined, [1, 1.15, 0.8]));
    g.add(box(kit, "#1d1f24", [x - 0.28, y - 0.2, r * 0.74], [x + 0.28, y - 0.12, r * 0.8]));
    for (const ex of [-0.18, 0.18]) {
      g.add(sphere(kit, "#ffffff", [x + ex, y + 0.12, r * 0.7], 0.09));
      g.add(sphere(kit, "#1d1f24", [x + ex, y + 0.12, r * 0.76], 0.045));
    }
    const crown = new THREE.Mesh(new THREE.ConeGeometry(r * 0.78, r * 1.4, 8), kit.mat("#ffd166"));
    crown.position.set(x, y + r * 1.25, 0);
    crown.castShadow = true;
    g.add(crown);
    g.add(disc(kit, "#e63946", [x, y + r * 0.85, r * 0.55], r * 0.18, 0.04));
  }
  return g;
}

function fireworks(kit: Kit, centre: THREE.Vector3): THREE.Group {
  const g = new THREE.Group();
  const bursts: [number, number, number, string, number][] = [
    [-8, 17, -10, "#ffd166", 3.0],
    [6, 21, -12, "#ef476f", 3.6],
    [14, 15, -14, "#06d6a0", 2.6],
    [-15, 13, -14, "#9b5de5", 2.4],
    [1, 26, -16, "#ff9933", 3.2],
    [-3, 12, -8, "#ffffff", 1.6],
  ];
  for (const [bx, by, bz, colour, r] of bursts) {
    const c = new THREE.Vector3(centre.x + bx, centre.y + by, centre.z + bz);
    const dots: THREE.Vector3[] = [];
    const small: THREE.Vector3[] = [];
    for (let i = 0; i < 46; i++) {
      const phi = Math.acos(1 - (2 * (i + 0.5)) / 46);
      const theta = i * 2.39996;
      const dir = new THREE.Vector3(
        Math.sin(phi) * Math.cos(theta),
        Math.cos(phi),
        Math.sin(phi) * Math.sin(theta),
      );
      dots.push(c.clone().addScaledVector(dir, r));
      small.push(c.clone().addScaledVector(dir, r * 0.6), c.clone().addScaledVector(dir, r * 0.3));
    }
    g.add(emissiveDots(kit, colour, dots, 0.16));
    g.add(emissiveDots(kit, "#fff6d6", small, 0.08));
    g.add(
      tube(kit, colour, [c.x - bx * 0.05, c.y - r * 2.6, c.z], [c.x, c.y - r * 0.5, c.z], 0.035, {
        emissive: true,
      }),
    );
    const light = new THREE.PointLight(colour, 40, 60, 1.4);
    light.position.copy(c);
    g.add(light);
  }
  return g;
}

function kite(kit: Kit, colour: string): THREE.Group {
  const g = new THREE.Group();
  const k = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.1), kit.mat(colour, { emissive: true }));
  (k.material as THREE.Material).side = THREE.DoubleSide;
  k.rotation.z = Math.PI / 4;
  g.add(k);
  g.add(tube(kit, colour, [0, -0.75, 0], [0.3, -2.2, 0.1], 0.03));
  return g;
}

/** A small boat carrying a glowing lantern. */
function lanternBoat(kit: Kit): THREE.Group {
  const g = new THREE.Group();
  const hull = new THREE.Mesh(
    new THREE.SphereGeometry(0.8, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
    kit.mat("#6b4a2e"),
  );
  hull.scale.set(1.8, 0.5, 0.8);
  g.add(hull);
  g.add(tube(kit, "#3a2a1e", [0, 0, 0], [0, 1.0, 0], 0.03));
  g.add(sphere(kit, "#ffb347", [0, 1.15, 0], 0.22, { emissive: true }, [1, 1.3, 1]));
  g.add(sphere(kit, "#ffd166", [0.9, 0.12, 0], 0.08, { emissive: true }));
  return g;
}

// ── Distance and depth ──────────────────────────────────────────────────────

/** A distant band (tree line or low bank) along a polyline, hazed at the feet. Unlit silhouettes. */
function rangeBand(
  pts: V2[],
  centre: V2,
  inner: number,
  outer: number,
  crest: (s: number) => number,
  foot: number,
  colour: string,
  haze: string,
  hazeAmt: number,
): THREE.Mesh {
  const pos: number[] = [];
  const col: number[] = [];
  const top = new THREE.Color(colour);
  const low = top.clone().lerp(new THREE.Color(haze), hazeAmt);
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const p = pts[i] ?? [0, 0];
    const a = pts[Math.max(0, i - 1)] ?? p;
    const b = pts[Math.min(n - 1, i + 1)] ?? p;
    let nx = -(b[1] - a[1]);
    let nz = b[0] - a[0];
    const l = Math.hypot(nx, nz) || 1;
    nx /= l;
    nz /= l;
    if (nx * (p[0] - centre[0]) + nz * (p[1] - centre[1]) < 0) {
      nx = -nx;
      nz = -nz;
    }
    pos.push(
      p[0] - nx * inner,
      foot,
      p[1] - nz * inner,
      p[0],
      crest(i / (n - 1)),
      p[1],
      p[0] + nx * outer,
      foot,
      p[1] + nz * outer,
    );
    col.push(low.r, low.g, low.b, top.r, top.g, top.b, low.r, low.g, low.b);
  }
  const idx: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    for (let k = 0; k < 2; k++) {
      const a = i * 3 + k;
      const b = (i + 1) * 3 + k;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(idx);
  return new THREE.Mesh(
    geo,
    new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }),
  );
}

/** Shikhara silhouette for the far bank. */
function farTemple(colour: string, h: number): THREE.Group {
  const g = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: colour });
  const body = new THREE.Mesh(new THREE.BoxGeometry(h * 0.6, h * 0.35, h * 0.6), mat);
  body.position.y = h * 0.175;
  g.add(body);
  const prof = [
    new THREE.Vector2(h * 0.32, 0),
    new THREE.Vector2(h * 0.3, h * 0.25),
    new THREE.Vector2(h * 0.2, h * 0.5),
    new THREE.Vector2(h * 0.06, h * 0.68),
    new THREE.Vector2(0, h * 0.72),
  ];
  const sh = new THREE.Mesh(new THREE.LatheGeometry(prof, 12), mat);
  sh.position.y = h * 0.35;
  g.add(sh);
  return g;
}

/** Tree lines all round, the river running on past the island to a faint far bank. */
function gangeticDistance(scene: THREE.Scene, kit: Kit): void {
  const haze = BG.night;
  // The river continues beyond the island to the far bank.
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(440, 96),
    new THREE.MeshStandardMaterial({ color: "#1b3557", roughness: 0.12, metalness: 0.4 }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, WATER_Y, -20 - 48);
  water.receiveShadow = true;
  scene.add(water);
  // The faint far bank: a low sandy lip, then a lumpy tree line.
  const farPts: V2[] = Array.from({ length: 221 }, (_, i) => {
    const x = -220 + i * 2;
    return [x, -112 + 3 * Math.sin(x * 0.02)] as V2;
  });
  scene.add(
    rangeBand(farPts, [0, 0], 8, 4, () => WATER_Y + 0.7, WATER_Y - 1, "#2a2a2c", haze, 0.3),
  );
  const treePts = farPts.map(([x, z]) => [x, z - 5] as V2);
  scene.add(
    rangeBand(
      treePts,
      [0, 0],
      4,
      6,
      (s) => 4.5 + 1.6 * Math.abs(Math.sin(s * 160)) + 1.2 * Math.sin(s * 37),
      WATER_Y - 1,
      "#0b111d",
      haze,
      0.25,
    ),
  );
  // Temples and their lamps on the far ghats, with faint reflections.
  const lamps: THREE.Vector3[] = [];
  for (const [x, h] of [
    [-46, 11],
    [-30, 15],
    [18, 12],
    [64, 9],
  ] as [number, number][]) {
    const t = farTemple("#121a2a", h);
    t.position.set(x, WATER_Y + 0.6, -114 + 3 * Math.sin(x * 0.02));
    scene.add(t);
  }
  for (let i = 0; i < 46; i++) {
    const x = -90 + i * 4 + Math.sin(i * 1.7) * 1.4;
    lamps.push(new THREE.Vector3(x, WATER_Y + 1.0 + (i % 3) * 0.4, -110 + 3 * Math.sin(x * 0.02)));
  }
  scene.add(emissiveDots(kit, "#ffb347", lamps, 0.22));
  lamps.forEach((p, i) => {
    if (i % 3) return;
    const refl = new THREE.Mesh(
      new THREE.PlaneGeometry(0.5, 9),
      new THREE.MeshBasicMaterial({
        color: "#ffb347",
        transparent: true,
        opacity: 0.12,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    refl.rotation.x = -Math.PI / 2;
    refl.position.set(p.x, WATER_Y + 0.02, p.z + 5);
    scene.add(refl);
  });
  // Tree lines round the north of the plain.
  const u: V2[] = Array.from({ length: 241 }, (_, i) => {
    const a = -0.1 * Math.PI + (1.2 * Math.PI * i) / 240;
    return [Math.cos(a) * 128, Math.sin(a) * 98] as V2;
  });
  scene.add(
    rangeBand(
      u,
      [0, 0],
      14,
      10,
      (s) => 5 + 2.2 * Math.abs(Math.sin(s * 140)) + 1.5 * Math.sin(s * 29),
      -9,
      "#0c1220",
      haze,
      0.3,
    ),
  );
  const u2 = u.map(([x, z]) => [x * 1.25, z * 1.3] as V2);
  scene.add(
    rangeBand(
      u2,
      [0, 0],
      14,
      10,
      (s) => 8 + 2 * Math.abs(Math.sin(s * 120 + 1)) + 2 * Math.sin(s * 17),
      -9,
      "#111a2c",
      haze,
      0.3,
    ),
  );
  // The plain beyond the island, dark under the night sky.
  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(1, 96, 0, Math.PI),
    new THREE.MeshBasicMaterial({ color: "#121a14", side: THREE.DoubleSide }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.scale.set(150, 118, 1);
  floor.position.set(0, -8, -20);
  scene.add(floor);
}

// ── Town, people and outskirts ──────────────────────────────────────────────

/** An old riverside haveli: carved jharokha balconies, lit arched windows, rooftop chhatris. */
function haveli(kit: Kit, colour: string, floors: number, watchers: number): THREE.Group {
  const g = new THREE.Group();
  const h = floors * 2.2;
  g.add(box(kit, "#8a7a68", [-2.9, -1.6, -2.4], [2.9, 0.06, 2.4]));
  g.add(box(kit, colour, [-2.7, 0, -2.2], [2.7, h, 2.2]));
  for (let f = 0; f < floors; f++) {
    const y = f * 2.2;
    g.add(box(kit, "#e9d9bc", [-2.75, y + 2.05, -2.25], [2.75, y + 2.2, 2.25]));
    for (const x of [-1.6, 0, 1.6]) {
      const lit = (f + x) % 2 === 0 || f === 0;
      g.add(
        box(
          kit,
          lit ? "#ffd27a" : "#3a2a2a",
          [x - 0.38, y + 0.6, 2.19],
          [x + 0.38, y + 1.5, 2.23],
          { emissive: lit },
        ),
      );
      g.add(
        sphere(
          kit,
          lit ? "#ffd27a" : "#3a2a2a",
          [x, y + 1.5, 2.21],
          0.38,
          { emissive: lit },
          [1, 0.6, 0.1],
        ),
      );
    }
    if (f > 0) {
      // A jharokha: a projecting balcony with a little dome.
      g.add(box(kit, "#e9d9bc", [-0.8, y + 0.4, 2.2], [0.8, y + 0.55, 3.0]));
      g.add(box(kit, colour, [-0.75, y + 0.55, 2.95], [0.75, y + 1.0, 3.0]));
      g.add(sphere(kit, "#e9d9bc", [0, y + 1.75, 2.7], 0.6, undefined, [1.3, 0.6, 0.7]));
    }
  }
  g.add(box(kit, "#e9d9bc", [-2.8, h, -2.3], [2.8, h + 0.5, 2.3]));
  for (const x of [-2.2, 2.2]) {
    for (const [dx, dz] of [
      [-0.35, -0.35],
      [0.35, -0.35],
      [-0.35, 0.35],
      [0.35, 0.35],
    ] as [number, number][])
      g.add(tube(kit, "#e9d9bc", [x + dx, h + 0.5, -1.6 + dz], [x + dx, h + 1.4, -1.6 + dz], 0.06));
    g.add(sphere(kit, "#e9d9bc", [x, h + 1.45, -1.6], 0.55, undefined, [1, 0.75, 1]));
  }
  // People on the roof watching the fireworks.
  for (let i = 0; i < watchers; i++) {
    const p = figure(kit, FESTIVE[(i * 3 + floors) % FESTIVE.length] ?? "#ff9933", "#c98a5a", 0.9);
    p.position.set(-1.6 + i * 1.1, h + 0.5, 0.9 + (i % 2) * 0.5);
    g.add(p);
  }
  return g;
}

/** A riverside temple: plinth, sanctum, curved shikhara, kalash and a saffron flag. */
function riverTemple(kit: Kit, h = 7): THREE.Group {
  const g = new THREE.Group();
  g.add(box(kit, "#b9a888", [-2.6, -2.0, -2.6], [2.6, 0.6, 2.6]));
  g.add(box(kit, "#e6d3b0", [-1.8, 0.6, -1.8], [1.8, 2.8, 1.8]));
  g.add(box(kit, "#3a2a2a", [-0.5, 0.6, 1.79], [0.5, 2.0, 1.83]));
  g.add(sphere(kit, "#ffb347", [0, 1.0, 1.9], 0.1, { emissive: true }));
  const prof = [
    new THREE.Vector2(1.9, 0),
    new THREE.Vector2(1.8, h * 0.25),
    new THREE.Vector2(1.3, h * 0.55),
    new THREE.Vector2(0.45, h * 0.78),
    new THREE.Vector2(0.0, h * 0.82),
  ];
  const sh = new THREE.Mesh(new THREE.LatheGeometry(prof, 16), kit.mat("#e9cfa0"));
  sh.position.y = 2.8;
  sh.castShadow = true;
  g.add(sh);
  for (let i = 0; i < 4; i++) {
    const band = new THREE.Mesh(
      new THREE.TorusGeometry(1.75 - i * 0.32, 0.06, 6, 24),
      kit.mat("#c99a5a"),
    );
    band.rotation.x = Math.PI / 2;
    band.position.y = 2.8 + h * 0.12 + i * h * 0.16;
    g.add(band);
  }
  g.add(sphere(kit, "#ffd166", [0, 2.8 + h * 0.85, 0], 0.25, { metal: true }, [1, 1.3, 1]));
  g.add(tube(kit, "#6b4a32", [0, 2.8 + h * 0.85, 0], [0, 2.8 + h * 0.85 + 2.2, 0], 0.04));
  g.add(box(kit, "#ff7b00", [0, 2.8 + h * 0.85 + 1.3, -0.02], [1.0, 2.8 + h * 0.85 + 2.0, 0.02]));
  // A string of bells and lamps along the plinth.
  const lamps: THREE.Vector3[] = [];
  for (let i = 0; i < 9; i++) lamps.push(new THREE.Vector3(-2.4 + i * 0.6, 0.72, 2.62));
  g.add(emissiveDots(kit, "#ffb347", lamps, 0.07));
  return g;
}

/** A family walking to the mela: a father with a child on his shoulders, a mother holding a kid's hand. */
function family(kit: Kit, seed: number): THREE.Group {
  const g = new THREE.Group();
  const dad = figure(kit, seed % 2 ? "#f5efe6" : "#7fb3d5", "#a9693f", 1.2);
  const kidUp = figure(kit, FESTIVE[seed % FESTIVE.length] ?? "#e63946", "#a9693f", 0.45);
  kidUp.position.set(0, 1.6, 0);
  dad.add(kidUp);
  g.add(dad);
  const mum = figure(kit, FESTIVE[(seed + 3) % FESTIVE.length] ?? "#ef476f", "#a9693f", 1.1);
  mum.position.set(0.9, 0, 0.2);
  mum.add(
    sphere(
      kit,
      FESTIVE[(seed + 3) % FESTIVE.length] ?? "#ef476f",
      [0, 1.38, -0.04],
      0.22,
      undefined,
      [1, 0.6, 1],
    ),
  );
  g.add(mum);
  const kid = figure(kit, FESTIVE[(seed + 5) % FESTIVE.length] ?? "#ffd166", "#a9693f", 0.55);
  kid.position.set(1.55, 0, 0.35);
  g.add(kid);
  g.add(tube(kit, "#a9693f", [1.05, 0.75, 0.25], [1.45, 0.5, 0.33], 0.035));
  if (seed % 3 === 0) {
    // The kid has a balloon.
    g.add(tube(kit, "#e9e4da", [1.6, 0.5, 0.35], [1.7, 1.9, 0.35], 0.01));
    g.add(sphere(kit, "#ef476f", [1.7, 2.1, 0.35], 0.22, { emissive: true }, [1, 1.2, 1]));
  }
  return g;
}

/** A balloon seller with a big bunch of balloons on a pole. */
function balloonSeller(kit: Kit): THREE.Group {
  const g = new THREE.Group();
  g.add(figure(kit, "#9c6644", "#a9693f", 1.15));
  g.add(tube(kit, "#c9a46a", [0.35, 0, 0.1], [0.35, 2.6, 0.1], 0.04));
  for (let i = 0; i < 14; i++) {
    const a = i * 2.39996;
    const r = 0.25 + (i % 4) * 0.13;
    const p: [number, number, number] = [
      0.35 + Math.cos(a) * r,
      2.9 + (i % 5) * 0.16,
      0.1 + Math.sin(a) * r,
    ];
    g.add(tube(kit, "#e9e4da", [0.35, 2.6, 0.1], p, 0.008));
    g.add(
      sphere(
        kit,
        FESTIVE[i % FESTIVE.length] ?? "#ef476f",
        p,
        0.2,
        { emissive: i % 2 === 0 },
        [1, 1.2, 1],
      ),
    );
  }
  return g;
}

/** A cycle-rickshaw with its puller and a couple of passengers. */
function cycleRickshaw(kit: Kit, passengers = 2): THREE.Group {
  const g = new THREE.Group();
  const wheel = (x: number, z: number) => {
    const w = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.04, 6, 20), kit.mat("#1c1d21"));
    w.position.set(x, 0.38, z);
    g.add(w);
  };
  wheel(1.0, 0);
  wheel(-0.6, -0.55);
  wheel(-0.6, 0.55);
  g.add(tube(kit, "#2a6b4a", [1.0, 0.38, 0], [0.2, 0.75, 0], 0.04));
  g.add(tube(kit, "#2a6b4a", [0.2, 0.75, 0], [-0.6, 0.45, 0], 0.04));
  g.add(tube(kit, "#9aa3ad", [-0.6, 0.38, -0.55], [-0.6, 0.38, 0.55], 0.03, { metal: true }));
  g.add(box(kit, "#2a6b4a", [-1.0, 0.65, -0.55], [-0.2, 0.85, 0.55]));
  g.add(box(kit, "#c1121f", [-1.05, 0.85, -0.55], [-0.85, 1.5, 0.55]));
  const hood = new THREE.Mesh(
    new THREE.CylinderGeometry(0.6, 0.6, 1.15, 16, 1, true, 0, Math.PI),
    kit.mat("#1f4e79"),
  );
  hood.rotation.x = Math.PI / 2;
  hood.rotation.z = Math.PI / 2;
  hood.position.set(-0.8, 1.55, 0);
  g.add(hood);
  const puller = figure(kit, "#e9e4da", "#7a4a2e", 0.75);
  puller.position.set(0.25, 0.75, 0);
  g.add(puller);
  for (let i = 0; i < passengers; i++) {
    const p = figure(kit, FESTIVE[(i + 2) % FESTIVE.length] ?? "#ffd166", "#a9693f", 0.6);
    p.position.set(-0.7, 0.85, -0.25 + i * 0.5);
    g.add(p);
  }
  return g;
}

/** A mango tree: short trunk, dense rounded crown, a few fruits. */
function mangoTree(kit: Kit, s = 1): THREE.Group {
  const g = new THREE.Group();
  g.add(tube(kit, "#5a4030", [0, 0, 0], [0, 1.4 * s, 0], 0.22 * s));
  g.add(sphere(kit, "#2f5a34", [0, 2.5 * s, 0], 1.7 * s, undefined, [1.15, 0.8, 1.15]));
  g.add(sphere(kit, "#386a3c", [0.6 * s, 3.0 * s, 0.3 * s], 1.0 * s, undefined, [1.1, 0.8, 1.1]));
  for (let i = 0; i < 5; i++) {
    const a = i * 1.3;
    g.add(sphere(kit, "#e0a526", [Math.cos(a) * 1.6 * s, 2.0 * s, Math.sin(a) * 1.6 * s], 0.1 * s));
  }
  return g;
}

/** A village well: stone ring, a timber frame and pulley, a brass pot on the rim. */
function well(kit: Kit): THREE.Group {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(
    new THREE.CylinderGeometry(1.0, 1.1, 1.8, 24, 1, true),
    kit.mat("#b9ad98"),
  );
  ring.position.y = 0;
  (ring.material as THREE.Material).side = THREE.DoubleSide;
  g.add(ring);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(1.02, 0.12, 8, 28), kit.mat("#d8cdb8"));
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.9;
  g.add(rim);
  g.add(disc(kit, "#0d1a26", [0, 0.6, 0], 0.95, 0.02));
  for (const x of [-1.05, 1.05]) g.add(tube(kit, "#6b4a32", [x, 0.9, 0], [x * 0.85, 2.6, 0], 0.07));
  g.add(tube(kit, "#6b4a32", [-1.0, 2.6, 0], [1.0, 2.6, 0], 0.06));
  g.add(disc(kit, "#8a5a3a", [0, 2.45, 0], 0.18, 0.06));
  g.add(tube(kit, "#d8cdb8", [0, 2.3, 0], [0, 1.3, 0], 0.012));
  g.add(sphere(kit, "#c9a227", [0.95, 1.15, 0.3], 0.22, { metal: true }, [1, 0.9, 1]));
  return g;
}

/** An India Mark II hand-pump on a little concrete platform. */
function handPump(kit: Kit): THREE.Group {
  const g = new THREE.Group();
  g.add(box(kit, "#a8a39a", [-0.8, -0.6, -0.8], [0.8, 0.12, 0.8]));
  g.add(tube(kit, "#2f6b4f", [0, 0.12, 0], [0, 1.2, 0], 0.12));
  g.add(tube(kit, "#2f6b4f", [0, 1.15, 0], [0.3, 1.0, 0], 0.05));
  g.add(tube(kit, "#2f6b4f", [0, 1.25, 0], [-0.9, 1.55, 0], 0.035));
  g.add(sphere(kit, "#2f6b4f", [0, 1.28, 0], 0.15));
  return g;
}

function tNear(r: Road, x: number, z: number): number {
  let best = 0;
  let bd = Number.POSITIVE_INFINITY;
  for (let i = 0; i <= 600; i++) {
    const p = r.at(i / 600).p;
    const d = (p.x - x) ** 2 + (p.z - z) ** 2;
    if (d < bd) {
      bd = d;
      best = i / 600;
    }
  }
  return best;
}

export const fair: JourneyDef = {
  id: "fair",
  title: "C++ for fun · Dussehra riverside mela (open world, night)",
  mood: "night",
  bike: "scrambler",
  build(scene, kit) {
    const W = 3.0;
    const LANE_W = W - 0.4;
    const SPUR_W = W - 0.8;
    // Roads' xz are fixed by their control points, so the network and every
    // placement are planned on the base roads, the ground is levelled under
    // each footprint (pads), and then the roads are carved in.
    const loop0 = makeRoad(LOOP, base, true);
    const laneFrom = tNear(loop0, -26, 20);
    const laneTo = tNear(loop0, 26, 20);
    const viaLane: V2[] = [
      [-20, 30],
      [-8, 36],
      [8, 36],
      [20, 30],
    ];
    const lane0 = makeRoad(branchPoints(loop0, laneFrom, laneTo, viaLane), base);
    const AARTI_X = -24;
    const aartiTop = bankZ(AARTI_X) + 4.2;
    const spurFrom = tNear(loop0, -30, -11);
    const spurPts = (r: Road): V2[] => {
      const a = r.at(spurFrom);
      const b = r.at(spurFrom + 0.006);
      return [
        [a.p.x, a.p.z],
        [b.p.x, b.p.z],
        [-26, -16],
        [AARTI_X, -20],
        [AARTI_X, aartiTop],
      ];
    };
    const spur0 = makeRoad(spurPts(loop0), base);
    const spawnT = tNear(loop0, CENTRE[0], CENTRE[1]);

    // Planned placements.
    const STAGE: V2 = [-42, 6];
    const EFFIGY: V2 = [44, -17.5];
    const RIDES: [V2, number][] = [
      [[48, 14], 4.6],
      [[36, 12], 4],
      [[54, 3], 3.6],
      [[27, 1], 5.6],
    ];
    const VILLAGE: V2[] = [
      [-30, 40],
      [-14, 45],
      [12, 45],
      [30, 40],
    ];
    const HAVELIS: [number, number, string, number][] = [
      [-68, -16.5, "#e8b4a0", 3],
      [-60, -17, "#f2d49b", 2],
      [-52, -16.5, "#c9d6df", 3],
      [-44, -17, "#e9a86f", 2],
      [-36, -17.5, "#f0c9c9", 2],
    ];
    const TEMPLES: V2[] = [
      [-64, bankZ(-64) + 5.5],
      [-48, bankZ(-48) + 5.5],
    ];
    const GHATS = [-56, -40, AARTI_X, 18, 62];
    const MUSTARD = { x0: -70, x1: -48, z0: 33, z1: 52 };
    const ORCHARD = { x0: 44, x1: 70, z0: 32, z1: 52 };
    const WELL: V2 = [-44, 44];
    const PUMP: V2 = [-41, 38];
    const foods: Food[] = ["golgappe", "jalebi", "candyfloss", "kulfi", "golgappe", "jalebi"];
    const foodPlan = foods.map((kind, i) => {
      const t = 0.18 + i * 0.13;
      const p = beside(lane0, t, LANE_W / 2 + 2.6, i % 2 ? 1 : -1);
      return { kind, t, x: p.x, z: p.z };
    });
    const corner = (r: Road, lo: number, hi: number) =>
      r.corners(0.02).find((t) => t > lo && t < hi) ?? (lo + hi) / 2;
    const stopPlan = (
      [
        ["road", corner(loop0, 0.62, 0.72), chatBooth],
        ["lane", corner(lane0, 0.35, 0.65), pianoStall],
        ["road", corner(loop0, 0.12, 0.25), tvWallStall],
      ] as const
    ).map(([on, t, make]) => {
      const r0 = on === "road" ? loop0 : lane0;
      const p = beside(r0, t, (on === "road" ? W : LANE_W) / 2 + 3.0, "outside");
      return { on, t, make, x: p.x, z: p.z };
    });
    const pads = [
      { x: STAGE[0], z: STAGE[1], r: 5.5 },
      { x: -33, z: 2.5, r: 4.5 },
      { x: EFFIGY[0], z: EFFIGY[1], r: 4, blend: 2.5 },
      ...RIDES.map(([[x, z], r]) => ({ x, z, r })),
      ...VILLAGE.map(([x, z]) => ({ x, z, r: 3 })),
      ...HAVELIS.map(([x, z]) => ({ x, z, r: 3.2, blend: 2 })),
      ...TEMPLES.map(([x, z]) => ({ x, z, r: 3, blend: 2 })),
      ...foodPlan.map((f) => ({ x: f.x, z: f.z, r: 1.8 })),
      ...stopPlan.map((s) => ({ x: s.x, z: s.z, r: 2.0 })),
      { x: WELL[0], z: WELL[1], r: 2 },
      { x: PUMP[0], z: PUMP[1], r: 1.4 },
    ];
    const height = carve(
      carve(carve(flattenPads(base, pads), loop0, W + 0.4, 2.5), lane0, LANE_W, 2.5),
      spur0,
      SPUR_W,
      2,
    );
    const road = makeRoad(LOOP, height, true);
    const lane = makeRoad(branchPoints(road, laneFrom, laneTo, viaLane), height);
    const spur = makeRoad(spurPts(road), height);
    const roads = [road, lane, spur];
    const upright = (o: THREE.Object3D, x: number, z: number, yaw: number, footprint = 1.2) => {
      placeOnGround(o, height, x, z, { mode: "upright", yaw, footprint });
      scene.add(o);
      return o;
    };
    const align = (o: THREE.Object3D, x: number, z: number, yaw: number) => {
      placeOnGround(o, height, x, z, { mode: "align", yaw });
      scene.add(o);
      return o;
    };
    const yawTo = (x: number, z: number, tx: number, tz: number) => Math.atan2(tx - x, tz - z);
    const facingTraffic = (r: Road, t: number) => r.at(t).heading - Math.PI / 2;

    // Trodden mela ground near the roads and maidans, grass beyond.
    // A distance field (0.5 m cells) to roads and maidans, blended softly with an organic edge.
    const GX = 340;
    const GZ = 260;
    const dist = new Float32Array(GX * GZ).fill(99);
    const mark = (x: number, z: number, r: number) => {
      const R = 9;
      for (let ix = Math.floor((x - R + 85) * 2); ix <= Math.ceil((x + R + 85) * 2); ix++)
        for (let iz = Math.floor((z - R + 65) * 2); iz <= Math.ceil((z + R + 65) * 2); iz++) {
          if (ix < 0 || ix >= GX || iz < 0 || iz >= GZ) continue;
          const d = Math.hypot(ix / 2 - 85 - x, iz / 2 - 65 - z) - r;
          const k = iz * GX + ix;
          if (d < (dist[k] ?? 99)) dist[k] = d;
        }
    };
    for (const r of roads) for (const s of r.samples) mark(s.x, s.z, 1.5);
    for (const p of pads) mark(p.x, p.z, p.r);
    const grass = new THREE.Color("#71905a");
    const dustC = new THREE.Color("#c0a278");
    const mix = new THREE.Color();
    const dustAmt = (x: number, z: number) => {
      const ix = Math.min(GX - 1, Math.max(0, Math.round((x + 85) * 2)));
      const iz = Math.min(GZ - 1, Math.max(0, Math.round((z + 65) * 2)));
      const d = (dist[iz * GX + ix] ?? 99) + 1.3 * Math.sin(x * 0.7) * Math.cos(z * 0.6);
      return 1 - THREE.MathUtils.smoothstep(d, 2.5, 6);
    };
    const inRect = (
      o: { x0: number; x1: number; z0: number; z1: number },
      x: number,
      z: number,
      m = 0,
    ) => x > o.x0 - m && x < o.x1 + m && z > o.z0 - m && z < o.z1 + m;

    gangeticDistance(scene, kit);
    scene.add(
      terrain({
        w: 160,
        d: 124,
        height,
        mood: "night",
        colour: (x, z, h) => {
          if (h < WATER_Y + 0.7 && z < bankZ(x) - 5) return "#cbb48a"; // sandbanks
          if (h < -0.9) return "#7a6650";
          if (inRect(MUSTARD, x, z)) return Math.sin(z * 2.2) > -0.2 ? "#d9b21c" : "#7d8a3a";
          if (inRect(ORCHARD, x, z)) return "#4c6a3a";
          const k = dustAmt(x, z);
          return `#${mix
            .copy(grass)
            .offsetHSL(0, 0, 0.03 * Math.sin(x * 0.3 + z * 0.2))
            .lerp(dustC, k)
            .getHexString()}`;
        },
      }),
    );

    for (const r of roads) {
      const w = r === road ? W : r === lane ? LANE_W : SPUR_W;
      scene.add(roadMesh(kit, r, w + 0.5, "#8a6a4a", 0.07));
      scene.add(roadMesh(kit, r, w, "#5a4a3c", 0.1));
    }

    // ── The river: ghats, diyas, lantern boats ───────────────────────────────
    const ghatTop: Record<number, number> = {};
    for (const gx of GHATS) {
      const bz = bankZ(gx);
      const top = height(gx, bz + 4);
      ghatTop[gx] = top;
      const steps = 7;
      for (let i = 0; i < steps; i++) {
        const y = WATER_Y - 0.25 + ((top - WATER_Y + 0.25) * (i + 1)) / steps;
        const z0 = bz - 3.5 + i * 0.9;
        scene.add(
          box(
            kit,
            i % 2 ? "#d8cdb8" : "#cfc3ac",
            [gx - 6, WATER_Y - 1.6, z0],
            [gx + 6, y, z0 + 0.9 + (i === steps - 1 ? 2.4 : 0)],
          ),
        );
      }
      // Chhatri umbrellas on the ghat.
      for (const dx of [-4.2, 4.2]) {
        const u = new THREE.Group();
        u.add(tube(kit, "#c9a46a", [0, 0, 0], [0, 2.4, 0], 0.05));
        const cone = new THREE.Mesh(new THREE.ConeGeometry(1.3, 0.6, 16), kit.mat("#d9a066"));
        cone.position.y = 2.6;
        u.add(cone);
        u.position.set(gx + dx, top, bz + 2.4);
        scene.add(u);
      }
    }
    const diyas: THREE.Vector3[] = [];
    for (let i = 0; i < 200; i++) {
      const x = -72 + ((i * 83) % 144) + Math.sin(i) * 1.5;
      const z = bankZ(x) - 5 - ((i * 37) % 26);
      if (height(x, z) > WATER_Y - 0.05) continue; // not on the sandbanks
      diyas.push(new THREE.Vector3(x, WATER_Y + 0.08, z));
    }
    scene.add(emissiveDots(kit, "#ffb347", diyas, 0.13));
    for (let i = 0; i < 10; i++) {
      const x = -50 + i * 6.5;
      const z = bankZ(x) - 9 - Math.sin(i * 0.7) * 1.6;
      const b = lanternBoat(kit);
      b.position.set(x, WATER_Y + 0.1, z);
      b.rotation.y = 0.1;
      scene.add(b);
    }
    // A boatman's dinghy pulled up on the sandbank.
    const beached = lanternBoat(kit);
    beached.position.set(-14, height(-14, -44) + 0.15, -44);
    beached.rotation.set(0, 0.6, 0.08);
    scene.add(beached);

    // ── Arrival gateway (spawn): the marigold mela gate over the crossing ────
    const spn = road.at(spawnT);
    const plaza = new THREE.Mesh(new THREE.CircleGeometry(7, 48), kit.mat("#8a6a4a"));
    plaza.rotation.x = -Math.PI / 2;
    plaza.position.set(spn.p.x, spn.p.y + 0.14, spn.p.z);
    scene.add(plaza);
    const rangoli: THREE.Vector3[] = [];
    for (let k = 0; k < 3; k++)
      for (let i = 0; i < 28; i++) {
        const a = (i / 28) * Math.PI * 2;
        rangoli.push(
          new THREE.Vector3(
            spn.p.x + Math.cos(a) * (1.2 + k * 0.7),
            spn.p.y + 0.2,
            spn.p.z + Math.sin(a) * (1.2 + k * 0.7),
          ),
        );
      }
    scene.add(emissiveDots(kit, "#ff9f1c", rangoli, 0.09));
    const gate = new THREE.Group();
    for (const s of [-1, 1]) {
      gate.add(tube(kit, "#ffd166", [0, -0.3, s * 4.4], [0, 5.4, s * 4.4], 0.22));
      for (let i = 0; i < 13; i++)
        gate.add(sphere(kit, i % 2 ? "#ff9f1c" : "#ffbf00", [0.25, 0.4 + i * 0.4, s * 4.4], 0.17));
      for (let i = 0; i < 3; i++)
        gate.add(
          sphere(kit, "#2f7d4f", [0.3, 1.4 + i * 1.2, s * 4.2], 0.3, undefined, [0.3, 1.6, 0.6]),
        );
    }
    gate.add(box(kit, "#c1121f", [-0.35, 5.2, -4.8], [0.35, 6.1, 4.8]));
    for (let i = 0; i < 18; i++) {
      const z = -4.4 + (i / 17) * 8.8;
      gate.add(
        sphere(
          kit,
          i % 2 ? "#ff9f1c" : "#ffbf00",
          [0.4, 5.05 - Math.sin((i / 17) * Math.PI) * 0.5, z],
          0.14,
        ),
      );
    }
    const gateSign = bilingual("मेला", "WELCOME TO THE MELA", "#ffd166", "#5a1414");
    gateSign.position.set(0.5, 7.0, 0);
    gate.add(gateSign);
    gate.add(
      lanternString(
        kit,
        new THREE.Vector3(0.3, 5.0, -4.4),
        new THREE.Vector3(0.3, 5.0, 4.4),
        14,
        0.8,
      ),
    );
    const gateAt = road.at(spawnT + 0.015);
    gate.position.set(gateAt.p.x, gateAt.p.y, gateAt.p.z);
    gate.rotation.y = gateAt.heading;
    scene.add(gate);
    nightLight(scene, "night", gateAt.p.x, gateAt.p.y + 4, gateAt.p.z, "#ffcf7a", 14);
    // NHAI guide board by the plaza, facing the arrival view; a km stone.
    upright(
      nhaiSign(
        kit,
        [
          { local: "खान-पान गली", en: "Food Lane", arrow: "up" },
          { local: "रामलीला मैदान · आरती घाट", en: "Ramlila · Aarti Ghat", arrow: "left", km: 1 },
          { local: "झूले · रावण दहन", en: "Rides · Ravan Dahan", arrow: "right", km: 1 },
        ],
        4.4,
      ),
      spn.p.x - 8,
      spn.p.z + 1,
      -0.66,
      0.4,
    );
    const ks = beside(road, spawnT - 0.03, W / 2 + 0.9, 1);
    upright(
      kmStone(kit, "Ramnagar", 3, "nh"),
      ks.x,
      ks.z,
      facingTraffic(road, spawnT - 0.03) + Math.PI / 2,
      0.2,
    );
    const bs = beside(road, spawnT + 0.035, W / 2 + 2.4, -1);
    upright(balloonSeller(kit), bs.x, bs.z, 0.3, 0.3);

    // Lantern strings across the roads, spaced out (straights stay calm).
    for (const r of roads) {
      const step = r === road ? 0.045 : 0.12;
      const w = r === road ? W : LANE_W;
      for (let t = 0.03; t < 0.97; t += step) {
        if (r === road && Math.abs(t - spawnT) < 0.04) continue;
        const l = beside(r, t, w / 2 + 1.2, 1);
        const rt = beside(r, t, w / 2 + 1.2, -1);
        for (const p of [l, rt])
          scene.add(tube(kit, "#5a3b28", [p.x, p.y - 0.3, p.z], [p.x, p.y + 3.4, p.z], 0.05));
        scene.add(
          lanternString(
            kit,
            new THREE.Vector3(l.x, l.y + 3.3, l.z),
            new THREE.Vector3(rt.x, rt.y + 3.3, rt.z),
            12,
            0.5,
          ),
        );
      }
    }

    // Families walking to the mela on the shoulders; cycle-rickshaws.
    [spawnT - 0.06, spawnT + 0.08, 0.3, 0.42, 0.58, 0.82].forEach((t, i) => {
      const p = beside(road, t, W / 2 + 1.0, i % 2 ? 1 : -1);
      align(family(kit, i), p.x, p.z, road.at(t).heading + (i % 2 ? 0 : Math.PI));
    });
    [0.3, 0.7].forEach((t, i) => {
      const p = beside(lane, t, LANE_W / 2 + 1.0, i ? 1 : -1);
      align(family(kit, i + 7), p.x, p.z, lane.at(t).heading);
    });
    [spawnT + 0.05, 0.36, 0.9].forEach((t, i) => {
      const p = beside(road, t, W / 2 + 1.2, i % 2 ? -1 : 1);
      align(cycleRickshaw(kit, 1 + (i % 2)), p.x, p.z, road.at(t).heading + (i % 2 ? Math.PI : 0));
    });

    // ── West lobe: Ramlila maidan ────────────────────────────────────────────
    upright(ramlilaStage(kit), STAGE[0], STAGE[1], yawTo(STAGE[0], STAGE[1], -26, 6), 4);
    const sl = new THREE.PointLight("#ffd28a", 34, 26, 1.4);
    sl.position.set(-38, height(-38, 6) + 5, 6);
    scene.add(sl);
    for (let row = 0; row < 3; row++) {
      const dz = row * 2.3;
      const y = height(-33, 1 + dz);
      scene.add(
        box(
          kit,
          ["#a4161a", "#1f4e79", "#2f7d4f"][row] ?? "#a4161a",
          [-36, y + 0.02, -0.2 + dz],
          [-30, y + 0.07, 1.8 + dz],
        ),
      );
      for (let i = 0; i < 9; i++) {
        const x = -35.4 + i * 0.68;
        const z = 0.8 + dz + (i % 2) * 0.3;
        scene.add(
          sphere(
            kit,
            FESTIVE[(i + row) % FESTIVE.length] ?? "#fff",
            [x, y + 0.4, z],
            0.24,
            undefined,
            [1, 1.4, 1],
          ),
        );
        scene.add(sphere(kit, "#3a2a1e", [x, y + 0.82, z], 0.14));
      }
    }

    // ── South-west: the old town stepping down to the ghats ──────────────────
    HAVELIS.forEach(([x, z, c, floors], i) => {
      upright(haveli(kit, c, floors, 2 + (i % 3)), x, z, Math.PI, 3);
    });
    TEMPLES.forEach(([x, z], i) => {
      upright(riverTemple(kit, 6 + i * 2), x, z, Math.PI, 2.6);
    });
    for (const [x, z] of HAVELIS)
      nightLight(scene, "night", x, height(x, z) + 3, z - 3, "#ffcf7a", 6);
    // Aarti priests on the ghat at the end of the spur.
    const aTop = ghatTop[AARTI_X] ?? 0;
    const aBank = bankZ(AARTI_X);
    for (let i = 0; i < 5; i++) {
      const p = aartiPriest(kit);
      p.position.set(AARTI_X - 5 + i * 2.5, aTop, aBank + 2.2);
      p.rotation.y = Math.PI;
      scene.add(p);
    }
    // Worshippers seated on the steps behind them.
    for (let i = 0; i < 10; i++) {
      const x = AARTI_X - 5.5 + i * 1.2;
      scene.add(
        sphere(
          kit,
          FESTIVE[i % FESTIVE.length] ?? "#ff9933",
          [x, aTop + 0.3, aBank + 4.2 + (i % 2) * 0.5],
          0.24,
          undefined,
          [1, 1.3, 1],
        ),
      );
    }
    const al = new THREE.PointLight("#ffb347", 40, 22, 1.4);
    al.position.set(AARTI_X, aTop + 4, aBank + 1);
    scene.add(al);
    const se = spur.at(1);
    upright(
      signPost(kit, bilingual("आरती घाट", "AARTI GHAT", "#ffd166", "#5a1414")),
      se.p.x + 3.4,
      se.p.z + 1.2,
      0,
      0.2,
    );
    upright(
      signPost(kit, bilingual("फ़ोटो पॉइंट", "PHOTO SPOT", "#ffffff", "#1f4e79", "camera"), 2.2),
      se.p.x - 3.4,
      se.p.z + 1.2,
      0,
      0.2,
    );

    // ── North: the food lane, the village and the kite fight ─────────────────
    for (const f of foodPlan) {
      const q = lane.at(f.t).p;
      upright(foodStall(kit, f.kind), f.x, f.z, yawTo(f.x, f.z, q.x, q.z), 1.4);
      nightLight(scene, "night", f.x, height(f.x, f.z) + 2.2, f.z, "#ffcf7a", 6);
    }
    for (const [x, z] of VILLAGE) {
      const h = new THREE.Group();
      h.add(box(kit, "#8a7a68", [-2.2, -1.0, -1.8], [2.2, 0.06, 1.8]));
      h.add(box(kit, "#e9d3ad", [-2, 0, -1.6], [2, 3, 1.6]));
      h.add(box(kit, "#c97b3d", [-2.1, 3, -1.7], [2.1, 3.3, 1.7]));
      h.add(box(kit, "#ffd88a", [-0.6, 1, 1.59], [0.6, 2, 1.62], { emissive: true }));
      const flyer = figure(kit, "#4f7cff", "#c9773a", 0.8);
      flyer.position.set(1.2, 3.3, 0.6);
      h.add(flyer);
      upright(h, x, z, 0, 2);
    }
    const kitesAt: [number, number, number, string][] = [
      [-18, 16, 30, "#ef476f"],
      [-15, 17, 31, "#ffd166"],
      [10, 15, 30, "#06d6a0"],
      [24, 18, 26, "#9b5de5"],
    ];
    for (const [x, y, z, c] of kitesAt) {
      const k = kite(kit, c);
      k.position.set(x, y, z);
      scene.add(k);
    }
    const roofY = (x: number, z: number) => height(x, z) + 3.3 + 0.6;
    scene.add(
      tube(kit, "#f5efe6", [-29, roofY(-30, 40), 40.5], [-18, 15.5, 30], 0.02, { emissive: true }),
    );
    scene.add(
      tube(kit, "#f5efe6", [-13, roofY(-14, 45), 45.5], [-15, 16.5, 31], 0.02, { emissive: true }),
    );
    const cut = kite(kit, "#ff9933");
    cut.position.set(-6, 12, 18);
    cut.rotation.set(0.6, 0.4, 1.1);
    scene.add(cut);
    scene.add(tube(kit, "#f5efe6", [-6, 11.2, 18], [-3, 8, 15], 0.02, { emissive: true }));

    // ── Outskirts: mustard fields, a mango orchard, the well and hand-pump ───
    // Mustard in bloom: jittered rows of low yellow plants.
    const plants: THREE.Matrix4[] = [];
    let seed = 7;
    const rnd = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    for (let z = MUSTARD.z0 + 1; z < MUSTARD.z1; z += 0.9)
      for (let x = MUSTARD.x0 + 1; x < MUSTARD.x1; x += 0.55) {
        const px = x + (rnd() - 0.5) * 0.4;
        const pz = z + (rnd() - 0.5) * 0.3;
        if (roads.some((r) => r.samples.some((s) => (s.x - px) ** 2 + (s.z - pz) ** 2 < 16)))
          continue;
        const sc = 0.7 + rnd() * 0.5;
        plants.push(
          new THREE.Matrix4().compose(
            new THREE.Vector3(px, height(px, pz) + 0.35 * sc, pz),
            new THREE.Quaternion(),
            new THREE.Vector3(sc, sc * 1.3, sc),
          ),
        );
      }
    const mustard = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.22, 8, 6),
      kit.mat("#ffe04a"),
      plants.length,
    );
    plants.forEach((m, i) => {
      mustard.setMatrixAt(i, m);
    });
    mustard.castShadow = true;
    mustard.receiveShadow = true;
    scene.add(mustard);
    for (let x = ORCHARD.x0 + 2; x < ORCHARD.x1; x += 5.5)
      for (let z = ORCHARD.z0 + 2; z < ORCHARD.z1; z += 5.5) {
        if (roads.some((r) => r.samples.some((s) => (s.x - x) ** 2 + (s.z - z) ** 2 < 30)))
          continue;
        const tr = mangoTree(kit, 0.85 + ((x + z) % 3) * 0.08);
        tr.position.set(x, height(x, z) - 0.05, z);
        scene.add(tr);
      }
    upright(well(kit), WELL[0], WELL[1], 0, 1.1);
    upright(handPump(kit), PUMP[0], PUMP[1], 0.8, 0.8);
    const pumpKid = figure(kit, "#ffd166", "#a9693f", 0.55);
    upright(pumpKid, PUMP[0] + 1.1, PUMP[1] + 0.4, -1.2, 0.2);

    // ── East lobe: rides ground and the Ravan dahan maidan ───────────────────
    const [[wx, wz], [bx, bz], [cx, cz], [tx, tz]] = RIDES.map(([p]) => p) as [V2, V2, V2, V2];
    upright(giantWheel(kit), wx, wz, -0.5, 2.2);
    upright(breakDance(kit), bx, bz, 0, 3.4);
    upright(columbus(kit), cx, cz, 0.3, 2.2);
    upright(toyTrain(kit), tx, tz, 0, 3);
    for (const [x, z, c] of [
      [wx, wz + 2, "#ff7ab0"],
      [bx, bz, "#ffd166"],
      [cx, cz, "#4fc3f7"],
    ] as [number, number, string][]) {
      const l = new THREE.PointLight(c, 26, 22, 1.4);
      l.position.set(x, height(x, z) + 5, z + 2);
      scene.add(l);
    }
    const [ex, ez] = EFFIGY;
    upright(ravanEffigy(kit), ex, ez, 0, 2.6);
    const el = new THREE.PointLight("#ffb36b", 70, 30, 1.3);
    el.position.set(ex, height(ex, ez) + 7, ez + 7);
    scene.add(el);
    // The dahan crowd at a safe distance on both sides.
    for (const side of [-1, 1])
      for (let i = 0; i < 12; i++) {
        const x = ex + side * (6.5 + (i % 3) * 0.8);
        const z = ez - 2 + Math.floor(i / 3) * 1.1;
        const y = height(x, z);
        scene.add(
          sphere(
            kit,
            FESTIVE[(i + (side > 0 ? 3 : 0)) % FESTIVE.length] ?? "#fff",
            [x, y + 0.55, z],
            0.26,
            undefined,
            [1, 1.9, 1],
          ),
        );
        scene.add(sphere(kit, "#3a2a1e", [x, y + 1.15, z], 0.15));
      }
    scene.add(fireworks(kit, new THREE.Vector3(ex, height(ex, ez), ez)));
    for (const [dx, colour] of [
      [-8, "#ffd166"],
      [6, "#ef476f"],
      [14, "#06d6a0"],
      [-15, "#9b5de5"],
    ] as [number, string][]) {
      const refl = new THREE.Mesh(
        new THREE.PlaneGeometry(1.6, 10),
        new THREE.MeshBasicMaterial({
          color: colour,
          transparent: true,
          opacity: 0.13,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      refl.rotation.x = -Math.PI / 2;
      refl.position.set(ex + dx, WATER_Y + 0.02, ez - 18);
      scene.add(refl);
    }
    // Sky lanterns rising over the river.
    const lanterns: THREE.Vector3[] = [];
    for (let i = 0; i < 24; i++) {
      const x = -50 + ((i * 47) % 110);
      lanterns.push(new THREE.Vector3(x, 15 + (i % 5) * 2.4, bankZ(x) - 8 - ((i * 13) % 16)));
    }
    scene.add(emissiveDots(kit, "#ffb347", lanterns, 0.3));
    // Fruit bats over the orchard (night birds).
    for (let i = 0; i < 7; i++) {
      const bat = new THREE.Group();
      for (const s of [-1, 1]) {
        const wing = box(kit, "#1a1a20", [0, -0.02, 0], [0.5, 0.02, 0.18]);
        wing.rotation.y = s > 0 ? 0 : Math.PI;
        wing.rotation.z = s * 0.3;
        bat.add(wing);
      }
      bat.position.set(48 + i * 3, 10 + (i % 2), 46 - i * 1.5);
      scene.add(bat);
    }

    // Neem and peepal trees, kept off the roads, buildings and fields.
    for (let i = 0; i < 70; i++) {
      const x = -72 + ((i * 71) % 144);
      const z = -14 + ((i * 29) % 70);
      if (Math.abs(x) > 72 || z > 54 || z > bankZ(x) + 100 || z < -12) continue;
      if (roads.some((r) => r.samples.some((s) => (s.x - x) ** 2 + (s.z - z) ** 2 < 40))) continue;
      if (pads.some((p) => (x - p.x) ** 2 + (z - p.z) ** 2 < (p.r + 3) ** 2)) continue;
      if (inRect(MUSTARD, x, z, 2) || inRect(ORCHARD, x, z, 2) || x * x + (z - 4) ** 2 < 100)
        continue;
      if ((x - 42) ** 2 + (z - 8) ** 2 < 300) continue;
      const tr = new THREE.Group();
      tr.add(tube(kit, "#6b4a32", [0, -0.2, 0], [0, 1.6, 0], 0.2));
      tr.add(sphere(kit, "#3d6b3a", [0, 2.4, 0], 1.3, undefined, [1.2, 0.85, 1.2]));
      tr.position.set(x, height(x, z), z);
      scene.add(tr);
    }

    // ── Stops: one on each part of the network ───────────────────────────────
    const loopStops: number[] = [];
    const laneStops: number[] = [];
    for (const s of stopPlan) {
      const r = s.on === "road" ? road : lane;
      const w = s.on === "road" ? W : LANE_W;
      const q = r.at(s.t).p;
      upright(s.make(kit), s.x, s.z, yawTo(s.x, s.z, q.x, q.z), 1.4);
      const front = beside(r, s.t, w / 2 + 1.2, "outside");
      nightLight(scene, "night", front.x, front.y + 2.0, front.z, "#fff1c4", 8);
      const sp = beside(r, s.t - 0.02, w / 2 + 0.9, "outside");
      upright(cornerSign(kit, 20), sp.x, sp.z, facingTraffic(r, s.t - 0.02), 0.1);
      (s.on === "road" ? loopStops : laneStops).push(s.t);
    }
    // NHAI guide boards (Hindi above English) before each fork.
    for (const [t, lines] of [
      [
        laneFrom,
        [
          { local: "खान-पान गली", en: "Food Lane", arrow: "up-right" },
          { local: "रामलीला मैदान", en: "Ramlila Maidan", arrow: "left" },
        ],
      ],
      [
        laneTo,
        [
          { local: "खान-पान गली", en: "Food Lane", arrow: "up-left" },
          { local: "झूले", en: "Rides", arrow: "right" },
        ],
      ],
      [
        spurFrom,
        [
          { local: "आरती घाट", en: "Aarti Ghat", arrow: "left" },
          { local: "मेला द्वार", en: "Mela Gate", arrow: "up", km: 1 },
        ],
      ],
    ] as [number, SignLine[]][]) {
      const at = beside(road, t - 0.012, W / 2 + 2.0, "inside");
      upright(nhaiSign(kit, lines, 3.4), at.x, at.z, facingTraffic(road, t - 0.012), 0.4);
    }
    const slowT = (stopPlan[0]?.t ?? 0.66) - 0.03;
    const sw = beside(road, slowT, W / 2 + 1.2, "inside");
    upright(
      signPost(kit, bilingual("धीरे चलें", "GO SLOW", "#1d1f24", "#ffd23f")),
      sw.x,
      sw.z,
      0,
      0.2,
    );

    const stageT = tNear(road, -24, 18);
    const ridesT = tNear(road, 44, 24);
    const effigyT = tNear(road, ex, -11);
    const townT = tNear(road, -42, -11);
    return {
      road,
      stops: loopStops.sort((a, b) => a - b),
      branches: [
        { road: lane, stops: laneStops, label: "Food lane" },
        { road: spur, stops: [], label: "Aarti ghat spur" },
      ],
      mapZoom: 132,
      mapCentre: [0, -4],
      moments: [
        {
          label:
            "Arrival gateway (spawn): the marigold mela gate over the crossing, rangoli, families arriving, NHAI board",
          t: spawnT,
          zoom: 24,
        },
        {
          label:
            "Ramlila maidan (cinematic): Ram, Sita and Hanuman mid-scene, the audience on durries",
          t: stageT,
          zoom: 22,
          cinematic: { azimuth: 53, elevation: 20, distance: 15, fov: 60 },
        },
        {
          label:
            "The old town and aarti ghat (cinematic): havelis and temples stepping down to the ghats, rooftop watchers, brass lamps",
          t: townT,
          zoom: 22,
          cinematic: { azimuth: 140, elevation: 13, distance: 34, fov: 56 },
        },
        {
          label: "Food lane fork: gol gappe, jalebi, candy floss, kulfi; the kite fight overhead",
          t: laneFrom,
          zoom: 26,
        },
        {
          label: "Outskirts: mustard fields, the well and hand-pump, mango orchard beyond",
          t: tNear(road, -50, 30),
          zoom: 30,
        },
        {
          label: "Rides ground: giant wheel, break-dance, Columbus swing, toy train",
          t: ridesT,
          zoom: 26,
        },
        {
          label:
            "Ravan dahan (cinematic): the effigy under fireworks, the river and the far bank beyond",
          t: effigyT,
          zoom: 22,
          cinematic: { azimuth: 0, elevation: 7, distance: 12, fov: 74 },
        },
      ],
    };
  },
};
