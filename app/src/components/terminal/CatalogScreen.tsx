"use client";

import { useState, useEffect } from "react";
import type { Category, Product, Part } from "./types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PartDetail } from "./PartDetail";
import { ThemeToggle } from "@/components/ThemeToggle";
import { api } from "@/lib/api-client";

interface CatalogScreenProps {
  workerName: string;
  onLogout: () => void;
  onSubmit: (partId: string, partName: string, quantity: number, pricePerUnit: number) => Promise<string | null>;
}

type View =
  | { type: "categories" }
  | { type: "products"; category: Category }
  | { type: "parts"; product: Product }
  | { type: "partDetail"; part: Part; product: Product };

export function CatalogScreen({ workerName, onLogout, onSubmit }: CatalogScreenProps) {
  const [view, setView] = useState<View>({ type: "categories" });
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<Category[]>("/api/terminal/catalog", { silent: true })
      .then((data) => setCategories(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleBack = () => {
    switch (view.type) {
      case "products":
        setView({ type: "categories" });
        break;
      case "parts":
        setView({ type: "categories" });
        break;
      case "partDetail":
        setView({ type: "parts", product: view.product });
        break;
    }
  };

  const title = (() => {
    switch (view.type) {
      case "categories":
        return "Каталог изделий";
      case "products":
        return view.category.name;
      case "parts":
        return view.product.name;
      case "partDetail":
        return view.part.name;
    }
  })();

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <header className="flex items-center justify-between px-3 py-2 bg-card border-b border-border">
        <div className="flex items-center gap-2">
          {view.type !== "categories" && (
            <Button
              variant="ghost"
              className="text-muted-foreground hover:text-foreground text-base px-2 h-8"
              onClick={handleBack}
            >
              ←
            </Button>
          )}
          <h1 className="text-sm font-semibold text-foreground">{title}</h1>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-xs">{workerName}</span>
          <ThemeToggle />
          <Button
            variant="outline"
            size="sm"
            className="border-border text-muted-foreground hover:bg-accent h-7 text-xs px-2"
            onClick={onLogout}
          >
            Выход
          </Button>
        </div>
      </header>

      <main className="flex-1 p-3 overflow-y-auto">
        {loading ? (
          <p className="text-muted-foreground text-sm text-center py-4">Загрузка каталога...</p>
        ) : (
          <>
            {view.type === "categories" && (
              <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2">
                {categories.map((cat) => (
                  <Card
                    key={cat.id}
                    className="bg-card border-border cursor-pointer hover:border-ring active:bg-accent transition-all overflow-hidden"
                    onClick={() => setView({ type: "products", category: cat })}
                  >
                    <div className="aspect-square relative">
                      <img
                        src={cat.image}
                        alt={cat.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="p-1.5">
                      <h3 className="text-foreground font-medium text-xs">{cat.name}</h3>
                      <p className="text-muted-foreground/70 text-[10px]">{cat.products.length} изд.</p>
                    </div>
                  </Card>
                ))}
              </div>
            )}

            {view.type === "products" && (
              <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2">
                {view.category.products.map((product) => (
                  <Card
                    key={product.id}
                    className="bg-card border-border cursor-pointer hover:border-ring active:bg-accent transition-all overflow-hidden"
                    onClick={() => setView({ type: "parts", product })}
                  >
                    <div className="aspect-square relative">
                      <img
                        src={product.images[0]}
                        alt={product.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="p-1.5">
                      <h3 className="text-foreground font-medium text-xs">{product.name}</h3>
                      <p className="text-muted-foreground/70 text-[10px]">{product.parts.length} дет.</p>
                    </div>
                  </Card>
                ))}
              </div>
            )}

            {view.type === "parts" && (
              <div className="space-y-2">
                <div className="bg-card rounded-lg p-2 border border-border">
                  <p className="text-muted-foreground text-xs">{view.product.description}</p>
                </div>
                <h2 className="text-sm font-medium text-muted-foreground">Комплектующие:</h2>
                <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2">
                  {view.product.parts.map((part) => (
                    <Card
                      key={part.id}
                      className="bg-card border-border cursor-pointer hover:border-ring active:bg-accent transition-all overflow-hidden"
                      onClick={() => setView({ type: "partDetail", part, product: view.product })}
                    >
                      <div className="aspect-square relative">
                        <img
                          src={part.images[0]}
                          alt={part.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="p-1.5">
                        <h3 className="text-foreground font-medium text-[11px]">{part.name}</h3>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {view.type === "partDetail" && (
              <PartDetail
                part={view.part}
                onSubmit={(quantity) =>
                  onSubmit(view.part.id, view.part.name, quantity, view.part.pricePerUnit)
                }
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}
