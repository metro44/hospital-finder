"use client";
 
import Image from 'next/image';

export default function Footer() {
  return (
    <footer className="bg-primary border-t border-[var(--color-accent)]">
      <div className="container py-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image src="/hospital.svg" alt="" width={24} height={24} />
            <span className="font-bold text-white">Hospital Finder</span>
          </div>
        </div>
        <div className="mt-2 flex items-center justify-between text-sm text-white">
          <p className="m-0">
          Facility data from OpenStreetMap · routing by openrouteservice · map by Google
          </p>
          <div className="flex items-center gap-3">
            <a href="https://linkedin.com/in/martins-chinwuba-50ab4935a" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn" className="hover:opacity-80 transition-all">
              <Image src="/icons/Linkedin.svg" alt="LinkedIn" width={24} height={24} className="icon-white" />
            </a>
            <a href="mailto:ebubemartins39@gmail.com" aria-label="Email" className="hover:opacity-80 transition-all">
              <Image src="/icons/Email.svg" alt="Email" width={24} height={24} className="icon-white" />
            </a>
          </div>
        </div>
        <div className="mt-6 text-xs text-white text-center">
          <p>© {new Date().getFullYear()} Hospital Finder. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}