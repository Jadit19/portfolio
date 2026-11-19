import {
  type CSSProperties,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import type { LinkKind } from "../content/types";
import { world } from "../content/worlds";
import { ride } from "../state/ride";
import { useStore } from "../state/store";
import type { RideStop } from "../three/world/rides";
import { WorldScene } from "../three/world/scene";
import { Arrow } from "./Arrow";

const coarse = () => typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;

/** Whether the screen is taller than it is wide (tracks rotation). */
const isPortrait = () => typeof window !== "undefined" && window.innerHeight > window.innerWidth;
/** A phone (not a tablet): its short side is phone-sized. */
const isPhone = () =>
  typeof window !== "undefined" && Math.min(window.innerWidth, window.innerHeight) < 600;

function usePortrait(): boolean {
  const [p, setP] = useState(isPortrait);
  useEffect(() => {
    const on = () => setP(isPortrait());
    window.addEventListener("resize", on);
    window.addEventListener("orientationchange", on);
    return () => {
      window.removeEventListener("resize", on);
      window.removeEventListener("orientationchange", on);
    };
  }, []);
  return p;
}

/** Everything on screen while riding a world. */
export function WorldHud({ scene }: { scene: WorldScene }) {
  const info = world(scene.id);
  const STOPS = scene.stopContent;
  const def = scene.def;
  const found = useStore(ride, (s) => s.found);
  const near = useStore(ride, (s) => s.near);
  const open = useStore(ride, (s) => s.open);
  const cruising = useStore(ride, (s) => s.cruising);
  const nearLive = useStore(ride, (s) => s.nearLive);
  const live = useStore(ride, (s) => s.live);
  const cam = useStore(ride, (s) => s.cam);
  const sound = useStore(ride, (s) => s.sound);
  const [touch, setTouch] = useState(coarse);
  const [hint, setHint] = useState(true);
  const portrait = usePortrait();
  const [portraitOk, setPortraitOk] = useState(false);
  /** Tilt steers by default; if this device can't, a steering slider takes over. */
  const [tiltOk, setTiltOk] = useState(tilt.supported);
  const [mapOpen, setMapOpen] = useState(false);

  const cruise = useCallback(() => {
    if (ride.get().cruising !== null) {
      ride.patch({ cruising: null });
      return;
    }
    const i = scene.nextStop();
    if (i !== null) ride.patch({ cruising: i, open: null });
    setMapOpen(false);
  }, [scene]);

  // Keys: E / Enter pulls over, C cruises, M mutes, L opens a live site,
  // Esc closes the card.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      const s = ride.get();
      if (k === "m" && !e.repeat) {
        scene.setSound(!s.sound);
        return;
      }
      // Esc closes a card; going back to the yard is always the Yard button.
      if (k === "escape") {
        if (s.open !== null) ride.patch({ open: null });
        return;
      }
      if (s.open !== null) return;
      if ((k === "e" || k === "enter") && s.near !== null) {
        e.preventDefault();
        scene.openStop(s.near);
      } else if (k === "c") {
        cruise();
      } else if (k === "l" && s.nearLive) {
        scene.openLive();
      }
      setHint(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [scene, cruise]);

  useEffect(() => {
    const id = setTimeout(() => setHint(false), 10000);
    const onTouch = () => setTouch(true);
    window.addEventListener("touchstart", onTouch, { once: true, passive: true });
    return () => {
      clearTimeout(id);
      window.removeEventListener("touchstart", onTouch);
    };
  }, []);

  const tint = { "--tint": info.tint } as CSSProperties;
  const stop = open !== null ? STOPS[open] : undefined;
  const nearStop = near !== null && open === null ? STOPS[near] : undefined;
  const cruiseTo = cruising !== null ? STOPS[cruising] : undefined;
  const progress = (
    <div className="found" role="status">
      <b>{info.name}</b>
      <span>
        {found.length}/{STOPS.length} found
      </span>
      <i className="pips" aria-hidden="true">
        {STOPS.map((s) => (
          <em key={s.id} className={found.includes(s.id) ? "on" : ""} />
        ))}
      </i>
    </div>
  );
  const map = (
    <>
      <MiniMap scene={scene} found={found} onPick={() => setMapOpen(false)} />
      <button type="button" className="cruise" onClick={cruise} aria-pressed={cruising !== null}>
        {cruising !== null ? "Stop cruising" : "Cruise to next stop"}
      </button>
    </>
  );

  return (
    <div className={`ridehud ${touch ? "is-touch" : ""}`} style={tint}>
      <div className="tools">
        <button
          type="button"
          className="tool"
          onClick={() => scene.toggleCamera()}
          aria-label={`Camera: ${cam === "low" ? "close" : "high"}${touch ? "" : " (V)"}`}
          title={touch ? "Camera" : "Camera (V)"}
        >
          <CamIcon />
          <span>{cam === "low" ? "Close" : "High"}</span>
        </button>
        {!touch && (
          <button
            type="button"
            className="tool"
            onClick={() => scene.setSound(!sound)}
            aria-pressed={sound}
            aria-label={sound ? "Sound on (M)" : "Sound off (M)"}
            title="Sound (M)"
          >
            <SoundIcon on={sound} />
          </button>
        )}
      </div>

      {hint && open === null && (
        <p className="ridehint">
          {touch ? (
            tiltOk ? (
              <>Tilt to steer · hold the right side for gas, the left to brake.</>
            ) : (
              <>No motion access, so Gas and Brake follow the road for you.</>
            )
          ) : (
            <>
              <kbd>W A S D</kbd> ride · <kbd>H</kbd> horn · <kbd>V</kbd> camera · <kbd>M</kbd> mute
              · <kbd>E</kbd> pull over · <kbd>C</kbd> cruise
            </>
          )}
        </p>
      )}

      {nearStop && near !== null && (
        <button type="button" className="pullover" onClick={() => scene.openStop(near)}>
          <span className="kicker">Stop here</span>
          <b>{nearStop.title}</b>
          {!touch && <kbd>E</kbd>}
        </button>
      )}

      {nearLive && open === null && !nearStop && (
        <button type="button" className="pullover live" onClick={() => scene.openLive()}>
          <span className="kicker">
            Live demo ·{" "}
            {live?.ok ? `brewing ✓ ${live.ms} ms` : live?.ok === false ? "resting" : "…"}
          </span>
          <b>
            Open {def.live?.host} <Arrow dir="out" />
          </b>
          {!touch && <kbd>L</kbd>}
        </button>
      )}

      {cruiseTo && open === null && (
        <p className="cruising" role="status">
          Cruising to <b>{cruiseTo.title}</b>
        </p>
      )}

      {touch ? (
        // Phones and tablets: the map waits behind an "i" so the road stays clear.
        <div className="infobox">
          <button
            type="button"
            className="infobtn"
            onClick={() => setMapOpen((o) => !o)}
            aria-expanded={mapOpen}
            aria-label="Map and cruise"
          >
            {mapOpen ? "×" : "i"}
          </button>
          {mapOpen && (
            <aside className="mapbox popover" aria-label="Progress and map">
              {progress}
              {map}
            </aside>
          )}
        </div>
      ) : (
        <aside className="mapbox" aria-label="Progress and map">
          {progress}
          {map}
          <Speed />
        </aside>
      )}

      {touch && (
        <TouchPedals
          scene={scene}
          paused={open !== null || mapOpen}
          tilt={tiltOk}
          onNoTilt={() => {
            tilt.supported = false;
            setTiltOk(false);
          }}
        />
      )}
      {touch && portrait && isPhone() && !portraitOk && (
        <RotateGate onAnyway={() => setPortraitOk(true)} />
      )}

      {stop && open !== null && (
        <StopCard
          stop={stop}
          index={def.stops.findIndex((c) => c.id === stop.id)}
          total={STOPS.length}
          kicker={def.kicker}
          theme={def.theme}
          intro={def.intro}
          onClose={() => ride.patch({ open: null })}
          onNext={cruise}
          allFound={found.length === STOPS.length}
        />
      )}
    </div>
  );
}

function Speed() {
  const kmh = useStore(ride, (s) => s.kmh);
  return (
    <p className="speed" aria-hidden="true">
      <b>{kmh}</b> km/h
    </p>
  );
}

/** A stop's card: the library, served as a drink on the café's menu. */
function StopCard({
  stop,
  index,
  total,
  kicker,
  theme,
  intro,
  onClose,
  onNext,
  allFound,
}: {
  stop: RideStop;
  /** Its place in the story (0 = the first stop). */
  index: number;
  total: number;
  kicker: string;
  theme: "menu";
  intro: string;
  onClose: () => void;
  onNext: () => void;
  allFound: boolean;
}) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  return (
    <aside className="panel stopcard" aria-label={stop.title} key={stop.id}>
      <section className={`card menu theme-${theme}`} ref={ref} tabIndex={-1}>
        <div className="menuhead">
          <p className="eyebrow">
            {kicker} · {index + 1} of {total}
          </p>
          <button type="button" className="close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <h2>{stop.title}</h2>
        <p className="drink">{stop.sub}</p>
        <p className="tagline">{stop.tagline}</p>
        <dl className="facts">
          {stop.facts.map((f) => (
            <div key={f.label}>
              <dt>{f.label}</dt>
              <dd>{f.value}</dd>
            </div>
          ))}
        </dl>
        {stop.body.map((b, i) =>
          b.kind === "p" ? (
            // biome-ignore lint/suspicious/noArrayIndexKey: static content, never reordered
            <p key={i}>{b.text}</p>
          ) : b.kind === "list" ? (
            // biome-ignore lint/suspicious/noArrayIndexKey: static content, never reordered
            <ul key={i}>
              {b.items.map((it) => (
                <li key={it}>{it}</li>
              ))}
            </ul>
          ) : b.kind === "heading" ? (
            // biome-ignore lint/suspicious/noArrayIndexKey: static content, never reordered
            <h3 key={i}>{b.text}</h3>
          ) : (
            // biome-ignore lint/suspicious/noArrayIndexKey: static content, never reordered
            <blockquote key={i}>{b.text}</blockquote>
          ),
        )}
        <ul className="tech" aria-label="Tech">
          {stop.tech.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
        {stop.links.length > 0 && (
          <p className="links">
            {stop.links.map((l) => (
              <a key={l.href} href={l.href} target="_blank" rel="noopener">
                <LinkIcon kind={l.kind} />
                {l.label} <Arrow dir="out" />
              </a>
            ))}
          </p>
        )}
        {index === 0 && <p className="intro">{intro}</p>}
      </section>
      <div className="actions">
        <button type="button" className="ghost" onClick={onClose}>
          Keep riding
        </button>
        <button type="button" className="ride" onClick={onNext}>
          {allFound ? "Cruise to the next" : "Cruise to a new stop"} <Arrow dir="next" />
        </button>
      </div>
    </aside>
  );
}

/**
 * The round paper compass: the world around you, held still the way the
 * camera looks (so it matches the screen; N marks north on the ring), drawn like the
 * yard's toys on cream paper (ink roads, a dashed railway, water, roofs, tree
 * dots) inside a compass bezel. Stops are E badges (ticked once found); the
 * nearest one still to find, when it's off the map, sits on the rim pointing
 * the way, with how far. Tap a stop to cruise there.
 */
function MiniMap({
  scene,
  found,
  onPick,
}: {
  scene: WorldScene;
  found: string[];
  /** Called after tapping a stop (e.g. to close a pop-over map). */
  onPick?: () => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const picked = useRef(onPick);
  picked.current = onPick;
  const SIZE = 168;
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const S = SIZE * dpr;
    canvas.width = S;
    canvas.height = S;
    const m = scene.mapData();
    const cx = S / 2;
    const cy = S / 2;
    const R = S / 2 - 7 * dpr;
    /** Metres from the centre to the rim. */
    const VIEW = 46;
    const k = R / VIEW;
    const INK = "#3a2f4d";
    const PAPER = "#f6ecd9";
    const CORAL = "#fa9a87";
    const GOLD = "#fec766";
    // The whole world drawn once on paper (with what crosses its edges, since it wraps).
    const paper = document.createElement("canvas");
    paper.width = Math.ceil(m.w * k);
    paper.height = Math.ceil(m.d * k);
    {
      const g = paper.getContext("2d") as CanvasRenderingContext2D;
      g.fillStyle = PAPER;
      g.fillRect(0, 0, paper.width, paper.height);
      g.scale(k, k);
      g.translate(m.w / 2, m.d / 2);
      g.lineCap = "round";
      g.lineJoin = "round";
      const poly = (pts: readonly (readonly [number, number])[]) => {
        g.beginPath();
        pts.forEach(([x, z], i) => {
          if (i) g.lineTo(x, z);
          else g.moveTo(x, z);
        });
      };
      const art = m.art;
      for (const ox of [-m.w, 0, m.w])
        for (const oz of [-m.d, 0, m.d]) {
          g.save();
          g.translate(ox, oz);
          if (art?.fields) {
            // Farm plots, tinted by crop, with the bunds as fine paper lines between them.
            g.strokeStyle = PAPER;
            g.lineWidth = 0.7;
            for (const f of art.fields) {
              g.fillStyle = f.colour;
              poly(f.pts);
              g.closePath();
              g.fill();
              g.stroke();
            }
          }
          if (art) {
            g.fillStyle = "#b9d9a2";
            for (const [x, z] of art.trees) {
              g.beginPath();
              g.arc(x, z, 1.5, 0, Math.PI * 2);
              g.fill();
            }
          }
          g.fillStyle = "#a8dbe6";
          g.strokeStyle = "#a8dbe6";
          if (art)
            for (const pond of art.ponds) {
              poly(pond);
              g.closePath();
              g.fill();
            }
          for (const w of m.water) {
            // Ponds come as their shapes when there's art; the strokes are rivers.
            if (art && w !== m.water[0]) continue;
            g.lineWidth = w.width + 1.2;
            poly(w.pts);
            g.stroke();
          }
          if (art) {
            g.strokeStyle = INK;
            g.lineWidth = 1;
            g.setLineDash([2.6, 2]);
            poly(art.rail);
            g.stroke();
            g.setLineDash([]);
          }
          g.strokeStyle = INK;
          for (const r of m.roads) {
            g.lineWidth = Math.max(1.4, r.width * 0.55);
            poly(r.pts);
            g.stroke();
          }
          if (art) {
            for (const b of art.bridges) {
              g.save();
              g.translate(b.x, b.z);
              g.rotate(-b.yaw);
              g.fillStyle = PAPER;
              g.lineWidth = 0.6;
              g.fillRect(-b.width / 2, -b.len / 2, b.width, b.len);
              g.strokeRect(-b.width / 2, -b.len / 2, b.width, b.len);
              g.restore();
            }
            g.fillStyle = "#b7b0bd";
            for (const rk of art.rocks) {
              g.beginPath();
              g.arc(rk.x, rk.z, rk.r, 0, Math.PI * 2);
              g.fill();
            }
            g.lineWidth = 0.5;
            for (const h of art.houses) {
              g.save();
              g.translate(h.x, h.z);
              g.rotate(-h.yaw);
              const s = Math.max(1.4, h.s * 0.8);
              g.fillStyle = "#f39a86";
              g.fillRect(-s, -s * 0.7, s * 2, s * 1.4);
              g.strokeRect(-s, -s * 0.7, s * 2, s * 1.4);
              g.restore();
            }
          }
          g.restore();
        }
    }
    /** The short way from you to a point (the world wraps). */
    const rel = (p: { x: number; z: number }, x: number, z: number): [number, number] => {
      let dx = x - p.x;
      let dz = z - p.z;
      dx -= m.w * Math.round(dx / m.w);
      dz -= m.d * Math.round(dz / m.d);
      return [dx, dz];
    };
    const badge = (x: number, y: number, r: number, fill: string, label: string) => {
      ctx.fillStyle = fill;
      ctx.strokeStyle = INK;
      ctx.lineWidth = r * 0.24;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = INK;
      ctx.font = `900 ${r * 1.1}px Outfit, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(label, x, y + r * 0.08);
    };
    /** Where each stop was drawn this frame (for taps), and the rim badge. */
    let hits: { i: number; x: number; y: number }[] = [];
    let raf = 0;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const p = scene.player();
      // The map's up is the way the camera looks (fixed in the usual view).
      const yaw = scene.mapYaw();
      const fx = Math.cos(yaw);
      const fz = -Math.sin(yaw);
      const rot = Math.atan2(-fx, -fz);
      const rc = Math.cos(rot);
      const rs = Math.sin(rot);
      /** A world offset from you, on the canvas. */
      const at = (dx: number, dz: number): [number, number] => [
        cx + (rc * dx - rs * dz) * k,
        cy + (rs * dx + rc * dz) * k,
      ];
      ctx.clearRect(0, 0, S, S);
      // The map, in the disc.
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.clip();
      ctx.fillStyle = PAPER;
      ctx.fillRect(0, 0, S, S);
      // The paper copy (or copies, near an edge) under the disc, turned to match the view.
      ctx.translate(cx, cy);
      ctx.rotate(rot);
      const reach = R * 1.5;
      for (const ox of [-1, 0, 1])
        for (const oz of [-1, 0, 1]) {
          const x0 = (-m.w / 2 - p.x + ox * m.w) * k;
          const y0 = (-m.d / 2 - p.z + oz * m.d) * k;
          if (x0 > reach || y0 > reach || x0 + paper.width < -reach || y0 + paper.height < -reach)
            continue;
          ctx.drawImage(paper, x0, y0);
        }
      ctx.restore();
      // The compass bezel: ticks, then the ring.
      ctx.strokeStyle = INK;
      for (let i = 0; i < 48; i++) {
        const t = (i / 48) * Math.PI * 2;
        const l = (i % 12 === 0 ? 7 : i % 4 === 0 ? 4.5 : 2.5) * dpr;
        ctx.lineWidth = (i % 12 === 0 ? 1.6 : 0.8) * dpr;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(t) * (R - 1 * dpr), cy + Math.sin(t) * (R - 1 * dpr));
        ctx.lineTo(cx + Math.cos(t) * (R - 1 * dpr - l), cy + Math.sin(t) * (R - 1 * dpr - l));
        ctx.stroke();
      }
      ctx.lineWidth = 5 * dpr;
      ctx.beginPath();
      ctx.arc(cx, cy, R + 2.5 * dpr, 0, Math.PI * 2);
      ctx.stroke();
      // Stops: on the map, or (the nearest still to find) on the rim.
      hits = [];
      const cruising = ride.get().cruising;
      let next: { i: number; d: number; dx: number; dz: number } | null = null;
      m.stops.forEach((s, i) => {
        const [dx, dz] = rel(p, s.x, s.z);
        const d = Math.hypot(dx, dz);
        const done = found.includes(scene.stopContent[i]?.id ?? "");
        if (!done && (!next || d < next.d)) next = { i, d, dx, dz };
        if (d * k > R - 9 * dpr) return;
        const [x, y] = at(dx, dz);
        if (i === cruising) {
          ctx.strokeStyle = GOLD;
          ctx.lineWidth = 3 * dpr;
          ctx.beginPath();
          ctx.arc(x, y, 12 * dpr, 0, Math.PI * 2);
          ctx.stroke();
        }
        badge(x, y, 8.5 * dpr, done ? PAPER : GOLD, done ? "✓" : "E");
        hits.push({ i, x, y });
      });
      const n = next as { i: number; d: number; dx: number; dz: number } | null;
      if (n && n.d * k > R - 9 * dpr) {
        const [ex, ey] = at(n.dx, n.dz);
        const a = Math.atan2(ey - cy, ex - cx);
        const bx = cx + Math.cos(a) * (R + 1 * dpr);
        const by = cy + Math.sin(a) * (R + 1 * dpr);
        ctx.save();
        ctx.translate(bx, by);
        ctx.rotate(a);
        ctx.fillStyle = CORAL;
        ctx.beginPath();
        ctx.moveTo(15 * dpr, 0);
        ctx.lineTo(5 * dpr, -6.5 * dpr);
        ctx.lineTo(5 * dpr, 6.5 * dpr);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        badge(bx, by, 9.5 * dpr, CORAL, "E");
        hits.push({ i: n.i, x: bx, y: by });
        ctx.fillStyle = INK;
        ctx.font = `800 ${10 * dpr}px Outfit, sans-serif`;
        ctx.fillText(
          `${Math.round(n.d)} m`,
          cx + Math.cos(a) * (R - 24 * dpr),
          cy + Math.sin(a) * (R - 24 * dpr),
        );
      }
      // North, on the ring where it lies.
      const [nwx, nwy] = at(0, -1);
      const na = Math.atan2(nwy - cy, nwx - cx);
      const nx = cx + Math.cos(na) * (R - 3 * dpr);
      const ny = cy + Math.sin(na) * (R - 3 * dpr);
      ctx.fillStyle = "#fffaf3";
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2 * dpr;
      ctx.beginPath();
      ctx.arc(nx, ny, 9 * dpr, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = INK;
      ctx.font = `900 ${11 * dpr}px Outfit, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("N", nx, ny + 0.6 * dpr);
      // You: a teardrop pointing the way you ride.
      const [hx, hy] = at(Math.cos(p.heading), -Math.sin(p.heading));
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(Math.atan2(hy - cy, hx - cx));
      ctx.fillStyle = "#ffffff";
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2 * dpr;
      ctx.beginPath();
      ctx.moveTo(11 * dpr, 0);
      ctx.bezierCurveTo(4 * dpr, -3 * dpr, -6.5 * dpr, -7 * dpr, -6.5 * dpr, 0);
      ctx.bezierCurveTo(-6.5 * dpr, 7 * dpr, 4 * dpr, 3 * dpr, 11 * dpr, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    };
    draw();
    const onClick = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      // The canvas may be drawn smaller on phones: map CSS pixels to canvas pixels.
      const x = ((e.clientX - r.left) / r.width) * canvas.width;
      const y = ((e.clientY - r.top) / r.height) * canvas.height;
      let best = -1;
      let bd = (16 * dpr) ** 2;
      for (const h of hits) {
        const d = (h.x - x) ** 2 + (h.y - y) ** 2;
        if (d < bd) {
          bd = d;
          best = h.i;
        }
      }
      if (best >= 0) {
        ride.patch({ cruising: best, open: null });
        picked.current?.();
      }
    };
    canvas.addEventListener("pointerup", onClick);
    return () => {
      cancelAnimationFrame(raf);
      canvas.removeEventListener("pointerup", onClick);
    };
  }, [scene, found]);
  return (
    <canvas
      ref={ref}
      className="minimap"
      aria-label="Map of the world around you, north up. Tap a stop to cruise there."
      role="img"
    />
  );
}

