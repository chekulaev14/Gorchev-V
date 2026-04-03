# Constructor Chains (Routing 3) Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a visual chain constructor overlay to warehouse-v2 that saves drafts to DB and publishes into real Item/Routing/RoutingStep/RoutingStepInput records.

**Architecture:** New `ConstructorDraft` table stores graph JSON. Drafts CRUD via dedicated service + API. Publish converts graph to Routing in one transaction. Frontend overlay with dagre-based canvas, adapted from CONSTRUCTOR-PIPELINE-V2.html prototype.

**Tech Stack:** Next.js App Router, React, TypeScript, Zod, Prisma, @dagrejs/dagre, Tailwind CSS

**Spec:** `docs/superpowers/specs/2026-04-03-routing-3-constructor-design.md`

---

## File Structure

### Database
- Modify: `app/prisma/schema.prisma` — add ConstructorDraftStatus enum + ConstructorDraft model

### Backend
- Create: `app/src/lib/schemas/constructor-draft.schema.ts` — zod schemas for draft CRUD
- Create: `app/src/services/constructor-draft.service.ts` — CRUD for drafts
- Create: `app/src/services/constructor-publish.service.ts` — transactional publish
- Create: `app/src/services/helpers/graph-to-steps.ts` — graph → RoutingStep conversion
- Create: `app/src/app/api/constructor-drafts/route.ts` — GET list + POST create
- Create: `app/src/app/api/constructor-drafts/[id]/route.ts` — GET/PUT/DELETE single draft
- Create: `app/src/app/api/constructor-drafts/[id]/publish/route.ts` — POST publish

### Frontend
- Modify: `app/src/components/warehouse-v2/layout/Sidebar.tsx` — add constructor menu item
- Create: `app/src/components/warehouse-v2/constructor/constructor-types.ts`
- Create: `app/src/components/warehouse-v2/constructor/constructor-graph-utils.ts`
- Create: `app/src/components/warehouse-v2/constructor/constructor-adapter.ts`
- Create: `app/src/components/warehouse-v2/constructor/use-constructor.ts`
- Create: `app/src/components/warehouse-v2/constructor/ConstructorOverlay.tsx`
- Create: `app/src/components/warehouse-v2/constructor/ConstructorHeader.tsx`
- Create: `app/src/components/warehouse-v2/constructor/ConstructorSidebar.tsx`
- Create: `app/src/components/warehouse-v2/constructor/ConstructorCanvas.tsx`
- Create: `app/src/components/warehouse-v2/constructor/ConstructorNode.tsx`
- Create: `app/src/components/warehouse-v2/constructor/ConstructorInspector.tsx`
- Create: `app/src/components/warehouse-v2/constructor/ConstructorStatusBar.tsx`
- Create: `app/src/components/warehouse-v2/constructor/AddNodeForm.tsx`

---

## Task 1: Database Migration

**Files:**
- Modify: `app/prisma/schema.prisma`

- [ ] **Step 1: Add enum and model to schema**

Add at the end of the enums section in `app/prisma/schema.prisma`:

```prisma
enum ConstructorDraftStatus {
  DRAFT
  PUBLISHED
}
```

Add before the closing of the file:

```prisma
// Черновики конструктора цепочек
model ConstructorDraft {
  id          String                 @id @default(cuid())
  name        String
  status      ConstructorDraftStatus @default(DRAFT)
  state       Json
  routingId   String?                @map("routing_id")
  createdById String?                @map("created_by_id")
  createdAt   DateTime               @default(now()) @map("created_at")
  updatedAt   DateTime               @updatedAt @map("updated_at")

  routing   Routing? @relation(fields: [routingId], references: [id])
  createdBy User?    @relation(fields: [createdById], references: [id])

  @@map("constructor_drafts")
}
```

Also add `constructorDrafts ConstructorDraft[]` to the `Routing` model's relations and to the `User` model's relations.

- [ ] **Step 2: Run migration**

Run: `cd app && npx prisma migrate dev --name add-constructor-drafts`

Expected: Migration created and applied successfully.

- [ ] **Step 3: Generate Prisma client**

Run: `cd app && npx prisma generate`

Expected: Prisma client generated.

- [ ] **Step 4: Commit**

```bash
cd /Users/petrcekulaev/Desktop/ERP
git add app/prisma/schema.prisma app/prisma/migrations/
git commit -m "feat(db): add ConstructorDraft model for chain constructor"
```

---

## Task 2: Zod Schema for Draft CRUD

**Files:**
- Create: `app/src/lib/schemas/constructor-draft.schema.ts`

- [ ] **Step 1: Create the schema file**

Create `app/src/lib/schemas/constructor-draft.schema.ts`:

```ts
import { z } from "zod";

const draftItemSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["material", "blank", "product"]),
  unit: z.enum(["kg", "pcs", "m"]),
  side: z.enum(["LEFT", "RIGHT", "NONE"]),
  pricePerUnit: z.number().nonnegative().optional(),
});

const nodeSchema = z.discriminatedUnion("source", [
  z.object({
    id: z.string().min(1),
    source: z.literal("existing"),
    itemId: z.string().min(1),
    x: z.number(),
    y: z.number(),
    side: z.enum(["LEFT", "RIGHT", "NONE"]),
  }),
  z.object({
    id: z.string().min(1),
    source: z.literal("new"),
    draftItem: draftItemSchema,
    x: z.number(),
    y: z.number(),
    side: z.enum(["LEFT", "RIGHT", "NONE"]),
  }),
]);

const edgeSchema = z.object({
  id: z.string().min(1),
  sourceNodeId: z.string().min(1),
  targetNodeId: z.string().min(1),
  qty: z.number().positive(),
  sortOrder: z.number().int().min(0),
});

const constructorStateSchema = z.object({
  nodes: z.array(nodeSchema),
  edges: z.array(edgeSchema),
  productNodeId: z.string().min(1),
});

export const createDraftSchema = z.object({
  name: z.string().min(1),
  state: constructorStateSchema,
});

export const updateDraftSchema = z.object({
  name: z.string().min(1).optional(),
  state: constructorStateSchema.optional(),
});

export type ConstructorState = z.infer<typeof constructorStateSchema>;
export type CreateDraftInput = z.infer<typeof createDraftSchema>;
export type UpdateDraftInput = z.infer<typeof updateDraftSchema>;
```

