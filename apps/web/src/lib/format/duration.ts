export function formatWaitDuration(checkedInAt: string, now = new Date()): string {
  const start = new Date(checkedInAt).getTime();
  const elapsedMs = Math.max(0, now.getTime() - start);
  const minutes = Math.floor(elapsedMs / 60_000);

  if (minutes < 1) {
    return "< 1 min";
  }
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder > 0 ? `${hours}h ${remainder}m` : `${hours}h`;
}

export function formatElapsedClock(checkedInAt: string, now = new Date()): string {
  const elapsedMs = Math.max(0, now.getTime() - new Date(checkedInAt).getTime());
  const totalSeconds = Math.floor(elapsedMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
