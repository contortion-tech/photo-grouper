import { track } from '@vercel/analytics';

export type ProductEvent =
  | 'photo_picker_opened'
  | 'photos_prepared'
  | 'editor_opened'
  | 'export_completed'
  | 'export_failed'
  | 'export_feedback';

type SafeProperty = string | number | boolean | null;

const analyticsEnabled = process.env.NEXT_PUBLIC_ENABLE_ANALYTICS !== 'false';

/**
 * Product telemetry is deliberately restricted to coarse workflow state.
 * Never pass filenames, captions, image dimensions, URLs, or photo contents.
 */
export function trackProductEvent(
  event: ProductEvent,
  properties: Record<string, SafeProperty> = {},
) {
  if (!analyticsEnabled || typeof window === 'undefined') return;
  track(event, properties);
}
