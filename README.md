# Top Seed

A web app for running badminton sessions: check in players, manage the queue, assign courts, record match results, and track a leaderboard and manual payments for the group.

This README explains how to stand up your own copy of the app on [Vercel](https://vercel.com) — no coding required.

## What you're deploying, in plain terms

Top Seed has **no database and no server-side accounts**. Everything an organizer enters — players, matches, payment notes — is saved directly in that organizer's own web browser (this is called `localStorage`). There's nothing to configure, no secrets to generate, and no account system to set up before it works.

The one thing this means for you: **data doesn't sync across devices or browsers.** If you deploy this and use it from your phone, then open the same link on a laptop, the laptop won't see the phone's players and matches — it's a separate, empty copy. Each device/browser combination that opens the link keeps its own data. This is fine for a single organizer running sessions from one device (e.g., a tablet at the court), but worth knowing before you rely on it for a team.

## What you need

- A free [GitHub](https://github.com) account
- A free [Vercel](https://vercel.com) account (you can sign up using your GitHub account — one click, no separate password)

That's it. No credit card, no database provider, no API keys.

## Step 1 — Get your own copy of the code

1. Open the project's GitHub page.
2. Click **Fork** (top right of the page). This creates a copy of the code under your own GitHub account — your fork is independent, so you're free to keep it as-is, deploy it, or later ask for changes without affecting the original.

If you don't have access to fork the repository directly, ask whoever manages it to either add you as a collaborator or share a copy of the code with you first.

## Step 2 — Import it into Vercel

1. Go to [vercel.com/new](https://vercel.com/new) and log in.
2. Click **Import Git Repository**, and select the fork you just created (`your-username/Top-Seed`).
3. Vercel will auto-detect this as a Next.js project — you don't need to change any build settings.
4. Skip the "Environment Variables" section entirely. There is nothing to add there for this app.
5. Click **Deploy**.

Vercel will build the app and give you a live URL (something like `top-seed-yourname.vercel.app`) within a couple of minutes. That's your own running instance.

## Step 3 — (Optional) Use your own domain

If you want the app to live at a domain you own (e.g., `badminton.yourclub.com`) instead of the default `vercel.app` address:

1. In your Vercel project, go to **Settings → Domains**.
2. Add your domain and follow Vercel's instructions to point your DNS at it.

This step is entirely optional — the free `vercel.app` address works exactly the same way.

## Installing it on a phone or tablet

Top Seed can be installed like a real app — an icon on the home screen, opens full-screen with no browser address bar, and keeps working even if the gym's wifi drops mid-session. This is a one-time, per-device setup: do it once on the tablet or phone you'll actually be running sessions from.

### On iPhone or iPad

This only works in **Safari** — Chrome and other browsers on iOS aren't allowed to install apps to the home screen, even though they can open the site fine.

1. Open your app's link in **Safari**.
2. Tap the **Share** icon (the square with an arrow pointing up), in the bottom toolbar.
3. Scroll down and tap **Add to Home Screen**.
4. Confirm the name (defaults to "Top Seed") and tap **Add** in the top right.

An icon now sits on your home screen like any other app.

### On Android

1. Open your app's link in **Chrome**.
2. You'll often see an **Install** banner appear automatically at the bottom of the screen — tap it. If it doesn't appear, tap the **⋮** menu (top right) and look for **Install app** or **Add to Home screen**.
3. Confirm by tapping **Install**.

### After installing

- Opening it from the home screen icon feels like a normal app — no browser bar, no tabs.
- It keeps working without an internet connection after the first time it's opened, so a dead spot in the gym won't interrupt an in-progress session.
- Remember the earlier point about data being per-device: installing it on a phone and a tablet gives you two separate, independent copies of the app, not one synced instance.

## Keeping your instance up to date

If the original project receives updates and you want them reflected in your copy:

1. On your fork's GitHub page, look for a **"Sync fork"** button and use it to pull in the latest changes.
2. Vercel automatically redeploys your instance a few moments after your fork's code changes — no manual step needed on the Vercel side.

## Cost

Vercel's free "Hobby" plan is enough to run this app — there's no database usage or server workload that would push you into a paid tier.

## Good to know before you roll this out to your group

- **Backups are manual.** Since data lives in the browser, there's no automatic cloud backup. The Settings page includes a "Reset all data" option — treat it (and clearing browser data/cache) as permanent deletion of everything on that device.
- **One organizer device per session is the intended use.** If two people need to manage the same live session from two different devices at once, they'll each see their own separate data, not a shared view.
- **No login screen.** Anyone with the link who opens it on their device can use the app as an organizer. If you need to restrict access, that's a change to the app itself, not a deployment setting.
