import type { Rect, Size } from './capture';

/** Details the content script reports about the tweet nearest the viewport centre. */
export interface FocusedTweetRect {
  rect: Rect;
  viewport: Size;
  handle?: string;
  textSnippet?: string;
}

/** Messages the side panel sends to the content script. */
export type ContentRequest = { type: 'GET_FOCUSED_TWEET_RECT' };

/** Responses the content script returns. */
export type ContentResponse = FocusedTweetRect | { error: string };

export const GET_FOCUSED_TWEET_RECT = 'GET_FOCUSED_TWEET_RECT' as const;

export function isErrorResponse(
  response: ContentResponse | undefined,
): response is { error: string } {
  return !response || 'error' in response;
}
