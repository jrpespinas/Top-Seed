import { Sidebar } from "./Sidebar";
import { BottomBar } from "./BottomBar";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-bg">
      <Sidebar />
      <main className="flex-1 md:ml-20 pb-[60px] md:pb-0 min-w-0 flex flex-col">
        {children}
      </main>
      <BottomBar />
    </div>
  );
}
