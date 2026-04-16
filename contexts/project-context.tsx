"use client";

import { createContext, useContext } from "react";

type ProjectContextValue = {
  project: {
    id: string;
    name: string;
    clientName: string | null;
    industry: string;
    status: string;
    modules: string[];
  };
};

const ProjectContext = createContext<ProjectContextValue | null>(null);

export function ProjectProvider({
  value,
  children,
}: Readonly<{
  value: ProjectContextValue;
  children: React.ReactNode;
}>) {
  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
}

export function useProject() {
  return useContext(ProjectContext);
}
