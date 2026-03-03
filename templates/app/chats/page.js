import { auth } from 'gigabot/auth';
import { ChatsPage } from 'gigabot/chat';

export default async function ChatsRoute() {
  const session = await auth();
  return <ChatsPage session={session} />;
}
