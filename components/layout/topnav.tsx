"use client";

import { Menu } from "lucide-react";
import { usePathname } from "next/navigation";

import { AlertBadge } from "@/components/alerts/alert-badge";
import { SidebarContent } from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useProject } from "@/contexts/project-context";
import { useWorkspace } from "@/contexts/workspace-context";

function getSection(pathname: string) {
  const segment = pathname.split("/").filter(Boolean).at(-1) ?? "dashboard";
  return segment.replaceAll("-", " ");
}

export function TopNav() {
  const pathname = usePathname();
  const { workspace } = useWorkspace();
  const projectContext = useProject();
  const project = projectContext?.project;
  const section = getSection(pathname);

  return (
    <header className="sticky top-0 z-30 border-b bg-background/95 px-4 py-4 backdrop-blur sm:px-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <Sheet>
            <SheetTrigger render={<Button className="lg:hidden" variant="outline" size="icon" />}>
              <Menu className="h-4 w-4" />
              <span className="sr-only">Open navigation</span>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0" showCloseButton={false}>
              <SidebarContent />
            </SheetContent>
          </Sheet>
          <div className="min-w-0">
            <p className="truncate text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {workspace.name}
              {project ? ` / ${project.name}` : ""}
            </p>
            <h1 className="truncate text-lg font-semibold capitalize">{section}</h1>
          </div>
        </div>
        <AlertBadge />
      </div>
    </header>
  );
}
