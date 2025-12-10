"use client";

import { useState, useRef, useEffect, KeyboardEvent } from "react";
import { usePathname, useRouter } from "next/navigation";
import { MessageSquare, X, Send, Loader2, Minimize2, Maximize2, RefreshCw, Zap, Bot, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { createStreamReader, StreamChunk } from "@/lib/api";
import { useStore, Message } from "@/lib/store";
import ReactMarkdown from "react-markdown";
import { motion, AnimatePresence } from "framer-motion";

export default function MiniAgentChatbot() {
    const pathname = usePathname();
    const router = useRouter();
    const [isOpen, setIsOpen] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false); // For larger view
    const [input, setInput] = useState("");
    const [isTyping, setIsTyping] = useState(false); // Local streaming state for UI indicator
    const [streamingContent, setStreamingContent] = useState("");

    // Access global store
    const messages = useStore((state) => state.messages);
    const currentSessionId = useStore((state) => state.currentSessionId);
    const isAuthenticated = useStore((state) => state.isAuthenticated);

    // Actions
    const setCurrentSession = useStore((state) => state.setCurrentSession);
    const createNewSession = useStore((state) => state.createNewSession);
    const addMessage = useStore((state) => state.addMessage);
    const updateLastMessage = useStore((state) => state.updateLastMessage);

    // Limits
    const LIMIT_UNAUTH = 5;
    const LIMIT_AUTH = 15;
    const currentLimit = isAuthenticated ? LIMIT_AUTH : LIMIT_UNAUTH;
    // Count only user messages
    const userMessageCount = messages.filter(m => m.role === "user").length;
    const isLimitReached = userMessageCount >= currentLimit;
    const remainingRequests = Math.max(0, currentLimit - userMessageCount);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const abortRef = useRef<(() => void) | null>(null);

    // Initial persistence check
    useEffect(() => {
        // If on chat page, do nothing (component returns null anyway)
        if (pathname === "/chat" || pathname.startsWith("/chat/")) return;

        const storedMiniSessionId = localStorage.getItem("mini_session_id");

        if (storedMiniSessionId) {
            // If we have a saved mini session, switch to it
            if (currentSessionId !== storedMiniSessionId) {
                setCurrentSession(storedMiniSessionId);
            }
        } else {
            // No saved mini session, create one
            createNewSession();
            const newId = useStore.getState().currentSessionId;
            localStorage.setItem("mini_session_id", newId);
        }
    }, [pathname, setCurrentSession, createNewSession, currentSessionId]);

    // Scroll to bottom when messages change
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, streamingContent, isOpen]);

    // Adjust textarea height
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = "auto";
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 100)}px`;
        }
    }, [input]);

    // Hidden on chat page - must be after all hooks to ensure hook count consistency? 
    // Actually hooks must be top level. 
    // Returning null conditionally is fine as long as hooks run before return? 
    // React hooks rules say unconditional. But if we return early, hooks below won't run.
    // Fixed: moved early return down or ensured hooks are above.
    // The previous implementation had early return in middle, which is technically unsafe but worked if pathname didn't change on the fly without remount.
    // Safe approach: render nothing but null, but hooks still execute. 
    // Or just early return if we trust pathname doesn't change implicitly without re-render.
    // Component unmounts on navigation usually.

    if (pathname === "/chat" || pathname.startsWith("/chat/")) {
        return null;
    }

    const handleToggle = () => setIsOpen(!isOpen);
    const handleExpand = () => setIsExpanded(!isExpanded);

    const handleReset = () => {
        // Create new session specifically for mini chatbot
        createNewSession();
        const newId = useStore.getState().currentSessionId;
        localStorage.setItem("mini_session_id", newId);

        setStreamingContent("");
        setIsTyping(false);
        if (abortRef.current) {
            abortRef.current();
            abortRef.current = null;
        }
    };

    const handleSend = async () => {
        if (!input.trim() || isTyping || isLimitReached) return;

        const userMessage = input.trim();
        setInput("");
        if (textareaRef.current) textareaRef.current.style.height = "auto";

        // Add user message to global store
        addMessage({
            role: "user",
            content: userMessage,
        });

        setIsTyping(true);
        setStreamingContent("");

        let currentStreamedText = "";

        try {
            abortRef.current = createStreamReader(
                {
                    message: userMessage,
                    session_id: currentSessionId,
                    mode: "agent",
                },
                (chunk: StreamChunk) => {
                    if (chunk.chunk) {
                        currentStreamedText += chunk.chunk;
                        setStreamingContent(currentStreamedText);
                        // Optional: update store incrementally for real-time feel if desired, 
                        // but updating store triggers re-renders of all messages. 
                        // MiniChatbot can keep local streaming state for smoother UI until done.
                        // Or we can updateStore occasionally.
                        // For consistency with specific requirement "session is available on chat page", 
                        // we should update store so if user switches immediately they see it.
                        updateLastMessage(chunk.chunk);
                    }
                },
                (error) => {
                    console.error("Mini Chat Error", error);
                    setIsTyping(false);
                    // Add error message to store
                    addMessage({
                        role: "assistant",
                        content: "Sorry, I encountered an error. Please try again."
                    });
                },
                () => {
                    // onFinish
                    setIsTyping(false);
                    setStreamingContent("");
                    abortRef.current = null;
                }
            );
        } catch (err) {
            console.error(err);
            setIsTyping(false);
        }
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleGoToChat = () => {
        router.push("/chat");
    }

    return (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-4 font-sans pointer-events-none">
            {/* Use pointer-events-auto on interactive elements */}

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20, transformOrigin: "bottom right" }}
                        animate={{
                            opacity: 1,
                            scale: 1,
                            y: 0,
                            width: isExpanded ? "32rem" : "22rem",
                            height: isExpanded ? "80vh" : "32rem"
                        }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        transition={{ type: "spring", stiffness: 300, damping: 25 }}
                        className="pointer-events-auto flex flex-col bg-zinc-900/90 backdrop-blur-2xl border border-white/10 shadow-2xl rounded-2xl overflow-hidden ring-1 ring-white/5"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-600/5 to-indigo-600/5 border-b border-white/5 shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="relative">
                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg">
                                        <Bot className="w-5 h-5 text-white" />
                                    </div>
                                    <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 border-2 border-zinc-900 rounded-full animate-pulse"></span>
                                </div>
                                <div className="flex flex-col">
                                    <span className="font-semibold text-sm text-zinc-100">AI Assistant</span>
                                    <span className="text-[10px] text-zinc-400 flex items-center gap-1">
                                        <span className={cn("w-1 h-1 rounded-full", isLimitReached ? "bg-red-500" : "bg-green-500")}></span>
                                        {isLimitReached ? "Limit Reached" : `${remainingRequests} requests left`}
                                    </span>
                                </div>
                            </div>
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={handleGoToChat}
                                    className="p-1.5 text-zinc-400 hover:text-white hover:bg-white/10 rounded-md transition-colors"
                                    title="Open Full Chat"
                                >
                                    <ArrowRight className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={handleReset}
                                    className="p-1.5 text-zinc-400 hover:text-white hover:bg-white/10 rounded-md transition-colors"
                                    title="Reset Chat"
                                >
                                    <RefreshCw className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={handleExpand}
                                    className="p-1.5 text-zinc-400 hover:text-white hover:bg-white/10 rounded-md transition-colors"
                                >
                                    {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                                </button>
                                <button
                                    onClick={() => setIsOpen(false)}
                                    className="p-1.5 text-zinc-400 hover:text-white hover:bg-white/10 rounded-md transition-colors"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        {/* Messages */}
                        {/* scrollbar-width: none is handles by tailwind utility usually, forcing inline style for safety */}
                        <div
                            className="flex-1 overflow-y-auto p-4 space-y-4"
                            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                        >
                            <style jsx>{`
                                div::-webkit-scrollbar {
                                    display: none;
                                }
                            `}</style>

                            {/* Filter empty messages if any */}
                            {messages.filter(m => m.content).length === 0 && (
                                <div className="h-full flex flex-col items-center justify-center text-center text-zinc-500 space-y-4">
                                    <motion.div
                                        initial={{ scale: 0.8, opacity: 0 }}
                                        animate={{ scale: 1, opacity: 1 }}
                                        transition={{ delay: 0.2 }}
                                        className="w-16 h-16 bg-gradient-to-br from-zinc-800 to-zinc-900 rounded-3xl flex items-center justify-center mb-2 shadow-inner border border-white/5"
                                    >
                                        <Bot className="w-8 h-8 text-zinc-600" />
                                    </motion.div>
                                    <motion.div
                                        initial={{ y: 10, opacity: 0 }}
                                        animate={{ y: 0, opacity: 1 }}
                                        transition={{ delay: 0.3 }}
                                    >
                                        <p className="text-sm font-medium text-zinc-300">How can I help you today?</p>
                                        <p className="text-xs text-zinc-500 mt-1">Ask me anything about DosiBridge</p>
                                    </motion.div>
                                </div>
                            )}

                            {messages.map((msg, index) => (
                                <motion.div
                                    key={msg.id || index}
                                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    transition={{ duration: 0.2 }}
                                    className={cn(
                                        "flex w-full",
                                        msg.role === "user" ? "justify-end" : "justify-start"
                                    )}
                                >
                                    <div
                                        className={cn(
                                            "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm",
                                            msg.role === "user"
                                                ? "bg-blue-600 text-white rounded-br-none"
                                                : "bg-zinc-800 text-zinc-200 rounded-bl-none border border-white/5"
                                        )}
                                    >
                                        {msg.role === "assistant" ? (
                                            <div className="prose prose-invert prose-sm max-w-none">
                                                <ReactMarkdown>{msg.content}</ReactMarkdown>
                                            </div>
                                        ) : (
                                            msg.content
                                        )}
                                    </div>
                                </motion.div>
                            ))}

                            {isTyping && !streamingContent && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="flex w-full justify-start"
                                >
                                    <div className="max-w-[85%] rounded-2xl rounded-bl-none px-4 py-2.5 text-sm leading-relaxed bg-zinc-800 text-zinc-200 border border-white/5 shadow-sm">
                                        <div className="flex gap-1.5 items-center h-5 px-1">
                                            <motion.div
                                                animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
                                                transition={{ repeat: Infinity, duration: 1, ease: "easeInOut", delay: 0 }}
                                                className="w-1.5 h-1.5 bg-zinc-400 rounded-full"
                                            />
                                            <motion.div
                                                animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
                                                transition={{ repeat: Infinity, duration: 1, ease: "easeInOut", delay: 0.2 }}
                                                className="w-1.5 h-1.5 bg-zinc-400 rounded-full"
                                            />
                                            <motion.div
                                                animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
                                                transition={{ repeat: Infinity, duration: 1, ease: "easeInOut", delay: 0.4 }}
                                                className="w-1.5 h-1.5 bg-zinc-400 rounded-full"
                                            />
                                        </div>
                                    </div>
                                </motion.div>
                            )}

                            {isLimitReached && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="flex justify-center"
                                >
                                    <div className="bg-zinc-800/80 border border-red-500/20 rounded-xl p-3 text-center max-w-[90%]">
                                        <p className="text-xs text-zinc-300 mb-2">
                                            You've reached the request limit for the mini assistant.
                                        </p>
                                        <motion.button
                                            whileHover={{ scale: 1.05 }}
                                            whileTap={{ scale: 0.95 }}
                                            onClick={handleGoToChat}
                                            className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg flex items-center justify-center gap-1.5 mx-auto hover:bg-blue-500 transition-colors"
                                        >
                                            Go to Full Chat <ArrowRight className="w-3 h-3" />
                                        </motion.button>
                                    </div>
                                </motion.div>
                            )}

                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input */}
                        <div className="p-3 bg-zinc-900/50 border-t border-white/5 shrink-0 backdrop-blur-md">
                            <div className={cn(
                                "relative flex items-end gap-2 bg-black/40 border rounded-xl p-2 transition-all duration-200",
                                isLimitReached ? "opacity-50 pointer-events-none border-red-500/20" : "border-white/10 focus-within:border-blue-500/50 focus-within:ring-1 focus-within:ring-blue-500/20"
                            )}>
                                <textarea
                                    ref={textareaRef}
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    placeholder={isLimitReached ? "Limit reached" : "Ask a question..."}
                                    rows={1}
                                    disabled={isLimitReached}
                                    className="flex-1 bg-transparent border-none focus:ring-0 text-sm text-zinc-200 placeholder-zinc-500 resize-none max-h-32 py-1.5 pl-1 disabled:cursor-not-allowed"
                                />
                                <motion.button
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={handleSend}
                                    disabled={!input.trim() || isTyping || isLimitReached}
                                    className={cn(
                                        "p-2 rounded-lg transition-colors shadow-lg",
                                        !input.trim() || isTyping || isLimitReached
                                            ? "bg-zinc-800 text-zinc-500 cursor-not-allowed"
                                            : "bg-blue-600 text-white hover:bg-blue-500 shadow-blue-900/20"
                                    )}
                                >
                                    {isTyping ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                </motion.button>
                            </div>
                            <div className="text-[10px] text-zinc-600 text-center mt-2 flex items-center justify-center gap-1.5">
                                <Zap className="w-3 h-3 text-yellow-500/40" />
                                <span>Powered by DosiBridge AI</span>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Toggle Button */}
            <motion.button
                whileHover={{ scale: 1.05, rotate: isOpen ? 90 : 0 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleToggle}
                className={cn(
                    "pointer-events-auto w-14 h-14 rounded-full shadow-2xl flex items-center justify-center transition-all duration-300 z-50",
                    isOpen ? "bg-zinc-800 text-zinc-400 border border-white/10" : "bg-gradient-to-br from-blue-600 to-indigo-600 text-white border border-blue-400/20"
                )}
            >
                <AnimatePresence mode="wait" initial={false}>
                    {isOpen ? (
                        <motion.div
                            key="close"
                            initial={{ rotate: -90, opacity: 0 }}
                            animate={{ rotate: 0, opacity: 1 }}
                            exit={{ rotate: 90, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                        >
                            <X className="w-6 h-6" />
                        </motion.div>
                    ) : (
                        <motion.div
                            key="open"
                            initial={{ scale: 0.5, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.5, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                        >
                            {/* Pulse effect wrapper */}
                            <div className="absolute inset-0 rounded-full animate-ping bg-blue-500/20 -z-10" />
                            <MessageSquare className="w-6 h-6" />
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.button>
        </div>
    );
}
