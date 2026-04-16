"use client";

import type { SocialPlatform, SocialStatus } from "@prisma/client";
import { formatDistanceToNow } from "date-fns";
import { CalendarClock, MessageCircle, Send, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export type SocialQueueItemView = {
  id: string;
  projectId: string;
  sourceUrl: string;
  sourceTitle: string;
  platform: SocialPlatform;
  draft: string;
  status: SocialStatus;
  scheduledAt: Date | null;
  createdAt: Date;
};

const platformIcons = {
  LINKEDIN: Send,
  INSTAGRAM: CalendarClock,
  FACEBOOK: Users,
  TWITTER: MessageCircle,
};

const platformClasses = {
  LINKEDIN: "bg-sky-50 text-sky-700 border-sky-200",
  INSTAGRAM: "bg-pink-50 text-pink-700 border-pink-200",
  FACEBOOK: "bg-blue-50 text-blue-700 border-blue-200",
  TWITTER: "bg-gray-50 text-gray-700 border-gray-200",
};

const statusClasses = {
  PENDING_REVIEW: "bg-amber-50 text-amber-700 border-amber-200",
  APPROVED: "bg-green-50 text-green-700 border-green-200",
  SCHEDULED: "bg-blue-50 text-blue-700 border-blue-200",
  PUBLISHED: "bg-gray-50 text-gray-700 border-gray-200",
  REJECTED: "bg-red-50 text-red-700 border-red-200",
};

const platforms: SocialPlatform[] = ["LINKEDIN", "INSTAGRAM", "FACEBOOK", "TWITTER"];

export function SocialQueueItem({ item }: { item: SocialQueueItemView }) {
  const router = useRouter();
  const Icon = platformIcons[item.platform];
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(item.draft);
  const [platform, setPlatform] = useState<SocialPlatform>(item.platform);
  const [scheduledAt, setScheduledAt] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function patchItem(status: "APPROVED" | "REJECTED" | "SCHEDULED") {
    setIsLoading(true);

    try {
      const response = await fetch(`/api/projects/${item.projectId}/social/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          draft,
          status,
          scheduledAt: status === "SCHEDULED" && scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
        }),
      });
      const data = (await response.json()) as { error?: string };

      if (!response.ok || data.error) {
        toast.error(data.error ?? "Could not update social item");
        return;
      }

      toast.success(`Post ${status.toLowerCase().replace("_", " ")}`);
      setOpen(false);
      router.refresh();
    } catch {
      toast.error("Could not update social item");
    } finally {
      setIsLoading(false);
    }
  }

  async function regenerate() {
    setIsLoading(true);

    try {
      const response = await fetch(`/api/projects/${item.projectId}/social/regenerate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: item.id, platform }),
      });
      const data = (await response.json()) as { item?: SocialQueueItemView; error?: string };

      if (!response.ok || !data.item) {
        toast.error(data.error ?? "Could not regenerate draft");
        return;
      }

      setDraft(data.item.draft);
      toast.success("Draft regenerated");
      router.refresh();
    } catch {
      toast.error("Could not regenerate draft");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <>
      <div className="rounded-lg border bg-background p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className={cn("border", platformClasses[item.platform])}>
                <Icon className="h-3 w-3" />
                {item.platform}
              </Badge>
              <Badge className={cn("border", statusClasses[item.status])}>{item.status}</Badge>
            </div>
            <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">{item.draft}</p>
            <p className="mt-2 truncate text-xs text-muted-foreground">
              {item.sourceTitle} · {formatDistanceToNow(item.createdAt, { addSuffix: true })}
            </p>
          </div>
          <Button variant="outline" onClick={() => setOpen(true)}>Review</Button>
        </div>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
          <SheetHeader>
            <SheetTitle>{item.sourceTitle}</SheetTitle>
            <SheetDescription>
              <a href={item.sourceUrl} target="_blank" rel="noreferrer" className="underline underline-offset-4">
                {item.sourceUrl}
              </a>
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-4 px-4">
            <div className="flex flex-wrap gap-2">
              {platforms.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setPlatform(value)}
                  className={cn(
                    "rounded-md border px-3 py-1.5 text-sm",
                    platform === value ? "border-primary bg-primary text-primary-foreground" : "bg-background",
                  )}
                >
                  {value}
                </button>
              ))}
            </div>

            <Textarea
              className="min-h-80"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
            />

            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor={`schedule-${item.id}`}>
                Optional scheduled date
              </label>
              <input
                id={`schedule-${item.id}`}
                type="datetime-local"
                value={scheduledAt}
                onChange={(event) => setScheduledAt(event.target.value)}
                className="h-9 w-full rounded-md border bg-background px-3 text-sm"
              />
            </div>
          </div>

          <SheetFooter>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => patchItem(scheduledAt ? "SCHEDULED" : "APPROVED")} disabled={isLoading}>
                {scheduledAt ? "Schedule" : "Approve"}
              </Button>
              <Button variant="outline" onClick={() => patchItem("REJECTED")} disabled={isLoading}>
                Reject
              </Button>
              <Button variant="outline" onClick={regenerate} disabled={isLoading}>
                Regenerate
              </Button>
            </div>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}
