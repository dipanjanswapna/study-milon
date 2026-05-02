'use client';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { useUser } from '@/firebase';
import { Skeleton } from '@/components/ui/skeleton';

export function Header() {
  const { user, loading } = useUser();

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-12 items-center px-4 md:px-6">
        <Link href="/" className="flex items-center gap-2 mr-6">
          <Image 
            src="/Screenshot 2026-05-02 103540.png" 
            alt="Study Million Logo" 
            width={24} 
            height={24} 
            className="rounded-sm"
          />
          <span className="font-bold text-base font-headline">Study Million</span>
        </Link>
        <div className="flex flex-1 items-center justify-end space-x-4">
          <nav className="flex items-center space-x-2">
            {loading ? (
              <>
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-8 w-20" />
              </>
            ) : user ? (
              <Button size="sm" asChild>
                <Link href="/dashboard">Dashboard</Link>
              </Button>
            ) : (
              <>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/login">Login</Link>
                </Button>
                <Button size="sm" asChild>
                  <Link href="/signup">Sign Up</Link>
                </Button>
              </>
            )}
          </nav>
        </div>
      </div>
    </header>
  );
}
