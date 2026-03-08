export interface Part {
  id: string;
  name: string;
  description: string;
  images: string[];
  pricePerUnit: number;
  weight?: number | null;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  images: string[];
  side?: string;
  weight?: number | null;
  parts: Part[];
}

export interface Category {
  id: string;
  name: string;
  image: string;
  products: Product[];
}

export interface CatalogData {
  categories: Category[];
  blanks: Product[];
}
