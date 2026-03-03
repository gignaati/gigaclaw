import { auth } from 'gigabot/auth';
import { NotificationsPage } from 'gigabot/chat';

export default async function NotificationsRoute() {
  const session = await auth();
  return <NotificationsPage session={session} />;
}
