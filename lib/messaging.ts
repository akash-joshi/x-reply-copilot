import type { Rect, Size } from './capture';

/** Details about the tweet nearest the viewport centre, returned by the injected probe. */
export interface FocusedTweetRect {
  rect: Rect;
  viewport: Size;
  handle?: string;
}

/** Result of the focused-tweet detection injected into the page via scripting.executeScript. */
export type ContentResponse = FocusedTweetRect | { error: string };
