import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Moderation",
  robots: { index: false, follow: false },
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-x-0 top-16 bottom-0 z-40 flex flex-col overflow-hidden bg-white dark:bg-zinc-950">
      {children}
    </div>
  );
}
