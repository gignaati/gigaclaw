import { auth } from 'gigaclaw/auth';
import { ChatPage } from 'gigaclaw/chat';

export default async function Home() {
  const session = await auth();
  return <ChatPage session={session} needsSetup={false} />;
}
