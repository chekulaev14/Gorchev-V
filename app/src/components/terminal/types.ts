export interface Part {
  id: string;
  name: string;
  description: string;
  images: string[];
  pricePerUnit: number;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  images: string[];
  parts: Part[];
}

export interface Category {
  id: string;
  name: string;
  image: string;
  products: Product[];
}
