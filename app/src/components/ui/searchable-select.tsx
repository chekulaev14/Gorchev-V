"use client"

import { useState, useRef, useEffect, type ReactNode } from "react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

interface SearchableSelectProps<T> {
  items: T[]
  value: string | null
  onChange: (key: string | null) => void
  getKey: (item: T) => string
  getLabel: (item: T) => string
  renderItem?: (item: T) => ReactNode
  renderSelected?: (item: T) => ReactNode
  filterFn?: (item: T, query: string) => boolean
  placeholder?: string
  disabled?: boolean
  maxItems?: number
  className?: string
}

export function SearchableSelect<T>({
  items,
  value,
  onChange,
  getKey,
  getLabel,
  renderItem,
  renderSelected,
  filterFn,
  placeholder = "Поиск...",
  disabled = false,
  maxItems = 20,
  className,
}: SearchableSelectProps<T>) {
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const selectedItem = value ? items.find((item) => getKey(item) === value) ?? null : null

  const filtered = query
    ? items.filter((item) =>
        filterFn
          ? filterFn(item, query)
          : getLabel(item).toLowerCase().includes(query.toLowerCase())
      )
    : items

  const visibleItems = filtered.slice(0, maxItems)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside)
      return () => document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [open])

  if (selectedItem) {
    return (
      <div className={cn("relative", className)} ref={containerRef}>
        <div className="flex items-center gap-2 bg-background rounded-md px-3 py-2 border border-input min-h-9">
          <div className="flex-1 min-w-0">
            {renderSelected ? renderSelected(selectedItem) : (
              <span className="text-foreground text-sm">{getLabel(selectedItem)}</span>
            )}
          </div>
          {!disabled && (
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground text-sm shrink-0 px-1"
              onClick={() => {
                onChange(null)
                setQuery("")
              }}
            >
              ✕
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className={cn("relative", className)} ref={containerRef}>
      <Input
        placeholder={placeholder}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        disabled={disabled}
        className="bg-background border-input text-foreground text-sm h-9"
      />
      {open && visibleItems.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md max-h-48 overflow-y-auto shadow-md">
          {visibleItems.map((item) => (
            <div
              key={getKey(item)}
              className="px-3 py-2 hover:bg-accent cursor-pointer text-sm"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onChange(getKey(item))
                setQuery("")
                setOpen(false)
              }}
            >
              {renderItem ? renderItem(item) : getLabel(item)}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
