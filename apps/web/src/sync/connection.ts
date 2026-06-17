type ConnectionListener = (online: boolean) => void;

const listeners = new Set<ConnectionListener>();

function notify() {
  const online = getConnectionStatus();
  for (const listener of listeners) {
    listener(online);
  }
}

export function getConnectionStatus(): boolean {
  return typeof navigator !== "undefined" ? navigator.onLine : true;
}

export function subscribeConnection(listener: ConnectionListener): () => void {
  listeners.add(listener);
  if (typeof window !== "undefined") {
    window.addEventListener("online", notify);
    window.addEventListener("offline", notify);
  }
  return () => {
    listeners.delete(listener);
    if (typeof window !== "undefined") {
      window.removeEventListener("online", notify);
      window.removeEventListener("offline", notify);
    }
  };
}

export function markUnreachable(): void {
  notify();
}
