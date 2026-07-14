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
