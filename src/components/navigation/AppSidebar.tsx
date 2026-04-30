'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  User,
  BookMarked,
  BrainCircuit,
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar,
} from '@/components/ui/sidebar';
import { useUser } from '@/firebase';
import { cn } from '@/lib/utils';

export function AppSidebar() {
  const pathname = usePathname();
  const { user } = useUser();
  const { state } = useSidebar();

  const isAuthPage =
    pathname === '/login' || pathname === '/signup' || pathname === '/admin';
  const isLandingPage = pathname === '/';

  if (!user || isAuthPage || isLandingPage) return null;

  const navItems = [
    {
      label: 'Dashboard',
      href: '/dashboard',
      icon: LayoutDashboard,
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

  return (
    <Sidebar collapsible="icon" className="hidden md:flex border-r bg-card transition-all duration-300">
      <SidebarHeader className="h-14 flex items-center px-4 border-b overflow-hidden">
        <Link href="/dashboard" className="flex items-center gap-2">
          <BrainCircuit className="h-6 w-6 text-primary shrink-0" />
          {state === 'expanded' && (
            <span className="font-bold text-lg font-headline tracking-tight whitespace-nowrap">
              Study Million
            </span>
          )}
        </Link>
      </SidebarHeader>
      <SidebarContent className="py-4">
        <SidebarMenu className="px-2 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;

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
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarContent>
    </Sidebar>
  );
}
