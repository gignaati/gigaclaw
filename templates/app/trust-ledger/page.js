import { auth } from 'gigaclaw/auth';
import { TrustLedgerPage } from 'gigaclaw/chat';
export default async function TrustLedgerRoute() {
  const session = await auth();
  return <TrustLedgerPage session={session} />;
}
