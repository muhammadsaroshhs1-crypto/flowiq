"use client";

import { useEffect } from "react";

export function AppInit() {
  useEffect(() => {
    void fetch("/api/init", { cache: "no-store" }).catch(() => undefined);
  }, []);

  return null;
}
