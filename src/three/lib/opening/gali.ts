/**
 * The Delhi gali around Murphy's garage (design previews only).
 *
 * Layout (garage at the origin, its front at z = 3, ground at y = 0):
 *  - North row: the garage between two pairs of neighbours (2–3 storeys,
 *    balconies, grilles, AC units, water tanks).
 *  - The lane (z 3 → 9.5): worn concrete with a drain, a chai tapri next door,
 *    a street dog asleep in the tapri's shade, gully cricket, a neighbour's
 *    tulsi chaura, overhead wire tangles strung between poles.
 *  - South row: single-storey shops either side of the lane mouth (so the
 *    swoop can see over them) and taller houses at the ends; hand-painted
 *    Hindi + English shop signs.
 *  - The lane mouth opens south onto the maidan where ADIT JAIN stands.
 *
 * Everything sits on the flat lane (y = 0): nothing floats or sinks.
 */

import * as THREE from "three";
import { nhaiSign } from "../journey";
import { box, disc, type Kit, sphere, tube } from "../kit";

export const LANE = { z0: 3, z1: 9.5, x0: -16, x1: 16, mouth: 4.4 } as const;

export interface GaliOpts {
  night?: boolean;
}

// ── Painted signs ────────────────────────────────────────────────────────────

/** A hand-painted board: Hindi on top, English below (or a single line). */
export function paintedSign(
  lines: { text: string; hindi?: boolean }[],
  w: number,
  h: number,
  bg: string,
  fg: string,
  border = fg,
): THREE.Mesh {
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = Math.round((1024 * h) / w);
  const ctx = c.getContext("2d");
  if (ctx) {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.strokeStyle = border;
    ctx.lineWidth = 12;
    ctx.strokeRect(16, 16, c.width - 32, c.height - 32);
    ctx.fillStyle = fg;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const rowH = (c.height - 40) / lines.length;
    lines.forEach((l, i) => {
      const family = l.hindi ? "'Noto Sans Devanagari', sans-serif" : "Outfit, Arial, sans-serif";
      let size = Math.round(rowH * (l.hindi ? 0.62 : 0.68));
      ctx.font = `800 ${size}px ${family}`;
      while (ctx.measureText(l.text).width > c.width - 90 && size > 16) {
        size -= 3;
        ctx.font = `800 ${size}px ${family}`;
      }
      ctx.fillText(l.text, c.width / 2, 20 + rowH * (i + 0.5) + (l.hindi ? 4 : 2));
    });
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }),
  );
  m.castShadow = true;
  return m;
}

// ── Buildings ────────────────────────────────────────────────────────────────

interface HouseOpts {
  w: number;
  d: number;
  floors: number;
  colour: string;
  trim?: string;
  /** Ground-floor shop with a rolling shutter and a painted sign. */
  shop?: { en: string; hi: string; bg: string; fg: string; open?: boolean };
  balcony?: boolean;
  fairy?: boolean;
  night?: boolean;
  seed?: number;
}

/**
 * A Delhi house, front facing +z, ground at y = 0: plastered floors, window
 * grilles, a cantilevered balcony with a railing, an AC unit, a black water
 * tank on the roof and a parapet.
 */
