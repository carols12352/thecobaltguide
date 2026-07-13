import { GoogleIcon } from "@/components/auth/auth-shell";

function EmailPasswordIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      aria-hidden="true"
    >
      <rect x="3" y="11" width="18" height="10" rx="2" />
      <path d="M7 11V8a5 5 0 0 1 10 0v3" strokeLinecap="round" />
      <circle cx="12" cy="16" r="1.25" fill="currentColor" stroke="none" />
    </svg>
  );
}

function AppleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M16.365 1.43c0 1.14-.417 2.043-1.252 2.708-.786.625-1.989.985-3.113.926-.046-1.084.398-2.138 1.113-2.792.787-.72 2.145-1.242 3.252-1.842zm2.678 16.08c-.735 1.063-1.086 1.542-2.029 2.483-.984.983-2.375 2.207-4.066 2.207-1.528 0-1.936-.984-3.999-.976-2.063.008-2.494.996-4.022.988-1.691-.008-2.978-1.15-3.962-2.133-2.715-2.703-3.015-7.404-1.332-9.515 1.188-1.512 3.071-2.396 4.857-2.396 1.806 0 2.944 1.004 4.436 1.004 1.444 0 2.312-1.004 4.394-1.004 1.571 0 3.213.855 4.401 2.334-3.874 2.1-3.247 7.576.323 9.192z" />
    </svg>
  );
}

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2C6.477 2 2 6.484 2 12.021c0 4.428 2.865 8.184 6.839 9.504.5.092.682-.217.682-.483 0-.237-.009-.868-.014-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0 0 22 12.021C22 6.484 17.522 2 12 2z" />
    </svg>
  );
}

export function AuthProviderIcon({
  provider,
  className,
}: {
  provider: string;
  className?: string;
}) {
  switch (provider) {
    case "google":
      return <GoogleIcon className={className} />;
    case "email":
      return <EmailPasswordIcon className={className} />;
    case "apple":
      return <AppleIcon className={className} />;
    case "github":
      return <GitHubIcon className={className} />;
    default:
      return null;
  }
}
