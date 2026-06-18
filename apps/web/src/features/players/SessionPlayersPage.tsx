import { redirect } from "@tanstack/react-router";

/** Legacy route — redirects to the live dashboard. */
export function SessionPlayersPage() {
  return null;
}

export function redirectSessionPlayersToDashboard(sessionId: string): never {
  throw redirect({
    to: "/organizer/sessions/$sessionId/dashboard",
    params: { sessionId },
  });
}
