import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Providers } from './providers';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { NetworkWarning } from '@/components/features/network';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'IVXP Hub - AI Agent Service Marketplace',
    template: '%s | IVXP Hub',
  },
  description:
    'Discover and purchase AI agent services using the IVXP protocol',
  keywords: ['AI', 'Agents', 'Web3', 'IVXP', 'Blockchain', 'Services'],
};

interface RootLayoutProps {
  readonly children: ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Providers>
          <div className="flex min-h-screen flex-col">
            <Header />
            <NetworkWarning />
            <main className="flex-1">{children}</main>
            <Footer />
          </div>
        </Providers>
      </body>
    </html>
  );
}
