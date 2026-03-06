"use client"

import { useState, useMemo, type ReactNode } from "react"
import { cn } from "@/lib/utils"

interface GroupedAccordionProps<T, K extends string> {
  items: T[]
  groupBy: (item: T) => K
  groupOrder: K[]
  renderGroupHeader: (group: K, items: T[]) => ReactNode
  renderGroupContent: (group: K, items: T[]) => ReactNode
  searchQuery?: string
  className?: string
}

export function GroupedAccordion<T, K extends string>({
  items,
  groupBy,
  groupOrder,
  renderGroupHeader,
  renderGroupContent,
  searchQuery,
  className,
}: GroupedAccordionProps<T, K>) {
  const [expandedGroups, setExpandedGroups] = useState<Set<K>>(new Set())

  const grouped = useMemo(() => {
    const groups = new Map<K, T[]>()
    for (const key of groupOrder) {
      groups.set(key, [])
    }
    for (const item of items) {
      const key = groupBy(item)
      const group = groups.get(key)
      if (group) group.push(item)
    }
    return groups
  }, [items, groupBy, groupOrder])

  const effectiveExpanded = useMemo(() => {
    if (searchQuery) {
      const all = new Set<K>()
      for (const [key, group] of grouped) {
        if (group.length > 0) all.add(key)
      }
      return all
    }
    return expandedGroups
  }, [searchQuery, expandedGroups, grouped])

  const toggleGroup = (key: K) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  return (
    <div className={cn("space-y-1", className)}>
      {groupOrder.map((key) => {
        const group = grouped.get(key)
        if (!group || group.length === 0) return null
        const isExpanded = effectiveExpanded.has(key)

        return (
          <div key={key} className="rounded-lg border border-border overflow-hidden">
            <button
              className="w-full flex items-center justify-between px-3 py-2.5 bg-card hover:bg-accent/30 transition-colors"
              onClick={() => toggleGroup(key)}
            >
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-sm w-4">
                  {isExpanded ? "−" : "+"}
                </span>
                {renderGroupHeader(key, group)}
              </div>
            </button>

            {isExpanded && renderGroupContent(key, group)}
          </div>
        )
      })}
    </div>
  )
}
