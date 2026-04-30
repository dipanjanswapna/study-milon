'use client';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  BrainCircuit,
  LogOut,
  User as UserIcon,
  LayoutDashboard,
  BookMarked,
  Menu
} from 'lucide-react';
import { useUser } from '@/firebase';
import { signOut } from 'firebase/auth';
import { useAuth } from '@/firebase';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { Skeleton } from '../ui/skeleton';
import { SidebarTrigger } from '../ui/sidebar';
import { Button } from '../ui/button';

export function Header() {
  const { user, loading } = useUser();
  const auth = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const handleLogout = async () => {
    await signOut(auth);
    router.push('/');
  };

  const getInitials = (name: string | null | undefined) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('');
  };

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between px-4 border-b bg-card/80 backdrop-blur-md md:px-6">
      <div className="flex items-center gap-2">
        {/* Sidebar Toggle for Desktop */}
        <SidebarTrigger className="hidden md:flex h-9 w-9 text-muted-foreground hover:text-primary transition-colors" />
        
        <Link href="/dashboard" className="flex items-center gap-2 md:hidden">
          <BrainCircuit className="h-6 w-6 text-primary" />
          <h1 className="text-xl font-bold tracking-tight text-foreground font-headline">Study Million</h1>
        </Link>
      </div>
      
      {loading ? (
        <Skeleton className="h-8 w-8 rounded-full" />
      ) : user ? (
        <div className="flex items-center gap-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Avatar className="h-8 w-8 cursor-pointer ring-2 ring-primary/10 hover:ring-primary/30 transition-all">
                <AvatarImage
                  src={user.photoURL || ''}
                  alt={user.displayName || 'User avatar'}
                />
                <AvatarFallback className="text-xs">{getInitials(user.displayName)}</AvatarFallback>
              </Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">{user.displayName}</p>
                  <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/dashboard">
                  <LayoutDashboard className="mr-2 h-4 w-4" />
                  Dashboard
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/resources">
                  <BookMarked className="mr-2 h-4 w-4" />
                  Resource Library
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/profile">
                  <UserIcon className="mr-2 h-4 w-4" />
                  Profile & Subjects
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
                <LogOut className="mr-2 h-4 w-4" />
                <span>Logout</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ) : (
        <Avatar className="h-8 w-8">
          <AvatarFallback className="text-xs">U</AvatarFallback>
        </Avatar>
      )}
    </header>
  );
}
