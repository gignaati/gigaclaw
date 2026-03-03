import { auth } from 'gigabot/auth';
import { ChatPage } from 'gigabot/chat';

export default async function Home() {
  const session = await auth();
  return <ChatPage session={session} needsSetup={false} />;
}
