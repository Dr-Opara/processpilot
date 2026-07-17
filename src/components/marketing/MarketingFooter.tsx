import Link from "next/link";
import { Container, Stack } from "@/components/ui/Layout";
import { Text } from "@/components/ui/Typography";
import { footerColumns, legalLinks } from "@/content/site";

export function MarketingFooter() {
  return (
    <footer className="border-t border-border/70 bg-surface">
      <Container className="py-14">
        <div className="grid gap-10 lg:grid-cols-[1.2fr_2fr]">
          <Stack className="gap-4">
            <Link href="/" className="flex items-center gap-2">
              <span className="text-base font-semibold text-ink">ProcessPilot</span>
            </Link>
            <Text className="max-w-xs text-sm text-muted">
              The operating system for repeatable work: knowledge, workflows, training, and evidence
              in one place.
            </Text>
          </Stack>
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:grid-cols-5">
            {footerColumns.map((column) => (
              <Stack key={column.title} className="gap-3">
                <Text className="text-sm font-semibold text-ink">{column.title}</Text>
                <ul className="flex flex-col gap-2">
                  {column.links.map((link) => (
                    <li key={link.href}>
                      <a href={link.href} className="text-sm text-muted hover:text-ink">
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </Stack>
            ))}
          </div>
        </div>
      </Container>
      <div className="border-t border-border/70">
        <Container className="flex flex-col gap-3 py-6 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
          <Text className="text-sm text-muted">© 2026 ProcessPilot. All rights reserved.</Text>
          <div className="flex gap-4">
            {legalLinks.map((link) => (
              <a key={link.href} href={link.href} className="hover:text-ink">
                {link.label}
              </a>
            ))}
            <Link href="/design-system" className="hover:text-ink">
              Design system
            </Link>
          </div>
        </Container>
      </div>
    </footer>
  );
}
