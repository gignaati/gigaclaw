import { auth } from 'gigaclaw/auth';
import { KnowledgeBasePage } from 'gigaclaw/chat';

export const metadata = {
  title: 'Knowledge Base',
  description: 'Upload and query documents with local RAG — 100% on-device.',
};

export default async function KnowledgeBaseRoute() {
  const session = await auth();
  return <KnowledgeBasePage session={session} />;
}
