"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { WarehouseProvider, useWarehouse } from "@/components/warehouse/WarehouseContext";
import { WarehouseNav } from "@/components/warehouse/WarehouseNav";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";

function LoginGate() {
  const { login } = useWarehouse();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    setError("");
    const err = await login(email, password);
    if (err) setError(err);
    setLoading(false);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4">
      <div className="w-full max-w-xs">
        <p className="text-muted-foreground text-xs mb-1 text-center">Склад</p>
        <p className="text-muted-foreground text-sm mb-5 text-center">Вход в систему</p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full h-10 px-3 text-sm rounded-lg border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            autoComplete="email"
            autoFocus
          />
          <input
            type="password"
            placeholder="Пароль"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full h-10 px-3 text-sm rounded-lg border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            autoComplete="current-password"
          />

          {error && <p className="text-destructive text-sm animate-pulse">{error}</p>}

          <Button type="submit" disabled={loading || !email || !password} className="w-full h-10">
            {loading ? "Вход..." : "Войти"}
          </Button>
        </form>
      </div>
    </div>
  );
}

function WarehouseLayout({ children }: { children: React.ReactNode }) {
  const { loading, authChecked, editMode, setEditMode, session, logout } = useWarehouse();
  const router = useRouter();

  if (!authChecked) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <p className="text-muted-foreground">Загрузка...</p>
      </div>
    );
  }

  if (!session) return <LoginGate />;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <p className="text-muted-foreground">Загрузка...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <header className="px-4 py-3 bg-card border-b border-border">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-foreground text-base font-semibold">Склад</h1>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-muted-foreground text-xs">{session.name}</span>
            <Button
              variant={editMode ? "default" : "secondary"}
              size="sm"
              className="h-8 text-xs whitespace-nowrap"
              onClick={() => setEditMode(!editMode)}
            >
              {editMode ? "Выйти" : "Ред."}
            </Button>
            <ThemeToggle />
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={logout}
            >
              Выход
            </Button>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <WarehouseNav />
          {editMode && (
            <div className="flex gap-1 shrink-0">
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={() => router.push("/warehouse/deleted")}
              >
                Удалённые
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={() => router.push("/warehouse/builder")}
              >
                Конструктор изделия
              </Button>
            </div>
          )}
        </div>
      </header>
      <div className="p-4">
        {children}
      </div>
    </div>
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <WarehouseProvider>
      <WarehouseLayout>{children}</WarehouseLayout>
    </WarehouseProvider>
  );
}
