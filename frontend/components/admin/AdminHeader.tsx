import React from 'react';
import { useStore } from '@/lib/store';
import { Bell, Search, Home, MessageSquare } from 'lucide-react';
import Link from 'next/link';

interface AdminHeaderProps {
    title: string;
}

export default function AdminHeader({ title }: AdminHeaderProps) {
    const user = useStore(state => state.user);

    return (
        <header className="h-20 border-b border-white/5 bg-zinc-900/50 backdrop-blur-xl px-10 flex items-center justify-between sticky top-0 z-30">
            <div className="flex items-center gap-4">
                <h1 className="text-2xl font-bold bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">{title}</h1>
                <div className="flex items-center gap-2 ml-4">
                    <Link
                        href="/"
                        className="p-2 text-zinc-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors border border-transparent hover:border-white/10"
                        title="Go to Home"
                    >
                        <Home className="w-5 h-5" />
                    </Link>
                    <Link
                        href="/chat"
                        className="p-2 text-zinc-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors border border-transparent hover:border-white/10"
                        title="Go to Chatbot"
                    >
                        <MessageSquare className="w-5 h-5" />
                    </Link>
                </div>
            </div>

            <div className="flex items-center gap-6">
                <div className="relative hidden md:block">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <input
                        type="text"
                        placeholder="Search..."
                        className="h-10 pl-10 pr-4 rounded-full bg-black/20 border border-white/10 text-sm focus:ring-2 focus:ring-indigo-500/50 w-72 text-white placeholder-zinc-600 transition-all hover:bg-black/40 focus:bg-black/40 outline-none"
                    />
                </div>

                <div className="w-px h-8 bg-white/10" />

                <button className="relative p-2 text-zinc-400 hover:text-white transition-colors hover:bg-white/5 rounded-full">
                    <Bell className="w-5 h-5" />
                    <span className="absolute top-2 right-2 w-2 h-2 bg-indigo-500 rounded-full border-2 border-black" />
                </button>

                <div className="flex items-center gap-4 pl-2">
                    <div className="text-right hidden sm:block">
                        <p className="text-sm font-semibold text-white">{user?.name}</p>
                        <p className="text-xs text-zinc-500 capitalize">{user?.role}</p>
                    </div>
                    <div className="h-10 w-10 bg-gradient-to-br from-indigo-500 to-violet-500 rounded-full flex items-center justify-center text-white font-bold shadow-lg shadow-indigo-500/20 border border-white/10">
                        {user?.name?.[0]?.toUpperCase()}
                    </div>
                </div>
            </div>
        </header>
    );
}
