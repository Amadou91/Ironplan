'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Dumbbell, LayoutDashboard, PlusCircle, LogIn, LogOut, Settings } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';

export default function Sidebar() {
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const supabase = createClient();

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    };
    getUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = '/';
  };

  const isActive = (path: string) => pathname === path;

  return (
    <aside className="w-64 h-screen bg-slate-900 text-white flex flex-col fixed left-0 top-0 border-r border-slate-800">
      <div className="p-6 flex items-center gap-3 border-b border-slate-800">
        <Dumbbell className="w-6 h-6 text-blue-500" />
        <span className="font-bold text-xl tracking-tight">Ironplan</span>
      </div>

      <nav className="flex-1 px-4 py-6 space-y-2">
        <Link
          href="/dashboard"
          className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
            isActive('/dashboard') 
              ? 'bg-blue-600 text-white' 
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <LayoutDashboard className="w-5 h-5" />
          <span className="font-medium">Dashboard</span>
        </Link>

        <Link
          href="/generate"
          className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
            isActive('/generate') 
              ? 'bg-blue-600 text-white' 
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <PlusCircle className="w-5 h-5" />
          <span className="font-medium">Generate Plan</span>
        </Link>
        
        {/* Add more links here if needed */}
      </nav>

      <div className="p-4 border-t border-slate-800">
        {user ? (
          <div className="space-y-2">
             <div className="px-4 py-2 text-xs text-slate-500 uppercase font-bold tracking-wider">
              {user.email?.split('@')[0]}
            </div>
            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors text-left"
            >
              <LogOut className="w-5 h-5" />
              <span className="font-medium">Sign Out</span>
            </button>
          </div>
        ) : (
          <Link
            href="/auth/login"
            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
              isActive('/auth/login') 
                ? 'bg-blue-600 text-white' 
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <LogIn className="w-5 h-5" />
            <span className="font-medium">Log In</span>
          </Link>
        )}
      </div>
    </aside>
  );
}