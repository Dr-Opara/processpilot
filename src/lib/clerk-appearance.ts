/**
 * Re-themes Clerk's prebuilt components to ProcessPilot's design tokens
 * (design/colors.md, design/components.md) instead of shipping Clerk's
 * default look — design/components.md rule 4 requires this for any
 * library-provided UI. Typed structurally against ClerkProvider's
 * `appearance` prop at the call site rather than importing Clerk's
 * internal Appearance type directly (not exposed as its own package in
 * this SDK version).
 */
export const clerkAppearance = {
  variables: {
    colorPrimary: "var(--color-signal)",
    colorText: "var(--color-ink)",
    colorTextSecondary: "var(--color-muted)",
    colorBackground: "var(--color-surface)",
    colorInputBackground: "var(--color-surface)",
    colorInputText: "var(--color-ink)",
    colorDanger: "var(--color-danger)",
    colorSuccess: "var(--color-success)",
    colorWarning: "var(--color-warning)",
    colorNeutral: "var(--color-border)",
    fontFamily: "var(--font-geist-sans), sans-serif",
    borderRadius: "0.75rem",
  },
  elements: {
    card: "shadow-none border border-border rounded-2xl",
    headerTitle: "font-semibold text-ink",
    headerSubtitle: "text-muted",
    socialButtonsBlockButton: "border border-border text-ink hover:bg-hover-surface",
    dividerLine: "bg-border",
    dividerText: "text-muted",
    formFieldLabel: "text-ink font-medium",
    formFieldInput: "border border-border focus:border-cobalt focus:ring-cobalt/20",
    formButtonPrimary: "bg-ink hover:bg-cobalt text-surface rounded-full normal-case",
    footerActionLink: "text-cobalt hover:text-ink",
    identityPreviewEditButton: "text-cobalt",
    organizationSwitcherTrigger: "border border-border rounded-full",
  },
};
