import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Hydra Dashboard | NWM Streamflow Error Correction',
  description:
    'Interactive visualization dashboard for Hydra Transformer model results',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased bg-gray-950">
        {children}
      </body>
    </html>
  );
}