- [ ] **Step 2: Run lint**

Run: `cd app && npx eslint src/lib/schemas/constructor-draft.schema.ts`

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/src/lib/schemas/constructor-draft.schema.ts
git commit -m "feat: add zod schema for constructor drafts"
```

---

## Task 3: Graph-to-Steps Conversion Utility

**Files:**
- Create: `app/src/services/helpers/graph-to-steps.ts`

This is the core algorithm: converts a constructor graph (nodes + edges) into a linear RoutingStep sequence.

- [ ] **Step 1: Create graph-to-steps.ts**

Create `app/src/services/helpers/graph-to-steps.ts`:

```ts
import type { ConstructorState } from "@/lib/schemas/constructor-draft.schema";
import { ServiceError } from "@/lib/api/handle-route-error";

export interface ConvertedStep {
  stepNo: number;
  outputNodeId: string;
  outputQty: number;
  inputs: Array<{
    sourceNodeId: string;
    qty: number;
    sortOrder: number;
  }>;
}

export function graphToSteps(state: ConstructorState): ConvertedStep[] {
  const { nodes, edges, productNodeId } = state;
  const nodesById = new Map(nodes.map((n) => [n.id, n]));

  // Build adjacency maps
  const incomingByTarget = new Map<string, typeof edges>();
  const outgoingBySource = new Map<string, typeof edges>();
  for (const e of edges) {
    if (!incomingByTarget.has(e.targetNodeId)) incomingByTarget.set(e.targetNodeId, []);
    incomingByTarget.get(e.targetNodeId)!.push(e);
    if (!outgoingBySource.has(e.sourceNodeId)) outgoingBySource.set(e.sourceNodeId, []);
    outgoingBySource.get(e.sourceNodeId)!.push(e);
  }

  // Step nodes = nodes with incoming edges (not raw materials)
  const stepNodes = nodes.filter((n) => (incomingByTarget.get(n.id) || []).length > 0);
  if (stepNodes.length === 0) {
    throw new ServiceError("Цепочка должна содержать хотя бы один шаг (узел с входами)", 400);
  }

  // Topological sort by depth from roots
  function depth(id: string, visited: Set<string>): number {
    if (visited.has(id)) return 0;
    visited.add(id);
    const inc = incomingByTarget.get(id) || [];
    if (inc.length === 0) return 0;
    return 1 + Math.max(...inc.map((e) => depth(e.sourceNodeId, visited)));
  }

  const sorted = [...stepNodes].sort((a, b) => depth(a.id, new Set()) - depth(b.id, new Set()));

  // Assign stepNo and build steps
  const steps: ConvertedStep[] = sorted.map((node, idx) => {
    const inc = [...(incomingByTarget.get(node.id) || [])].sort((a, b) => a.sortOrder - b.sortOrder);
    return {
      stepNo: idx + 1,
      outputNodeId: node.id,
      outputQty: 1,
      inputs: inc.map((e) => ({
        sourceNodeId: e.sourceNodeId,
        qty: e.qty,
        sortOrder: e.sortOrder,
      })),
    };
  });

  // Validate: last step must output the product node
  const lastStep = steps[steps.length - 1];
  if (lastStep.outputNodeId !== productNodeId) {
    throw new ServiceError("Последний шаг должен быть конечным изделием", 400);
  }

  return steps;
}
```

- [ ] **Step 2: Run lint**

Run: `cd app && npx eslint src/services/helpers/graph-to-steps.ts`

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/src/services/helpers/graph-to-steps.ts
git commit -m "feat: add graph-to-steps conversion for constructor"
```

---

## Task 4: Draft CRUD Service

**Files:**
- Create: `app/src/services/constructor-draft.service.ts`

- [ ] **Step 1: Create the service**

Create `app/src/services/constructor-draft.service.ts`:

```ts
import { prisma } from "@/lib/prisma";
import { ServiceError } from "@/lib/api/handle-route-error";
import { log } from "@/lib/logger";
import type { CreateDraftInput, UpdateDraftInput } from "@/lib/schemas/constructor-draft.schema";

export async function getDrafts() {
  log.info("constructor-draft: getDrafts");
  return prisma.constructorDraft.findMany({
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      status: true,
      routingId: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

export async function getDraft(id: string) {
  const draft = await prisma.constructorDraft.findUnique({ where: { id } });
  if (!draft) throw new ServiceError("Черновик не найден", 404);
  return draft;
}

export async function createDraft(input: CreateDraftInput, userId?: string) {
  log.info("constructor-draft: createDraft", { name: input.name });
  return prisma.constructorDraft.create({
    data: {
      name: input.name,
      state: input.state as object,
      createdById: userId ?? null,
    },
  });
}

export async function updateDraft(id: string, input: UpdateDraftInput) {
  const draft = await prisma.constructorDraft.findUnique({ where: { id } });
  if (!draft) throw new ServiceError("Черновик не найден", 404);
  if (draft.status !== "DRAFT") {
    throw new ServiceError("Можно редактировать только черновик", 400);
  }

  log.info("constructor-draft: updateDraft", { id });
  return prisma.constructorDraft.update({
    where: { id },
    data: {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.state !== undefined && { state: input.state as object }),
    },
  });
}

export async function deleteDraft(id: string) {
  const draft = await prisma.constructorDraft.findUnique({ where: { id } });
  if (!draft) throw new ServiceError("Черновик не найден", 404);
  if (draft.status !== "DRAFT") {
    throw new ServiceError("Нельзя удалить опубликованный черновик", 400);
  }

  log.info("constructor-draft: deleteDraft", { id });
  return prisma.constructorDraft.delete({ where: { id } });
}
```

