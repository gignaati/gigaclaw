import { auth } from 'gigaclaw/auth';
import { SwarmPage } from 'gigaclaw/chat';

export default async function SwarmRoute() {
  const session = await auth();
  return <SwarmPage session={session} />;
}
