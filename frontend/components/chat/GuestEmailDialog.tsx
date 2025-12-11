"use client";

import { Dialog, Transition } from "@headlessui/react";
import { Fragment, useState } from "react";
import { X, Mail, ArrowRight } from "lucide-react";

interface GuestEmailDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (email: string) => void;
}

export default function GuestEmailDialog({
    isOpen,
    onClose,
    onSubmit,
}: GuestEmailDialogProps) {
    const [email, setEmail] = useState("");
    const [error, setError] = useState("");

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!email.trim()) {
            setError("Email is required");
            return;
        }
        if (!/\S+@\S+\.\S+/.test(email)) {
            setError("Please enter a valid email address");
            return;
        }
        onSubmit(email);
        setEmail("");
        setError("");
        onClose();
    };

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
                    <div className="flex min-h-full items-center justify-center p-4 text-center">
                        <Transition.Child
                            as={Fragment}
                            enter="ease-out duration-300"
                            enterFrom="opacity-0 scale-95"
                            enterTo="opacity-100 scale-100"
                            leave="ease-in duration-200"
                            leaveFrom="opacity-100 scale-100"
                            leaveTo="opacity-0 scale-95"
                        >
                            <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-zinc-900 border border-zinc-800 p-6 text-left align-middle shadow-xl transition-all">
                                <div className="flex justify-between items-start mb-4">
                                    <Dialog.Title
                                        as="h3"
                                        className="text-lg font-medium leading-6 text-white flex items-center gap-2"
                                    >
                                        <Mail className="w-5 h-5 text-indigo-400" />
                                        Guest Access
                                    </Dialog.Title>
                                    <button
                                        onClick={onClose}
                                        className="text-zinc-400 hover:text-white transition-colors"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>

                                <div className="mt-2 text-sm text-zinc-400">
                                    <p className="mb-4">
                                        To continue chatting as a guest and monitor your usage limit (10 messages/day), please enter your email address.
                                    </p>
                                    <div className="p-3 bg-zinc-800/50 rounded-lg border border-zinc-700/50 mb-4 text-xs">
                                        <span className="font-semibold text-zinc-300">Note:</span> This email is used only for usage tracking and will verify your identity for monitoring.
                                    </div>
                                </div>

                                <form onSubmit={handleSubmit} className="mt-4">
                                    <div className="space-y-4">
                                        <div>
                                            <label htmlFor="guest-email" className="sr-only">
                                                Email address
                                            </label>
                                            <input
                                                id="guest-email"
                                                type="email"
                                                value={email}
                                                onChange={(e) => {
                                                    setEmail(e.target.value);
                                                    setError("");
                                                }}
                                                placeholder="Enter your email"
                                                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2.5 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
                                                autoFocus
                                            />
                                            {error && (
                                                <p className="mt-1 text-xs text-red-400">{error}</p>
                                            )}
                                        </div>

                                        <div className="flex gap-3 justify-end mt-6">
                                            <button
                                                type="button"
                                                onClick={onClose}
                                                className="px-4 py-2 text-sm font-medium text-zinc-300 hover:text-white transition-colors"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                type="submit"
                                                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors shadow-lg shadow-indigo-500/20"
                                            >
                                                Start Chatting
                                                <ArrowRight className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                </form>
                            </Dialog.Panel>
                        </Transition.Child>
                    </div>
                </div>
            </Dialog>
        </Transition>
    );
}
