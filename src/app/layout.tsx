import type { Metadata, Viewport } from "next";
import { Space_Grotesk, JetBrains_Mono } from "next/font/google";
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
  weight: ["400", "500"],
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
  // Server-rendered default for the pre-hydration instant — matches the
  // dark theme's own default. The inline script below immediately corrects
  // this to the user's actual resolved theme (localStorage or OS
  // preference) before paint, and ThemeToggle keeps it in sync afterward —
  // this static value alone can't track a user-toggled theme.
  themeColor: THEME_COLOR.dark,
};

// Runs before paint: resolves the theme (localStorage, else OS preference),
// sets data-theme, and syncs <meta name="theme-color"> to match — without
// this, the browser/PWA chrome color would stay stuck on the server-rendered
// default even when the resolved theme is light.
const themeScript = `(function(){try{var s=localStorage.getItem('ts-theme');var t=s||(matchMedia('(prefers-color-scheme:light)').matches?'light':'dark');document.documentElement.dataset.theme=t;var c=t==='light'?'${THEME_COLOR.light}':'${THEME_COLOR.dark}';var m=document.querySelector('meta[name="theme-color"]');if(m){m.setAttribute('content',c);}else{m=document.createElement('meta');m.name='theme-color';m.content=c;document.head.appendChild(m);}}catch(e){}})()`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${spaceGrotesk.variable} ${jetbrainsMono.variable}`}
    >
      <head>
        {/* Runs before paint to set data-theme and prevent flash */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="antialiased">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
