import Link from 'next/link';
import { BrainCircuit, Twitter, Instagram, Facebook } from 'lucide-react';

export function Footer() {
  return (
    <footer className="border-t bg-secondary">
      <div className="container py-12 px-4 md:px-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="flex flex-col gap-4">
            <Link href="/" className="flex items-center gap-2">
              <BrainCircuit className="h-6 w-6 text-primary" />
              <span className="font-bold text-lg font-headline">Study Million</span>
            </Link>
            <p className="text-sm text-muted-foreground">
              Track your hustle to the first million minutes.
            </p>
          </div>
          <div>
            <h4 className="font-semibold mb-3 font-headline">Links</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  href="#"
                  className="text-muted-foreground hover:text-foreground"
                >
                  About Us
                </Link>
              </li>
              <li>
                <Link
                  href="#"
                  className="text-muted-foreground hover:text-foreground"
                >
                  Contact
                </Link>
              </li>
              <li>
                <Link
                  href="#"
                  className="text-muted-foreground hover:text-foreground"
                >
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link
                  href="#"
                  className="text-muted-foreground hover:text-foreground"
                >
                  Terms of Service
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-3 font-headline">Admin</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  href="/admin"
                  className="text-muted-foreground hover:text-foreground"
                >
                  Admin Login
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-3 font-headline">Social</h4>
            <div className="flex space-x-4">
              <Link href="#" className="text-muted-foreground hover:text-foreground">
                <Twitter className="h-5 w-5" />
              </Link>
              <Link href="#" className="text-muted-foreground hover:text-foreground">
                <Facebook className="h-5 w-5" />
              </Link>
              <Link href="#" className="text-muted-foreground hover:text-foreground">
                <Instagram className="h-5 w-5" />
              </Link>
            </div>
          </div>
        </div>
        <div className="mt-8 pt-8 border-t text-center text-sm text-muted-foreground">
          <p>
            &copy; {new Date().getFullYear()} Study Million. All rights
            reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
