import { Badge } from "@/components/ui/badge";

export function RewardsCanadaBadge({ className }: { className?: string }) {
  return (
    <Badge variant="muted" className={className}>
      <span
        className="mr-1.5 h-1.5 w-1.5 rounded-full bg-cobalt-500"
        aria-hidden="true"
      />
      <span aria-label="Source: Rewards Canada">Rewards Canada</span>
    </Badge>
  );
}
