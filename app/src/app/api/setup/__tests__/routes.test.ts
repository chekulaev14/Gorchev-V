import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/setup/load/route";
import { POST as validatePOST } from "@/app/api/setup/validate/route";
import { POST as importPOST } from "@/app/api/setup/import/route";
import { createItem, createStockBalance, ensureProcess, cleanup, prisma } from "@/__tests__/helpers/db";

// Helper: create NextRequest for GET
function makeGetRequest(url: string): NextRequest {
  return new NextRequest(new URL(url, "http://localhost:3000"));
}

// Helper: create NextRequest for POST with JSON body
function makePostRequest(url: string, body: unknown): NextRequest {
  return new NextRequest(new URL(url, "http://localhost:3000"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeAll(async () => {
  await ensureProcess("cutting", "Резка");
});

afterEach(async () => {
  await cleanup();
});

// ============================================================
// GET /api/setup/load
// ============================================================

describe("GET /api/setup/load", () => {
  it("200 — nomenclature returns rows array", async () => {
    const res = await GET(makeGetRequest("/api/setup/load?tab=nomenclature"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.rows)).toBe(true);
  });

  it("200 — stock returns rows array", async () => {
    const res = await GET(makeGetRequest("/api/setup/load?tab=stock"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.rows)).toBe(true);
  });

  it("200 — bom returns rows array", async () => {
    const res = await GET(makeGetRequest("/api/setup/load?tab=bom"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.rows)).toBe(true);
  });

  it("200 — routing returns rows array", async () => {
    const res = await GET(makeGetRequest("/api/setup/load?tab=routing"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.rows)).toBe(true);
  });

  it("400 — missing tab", async () => {
    const res = await GET(makeGetRequest("/api/setup/load"));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBeTruthy();
  });

  it("400 — invalid tab", async () => {
    const res = await GET(makeGetRequest("/api/setup/load?tab=badtab"));
    expect(res.status).toBe(400);
  });
});

// ============================================================
// POST /api/setup/validate
// ============================================================

describe("POST /api/setup/validate", () => {
  it("200 — valid nomenclature payload", async () => {
    const res = await validatePOST(
      makePostRequest("/api/setup/validate", {
        tab: "nomenclature",
        rows: [{ name: "Test", type: "blank", unit: "pcs" }],
      }),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.valid).toBe(true);
    expect(data.errors).toBeDefined();
    expect(data.summary).toBeDefined();
    expect(data.estimatedChanges).toBeDefined();
    expect(data.summary.totalRows).toBe(1);
  });

  it("200 — response shape: errors array, summary, estimatedChanges", async () => {
    const item = await createItem({ type: "material" });
    const res = await validatePOST(
      makePostRequest("/api/setup/validate", {
        tab: "stock",
        rows: [{ itemCode: item.code, qty: 10, mode: "income" }],
      }),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.errors)).toBe(true);
    expect(data.summary).toHaveProperty("totalRows");
    expect(data.summary).toHaveProperty("validRows");
    expect(data.summary).toHaveProperty("errorRows");
    expect(data.summary).toHaveProperty("deleteRows");
    expect(data.estimatedChanges).toHaveProperty("rows");
    expect(data.estimatedChanges.rows).toHaveProperty("create");
    expect(data.estimatedChanges.rows).toHaveProperty("update");
    expect(data.estimatedChanges.rows).toHaveProperty("delete");
    expect(data.estimatedChanges.rows).toHaveProperty("noop");
  });

  it("400 — invalid tab", async () => {
    const res = await validatePOST(
      makePostRequest("/api/setup/validate", { tab: "badtab", rows: [{}] }),
    );
    expect(res.status).toBe(400);
  });

  it("400 — empty rows", async () => {
    const res = await validatePOST(
      makePostRequest("/api/setup/validate", { tab: "nomenclature", rows: [] }),
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/пуст/i);
  });

  it("400 — maxRows exceeded", async () => {
    const rows = Array.from({ length: 2001 }, () => ({ name: "x" }));
    const res = await validatePOST(
      makePostRequest("/api/setup/validate", { tab: "nomenclature", rows }),
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/лимит/i);
  });

  it("200 — validation errors in payload return valid=false", async () => {
    const res = await validatePOST(
      makePostRequest("/api/setup/validate", {
        tab: "nomenclature",
        rows: [{ name: "", type: "bad", unit: "bad" }],
      }),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.valid).toBe(false);
    expect(data.errors.length).toBeGreaterThan(0);
    // Error shape: {row, column?, message}
    for (const err of data.errors) {
      expect(err).toHaveProperty("row");
      expect(err).toHaveProperty("message");
    }
  });
});

// ============================================================
// POST /api/setup/import
// ============================================================

describe("POST /api/setup/import", () => {
  it("200 — successful import", async () => {
    const res = await importPOST(
      makePostRequest("/api/setup/import", {
        tab: "nomenclature",
        rows: [{ name: "API Import Test", type: "material", unit: "kg" }],
      }),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data).toHaveProperty("imported");
    expect(data).toHaveProperty("updated");
    expect(data).toHaveProperty("deleted");
    expect(data).toHaveProperty("skipped");
    expect(data.imported).toBe(1);

    // Cleanup
    const created = await prisma.item.findFirst({ where: { name: "API Import Test" } });
    if (created) await prisma.item.delete({ where: { id: created.id } });
  });

  it("400 — invalid tab", async () => {
    const res = await importPOST(
      makePostRequest("/api/setup/import", { tab: "badtab", rows: [{}] }),
    );
    expect(res.status).toBe(400);
  });

  it("400 — empty rows", async () => {
    const res = await importPOST(
      makePostRequest("/api/setup/import", { tab: "nomenclature", rows: [] }),
    );
    expect(res.status).toBe(400);
  });

  it("400 — validation errors prevent import", async () => {
    const res = await importPOST(
      makePostRequest("/api/setup/import", {
        tab: "stock",
        rows: [{ itemCode: "NONEXIST-999", qty: 10, mode: "income" }],
      }),
    );
    // Import re-validates, should get error
    expect(res.status).toBe(400);
  });

  it("400 — maxRows exceeded", async () => {
    const rows = Array.from({ length: 2001 }, () => ({ name: "x" }));
    const res = await importPOST(
      makePostRequest("/api/setup/import", { tab: "nomenclature", rows }),
    );
    expect(res.status).toBe(400);
  });
});
