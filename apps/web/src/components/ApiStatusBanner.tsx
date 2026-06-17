import { useQuery } from "@tanstack/react-query";
import { fetchHealth } from "../lib/api";

export function ApiStatusBanner() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["health"],
    queryFn: fetchHealth,
    retry: false,
    staleTime: 30_000,
  });

  if (isLoading) {
    return (
      <p className="mb-4 rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
        Checking API…
      </p>
    );
  }

  if (isError || !data) {
    return (
      <p className="mb-4 rounded-md border border-warning/30 bg-amber-50 px-3 py-2 text-sm text-warning">
        API unreachable — local-first mode will still work offline in later phases.
      </p>
    );
  }

  return (
    <p className="mb-4 rounded-md border border-success/30 bg-emerald-50 px-3 py-2 text-sm text-success">
      API healthy ({data.meta.serverTime})
    </p>
  );
}
