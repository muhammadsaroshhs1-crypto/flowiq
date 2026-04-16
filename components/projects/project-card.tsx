import type { Industry, ProjectStatus } from "@prisma/client";
import { formatDistanceToNow } from "date-fns";
import { Globe, Layers, Search, ShoppingCart } from "lucide-react";
import Link from "next/link";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

type ProjectCardMember = {
  user: {
    name: string | null;
    email: string;
    avatarUrl: string | null;
  };
};

export type ProjectCardProject = {
  id: string;
  name: string;
  clientName: string | null;
  industry: Industry;
  status: ProjectStatus;
  modules: string[];
  updatedAt: Date;
  members: ProjectCardMember[];
  _count?: {
    alerts?: number;
    pipelines?: number;
    members?: number;
  };
};

const industryIcons = {
  SEO: Search,
  AMAZON: ShoppingCart,
  WEB_DESIGN: Globe,
  MULTI: Layers,
};

const industryLabels = {
  SEO: "SEO",
  AMAZON: "Amazon",
  WEB_DESIGN: "Web Design",
  MULTI: "Multi",
};

const statusClasses = {
  ACTIVE: "border-green-200 bg-green-50 text-green-700",
  PAUSED: "border-amber-200 bg-amber-50 text-amber-700",
  COMPLETED: "border-blue-200 bg-blue-50 text-blue-700",
  ARCHIVED: "border-gray-200 bg-gray-50 text-gray-700",
};

function initials(name: string | null, email: string) {
  const source = name?.trim() || email;
  return source
    .split(/\s|@/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function ProjectCard({ project }: { project: ProjectCardProject }) {
  const Icon = industryIcons[project.industry];
  const visibleMembers = project.members.slice(0, 4);

  return (
    <Link href={`/projects/${project.id}`} className="block">
      <Card className="h-full rounded-lg transition hover:-translate-y-0.5 hover:shadow-md">
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <CardTitle className="truncate">{project.name}</CardTitle>
              <CardDescription className="truncate">
                {project.clientName ?? "No client name"}
              </CardDescription>
            </div>
            <div className="rounded-md border bg-background p-2 text-muted-foreground">
              <Icon className="h-4 w-4" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">{industryLabels[project.industry]}</Badge>
            <Badge className={cn("border", statusClasses[project.status])}>
              {project.status}
            </Badge>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {project.modules.slice(0, 4).map((module) => (
              <span
                key={module}
                className="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground"
              >
                {module}
              </span>
            ))}
            {project.modules.length > 4 ? (
              <span className="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
                +{project.modules.length - 4}
              </span>
            ) : null}
          </div>

          <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
            <div className="flex -space-x-2">
              {visibleMembers.length ? (
                visibleMembers.map((member) => (
                  <Avatar key={member.user.email} className="h-7 w-7 border-2 border-background">
                    <AvatarImage src={member.user.avatarUrl ?? undefined} alt="" />
                    <AvatarFallback className="text-[10px]">
                      {initials(member.user.name, member.user.email)}
                    </AvatarFallback>
                  </Avatar>
                ))
              ) : (
                <span>No team assigned</span>
              )}
            </div>
            <span>
              Updated {formatDistanceToNow(project.updatedAt, { addSuffix: true })}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
