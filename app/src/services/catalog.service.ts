import { prisma } from "@/lib/prisma";
import { toNumber } from "./helpers/serialize";

interface CatalogPart {
  id: string;
  name: string;
  description: string;
  images: string[];
  pricePerUnit: number;
  weight: number | null;
}

interface CatalogProduct {
  id: string;
  name: string;
  description: string;
  images: string[];
  side: string;
  weight: number | null;
  parts: CatalogPart[];
}

interface CatalogCategory {
  id: string;
  name: string;
  image: string;
  products: CatalogProduct[];
}

interface CatalogData {
  categories: CatalogCategory[];
  blanks: CatalogProduct[];
}

export async function getCatalog(): Promise<CatalogData> {
  const [dbCategories, products, blanks, bomEntries] = await Promise.all([
    prisma.category.findMany({ orderBy: { name: "asc" } }),
    prisma.item.findMany({
      where: { typeId: "product", deletedAt: null },
      include: { category: true },
      orderBy: { name: "asc" },
    }),
    prisma.item.findMany({
      where: { typeId: "blank", deletedAt: null },
      orderBy: { name: "asc" },
    }),
    prisma.bomEntry.findMany({ include: { child: true } }),
  ]);

  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
  const img = (name: string) => `${basePath}/images/catalog/${name}`;
  const fallbackImg = img("body-cat.jpg");

  const bomMap = new Map<string, CatalogPart[]>();
  for (const entry of bomEntries) {
    const children = bomMap.get(entry.parentId) || [];
    children.push({
      id: entry.child.id,
      name: entry.child.name,
      description: entry.child.description || "",
      images: entry.child.images.length > 0 ? entry.child.images : [fallbackImg],
      pricePerUnit: Number(entry.child.pricePerUnit) || 0,
      weight: toNumber(entry.child.weight),
    });
    bomMap.set(entry.parentId, children);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapToProduct = (p: any): CatalogProduct => ({
    id: p.id,
    name: p.name,
    description: p.description || "",
    images: p.images.length > 0 ? p.images : [fallbackImg],
    side: p.side || "NONE",
    weight: toNumber(p.weight),
    parts: bomMap.get(p.id) || [],
  });

  const categories = dbCategories
    .map((cat) => ({
      id: cat.id,
      name: cat.name,
      image: cat.image || fallbackImg,
      products: products.filter((p) => p.categoryId === cat.id).map(mapToProduct),
    }))
    .filter((cat) => cat.products.length > 0);

  const uncategorized = products.filter((p) => !p.categoryId).map(mapToProduct);
  if (uncategorized.length > 0) {
    categories.push({
      id: "products",
      name: "Изделия",
      image: fallbackImg,
      products: uncategorized,
    });
  }

  return {
    categories,
    blanks: blanks.map(mapToProduct),
  };
}
