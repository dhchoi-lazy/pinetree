"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Scholar, XueanGroup } from "@/types";
import { ArrowLeft } from "lucide-react";

interface ScholarDetailProps {
  scholar: Scholar;
  xueanGroup: XueanGroup;
  onBack: () => void;
}

export function ScholarDetail({
  scholar,
  xueanGroup,
  onBack,
}: ScholarDetailProps) {
  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 px-4 pt-4">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="size-4" />
          Back
        </Button>
      </div>

      <ScrollArea className="flex-1 px-4 py-4">
        <div className="flex flex-col gap-4">
          <div>
            <h2 className="text-lg font-semibold">
              {scholar.namePinyin} ({scholar.name})
            </h2>

            {(scholar.courtesy || scholar.title) && (
              <div className="mt-1 text-sm text-muted-foreground">
                {scholar.courtesy && <span>Courtesy: {scholar.courtesy}</span>}
                {scholar.courtesy && scholar.title && <span> &middot; </span>}
                {scholar.title && <span>{scholar.title}</span>}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Badge
              style={{ backgroundColor: xueanGroup.color, color: "#fff" }}
              className="border-0"
            >
              {xueanGroup.nameEn}
            </Badge>
            <span className="text-xs text-muted-foreground">
              Vol. {scholar.volume}
            </span>
          </div>

          <div className="whitespace-pre-wrap text-sm leading-relaxed">
            {scholar.text}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
