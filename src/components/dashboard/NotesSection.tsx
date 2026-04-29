import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, PlusCircle, ExternalLink } from 'lucide-react';

const notes = [
  { id: 1, title: 'Chapter 3: Quantum Physics' },
  { id: 2, title: 'Calculus II Formulas' },
  { id: 3, title: 'History of the Roman Empire' },
];

export function NotesSection() {
  return (
    <Card className="shadow-md">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Quick Notes</CardTitle>
        <Button variant="ghost" size="sm">
          <PlusCircle className="mr-2 h-4 w-4" />
          New
        </Button>
      </CardHeader>
      <CardContent>
        <ul className="space-y-3">
          {notes.map((note) => (
            <li
              key={note.id}
              className="flex items-center justify-between group"
            >
              <a
                href="#"
                className="flex items-center gap-3 text-sm font-medium hover:text-primary transition-colors"
              >
                <FileText className="text-muted-foreground group-hover:text-primary transition-colors" />
                <span>{note.title}</span>
              </a>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <ExternalLink className="h-4 w-4" />
                <span className="sr-only">Open note</span>
              </Button>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