/** Phones in portrait: the estate needs the width, so ask for landscape first. */
function RotateGate({ onAnyway }: { onAnyway: () => void }) {
  return (
    <div className="rotategate" role="dialog" aria-label="Rotate your phone">
      <div className="phoneicon" aria-hidden="true">
        <i />
      </div>
      <h2>Turn your phone sideways</h2>
      <p>The estate opens up in landscape: tilt to steer, tap to ride.</p>
      <div className="gateactions">
        <button type="button" className="ghost" onClick={WorldScene.leave}>
          <Arrow dir="back" /> Yard
        </button>
        <button type="button" className="linkish" onClick={onAnyway}>
          Ride in portrait anyway
        </button>
      </div>
    </div>
  );
}

/**
 * Tilt state that survives the pedals remounting: whether this device can
 * tilt-steer, whether it's been started, and the angle that means "straight".
 */
const tilt = { supported: true, armed: false, zero: 0, angle: 0, seen: false };

/**
 * Phone and tablet controls, Real Racing style: hold anywhere on the left half
 * to brake and the right half for gas (two translucent grey pedals show where).
 * Steering is by tilting the device like handlebars; on a device that can't,
 * a steering slider appears at the bottom centre instead.
 */
function TouchPedals({
  scene,
  paused,
  tilt: useTilt,
  onNoTilt,
}: {
  scene: WorldScene;
  paused: boolean;
  tilt: boolean;
  onNoTilt: () => void;
}) {
  const [armed, setArmed] = useState(tilt.armed);
  const [pedal, setPedal] = useState<"go" | "stop" | null>(null);
  const pedalRef = useRef<"go" | "stop" | null>(null);
  const steerRef = useRef(0);
  const send = useCallback(() => {
    const p = pedalRef.current;
    scene.setTouch(steerRef.current, p === "go" ? 1 : 0, p === "stop" ? 1 : 0);
  }, [scene]);

  // Tilt: gravity's angle in the screen's plane, measured from "straight".
  useEffect(() => {
    if (!useTilt || !armed) return;
    const onMotion = (e: DeviceMotionEvent) => {
      const g = e.accelerationIncludingGravity;
      if (!g || g.x === null || g.y === null) return;
      const a = Math.atan2(g.x, g.y);
      if (!tilt.seen) {
        tilt.seen = true;
        tilt.zero = a;
        tilt.angle = a;
      }
      // Low-pass so bumps and hand shake don't twitch the bars.
      tilt.angle += wrap(a - tilt.angle) * 0.25;
      const d = wrap(tilt.angle - tilt.zero);
      const dead = 0.035;
      // Full lock at about 30° of tilt: small wrist movements make small turns.
      const s = Math.abs(d) < dead ? 0 : (d - Math.sign(d) * dead) / 0.52;
      // Tilting right (clockwise) lowers the angle; the bike's steer is + to the left.
      steerRef.current = Math.max(-1, Math.min(1, s));
      send();
    };
    window.addEventListener("devicemotion", onMotion);
    return () => window.removeEventListener("devicemotion", onMotion);
  }, [useTilt, armed, send]);

  useEffect(() => () => scene.setTouch(0, 0, 0), [scene]);
  // Can't steer without tilt: gas and brake follow the road instead.
  useEffect(() => {
    scene.setRoadAssist(!useTilt);
    return () => scene.setRoadAssist(false);
  }, [scene, useTilt]);

  const start = async () => {
    // iOS asks for motion permission, and only from a tap.
    const DME = (
      window as unknown as {
        DeviceMotionEvent?: { requestPermission?: () => Promise<"granted" | "denied"> };
      }
    ).DeviceMotionEvent;
    try {
      if (DME?.requestPermission && (await DME.requestPermission()) !== "granted") {
        onNoTilt();
        return;
      }
    } catch {
      onNoTilt();
      return;
    }
    tilt.seen = false;
    tilt.armed = true;
    setArmed(true);
    // No motion readings in a moment: this device can't tilt-steer.
    setTimeout(() => {
      if (!tilt.seen) {
        tilt.armed = false;
        onNoTilt();
      }
    }, 1500);
  };

  const press = (which: "go" | "stop" | null) => {
    pedalRef.current = which;
    setPedal(which);
    send();
  };

  if (useTilt && !armed) {
    return (
      <div className="tiltstart" role="dialog" aria-label="Start riding">
        <div className="bars" aria-hidden="true">
          <i />
        </div>
        <h2>Hold your phone like handlebars</h2>
        <p>
          You steer by tilting your phone, so this ride needs access to its motion sensor.{" "}
          <b>Without it you can't steer</b>: Gas and Brake will just follow the road.
        </p>
        <p>Hold the right side for gas, the left side to brake.</p>
        <button type="button" className="ride" onClick={start}>
          Allow motion and start
        </button>
      </div>
    );
  }
  const zone = (which: "go" | "stop") => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      press(which);
    },
    onPointerUp: () => press(null),
    onPointerCancel: () => press(null),
  });
  return (
    <div className={`halves ${paused ? "paused" : ""}`} aria-hidden="true">
      <div className="half brake" {...zone("stop")}>
        <span className={`pedalvis ${pedal === "stop" ? "on" : ""}`}>Brake</span>
      </div>
      <div className="half go" {...zone("go")}>
        <span className={`pedalvis ${pedal === "go" ? "on" : ""}`}>Gas</span>
      </div>
    </div>
  );
}

