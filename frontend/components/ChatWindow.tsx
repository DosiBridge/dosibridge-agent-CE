/**
 * Chat window component displaying messages
 */

"use client";

import { useStore } from "@/lib/store";
import { Loader2, MessageSquare } from "lucide-react";
import { useEffect, useRef } from "react";
import MessageBubble from "./MessageBubble";

export default function ChatWindow() {
  const messages = useStore((state) => state.messages);
  const isStreaming = useStore((state) => state.isStreaming);
  const isLoading = useStore((state) => state.isLoading);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Filter out empty messages
  const displayMessages = messages.filter(
    (msg) => msg.content.trim() || msg.role === "user"
  );

  // Optimized scroll with throttling
  useEffect(() => {
    if (messagesEndRef.current) {
      // Use requestAnimationFrame for smoother scrolling
      const rafId = requestAnimationFrame(() => {
        messagesEndRef.current?.scrollIntoView({
          behavior: isStreaming ? "smooth" : "auto",
          block: "end",
        });
      });
      return () => cancelAnimationFrame(rafId);
    }
  }, [messages, isStreaming]);

  return (
    <div
      className="flex-1 overflow-y-auto px-2 sm:px-3 md:px-4 lg:px-6 py-3 sm:py-4 md:py-6 lg:py-8"
      role="log"
      aria-label="Chat messages"
    >
      {displayMessages.length === 0 && !isLoading ? (
        <div className="flex items-center justify-center h-full px-4 animate-fade-in">
          <div className="text-center max-w-md w-full">
            <div className="mb-6 flex justify-center">
              <div className="relative">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br from-[#10a37f] to-[#0d8f6e] flex items-center justify-center shadow-lg animate-pulse-ring">
                  <MessageSquare className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
                </div>
                <div className="absolute inset-0 rounded-full bg-[#10a37f] opacity-20 animate-ping" />
              </div>
            </div>
            <h2 className="text-xl sm:text-2xl md:text-3xl font-semibold mb-3 text-gray-200 animate-slide-in-right">
              How can I help you today?
            </h2>
            <p className="text-sm sm:text-base text-gray-400 mb-8 animate-slide-in-left">
              Start a conversation or ask me anything
            </p>
            <div className="mt-8 space-y-4 text-sm text-gray-400 animate-fade-in">
              <p className="font-medium text-gray-300">Keyboard shortcuts:</p>
              <div className="flex flex-wrap gap-3 justify-center">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-[#40414f] rounded-lg border border-gray-600 hover:border-[#10a37f] transition-colors">
                  <kbd className="px-1.5 py-0.5 bg-[#2d2d2f] rounded text-xs font-mono text-gray-300">
                    Ctrl/Cmd + N
                  </kbd>
                  <span className="text-gray-400 text-xs">New chat</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-[#40414f] rounded-lg border border-gray-600 hover:border-[#10a37f] transition-colors">
                  <kbd className="px-1.5 py-0.5 bg-[#2d2d2f] rounded text-xs font-mono text-gray-300">
                    Ctrl/Cmd + K
                  </kbd>
                  <span className="text-gray-400 text-xs">Toggle sidebar</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-[#40414f] rounded-lg border border-gray-600 hover:border-[#10a37f] transition-colors">
                  <kbd className="px-1.5 py-0.5 bg-[#2d2d2f] rounded text-xs font-mono text-gray-300">
                    Esc
                  </kbd>
                  <span className="text-gray-400 text-xs">Close modals</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="max-w-4xl mx-auto w-full">
          {displayMessages.map((message, index) => (
            <div
              key={message.id}
              className="animate-fade-in"
              style={{
                animationDelay: `${index * 50}ms`,
                animationFillMode: "both",
              }}
            >
              <MessageBubble
                message={message}
                isLast={index === displayMessages.length - 1}
              />
            </div>
          ))}
          {isStreaming && (
            <div
              className="flex gap-2 sm:gap-3 md:gap-4 mb-3 sm:mb-4 md:mb-6 message-enter px-1 sm:px-2"
              aria-live="polite"
              aria-label="AI is typing"
            >
              <div className="flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 md:w-9 md:h-9 rounded-full bg-gray-800 dark:bg-gray-700 flex items-center justify-center shadow-md">
                <Loader2
                  className="w-3.5 h-3.5 sm:w-4 sm:h-4 md:w-5 md:h-5 text-white animate-spin"
                  aria-hidden="true"
                />
              </div>
              <div className="bg-[#343541] dark:bg-[#2d2d2f] rounded-2xl px-3 py-2 sm:px-3 sm:py-2.5 md:px-4 md:py-3 shadow-sm">
                <div className="flex gap-1" aria-hidden="true">
                  <span
                    className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-gray-400 rounded-full animate-bounce"
                    style={{ animationDelay: "0ms" }}
                  />
                  <span
                    className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-gray-400 rounded-full animate-bounce"
                    style={{ animationDelay: "150ms" }}
                  />
                  <span
                    className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-gray-400 rounded-full animate-bounce"
                    style={{ animationDelay: "300ms" }}
                  />
                </div>
              </div>
            </div>
          )}
          {isLoading && !isStreaming && (
            <div className="flex items-center justify-center py-8 sm:py-12">
              <div className="text-center">
                <Loader2
                  className="w-6 h-6 sm:w-8 sm:h-8 animate-spin text-[#10a37f] mx-auto mb-2"
                  aria-label="Loading"
                />
                <p className="text-xs sm:text-sm text-gray-400">
                  Loading conversation...
                </p>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} aria-hidden="true" />
        </div>
      )}
    </div>
  );
}
