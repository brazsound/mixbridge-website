/**
 * Site-wide feature flags.
 *
 * DOWNLOADS_ENABLED — master switch for app distribution. While false, every
 * download surface (homepage, hero CTA, account download page) shows a
 * "coming soon" state and no release is fetched or linked.
 * Flip to true when MixBridge is ready for public distribution.
 */
export const DOWNLOADS_ENABLED = false;

/**
 * SUPPORT_URL — optional "support development" link (Ko-fi). While empty, every
 * support button on the site stays hidden. Paste your Ko-fi URL here
 * (e.g. https://ko-fi.com/brazsound) to switch them on.
 */
export const SUPPORT_URL: string = 'https://ko-fi.com/mixbridge';
