import { Suspense } from "react";
import { SignInForm } from "@/components/auth/sign-in-form";

function SignInFallback() {
  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 py-20 dark:bg-zinc-950">
      <p className="text-zinc-500">Loading…</p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<SignInFallback />}>
      <SignInForm />
    </Suspense>
  );
}
