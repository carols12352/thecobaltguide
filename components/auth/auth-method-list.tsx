"use client";

import { AuthProviderIcon } from "@/components/auth/auth-provider-icon";
import { Badge } from "@/components/ui/badge";
import { formatProviderLabel } from "@/lib/auth/providers";
import { cn } from "@/lib/utils";

const OAUTH_PROVIDERS = ["google", "apple", "github"] as const;

const statusPillClass = "rounded-full px-3 py-1 text-xs font-medium";

interface AuthMethodListProps {
  linkedProviders: string[];
}

export function AuthMethodList({ linkedProviders }: AuthMethodListProps) {
  const linkedOAuth = OAUTH_PROVIDERS.filter((provider) =>
    linkedProviders.includes(provider),
  );

  if (linkedOAuth.length === 0) {
    return (
      <p className="text-sm text-zinc-500">No linked providers yet.</p>
    );
  }

  return (
    <ul className="space-y-2">
      {linkedOAuth.map((provider) => (
        <li key={provider}>
          <div className="flex w-full items-center justify-between gap-4 rounded-xl border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-700 dark:bg-zinc-900">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                <AuthProviderIcon provider={provider} className="h-5 w-5" />
              </div>
              <span className="truncate text-sm font-medium">
                {formatProviderLabel(provider)}
              </span>
            </div>
            <Badge
              variant="success"
              className={cn(
                statusPillClass,
                "dark:bg-emerald-950/50 dark:text-emerald-300",
              )}
            >
              Linked
            </Badge>
          </div>
        </li>
      ))}
    </ul>
  );
}
