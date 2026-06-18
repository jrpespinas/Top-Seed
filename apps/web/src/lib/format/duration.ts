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
