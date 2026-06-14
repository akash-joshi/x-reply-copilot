export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface CropRect {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

/** Longest edge (px) we downscale captured tweets to, to keep latency and tokens sane. */
const MAX_IMAGE_EDGE = 1024;

/** Scale dimensions so the longest edge is at most maxEdge, preserving aspect ratio. Never upscales. */
export function fitWithin(width: number, height: number, maxEdge: number): Size {
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/**
 * Map a tweet's CSS-pixel rect (from getBoundingClientRect) onto the captured
 * frame's device pixels, clamped to the frame. The scale is derived from the
 * actual frame size rather than devicePixelRatio, so any tab-vs-window scaling
 * is handled correctly.
 */
export function computeCropRect(tweet: Rect, frame: Size, viewport: Size): CropRect {
  const scaleX = frame.width / viewport.width;
  const scaleY = frame.height / viewport.height;

  const sx = clamp(Math.round(tweet.left * scaleX), 0, frame.width);
  const sy = clamp(Math.round(tweet.top * scaleY), 0, frame.height);
  const sw = clamp(Math.round(tweet.width * scaleX), 0, frame.width - sx);
  const sh = clamp(Math.round(tweet.height * scaleY), 0, frame.height - sy);

  return { sx, sy, sw, sh };
}

/** Grab a single frame from a video track, preferring ImageCapture. */
async function grabFrame(track: MediaStreamTrack): Promise<ImageBitmap> {
  const globalWindow = window as unknown as { ImageCapture?: new (track: MediaStreamTrack) => { grabFrame(): Promise<ImageBitmap> } };
  if (globalWindow.ImageCapture) {
    return new globalWindow.ImageCapture(track).grabFrame();
  }

  // Fallback for browsers without ImageCapture: snapshot a hidden video element.
  const video = document.createElement('video');
  video.srcObject = new MediaStream([track]);
  await video.play();
  const bitmap = await createImageBitmap(video);
  video.pause();
  return bitmap;
}

/**
 * Capture the focused tweet as a base64 PNG data URL via screen capture.
 * Runs in the side panel (a DOM context with the user gesture). Not unit-tested
 * (depends on getDisplayMedia/ImageCapture); exercised manually.
 */
export async function captureFocusedTweet(tweet: Rect, viewport: Size): Promise<string> {
  const stream = await navigator.mediaDevices.getDisplayMedia({
    video: true,
    audio: false,
    // getDisplayMedia runs in the side panel, so preferCurrentTab would target the
    // panel itself. Instead, exclude our own surface and let the user pick the X tab.
    selfBrowserSurface: 'exclude',
  } as MediaStreamConstraints & { selfBrowserSurface: 'exclude' });

  try {
    const [track] = stream.getVideoTracks();
    const frame = await grabFrame(track);
    const crop = computeCropRect(tweet, { width: frame.width, height: frame.height }, viewport);

    const output = fitWithin(crop.sw, crop.sh, MAX_IMAGE_EDGE);
    const canvas = document.createElement('canvas');
    canvas.width = output.width;
    canvas.height = output.height;
    const context = canvas.getContext('2d')!;
    context.drawImage(frame, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, output.width, output.height);

    return canvas.toDataURL('image/png');
  } finally {
    stream.getTracks().forEach((track) => track.stop());
  }
}
