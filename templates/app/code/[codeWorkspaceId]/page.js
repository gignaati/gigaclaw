import { auth } from 'gigabot/auth';
import { CodePage } from 'gigabot/code';

export default async function CodeRoute({ params }) {
  const session = await auth();
  const { codeWorkspaceId } = await params;
  return <CodePage session={session} codeWorkspaceId={codeWorkspaceId} />;
}