const wrap = (a: number) => {
  let d = a % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
};

function CamIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path
        d="M4 8.5A2.5 2.5 0 0 1 6.5 6h7A2.5 2.5 0 0 1 16 8.5v7a2.5 2.5 0 0 1-2.5 2.5h-7A2.5 2.5 0 0 1 4 15.5z M16 10.5l4-2.5v8l-4-2.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SoundIcon({ on }: { on: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path
        d="M4 9.5h3.5L12 6v12l-4.5-3.5H4z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      {on ? (
        <path
          d="M15.5 9a4.5 4.5 0 0 1 0 6 M18 6.5a8 8 0 0 1 0 11"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      ) : (
        <path
          d="M16 9.5l5 5 M21 9.5l-5 5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}

/**
 * A link's mark, beside its label: the Octocat for GitHub, the whale for
 * Docker Hub, a package for PyPI, a live signal, a book for docs, a pen for a
 * blog, a play button for video, a chain link for anything else.
 */
function LinkIcon({ kind }: { kind: LinkKind }) {
  const paths: Record<LinkKind, ReactNode> = {
    github: (
      <path
        fill="currentColor"
        d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"
      />
    ),
    docker: (
      <path
        fill="currentColor"
        d="M13.983 11.078h2.119a.186.186 0 00.186-.185V9.006a.186.186 0 00-.186-.186h-2.119a.185.185 0 00-.185.185v1.888c0 .102.083.185.185.185m-2.954-5.43h2.118a.186.186 0 00.186-.186V3.574a.186.186 0 00-.186-.185h-2.118a.185.185 0 00-.185.185v1.888c0 .102.082.185.185.185m0 2.716h2.118a.187.187 0 00.186-.186V6.29a.186.186 0 00-.186-.185h-2.118a.185.185 0 00-.185.185v1.887c0 .102.082.185.185.186m-2.93 0h2.12a.186.186 0 00.184-.186V6.29a.185.185 0 00-.185-.185H8.1a.185.185 0 00-.185.185v1.887c0 .102.083.185.185.186m-2.964 0h2.119a.186.186 0 00.185-.186V6.29a.185.185 0 00-.185-.185H5.136a.186.186 0 00-.186.185v1.887c0 .102.084.185.186.186m5.893 2.715h2.118a.186.186 0 00.186-.185V9.006a.186.186 0 00-.186-.186h-2.118a.185.185 0 00-.185.185v1.888c0 .102.082.185.185.185m-2.93 0h2.12a.185.185 0 00.184-.185V9.006a.185.185 0 00-.184-.186h-2.12a.185.185 0 00-.184.185v1.888c0 .102.083.185.185.185m-2.964 0h2.119a.185.185 0 00.185-.185V9.006a.185.185 0 00-.184-.186h-2.12a.186.186 0 00-.186.186v1.887c0 .102.084.185.186.185m-2.92 0h2.12a.185.185 0 00.184-.185V9.006a.185.185 0 00-.184-.186h-2.12a.185.185 0 00-.184.185v1.888c0 .102.082.185.185.185M23.763 9.89c-.065-.051-.672-.51-1.954-.51-.338.001-.676.03-1.01.087-.248-1.7-1.653-2.53-1.716-2.566l-.344-.199-.226.327c-.284.438-.49.922-.612 1.43-.23.97-.09 1.882.403 2.661-.595.332-1.55.413-1.744.42H.751a.751.751 0 00-.75.748 11.376 11.376 0 00.692 4.062c.545 1.428 1.355 2.48 2.41 3.124 1.18.723 3.1 1.137 5.275 1.137.983.003 1.963-.086 2.93-.266a12.248 12.248 0 003.823-1.389c.98-.567 1.86-1.288 2.61-2.136 1.252-1.418 1.998-2.997 2.553-4.4h.221c1.372 0 2.215-.549 2.68-1.009.309-.293.55-.65.707-1.046l.098-.288Z"
      />
    ),
    pypi: (
      <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
        <path d="M12 2.5 3.5 7v10l8.5 4.5 8.5-4.5V7Z" />
        <path d="M3.5 7 12 11.5 20.5 7M12 11.5v10" />
      </g>
    ),
    live: (
      <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <circle cx="12" cy="12" r="2.2" fill="currentColor" stroke="none" />
        <path d="M7.8 7.8a6 6 0 0 0 0 8.4M16.2 7.8a6 6 0 0 1 0 8.4M4.9 4.9a10 10 0 0 0 0 14.2M19.1 4.9a10 10 0 0 1 0 14.2" />
      </g>
    ),
    docs: (
      <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
        <path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H11v17H5.5A1.5 1.5 0 0 1 4 18.5ZM20 4.5A1.5 1.5 0 0 0 18.5 3H13v17h5.5a1.5 1.5 0 0 0 1.5-1.5Z" />
      </g>
    ),
    blog: (
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" />
      </g>
    ),
    video: (
      <g>
        <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M10 8.2v7.6l6-3.8Z" fill="currentColor" />
      </g>
    ),
    other: (
      <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
        <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
      </g>
    ),
  };
  return (
    <svg className="linkicon" viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
      {paths[kind]}
    </svg>
  );
}