- [ ] **Step 2: Run lint**

Run: `cd app && npx eslint src/services/constructor-draft.service.ts`

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/src/services/constructor-draft.service.ts
git commit -m "feat: add constructor draft CRUD service"
```

---

## Task 5: Publish Service

**Files:**
- Create: `app/src/services/constructor-publish.service.ts`

- [ ] **Step 1: Create the publish service**

Create `app/src/services/constructor-publish.service.ts`:

```ts
import { prisma } from "@/lib/prisma";
import { ServiceError } from "@/lib/api/handle-route-error";
import { log } from "@/lib/logger";
import { getNextCode, toCodeKind } from "@/services/helpers/code-generator";
import { validateRoutingStepsSide } from "@/services/helpers/validate-side";
import { graphToSteps } from "@/services/helpers/graph-to-steps";
import type { ConstructorState } from "@/lib/schemas/constructor-draft.schema";

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

const DEFAULT_PROCESS_ID = "general";

async function ensureDefaultProcess(tx: Tx) {
  const proc = await tx.process.findUnique({ where: { id: DEFAULT_PROCESS_ID } });
  if (!proc) {
    throw new ServiceError(
      `Дефолтный процесс "${DEFAULT_PROCESS_ID}" не найден в БД. Создайте его перед публикацией.`,
      500,
    );
  }
  return proc.id;
}

function validateGraph(state: ConstructorState) {
  const { nodes, edges, productNodeId } = state;

  if (nodes.length === 0) throw new ServiceError("Цепочка пустая", 400);
  if (!nodes.some((n) => n.id === productNodeId)) {
    throw new ServiceError("Конечный продукт не найден в узлах", 400);
  }

  // Check names
  for (const n of nodes) {
    const name = n.source === "existing" ? "(existing)" : n.draftItem?.name;
    if (n.source === "new" && (!n.draftItem?.name || !n.draftItem.name.trim())) {
      throw new ServiceError(`Узел ${n.id}: название не заполнено`, 400);
    }
  }

  // Check no self-loops
  for (const e of edges) {
    if (e.sourceNodeId === e.targetNodeId) {
      throw new ServiceError("Связь на себя запрещена", 400);
    }
  }

  // Check no branching (max 1 outgoing edge per node)
  const outCount = new Map<string, number>();
  for (const e of edges) {
    outCount.set(e.sourceNodeId, (outCount.get(e.sourceNodeId) || 0) + 1);
  }
  for (const [nodeId, count] of outCount) {
    if (count > 1) {
      throw new ServiceError(`Ветвление запрещено: узел ${nodeId} имеет ${count} выходов`, 400);
    }
  }

  // Check no cycles
  const visited = new Set<string>();
  const inStack = new Set<string>();
  const adj = new Map<string, string[]>();
  for (const e of edges) {
    if (!adj.has(e.sourceNodeId)) adj.set(e.sourceNodeId, []);
    adj.get(e.sourceNodeId)!.push(e.targetNodeId);
  }
  function dfs(id: string): boolean {
    visited.add(id);
    inStack.add(id);
    for (const next of adj.get(id) || []) {
      if (inStack.has(next)) return true;
      if (!visited.has(next) && dfs(next)) return true;
    }
    inStack.delete(id);
    return false;
  }
  for (const n of nodes) {
    if (!visited.has(n.id) && dfs(n.id)) {
      throw new ServiceError("В графе есть цикл", 400);
    }
  }

  // Check connectivity from product
  const inMap = new Map<string, string[]>();
  for (const e of edges) {
    if (!inMap.has(e.targetNodeId)) inMap.set(e.targetNodeId, []);
    inMap.get(e.targetNodeId)!.push(e.sourceNodeId);
  }
  const reachable = new Set<string>();
  function walkBack(id: string) {
    if (reachable.has(id)) return;
    reachable.add(id);
    for (const src of inMap.get(id) || []) walkBack(src);
  }
  walkBack(productNodeId);
  for (const n of nodes) {
    if (!reachable.has(n.id)) {
      throw new ServiceError(`Узел "${n.id}" не связан с конечным изделием`, 400);
    }
  }

  // Check qty > 0
  for (const e of edges) {
    if (e.qty <= 0) throw new ServiceError("Количество на связи должно быть > 0", 400);
  }
}

