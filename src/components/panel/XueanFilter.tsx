"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { XueanGroup } from "@/types";

interface XueanFilterProps {
  groups: XueanGroup[];
  hiddenIds: Set<string>;
  onToggle: (id: string) => void;
}

export function XueanFilter({ groups, hiddenIds, onToggle }: XueanFilterProps) {
  return (
    <ScrollArea className="h-full">
      <div className="flex flex-col gap-1 py-1">
        {groups.map((group) => {
          const visible = !hiddenIds.has(group.id);

          return (
            <button
              key={group.id}
              type="button"
              onClick={() => onToggle(group.id)}
              className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-muted"
            >
              <span
                className="size-3 shrink-0 rounded-full"
                style={{ backgroundColor: group.color }}
              />
              <span className="min-w-0 flex-1 truncate">
                {group.nameEn}
                <span className="ml-1 text-muted-foreground">
                  ({group.scholarCount})
                </span>
              </span>
              <Checkbox
                checked={visible}
                onCheckedChange={() => onToggle(group.id)}
                onClick={(e) => e.stopPropagation()}
                className="shrink-0"
              />
            </button>
          );
        })}
      </div>
    </ScrollArea>
  );
}
