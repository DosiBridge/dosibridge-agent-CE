/**
 * Chat window component displaying messages
 */

'use client';

import { useStore } from '@/lib/store';
import { Loader2 } from 'lucide-react';
import { useEffect, useRef } from 'react';
import MessageBubble from './MessageBubble';

export default function ChatWindow() {
    const messages = useStore((state) => state.messages);
    const isStreaming = useStore((state) => state.isStreaming);
    const isLoading = useStore((state) => state.isLoading);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Filter out empty messages
    const displayMessages = messages.filter(msg => msg.content.trim() || msg.role === 'user');

    useEffect(() => {
        // Small delay to ensure DOM is updated
        const timeoutId = setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
        return () => clearTimeout(timeoutId);
    }, [messages, isStreaming]);

    return (
        <div className="flex-1 overflow-y-auto px-2 sm:px-4 md:px-6 py-4 sm:py-6 md:py-8 bg-[#343541] dark:bg-[#2d2d2f]" role="log" aria-label="Chat messages">
            {displayMessages.length === 0 && !isLoading ? (
                <div className="flex items-center justify-center h-full">
                    <div className="text-center max-w-md">
                        <h2 className="text-3xl font-semibold mb-2 text-gray-200">
                            How can I help you today?
                        </h2>
                    </div>
                </div>
            ) : (
                <div className="max-w-4xl mx-auto">
                    {displayMessages.map((message) => (
                        <MessageBubble key={message.id} message={message} />
                    ))}
                    {isStreaming && (
                        <div className="flex gap-3 sm:gap-4 mb-4 sm:mb-6 message-enter px-2 sm:px-0" aria-live="polite" aria-label="AI is typing">
                            <div className="flex-shrink-0 w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-gray-800 dark:bg-gray-700 flex items-center justify-center shadow-md">
                                <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 text-white animate-spin" aria-hidden="true" />
                            </div>
                            <div className="bg-[#343541] dark:bg-[#2d2d2f] rounded-2xl px-3 py-2.5 sm:px-4 sm:py-3 shadow-sm">
                                <div className="flex gap-1" aria-hidden="true">
                                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                </div>
                            </div>
                        </div>
                    )}
                    {isLoading && !isStreaming && (
                        <div className="flex items-center justify-center py-12">
                            <div className="text-center">
                                <Loader2 className="w-8 h-8 animate-spin text-[#10a37f] mx-auto mb-2" aria-label="Loading" />
                                <p className="text-sm text-gray-400">Loading conversation...</p>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} aria-hidden="true" />
                </div>
            )}
        </div>
    );
}

