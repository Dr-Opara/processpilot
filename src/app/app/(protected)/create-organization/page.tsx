import { CreateOrganization } from "@clerk/nextjs";
import { DASHBOARD_PATH } from "@/lib/app-host";

export default function CreateOrganizationPage() {
  return <CreateOrganization afterCreateOrganizationUrl={DASHBOARD_PATH} />;
}
