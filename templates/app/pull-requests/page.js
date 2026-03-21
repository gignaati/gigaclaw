import { auth } from 'gigaclaw/auth';
import { PullRequestsPage } from 'gigaclaw/chat';

export default async function PullRequestsRoute() {
  const session = await auth();
  return <PullRequestsPage session={session} />;
}
