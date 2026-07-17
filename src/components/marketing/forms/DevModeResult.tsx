import { Info } from "lucide-react";
import { Text } from "@/components/ui/Typography";

export function DevModeResult({ message }: { message: string }) {
  return (
    <div
      role="status"
      className="flex items-start gap-3 rounded-2xl border border-cobalt/30 bg-cobalt/5 p-4"
    >
      <Info size={18} className="mt-0.5 shrink-0 text-cobalt" aria-hidden="true" />
      <Text className="text-sm text-ink">{message}</Text>
    </div>
  );
}
