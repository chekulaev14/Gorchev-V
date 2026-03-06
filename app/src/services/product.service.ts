import { prisma } from "@/lib/prisma";

const CODE_PREFIXES: Record<string, string> = {
  material: "MAT",
  blank: "BLK",
  product: "PRD",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function generateCode(tx: any, typeId: string): Promise<string> {
  const prefix = CODE_PREFIXES[typeId] || "ITM";
  const pattern = `${prefix}-%`;
  const result = await tx.$queryRaw`
    SELECT MAX(CAST(SUBSTRING(code FROM ${prefix.length + 2}) AS INTEGER)) as max_num
    FROM items WHERE code LIKE ${pattern}
  ` as [{ max_num: number | null }];
  const next = (result[0].max_num ?? 0) + 1;
  return `${prefix}-${String(next).padStart(3, "0")}`;
}

interface ComponentInput {
  tempId: string;
  parentTempId: string;
  existingId?: string;
  name: string;
  type: string;
  unit: string;
  description?: string;
  pricePerUnit?: number;
  quantity: number;
  isPaired?: boolean;
}

interface ProductInput {
  name: string;
  unit: string;
  description?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function createItemsAndBom(tx: any, productId: string, components: ComponentInput[], idMap: Map<string, string>) {
  idMap.set("product", productId);

  for (const comp of components) {
    let itemId: string;
    if (comp.existingId) {
      itemId = comp.existingId;
    } else {
      const code = await generateCode(tx, comp.type);
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
    const productCode = await generateCode(tx, "product");
    const created = await tx.item.create({
      data: {
        id: crypto.randomUUID(),
        code: productCode,
        name: product.name.trim(),
        typeId: "product",
        unitId: product.unit || "pcs",
        description: product.description || null,
        images: [],
      },
    });

    const idMap = new Map<string, string>();
    const bomCount = await createItemsAndBom(tx, created.id, components, idMap);

    return { productId: created.id, itemCount: components.length + 1, bomCount };
  });
}

export async function createPairedProducts(product: ProductInput, components: ComponentInput[]) {
  const sides = [
    { suffix: " левое", blankSuffix: " левая" },
    { suffix: " правое", blankSuffix: " правая" },
  ] as const;

  return prisma.$transaction(async (tx) => {
    let totalItems = 0;
    let totalBom = 0;
    const productIds: string[] = [];

    const sharedIdMap = new Map<string, string>();
    for (const comp of components) {
      if (comp.isPaired) continue;
      let itemId: string;
      if (comp.existingId) {
        itemId = comp.existingId;
      } else {
        const code = await generateCode(tx, comp.type);
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
          },
        });
        itemId = item.id;
        totalItems++;
      }
      sharedIdMap.set(comp.tempId, itemId);
    }

    for (const side of sides) {
      const idMap = new Map<string, string>(sharedIdMap);

      const sideCode = await generateCode(tx, "product");
      const created = await tx.item.create({
        data: {
          id: crypto.randomUUID(),
          code: sideCode,
          name: product.name.trim() + side.suffix,
          typeId: "product",
          unitId: product.unit || "pcs",
          description: product.description || null,
          images: [],
        },
      });
      idMap.set("product", created.id);
      productIds.push(created.id);
      totalItems++;

      for (const comp of components) {
        if (!comp.isPaired) continue;
        let itemId: string;
        if (comp.existingId) {
          itemId = comp.existingId;
        } else {
          const compCode = await generateCode(tx, comp.type);
          const item = await tx.item.create({
            data: {
              id: crypto.randomUUID(),
              code: compCode,
              name: comp.name.trim() + side.blankSuffix,
              typeId: comp.type,
              unitId: comp.unit || "pcs",
              description: comp.description || null,
              images: [],
              pricePerUnit: comp.pricePerUnit ?? null,
            },
          });
          itemId = item.id;
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
