"use client";

import { useState, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useWarehouse } from "@/components/warehouse/WarehouseContext";
import { api } from "@/lib/api-client";

interface Process {
  id: string;
  name: string;
  groupId: string;
  order: number;
}

interface ProcessGroup {
  id: string;
  name: string;
  order: number;
  processes: Process[];
}

const groupColors: Record<string, string> = {
  stamping: "bg-blue-100 text-blue-800 border-blue-300",
  welding: "bg-orange-100 text-orange-800 border-orange-300",
  finishing: "bg-emerald-100 text-emerald-800 border-emerald-300",
};

function getGroupColor(id: string) {
  return groupColors[id] || "bg-gray-100 text-gray-800 border-gray-300";
}

export function ProcessesTab() {
  const { editMode } = useWarehouse();
  const [groups, setGroups] = useState<ProcessGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingProcess, setEditingProcess] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [addingGroup, setAddingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");

  const fetchData = useCallback(async () => {
    try {
      const data = await api.get<{ groups: ProcessGroup[] }>("/api/processes", { silent: true });
      setGroups(data.groups);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAddProcess = async (groupId: string) => {
    if (!newName.trim() || saving) return;
    setSaving(true);
    try {
      await api.post("/api/processes", { name: newName.trim(), groupId });
      setAddingTo(null);
      setNewName("");
      fetchData();
    } catch {
      // toast shown by api-client
    } finally {
      setSaving(false);
    }
  };

  const handleEditProcess = async (id: string) => {
    if (!editName.trim() || saving) return;
    setSaving(true);
    try {
      await api.patch("/api/processes", { type: "process", id, name: editName.trim() });
      setEditingProcess(null);
      setEditName("");
      fetchData();
    } catch {
      // toast shown by api-client
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProcess = async (id: string) => {
    if (saving) return;
    setSaving(true);
    try {
      await api.del(`/api/processes?id=${id}&type=process`);
      fetchData();
    } catch {
      // toast shown by api-client
    } finally {
      setSaving(false);
    }
  };

  const handleAddGroup = async () => {
    if (!newGroupName.trim() || saving) return;
    setSaving(true);
    try {
      const id = newGroupName.trim().toLowerCase().replace(/[^a-zа-яё0-9]/gi, "-").replace(/-+/g, "-");
      const maxOrder = groups.length > 0 ? Math.max(...groups.map((g) => g.order)) : 0;
      await api.post("/api/processes", { type: "group", id, name: newGroupName.trim(), order: maxOrder + 1 });
      setAddingGroup(false);
      setNewGroupName("");
      fetchData();
    } catch {
      // toast shown by api-client
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="text-muted-foreground text-sm">Загрузка...</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">
          {groups.reduce((sum, g) => sum + g.processes.length, 0)} процессов в {groups.length} группах
        </p>
        {editMode && (
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            onClick={() => setAddingGroup(true)}
            disabled={addingGroup}
          >
            + Группа
          </Button>
        )}
      </div>

      {addingGroup && (
        <div className="bg-card rounded-lg border border-border p-3 flex gap-2 items-end">
          <div className="flex-1">
            <label className="text-muted-foreground text-xs block mb-1">Название группы</label>
            <Input
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              className="h-8 text-sm"
              placeholder="Например: Токарные"
              onKeyDown={(e) => e.key === "Enter" && handleAddGroup()}
              autoFocus
            />
          </div>
          <Button size="sm" className="h-8 text-xs" onClick={handleAddGroup} disabled={saving || !newGroupName.trim()}>
            Создать
          </Button>
          <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => { setAddingGroup(false); setNewGroupName(""); }}>
            Отмена
          </Button>
        </div>
      )}

      <div className="space-y-2">
        {groups.map((group) => (
          <div key={group.id} className="rounded-lg border border-border overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2.5 bg-card">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={`text-sm px-2.5 py-0.5 ${getGroupColor(group.id)}`}>
                  {group.name}
                </Badge>
                <span className="text-muted-foreground text-xs">{group.processes.length}</span>
              </div>
              {editMode && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs text-muted-foreground"
                  onClick={() => { setAddingTo(group.id); setNewName(""); }}
                >
                  + Процесс
                </Button>
              )}
            </div>

            <div className="border-t border-border">
              {group.processes.map((proc) => (
                <div
                  key={proc.id}
                  className="flex items-center justify-between px-4 py-2 border-b border-border/50 last:border-b-0 hover:bg-accent/30 transition-colors"
                >
                  {editingProcess === proc.id ? (
                    <div className="flex gap-2 items-center flex-1">
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="h-7 text-sm flex-1"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleEditProcess(proc.id);
                          if (e.key === "Escape") setEditingProcess(null);
                        }}
                        autoFocus
                      />
                      <Button size="sm" className="h-7 text-xs" onClick={() => handleEditProcess(proc.id)} disabled={saving}>
                        OK
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setEditingProcess(null)}>
                        Отм.
                      </Button>
                    </div>
                  ) : (
                    <>
                      <span className="text-foreground text-sm">{proc.name}</span>
                      {editMode && (
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 text-muted-foreground text-xs"
                            onClick={() => { setEditingProcess(proc.id); setEditName(proc.name); }}
                          >
                            ✎
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 text-destructive text-xs"
                            onClick={() => handleDeleteProcess(proc.id)}
                          >
                            ✕
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              ))}

              {addingTo === group.id && (
                <div className="flex gap-2 items-center px-4 py-2 bg-accent/10">
                  <Input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="h-7 text-sm flex-1"
                    placeholder="Название процесса"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleAddProcess(group.id);
                      if (e.key === "Escape") setAddingTo(null);
                    }}
                    autoFocus
                  />
                  <Button size="sm" className="h-7 text-xs" onClick={() => handleAddProcess(group.id)} disabled={saving || !newName.trim()}>
                    Добавить
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setAddingTo(null)}>
                    Отм.
                  </Button>
                </div>
              )}

              {group.processes.length === 0 && addingTo !== group.id && (
                <p className="text-muted-foreground text-xs px-4 py-2">Нет процессов</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
