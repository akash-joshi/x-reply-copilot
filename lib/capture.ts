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
    // Chrome-only hint to bias the picker toward the current tab.
    preferCurrentTab: true,
  } as MediaStreamConstraints & { preferCurrentTab: boolean });

  try {
    const [track] = stream.getVideoTracks();
    const frame = await grabFrame(track);
    const crop = computeCropRect(tweet, { width: frame.width, height: frame.height }, viewport);

    const canvas = document.createElement('canvas');
    canvas.width = crop.sw;
    canvas.height = crop.sh;
    const context = canvas.getContext('2d')!;
    context.drawImage(frame, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, crop.sw, crop.sh);

    return canvas.toDataURL('image/png');
  } finally {
    stream.getTracks().forEach((track) => track.stop());
  }
}
