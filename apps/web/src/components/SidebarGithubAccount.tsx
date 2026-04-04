import {
  ChevronsUpDownIcon,
  GithubIcon,
  RefreshCwIcon,
  SettingsIcon,
  SquareArrowOutUpRightIcon,
} from "lucide-react";
import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import type { ServerProviderAuth } from "@t3tools/contracts";

import { useServerConfig, useServerProviders } from "../rpc/serverState";
import { ensureNativeApi } from "../nativeApi";
import { cn } from "../lib/utils";
import {
  Menu,
  MenuGroup,
  MenuGroupLabel,
  MenuItem,
  MenuPopup,
  MenuSeparator,
  MenuTrigger,
} from "./ui/menu";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "./ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Skeleton } from "./ui/skeleton";

/** GitHub login: alphanumeric + hyphens, no leading/trailing/consecutive hyphens, ≤39 chars. */
function isProbablyGithubUsername(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length < 1 || trimmed.length > 39) return false;
  if (trimmed.startsWith("-") || trimmed.endsWith("-") || /--/.test(trimmed)) return false;
  return /^[a-zA-Z0-9-]+$/.test(trimmed);
}

function avatarFallbackText(label: string): string {
  const cleaned = label.replace(/[^a-z\d]/gi, "").slice(0, 2);
  if (cleaned.length >= 2) {
    return cleaned.toUpperCase();
  }
  return label.slice(0, 2).toUpperCase();
}

function githubAvatarUrl(login: string): string {
  return `https://avatars.githubusercontent.com/${encodeURIComponent(login.trim())}?s=64&v=4`;
}

function copilotAuthSubtitle(
  auth: ServerProviderAuth,
  message: string | undefined,
): string | undefined {
  const org = auth.organization;
  let typ = auth.type;
  if (org != null && org.length > 0 && typ === "GitHub.com") {
    typ = undefined;
  }
  if (org && typ) {
    return `${org} · ${typ}`;
  }
  if (org) {
    return org;
  }
  if (typ) {
    return typ;
  }
  const trimmed = message?.trim();
  if (trimmed && trimmed.length > 2 && !/^github$/i.test(trimmed)) {
    return trimmed;
  }
  return undefined;
}

function accountHoverLines(parts: ReadonlyArray<string | undefined | null>): string {
  return parts.filter((p): p is string => typeof p === "string" && p.length > 0).join("\n");
}

function FootnoteLines({ children, title }: { children: ReactNode; title?: string }) {
  return (
    <span className="line-clamp-2 min-w-0 break-words text-left" title={title}>
      {children}
    </span>
  );
}

