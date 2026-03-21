import { auth } from 'gigaclaw/auth';
import { ChatPage } from 'gigaclaw/chat';

export default async function ChatRoute({ params }) {
  // Next.js 15: params is synchronous — no await needed
  const { chatId } = params;
  const session = await auth();
  return <ChatPage session={session} needsSetup={false} chatId={chatId} />;
}
