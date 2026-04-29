'use client';
import { useMemo, useState } from 'react';
import { useUser, useFirestore, useCollection } from '@/firebase';
import { collection, orderBy, query } from 'firebase/firestore';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import {
  Plus,
  Edit,
  Trash2,
  Loader2,
  Book,
  Folder,
  FileText,
  RefreshCw,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import {
  addSubject,
  updateSubject,
  deleteSubject,
  addChapter,
  updateChapter,
  deleteChapter,
  addTopic,
  updateTopic,
  deleteTopic,
  updateTopicStatus,
} from '@/firebase/firestore/hierarchy';
import { Skeleton } from '../ui/skeleton';
import { Checkbox } from '../ui/checkbox';
import { Badge } from '../ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

// Main component to display the entire hierarchy
export function SubjectHierarchy() {
  const { user } = useUser();
  const firestore = useFirestore();

  const subjectsQuery = useMemo(() => {
    if (!user) return null;
    return query(
      collection(firestore, 'users', user.uid, 'subjects'),
      orderBy('createdAt', 'asc')
    );
  }, [user, firestore]);

  const { data: subjects, loading } = useCollection(subjectsQuery);

  if (loading) {
    return (
        <div className="space-y-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
        </div>
    );
  }

  return (
    <div>
      <div className="mb-4 text-right">
        <CrudDialog
          trigger={
            <Button>
              <Plus className="mr-2 h-4 w-4" /> Add Subject
            </Button>
          }
          title="Add New Subject"
          onSubmit={async (name) => addSubject(firestore, user!.uid, name)}
        />
      </div>
      {subjects && subjects.length > 0 ? (
        <Accordion type="multiple" className="w-full">
          {subjects.map((subject) => (
            <SubjectItem key={subject.id} subject={subject} />
          ))}
        </Accordion>
      ) : (
        <p className="text-center text-muted-foreground py-8">No subjects added yet. Click "Add Subject" to start.</p>
      )}
    </div>
  );
}

// Component for a single subject
function SubjectItem({ subject }: { subject: any }) {
  const { user } = useUser();
  const firestore = useFirestore();

  const chaptersQuery = useMemo(() => {
    if (!user) return null;
    return query(
      collection(firestore, 'users', user.uid, 'subjects', subject.id, 'chapters'),
      orderBy('createdAt', 'asc')
    );
  }, [user, firestore, subject.id]);

  const { data: chapters, loading } = useCollection(chaptersQuery);

  return (
    <AccordionItem value={subject.id} className="border rounded-md px-4 mb-2 bg-card">
      <div className="flex items-center" >
        <AccordionTrigger className="hover:no-underline flex-1">
          <div className="flex items-center gap-3 w-full">
            <Book className="h-5 w-5 text-primary" />
            <span className="font-semibold text-lg flex-grow text-left">{subject.name}</span>
          </div>
        </AccordionTrigger>
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <CrudDialog
            trigger={
              <Button asChild variant="ghost" size="icon">
                <span>
                  <Edit className="h-4 w-4" />
                </span>
              </Button>
            }
            title="Edit Subject"
            initialValue={subject.name}
            onSubmit={async (name) => updateSubject(firestore, user!.uid, subject.id, name)}
          />
          <DeleteDialog
            trigger={
              <Button asChild variant="ghost" size="icon">
                <span>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </span>
              </Button>
            }
            onDelete={async () => deleteSubject(firestore, user!.uid, subject.id)}
            itemName={subject.name}
          />
        </div>
      </div>
      <AccordionContent className="pl-8">
        <div className="mb-2 text-right">
            <CrudDialog
            trigger={
                <Button variant="outline" size="sm">
                <Plus className="mr-2 h-4 w-4" /> Add Chapter
                </Button>
            }
            title="Add New Chapter"
            onSubmit={async (name) => addChapter(firestore, user!.uid, subject.id, name)}
            />
        </div>
        {loading ? <Skeleton className="h-10 w-full" /> : chapters && chapters.length > 0 ? (
          <Accordion type="multiple" className="w-full">
            {chapters.map((chapter) => (
              <ChapterItem key={chapter.id} subjectId={subject.id} chapter={chapter} />
            ))}
          </Accordion>
        ) : (
            <p className="text-center text-sm text-muted-foreground py-4">No chapters yet.</p>
        )}
      </AccordionContent>
    </AccordionItem>
  );
}

// Component for a single chapter
function ChapterItem({ subjectId, chapter }: { subjectId: string, chapter: any }) {
    const { user } = useUser();
    const firestore = useFirestore();
  
    const topicsQuery = useMemo(() => {
      if (!user) return null;
      return query(
        collection(firestore, 'users', user.uid, 'subjects', subjectId, 'chapters', chapter.id, 'topics'),
        orderBy('createdAt', 'asc')
      );
    }, [user, firestore, subjectId, chapter.id]);
  
    const { data: topics, loading } = useCollection(topicsQuery);

  return (
    <AccordionItem value={chapter.id} className="border-l pl-4 my-1">
       <div className="flex items-center">
        <AccordionTrigger className="hover:no-underline py-2 flex-1">
          <div className="flex items-center gap-3 w-full">
              <Folder className="h-5 w-5 text-secondary-foreground" />
              <span className="font-medium flex-grow text-left">{chapter.name}</span>
            </div>
        </AccordionTrigger>
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <CrudDialog
              trigger={
                  <Button asChild variant="ghost" size="icon">
                    <span><Edit className="h-4 w-4" /></span>
                  </Button>
              }
              title="Edit Chapter"
              initialValue={chapter.name}
              onSubmit={async (name) => updateChapter(firestore, user!.uid, subjectId, chapter.id, name)}
          />
          <DeleteDialog
            trigger={
              <Button asChild variant="ghost" size="icon">
                <span>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </span>
              </Button>
            }
            onDelete={async () => deleteChapter(firestore, user!.uid, subjectId, chapter.id)}
            itemName={chapter.name}
          />
        </div>
      </div>
      <AccordionContent className="pl-8">
        <div className="mb-2 text-right">
            <CrudDialog
                trigger={
                    <Button variant="outline" size="sm">
                    <Plus className="mr-2 h-4 w-4" /> Add Topic
                    </Button>
                }
                title="Add New Topic"
                onSubmit={async (name) => addTopic(firestore, user!.uid, subjectId, chapter.id, name)}
            />
        </div>
        {loading ? <Skeleton className="h-8 w-full" /> : topics && topics.length > 0 ? (
            <ul className="space-y-2">
                {topics.map(topic => (
                    <TopicItem key={topic.id} subjectId={subjectId} chapterId={chapter.id} topic={topic} />
                ))}
            </ul>
        ) : (
            <p className="text-center text-sm text-muted-foreground py-4">No topics yet.</p>
        )}
      </AccordionContent>
    </AccordionItem>
  );
}

// Component for a single topic
function TopicItem({
  subjectId,
  chapterId,
  topic,
}: {
  subjectId: string;
  chapterId: string;
  topic: any;
}) {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const handleStatusChange = async (completed: boolean) => {
    if (!user) return;
    // When a completed topic is unchecked, it goes back to 'pending'
    // When a pending/revision topic is checked, it becomes 'completed'
    const newStatus = completed ? 'completed' : 'pending';
    try {
      await updateTopicStatus(
        firestore,
        user.uid,
        subjectId,
        chapterId,
        topic.id,
        newStatus
      );
      toast({
        title: `Topic marked as ${newStatus}${
          topic.status === 'revision' && newStatus === 'completed'
            ? '. Revision complete!'
            : ''
        }`,
      });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error updating status' });
      console.error(error);
    }
  };

  const handleSetToRevision = async () => {
    if (!user) return;
    try {
      await updateTopicStatus(
        firestore,
        user.uid,
        subjectId,
        chapterId,
        topic.id,
        'revision'
      );
      toast({ title: 'Topic marked for revision' });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error setting to revision' });
      console.error(error);
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'completed':
        return 'default';
      case 'revision':
        return 'secondary';
      case 'pending':
      default:
        return 'outline';
    }
  };

  return (
    <li className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50 group">
      <div className="flex items-center gap-3">
        <Checkbox
          id={`topic-${topic.id}`}
          checked={topic.status === 'completed'}
          onCheckedChange={(checked) => handleStatusChange(Boolean(checked))}
        />
        <label
          htmlFor={`topic-${topic.id}`}
          className="flex items-center gap-2 cursor-pointer"
        >
          <FileText className="h-5 w-5 text-muted-foreground" />
          <span className={topic.status === 'completed' ? 'line-through text-muted-foreground' : ''}>{topic.name}</span>
          {topic.revision_count > 0 && (
            <span className="text-xs text-muted-foreground">
              (rev: {topic.revision_count})
            </span>
          )}
        </label>
      </div>
      <div className="flex items-center gap-2">
        <Badge variant={getStatusBadgeVariant(topic.status)} className="capitalize">
          {topic.status}
        </Badge>

        {topic.status === 'completed' && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleSetToRevision}
                  className="h-8 w-8"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Mark for Revision</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        <CrudDialog
          trigger={
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 opacity-0 group-hover:opacity-100"
            >
              <Edit className="h-4 w-4" />
            </Button>
          }
          title="Edit Topic"
          initialValue={topic.name}
          onSubmit={async (name) =>
            updateTopic(firestore, user!.uid, subjectId, chapterId, topic.id, name)
          }
        />
        <DeleteDialog
          trigger={
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 opacity-0 group-hover:opacity-100"
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          }
          onDelete={async () =>
            deleteTopic(firestore, user!.uid, subjectId, chapterId, topic.id)
          }
          itemName={topic.name}
        />
      </div>
    </li>
  );
}


// Reusable dialog for Create/Update operations
function CrudDialog({
  trigger,
  title,
  initialValue = '',
  onSubmit,
}: {
  trigger: React.ReactNode;
  title: string;
  initialValue?: string;
  onSubmit: (name: string) => Promise<void>;
}) {
  const [name, setName] = useState(initialValue);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      await onSubmit(name.trim());
      toast({ title: `${title.split(' ')[1]} ${initialValue ? 'updated' : 'added'}!` });
      setName('');
      setOpen(false);
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild onClick={() => setName(initialValue)}>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                Name
              </Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="col-span-3"
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
                <Button type="button" variant="secondary">Cancel</Button>
            </DialogClose>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Reusable dialog for Delete confirmation
function DeleteDialog({
  trigger,
  onDelete,
  itemName,
}: {
  trigger: React.ReactNode;
  onDelete: () => Promise<void>;
  itemName: string;
}) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const [open, setOpen] = useState(false);


  const handleDelete = async () => {
    setLoading(true);
    try {
      await onDelete();
      toast({ title: `${itemName} deleted.` });
      setOpen(false);
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
     <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
            {trigger}
        </DialogTrigger>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Are you sure?</DialogTitle>
            </DialogHeader>
            <p>
                This action cannot be undone. This will permanently delete the
                <strong> {itemName}</strong> and all its contents.
            </p>
            <DialogFooter>
                <DialogClose asChild>
                    <Button type="button" variant="secondary">Cancel</Button>
                </DialogClose>
                <Button variant="destructive" onClick={handleDelete} disabled={loading}>
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Delete
                </Button>
            </DialogFooter>
        </DialogContent>
     </Dialog>
  )
}
