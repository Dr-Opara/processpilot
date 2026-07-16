"use client";

import { useState } from "react";
import { Menu, X } from "lucide-react";
import { ProcessPilotIcon } from "./ProcessPilotIcon";
import { Button } from "@/components/ui/Button";
import { Container, Stack } from "@/components/ui/Layout";
import { Heading } from "@/components/ui/Typography";

const links = ["Platform", "About", "Contact"];

export function MarketingHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="border-b border-border/70 bg-surface/90 backdrop-blur">
      <Container className="flex items-center justify-between py-4">
        <a href="/" className="flex items-center gap-3">
          <ProcessPilotIcon className="h-10 w-10" />
          <Heading as="h2" className="text-lg">
            ProcessPilot
          </Heading>
        </a>
        <nav className="hidden items-center gap-6 md:flex" aria-label="Primary">
          {links.map((link) => (
            <a
              key={link}
              href="#"
              className="text-sm font-medium text-muted hover:text-ink"
            >
              {link}
            </a>
          ))}
        </nav>
        <div className="hidden md:block">
          <Button variant="secondary">Book a call</Button>
        </div>
        <button
          className="rounded-full p-2 text-ink md:hidden"
          onClick={() => setOpen((value) => !value)}
          aria-label="Toggle menu"
          aria-expanded={open}
        >
          {open ? <X /> : <Menu />}
        </button>
      </Container>
      {open ? (
        <div className="border-t border-border bg-surface px-4 py-4 md:hidden">
          <Stack className="gap-3">
            {links.map((link) => (
              <a key={link} href="#" className="text-sm font-medium text-muted">
                {link}
              </a>
            ))}
            <Button className="justify-start">Book a call</Button>
          </Stack>
        </div>
      ) : null}
    </header>
  );
}
