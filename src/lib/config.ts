/**
 * Site-wide feature flags.
 *
 * DOWNLOADS_ENABLED — master switch for app distribution. While false, every
 * download surface (homepage, hero CTA, account download page) shows a
 * "coming soon" state and no release is fetched or linked.
 * Flip to true when MixBridge is ready for public distribution.
 */
export const DOWNLOADS_ENABLED = false;
