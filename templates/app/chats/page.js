import { auth } from 'gigaclaw/auth';
import { ChatsPage } from 'gigaclaw/chat';

export default async function ChatsRoute() {
  const session = await auth();
  return <ChatsPage session={session} />;
}
