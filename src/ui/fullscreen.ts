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