export function delhiHouse(kit: Kit, o: HouseOpts): THREE.Group {
  const g = new THREE.Group();
  const FH = 2.9;
  const H = o.floors * FH;
  const trim = o.trim ?? "#e9e1cf";
  const seed = o.seed ?? 0;
  const lit = (i: number) => o.night && (i + seed) % 3 !== 1;
  g.add(box(kit, o.colour, [-o.w / 2, 0, -o.d / 2], [o.w / 2, H, o.d / 2]));
  g.add(
    box(
      kit,
      "#9a8f80",
      [-o.w / 2 - 0.02, 0, -o.d / 2 - 0.02],
      [o.w / 2 + 0.02, 0.35, o.d / 2 + 0.02],
    ),
  ); // plinth
  for (let f = 1; f < o.floors; f++)
    g.add(
      box(
        kit,
        trim,
        [-o.w / 2 - 0.06, f * FH - 0.1, o.d / 2 - 0.1],
        [o.w / 2 + 0.06, f * FH + 0.06, o.d / 2 + 0.12],
      ),
    ); // floor band
  // parapet and roof clutter
  g.add(box(kit, trim, [-o.w / 2, H, -o.d / 2], [o.w / 2, H + 0.6, -o.d / 2 + 0.15]));
  g.add(box(kit, trim, [-o.w / 2, H, o.d / 2 - 0.15], [o.w / 2, H + 0.6, o.d / 2]));
  g.add(box(kit, trim, [-o.w / 2, H, -o.d / 2], [-o.w / 2 + 0.15, H + 0.6, o.d / 2]));
  g.add(box(kit, trim, [o.w / 2 - 0.15, H, -o.d / 2], [o.w / 2, H + 0.6, o.d / 2]));
  const tank = new THREE.Mesh(
    new THREE.CylinderGeometry(0.45, 0.45, 0.85, kit.seg(12, 24)),
    kit.mat("#25262a"),
  );
  tank.position.set(o.w / 2 - 1.0 - (seed % 2) * 1.2, H + 0.43, -o.d / 2 + 1.1);
  tank.castShadow = true;
  g.add(tank);
  if (seed % 2 === 0) {
    const dish = new THREE.Mesh(
      new THREE.SphereGeometry(0.3, 16, 8, 0, Math.PI * 2, 0, Math.PI / 3),
      kit.mat("#e9e9e6"),
    );
    dish.position.set(-o.w / 2 + 0.8, H + 0.9, o.d / 2 - 0.5);
    dish.rotation.x = 1.1;
    g.add(dish);
    g.add(
      tube(
        kit,
        "#9aa3ad",
        [-o.w / 2 + 0.8, H, o.d / 2 - 0.5],
        [-o.w / 2 + 0.8, H + 0.85, o.d / 2 - 0.45],
        0.03,
      ),
    );
  }
  // the back: plain windows, so the rear of a house never reads as a blank wall
  for (let f = 0; f < o.floors; f++) {
    const n = o.w > 5 ? 2 : 1;
    for (let i = 0; i < n; i++) {
      const wx = n === 1 ? 0 : (i - 0.5) * (o.w * 0.5);
      const wy = f * FH + 1.4;
      g.add(
        box(
          kit,
          "#e9e1cf",
          [wx - 0.55, wy - 0.55, -o.d / 2 - 0.05],
          [wx + 0.55, wy + 0.55, -o.d / 2 + 0.02],
        ),
      );
      g.add(
        box(
          kit,
          lit(f + i + 1) ? "#ffd99a" : "#33404a",
          [wx - 0.42, wy - 0.42, -o.d / 2 - 0.07],
          [wx + 0.42, wy + 0.42, -o.d / 2],
          { emissive: !!lit(f + i + 1) },
        ),
      );
      g.add(
        box(
          kit,
          "#e9e1cf",
          [wx - 0.68, wy + 0.55, -o.d / 2 - 0.35],
          [wx + 0.68, wy + 0.63, -o.d / 2],
        ),
      );
    }
  }
  // ground floor: a shop, or a door + window
  const z = o.d / 2;
  if (o.shop) {
    const sw = o.w - 0.8;
    g.add(box(kit, "#2a2a2e", [-sw / 2, 0.02, z - 0.02], [sw / 2, 2.3, z + 0.01]));
    if (o.shop.open) {
      g.add(
        box(
          kit,
          o.night ? "#ffe2a8" : "#6b5a46",
          [-sw / 2 + 0.15, 0.3, z - 0.6],
          [sw / 2 - 0.15, 2.1, z - 0.5],
          { emissive: !!o.night },
        ),
      );
      for (let i = 0; i < 4; i++)
        g.add(
          box(
            kit,
            ["#e35d3a", "#f2b62c", "#2f8ad0", "#3fa35a"][i] ?? "#e35d3a",
            [-sw / 2 + 0.3 + (i * (sw - 0.6)) / 4, 1.2, z - 0.45],
            [-sw / 2 + 0.15 + ((i + 1) * (sw - 0.6)) / 4, 1.55, z - 0.3],
          ),
        );
      g.add(
        box(kit, "#9aa3ad", [-sw / 2, 2.05, z + 0.01], [sw / 2, 2.3, z + 0.12], { metal: true }),
      ); // rolled shutter
    } else {
      for (let y = 0.06; y < 2.25; y += 0.16)
        g.add(
          box(kit, "#a7aeb6", [-sw / 2, y, z + 0.01], [sw / 2, y + 0.13, z + 0.05], {
            metal: true,
          }),
        );
    }
    const sign = paintedSign(
      [{ text: o.shop.hi, hindi: true }, { text: o.shop.en }],
      sw,
      0.85,
      o.shop.bg,
      o.shop.fg,
    );
    sign.position.set(0, 2.75, z + 0.04);
    g.add(sign);
  } else {
    g.add(box(kit, "#7a3b2a", [-o.w / 2 + 0.6, 0.3, z - 0.02], [-o.w / 2 + 1.5, 2.3, z + 0.04]));
    g.add(box(kit, "#9a8f80", [-o.w / 2 + 0.45, 0, z], [-o.w / 2 + 1.65, 0.3, z + 0.5])); // step
    window_(g, kit, o.w / 2 - 1.4, 1.4, z, !!lit(0));
  }
  // upper floors: windows with grilles, a balcony on the first floor
  for (let f = 1; f < o.floors; f++) {
    const y = f * FH + 1.3;
    const n = o.w > 5 ? 2 : 1;
    for (let i = 0; i < n; i++)
      window_(g, kit, n === 1 ? 0 : (i - 0.5) * (o.w * 0.5), y, z, !!lit(f + i));
    if (o.balcony && f === 1) {
      const bw = o.w - 1;
      g.add(box(kit, trim, [-bw / 2, f * FH, z], [bw / 2, f * FH + 0.12, z + 0.9]));
      g.add(
        box(kit, "#2b2b2e", [-bw / 2, f * FH + 0.95, z + 0.86], [bw / 2, f * FH + 1.0, z + 0.9]),
      );
      for (let k = 0; k <= 14; k++) {
        const x = -bw / 2 + (k / 14) * bw;
        g.add(
          tube(kit, "#2b2b2e", [x, f * FH + 0.12, z + 0.88], [x, f * FH + 0.97, z + 0.88], 0.018),
        );
      }
      // potted plants and a drying sari on the railing
      g.add(sphere(kit, "#4f9a45", [-bw / 2 + 0.4, f * FH + 0.45, z + 0.55], 0.25));
      g.add(
        box(
          kit,
          "#c4643f",
          [-bw / 2 + 0.25, f * FH + 0.12, z + 0.4],
          [-bw / 2 + 0.55, f * FH + 0.38, z + 0.7],
        ),
      );
      g.add(
        box(
          kit,
          ["#e0457b", "#2f8ad0", "#f2b62c"][seed % 3] ?? "#e0457b",
          [bw / 2 - 1.6, f * FH + 0.35, z + 0.9],
          [bw / 2 - 0.4, f * FH + 1.0, z + 0.93],
        ),
      );
      if (o.fairy)
        g.add(
          fairyLights(
            kit,
            new THREE.Vector3(-bw / 2, f * FH + 1.0, z + 0.92),
            new THREE.Vector3(bw / 2, f * FH + 1.0, z + 0.92),
            26,
            0.22,
            !!o.night,
          ),
        );
    }
  }
  // an AC unit on the side and a split of pipes
  g.add(box(kit, "#e6e6e2", [o.w / 2 - 1.2, FH + 0.3, z], [o.w / 2 - 0.3, FH + 0.85, z + 0.45]));
  g.add(
    tube(
      kit,
      "#cfcfcb",
      [o.w / 2 - 0.35, FH + 0.55, z + 0.2],
      [o.w / 2 - 0.35, 0.4, z + 0.15],
      0.025,
    ),
  );
  return g;
}

