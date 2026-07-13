"use client";

import { useEffect, useState } from "react";
import { getEmailCooldownRemainingMs } from "@/lib/auth/email-cooldown";

export function useEmailCooldown(email: string): number {
  const [remainingMs, setRemainingMs] = useState(0);

  useEffect(() => {
    const tick = () => setRemainingMs(getEmailCooldownRemainingMs(email));
    tick();
    const intervalId = window.setInterval(tick, 1000);
    return () => window.clearInterval(intervalId);
  }, [email]);

  return remainingMs;
}

export function formatCooldownSeconds(remainingMs: number): number {
  return Math.ceil(remainingMs / 1000);
}
