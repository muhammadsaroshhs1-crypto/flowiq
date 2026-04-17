"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function InviteMemberForm() {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("EXECUTOR");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/workspace/members/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role }),
      });
      const data = (await response.json()) as { error?: string; message?: string };

      if (!response.ok || data.error) {
        toast.error(data.error ?? "Could not send invite");
        return;
      }

      toast.success(data.message ?? "Invitation sent");
      setEmail("");
      setRole("EXECUTOR");
    } catch {
      toast.error("Could not send invite");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="flex flex-col gap-3 sm:flex-row" onSubmit={submit}>
      <Input
        type="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="teammate@example.com"
        required
      />
      <select
        value={role}
        onChange={(event) => setRole(event.target.value)}
        className="h-9 rounded-md border bg-background px-3 text-sm"
      >
        <option value="MANAGER">Manager</option>
        <option value="EXECUTOR">Executor</option>
        <option value="VIEWER">Viewer</option>
      </select>
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Inviting..." : "Invite"}
      </Button>
    </form>
  );
}