function window_(g: THREE.Group, kit: Kit, x: number, y: number, z: number, lit: boolean): void {
  g.add(box(kit, "#e9e1cf", [x - 0.62, y - 0.62, z - 0.02], [x + 0.62, y + 0.62, z + 0.05]));
  g.add(
    box(
      kit,
      lit ? "#ffd99a" : "#33404a",
      [x - 0.5, y - 0.5, z - 0.01],
      [x + 0.5, y + 0.5, z + 0.06],
      { emissive: lit },
    ),
  );
  for (let k = -2; k <= 2; k++)
    g.add(
      box(
        kit,
        "#2b2b2e",
        [x + k * 0.2 - 0.02, y - 0.5, z + 0.06],
        [x + k * 0.2 + 0.02, y + 0.5, z + 0.1],
      ),
    );
  g.add(box(kit, "#2b2b2e", [x - 0.5, y - 0.02, z + 0.06], [x + 0.5, y + 0.02, z + 0.1]));
  g.add(box(kit, "#e9e1cf", [x - 0.75, y + 0.62, z], [x + 0.75, y + 0.7, z + 0.35])); // chajja (sunshade)
}

/** A string of fairy lights (Diwali-style) sagging between two points. */
export function fairyLights(
  kit: Kit,
  a: THREE.Vector3,
  b: THREE.Vector3,
  n: number,
  sag: number,
  on: boolean,
): THREE.Group {
  const g = new THREE.Group();
  const cols = ["#ffcf4a", "#ff5a5a", "#5ad1ff", "#7dff7a", "#ff8ad8"];
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const p = a.clone().lerp(b, t);
    p.y -= Math.sin(t * Math.PI) * sag;
    pts.push(p);
    g.add(
      sphere(kit, cols[i % cols.length] ?? "#ffcf4a", [p.x, p.y - 0.06, p.z], 0.05, {
        emissive: on,
      }),
    );
  }
  const wire = new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), n * 2, 0.008, 4),
    kit.mat("#1d1f24"),
  );
  g.add(wire);
  return g;
}

