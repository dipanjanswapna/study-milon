'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, User, CalendarCheck, Trophy, Users2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUser } from '@/firebase';

export function BottomNav() {
  const pathname = usePathname();
  const { user } = useUser();

  const isAuthPage = pathname === '/login' || pathname === '/signup' || pathname === '/admin';
  const isLandingPage = pathname === '/';

  if (!user || isAuthPage || isLandingPage) return null;

  const navItems = [
    {
      label: 'Home',
      href: '/dashboard',
      icon: LayoutDashboard,
    },
    {
      label: 'Planner',
      href: '/todo',
      icon: CalendarCheck,
    },
    {
        label: 'Guilds',
        href: '/groups',
        icon: Users2,
    },
    {
        label: 'Rank',
        href: '/leaderboard',
        icon: Trophy,
    },
    {
      label: 'Profile',
      href: '/profile',
      icon: User,
    },
  ];

  return (
    <nav className="w-full bg-card/90 backdrop-blur-xl border-t shadow-2xl md:hidden safe-area-pb">
      <div className="flex items-center justify-around h-16">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || (item.href === '/groups' && pathname.startsWith('/groups'));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center w-full h-full gap-0.5 transition-all duration-300",
                isActive 
                  ? "text-primary scale-110" 
                  : "text-muted-foreground hover:text-foreground opacity-70"
              )}
            >
              <Icon className={cn("h-5 w-5", isActive && "stroke-[2.5px]")} />
              <span className="text-[9px] font-black uppercase tracking-tighter">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
