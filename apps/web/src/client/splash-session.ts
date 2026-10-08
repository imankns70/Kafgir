/**
 * The splash belongs to opening the app, not to moving around in it. A full page load (refresh,
 * Telegram back, a plain link) renders it again from the server HTML, so the first showing is
 * remembered for the browser/Telegram session and an inline script hides it on later loads before
 * the first paint.
 */
export const SPLASH_SEEN_KEY = 'kafgir:splash-seen'
export const SPLASH_SEEN_CLASS = 'splash-seen'

/** Runs in <head> before the body paints; storage can throw in private modes, so it is guarded. */
export const splashSeenScript =
  `try{if(sessionStorage.getItem('${SPLASH_SEEN_KEY}'))document.documentElement.classList.add('${SPLASH_SEEN_CLASS}')}catch(e){}`
