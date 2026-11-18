/**
 * Full screen, with the older WebKit names some browsers (iPad Safari) still
 * use. Browsers only allow entering it from a tap or click, so call these
 * from an event handler. Not available on iPhone Safari (we just carry on).
 */

type FsDoc = Document & {
  webkitFullscreenEnabled?: boolean;
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
};
type FsEl = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void };

const fsDoc = () => document as FsDoc;

export const canFullscreen = (): boolean =>
  Boolean(fsDoc().fullscreenEnabled || fsDoc().webkitFullscreenEnabled);

export const inFullscreen = (): boolean =>
  Boolean(fsDoc().fullscreenElement || fsDoc().webkitFullscreenElement);

/** Already running as an app from the Home Screen (no browser bars to hide). */
export const fromHomeScreen = (): boolean =>
  (window.matchMedia?.("(display-mode: fullscreen), (display-mode: standalone)").matches ??
    false) ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

/**
 * iPhone (and other Apple touch devices without the full-screen API): the only
 * way to lose the browser bars is to add the site to the Home Screen.
 */
export const homeScreenOnly = (): boolean =>
  !canFullscreen() &&
  !fromHomeScreen() &&
  (/iP(hone|od|ad)/.test(navigator.userAgent) ||
    (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1));

/** Small or touch screens: where full screen is worth asking for. */
export const smallScreen = (): boolean =>
  window.matchMedia?.("(max-height: 600px), (pointer: coarse)").matches ?? false;

export async function enterFullscreen(): Promise<void> {
  if (!canFullscreen() || inFullscreen()) return;
  try {
    const el = document.documentElement as FsEl;
    if (el.requestFullscreen) await el.requestFullscreen({ navigationUI: "hide" });
    else await el.webkitRequestFullscreen?.();
    // Phones: hold it in landscape while full screen (where the browser allows it).
    const o = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
    await o?.lock?.("landscape").catch(() => {});
  } catch {
    // Refused (not from a tap, or not allowed): carry on as we are.
  }
}

export async function exitFullscreen(): Promise<void> {
  if (!inFullscreen()) return;
  try {
    if (document.exitFullscreen) await document.exitFullscreen();
    else await fsDoc().webkitExitFullscreen?.();
  } catch {
    // Already out.
  }
}

/**
 * iPhone, opened from the Home Screen: the app always fills the whole screen,
 * but iOS often reports a viewport a status bar short of it (in landscape too,
 * where no status bar shows), leaving a dark band along the bottom. There, the
 * app is sized to the screen itself (`--app-h`); everywhere else it's 100%.
 */
export function fitHomeScreen(): void {
  if (!fromHomeScreen() || !/iP(hone|od)/.test(navigator.userAgent)) return;
  const set = () => {
    // (iOS reports the screen in portrait whichever way it's held.)
    const short = Math.min(screen.width, screen.height);
    const long = Math.max(screen.width, screen.height);
    const h = window.matchMedia("(orientation: landscape)").matches ? short : long;
    document.documentElement.style.setProperty("--app-h", `${Math.max(h, window.innerHeight)}px`);
  };
  set();
  window.addEventListener("resize", set);
  window.addEventListener("orientationchange", () => setTimeout(set, 300));
}
