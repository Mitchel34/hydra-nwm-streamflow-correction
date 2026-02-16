'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';

export default function Navigation() {
  const pathname = usePathname();
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const shouldReduce =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const storedSetting =
      typeof window !== 'undefined'
        ? window.localStorage.getItem('hydra.reduceMotion')
        : null;

    if (storedSetting !== null) {
      setReduceMotion(storedSetting === 'true');
      return;
    }
    setReduceMotion(shouldReduce);
  }, []);

  const handleMotionToggle = () => {
    setReduceMotion((prev) => {
      const next = !prev;
      window.localStorage.setItem('hydra.reduceMotion', String(next));
      return next;
    });
  };

  const navLinks = [
    { href: '/', label: 'Home' },
    { href: '/model', label: 'Model' },
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/analysis', label: 'Analysis' },
  ];

  return (
    <nav className="relative z-10 border-b border-[#2a455c]/55 bg-[#06131f]/70 backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-2 transition-opacity hover:opacity-80">
          <div className="h-8 w-8 rounded-md bg-gradient-to-br from-hydra-accent to-hydra-corrected shadow-[0_0_20px_rgba(43,227,214,0.45)]" />
          <span className="font-display text-lg font-semibold tracking-[0.12em]">HYDRA</span>
        </Link>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={handleMotionToggle}
            className="rounded-full border border-hydra-accent/35 px-3 py-1.5 text-xs text-[#bbd4e5] transition-colors hover:border-hydra-corrected/50 hover:text-white"
            aria-label={reduceMotion ? 'Enable animations' : 'Reduce animations'}
          >
            {reduceMotion ? 'Motion: Reduced' : 'Motion: Full'}
          </button>
          {navLinks.slice(1).map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`text-sm transition-colors ${
                  isActive
                    ? 'font-medium text-hydra-corrected'
                    : 'text-[#c2d8e8] hover:text-white'
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
