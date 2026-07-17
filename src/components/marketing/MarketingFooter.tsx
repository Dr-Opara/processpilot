import { Container } from "@/components/ui/Layout";
import { Text } from "@/components/ui/Typography";

export function MarketingFooter() {
  return (
    <footer className="border-t border-border/70 bg-surface">
      <Container className="flex flex-col gap-3 py-8 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
        <Text className="text-sm text-muted">© 2026 ProcessPilot</Text>
        <div className="flex gap-4">
          <a href="/design-system" className="hover:text-ink">
            Design system
          </a>
          <a href="#" className="hover:text-ink">
            Privacy
          </a>
        </div>
      </Container>
    </footer>
  );
}
