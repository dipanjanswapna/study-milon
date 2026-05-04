'use client';

import { useMemo, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { collection, query, orderBy } from 'firebase/firestore';

import { useCollection, useUser, useFirestore } from '@/firebase';
import { addResource, deleteResource, type Resource, type ResourceInput } from '@/firebase/firestore/resources';
import { useToast } from '@/hooks/use-toast';

import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { ProfileSetupGate } from '@/components/dashboard/ProfileSetupGate';
import { Header } from '@/components/dashboard/Header';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, Trash2, Link as LinkIcon, FileText, BookMarked, Plus, LayoutGrid } from 'lucide-react';
import Link from 'next/link';

const resourceSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters.'),
  url: z.string().url('Please enter a valid URL.'),
  type: z.enum(['link', 'pdf']),
});

export default function ResourcesPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<ResourceInput>({
    resolver: zodResolver(resourceSchema),
    defaultValues: { type: 'link' }
  });

  const resourcesQuery = useMemo(() => {
    if (!user) return null;
    return query(collection(firestore, 'users', user.uid, 'resources'), orderBy('createdAt', 'desc'));
  }, [user, firestore]);

  const { data: resources, loading: resourcesLoading } = useCollection<Resource>(resourcesQuery);

  const onSubmit = async (data: ResourceInput) => {
    if (!user) return;
    try {
      await addResource(firestore, user.uid, data);
      toast({ title: 'Resource Added', description: 'Your new resource has been saved.' });
      reset();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: 'Could not save resource.' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!user) return;
    try {
      await deleteResource(firestore, user.uid, id);
      toast({ title: 'Resource Deleted' });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: 'Could not delete resource.' });
    }
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background text-foreground pb-24 md:pb-10">
        <Header />
        <main className="p-3 sm:p-4 md:p-6 lg:p-8 max-w-7xl mx-auto space-y-4">
          <ProfileSetupGate>
            <Card className="rounded-xl border-none shadow-xl overflow-hidden bg-[#1A1C3D] text-white relative group">
              <CardContent className="p-4 md:p-6 relative z-10 space-y-1">
                <div className="space-y-0.5 text-center md:text-left">
                  <h1 className="text-lg md:text-xl font-black tracking-tighter leading-none">Resource Library</h1>
                  <p className="text-white/60 font-medium text-[9px] md:text-xs">Save and organize your study materials.</p>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start mt-4">
              <div className="lg:col-span-5 xl:col-span-4">
                <Card className="rounded-xl border-none shadow-xl bg-card overflow-hidden">
                  <CardHeader className="bg-secondary/10 pb-4 border-b">
                    <CardTitle className="text-sm font-black flex items-center gap-2 uppercase">
                      <Plus className="h-4 w-4 text-primary" /> Add Resource
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6">
                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase text-muted-foreground">Title</Label>
                        <Input className="h-10 rounded-lg text-sm" {...register('title')} placeholder="e.g. Physics Note" />
                        {errors.title && <p className="text-[8px] text-destructive font-black uppercase">{errors.title.message}</p>}
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase text-muted-foreground">URL</Label>
                        <Input className="h-10 rounded-lg text-sm" {...register('url')} placeholder="https://..." />
                        {errors.url && <p className="text-[8px] text-destructive font-black uppercase">{errors.url.message}</p>}
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase text-muted-foreground">Type</Label>
                        <Controller
                          name="type"
                          control={control}
                          render={({ field }) => (
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <SelectTrigger className="h-10 rounded-lg text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent className="rounded-xl">
                                <SelectItem value="link">Web Link</SelectItem>
                                <SelectItem value="pdf">PDF Document</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                        />
                      </div>
                      <Button type="submit" disabled={isSubmitting} className="w-full h-11 font-black rounded-xl shadow-lg mt-4">
                        {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Deploy to Library"}
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              </div>

              <div className="lg:col-span-7 xl:col-span-8">
                <Card className="rounded-xl border-none shadow-xl bg-card overflow-hidden">
                  <div className="p-3 border-b bg-secondary/10 flex items-center justify-between">
                    <h3 className="text-[10px] font-black flex items-center gap-2 tracking-tight uppercase">
                       <LayoutGrid className="h-3 w-3 text-primary" /> Resource Directory
                    </h3>
                  </div>
                  <CardContent className="p-0">
                    {resourcesLoading ? (
                       <div className="p-6 space-y-4"><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /></div>
                    ) : resources && resources.length > 0 ? (
                      <div className="divide-y divide-secondary/30">
                        {resources.map((resource) => (
                          <div key={resource.id} className="flex items-center justify-between p-4 hover:bg-primary/[0.02] transition-colors group">
                            <div className="flex items-center gap-4">
                               <div className="w-10 h-10 rounded-xl bg-secondary/50 flex items-center justify-center">
                                 {resource.type === 'link' ? <LinkIcon className="h-4 w-4 text-primary" /> : <FileText className="h-4 w-4 text-primary" />}
                               </div>
                               <div>
                                 <Link href={resource.url} target="_blank" className="font-bold text-sm hover:text-primary transition-colors block">
                                    {resource.title}
                                 </Link>
                                 <span className="text-[8px] font-black uppercase text-muted-foreground tracking-widest">{resource.type}</span>
                               </div>
                            </div>
                            <Button variant="ghost" size="icon" onClick={() => handleDelete(resource.id)} className="h-8 w-8 text-destructive opacity-0 group-hover:opacity-100 transition-opacity rounded-full hover:bg-destructive/10">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="py-20 text-center space-y-4">
                        <BookMarked className="h-10 w-10 mx-auto text-muted-foreground/20" />
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50">Your library is currently empty.</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </ProfileSetupGate>
        </main>
      </div>
    </ProtectedRoute>
  );
}