'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, User, CalendarCheck, Trophy, Users2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUser, useFirestore, useCollection } from '@/firebase';
import { useMemo } from 'react';
import { collection, query, where } from 'firebase/firestore';
import { format } from 'date-fns';

export function BottomNav() {
  const pathname = usePathname();
  const { user } = useUser();
  const firestore = useFirestore();

  // Fetch incomplete tasks for the badge
  const todayStr = useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);
  const incompleteTasksQuery = useMemo(() => {
    if (!user) return null;
    return query(
      collection(firestore, 'users', user.uid, 'tasks'),
      where('completed', '==', false)
    );
  }, [user, firestore]);
  const { data: incompleteTasks } = useCollection<any>(incompleteTasksQuery);

  const pendingCount = useMemo(() => {
    if (!incompleteTasks) return 0;
    // Count tasks for today or overdue
    return incompleteTasks.filter(t => t.date <= todayStr).length;
  }, [incompleteTasks, todayStr]);

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
      badge: pendingCount > 0 ? pendingCount : null
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
                "flex flex-col items-center justify-center w-full h-full gap-0.5 transition-all duration-300 relative",
                isActive 
                  ? "text-primary scale-110" 
                  : "text-muted-foreground hover:text-foreground opacity-70"
              )}
            >
              <div className="relative">
                <Icon className={cn("h-5 w-5", isActive && "stroke-[2.5px]")} />
                {item.badge && (
                  <span className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground text-[8px] font-black w-4 h-4 flex items-center justify-center rounded-full shadow-lg border-2 border-background">
                    {item.badge > 9 ? '9+' : item.badge}
                  </span>
                )}
              </div>
              <span className="text-[9px] font-black uppercase tracking-tighter">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
