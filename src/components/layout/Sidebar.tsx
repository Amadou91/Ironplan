import Link from 'next/link';

export function Sidebar() {
    return (
        <aside className="w-64 bg-slate-900 text-white hidden md:flex flex-col border-r border-slate-800">
            <div className="p-6">
                <h1 className="text-2xl font-bold tracking-tighter">IRON<span className="text-indigo-500">PLAN</span></h1>
            </div>
            <nav className="flex-1 px-4 space-y-2">
                <Link href="/" className="block px-4 py-2 rounded hover:bg-slate-800 text-slate-300 hover:text-white transition">
                    Dashboard
                </Link>
                <Link href="/generate" className="block px-4 py-2 rounded bg-indigo-600 text-white font-medium shadow-lg shadow-indigo-900/20">
                    Builder
                </Link>
                <Link href="/library" className="block px-4 py-2 rounded hover:bg-slate-800 text-slate-300 hover:text-white transition">
                    Exercise Library
                </Link>
                <Link href="/history" className="block px-4 py-2 rounded hover:bg-slate-800 text-slate-300 hover:text-white transition">
                    History & Stats
                </Link>
            </nav>
            <div className="p-4 border-t border-slate-800">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-700"></div>
                    <div className="text-sm">
                        <div className="font-medium">User Profile</div>
                        <div className="text-slate-500 text-xs">Free Tier</div>
                    </div>
                </div>
            </div>
        </aside>
    );
}