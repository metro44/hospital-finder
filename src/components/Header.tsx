'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Button } from 'antd';
import { Bookmark } from 'lucide-react';
import { SignedIn, SignedOut, SignInButton, SignUpButton, UserButton } from '@clerk/nextjs';

export default function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--color-line)] bg-white/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-blue/10">
            <Image src="/hospital-svgrepo-com.svg" alt="" width={20} height={20} className="h-5 w-5" />
          </span>
          <span className="text-[15px] font-semibold tracking-tight text-slate-900">
            Hospital<span className="text-slate-400"> Finder</span>
          </span>
        </Link>

        <div className="flex items-center gap-2">
          <SignedIn>
            <Link href="/bookmarks">
              <Button type="text" size="small" icon={<Bookmark className="h-4 w-4" />}>
                <span className="hidden sm:inline">Saved</span>
              </Button>
            </Link>
            <UserButton
              appearance={{ elements: { userButtonAvatarBox: 'h-8 w-8' } }}
            />
          </SignedIn>
          <SignedOut>
            <SignInButton mode="modal">
              <Button type="text" size="small">
                Sign in
              </Button>
            </SignInButton>
            <SignUpButton mode="modal">
              <Button type="primary" size="small">
                Create account
              </Button>
            </SignUpButton>
          </SignedOut>
        </div>
      </div>
    </header>
  );
}
