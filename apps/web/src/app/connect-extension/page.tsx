import { requireUser } from "../../lib/require-user";
import Pairing from "../../components/pairing";
export const dynamic = "force-dynamic";
export default async function Page() {
  await requireUser();
  return <Pairing />;
}
