import { prisma } from "@/lib/prisma";
import { getNextCode, toCodeKind } from "./helpers/code-generator";

interface ComponentInput {
  tempId: string;
  parentTempId: string;
  existingId?: string;
  name: string;
  type: string;
  unit: string;
  description?: string;
  pricePerUnit?: number;
  weight?: number;
  quantity: number;
  isPaired?: boolean;
}

interface ProductInput {
  name: string;
  unit: string;
  description?: string;
  weight?: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function createItemsAndBom(tx: any, productId: string, components: ComponentInput[], idMap: Map<string, string>) {
  idMap.set("product", productId);

  for (const comp of components) {
    let itemId: string;
    if (comp.existingId) {
      itemId = comp.existingId;
    } else {
      const code = await getNextCode(tx, toCodeKind(comp.type));
      const item = await tx.item.create({
        data: {
          id: crypto.randomUUID(),
          code,
          name: comp.name.trim(),
          typeId: comp.type,
          unitId: comp.unit || "pcs",
          description: comp.description || null,
          images: [],
          pricePerUnit: comp.pricePerUnit ?? null,
          weight: comp.weight ?? null,
        },
      });
      itemId = item.id;
    }
    idMap.set(comp.tempId, itemId);
  }

  let bomCount = 0;
  for (const comp of components) {
    const childId = idMap.get(comp.tempId);
    const parentId = idMap.get(comp.parentTempId);
    if (!childId || !parentId) continue;

    await tx.bomEntry.upsert({
      where: { parentId_childId: { parentId, childId } },
      update: { quantity: comp.quantity },
      create: { parentId, childId, quantity: comp.quantity },
    });
    bomCount++;
  }

  return bomCount;
}

export async function createSingleProduct(product: ProductInput, components: ComponentInput[]) {
  return prisma.$transaction(async (tx) => {
    const productCode = await getNextCode(tx, "PRODUCT");
    const created = await tx.item.create({
      data: {
        id: crypto.randomUUID(),
        code: productCode,
        name: product.name.trim(),
        typeId: "product",
        unitId: product.unit || "pcs",
        description: product.description || null,
        weight: product.weight ?? null,
        images: [],
      },
    });

    const idMap = new Map<string, string>();
    const bomCount = await createItemsAndBom(tx, created.id, components, idMap);

    return { productId: created.id, itemCount: components.length + 1, bomCount };
  });
}

export async function createPairedProducts(product: ProductInput, components: ComponentInput[]) {
  const sides = ["LEFT", "RIGHT"] as const;

  return prisma.$transaction(async (tx) => {
    let totalItems = 0;
    let totalBom = 0;
    const productIds: string[] = [];

    // Фаза 1: создаём непарные компоненты один раз (side=NONE)
    const sharedIdMap = new Map<string, string>();
    for (const comp of components) {
      if (comp.isPaired) continue;
      let itemId: string;
      if (comp.existingId) {
        itemId = comp.existingId;
      } else {
        const code = await getNextCode(tx, toCodeKind(comp.type));
        const item = await tx.item.create({
          data: {
            id: crypto.randomUUID(),
            code,
            name: comp.name.trim(),
            typeId: comp.type,
            unitId: comp.unit || "pcs",
            description: comp.description || null,
            images: [],
            pricePerUnit: comp.pricePerUnit ?? null,
            weight: comp.weight ?? null,
            side: "NONE",
          },
        });
        itemId = item.id;
        totalItems++;
      }
      sharedIdMap.set(comp.tempId, itemId);
    }

    // Фаза 2: создаём LEFT и RIGHT версии
    // Храним id LEFT-компонентов чтобы связать RIGHT через baseItemId
    const leftIds = new Map<string, string>(); // tempId → leftItemId

    for (const side of sides) {
      const idMap = new Map<string, string>(sharedIdMap);

      const sideCode = await getNextCode(tx, "PRODUCT");
      const created = await tx.item.create({
        data: {
          id: crypto.randomUUID(),
          code: sideCode,
          name: product.name.trim(),
          typeId: "product",
          unitId: product.unit || "pcs",
          description: product.description || null,
          weight: product.weight ?? null,
          images: [],
          side,
          baseItemId: side === "RIGHT" ? productIds[0] : null,
        },
      });
      idMap.set("product", created.id);
      productIds.push(created.id);
      if (side === "LEFT") leftIds.set("product", created.id);
      totalItems++;

      for (const comp of components) {
        if (!comp.isPaired) continue;
        let itemId: string;
        if (comp.existingId) {
          itemId = comp.existingId;
        } else {
          const compCode = await getNextCode(tx, toCodeKind(comp.type));
          const item = await tx.item.create({
            data: {
              id: crypto.randomUUID(),
              code: compCode,
              name: comp.name.trim(),
              typeId: comp.type,
              unitId: comp.unit || "pcs",
              description: comp.description || null,
              images: [],
              pricePerUnit: comp.pricePerUnit ?? null,
              weight: comp.weight ?? null,
              side,
              baseItemId: side === "RIGHT" ? leftIds.get(comp.tempId) ?? null : null,
            },
          });
          itemId = item.id;
          if (side === "LEFT") leftIds.set(comp.tempId, itemId);
          totalItems++;
        }
        idMap.set(comp.tempId, itemId);
      }

      for (const comp of components) {
        const childId = idMap.get(comp.tempId);
        const parentId = idMap.get(comp.parentTempId);
        if (!childId || !parentId) continue;

        await tx.bomEntry.upsert({
          where: { parentId_childId: { parentId, childId } },
          update: { quantity: comp.quantity },
          create: { parentId, childId, quantity: comp.quantity },
        });
        totalBom++;
      }
    }

    return { productIds, itemCount: totalItems, bomCount: totalBom };
  });
}