// ── Lane life ────────────────────────────────────────────────────────────────

/** A chai tapri: a wooden counter with a tin awning, a kerosene stove and a kettle, glasses, biscuit jars, a bench. Front +z. */
export function chaiTapri(kit: Kit, night = false): THREE.Group {
  const g = new THREE.Group();
  g.add(box(kit, "#8a5a32", [-1.1, 0, -0.45], [1.1, 1.0, 0.45]));
  g.add(box(kit, "#c48a52", [-1.2, 1.0, -0.55], [1.2, 1.08, 0.55]));
  for (const x of [-1.1, 1.1])
    g.add(tube(kit, "#5b5f66", [x, 1.08, -0.4], [x, 2.35, -0.4], 0.04, { metal: true }));
  const awning = box(kit, "#3d8a8a", [-1.4, -0.03, -0.2], [1.4, 0.03, 1.4]);
  awning.position.y = 2.4;
  awning.rotation.x = 0.22;
  g.add(awning);
  g.add(disc(kit, "#2a2a2e", [-0.55, 1.15, 0], 0.22, 0.12));
  g.children[g.children.length - 1]?.rotateX(Math.PI / 2);
  const kettle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.14, 0.18, 0.26, 16),
    kit.mat("#b9bfc6", { metal: true }),
  );
  kettle.position.set(-0.55, 1.35, 0);
  kettle.castShadow = true;
  g.add(kettle);
  for (let i = 0; i < 4; i++)
    g.add(
      sphere(
        kit,
        "#f4f4f2",
        [-0.55 + i * 0.05, 1.6 + i * 0.22, 0.02 * i],
        0.08 + i * 0.04,
        undefined,
        [1, 0.8, 1],
      ),
    );
  for (let i = 0; i < 5; i++) {
    const glass = new THREE.Mesh(
      new THREE.CylinderGeometry(0.045, 0.035, 0.11, 10),
      kit.mat("#c98a3d"),
    );
    glass.position.set(0.1 + i * 0.12, 1.14, 0.25);
    g.add(glass);
  }
  for (let i = 0; i < 3; i++) {
    const jar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.12, 0.3, 14),
      new THREE.MeshStandardMaterial({ color: "#d9eef2", transparent: true, opacity: 0.6 }),
    );
    jar.position.set(0.35 + i * 0.27, 1.23, -0.25);
    g.add(jar);
    g.add(
      sphere(
        kit,
        ["#d9a441", "#a8633a", "#f2c14e"][i] ?? "#d9a441",
        [0.35 + i * 0.27, 1.17, -0.25],
        0.09,
      ),
    );
  }
  const sign = paintedSign(
    [{ text: "चाय  ₹10", hindi: true }, { text: "SHARMA CHAI" }],
    2.2,
    0.62,
    "#f2c14e",
    "#7a1f1a",
  );
  sign.position.set(0, 2.3, 1.38);
  sign.rotation.x = -0.1;
  g.add(sign);
  // the bench
  g.add(box(kit, "#7a5233", [-1.0, 0.42, 1.1], [1.0, 0.5, 1.45]));
  for (const x of [-0.85, 0.85])
    g.add(box(kit, "#5a3d2b", [x - 0.05, 0, 1.15], [x + 0.05, 0.42, 1.4]));
  if (night) g.add(box(kit, "#ffffff", [-0.8, 2.2, 0.6], [0.8, 2.26, 0.66], { emissive: true })); // tube light under the awning
  return g;
}

