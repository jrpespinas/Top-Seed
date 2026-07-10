import { Sidebar } from "./Sidebar";
import { BottomBar } from "./BottomBar";
import { ZoomGuard } from "./ZoomGuard";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-bg">
      <ZoomGuard />
      <Sidebar />
      {/* md:ml must match Sidebar's own width exactly — it grows past 80px
          (w-20) by env(safe-area-inset-left) on landscape-notch devices. */}
      <main className="flex-1 md:ml-[calc(5rem+env(safe-area-inset-left))] pb-[calc(60px+env(safe-area-inset-bottom))] md:pb-0 min-w-0 flex flex-col">
        {children}
      </main>
      <BottomBar />
    </div>
  );
}
