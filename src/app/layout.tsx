import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AntdRegistry } from '@ant-design/nextjs-registry';
import { ClerkProvider } from '@clerk/nextjs';
import { Analytics } from '@vercel/analytics/next';
import { Providers } from './providers';
import Footer from '../components/Footer';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });

export const metadata: Metadata = {
  title: 'Hospital Finder',
  description:
    'Locate hospitals and healthcare facilities near you, search by name or medical service, and get directions on an interactive map.',
  icons: { icon: '/hospital-svgrepo-com.svg' },
  openGraph: {
    title: 'Hospital Finder',
    description:
      'Locate hospitals and healthcare facilities near you and get directions on an interactive map.',
    siteName: 'Hospital Finder',
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'Hospital Finder',
    description:
      'Locate hospitals and healthcare facilities near you and get directions on an interactive map.',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider
      appearance={{
        variables: { colorPrimary: '#2563eb', borderRadius: '10px' },
        elements: { footer: 'hidden' },
      }}
    >
      <html lang="en" className={inter.variable}>
        <body>
          <AntdRegistry>
            <Providers>
              <div className="flex min-h-screen flex-col">
                <div className="flex-1">{children}</div>
                <Footer />
              </div>
              <Analytics />
            </Providers>
          </AntdRegistry>
        </body>
      </html>
    </ClerkProvider>
  );
}
