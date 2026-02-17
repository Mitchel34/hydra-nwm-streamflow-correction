import Link from 'next/link';
import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col text-white">
      <Navigation />
      <main className="flex flex-1 items-center justify-center px-6">
        <div className="text-center">
          <h1 className="font-display text-6xl font-semibold gradient-text">404</h1>
          <p className="mt-4 text-lg text-[#a9c2d3]">Page not found</p>
          <p className="mt-2 text-sm text-[#8fb4cc]">
            The page you&apos;re looking for doesn&apos;t exist or has been moved.
          </p>
          <Link
            href="/"
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-hydra-accent to-hydra-corrected px-6 py-3 font-display font-medium text-[#022133] transition-all hover:scale-[1.02]"
          >
            Back to Home
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  );
}
