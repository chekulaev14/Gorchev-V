import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import type { WorkerRole } from "./types";

// --- Types ---

export interface AuthContext {
  actorId: string;
  role: WorkerRole;
  workerId: string | null;
}

interface TokenPayload extends JWTPayload {
  actorId: string;
  role: WorkerRole;
  workerId: string | null;
}

// --- JWT config ---

const JWT_SECRET_RAW = process.env.JWT_SECRET;
if (!JWT_SECRET_RAW) {
  throw new Error("JWT_SECRET environment variable is required");
}
const JWT_SECRET = new TextEncoder().encode(JWT_SECRET_RAW);

const COOKIE_NAME = "erp_session";

const TTL_BY_ROLE: Record<WorkerRole, string> = {
  WORKER: "15m",
  WAREHOUSE: "10h",
  DIRECTOR: "10h",
  ADMIN: "10h",
};

// --- RBAC policy ---

interface RouteRule {
  pattern: RegExp;
  methods: string[];
  roles: WorkerRole[];
}

const PUBLIC_ROUTES: RegExp[] = [
  /^\/api\/auth\/login$/,
  /^\/api\/terminal\/auth$/,
  /^\/api\/auth\/logout$/,
  /^\/api\/health(\/.*)?$/,
];

const ROUTE_RULES: RouteRule[] = [
  // Terminal
  { pattern: /^\/api\/terminal\/output$/, methods: ["POST"], roles: ["WORKER", "WAREHOUSE", "DIRECTOR", "ADMIN"] },
  { pattern: /^\/api\/terminal\/catalog$/, methods: ["GET"], roles: ["WORKER", "WAREHOUSE", "DIRECTOR", "ADMIN"] },
  { pattern: /^\/api\/terminal\/logs$/, methods: ["GET"], roles: ["DIRECTOR", "ADMIN"] },

  // Nomenclature
  { pattern: /^\/api\/nomenclature(\/[^/]+)?$/, methods: ["GET"], roles: ["WAREHOUSE", "DIRECTOR", "ADMIN"] },
  { pattern: /^\/api\/nomenclature$/, methods: ["POST"], roles: ["WAREHOUSE", "DIRECTOR", "ADMIN"] },
  { pattern: /^\/api\/nomenclature\/[^/]+$/, methods: ["PUT", "DELETE", "PATCH"], roles: ["WAREHOUSE", "DIRECTOR", "ADMIN"] },

  // Stock
  { pattern: /^\/api\/stock$/, methods: ["GET", "POST"], roles: ["WAREHOUSE", "DIRECTOR", "ADMIN"] },

  // BOM
  { pattern: /^\/api\/bom$/, methods: ["GET", "POST", "PUT", "DELETE"], roles: ["WAREHOUSE", "DIRECTOR", "ADMIN"] },

  // Product create
  { pattern: /^\/api\/product-create$/, methods: ["POST"], roles: ["WAREHOUSE", "DIRECTOR", "ADMIN"] },

  // Workers
  { pattern: /^\/api\/workers$/, methods: ["GET"], roles: ["WAREHOUSE", "DIRECTOR", "ADMIN"] },
  { pattern: /^\/api\/workers$/, methods: ["POST", "PUT", "DELETE"], roles: ["DIRECTOR", "ADMIN"] },

  // Processes
  { pattern: /^\/api\/processes$/, methods: ["GET"], roles: ["WAREHOUSE", "DIRECTOR", "ADMIN"] },
  { pattern: /^\/api\/processes$/, methods: ["POST", "PUT", "DELETE"], roles: ["DIRECTOR", "ADMIN"] },

  // Production orders
  { pattern: /^\/api\/production-orders$/, methods: ["GET"], roles: ["WAREHOUSE", "DIRECTOR", "ADMIN"] },
  { pattern: /^\/api\/production-orders$/, methods: ["POST"], roles: ["WAREHOUSE", "DIRECTOR", "ADMIN"] },

  // Users (ADMIN only)
  { pattern: /^\/api\/users(\/[^/]+)?$/, methods: ["GET"], roles: ["ADMIN"] },
  { pattern: /^\/api\/users$/, methods: ["POST"], roles: ["ADMIN"] },
  { pattern: /^\/api\/users\/[^/]+$/, methods: ["PUT", "DELETE"], roles: ["ADMIN"] },

  // Config
  { pattern: /^\/api\/config$/, methods: ["GET"], roles: ["WAREHOUSE", "DIRECTOR", "ADMIN"] },
  { pattern: /^\/api\/config$/, methods: ["PUT"], roles: ["ADMIN"] },

  // Auth
  { pattern: /^\/api\/auth\/me$/, methods: ["GET"], roles: ["WORKER", "WAREHOUSE", "DIRECTOR", "ADMIN"] },
];

// --- Functions ---

export function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some((r) => r.test(pathname));
}

export function checkAccess(pathname: string, method: string, role: WorkerRole): "ok" | "forbidden" {
  const rule = ROUTE_RULES.find(
    (r) => r.pattern.test(pathname) && r.methods.includes(method.toUpperCase()),
  );
  if (!rule) return "forbidden";
  return rule.roles.includes(role) ? "ok" : "forbidden";
}

export async function createToken(ctx: AuthContext): Promise<string> {
  const ttl = TTL_BY_ROLE[ctx.role];
  return new SignJWT({
    actorId: ctx.actorId,
    role: ctx.role,
    workerId: ctx.workerId,
  } satisfies TokenPayload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(ttl)
    .sign(JWT_SECRET);
}

export async function verifyToken(token: string): Promise<AuthContext | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const p = payload as TokenPayload;
    if (!p.actorId || !p.role) return null;
    return {
      actorId: p.actorId,
      role: p.role,
      workerId: p.workerId ?? null,
    };
  } catch {
    return null;
  }
}

export function getCookieName(): string {
  return COOKIE_NAME;
}

export function buildCookieHeader(token: string, role: WorkerRole): string {
  const maxAgeSeconds = role === "WORKER" ? 15 * 60 : 10 * 60 * 60;
  return `${COOKIE_NAME}=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${maxAgeSeconds}`;
}

export function buildLogoutCookieHeader(): string {
  return `${COOKIE_NAME}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`;
}
