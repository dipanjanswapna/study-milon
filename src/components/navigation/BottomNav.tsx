'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, User, BookMarked, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUser } from '@/firebase';

export function BottomNav() {
  const pathname = usePathname();
  const { user } = useUser();

  // Only show navigation for logged in users on internal pages
  const isAuthPage = pathname === '/login' || pathname === '/signup' || pathname === '/admin';
  const isLandingPage = pathname === '/';

  if (!user || isAuthPage || isLandingPage) return null;

  const navItems = [
    {
      label: 'Dashboard',
      href: '/dashboard',
      icon: LayoutDashboard,
    },
    {
      label: 'Resources',
      href: '/resources',
      icon: BookMarked,
    },
    {
      label: 'Profile',
      href: '/profile',
      icon: User,
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t shadow-lg md:bottom-auto md:top-14 md:left-auto md:right-4 md:bg-transparent md:border-none md:shadow-none">
      <div className="flex items-center justify-around h-16 md:flex-col md:h-auto md:gap-4 md:mt-4 md:items-end">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center w-full h-full gap-1 transition-colors md:flex-row md:w-auto md:px-4 md:py-2 md:rounded-full md:bg-card md:border md:shadow-sm",
                isActive 
                  ? "text-primary md:border-primary md:bg-primary/5" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="text-[10px] font-medium md:text-sm">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
