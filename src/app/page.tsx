import { authorized, isConfigured, isLocalPreview } from "@/lib/auth";
import { loadCatalog } from "@/lib/storage";
import CatalogApp from "@/components/catalog-app";
import Login from "@/components/login";
export const dynamic = "force-dynamic";
export default async function Page() {
  if (!(await authorized())) return <Login configured={isConfigured()} />;
  return (
    <CatalogApp initial={await loadCatalog()} localPreview={isLocalPreview()} />
  );
}