/** A street dog curled up asleep (tan, a white muzzle). */
export function sleepingDog(kit: Kit): THREE.Group {
  const g = new THREE.Group();
  const C = "#c8955a";
  g.add(sphere(kit, C, [0, 0.22, 0], 0.32, undefined, [1.5, 0.65, 1]));
  g.add(sphere(kit, C, [0.42, 0.18, 0.18], 0.17, undefined, [1.1, 0.8, 1]));
  g.add(sphere(kit, "#efe2cc", [0.56, 0.15, 0.22], 0.08));
  for (const dz of [0.08, 0.28])
    g.add(sphere(kit, "#a87545", [0.38, 0.33, dz], 0.06, undefined, [0.7, 1.1, 0.5]));
  const tail = new THREE.Mesh(
    new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.42, 0.15, 0),
        new THREE.Vector3(-0.3, 0.1, 0.32),
        new THREE.Vector3(0.1, 0.08, 0.38),
      ]),
      12,
      0.045,
      6,
    ),
    kit.mat(C),
  );
  g.add(tail);
  for (const [x, z] of [
    [0.3, 0.3],
    [0.2, 0.36],
  ] as [number, number][])
    g.add(sphere(kit, C, [x, 0.06, z], 0.06, undefined, [1.6, 0.6, 0.8]));
  return g;
}

/** A tulsi chaura: a painted square planter with a holy basil plant and a diya. */
export function tulsiChaura(kit: Kit, night = false): THREE.Group {
  const g = new THREE.Group();
  g.add(box(kit, "#c4643f", [-0.38, 0, -0.38], [0.38, 0.75, 0.38]));
  g.add(box(kit, "#f2c14e", [-0.4, 0.75, -0.4], [0.4, 0.85, 0.4]));
  for (const s of [-1, 1])
    g.add(box(kit, "#f6efdf", [-0.2, 0.3, s * 0.385], [0.2, 0.5, s * 0.39 + s * 0.01]));
  for (let i = 0; i < 9; i++) {
    const a = i * 2.4;
    const r = 0.06 + (i % 3) * 0.06;
    g.add(
      sphere(
        kit,
        i % 2 ? "#3f8f3a" : "#4fa046",
        [Math.cos(a) * r, 0.95 + (i % 4) * 0.1, Math.sin(a) * r],
        0.11,
      ),
    );
  }
  g.add(sphere(kit, "#b5652e", [0.22, 0.9, 0.28], 0.05, undefined, [1.4, 0.6, 1.4]));
  g.add(sphere(kit, "#ffb648", [0.22, 0.97, 0.28], 0.03, { emissive: night }));
  return g;
}

/** A child for gully cricket. Pose: "bat" | "bowl" | "keep" | "field". Facing +x. */
export function cricketKid(
  kit: Kit,
  pose: "bat" | "bowl" | "keep" | "field",
  shirt: string,
): THREE.Group {
  const g = new THREE.Group();
  const skin = "#a87754";
  const crouch = pose === "keep" ? 0.25 : 0;
  for (const z of [-0.08, 0.08])
    g.add(tube(kit, "#2f3a5a", [0, 0, z], [pose === "keep" ? -0.12 : 0, 0.45 - crouch, z], 0.05));
  g.add(box(kit, shirt, [-0.13, 0.45 - crouch, -0.16], [0.13, 0.85 - crouch, 0.16]));
  g.add(sphere(kit, skin, [0, 0.98 - crouch, 0], 0.13));
  g.add(sphere(kit, "#1e1a17", [-0.02, 1.03 - crouch, 0], 0.13, undefined, [1, 0.7, 1]));
  const top = 0.8 - crouch;
  if (pose === "bat") {
    g.add(tube(kit, skin, [0, top, 0.14], [0.2, 0.55, 0.12], 0.035));
    g.add(box(kit, "#d9b77a", [0.18, 0.12, 0.08], [0.26, 0.6, 0.18])); // bat
  } else if (pose === "bowl") {
    g.add(tube(kit, skin, [0, top, -0.14], [-0.1, 1.25, -0.18], 0.035)); // arm up
    g.add(sphere(kit, "#e23b2e", [-0.1, 1.3, -0.18], 0.045)); // tennis ball, taped red
  } else if (pose === "keep") {
    for (const z of [-0.12, 0.12]) g.add(tube(kit, skin, [0, top, z], [0.25, 0.4, z * 0.5], 0.035));
  } else {
    g.add(tube(kit, skin, [0, top, 0.14], [0.05, 0.4, 0.2], 0.035));
  }
  return g;
}

