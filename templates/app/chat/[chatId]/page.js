import { auth } from 'gigabot/auth';
import { ChatPage } from 'gigabot/chat';

export default async function ChatRoute({ params }) {
  const { chatId } = await params;
  const session = await auth();
  return <ChatPage session={session} needsSetup={false} chatId={chatId} />;
}
