import { auth } from 'gigaclaw/auth';
import { NotificationsPage } from 'gigaclaw/chat';

export default async function NotificationsRoute() {
  const session = await auth();
  return <NotificationsPage session={session} />;
}
