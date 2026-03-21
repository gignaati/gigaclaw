import { auth } from 'gigaclaw/auth';
import { SettingsLayout } from 'gigaclaw/chat';

export default async function Layout({ children }) {
  const session = await auth();
  return <SettingsLayout session={session}>{children}</SettingsLayout>;
}
