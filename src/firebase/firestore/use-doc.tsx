'use client';
import { useState, useEffect } from 'react';
import {
  onSnapshot,
  type DocumentData,
  type DocumentReference,
  type SnapshotOptions,
} from 'firebase/firestore';

interface UseDocOptions {
  snapshotOptions?: SnapshotOptions;
}

export function useDoc<T = DocumentData>(
  ref: DocumentReference<T> | null,
  options?: UseDocOptions
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!ref) {
      setData(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = onSnapshot(
      ref,
      (snapshot) => {
        if (snapshot.exists()) {
          setData({
            ...(snapshot.data(options?.snapshotOptions) as T),
            id: snapshot.id,
          });
        } else {
          setData(null);
        }
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error(err);
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [ref]);

  return { data, loading, error };
}
