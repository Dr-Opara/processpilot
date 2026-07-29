import { OrganizationProfile } from "@clerk/nextjs";
import Link from "next/link";

export default function OrganizationPage() {
  return (
    <div className="flex flex-col gap-4">
      <Link href="/app/organization/settings" className="text-sm font-medium text-cobalt">
        Branding, security, retention, domains, and deletion &rarr;
      </Link>
      <OrganizationProfile />
    </div>
  );
}
