import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const [dbCategories, products, bomEntries] = await Promise.all([
    prisma.category.findMany({ orderBy: { name: "asc" } }),
    prisma.item.findMany({
      where: { typeId: "product", deletedAt: null },
      include: { category: true },
      orderBy: { name: "asc" },
    }),
    prisma.bomEntry.findMany({
      include: {
        child: true,
      },
    }),
  ]);

  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
  const img = (name: string) => `${basePath}/images/catalog/${name}`;

  // Build BOM map: parentId -> children
  const bomMap = new Map<string, { id: string; name: string; description: string; images: string[]; pricePerUnit: number }[]>();
  for (const entry of bomEntries) {
    const children = bomMap.get(entry.parentId) || [];
    children.push({
      id: entry.child.id,
      name: entry.child.name,
      description: entry.child.description || "",
      images: entry.child.images.length > 0 ? entry.child.images : [img("body-cat.jpg")],
      pricePerUnit: Number(entry.child.pricePerUnit) || 0,
    });
    bomMap.set(entry.parentId, children);
  }

  // Build categories with products and their parts
  const categories = dbCategories.map((cat) => {
    const catProducts = products
      .filter((p) => p.categoryId === cat.id)
      .map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description || "",
        images: p.images.length > 0 ? p.images : [img("body-cat.jpg")],
        parts: bomMap.get(p.id) || [],
      }));

    return {
      id: cat.id,
      name: cat.name,
      image: cat.image || img("body-cat.jpg"),
      products: catProducts,
    };
  }).filter((cat) => cat.products.length > 0);

  // Add "uncategorized" products if any
  const uncategorized = products
    .filter((p) => !p.categoryId)
    .map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description || "",
      images: p.images.length > 0 ? p.images : [img("body-cat.jpg")],
      parts: bomMap.get(p.id) || [],
    }));

  if (uncategorized.length > 0) {
    categories.push({
      id: "products",
      name: "Изделия",
      image: img("body-cat.jpg"),
      products: uncategorized,
    });
  }

  return NextResponse.json(categories);
}
