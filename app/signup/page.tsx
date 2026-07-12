import { Suspense } from "react";
import { SignUpForm } from "@/components/auth/sign-up-form";

function SignUpFallback() {
  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 py-20 dark:bg-zinc-950">
      <p className="text-zinc-500">Loading…</p>
    </div>
  );
}

export default function SignUpPage() {
  return (
    <Suspense fallback={<SignUpFallback />}>
      <SignUpForm />
    </Suspense>
  );
}
