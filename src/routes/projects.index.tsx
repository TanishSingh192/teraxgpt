import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, FolderOpen, Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useSession } from "@/hooks/useSession";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/projects/")({
  head: () => ({
    meta: [
      { title: "Projects · TeraX CPT" },
      {
        name: "description",
        content:
          "Group your work into projects with their own instructions, files, memory, conversations and artifacts.",
      },
      { property: "og:title", content: "Projects · TeraX CPT" },
      {
        property: "og:description",
        content: "Persistent project workspaces with instructions, files, memory and artifacts.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProjectsPage,
});

type ProjectRow = { id: string; name: string; description: string; updated_at: string };

function ProjectsPage() {
  const navigate = useNavigate();
  const { session, loading } = useSession();
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!loading && !session) void navigate({ to: "/auth" });
  }, [loading, session, navigate]);

  const refresh = useCallback(async () => {
    const { data } = await supabase
      .from("projects")
      .select("id,name,description,updated_at")
      .order("updated_at", { ascending: false });
    setProjects((data as ProjectRow[]) ?? []);
  }, []);

  useEffect(() => {
    if (session) void refresh();
  }, [session, refresh]);

  async function createProject() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setCreating(true);
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id;
    if (!userId) return;
    const { data, error } = await supabase
      .from("projects")
      .insert({ user_id: userId, name: trimmed, description: description.trim() })
      .select("id")
      .single();
    setCreating(false);
    if (error || !data) {
      toast.error("Could not create that project.");
      return;
    }
    setName("");
    setDescription("");
    void navigate({ to: "/projects/$projectId", params: { projectId: data.id } });
  }

  if (loading || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-panel">
        <span className="text-[13px] text-subtle">Loading your projects…</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-panel text-ink">
      <div className="mx-auto max-w-[820px] px-5 py-10">
        <Link to="/" className="mb-6 inline-flex items-center gap-1.5 text-[13px] text-subtle">
          <ArrowLeft className="size-3.5" /> Back to chat
        </Link>
        <h1 className="font-display text-[28px] font-semibold">Projects</h1>
        <p className="mt-1 text-[14px] text-subtle">
          Each project keeps its own instructions, files, memory, conversations and artifacts.
        </p>

        <div className="mt-6 rounded-2xl border border-line bg-background p-4">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Project name"
            className="w-full bg-transparent text-[15px] font-medium outline-none placeholder:text-subtle"
          />
          <input
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="What is this project about?"
            className="mt-2 w-full bg-transparent text-[13px] outline-none placeholder:text-subtle"
          />
          <Button
            onClick={() => void createProject()}
            disabled={creating || !name.trim()}
            className="mt-3 rounded-xl bg-ink text-primary-foreground shadow-none hover:bg-ink/90"
          >
            <Plus /> Create project
          </Button>
        </div>

        <div className="mt-8 grid gap-2">
          {projects.length === 0 ? (
            <p className="text-[13px] text-subtle">No projects yet.</p>
          ) : (
            projects.map((project) => (
              <Link
                key={project.id}
                to="/projects/$projectId"
                params={{ projectId: project.id }}
                className="flex items-center gap-3 rounded-xl border border-line bg-background px-4 py-3 hover:bg-signal-soft"
              >
                <FolderOpen className="size-4 text-subtle" />
                <span className="min-w-0">
                  <span className="block truncate text-[14px] font-medium">{project.name}</span>
                  {project.description && (
                    <span className="block truncate text-[12px] text-subtle">
                      {project.description}
                    </span>
                  )}
                </span>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
