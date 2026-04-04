import type { KnowledgeFileCategory, KnowledgeTreeEntry } from "@t3tools/contracts";
import { useQuery } from "@tanstack/react-query";
import { ChevronRightIcon } from "lucide-react";
import { useMemo, useState } from "react";

import ChatMarkdown from "~/components/ChatMarkdown";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { cn } from "~/lib/utils";
import { useSettings } from "~/hooks/useSettings";
import { ensureNativeApi } from "~/nativeApi";
import { resolveAndPersistPreferredEditor } from "~/editorPreferences";
import { useServerAvailableEditors } from "~/rpc/serverState";

import { SettingsPageContainer } from "./SettingsPanels";

function joinKnowledgePath(root: string, relPosix: string): string {
  const cleanRoot = root.replace(/[/\\]+$/, "");
  const segments = relPosix.split("/").filter(Boolean);
  if (root.includes("\\")) {
    return [cleanRoot, ...segments].join("\\");
  }
  return [cleanRoot, ...segments].join("/");
}

function filterTree(
  entries: ReadonlyArray<KnowledgeTreeEntry>,
  needle: string,
): KnowledgeTreeEntry[] {
  const q = needle.trim().toLowerCase();
  if (!q) return [...entries];
  const walk = (e: KnowledgeTreeEntry): KnowledgeTreeEntry | null => {
    if (e.type === "file") {
      return e.path.toLowerCase().includes(q) ? e : null;
    }
    const children = (e.children ?? []).map(walk).filter(Boolean) as KnowledgeTreeEntry[];
    if (children.length > 0) return { ...e, children };
    return e.path.toLowerCase().includes(q) ? { ...e, children: [] } : null;
  };
  return entries.map(walk).filter(Boolean) as KnowledgeTreeEntry[];
}

const CATEGORY_LABEL: Record<KnowledgeFileCategory, string> = {
  skill: "Skill",
  agent: "Agent",
  prompt: "Prompt",
  knowledge: "Knowledge",
  standard: "Standard",
  config: "Config",
  instructions: "Instructions",
  file: "File",
};

function TreeNode({
  entry,
  depth,
  selectedRel,
  onSelectFile,
}: {
  entry: KnowledgeTreeEntry;
  depth: number;
  selectedRel: string | null;
  onSelectFile: (rel: string) => void;
}) {
  const [open, setOpen] = useState(depth < 2);
  if (entry.type === "dir") {
    const children = entry.children ?? [];
    return (
      <div className="select-none">
        <button
          type="button"
          className={cn(
            "flex w-full items-center gap-0.5 rounded-md px-1 py-0.5 text-start text-xs hover:bg-muted/80",
          )}
          style={{ paddingLeft: 4 + depth * 10 }}
          onClick={() => setOpen(!open)}
        >
          <ChevronRightIcon
            className={cn("size-3.5 shrink-0 transition-transform", open ? "rotate-90" : "")}
          />
          <span className="truncate font-medium">{entry.name}</span>
        </button>
        {open ? (
          <div>
            {children.map((ch) => (
              <TreeNode
                key={ch.path}
                entry={ch}
                depth={depth + 1}
                selectedRel={selectedRel}
                onSelectFile={onSelectFile}
              />
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  const active = selectedRel === entry.path;
  return (
    <button
      type="button"
      className={cn(
        "flex w-full items-center gap-1 rounded-md px-1 py-0.5 text-start text-xs hover:bg-muted/80",
        active && "bg-muted",
      )}
      style={{ paddingLeft: 8 + depth * 10 }}
      onClick={() => onSelectFile(entry.path)}
    >
      <span className="truncate">{entry.name}</span>
      {entry.category ? (
        <span className="ms-auto shrink-0 rounded bg-muted px-1 text-[10px] text-muted-foreground">
          {CATEGORY_LABEL[entry.category]}
        </span>
      ) : null}
    </button>
  );
}

export function MeridianExplorerPage() {
  const settings = useSettings();
  const root = settings.globalKnowledgeRoot.trim();
  const [filter, setFilter] = useState("");
  const [selectedRel, setSelectedRel] = useState<string | null>(null);

  const treeQuery = useQuery({
    queryKey: ["meridianTree", root],
    queryFn: () => ensureNativeApi().knowledge.listTree(),
  });

  const entries = useMemo(() => {
    const raw = treeQuery.data?.entries ?? [];
    return filterTree(raw, filter);
  }, [filter, treeQuery.data?.entries]);

  const absPath = useMemo(() => {
    if (!selectedRel || !treeQuery.data?.root) return null;
    return joinKnowledgePath(treeQuery.data.root, selectedRel);
  }, [selectedRel, treeQuery.data?.root]);

  const fileQuery = useQuery({
    queryKey: ["meridianFile", absPath],
    queryFn: () => ensureNativeApi().knowledge.readFile({ path: absPath! }),
    enabled: Boolean(absPath),
  });

  const availableEditors = useServerAvailableEditors();

  const openInEditor = () => {
    if (!absPath) return;
    const editor = resolveAndPersistPreferredEditor(availableEditors ?? []);
    if (!editor) return;
    void ensureNativeApi().shell.openInEditor(absPath, editor);
  };

  const content = fileQuery.data?.content ?? "";
  const isMd = Boolean(
    selectedRel?.toLowerCase().endsWith(".md") || selectedRel?.toLowerCase().endsWith(".mdc"),
  );

  return (
    <SettingsPageContainer>
      <div className="flex min-h-[calc(100dvh-9rem)] flex-col gap-3 md:flex-row md:gap-0 md:divide-x">
        <div className="flex min-h-0 w-full min-w-0 flex-col md:max-w-xs md:shrink-0">
          <div className="border-b p-2">
            <Input
              placeholder="Filter paths…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="h-8 text-xs"
            />
            {treeQuery.data?.truncated ? (
              <p className="mt-1 text-[10px] text-amber-600">
                Tree truncated — repository is very large.
              </p>
            ) : null}
            {treeQuery.isError ? (
              <p className="mt-1 text-[10px] text-destructive">Could not load knowledge tree.</p>
            ) : null}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {treeQuery.isFetching ? (
              <p className="text-xs text-muted-foreground">Loading tree…</p>
            ) : (
              entries.map((e) => (
                <TreeNode
                  key={e.path}
                  entry={e}
                  depth={0}
                  selectedRel={selectedRel}
                  onSelectFile={setSelectedRel}
                />
              ))
            )}
          </div>
        </div>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col border-t md:border-t-0">
          <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
            <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-muted-foreground">
              {absPath ?? "Select a file"}
            </span>
            <Button
              type="button"
              size="xs"
              variant="outline"
              disabled={!absPath}
              onClick={openInEditor}
            >
              Open in editor
            </Button>
          </div>
          {fileQuery.data?.frontmatter ? (
            <div className="border-b bg-muted/40 px-3 py-2 font-mono text-[10px] whitespace-pre-wrap text-muted-foreground">
              {fileQuery.data.frontmatter}
            </div>
          ) : null}
          <div className="min-h-0 flex-1 overflow-y-auto p-3 text-sm">
            {fileQuery.isFetching ? (
              <p className="text-xs text-muted-foreground">Loading…</p>
            ) : fileQuery.isError ? (
              <p className="text-xs text-destructive">Could not read file.</p>
            ) : isMd ? (
              <ChatMarkdown text={content} cwd={undefined} />
            ) : (
              <pre className="text-xs whitespace-pre-wrap font-mono">{content}</pre>
            )}
          </div>
        </div>
      </div>
    </SettingsPageContainer>
  );
}
