import React, { useState } from 'react';
import { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { X, LayoutDashboard, Settings as SettingsIcon, User } from 'lucide-react';
import UserStatsView from './UserStatsView';
import AdminStatsView from './AdminStatsView';
import AdminUserTable from './AdminUserTable';
import { useStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import Link from 'next/link';

interface DashboardModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function DashboardModal({ isOpen, onClose }: DashboardModalProps) {
    const user = useStore(state => state.user);
    const impersonatedUserId = useStore(state => state.impersonatedUserId);
    const [activeTab, setActiveTab] = useState<'overview' | 'admin'>('overview');

    // Check if current user (impersonated or real) is superadmin
    // When impersonating, user is the impersonated user, so check their role
    const isSuperAdmin = user?.role === 'superadmin';
    
    // If impersonating a non-superadmin, don't show admin features
    const canAccessAdmin = isSuperAdmin && (!impersonatedUserId || user?.role === 'superadmin');

    return (
        <Transition appear show={isOpen} as={Fragment}>
            <Dialog as="div" className="relative z-50" onClose={onClose}>
                <Transition.Child
                    as={Fragment}
                    enter="ease-out duration-300"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="ease-in duration-200"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                >
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" />
                </Transition.Child>

                <div className="fixed inset-0 overflow-y-auto">
                    <div className="flex min-h-full items-center justify-center p-4">
                        <Transition.Child
                            as={Fragment}
                            enter="ease-out duration-300"
                            enterFrom="opacity-0 scale-95"
                            enterTo="opacity-100 scale-100"
                            leave="ease-in duration-200"
                            leaveFrom="opacity-100 scale-100"
                            leaveTo="opacity-0 scale-95"
                        >
                            <Dialog.Panel className="w-full max-w-4xl transform overflow-hidden rounded-2xl bg-zinc-950 border border-zinc-800 p-6 shadow-2xl transition-all">
                                <div className="flex items-center justify-between mb-6">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400">
                                            <LayoutDashboard className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <Dialog.Title as="h3" className="text-xl font-semibold text-white">
                                                Dashboard
                                            </Dialog.Title>
                                            <p className="text-sm text-zinc-400">
                                                Welcome back, {user?.name}
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={onClose}
                                        className="p-2 text-zinc-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>

                                <div className="flex border-b border-zinc-800 mb-6">
                                    <button
                                        onClick={() => setActiveTab('overview')}
                                        className={cn(
                                            "px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2",
                                            activeTab === 'overview'
                                                ? "border-indigo-500 text-indigo-400"
                                                : "border-transparent text-zinc-400 hover:text-white"
                                        )}
                                    >
                                        <User className="w-4 h-4" />
                                        My Overview
                                    </button>

                                    {canAccessAdmin && (
                                        <button
                                            onClick={() => setActiveTab('admin')}
                                            className={cn(
                                                "px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2",
                                                activeTab === 'admin'
                                                    ? "border-purple-500 text-purple-400"
                                                    : "border-transparent text-zinc-400 hover:text-white"
                                            )}
                                        >
                                            <SettingsIcon className="w-4 h-4" />
                                            Admin Console
                                        </button>
                                    )}
                                    {canAccessAdmin && (
                                        <div className="flex items-center gap-2 ml-auto">
                                            <Link
                                            href="/admin"
                                                className="px-3 py-1.5 text-xs font-medium text-zinc-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors flex items-center gap-1.5"
                                            >
                                                <LayoutDashboard className="w-3.5 h-3.5" />
                                                Full Admin Page
                                            </Link>
                                        </div>
                                    )}
                                </div>

                                <div className="min-h-[400px]">
                                    {activeTab === 'overview' ? (
                                        <UserStatsView />
                                    ) : canAccessAdmin ? (
                                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                            <AdminStatsView />
                                            <AdminUserTable />
                                        </div>
                                    ) : (
                                        <div className="flex items-center justify-center p-12 text-zinc-400">
                                            <div className="text-center">
                                                <p className="text-lg font-semibold mb-2">Admin access unavailable</p>
                                                <p className="text-sm">Admin features are not available when viewing as a regular user.</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </Dialog.Panel>
                        </Transition.Child>
                    </div>
                </div>
            </Dialog>
        </Transition>
    );
}
