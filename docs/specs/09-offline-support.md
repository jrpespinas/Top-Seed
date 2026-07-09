# Spec: Offline Support

**Status: not yet implemented.** Every other file in `docs/specs/` documents what's already built; this one is a plan. Follow it when this feature gets built, and update this file (or fold it into the others' "Known Gaps" sections) once it's real, matching this directory's own convention.

## Scope

Make the app usable without a network connection, for the environment `PRODUCT.md` already names as primary: courtside, gym wifi, no guarantee of connectivity mid-session.

This splits into two genuinely different problems:

1. **The data layer** — already offline-capable, no work needed. Every read/write in this app goes through `localStorage` (`session-store.ts`, `match-log-store.ts`); there is no backend, no API route, nothing to fetch. Once the page is loaded, adding players, recording matches, and closing sessions already work with zero network dependency.
2. **Loading the app shell** — not offline-capable today. A fresh tab or a hard refresh with no connectivity fails outright, because nothing caches the built JS/CSS/HTML. An already-open tab happens to keep working (no further fetches needed), but that's incidental — not a guarantee, and a closed tab or evicted cache loses it. This spec is entirely about closing this second gap; the first one is already done.

---

## Technical Approach

### Service worker via `next-pwa`

Add [`next-pwa`](https://github.com/shadowwalker/next-pwa) (a Workbox wrapper built for Next.js) and configure it in `next.config.mjs`. It generates a service worker at build time that precaches the app shell (JS bundles, CSS, fonts) so subsequent loads — including fully offline ones — are served from cache instead of the network.

**Caching strategy is simpler here than in most PWA setups**, worth stating explicitly: this app has zero API routes and zero server-fetched data, so there's no stale-data reconciliation problem to design around (the usual hard part of offline caching). Cache-first for the app shell is sufficient — there's no server response to ever be "fresher" than what's cached, since all real data lives in `localStorage` on the device, not behind any fetch.

```js
// next.config.mjs
import withPWA from "next-pwa";

const nextConfig = {};

export default withPWA({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
})(nextConfig);
```

`disable` in development avoids fighting the dev server's own hot-reload with a cached service worker while iterating.

### `manifest.json` (installability)

New `public/manifest.json`:

```json
{
  "name": "Top Seed",
  "short_name": "Top Seed",
  "description": "Badminton session organizer",
  "start_url": "/",
  "display": "standalone",
  "background_color": "oklch(9% 0 0)",
  "theme_color": "oklch(9% 0 0)",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

`background_color`/`theme_color` match `--color-bg-raw`'s dark-theme value (`globals.css`) so the OS splash screen and browser chrome don't flash a mismatched color on launch. `display: "standalone"` drops browser chrome when installed — appropriate for a tool used mid-session on a tablet, not a page someone's casually browsing.

**Real gap, not something written code can fill**: this needs actual `icon-192.png`/`icon-512.png` image assets. No icon exists in this repo today (`public/` has no app icon) — someone needs to design or source one before this manifest is functional. Referencing placeholder files here would silently ship a broken manifest.

Link it from `src/app/layout.tsx`'s `<head>` (or the Next.js `metadata` export's `manifest` field, the App Router's built-in way to do this).

### Update strategy

The app's *code* still changes over time (this session alone shipped a dozen features) even though its *data* never goes stale. `skipWaiting: true` above means a new service worker activates as soon as it finishes installing, so a returning user gets the latest build on their next visit rather than being stuck on a cached version indefinitely. No mid-session "new version available" toast — refreshing the app shell out from under an organizer mid-match would be actively disruptive; picking it up silently on the next natural page load is the safer default here.

### What does not need to change

No component, no store, no business logic. This is entirely build-config and static assets — `session-store.ts` and `match-log-store.ts` are untouched.

---

## Non-Goals

- **Cross-device sync.** Offline support doesn't change the single-device-only nature of `localStorage` persistence (see the data-consumption conversation this spec follows from) — that's a separate, much bigger architectural question tied to the "no backend yet" limitation `CLAUDE.md` already names.
- **Background sync / push notifications.** `CLAUDE.md` already lists real-time push notifications as out of scope for the whole app; nothing here changes that.
- **First-load-ever offline.** A PWA has to be downloaded once before it can work offline — this spec covers every visit *after* the first, not a cold start with zero connectivity.

---

## Verification

- Chrome DevTools → Application → Service Workers (confirm registration) and the Network tab's "Offline" checkbox — reload with it checked and confirm the app shell still renders.
- Lighthouse's PWA audit as a sanity check on the manifest/service-worker setup.
- Confirm a session already in `localStorage` is still fully usable (add players, record a match, close the session) with the network disabled — this should already work today per the Scope section above, but is worth confirming end-to-end once the shell-loading half is also in place.

## Open Questions

- **App icons**: need real 192×192 and 512×512 PNG assets before the manifest is functional — flagged above, not something this spec can resolve on its own.
- **Install prompt**: this plan relies on the browser's own passive "Add to Home Screen" affordance rather than a custom in-app install prompt/banner. A custom prompt is more UI surface for a benefit (installability) that's secondary to the actual goal (offline reliability) — recommend passive unless there's a specific reason to actively promote installation.
