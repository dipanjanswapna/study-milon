import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { BrainCircuit } from 'lucide-react';

export function Header() {
  return (
    <header className="flex items-center justify-between p-4 border-b bg-card">
      <div className="flex items-center gap-3">
        <BrainCircuit className="h-8 w-8 text-primary" />
        <h1 className="text-2xl font-bold text-foreground">FocusFlow</h1>
      </div>
      <Avatar>
        <AvatarImage
          src="https://picsum.photos/seed/user/40/40"
          alt="User avatar"
          data-ai-hint="user avatar"
        />
        <AvatarFallback>U</AvatarFallback>
      </Avatar>
    </header>
  );
}
