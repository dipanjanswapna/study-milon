'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useMemo } from 'react';
import {
  LayoutDashboard,
  User,
  BookMarked,
  CalendarCheck,
  Trophy,
  Users2,
  ShieldCheck,
  ArrowLeftRight,
  Timer,
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuBadge,
  useSidebar,
} from '@/components/ui/sidebar';
import { useUser, useFirestore, useDoc, useCollection } from '@/firebase';
import { collection, query, where, doc } from 'firebase/firestore';
import { cn } from '@/lib/utils';
import { SUPER_ADMIN_UID } from '@/firebase/firestore/users';
import { format } from 'date-fns';

export function AppSidebar() {
  const pathname = usePathname();
  const { user } = useUser();
  const { state } = useSidebar();
  const firestore = useFirestore();

  // Fetch user profile for role check
  const userRef = useMemo(() => (user ? doc(firestore, 'users', user.uid) : null), [user, firestore]);
  const { data: profile } = useDoc<any>(userRef as any);

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

  const isAdmin = profile?.role === 'admin' || user?.uid === SUPER_ADMIN_UID;
  const isAdminPage = pathname.startsWith('/admin');

  const isAuthPage =
    pathname === '/login' || pathname === '/signup' || pathname === '/admin';
  const isLandingPage = pathname === '/';

  if (!user || isAuthPage || isLandingPage) return null;

  // Navigation for the Admin Panel
  const adminNavItems = [
    {
      label: 'Command Center',
      href: '/admin/dashboard',
      icon: ShieldCheck,
    },
    {
      label: 'Return to Student App',
      href: '/dashboard',
      icon: ArrowLeftRight,
    },
  ];

  // Standard Navigation for Students
  const studentNavItems = [
    {
      label: 'Dashboard',
      href: '/dashboard',
      icon: LayoutDashboard,
    },
    {
      label: 'Study Planner',
      href: '/todo',
      icon: CalendarCheck,
      badge: pendingCount > 0 ? pendingCount : null
    },
    {
        label: 'Exam Tracker',
        href: '/exams',
        icon: Timer,
    },
    {
        label: 'Leaderboard',
        href: '/leaderboard',
        icon: Trophy,
    },
    {
        label: 'Study Guilds',
        href: '/groups',
        icon: Users2,
    },
    {
      label: 'Resource Library',
      href: '/resources',
      icon: BookMarked,
    },
    {
      label: 'Profile & Subjects',
      href: '/profile',
      icon: User,
    },
  ];

  const currentNavItems = isAdminPage ? adminNavItems : studentNavItems;

  return (
    <Sidebar collapsible="icon" className="hidden md:flex border-r bg-card transition-all duration-300">
      <SidebarHeader className="h-14 flex items-center px-4 border-b overflow-hidden">
        <Link href="/dashboard" className="flex items-center gap-2">
          <Image 
            src="/Screenshot 2026-05-02 103540.png" 
            alt="Logo" 
            width={32} 
            height={32} 
            className="shrink-0 rounded-md"
          />
          {state === 'expanded' && (
            <span className="font-bold text-lg font-headline tracking-tight whitespace-nowrap">
              {isAdminPage ? 'Admin Center' : 'Study Milon'}
            </span>
          )}
        </Link>
      </SidebarHeader>
      <SidebarContent className="py-4">
        <SidebarMenu className="px-2 space-y-1">
          {currentNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || (item.href === '/groups' && pathname.startsWith('/groups'));

            return (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  asChild
                  isActive={isActive}
                  tooltip={item.label}
                  className={cn(
                    "transition-all duration-200",
                    isActive
                      ? 'bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <Link href={item.href} className="flex items-center gap-3">
                    <Icon className="h-5 w-5 shrink-0" />
                    {state === 'expanded' && <span className="font-medium">{item.label}</span>}
                  </Link>
                </SidebarMenuButton>
                {item.badge && state === 'expanded' && (
                  <SidebarMenuBadge className="bg-destructive text-destructive-foreground font-black text-[10px] rounded-full">
                    {item.badge}
                  </SidebarMenuBadge>
                )}
                {item.badge && state === 'collapsed' && (
                  <div className="absolute top-1 right-1 w-2.5 h-2.5 bg-destructive rounded-full border-2 border-card" />
                )}
              </SidebarMenuItem>
            );
          })}

          {/* Quick link to Admin Panel for admins viewing the student dashboard */}
          {isAdmin && !isAdminPage && (
            <div className="pt-4 mt-4 border-t border-muted/50">
               <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  tooltip="Admin Command Center"
                  className="text-primary hover:bg-primary/10"
                >
                  <Link href="/admin/dashboard" className="flex items-center gap-3">
                    <ShieldCheck className="h-5 w-5 shrink-0" />
                    {state === 'expanded' && <span className="font-bold">Admin Panel</span>}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </div>
          )}
        </SidebarMenu>
      </SidebarContent>
    </Sidebar>
  );
}