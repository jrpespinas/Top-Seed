# Spec: Offline Support

**Status: implemented.** The app is installable and works offline after the first visit.

## Scope

Make the app usable without a network connection, for the environment `PRODUCT.md` already names as primary: courtside, gym wifi, no guarantee of connectivity mid-session.

This split into two genuinely different problems:

1. **The data layer** — already offline-capable, no work needed. Every read/write in this app goes through `localStorage` (`session-store.ts`, `match-log-store.ts`); there is no backend, no API route, nothing to fetch. Adding players, recording matches, and closing sessions already work with zero network dependency once the page is loaded.
2. **Loading the app shell** — this is what shipped here. A service worker now precaches the built JS/CSS/HTML/fonts at build time, so a fresh tab or a hard refresh with no connectivity still loads.

---

## Technical Approach

### Service worker via `@ducanh2912/next-pwa`

Configured in `next.config.mjs`. This is the actively-maintained App Router–compatible fork of the original `next-pwa` (the original has had maintenance gaps against newer Next.js `app/` conventions) — a Workbox wrapper that generates a service worker at build time precaching the app shell.

**Caching strategy is simpler here than in most PWA setups**, worth stating explicitly: this app has zero API routes and zero server-fetched data, so there's no stale-data reconciliation problem to design around (the usual hard part of offline caching). Cache-first for the app shell is sufficient — there's no server response to ever be "fresher" than what's cached, since all real data lives in `localStorage` on the device, not behind any fetch. No custom `workboxOptions.runtimeCaching` rules were needed as a result — the package's own defaults already cover Next.js's static assets correctly for this exact situation.

```js
// next.config.mjs
import withPWA from "@ducanh2912/next-pwa";

const nextConfig = {};

export default withPWA({
  dest: "public",
  register: true,
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  disable: process.env.NODE_ENV === "development",
  workboxOptions: {
    disableDevLogs: true,
  },
})(nextConfig);
```

`disable` in development avoids fighting the dev server's own hot-reload with a cached service worker while iterating. The generated `public/sw.js`, `public/workbox-*.js`, and `public/*worker-*.js` are build output, not source — gitignored, regenerated on every `npm run build`.

### `manifest.json` (installability)

`public/manifest.json`:

```json
{
  "name": "Top Seed",
  "short_name": "Top Seed",
  "description": "Badminton session organizer — players, courts, matches, and payments.",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "orientation": "any",
  "background_color": "#020202",
  "theme_color": "#020202",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any maskable" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable" }
  ]
}
```

`background_color`/`theme_color` (`#020202`) are the hex-converted value of `--color-bg-raw`'s dark-theme OKLCH token (`oklch(0.09 0 0)`) — manifest icons/colors need sRGB hex, not OKLCH, so this is a one-time conversion, not a second source of truth (the token itself is still canonical in `globals.css`). Matching it here means the OS splash screen and browser chrome don't flash a mismatched color on launch. `display: "standalone"` drops browser chrome when installed.

Linked from `src/app/layout.tsx`'s `metadata.manifest` field (the App Router's built-in way to do this), not a manual `<link>` tag.

### Icons

The gap the original version of this spec flagged as unresolvable by written code alone — no icon asset existed anywhere in the repo. Closed by generating one:

- **Design**: a flat copper (`#f8754c`, the hex conversion of the dark-theme `--color-primary-raw` token) shuttlecock silhouette on the dark surface color (`#070707`, `--color-surface-raw`'s hex conversion) — the exact background Sidebar's own "TS" logo lockup sits on. Built as pure SVG path/circle primitives (`public/icon-source.svg`), not text — a `<text>` element would depend on Space Grotesk being available wherever the SVG gets rasterized, which isn't guaranteed; vector shapes have no such dependency and stay pixel-identical regardless of renderer.
- **Rasterized** via `sharp-cli` (`npx --yes sharp-cli`, no new runtime dependency — a one-time dev-time conversion) to `public/icon-192.png`, `public/icon-512.png` (manifest icons — `purpose: "any maskable"`, since the shape carries enough padding to survive Android's adaptive-icon masking), `src/app/icon.png` (32×32, the Next.js file-convention favicon — purpose-rendered at that size rather than downscaled from the 512px source, so the tab icon stays crisp), and `src/app/apple-icon.png` (180×180, Apple's own recommended home-screen size, also file-convention — no explicit `metadata.icons` entry needed for either).

### iOS-specific metadata

`src/app/layout.tsx`'s `metadata.appleWebApp` (`capable: true`, `statusBarStyle: "black-translucent"`) — iOS Safari doesn't read `display: "standalone"` from the manifest the way Android/desktop Chrome does; it needs this separate `apple-mobile-web-app-*` meta tag set to open without browser chrome when launched from the home screen.

Also added `viewport.viewportFit: "cover"` (split into Next's separate `Viewport` export, per the framework's own convention) — this is what makes `env(safe-area-inset-*)` resolve to a real value instead of `0` on notched devices. Required infrastructure for safe-area CSS to have any effect at all in standalone mode; the actual safe-area padding on `BottomBar.tsx` is tracked as its own fix (see the navbar critique backlog), not part of this spec.

### Update strategy

The app's *code* still changes over time even though its *data* never goes stale. `register: true` plus the package's default update behavior means a new service worker activates once it finishes installing, so a returning user gets the latest build on their next visit rather than being stuck on a cached version indefinitely. No mid-session "new version available" toast — refreshing the app shell out from under an organizer mid-match would be actively disruptive; picking it up silently on the next natural page load is the safer default here.

### What did not need to change

No component, no store, no business logic. This was entirely build-config and static assets — `session-store.ts` and `match-log-store.ts` are untouched.

---

## Non-Goals

- **Cross-device sync.** Offline support doesn't change the single-device-only nature of `localStorage` persistence — that's a separate, much bigger architectural question tied to the "no backend yet" limitation `CLAUDE.md` already names.
- **Background sync / push notifications.** `CLAUDE.md` already lists real-time push notifications as out of scope for the whole app; nothing here changes that.
- **First-load-ever offline.** A PWA has to be downloaded once before it can work offline — every visit *after* the first, not a cold start with zero connectivity.
- **Custom install prompt.** Relies on the browser/OS's own passive "Add to Home Screen" / install affordance rather than an in-app banner — more UI surface for a benefit that's secondary to the actual goal (offline reliability).

---

## Verification

Confirmed via `npm run build`: the PWA plugin compiles, `public/sw.js` + `public/workbox-*.js` generate, and the rendered `<head>` carries `<link rel="manifest">`, `<link rel="icon">` (32×32), `<link rel="apple-touch-icon">` (180×180), `<meta name="theme-color">`, and the `apple-mobile-web-app-*` tags. `tsc`, `next lint`, and the bundled design detector all pass clean on every touched file.

Not verified in this environment (no browser/device available here — confirm on a real device before considering this fully closed):
- Actual "Add to Home Screen" flow on a phone, and that the installed icon/splash render correctly.
- Chrome DevTools → Application → Service Workers + Network → Offline checkbox, confirming a hard reload with no connectivity still renders the shell.
- Lighthouse's PWA audit.
- That a session already in `localStorage` is still fully usable (add players, record a match, close the session) with the network disabled — this should already work per the Scope section above, but is worth confirming end-to-end now that the shell-loading half is also in place.

## Open Questions

None outstanding from the original spec — both flagged blockers (missing `next-pwa` config, missing icon assets) are resolved. The device-level verification steps above are the only remaining unknowns, and they need a physical phone, not more code.
