"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { BriefPanel } from "@/components/intelligence/brief-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type PillarTopic = {
  topic: string;
  targetKeyword: string;
  searchIntent: string;
  priority: "high" | "medium" | "low";
  exists: boolean;
  existingUrl?: string;
};

type ClusterTopic = {
  pillar: string;
  topic: string;
  targetKeyword: string;
  wordCount: number;
  priority: "high" | "medium" | "low";
  status: "existing" | "gap" | "in_progress";
  existingUrl?: string;
};

type TopicMapViewModel = {
  id: string;
  niche: string;
  pillarTopics: PillarTopic[];
  clusterTopics: ClusterTopic[];
  coverageScore: number;
  lastGeneratedAt: string;
};

function CoverageRing({ score }: { score: number }) {
  const radius = 46;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="relative h-32 w-32">
      <svg className="h-32 w-32 -rotate-90" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={radius} stroke="currentColor" strokeWidth="10" fill="none" className="text-muted" />
        <circle
          cx="60"
          cy="60"
          r={radius}
          stroke="currentColor"
          strokeWidth="10"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="text-primary"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-2xl font-semibold">
        {score}%
      </div>
    </div>
  );
}

export function TopicMapSetup({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [niche, setNiche] = useState("");
  const [targetAudience, setTargetAudience] = useState("");
  const [existingPagesText, setExistingPagesText] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setError(null);
    setIsGenerating(true);

    const existingPages = existingPagesText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((url) => ({ url, title: url }));

    try {
      const response = await fetch(`/api/projects/${projectId}/intelligence/topic-map`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ niche, targetAudience, existingPages }),
      });
      const data = (await response.json()) as { error?: string };

      if (!response.ok || data.error) {
        setError(data.error ?? "Could not generate topic map.");
        return;
      }

      router.refresh();
    } catch {
      setError("Could not generate topic map.");
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <Card className="rounded-lg">
      <CardHeader>
        <CardTitle>Generate your topical map</CardTitle>
        <CardDescription>
          Describe the niche and audience. FlowIQ will map pillars, clusters, and gaps.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="niche">Niche description</label>
          <Textarea id="niche" value={niche} onChange={(event) => setNiche(event.target.value)} placeholder="Digital marketing agency Karachi" />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="audience">Target audience</label>
          <Textarea id="audience" value={targetAudience} onChange={(event) => setTargetAudience(event.target.value)} placeholder="Small business owners looking for SEO and lead generation" />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="pages">Existing pages, one URL per line</label>
          <Textarea id="pages" value={existingPagesText} onChange={(event) => setExistingPagesText(event.target.value)} placeholder="https://example.com/services/seo" />
        </div>
        {error ? <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</p> : null}
        <Button onClick={generate} disabled={isGenerating || niche.length < 3 || targetAudience.length < 3}>
          {isGenerating ? "Analysing your niche..." : "Analyse & generate map"}
        </Button>
      </CardContent>
    </Card>
  );
}

export function TopicMapView({
  projectId,
  topicMap,
}: {
  projectId: string;
  topicMap: TopicMapViewModel;
}) {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<"all" | "existing" | "gap" | "in_progress">("all");
  const [briefState, setBriefState] = useState({
    open: false,
    topic: "",
    targetKeyword: "",
    brief: "",
  });
  const [isGeneratingBrief, setIsGeneratingBrief] = useState<string | null>(null);

  const filteredClusters = useMemo(
    () =>
      statusFilter === "all"
        ? topicMap.clusterTopics
        : topicMap.clusterTopics.filter((topic) => topic.status === statusFilter),
    [statusFilter, topicMap.clusterTopics],
  );

  async function generateBrief(topic: ClusterTopic) {
    setIsGeneratingBrief(topic.topic);

    try {
      const response = await fetch(`/api/projects/${projectId}/intelligence/brief`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: topic.topic,
          targetKeyword: topic.targetKeyword,
        }),
      });
      const data = (await response.json()) as { brief?: string; error?: string };

      if (!response.ok || !data.brief) {
        toast.error(data.error ?? "Could not generate brief");
        return;
      }

      setBriefState({
        open: true,
        topic: topic.topic,
        targetKeyword: topic.targetKeyword,
        brief: data.brief,
      });
    } catch {
      toast.error("Could not generate brief");
    } finally {
      setIsGeneratingBrief(null);
    }
  }

  return (
    <div className="space-y-6">
      <Card className="rounded-lg">
        <CardContent className="flex flex-col gap-6 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-5">
            <CoverageRing score={Math.round(topicMap.coverageScore)} />
            <div>
              <p className="text-sm font-medium text-muted-foreground">Coverage score</p>
              <h2 className="text-2xl font-semibold">{topicMap.niche}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Last generated {new Date(topicMap.lastGeneratedAt).toLocaleString()}
              </p>
            </div>
          </div>
          <Button variant="outline" onClick={() => router.refresh()}>Refresh map</Button>
        </CardContent>
      </Card>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {topicMap.pillarTopics.map((pillar) => (
          <Card key={pillar.topic} className={cn("rounded-lg border", pillar.exists ? "border-green-200" : "border-red-200")}>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle>{pillar.topic}</CardTitle>
                  <CardDescription>{pillar.targetKeyword}</CardDescription>
                </div>
                <Badge className={pillar.exists ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}>
                  {pillar.exists ? "Exists" : "Gap"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{pillar.searchIntent}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <Card className="rounded-lg">
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Cluster topics</CardTitle>
              <CardDescription>Filter gaps and generate briefs for missing topics.</CardDescription>
            </div>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
              className="h-9 rounded-md border bg-background px-3 text-sm"
            >
              <option value="all">All statuses</option>
              <option value="existing">Existing</option>
              <option value="gap">Gap</option>
              <option value="in_progress">In progress</option>
            </select>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Topic</TableHead>
                <TableHead>Keyword</TableHead>
                <TableHead>Word count</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredClusters.map((topic) => (
                <TableRow key={`${topic.pillar}-${topic.topic}`}>
                  <TableCell>{topic.topic}</TableCell>
                  <TableCell>{topic.targetKeyword}</TableCell>
                  <TableCell>{topic.wordCount}</TableCell>
                  <TableCell><Badge variant="outline">{topic.priority}</Badge></TableCell>
                  <TableCell><Badge variant="outline">{topic.status}</Badge></TableCell>
                  <TableCell>
                    {topic.status === "gap" ? (
                      <Button size="sm" onClick={() => generateBrief(topic)} disabled={isGeneratingBrief === topic.topic}>
                        {isGeneratingBrief === topic.topic ? "Generating..." : "Generate brief"}
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">No action</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <BriefPanel
        projectId={projectId}
        topic={briefState.topic}
        targetKeyword={briefState.targetKeyword}
        brief={briefState.brief}
        open={briefState.open}
        onOpenChange={(open) => setBriefState((current) => ({ ...current, open }))}
      />
    </div>
  );
}
