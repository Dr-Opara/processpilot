"use client";

import { useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Command,
  Search,
  Bell,
  LayoutGrid,
  PanelRight,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Stack } from "@/components/ui/Layout";
import { Heading, Text } from "@/components/ui/Typography";

const navItems = [
  { label: "Overview", active: true },
  { label: "Workflows", active: false },
  { label: "People", active: false },
  { label: "Reports", active: false },
];

export function DemoShell() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="overflow-hidden rounded-[2rem] border border-border bg-surface shadow-soft">
      <div className="flex items-center justify-between border-b border-border bg-paper px-4 py-3">
        <div className="flex items-center gap-3">
          <Button
            variant="quiet"
            className="rounded-full p-2"
            aria-label="Collapse sidebar"
            onClick={() => setCollapsed((value) => !value)}
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </Button>
          <div className="flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-2 text-sm">
            <Command size={16} />
            <span className="text-muted">Search work</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="quiet" className="rounded-full p-2" aria-label="Search">
            <Search size={16} />
          </Button>
          <Button variant="quiet" className="rounded-full p-2" aria-label="Notifications">
            <Bell size={16} />
          </Button>
        </div>
      </div>
      <div className="flex min-h-[480px]">
        <aside
          className={
            collapsed
              ? "hidden w-0"
              : "w-64 border-r border-border bg-[linear-gradient(180deg,#fcfbf8,#f7f5f0)] p-4"
          }
        >
          <Stack className="gap-3">
            <div className="flex items-center gap-2 rounded-2xl bg-surface px-3 py-3 shadow-sm">
              <LayoutGrid size={16} />
              <Text className="text-sm font-semibold">Operations</Text>
            </div>
            {navItems.map((item) => (
              <button
                key={item.label}
                className={`rounded-xl px-3 py-2 text-left text-sm ${item.active ? "bg-selected-surface font-semibold text-ink" : "text-muted hover:bg-hover-surface"}`}
              >
                {item.label}
              </button>
            ))}
          </Stack>
        </aside>
        <main className="flex-1 bg-surface p-6">
          <Stack className="gap-4">
            <div className="flex items-center justify-between">
              <Heading as="h3">Launchpad</Heading>
              <Button variant="secondary">Open context</Button>
            </div>
            <div className="grid gap-4 md:grid-cols-[1.08fr_0.92fr]">
              <div className="rounded-2xl border border-border bg-paper p-4">
                <Text className="font-semibold">Daily operating rhythm</Text>
                <Text className="mt-2 text-sm text-muted">
                  A calm overview for review, approvals, and follow-up tasks.
                </Text>
              </div>
              <div className="rounded-2xl border border-border bg-paper p-4">
                <div className="flex items-center justify-between">
                  <Text className="font-semibold">Context panel</Text>
                  <PanelRight size={16} />
                </div>
                <Text className="mt-2 text-sm text-muted">
                  Prepared for later role-aware work surfaces.
                </Text>
              </div>
            </div>
          </Stack>
        </main>
      </div>
    </div>
  );
}
