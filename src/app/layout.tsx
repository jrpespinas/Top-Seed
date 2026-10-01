import type { Metadata, Viewport } from "next";
import { Space_Grotesk, JetBrains_Mono, Barlow_Condensed } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/layout/AppShell";
import { THEME_COLOR } from "@/lib/utils";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  // 700 for the court card's scoreboard number, which the browser was
  // synthesising as a smeared faux-bold from the 500 weight.
  weight: ["400", "500", "700"],
  display: "swap",
});

// Broadcast display face, for the leaderboard podium and the shareable story
// only. A condensed italic in capitals is the visual language of TV sports
// graphics; the rest of the app stays in Space Grotesk.
const barlowCondensed = Barlow_Condensed({
  subsets: ["latin"],
  variable: "--font-barlow-condensed",
  weight: ["600", "700", "800"],
  style: ["normal", "italic"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Top Seed",
  description: "Professional badminton session management",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Top Seed",
  },
  // Both icons come from Next.js's file-based convention — app/icon.png (32x32,
  // purpose-rendered, crisper than downscaling a 192px source) for the browser
  // tab, app/apple-icon.png (180x180) for iOS home-screen — no explicit `icons`
  // entry needed here.
};

// Split from `metadata` per Next.js's own convention (themeColor/viewport-fit
// moved out of the Metadata type in 14). `viewport-fit=cover` is what makes
// `env(safe-area-inset-*)` resolve to a real value instead of 0 — required
// for standalone/installed mode to look right on notched devices, though the
// actual safe-area CSS on BottomBar is tracked separately.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // Single theme, so this is simply the canvas colour — no pre-paint script
  // and no hydration correction needed.
  themeColor: THEME_COLOR,
};


export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${jetbrainsMono.variable} ${barlowCondensed.variable}`}
    >
      <body className="antialiased">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