export async function publishDraft(draftId: string) {
  log.info("constructor-publish: start", { draftId });

  return prisma.$transaction(async (tx) => {
    const draft = await tx.constructorDraft.findUnique({ where: { id: draftId } });
    if (!draft) throw new ServiceError("Черновик не найден", 404);

    const state = draft.state as unknown as ConstructorState;
    validateGraph(state);

    const processId = await ensureDefaultProcess(tx);
    const steps = graphToSteps(state);

    // Resolve nodes → itemIds
    const nodeItemMap = new Map<string, string>();
    const createdItems: Array<{ nodeId: string; itemId: string }> = [];

    for (const node of state.nodes) {
      if (node.source === "existing") {
        const item = await tx.item.findUnique({ where: { id: node.itemId } });
        if (!item) throw new ServiceError(`Номенклатура ${node.itemId} не найдена`, 404);
        nodeItemMap.set(node.id, item.id);
      } else {
        const kind = toCodeKind(node.draftItem.type);
        const code = await getNextCode(tx, kind);
        const created = await tx.item.create({
          data: {
            code,
            name: node.draftItem.name,
            typeId: node.draftItem.type,
            unitId: node.draftItem.unit,
            side: node.draftItem.side,
            pricePerUnit: node.draftItem.pricePerUnit ?? null,
            images: [],
          },
        });
        nodeItemMap.set(node.id, created.id);
        createdItems.push({ nodeId: node.id, itemId: created.id });
      }
    }

    const productItemId = nodeItemMap.get(state.productNodeId);
    if (!productItemId) throw new ServiceError("Не удалось определить конечное изделие", 400);

    // Side validation
    const itemsForSide = await tx.item.findMany({
      where: { id: { in: [...nodeItemMap.values()] } },
      select: { id: true, name: true, side: true },
    });
    const sideMap = new Map(itemsForSide.map((i) => [i.id, i]));

    validateRoutingStepsSide(
      steps.map((s) => {
        const outItemId = nodeItemMap.get(s.outputNodeId)!;
        const outItem = sideMap.get(outItemId)!;
        return {
          stepNo: s.stepNo,
          outputItem: { name: outItem.name, side: outItem.side ?? "NONE" },
          inputs: s.inputs.map((inp) => {
            const inpItemId = nodeItemMap.get(inp.sourceNodeId)!;
            const inpItem = sideMap.get(inpItemId)!;
            return { item: { name: inpItem.name, side: inpItem.side ?? "NONE" } };
          }),
        };
      }),
    );

    // Create routing
    const maxVersion = await tx.routing.aggregate({
      where: { itemId: productItemId },
      _max: { version: true },
    });
    const nextVersion = (maxVersion._max.version ?? 0) + 1;

    // Archive previous ACTIVE
    await tx.routing.updateMany({
      where: { itemId: productItemId, status: "ACTIVE" },
      data: { status: "ARCHIVED" },
    });

    const routing = await tx.routing.create({
      data: {
        itemId: productItemId,
        version: nextVersion,
        status: "ACTIVE",
        steps: {
          create: steps.map((s) => ({
            stepNo: s.stepNo,
            processId,
            outputItemId: nodeItemMap.get(s.outputNodeId)!,
            outputQty: s.outputQty,
            inputs: {
              create: s.inputs.map((inp) => ({
                itemId: nodeItemMap.get(inp.sourceNodeId)!,
                qty: inp.qty,
                sortOrder: inp.sortOrder,
              })),
            },
          })),
        },
      },
      include: {
        steps: { include: { inputs: true }, orderBy: { stepNo: "asc" } },
      },
    });

    // Update draft
    await tx.constructorDraft.update({
      where: { id: draftId },
      data: { status: "PUBLISHED", routingId: routing.id },
    });

    log.info("constructor-publish: done", { draftId, routingId: routing.id, createdItems: createdItems.length });
    return { routing, createdItems };
  });
}
```

- [ ] **Step 2: Run lint**

Run: `cd app && npx eslint src/services/constructor-publish.service.ts`

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/src/services/constructor-publish.service.ts
git commit -m "feat: add constructor publish service"
```

---

## Task 6: API Routes

**Files:**
- Create: `app/src/app/api/constructor-drafts/route.ts`
- Create: `app/src/app/api/constructor-drafts/[id]/route.ts`
- Create: `app/src/app/api/constructor-drafts/[id]/publish/route.ts`

- [ ] **Step 1: Create list + create route**

Create `app/src/app/api/constructor-drafts/route.ts`:

```ts
import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/api/handle-route-error";
import { withRequestId } from "@/lib/logger";
import { parseBody } from "@/lib/schemas/helpers";
import { createDraftSchema } from "@/lib/schemas/constructor-draft.schema";
import * as draftService from "@/services/constructor-draft.service";

export const GET = withRequestId(async () => {
  try {
    const drafts = await draftService.getDrafts();
    return NextResponse.json(drafts);
  } catch (err) {
    return handleRouteError(err);
  }
});

export const POST = withRequestId(async (request: Request) => {
  try {
    const body = await request.json();
    const parsed = parseBody(createDraftSchema, body);
    if (!parsed.success) return parsed.response;

    const draft = await draftService.createDraft(parsed.data);
    return NextResponse.json(draft, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
});
```

- [ ] **Step 2: Create single draft route**

Create `app/src/app/api/constructor-drafts/[id]/route.ts`:

```ts
import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/api/handle-route-error";
import { withRequestId } from "@/lib/logger";
import { parseBody } from "@/lib/schemas/helpers";
import { updateDraftSchema } from "@/lib/schemas/constructor-draft.schema";
import * as draftService from "@/services/constructor-draft.service";

type Ctx = { params: Promise<{ id: string }> };

export const GET = withRequestId(async (_request: Request, ctx?: Ctx) => {
  try {
    const { id } = await ctx!.params;
    const draft = await draftService.getDraft(id);
    return NextResponse.json(draft);
  } catch (err) {
    return handleRouteError(err);
  }
});

export const PUT = withRequestId(async (request: Request, ctx?: Ctx) => {
  try {
    const { id } = await ctx!.params;
    const body = await request.json();
    const parsed = parseBody(updateDraftSchema, body);
    if (!parsed.success) return parsed.response;

    const draft = await draftService.updateDraft(id, parsed.data);
    return NextResponse.json(draft);
  } catch (err) {
    return handleRouteError(err);
  }
});

export const DELETE = withRequestId(async (_request: Request, ctx?: Ctx) => {
  try {
    const { id } = await ctx!.params;
    await draftService.deleteDraft(id);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return handleRouteError(err);
  }
});
```

- [ ] **Step 3: Create publish route**

Create `app/src/app/api/constructor-drafts/[id]/publish/route.ts`:

```ts
import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/api/handle-route-error";
import { withRequestId } from "@/lib/logger";
import { publishDraft } from "@/services/constructor-publish.service";

type Ctx = { params: Promise<{ id: string }> };

export const POST = withRequestId(async (_request: Request, ctx?: Ctx) => {
  try {
    const { id } = await ctx!.params;
    const result = await publishDraft(id);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
});
```

- [ ] **Step 4: Run lint on all routes**

Run: `cd app && npx eslint src/app/api/constructor-drafts/`

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add app/src/app/api/constructor-drafts/
git commit -m "feat: add constructor drafts API routes"
```

---

## Task 7: Install dagre + Frontend Types & Utils

**Files:**
- Create: `app/src/components/warehouse-v2/constructor/constructor-types.ts`
- Create: `app/src/components/warehouse-v2/constructor/constructor-graph-utils.ts`
- Create: `app/src/components/warehouse-v2/constructor/constructor-adapter.ts`

- [ ] **Step 1: Install dagre**

Run: `cd app && npm install @dagrejs/dagre`

- [ ] **Step 2: Create constructor-types.ts**

Create `app/src/components/warehouse-v2/constructor/constructor-types.ts`:

```ts
export interface DraftItem {
  name: string;
  type: "material" | "blank" | "product";
  unit: "kg" | "pcs" | "m";
  side: "LEFT" | "RIGHT" | "NONE";
  pricePerUnit?: number;
}

export interface CNode {
  id: string;
  source: "existing" | "new";
  itemId?: string;
  draftItem?: DraftItem;
  x: number;
  y: number;
  side: "LEFT" | "RIGHT" | "NONE";
}

export interface CEdge {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  qty: number;
  sortOrder: number;
}

export type NodeItemType = "material" | "blank" | "product";

export interface ConstructorGraph {
  nodes: CNode[];
  edges: CEdge[];
  productNodeId: string;
}

