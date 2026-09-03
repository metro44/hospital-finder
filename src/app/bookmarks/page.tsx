'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Button, Empty, Result } from 'antd';
import { ArrowLeft } from 'lucide-react';
import { SignedIn, SignedOut, SignInButton } from '@clerk/nextjs';
import Header from '@/components/Header';
import HospitalCard from '@/components/HospitalCard';
import LoadingState from '@/components/LoadingState';
import { bookmarkToHospital, listBookmarks, type BookmarkItem } from '@/lib/bookmarks';

export default function SavedHospitalsPage() {
  const [items, setItems] = useState<BookmarkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setItems(await listBookmarks());
    } catch (e) {
      setError(
        e instanceof Error && e.message !== 'unauthorized' ? e.message : 'Failed to load saved hospitals',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <div className="min-h-screen gradient-primary">
      <Header />
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <div className="mb-5 flex items-center justify-between">
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">Saved hospitals</h1>
          <Link href="/">
            <Button type="text" size="small" icon={<ArrowLeft className="h-4 w-4" />}>
              Back to search
            </Button>
          </Link>
        </div>

        <SignedOut>
          <div className="surface p-6">
            <p className="mb-4 text-sm text-slate-600">
              Sign in to see the hospitals you have saved.
            </p>
            <SignInButton mode="modal">
              <Button type="primary">Sign in</Button>
            </SignInButton>
          </div>
        </SignedOut>

        <SignedIn>
          {loading ? (
            <LoadingState count={6} />
          ) : error ? (
            <div className="surface">
              <Result status="warning" subTitle={error} />
            </div>
          ) : items.length === 0 ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              className="surface !m-0 px-6 py-16"
              description={
                <span className="text-sm text-slate-500">
                  No saved hospitals yet. Save one from the search results.
                </span>
              }
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((b) => (
                <HospitalCard
                  key={b.id}
                  hospital={bookmarkToHospital(b)}
                  savedInitially
                  onUnsave={(id) => setItems((prev) => prev.filter((it) => it.placeId !== id))}
                />
              ))}
            </div>
          )}
        </SignedIn>
      </div>
    </div>
  );
}
