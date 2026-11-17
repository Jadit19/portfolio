import { useEffect, useRef, useState } from "react";
import { world as worldInfo } from "../content/worlds";
import { app, setNight } from "../state/app";
import { restorePatches, ride } from "../state/ride";
import { useStore } from "../state/store";
import { prefersReducedMotion } from "../three/anim";
import { LineupScene } from "../three/lineup/scene";
import { Stage } from "../three/stage";
import type { WorldScene } from "../three/world/scene";
import { enterFullscreen, exitFullscreen, inFullscreen, smallScreen } from "./fullscreen";
import { Loader } from "./Loader";
import { ride as rideWorld } from "./Picker";
import { buildWorld } from "./prebuild";
import { RitualHud, Veil } from "./Ritual";
import { Toast } from "./Toast";
import { TopBar } from "./TopBar";
import { WorldHud } from "./World";
import { PassportBook, YardUi } from "./Yard";

export function App() {
  const host = useRef<HTMLDivElement>(null);
  // The opening yard (it plays the garage's part: the landing and the ride out).
  const [garage, setGarage] = useState<LineupScene | null>(null);
  const stageRef = useRef<Stage | null>(null);
  const ready = useStore(app, (s) => s.ready);
  const view = useStore(app, (s) => s.view);
  const mode = useStore(app, (s) => s.mode);
  const worldId = useStore(app, (s) => s.world);
  const worldReady = useStore(app, (s) => s.worldReady);
  const ritual = useStore(app, (s) => s.ritual);
  const cardOpen = useStore(ride, (s) => s.open !== null);
  const night = useStore(app, (s) => s.night);
  const [world, setWorld] = useState<WorldScene | null>(null);
  // The passport is going (its book sliding away): the yard's card comes back up meanwhile.
  const [passportLeaving, setPassportLeaving] = useState(false);
  useEffect(() => {
    if (view !== "passport") setPassportLeaving(false);
  }, [view]);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    restorePatches();
    const stage = new Stage(el);
    stageRef.current = stage;
    // Arrive as it was left (or as the device is set): no dusk on the way in.
    stage.setNight(app.get().night, true);
    let alive = true;
    let scene: LineupScene | null = null;
    stage.start();
    LineupScene.create(stage.canvas, (p) => app.patch({ loading: p }))
      .then((g) => {
        if (!alive) return;
        scene = g;
        stage.setScene(g);
        g.snapCamera();
        setGarage(g);
        // Let the loader finish its sweep before revealing.
        setTimeout(() => app.patch({ ready: true }), 350);
      })
      .catch((err: unknown) => console.error("The yard failed to build", err));
    return () => {
      alive = false;
      if (scene) scene.dispose(stage.canvas);
      stage.dispose();
    };
  }, []);

  // Riding a world. The garage plays the ride ritual (kit up, ride out, dive
  // into the map) while the world builds in slices behind it; when both are
  // done it plunges into the miniature under a wash of the world's sky colour
  // and the stage hands over. With reduced motion: the plain loader instead.
  // Coming back plays the ritual in reverse.
  useEffect(() => {
    const stage = stageRef.current;
    if (mode !== "world" || !worldId || !stage || !garage) return;
    let alive = true;
    let built: WorldScene | null = null;
    let shown = false;
    const animate = !prefersReducedMotion();
    app.patch({ loading: 0, ritual: animate ? "out" : null, veil: null });
    // Nothing covers the garage while it plays.
    if (animate) stage.setInsets({});
    const departed = animate ? garage.depart(worldId) : Promise.resolve();
    // Over the map before the world is built: wait there (a progress ring shows).
    void departed.then(() => {
      if (animate && alive && !built) app.patch({ ritual: "hold" });
    });
    // Built from now (Ride pressed), in slices while the ride out plays: see prebuild.ts.
    buildWorld(worldId, stage, (p) => app.patch({ loading: p }))
      .then(async (w) => {
        if (!alive) {
          w.dispose();
          return;
        }
        built = w;
        // (Its shaders were compiled and it was drawn once off screen as it was built.)
        await departed;
        if (!alive) return;
        if (animate) {
          app.patch({ tone: w.tone, veil: w.tone });
          await garage.plunge();
          if (!alive) return;
        }
        shown = true;
        // Now it rides: it takes the ride state and listens to keys and the pointer.
        w.activate(stage.canvas);
        stage.setScene(w);
        w.snapCamera();
        setWorld(w);
        app.patch({ ritual: null, tone: w.tone });
        setTimeout(() => alive && app.patch({ worldReady: true, veil: null }), animate ? 80 : 350);
      })
      .catch((err: unknown) => {
        console.error("World failed to build", err);
        garage.cancelRitual();
        app.patch({
          mode: "garage",
          world: null,
          ritual: null,
          veil: null,
          toast: "That ride didn't start. Try again?",
        });
      });
    return () => {
      alive = false;
      setWorld(null);
      if (built) built.dispose();
      stage.setScene(garage);
      app.patch({ worldReady: false });
      if (animate && shown) {
        // Home: the ritual in reverse, starting down in the miniature, under the veil.
        app.patch({ ritual: "in" });
        void garage.welcome(worldId).then(() => {
          if (app.get().ritual === "in") app.patch({ ritual: null });
        });
        requestAnimationFrame(() => app.patch({ veil: null }));
      } else {
        // Abandoned before the world showed: everything straight back.
        garage.cancelRitual();
        app.patch({ ritual: null, veil: null });
      }
    };
  }, [mode, worldId, garage]);

  // Tell the camera how much of the screen the panel or sheet really covers,
  // so it frames the scene into the space that's actually left.
  useEffect(() => {
    // Re-measure whenever the view changes: each view has its own panel.
    if (!ready || !view || (mode === "world" && !worldReady) || ritual) return;
    void cardOpen;
    const hostEl = host.current;
    const measure = () => {
      const stage = stageRef.current;
      const panel = document.querySelector<HTMLElement>(".ui .panel");
      if (!stage || !hostEl) return;
      if (!panel) {
        // Nothing covers the scene (riding with no card open).
        stage.setInsets({ right: 0, bottom: 0 });
        return;
      }
      const hr = hostEl.getBoundingClientRect();
      const pr = panel.getBoundingClientRect();
      const side = pr.top < hr.height * 0.5 && pr.left > hr.width * 0.4;
      stage.setInsets(
        side
          ? { right: Math.round(hr.right - pr.left + 16) }
          : { bottom: Math.round(hr.bottom - pr.top + 12) },
      );
    };
    const ro = new ResizeObserver(measure);
    const panel = document.querySelector<HTMLElement>(".ui .panel");
    if (panel) ro.observe(panel);
    if (hostEl) ro.observe(hostEl);
    // Panels animate in; measure once they've settled too.
    const t = setTimeout(measure, 700);
    measure();
    return () => {
      ro.disconnect();
      clearTimeout(t);
    };
  }, [ready, view, mode, worldReady, cardOpen, ritual]);

  // Day ↔ night: eases over ~5 s (at once with reduced motion).
  useEffect(() => {
    stageRef.current?.setNight(night, prefersReducedMotion());
  }, [night]);

  // F toggles full screen, anywhere (not while typing).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      // N: day or night.
      if (k === "n") {
        e.preventDefault();
        setNight(!app.get().night);
        return;
      }
      if (k !== "f") return;
      e.preventDefault();
      void (inFullscreen() ? exitFullscreen() : enterFullscreen());
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Keyboard: arrows cycle the bikes (in the yard's order), Enter rides the picked one, Esc puts it back, P opens the passport (and closes it: see PassportBook).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!app.get().ready || app.get().mode !== "garage" || app.get().ritual) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      const s = app.get();
      if (s.view === "passport") return;
      if (e.key.toLowerCase() === "p") {
        app.patch({ view: "passport" });
        return;
      }
      // Enter rides the picked bike, like its Ride button (a focused button handles its own Enter).
      if (e.key === "Enter" && s.selected && !(t instanceof HTMLButtonElement) && !e.repeat) {
        e.preventDefault();
        if (rideWorld(worldInfo(s.selected)) && smallScreen()) void enterFullscreen();
        return;
      }
      // Esc puts the picked bike back and closes its card.
      if (e.key === "Escape" && s.selected) {
        app.patch({ selected: null });
        return;
      }
      const order = LineupScene.order();
      const n = order.length;
      const found = s.selected ? order.indexOf(s.selected) : -1;
      const fwd = e.key === "ArrowRight" || e.key === "ArrowDown";
      const back = e.key === "ArrowLeft" || e.key === "ArrowUp";
      if (!fwd && !back) return;
      e.preventDefault();
      const i = found < 0 ? (fwd ? -1 : n) : found;
      app.patch({ selected: order[(i + (fwd ? 1 : -1) + n) % n] ?? s.selected });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div
      className={`app view-${view} mode-${mode} ${ready ? "is-ready" : ""} ${night ? "is-night" : ""}`}
      ref={host}
    >
      <div className="ui">
        <TopBar />
        {mode === "world" && worldReady && world && <WorldHud scene={world} />}
        {mode === "garage" && ready && !ritual && (
          <YardUi away={view === "passport" && !passportLeaving} />
        )}
        {mode === "garage" && ready && !ritual && view === "passport" && (
          <PassportBook onLeaving={() => setPassportLeaving(true)} />
        )}
        {ritual && garage && <RitualHud garage={garage} />}
        <Toast />
      </div>
      <Loader />
      <Veil />
    </div>
  );
}