/** Stumps chalked on a crate: the gully-cricket wicket. */
export function crateWicket(kit: Kit): THREE.Group {
  const g = new THREE.Group();
  g.add(box(kit, "#b98c50", [-0.2, 0, -0.35], [0.2, 0.6, 0.35]));
  for (const z of [-0.18, 0, 0.18])
    g.add(box(kit, "#f6efdf", [0.2, 0.05, z - 0.025], [0.21, 0.55, z + 0.025]));
  return g;
}

/** A concrete electricity pole with a transformer and insulators. */
export function pole(kit: Kit, h = 7.5, transformer = false): THREE.Group {
  const g = new THREE.Group();
  g.add(box(kit, "#b8b4ab", [-0.12, 0, -0.12], [0.12, h, 0.12]));
  g.add(box(kit, "#5b5f66", [-0.7, h - 0.5, -0.06], [0.7, h - 0.4, 0.06], { metal: true }));
  for (const x of [-0.6, 0, 0.6]) g.add(sphere(kit, "#e9e9e6", [x, h - 0.32, 0], 0.07));
  if (transformer) {
    g.add(box(kit, "#7d8590", [-0.45, h - 2.6, 0.15], [0.45, h - 1.6, 0.75], { metal: true }));
    for (const x of [-0.25, 0, 0.25])
      g.add(tube(kit, "#c9cdd2", [x, h - 1.6, 0.45], [x, h - 1.25, 0.45], 0.05));
  }
  return g;
}

/** A sagging cable between two points (a bundle of them makes the gali tangle). */
export function cable(
  kit: Kit,
  a: THREE.Vector3,
  b: THREE.Vector3,
  sag: number,
  r = 0.018,
): THREE.Mesh {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= 16; i++) {
    const t = i / 16;
    const p = a.clone().lerp(b, t);
    p.y -= Math.sin(t * Math.PI) * sag;
    pts.push(p);
  }
  const m = new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, r, 5),
    kit.mat("#1d1f24"),
  );
  return m;
}

/** A home inverter with a battery (beige box, a green LED). */
export function inverter(kit: Kit, night = false): THREE.Group {
  const g = new THREE.Group();
  g.add(box(kit, "#e6dcc8", [-0.3, 0, -0.18], [0.3, 0.45, 0.18]));
  g.add(sphere(kit, "#4cff7a", [0.18, 0.36, 0.19], 0.025, { emissive: night }));
  g.add(box(kit, "#2a2a2e", [-0.22, 0.3, 0.17], [0.05, 0.38, 0.19]));
  g.add(box(kit, "#3a3f4a", [-0.35, 0, -0.65], [0.35, 0.5, -0.22])); // tubular battery
  g.add(tube(kit, "#d93a2f", [0.1, 0.5, -0.4], [0.2, 0.45, -0.1], 0.02));
  return g;
}

/** A street light on a bracket (a tube light: Delhi lanes glow white-green). */
export function streetLamp(kit: Kit, night: boolean): THREE.Group {
  const g = new THREE.Group();
  g.add(tube(kit, "#5b5f66", [0, 0, 0], [0.9, 0, 0], 0.035, { metal: true }));
  g.add(box(kit, "#e9e9e6", [0.7, -0.12, -0.2], [1.1, -0.04, 0.2]));
  g.add(
    box(kit, night ? "#f2fff6" : "#ffffff", [0.75, -0.16, -0.17], [1.05, -0.12, 0.17], {
      emissive: night,
    }),
  );
  return g;
}

// ── The whole gali ───────────────────────────────────────────────────────────

/** Point lights for the night variant, returned with the gali. */
export interface Gali {
  group: THREE.Group;
  lights: THREE.Light[];
}