export function SidebarGithubAccount() {
  const navigate = useNavigate();
  const { isMobile } = useSidebar();
  const serverConfig = useServerConfig();
  const providers = useServerProviders();
  const [menuOpen, setMenuOpen] = useState(false);
  const refreshingRef = useRef(false);

  const copilot = useMemo(() => providers.find((row) => row.provider === "copilot"), [providers]);

  const refreshProviders = useCallback(() => {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    void ensureNativeApi()
      .server.refreshProviders()
      .catch((error: unknown) => {
        console.warn("Failed to refresh providers", error);
      })
      .finally(() => {
        refreshingRef.current = false;
      });
  }, []);

  if (serverConfig === null) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <div className="flex items-center gap-2 px-2 py-2">
            <Skeleton className="size-8 shrink-0 rounded-lg" />
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <Skeleton className="h-3.5 w-24 rounded" />
              <Skeleton className="h-3 w-16 rounded" />
            </div>
          </div>
        </SidebarMenuItem>
      </SidebarMenu>
    );
  }

  if (!copilot?.enabled) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton
            size="lg"
            tooltip="Settings"
            className="gap-2 px-2 text-muted-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            onClick={() => void navigate({ to: "/settings" })}
          >
            <SettingsIcon className="size-4 shrink-0" />
            <span className="truncate text-sm font-medium">Settings</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    );
  }

  if (!copilot.installed) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton
            size="lg"
            tooltip="Set up GitHub Copilot"
            className="gap-2 px-2 text-muted-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            onClick={() => void navigate({ to: "/settings/general" })}
          >
            <GithubIcon className="size-4 shrink-0" />
            <div className="grid min-w-0 flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">GitHub Copilot</span>
              <span className="truncate text-muted-foreground text-xs">Install or configure</span>
            </div>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    );
  }

  if (copilot.auth.status === "unauthenticated") {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton
            size="lg"
            tooltip="Sign in to GitHub (Copilot)"
            className="gap-2 px-2 text-muted-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            onClick={() => void navigate({ to: "/settings/general" })}
          >
            <GithubIcon className="size-4 shrink-0" />
            <div className="grid min-w-0 flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">GitHub Copilot</span>
              <span className="truncate text-muted-foreground text-xs">Sign in to continue</span>
            </div>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    );
  }

  if (copilot.auth.status === "authenticated") {
    const label = copilot.auth.label ?? "GitHub";
    const subtitle = copilotAuthSubtitle(copilot.auth, copilot.message);
    const enterpriseHost = copilot.auth.enterpriseHost;
    const showGithubAvatar = isProbablyGithubUsername(label);
    const sidebarTooltip = accountHoverLines([
      label,
      subtitle,
      enterpriseHost != null && enterpriseHost.length > 0 ? `GitHub host: ${enterpriseHost}` : null,
    ]);

    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <Menu open={menuOpen} onOpenChange={setMenuOpen}>
            <MenuTrigger
              render={
                <SidebarMenuButton
                  size="lg"
                  tooltip={sidebarTooltip}
                  className={cn(
                    "h-auto min-h-12 gap-2 py-2 text-sidebar-foreground",
                    menuOpen && "bg-sidebar-accent text-sidebar-accent-foreground",
                  )}
                />
              }
            >
              <Avatar className="size-8 shrink-0 rounded-lg after:rounded-lg">
                {showGithubAvatar ? <AvatarImage src={githubAvatarUrl(label)} alt={label} /> : null}
                <AvatarFallback className="rounded-lg text-xs">
                  {avatarFallbackText(label)}
                </AvatarFallback>
              </Avatar>
              <div className="grid min-w-0 flex-1 gap-0.5 text-left text-sm leading-snug">
                <FootnoteLines title={label}>
                  <span className="font-semibold">{label}</span>
                </FootnoteLines>
                {subtitle ? (
                  <FootnoteLines
                    title={accountHoverLines([
                      subtitle,
                      enterpriseHost ? `GitHub host: ${enterpriseHost}` : null,
                    ])}
                  >
                    <span className="text-muted-foreground text-xs">{subtitle}</span>
                  </FootnoteLines>
                ) : null}
              </div>
              <ChevronsUpDownIcon className="ms-auto size-4 shrink-0 opacity-70" />
            </MenuTrigger>
            <MenuPopup
              className="min-w-56 rounded-lg"
              align="end"
              side={isMobile ? "bottom" : "right"}
              sideOffset={4}
            >
              <MenuGroup>
                <MenuGroupLabel className="p-0 font-normal">
                  <div className="flex max-w-72 items-center gap-2 px-2 py-1.5 text-left text-sm">
                    <Avatar className="size-8 shrink-0 rounded-lg after:rounded-lg">
                      {showGithubAvatar ? (
                        <AvatarImage src={githubAvatarUrl(label)} alt={label} />
                      ) : null}
                      <AvatarFallback className="rounded-lg text-xs">
                        {avatarFallbackText(label)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="grid min-w-0 flex-1 gap-1 leading-snug">
                      <span className="whitespace-normal break-words font-semibold">{label}</span>
                      {subtitle ? (
                        <span className="whitespace-normal break-words text-muted-foreground text-xs">
                          {subtitle}
                        </span>
                      ) : null}
                      {enterpriseHost ? (
                        <span className="whitespace-normal break-words text-[11px] text-muted-foreground/80">
                          {enterpriseHost}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </MenuGroupLabel>
              </MenuGroup>
              <MenuSeparator />
              <MenuGroup>
                <MenuItem
                  onClick={() => {
                    setMenuOpen(false);
                    void navigate({ to: "/settings" });
                  }}
                >
                  <SettingsIcon />
                  Settings
                </MenuItem>
                <MenuItem
                  onClick={() => {
                    setMenuOpen(false);
                    refreshProviders();
                  }}
                >
                  <RefreshCwIcon />
                  Refresh provider status
                </MenuItem>
                <MenuItem
                  onClick={() => {
                    setMenuOpen(false);
                    window.open("https://github.com/settings", "_blank", "noopener,noreferrer");
                  }}
                >
                  <SquareArrowOutUpRightIcon />
                  GitHub account on web
                </MenuItem>
              </MenuGroup>
            </MenuPopup>
          </Menu>
        </SidebarMenuItem>
      </SidebarMenu>
    );
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          size="sm"
          disabled
          className="gap-2 px-2 py-1.5 text-muted-foreground/60"
          tooltip="Copilot status"
        >
          <GithubIcon className="size-3.5 shrink-0" />
          <span className="truncate text-xs">Checking GitHub…</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
