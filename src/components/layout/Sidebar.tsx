'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Dumbbell, LayoutDashboard, PlusCircle, LogIn, LogOut } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { authStore, useAuthStore } from '@/store/authStore';
import { getAuthNavState } from '@/lib/authUi';

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const hydrated = useAuthStore((state) => state.hydrated);
  const clearUser = useAuthStore((state) => state.clearUser);
  const supabase = createClient();

  const handleSignOut = async () => {
    clearUser();
    authStore.persist.clearStorage();
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  };

  const isActive = (path: string) => pathname === path;
  const navState = getAuthNavState(user);

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
        {!hydrated ? (
          <div className="px-4 py-3 text-xs text-slate-500">Checking session...</div>
        ) : user ? (
          <div className="space-y-2">
             <div className="px-4 py-2 text-xs text-slate-500 uppercase font-bold tracking-wider">
              {navState.greeting}
            </div>
            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors text-left"
            >
              <LogOut className="w-5 h-5" />
              <span className="font-medium">{navState.actionLabel}</span>
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
            <span className="font-medium">{navState.actionLabel}</span>
          </Link>
        )}
      </div>
    </aside>
  );
}