export function gali(kit: Kit, opts: GaliOpts = {}): Gali {
  const night = !!opts.night;
  const g = new THREE.Group();
  const lights: THREE.Light[] = [];
  const { z0, z1, x0, x1, mouth } = LANE;

  // Lane surface: worn concrete slabs with a central drain, plus the mouth.
  g.add(box(kit, "#8d8576", [x0, -0.08, z0], [x1, -0.03, z1]));
  g.add(box(kit, "#8d8576", [-mouth, -0.08, z1], [mouth, -0.03, z1 + 5.2]));
  for (let x = x0; x < x1; x += 2) {
    const shade = Math.round(x / 2) % 2 ? "#c9bea9" : "#c2b7a2";
    g.add(box(kit, shade, [x + 0.02, -0.06, z0], [x + 1.98, 0, z1]));
  }
  g.add(box(kit, "#8d8576", [x0, -0.05, (z0 + z1) / 2 + 1.4], [x1, 0.01, (z0 + z1) / 2 + 1.7])); // drain cover
  g.add(box(kit, "#c9bea9", [-mouth, -0.06, z1], [mouth, 0, z1 + 5.2]));

  // North row (fronts at z = 3 like the garage).
  const north: [number, number, HouseOpts][] = [
    [-6.95, 0, { w: 5.3, d: 6, floors: 2, colour: "#e8c9a0", balcony: true, seed: 1 }],
    [
      -12.45,
      0,
      { w: 5.3, d: 6, floors: 3, colour: "#d9a6a0", balcony: true, fairy: true, seed: 2 },
    ],
    [6.95, 0, { w: 5.3, d: 6, floors: 2, colour: "#bcd3c4", balcony: true, seed: 3 }],
    [12.45, 0, { w: 5.3, d: 6, floors: 3, colour: "#f0d27a", balcony: true, fairy: true, seed: 4 }],
  ];
  for (const [x, z, o] of north) {
    const h = delhiHouse(kit, { ...o, night });
    h.position.set(x, 0, z);
    g.add(h);
  }
  // South row: shops either side of the mouth, houses at the ends. Fronts face the lane (-z).
  const south: [number, HouseOpts][] = [
    [
      -7.0,
      {
        w: 5.0,
        d: 5,
        floors: 1,
        colour: "#e3d3b5",
        shop: {
          en: "GUPTA GENERAL STORE",
          hi: "गुप्ता जनरल स्टोर",
          bg: "#c8342b",
          fg: "#fff3d6",
          open: true,
        },
        seed: 5,
      },
    ],
    [-12.5, { w: 5.4, d: 5, floors: 3, colour: "#c9d6e8", balcony: true, fairy: true, seed: 6 }],
    [
      7.0,
      {
        w: 5.0,
        d: 5,
        floors: 1,
        colour: "#e3d3b5",
        shop: {
          en: "PUNCTURE · TYRE REPAIR",
          hi: "पंचर · टायर रिपेयर",
          bg: "#1f4d8a",
          fg: "#ffe066",
          open: !night,
        },
        seed: 7,
      },
    ],
    [12.5, { w: 5.4, d: 5, floors: 2, colour: "#e8b9c8", balcony: true, fairy: true, seed: 8 }],
  ];
  for (const [x, o] of south) {
    const h = delhiHouse(kit, { ...o, night });
    h.position.set(x, 0, z1 + o.d / 2);
    h.rotation.y = Math.PI;
    g.add(h);
  }

  // Chai tapri next door (in front of the left neighbour), the dog asleep in its shade.
  const tapri = chaiTapri(kit, night);
  tapri.position.set(-6.6, 0, z0 + 0.5);
  g.add(tapri);
  const dog = sleepingDog(kit);
  dog.position.set(-4.0, 0, z0 + 0.9);
  dog.rotation.y = 0.4;
  g.add(dog);
  // The neighbour's tulsi chaura on the right.
  const tulsi = tulsiChaura(kit, night);
  tulsi.position.set(5.2, 0, z0 + 0.55);
  g.add(tulsi);
  // An inverter on the right neighbour's step (its LED glows at night).
  const inv = inverter(kit, night);
  inv.position.set(9.1, 0, z0 + 0.45);
  g.add(inv);

  // Gully cricket down the west end of the lane.
  const wicket = crateWicket(kit);
  wicket.position.set(-13.4, 0, 6.2);
  g.add(wicket);
  const kids: [number, number, number, "bat" | "bowl" | "keep" | "field", string][] = [
    [-12.7, 6.25, 0, "bat", "#f6f6f2"],
    [-14.3, 6.2, 0, "keep", "#2f8ad0"],
    [-8.2, 6.4, Math.PI, "bowl", "#e35d3a"],
    [-10.2, 8.4, -2.4, "field", "#f2b62c"],
    [-5.8, 8.4, Math.PI * 0.8, "field", "#3fa35a"],
  ];
  for (const [x, z, r, pose, shirt] of kids) {
    const k = cricketKid(kit, pose, shirt);
    k.position.set(x, 0, z);
    k.rotation.y = r;
    g.add(k);
  }

  // Poles and the overhead wire tangle.
  const poles: [number, number, boolean][] = [
    [-mouth - 0.2, z1 - 0.3, true],
    [mouth + 0.2, z1 - 0.3, false],
    [-15.6, z0 + 0.3, false],
    [15.6, z1 - 0.3, false],
  ];
  const tops: THREE.Vector3[] = [];
  for (const [x, z, t] of poles) {
    const p = pole(kit, 7.5, t);
    p.position.set(x, 0, z);
    g.add(p);
    tops.push(new THREE.Vector3(x, 7.2, z));
  }
  const [pA, pB, pC, pD] = tops as [THREE.Vector3, THREE.Vector3, THREE.Vector3, THREE.Vector3];
  const facadeN = (x: number, y: number) => new THREE.Vector3(x, y, z0 + 0.05);
  const facadeS = (x: number, y: number) => new THREE.Vector3(x, y, z1 - 0.05);
  const runs: [THREE.Vector3, THREE.Vector3, number][] = [
    [pA, pB, 0.5],
    [pA.clone().setY(6.9), pB.clone().setY(6.9), 0.65],
    [pA.clone().setY(6.6), pB.clone().setY(6.7), 0.8],
    [pC, pA, 0.6],
    [pC.clone().setY(6.8), pA.clone().setY(6.8), 0.75],
    [pB, pD, 0.6],
    [pB.clone().setY(6.85), pD.clone().setY(6.8), 0.8],
    [pA, facadeN(-6.5, 5.4), 0.4],
    [pA, facadeN(-11.5, 8.2), 0.5],
    [pA.clone().setY(6.7), facadeN(-3.0, 4.2), 0.3],
    [pB, facadeN(6.5, 5.4), 0.4],
    [pB, facadeN(12, 8.2), 0.45],
    [pB.clone().setY(6.7), facadeN(3.2, 4.2), 0.3],
    [pA, facadeS(-12, 7.6), 0.3],
    [pB, facadeS(12, 5.2), 0.35],
    [pC, facadeN(-14, 8.3), 0.2],
    [pD, facadeS(15, 5.3), 0.25],
  ];
  for (const [a, b, sag] of runs) g.add(cable(kit, a, b, sag));

  // Street lamps on the poles (tube lights).
  for (const [x, z, flip] of [
    [-mouth - 0.2, z1 - 0.3, 1],
    [mouth + 0.2, z1 - 0.3, -1],
    [-15.6, z0 + 0.3, 1],
  ] as [number, number, number][]) {
    const lamp = streetLamp(kit, night);
    lamp.position.set(x, 5.6, z);
    lamp.rotation.y = flip > 0 ? Math.PI / 2 : Math.PI / 2;
    g.add(lamp);
    if (night) {
      const l = new THREE.PointLight("#e9fff0", 14, 12, 1.6);
      l.position.set(x, 5.3, z - 1.0);
      lights.push(l);
    }
  }
  // A green NHAI-style board at the lane mouth, facing the maidan.
  const board = nhaiSign(
    kit,
    [{ en: "Murphy's Garage", local: "मर्फ़ी गैराज", arrow: "up" }],
    2.6,
    1.5,
  );
  board.position.set(mouth + 1.0, 0, z1 + 5.6);
  board.rotation.y = 0;
  g.add(board);

  if (night) {
    for (const [x, z, c, i] of [
      [-6.6, z0 + 1.2, "#ffe7c2", 9],
      [12.45, z0 + 1.2, "#ffd6f0", 6],
      [-7.0, z1 - 1.0, "#ffe2a8", 7],
      [0, z0 + 1.5, "#ffd88a", 10],
    ] as [number, number, string, number][]) {
      const l = new THREE.PointLight(c, i, 9, 1.6);
      l.position.set(x, 2.4, z);
      lights.push(l);
    }
  }
  return { group: g, lights };
}
