import type { AuthContext } from "@/lib/auth";
import type { WorkerRole } from "@/lib/types";

export function getAuthContext(request: Request): AuthContext {
  const actorId = request.headers.get("x-actor-id") ?? "";
  const role = (request.headers.get("x-actor-role") ?? "WORKER") as WorkerRole;
  const workerId = request.headers.get("x-worker-id") ?? null;

  return { actorId, role, workerId };
}
