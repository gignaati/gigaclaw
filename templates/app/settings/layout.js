import { auth } from 'gigabot/auth';
import { SettingsLayout } from 'gigabot/chat';

export default async function Layout({ children }) {
  const session = await auth();
  return <SettingsLayout session={session}>{children}</SettingsLayout>;
}
