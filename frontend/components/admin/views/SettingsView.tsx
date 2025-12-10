"use client";

import React, { useState, useEffect } from 'react';
import { Settings, Bell, Shield, Database, Layout, Lock } from 'lucide-react';
import { useStore } from '@/lib/store';
import { isPersistentAccessEnabled, enablePersistentAccess, disablePersistentAccess } from '@/lib/storage/authStorage';
import toast from 'react-hot-toast';

export default function SettingsView() {
    const { user, isSuperadmin, togglePersistentAccess } = useStore();
    const [persistentAccess, setPersistentAccess] = useState(false);
    const [loading, setLoading] = useState(false);
    const [settings, setSettings] = useState({
        registrationEnabled: true,
        force2FA: false,
        retention: '90 days',
        logLevel: 'Info'
    });

    useEffect(() => {
        if (typeof window !== 'undefined') {
            setPersistentAccess(isPersistentAccessEnabled());
        }
    }, []);

    const handleTogglePersistentAccess = async (enabled: boolean) => {
        if (!isSuperadmin()) {
            toast.error("Persistent access is only available for superadmin users");
            return;
        }
        setLoading(true);
        try {
            await togglePersistentAccess(enabled);
            setPersistentAccess(enabled);
            toast.success(enabled ? "Persistent access enabled." : "Persistent access disabled.");
        } catch (error: any) {
            toast.error(error?.message || "Failed to update persistent access setting");
        } finally {
            setLoading(false);
        }
    };

    const handleSave = () => {
        setLoading(true);
        // Simulate API saving
        setTimeout(() => {
            setLoading(false);
            toast.success("System settings saved successfully");
        }, 1000);
    };

    const Toggle = ({ active, onChange, disabled }: { active: boolean, onChange: (v: boolean) => void, disabled?: boolean }) => (
        <button
            onClick={() => onChange(!active)}
            disabled={disabled}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${active ? 'bg-indigo-500' : 'bg-zinc-700'
                } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-indigo-400'}`}
        >
            <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${active ? 'translate-x-6' : 'translate-x-1'
                    }`}
            />
        </button>
    );

    return (
        <div className="space-y-6">
            <div className="bg-zinc-900/50 backdrop-blur-sm border border-white/5 rounded-3xl overflow-hidden">
                <div className="p-8 border-b border-white/5">
                    <h2 className="text-2xl font-bold flex items-center gap-3 text-white">
                        <div className="p-2 bg-indigo-500/10 rounded-xl border border-indigo-500/20">
                            <Settings className="w-6 h-6 text-indigo-400" />
                        </div>
                        System Settings
                    </h2>
                    <p className="text-zinc-400 mt-2 ml-14">Manage global platform configuration and security policies.</p>
                </div>

                <div className="p-8 space-y-10">
                    <section>
                        <h3 className="text-lg font-semibold mb-6 flex items-center gap-2 text-white">
                            <Shield className="w-5 h-5 text-indigo-400" />
                            Security & Access
                        </h3>
                        <div className="space-y-4 max-w-2xl">
                            {/* Persistent Access */}
                            {isSuperadmin() && (
                                <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/5 hover:border-white/10 transition-colors">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <Lock className="w-4 h-4 text-indigo-400" />
                                            <h4 className="font-medium text-white">Persistent Access</h4>
                                        </div>
                                        <p className="text-sm text-zinc-400">
                                            Keep superadmin session active across browser restarts.
                                        </p>
                                    </div>
                                    <Toggle
                                        active={persistentAccess}
                                        onChange={handleTogglePersistentAccess}
                                        disabled={loading}
                                    />
                                </div>
                            )}

                            {/* Registration */}
                            <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/5 hover:border-white/10 transition-colors">
                                <div>
                                    <h4 className="font-medium text-white">User Registration</h4>
                                    <p className="text-sm text-zinc-400">Allow new users to sign up for the platform.</p>
                                </div>
                                <Toggle
                                    active={settings.registrationEnabled}
                                    onChange={(v) => setSettings({ ...settings, registrationEnabled: v })}
                                />
                            </div>

                            {/* 2FA */}
                            <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/5 hover:border-white/10 transition-colors">
                                <div>
                                    <h4 className="font-medium text-white">Enforce 2FA</h4>
                                    <p className="text-sm text-zinc-400">Require two-factor authentication for all admin accounts.</p>
                                </div>
                                <Toggle
                                    active={settings.force2FA}
                                    onChange={(v) => setSettings({ ...settings, force2FA: v })}
                                />
                            </div>
                        </div>
                    </section>

                    <section>
                        <h3 className="text-lg font-semibold mb-6 flex items-center gap-2 text-white">
                            <Database className="w-5 h-5 text-blue-400" />
                            Data Management
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl">
                            <div className="p-4 bg-white/5 rounded-xl border border-white/5 hover:border-white/10 transition-colors">
                                <label className="block text-sm font-medium mb-3 text-zinc-300">Chat History Retention</label>
                                <select
                                    value={settings.retention}
                                    onChange={(e) => setSettings({ ...settings, retention: e.target.value })}
                                    className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                                >
                                    <option>30 days</option>
                                    <option>90 days</option>
                                    <option>1 year</option>
                                    <option>Forever</option>
                                </select>
                            </div>
                            <div className="p-4 bg-white/5 rounded-xl border border-white/5 hover:border-white/10 transition-colors">
                                <label className="block text-sm font-medium mb-3 text-zinc-300">System Log Level</label>
                                <select
                                    value={settings.logLevel}
                                    onChange={(e) => setSettings({ ...settings, logLevel: e.target.value })}
                                    className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                                >
                                    <option>Info</option>
                                    <option>Debug</option>
                                    <option>Error</option>
                                    <option>Warning</option>
                                </select>
                            </div>
                        </div>
                    </section>
                </div>
                <div className="p-6 bg-white/[0.02] border-t border-white/5 flex justify-end">
                    <button
                        onClick={handleSave}
                        disabled={loading}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-2.5 rounded-xl font-medium shadow-lg shadow-indigo-500/20 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                        Save Changes
                    </button>
                </div>
            </div>
        </div>
    );
}
