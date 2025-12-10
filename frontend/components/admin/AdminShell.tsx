import React from 'react';
import AdminSidebar, { AdminView } from './AdminSidebar';
import AdminHeader from './AdminHeader';

interface AdminShellProps {
    children: React.ReactNode;
    currentView: AdminView;
    onChangeView: (view: AdminView) => void;
    title: string;
}

export default function AdminShell({ children, currentView, onChangeView, title }: AdminShellProps) {
    return (
        <div className="flex h-screen bg-black text-white overflow-hidden relative">
            {/* Dot Background Pattern */}
            <div className="absolute inset-0 bg-dot-white/[0.2] pointer-events-none z-0 opacity-20" />
            <div className="absolute inset-0 bg-black [mask-image:radial-gradient(ellipse_at_center,transparent_20%,black)] z-0 pointer-events-none" />

            <div className="relative z-20 flex w-full">
                <AdminSidebar currentView={currentView} onChangeView={onChangeView} />

                <div className="flex-1 flex flex-col min-w-0 bg-zinc-950/30 backdrop-blur-sm">
                    <AdminHeader title={title} />
                    <main className="flex-1 p-6 lg:p-10 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
                        <div className="max-w-7xl mx-auto w-full animate-in fade-in slide-in-from-bottom-4 duration-700">
                            {children}
                        </div>
                    </main>
                </div>
            </div>
        </div>
    );
}
