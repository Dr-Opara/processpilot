"use client";

import { useEffect, useRef, useState } from "react";
import type { Route } from "next";
import Link from "next/link";
import { Menu, X, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Container, Stack } from "@/components/ui/Layout";
import { Heading } from "@/components/ui/Typography";
import { primaryNav, resourcesNav, pricingNav, type NavGroup } from "@/content/site";

function NavDropdown({ group }: { group: NavGroup }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, []);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((value) => !value)}
        className="flex items-center gap-1 text-sm font-medium text-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cobalt"
      >
        {group.label}
        <ChevronDown
          size={14}
          aria-hidden="true"
          className={`transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open ? (
        <div className="absolute left-1/2 top-full z-dropdown mt-3 w-80 -translate-x-1/2 rounded-2xl border border-border bg-surface p-3 shadow-soft">
          <a
            href={group.href}
            className="block rounded-xl px-3 py-2 text-sm font-semibold text-ink hover:bg-hover-surface"
            onClick={() => setOpen(false)}
          >
            All {group.label.toLowerCase()}
          </a>
          <div className="mt-1 grid gap-1">
            {group.items.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="rounded-xl px-3 py-2 text-sm text-muted hover:bg-hover-surface hover:text-ink"
                onClick={() => setOpen(false)}
              >
                <span className="block font-medium text-ink">{item.label}</span>
                {item.description ? (
                  <span className="mt-0.5 block text-xs text-muted">{item.description}</span>
                ) : null}
              </a>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function MarketingHeader() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);

  return (
    <header className="sticky top-0 z-sticky border-b border-border/70 bg-surface/90 backdrop-blur">
      <Container className="flex items-center justify-between py-4">
        <Link href="/" className="flex items-center gap-3">
          <Heading as="h2" className="text-lg">
            ProcessPilot
          </Heading>
        </Link>

        <nav className="hidden items-center gap-6 lg:flex" aria-label="Primary">
          {primaryNav.map((group) => (
            <NavDropdown key={group.label} group={group} />
          ))}
          <a href={resourcesNav.href} className="text-sm font-medium text-muted hover:text-ink">
            {resourcesNav.label}
          </a>
          <a href={pricingNav.href} className="text-sm font-medium text-muted hover:text-ink">
            {pricingNav.label}
          </a>
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <Link
            href={"/app/sign-in" as Route}
            className="text-sm font-medium text-muted hover:text-ink"
          >
            Sign in
          </Link>
          <Button href="/request-demo" variant="secondary">
            Request demo
          </Button>
          <Button href="/start-trial" variant="primary">
            Start free trial
          </Button>
        </div>

        <button
          className="rounded-full p-2 text-ink lg:hidden"
          onClick={() => setMobileOpen((value) => !value)}
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileOpen}
          aria-controls="mobile-nav"
        >
          {mobileOpen ? <X /> : <Menu />}
        </button>
      </Container>

      {mobileOpen ? (
        <div id="mobile-nav" className="border-t border-border bg-surface px-4 py-4 lg:hidden">
          <Stack className="gap-1">
            {primaryNav.map((group) => {
              const isExpanded = expandedGroup === group.label;
              return (
                <div key={group.label} className="border-b border-border/60 py-2">
                  <div className="flex items-center justify-between">
                    <a
                      href={group.href}
                      className="text-sm font-semibold text-ink"
                      onClick={() => setMobileOpen(false)}
                    >
                      {group.label}
                    </a>
                    <button
                      type="button"
                      aria-expanded={isExpanded}
                      aria-controls={`mobile-group-${group.label}`}
                      aria-label={`Toggle ${group.label} submenu`}
                      onClick={() => setExpandedGroup(isExpanded ? null : group.label)}
                      className="rounded-full p-1.5 text-muted"
                    >
                      <ChevronDown
                        size={16}
                        aria-hidden="true"
                        className={`transition-transform ${isExpanded ? "rotate-180" : ""}`}
                      />
                    </button>
                  </div>
                  {isExpanded ? (
                    <div id={`mobile-group-${group.label}`} className="mt-2 grid gap-2 pl-2">
                      {group.items.map((item) => (
                        <a
                          key={item.href}
                          href={item.href}
                          className="text-sm text-muted hover:text-ink"
                          onClick={() => setMobileOpen(false)}
                        >
                          {item.label}
                        </a>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
            <a
              href={resourcesNav.href}
              className="border-b border-border/60 py-3 text-sm font-semibold text-ink"
              onClick={() => setMobileOpen(false)}
            >
              {resourcesNav.label}
            </a>
            <a
              href={pricingNav.href}
              className="border-b border-border/60 py-3 text-sm font-semibold text-ink"
              onClick={() => setMobileOpen(false)}
            >
              {pricingNav.label}
            </a>
            <Link
              href={"/app/sign-in" as Route}
              className="py-3 text-sm font-semibold text-ink"
              onClick={() => setMobileOpen(false)}
            >
              Sign in
            </Link>
            <Button href="/request-demo" variant="secondary" className="mt-2 justify-center">
              Request demo
            </Button>
            <Button href="/start-trial" variant="primary" className="mt-2 justify-center">
              Start free trial
            </Button>
          </Stack>
        </div>
      ) : null}
    </header>
  );
}