export interface DraftListItem {
  id: string;
  name: string;
  status: "DRAFT" | "PUBLISHED";
  routingId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ValidationError {
  code: string;
  message: string;
  nodeId?: string;
}
```

- [ ] **Step 3: Create constructor-graph-utils.ts**

Create `app/src/components/warehouse-v2/constructor/constructor-graph-utils.ts`:

Adapt the core graph logic from `CONSTRUCTOR-PIPELINE-V2.html` (lines 314–482): `buildDerivedMaps`, `computeItemTypes`, `normalizeGraph`, `wouldCreateCycle`, `buildTreeList`, `recalcSortOrders`. Convert from `htm` to plain TypeScript functions. These are pure functions, no React dependency.

```ts
import type { CNode, CEdge, NodeItemType, ValidationError } from "./constructor-types";

export function computeItemTypes(
  nodes: CNode[],
  edges: CEdge[],
): Map<string, NodeItemType> {
  const inMap = new Map<string, CEdge[]>();
  const outMap = new Map<string, CEdge[]>();
  for (const e of edges) {
    if (!inMap.has(e.targetNodeId)) inMap.set(e.targetNodeId, []);
    inMap.get(e.targetNodeId)!.push(e);
    if (!outMap.has(e.sourceNodeId)) outMap.set(e.sourceNodeId, []);
    outMap.get(e.sourceNodeId)!.push(e);
  }

  const types = new Map<string, NodeItemType>();
  const terminals: string[] = [];

  for (const n of nodes) {
    const hasIn = (inMap.get(n.id) || []).length > 0;
    const hasOut = (outMap.get(n.id) || []).length > 0;
    if (!hasIn) types.set(n.id, "material");
    else if (hasOut) types.set(n.id, "blank");
    else terminals.push(n.id);
  }

  if (terminals.length <= 1) {
    terminals.forEach((id) => types.set(id, "product"));
  } else {
    function depth(id: string, visited: Set<string>): number {
      if (visited.has(id)) return 0;
      visited.add(id);
      const inc = inMap.get(id) || [];
      if (inc.length === 0) return 0;
      return 1 + Math.max(...inc.map((e) => depth(e.sourceNodeId, visited)));
    }
    let maxD = -1;
    let productId = terminals[0];
    for (const id of terminals) {
      const d = depth(id, new Set());
      if (d > maxD) { maxD = d; productId = id; }
    }
    terminals.forEach((id) => types.set(id, id === productId ? "product" : "blank"));
  }

  return types;
}

export function wouldCreateCycle(sourceId: string, targetId: string, edges: CEdge[]): boolean {
  const visited = new Set<string>();
  function dfs(current: string): boolean {
    if (current === sourceId) return true;
    if (visited.has(current)) return false;
    visited.add(current);
    for (const e of edges) {
      if (e.sourceNodeId === current && dfs(e.targetNodeId)) return true;
    }
    return false;
  }
  return dfs(targetId);
}

export function validateGraph(
  name: string,
  nodes: CNode[],
  edges: CEdge[],
): ValidationError[] {
  const errors: ValidationError[] = [];
  if (!name.trim()) errors.push({ code: "E_NAME_REQUIRED", message: "Название цепочки не заполнено" });
  if (nodes.length === 0) return errors;

  // Node names
  for (const n of nodes) {
    const nodeName = n.source === "existing" ? n.itemId : n.draftItem?.name;
    if (n.source === "new" && (!n.draftItem?.name || !n.draftItem.name.trim())) {
      errors.push({ code: "E_NODE_NAME", message: "Название не заполнено", nodeId: n.id });
    }
  }

  // Self-loops
  for (const e of edges) {
    if (e.sourceNodeId === e.targetNodeId) {
      errors.push({ code: "E_SELF_LOOP", message: "Связь на себя", nodeId: e.sourceNodeId });
    }
  }

  // Branching
  const outCount = new Map<string, number>();
  for (const e of edges) outCount.set(e.sourceNodeId, (outCount.get(e.sourceNodeId) || 0) + 1);
  for (const [nodeId, count] of outCount) {
    if (count > 1) errors.push({ code: "E_BRANCHING", message: "Ветвление запрещено", nodeId });
  }

  // Qty
  for (const e of edges) {
    if (e.qty <= 0) errors.push({ code: "E_QTY", message: "Количество должно быть > 0", nodeId: e.targetNodeId });
  }

  // Cycle detection
  const W = 0, G = 1, B = 2;
  const color: Record<string, number> = {};
  nodes.forEach((n) => { color[n.id] = W; });
  let hasCycle = false;
  const adj = new Map<string, string[]>();
  for (const e of edges) {
    if (!adj.has(e.sourceNodeId)) adj.set(e.sourceNodeId, []);
    adj.get(e.sourceNodeId)!.push(e.targetNodeId);
  }
  function dfs(id: string) {
    color[id] = G;
    for (const next of adj.get(id) || []) {
      if (color[next] === G) { hasCycle = true; return; }
      if (color[next] === W) dfs(next);
      if (hasCycle) return;
    }
    color[id] = B;
  }
  nodes.forEach((n) => { if (color[n.id] === W) dfs(n.id); });
  if (hasCycle) errors.push({ code: "E_CYCLE", message: "В графе есть цикл" });

  // Connectivity
  const inMap = new Map<string, string[]>();
  for (const e of edges) {
    if (!inMap.has(e.targetNodeId)) inMap.set(e.targetNodeId, []);
    inMap.get(e.targetNodeId)!.push(e.sourceNodeId);
  }
  const outSet = new Set(edges.map((e) => e.sourceNodeId));
  const inSet = new Set(edges.map((e) => e.targetNodeId));
  const finals = nodes.filter((n) => inSet.has(n.id) && !outSet.has(n.id));
  if (finals.length === 0 && nodes.some((n) => inSet.has(n.id))) {
    errors.push({ code: "E_NO_PRODUCT", message: "Нет конечного изделия" });
  }
  if (finals.length > 1) {
    errors.push({ code: "E_MULTI_PRODUCT", message: "Несколько конечных изделий" });
  }
  if (finals.length === 1) {
    const reach = new Set<string>();
    function wb(id: string) {
      if (reach.has(id)) return;
      reach.add(id);
      for (const src of inMap.get(id) || []) wb(src);
    }
    wb(finals[0].id);
    for (const n of nodes) {
      if (!reach.has(n.id)) {
        errors.push({ code: "E_DISCONNECTED", message: `Узел не связан с изделием`, nodeId: n.id });
      }
    }
  }

  return errors;
}

export function recalcSortOrders(edges: CEdge[]): CEdge[] {
  const byTarget = new Map<string, CEdge[]>();
  for (const e of edges) {
    if (!byTarget.has(e.targetNodeId)) byTarget.set(e.targetNodeId, []);
    byTarget.get(e.targetNodeId)!.push(e);
  }
  const result: CEdge[] = [];
  byTarget.forEach((group) => {
    group.sort((a, b) => a.sortOrder - b.sortOrder);
    group.forEach((e, i) => result.push({ ...e, sortOrder: (i + 1) * 10 }));
  });
  const ids = new Set(result.map((e) => e.id));
  edges.forEach((e) => { if (!ids.has(e.id)) result.push(e); });
  return result;
}
```

- [ ] **Step 4: Create constructor-adapter.ts**

Create `app/src/components/warehouse-v2/constructor/constructor-adapter.ts`:

```ts
import type { CNode, CEdge, ConstructorGraph } from "./constructor-types";
import type { CreateDraftInput, UpdateDraftInput } from "@/lib/schemas/constructor-draft.schema";

export function toCreatePayload(name: string, graph: ConstructorGraph): CreateDraftInput {
  return {
    name,
    state: {
      nodes: graph.nodes.map((n) =>
        n.source === "existing"
          ? { id: n.id, source: "existing" as const, itemId: n.itemId!, x: n.x, y: n.y, side: n.side }
          : { id: n.id, source: "new" as const, draftItem: n.draftItem!, x: n.x, y: n.y, side: n.side },
      ),
      edges: graph.edges,
      productNodeId: graph.productNodeId,
    },
  };
}

export function toUpdatePayload(name: string, graph: ConstructorGraph): UpdateDraftInput {
  return {
    name,
    state: {
      nodes: graph.nodes.map((n) =>
        n.source === "existing"
          ? { id: n.id, source: "existing" as const, itemId: n.itemId!, x: n.x, y: n.y, side: n.side }
          : { id: n.id, source: "new" as const, draftItem: n.draftItem!, x: n.x, y: n.y, side: n.side },
      ),
      edges: graph.edges,
      productNodeId: graph.productNodeId,
    },
  };
}
```

- [ ] **Step 5: Run lint**

Run: `cd app && npx eslint src/components/warehouse-v2/constructor/`

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add app/package.json app/package-lock.json app/src/components/warehouse-v2/constructor/constructor-types.ts app/src/components/warehouse-v2/constructor/constructor-graph-utils.ts app/src/components/warehouse-v2/constructor/constructor-adapter.ts
git commit -m "feat: add constructor types, graph utils, and adapter"
```

---

## Task 8: useConstructor Hook

**Files:**
- Create: `app/src/components/warehouse-v2/constructor/use-constructor.ts`

The main state management hook. Manages nodes/edges, undo/redo, selection, validation. Adapted from `CONSTRUCTOR-PIPELINE-V2.html` AppInner state logic (lines 762-1213).

- [ ] **Step 1: Create use-constructor.ts**

Create `app/src/components/warehouse-v2/constructor/use-constructor.ts`:

This hook exports:
- `nodes`, `edges`, `chainName`, `selectedId`, `errors`, `itemTypes`
- `setChainName`, `setSelectedId`
- `addNode(targetId, position, name, qty, nodeType)`, `deleteNode(id)`, `connectNodes(fromId, toId)`
- `updateNodeName(id, name)`, `updateNodeSide(id, side)`, `updateEdgeQty(edgeId, qty)`
- `undo()`, `redo()`, `canUndo`, `canRedo`
- `loadGraph(graph)`, `getGraph(): ConstructorGraph`
- `clear()`

Implement using `useState` + history ref pattern from the prototype. Call `validateGraph` and `computeItemTypes` in `useMemo`.

The hook is ~200 lines. Adapt directly from prototype's `AppInner` state management (lines 762-1108), converting from `htm` to TypeScript. Remove localStorage autosave (we save to DB). Remove chain tabs logic (handled in overlay).

- [ ] **Step 2: Run lint**

Run: `cd app && npx eslint src/components/warehouse-v2/constructor/use-constructor.ts`

- [ ] **Step 3: Commit**

```bash
git add app/src/components/warehouse-v2/constructor/use-constructor.ts
git commit -m "feat: add useConstructor hook"
```

---

## Task 9: Presentation Components

**Files:**
- Create: `app/src/components/warehouse-v2/constructor/ConstructorNode.tsx`
- Create: `app/src/components/warehouse-v2/constructor/ConstructorStatusBar.tsx`
- Create: `app/src/components/warehouse-v2/constructor/ConstructorHeader.tsx`
- Create: `app/src/components/warehouse-v2/constructor/ConstructorInspector.tsx`
- Create: `app/src/components/warehouse-v2/constructor/ConstructorSidebar.tsx`
- Create: `app/src/components/warehouse-v2/constructor/AddNodeForm.tsx`

All presentation components — receive data via props, no API calls.

- [ ] **Step 1: Create ConstructorNode.tsx**

Adapt from prototype's `PipelineNode` (lines 526-556). Render node with type badge, side badge, name, inputs with qty fields, plus buttons, delete button, error dot. Use Tailwind with CSS variables for type colors (material green, blank blue, product purple).

- [ ] **Step 2: Create ConstructorStatusBar.tsx**

Adapt from prototype's status bar (lines 1316-1338). Show element counts, error count with expandable panel.

- [ ] **Step 3: Create ConstructorHeader.tsx**

Chain name input, undo/redo buttons, "Записать" button, "Опубликовать" button, close (X) button. Props: `chainName`, `onChainNameChange`, `onSave`, `onPublish`, `onClose`, `canUndo`, `canRedo`, `onUndo`, `onRedo`, `saving`, `publishing`, `hasErrors`.

- [ ] **Step 4: Create ConstructorInspector.tsx**

Adapt from prototype's `PropsPanel` (lines 581-627). Show selected node properties: name input, auto-detected type, unit, side switch, incoming edges with qty, used-in list. For existing nodes — show read-only info + SearchableSelect to pick item. For new nodes — editable fields.

- [ ] **Step 5: Create ConstructorSidebar.tsx**

List of saved drafts (from API) + "Новая цепочка" button. Each item shows name, status badge (DRAFT/PUBLISHED), updatedAt. Click loads the draft.

- [ ] **Step 6: Create AddNodeForm.tsx**

Adapt from prototype's `AddNodeForm` (lines 667-701). Modal overlay with name input, type switch (blank/material), qty input, submit/cancel.

- [ ] **Step 7: Run lint**

Run: `cd app && npx eslint src/components/warehouse-v2/constructor/`

- [ ] **Step 8: Commit**

```bash
git add app/src/components/warehouse-v2/constructor/
git commit -m "feat: add constructor presentation components"
```

---

## Task 10: ConstructorCanvas

**Files:**
- Create: `app/src/components/warehouse-v2/constructor/ConstructorCanvas.tsx`

The main canvas with dagre layout, SVG edges, zoom/pan. This is the most complex component.

- [ ] **Step 1: Create ConstructorCanvas.tsx**

Adapt from prototype's pipeline canvas rendering (lines 850-1308). Key features:
- dagre layout computation in `useMemo` (LR direction)
- SVG bezier curves for edges with arrow markers
- Zoom via Ctrl+scroll and +/- buttons
- Dot grid background
- Ghost state when empty (from prototype's `GhostState` lines 631-648)
- Node positioning via `position: absolute` with `left`/`top`
- Edge click → delete edge
- Shift+click for connecting nodes

Import `dagre` from `@dagrejs/dagre`. Render `ConstructorNode` for each node.

- [ ] **Step 2: Run lint**

Run: `cd app && npx eslint src/components/warehouse-v2/constructor/ConstructorCanvas.tsx`

- [ ] **Step 3: Commit**

```bash
git add app/src/components/warehouse-v2/constructor/ConstructorCanvas.tsx
git commit -m "feat: add constructor canvas with dagre layout"
```

---

## Task 11: ConstructorOverlay (Orchestrator)

**Files:**
- Create: `app/src/components/warehouse-v2/constructor/ConstructorOverlay.tsx`
- Modify: `app/src/components/warehouse-v2/layout/Sidebar.tsx`

- [ ] **Step 1: Create ConstructorOverlay.tsx**

The top-level orchestrator. Fullscreen overlay (`fixed inset-0 z-50 bg-background`).

Responsibilities:
- Fetch draft list on mount via `api.get("/api/constructor-drafts")`
- Manage which draft is loaded (or new unsaved chain)
- Tab state for multiple open chains
- Wire `useConstructor` hook
- Handle save: `api.post` or `api.put` to constructor-drafts
- Handle publish: `api.post` to constructor-drafts/[id]/publish
- Compose: `ConstructorHeader` + `ConstructorSidebar` + `ConstructorCanvas` + `ConstructorInspector` + `ConstructorStatusBar` + `AddNodeForm`

Layout:
```tsx
<div className="fixed inset-0 z-50 flex flex-col bg-background">
  <ConstructorHeader ... />
  <div className="flex flex-1 overflow-hidden">
    <ConstructorSidebar ... />
    <div className="flex-1 relative">
      <ConstructorCanvas ... />
      <ConstructorStatusBar ... />
    </div>
    <ConstructorInspector ... />
  </div>
</div>
```

- [ ] **Step 2: Add constructor to Sidebar**

Modify `app/src/components/warehouse-v2/layout/Sidebar.tsx`:

Add state for overlay visibility and a button in the nav:

```tsx
'use client';

import { useState } from 'react';
// ... existing imports
import { ConstructorOverlay } from '../constructor/ConstructorOverlay';

// Inside Sidebar component, add after the nav:
const [showConstructor, setShowConstructor] = useState(false);

// Add to modules array or as a separate button after nav:
<button
  onClick={() => setShowConstructor(true)}
  className="flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent/50 w-full"
>
  <span>🔗</span>
  Конструктор цепочек
</button>

// At the end of the component, before closing </aside>:
{showConstructor && <ConstructorOverlay onClose={() => setShowConstructor(false)} />}
```

- [ ] **Step 3: Run lint**

Run: `cd app && npx eslint src/components/warehouse-v2/constructor/ConstructorOverlay.tsx src/components/warehouse-v2/layout/Sidebar.tsx`

- [ ] **Step 4: Commit**

```bash
git add app/src/components/warehouse-v2/constructor/ConstructorOverlay.tsx app/src/components/warehouse-v2/layout/Sidebar.tsx
git commit -m "feat: add constructor overlay and sidebar entry point"
```

---

## Task 12: Manual Verification

- [ ] **Step 1: Start dev server**

Run: `cd app && npm run dev`

- [ ] **Step 2: Verify navigation**

Open `http://localhost:3000/warehouse-v2`. Click "Конструктор цепочек" in sidebar. Expected: fullscreen overlay opens.

- [ ] **Step 3: Test draft workflow**

1. Create a new chain with 3 nodes (material → blank → product)
2. Connect them with edges, set qty
3. Click "Записать" → toast "Черновик сохранён"
4. Close overlay, reopen → draft appears in sidebar list
5. Click draft → loads into canvas

- [ ] **Step 4: Test publish workflow**

1. Open a saved draft
2. Click "Опубликовать" → toast "Опубликовано"
3. Navigate to `/warehouse` (old UI) → Маршруты → verify published routing is visible
4. Check Номенклатура → new items created

- [ ] **Step 5: Verify DB state**

Run SQL to confirm:
```sql
SELECT id, name, status, routing_id FROM constructor_drafts;
SELECT id, item_id, version, status FROM routings ORDER BY created_at DESC LIMIT 5;
```

- [ ] **Step 6: Commit any fixes**

```bash
git add -A
git commit -m "fix: constructor verification fixes"
```

---

## Self-Review

### Spec coverage
- Fullscreen overlay from Sidebar: Task 11
- Draft CRUD with DB persistence: Tasks 2-4, 6
- Publish into Item/Routing/RoutingStep/RoutingStepInput: Task 5, 6
- Graph validation + side validation: Tasks 3, 5, 7
- Graph-to-steps conversion: Task 3
- Dagre canvas with zoom/pan: Task 10
- UX from prototype (nodes, edges, +buttons, undo/redo): Tasks 8-10
- "Записать" / "Опубликовать" buttons: Task 9, 11
- Re-publish creates new version: Task 5
- No process selection in v1: Task 5 (default process)

### Architecture compliance
- Route → Service → Prisma: Tasks 4-6
- parseBody + handleRouteError + withRequestId: Task 6
- Orchestrator + presentation separation: Tasks 8-11
- Zod validation on write endpoints: Tasks 2, 6
- log from @/lib/logger: Tasks 4, 5
- No Prisma in routes: Task 6
