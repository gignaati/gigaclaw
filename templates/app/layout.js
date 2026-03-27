import './globals.css';
import { ThemeProvider } from './components/theme-provider';
import brandJson from '../../config/brand.json' assert { type: 'json' };

const brand = brandJson;

export const metadata = {
  title: `${brand.name} — Autonomous AI Agent by ${brand.company}`,
  description: brand.description,
  keywords: brand.keywords,
  authors: [{ name: brand.company, url: brand.companyUrl }],
  creator: brand.company,
  publisher: brand.company,
  openGraph: {
    title: `${brand.name} — Autonomous AI Agent by ${brand.company}`,
    description: 'Build, deploy, and run AI agents 24/7 with India-first, edge-native AI.',
    siteName: `${brand.name} by ${brand.company}`,
    type: 'website',
  },
  robots: {
    index: false, // Private agent — do not index
    follow: false,
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
