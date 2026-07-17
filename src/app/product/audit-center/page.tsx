import type { Metadata } from "next";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { ProductPageTemplate } from "@/components/marketing/templates/ProductPageTemplate";
import { auditCenterContent } from "@/content/product/audit-center";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata(auditCenterContent.seo);

export default function AuditCenterPage() {
  return (
    <div className="min-h-screen bg-paper text-ink">
      <MarketingHeader />
      <main>
        <ProductPageTemplate content={auditCenterContent} />
      </main>
      <MarketingFooter />
    </div>
  );
}
