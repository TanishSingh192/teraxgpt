// Shared catalogue of the capabilities an agent can be granted.
// The server only builds the tools an agent is permitted to use, so a
// permission that was never granted cannot be called at all.

export type ToolId =
  | "web_search"
  | "open_source"
  | "generate_image"
  | "save_memory"
  | "save_artifact";

export type ToolSpec = {
  id: ToolId;
  label: string;
  description: string;
  /** Writing tools change stored data, so they can require your approval. */
  write: boolean;
};

export const TOOL_CATALOG: ToolSpec[] = [
  {
    id: "web_search",
    label: "Search the web",
    description: "Find live sources for a query.",
    write: false,
  },
  {
    id: "open_source",
    label: "Open a page",
    description: "Read the full text of a URL so it can be quoted and cited.",
    write: false,
  },
  {
    id: "generate_image",
    label: "Create images",
    description: "Generate an image from a written description.",
    write: false,
  },
  {
    id: "save_memory",
    label: "Save project memory",
    description: "Write a durable fact into the project's memory.",
    write: true,
  },
  {
    id: "save_artifact",
    label: "Save artifacts",
    description: "Store a finished output in the project's artifacts.",
    write: true,
  },
];

export const DEFAULT_AGENT_TOOLS: ToolId[] = ["web_search", "open_source"];

export function toolLabel(id: string) {
  return TOOL_CATALOG.find((tool) => tool.id === id)?.label ?? id;
}

export function isWriteTool(id: string) {
  return TOOL_CATALOG.some((tool) => tool.id === id && tool.write);
}
