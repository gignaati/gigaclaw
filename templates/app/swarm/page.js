import { auth } from 'gigabot/auth';
import { SwarmPage } from 'gigabot/chat';

export default async function SwarmRoute() {
  const session = await auth();
  return <SwarmPage session={session} />;
}
