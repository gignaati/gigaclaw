import { auth } from 'gigabot/auth';
import { PullRequestsPage } from 'gigabot/chat';

export default async function PullRequestsRoute() {
  const session = await auth();
  return <PullRequestsPage session={session} />;
}
