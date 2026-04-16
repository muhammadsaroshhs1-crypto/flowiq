"use client";

import { UserButton } from "@clerk/nextjs";
import {
  ArrowLeft,
  BarChart3,
  Bell,
  Lightbulb,
  Plug,
  Settings,
  Workflow,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useProject } from "@/contexts/project-context";
import { useWorkspace } from "@/contexts/workspace-context";
import { useAlerts } from "@/hooks/use-alerts";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: BarChart3 },
  { href: "/projects", label: "Projects", icon: Workflow },
  { href: "/alerts", label: "Alerts", icon: Bell },
  { href: "/integrations", label: "Integrations", icon: Plug },
  { href: "/settings", label: "Settings", icon: Settings },
];

const projectSubItems = [
  { href: "", label: "Overview" },
  { href: "/pipelines", label: "Pipelines" },
  { href: "/intelligence", label: "Intelligence" },
  { href: "/amazon", label: "Amazon" },
  { href: "/social", label: "Social" },
  { href: "/monitoring", label: "Monitoring" },
  { href: "/integrations", label: "Integrations" },
];

function getInitials(name: string | null, fallback: string) {
  const source = name?.trim() || fallback;
  return source
    .split(/\s|@|-/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function Sidebar({ className }: { className?: string }) {
  return (
    <aside className={cn("fixed inset-y-0 left-0 z-40 hidden w-72 border-r bg-background lg:block", className)}>
      <SidebarContent />
    </aside>
  );
}

export function SidebarContent() {
  const pathname = usePathname();
  const { workspace, currentUser } = useWorkspace();
  const projectContext = useProject();
  const project = projectContext?.project;
  const { stats } = useAlerts({ limit: 1 });
  const [pendingSuggestions, setPendingSuggestions] = useState(0);

  useEffect(() => {
    async function loadSuggestionCount() {
      const response = await fetch("/api/dashboard/stats");
      const data = (await response.json()) as { pendingSuggestions?: number };
      setPendingSuggestions(data.pendingSuggestions ?? 0);
    }

    void loadSuggestionCount();
  }, []);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b p-6">
        {project ? (
          <div className="space-y-3">
            <Link href="/projects" className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-3.5 w-3.5" />
              Projects
            </Link>
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10 rounded-md">
                <AvatarFallback className="rounded-md">
                  {getInitials(project.name, project.id)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{project.name}</p>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  {project.industry}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10 rounded-md">
                <AvatarFallback className="rounded-md">
                  {getInitials(workspace.name, workspace.slug)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{workspace.name}</p>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  {workspace.plan}
                </p>
              </div>
            </div>
            <select className="mt-4 h-9 w-full rounded-md border bg-background px-2 text-sm" defaultValue={workspace.id}>
              <option value={workspace.id}>{workspace.name}</option>
            </select>
          </>
        )}
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              <span className="flex-1">{item.label}</span>
              {item.label === "Alerts" && stats.critical > 0 ? (
                <span className="rounded-full bg-red-600 px-1.5 py-0.5 text-xs text-white">
                  {stats.critical}
                </span>
              ) : null}
            </Link>
          );
        })}

        {project ? (
          <div className="mt-4 border-t pt-4">
            <p className="mb-2 px-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Project
            </p>
            {projectSubItems.map((item) => {
              const href = `/projects/${project.id}${item.href}`;
              const isActive = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "block rounded-md px-3 py-2 text-sm transition",
                    isActive ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:bg-muted",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        ) : null}

        <Link
          href="/dashboard#suggestions"
          className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
        >
          <Lightbulb className="h-4 w-4" />
          <span className="flex-1">Suggestions</span>
          {pendingSuggestions > 0 ? (
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
              {pendingSuggestions}
            </span>
          ) : null}
        </Link>
      </nav>

      <div className="border-t p-4">
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9">
            <AvatarImage src={currentUser.avatarUrl ?? undefined} alt="" />
            <AvatarFallback>{getInitials(currentUser.name, currentUser.email)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">
              {currentUser.name ?? currentUser.email}
            </p>
            <p className="truncate text-xs text-muted-foreground">{currentUser.email}</p>
          </div>
          <UserButton afterSignOutUrl="/sign-in" />
        </div>
      </div>
    </div>
  );
}
