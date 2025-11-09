/**
 * Message bubble component for chat messages
 */

'use client';

import { Message } from '@/lib/store';
import { Bot, Check, Copy, User } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface MessageBubbleProps {
    message: Message;
}

export default function MessageBubble({ message }: MessageBubbleProps) {
    const isUser = message.role === 'user';
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(message.content);
            setCopied(true);
            toast.success('Message copied!');
            setTimeout(() => setCopied(false), 2000);
        } catch (error) {
            toast.error('Failed to copy message');
        }
    };

    return (
        <div className={`group flex gap-3 sm:gap-4 mb-4 sm:mb-6 message-enter px-2 sm:px-0 ${isUser ? 'justify-end' : 'justify-start'}`}>
            {!isUser && (
                <div className="flex-shrink-0 w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-gray-800 dark:bg-gray-700 flex items-center justify-center shadow-md">
                    <Bot className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                </div>
            )}

            <div className={`flex flex-col max-w-[90%] sm:max-w-[85%] md:max-w-[75%] lg:max-w-[70%] ${isUser ? 'items-end' : 'items-start'}`}>
                <div className="relative w-full">
                    <div
                        className={`rounded-2xl px-3 py-2.5 sm:px-4 sm:py-3 shadow-sm ${isUser
                            ? 'bg-[#10a37f] text-white'
                            : 'bg-[#343541] dark:bg-[#2d2d2f] text-gray-100'
                            }`}
                    >
                        {isUser ? (
                            <p className="whitespace-pre-wrap break-words leading-relaxed">{message.content}</p>
                        ) : (
                            <div className="prose prose-sm dark:prose-invert max-w-none prose-pre:bg-[#1e1e1e] prose-pre:border prose-pre:border-gray-700">
                                <ReactMarkdown
                                    components={{
                                        code({ className, children, ...props }: any) {
                                            const match = /language-(\w+)/.exec(className || '');
                                            const language = match ? match[1] : '';
                                            const codeString = String(children).replace(/\n$/, '');
                                            const inline = !match; // If no language match, it's inline code

                                            return !inline && match ? (
                                                <SyntaxHighlighter
                                                    style={vscDarkPlus}
                                                    language={language}
                                                    PreTag="div"
                                                    className="rounded-lg !my-2"
                                                    {...props}
                                                >
                                                    {codeString}
                                                </SyntaxHighlighter>
                                            ) : (
                                                <code className={className} {...props}>
                                                    {children}
                                                </code>
                                            );
                                        },
                                    }}
                                >
                                    {message.content}
                                </ReactMarkdown>
                            </div>
                        )}
                    </div>
                    {!isUser && (
                        <button
                            onClick={handleCopy}
                            className="absolute -top-1 -right-1 sm:-top-2 sm:-right-2 p-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white transition-all opacity-0 group-hover:opacity-100 shadow-md"
                            aria-label="Copy message"
                        >
                            {copied ? (
                                <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                            ) : (
                                <Copy className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                            )}
                        </button>
                    )}
                </div>

                {message.tools_used && message.tools_used.length > 0 && (
                    <div className="mt-1.5 sm:mt-2 flex items-center gap-1.5 sm:gap-2 flex-wrap">
                        <span className="text-xs font-medium text-gray-400">Tools:</span>
                        {message.tools_used.map((tool, idx) => (
                            <span
                                key={idx}
                                className="text-xs px-2 py-0.5 bg-[#40414f] text-gray-300 rounded-full font-medium"
                            >
                                {tool}
                            </span>
                        ))}
                    </div>
                )}
            </div>

            {isUser && (
                <div className="flex-shrink-0 w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-[#10a37f] flex items-center justify-center shadow-md">
                    <User className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                </div>
            )}
        </div>
    );
}

