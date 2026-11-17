import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import * as THREE from "three";
import { app } from "./state/app";
import { App } from "./ui/App";

// ?debug exposes the store for tests (e.g. awarding a patch before the worlds exist),
// and three.js itself for design boards that restyle the live scenes.
if (new URLSearchParams(location.search).has("debug")) {
  (window as unknown as { __app?: typeof app }).__app = app;
  (window as unknown as { __THREE?: typeof THREE }).__THREE = THREE;
}

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root");
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
