"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { canShowAdminHeaderLink } from "@/lib/auth/header-navigation";
import { createClient } from "@/lib/supabase/client";
import type { UserRole, UserStatus } from "@/types/domain";

export function AdminHeaderLink() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let active = true;
    let requestId = 0;

    async function syncVisibility(userId?: string) {
      const currentRequestId = ++requestId;
      let resolvedUserId = userId;

      if (!resolvedUserId) {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        resolvedUserId = user?.id;
      }

      if (!resolvedUserId) {
        if (active && currentRequestId === requestId) setVisible(false);
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role, status")
        .eq("id", resolvedUserId)
        .maybeSingle();

      if (!active || currentRequestId !== requestId) return;

      setVisible(
        canShowAdminHeaderLink(
          profile
            ? {
                role: profile.role as UserRole,
                status: profile.status as UserStatus,
              }
            : null,
        ),
      );
    }

    void syncVisibility();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        requestId += 1;
        setVisible(false);
        return;
      }

      window.setTimeout(() => {
        void syncVisibility(session.user.id);
      }, 0);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  if (!visible) return null;

  return (
    <Link
      href="/admin"
      className="rounded-lg px-2 py-2 text-sm font-medium text-cobalt-700 transition-colors hover:bg-cobalt-50 hover:text-cobalt-800 sm:px-3 dark:text-cobalt-300 dark:hover:bg-cobalt-950/60 dark:hover:text-cobalt-200"
    >
      Admin
    </Link>
  );
}
