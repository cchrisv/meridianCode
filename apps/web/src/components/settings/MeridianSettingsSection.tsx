import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { BrainCircuitIcon, ChevronDownIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Equal } from "effect";

import { DEFAULT_UNIFIED_SETTINGS } from "@t3tools/contracts/settings";
import { APP_BASE_NAME } from "../../branding";
import { Button, buttonVariants } from "~/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "~/components/ui/collapsible";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { cn } from "~/lib/utils";
import { useSettings, useUpdateSettings } from "~/hooks/useSettings";
import { ensureNativeApi } from "~/nativeApi";
import { MeridianKnowledgeCoresChips } from "./MeridianKnowledgeCoresChips";
import { MeridianSyncDialog } from "./MeridianSyncDialog";
import { SettingResetButton, SettingsRow, SettingsSection } from "./SettingsPanels";

function parseLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

export function MeridianSettingsSection() {
  const settings = useSettings();
  const { updateSettings } = useUpdateSettings();
  const [syncOpen, setSyncOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const root = settings.globalKnowledgeRoot.trim();

  const statusQuery = useQuery({
    queryKey: ["meridianKnowledgeStatus", root],
    queryFn: () => ensureNativeApi().server.getKnowledgeStatus(),
    staleTime: 60_000,
    refetchInterval: 120_000,
  });

  const status = statusQuery.data ?? null;

  const statusDot = useMemo(() => {
    if (!status?.git?.isRepo) return "bg-amber-500";
    if (status.git.behindCount > 0) return "bg-amber-500";
    if (status.git.hasWorkingTreeChanges) return "bg-amber-500";
    return "bg-emerald-500";
  }, [status]);

  const skillDirsTextInitial = settings.providers.copilot.skillDirectories.join("\n");
  const disabledSkillsTextInitial = settings.providers.copilot.disabledSkills.join("\n");
  const [skillDirsText, setSkillDirsText] = useState(skillDirsTextInitial);
  const [disabledSkillsText, setDisabledSkillsText] = useState(disabledSkillsTextInitial);

  useEffect(() => {
    setSkillDirsText(settings.providers.copilot.skillDirectories.join("\n"));
    setDisabledSkillsText(settings.providers.copilot.disabledSkills.join("\n"));
  }, [settings.providers.copilot.skillDirectories, settings.providers.copilot.disabledSkills]);

  const applySkillOverrides = useCallback(() => {
    updateSettings({
      providers: {
        ...settings.providers,
        copilot: {
          ...settings.providers.copilot,
          skillDirectories: parseLines(skillDirsText),
          disabledSkills: parseLines(disabledSkillsText),
        },
      },
    });
  }, [disabledSkillsText, settings.providers, skillDirsText, updateSettings]);

  const meridianDirty =
    !Equal.equals(
      settings.providers.copilot.skillDirectories,
      DEFAULT_UNIFIED_SETTINGS.providers.copilot.skillDirectories,
    ) ||
    !Equal.equals(
      settings.providers.copilot.disabledSkills,
      DEFAULT_UNIFIED_SETTINGS.providers.copilot.disabledSkills,
    );

  return (
    <>
      <SettingsSection
        title="Meridian Brain"
        headerAction={
          <Link
            to="/settings/meridian"
            className={cn(buttonVariants({ variant: "ghost", size: "xs" }), "gap-1 no-underline")}
          >
            <BrainCircuitIcon className="size-3.5" />
            Explore
          </Link>
        }
      >
        <>
          {status && status.git && status.git.behindCount > 0 ? (
            <div className="mx-3 mb-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <span>
                  Meridian Brain is {status.git.behindCount} commit
                  {status.git.behindCount === 1 ? "" : "s"} behind upstream.
                </span>
                <Button size="xs" variant="outline" onClick={() => setSyncOpen(true)}>
                  Review &amp; sync
                </Button>
              </div>
            </div>
          ) : null}
          <SettingsRow
            title="Status"
            description="Connection state for the bundled knowledge root."
            control={
              <div className="flex items-center gap-2">
                <span className={cn("size-2.5 shrink-0 rounded-full", statusDot)} />
                <span className="text-xs text-muted-foreground">
                  {status?.git?.isRepo
                    ? `${status.git.branch ?? "detached"} · ${status.git.upstreamLabel ?? "no upstream"}`
                    : statusQuery.isFetching
                      ? "Checking…"
                      : "Not a git repo"}
                </span>
              </div>
            }
          />
          <SettingsRow
            title="Knowledge layout"
            description="Detected areas under this tree: core/knowledge, shared/knowledge, and platforms/*."
          >
            {statusQuery.isFetching && !status ? (
              <p className="text-xs text-muted-foreground">Checking…</p>
            ) : status?.structure ? (
              <MeridianKnowledgeCoresChips structure={status.structure} />
            ) : (
              <p className="text-xs text-muted-foreground">
                Structure unavailable — scan failed. Try Refresh status below.
              </p>
            )}
          </SettingsRow>
          <SettingsRow
            title="Knowledge root"
            description={`Built-in Meridian Brain tree shipped with ${APP_BASE_NAME} (read-only path).`}
            resetAction={
              meridianDirty ? (
                <SettingResetButton
                  label="Meridian Brain overrides"
                  onClick={() =>
                    updateSettings({
                      providers: {
                        ...settings.providers,
                        copilot: {
                          ...settings.providers.copilot,
                          skillDirectories:
                            DEFAULT_UNIFIED_SETTINGS.providers.copilot.skillDirectories,
                          disabledSkills: DEFAULT_UNIFIED_SETTINGS.providers.copilot.disabledSkills,
                        },
                      },
                    })
                  }
                />
              ) : null
            }
            control={
              <div className="flex w-full max-w-md flex-col gap-2">
                <Input value={root} readOnly className="font-mono text-xs" />
                <div className="flex flex-wrap gap-1.5">
                  <Button
                    size="xs"
                    variant="outline"
                    onClick={() => void statusQuery.refetch()}
                    disabled={statusQuery.isFetching}
                  >
                    Refresh status
                  </Button>
                  <Button size="xs" variant="outline" onClick={() => setSyncOpen(true)}>
                    Sync
                  </Button>
                </div>
              </div>
            }
          />
          <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen} className="border-t">
            <CollapsibleTrigger
              className={cn(
                "flex w-full items-center gap-1 px-4 py-3 text-start text-xs font-medium text-muted-foreground hover:text-foreground sm:px-5",
              )}
            >
              <ChevronDownIcon
                className={cn("size-3.5 transition-transform", advancedOpen ? "rotate-180" : "")}
              />
              Advanced — Copilot overrides
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="flex flex-col gap-3 px-4 pb-4 sm:px-5">
                <div className="space-y-1">
                  <div className="text-xs font-medium text-foreground">Skill directories</div>
                  <p className="text-xs text-muted-foreground">
                    One absolute path per line. Leave empty to use{" "}
                    <code className="rounded bg-muted px-1">.github/skills</code> under the
                    knowledge root.
                  </p>
                  <Textarea
                    value={skillDirsText}
                    onChange={(e) => setSkillDirsText(e.target.value)}
                    rows={3}
                    className="font-mono text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <div className="text-xs font-medium text-foreground">Disabled skills</div>
                  <Textarea
                    value={disabledSkillsText}
                    onChange={(e) => setDisabledSkillsText(e.target.value)}
                    rows={2}
                    placeholder={"skill-one\nskill-two"}
                    className="font-mono text-xs"
                  />
                </div>
                <Button size="xs" variant="outline" onClick={applySkillOverrides}>
                  Save overrides
                </Button>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </>
      </SettingsSection>

      <MeridianSyncDialog
        open={syncOpen}
        onOpenChange={setSyncOpen}
        status={status}
        onSynced={() => void statusQuery.refetch()}
      />
    </>
  );
}
