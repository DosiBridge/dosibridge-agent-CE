/**
 * Chat window component displaying messages
 */

"use client";

import { useStore } from "@/lib/store";
import { ArrowDown, Loader2, MessageSquare } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import MessageBubble from "./MessageBubble";
import ThinkingIndicator from "./ThinkingIndicator";
import { TextGenerateEffect } from "./ui/text-generate-effect";

export default function ChatWindow() {
  const messages = useStore((state) => state.messages);
  const isStreaming = useStore((state) => state.isStreaming);
  const isLoading = useStore((state) => state.isLoading);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastContentLengthRef = useRef(0);
  const lastMessageCountRef = useRef(0);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isUserScrollingRef = useRef(false);
  const scrollCheckTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);

  // Filter out empty messages
  const displayMessages = messages.filter(
    (msg) => msg.content.trim() || msg.role === "user"
  );

  // Get the last message content length for streaming detection
  const lastMessageContent = displayMessages.length > 0
    ? displayMessages[displayMessages.length - 1].content
    : "";
  const currentContentLength = lastMessageContent.length;

  // Track user scroll behavior to prevent auto-scroll when user scrolls up
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      isUserScrollingRef.current = true;
      // Reset flag after user stops scrolling
      if (scrollCheckTimeoutRef.current) {
        clearTimeout(scrollCheckTimeoutRef.current);
      }
      if (scrollCheckTimeoutRef.current) {
        clearTimeout(scrollCheckTimeoutRef.current);
      }
      scrollCheckTimeoutRef.current = setTimeout(() => {
        isUserScrollingRef.current = false;
      }, 150);

      // Show/hide scroll button logic
      const threshold = 100;
      const scrollTop = container.scrollTop;
      const scrollHeight = container.scrollHeight;
      const clientHeight = container.clientHeight;
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

      setShowScrollButton(distanceFromBottom > threshold);
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      container.removeEventListener("scroll", handleScroll);
      if (scrollCheckTimeoutRef.current) {
        clearTimeout(scrollCheckTimeoutRef.current);
      }
    };
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    setShowScrollButton(false);
  };

  // Improved smooth scrolling - triggers on content changes during streaming
  useEffect(() => {
    if (!containerRef.current || !messagesEndRef.current) return;

    const container = containerRef.current;
    const scrollElement = messagesEndRef.current;

    // Check if user is near bottom (within 150px) to auto-scroll
    const isNearBottom = () => {
      const threshold = 150;
      const scrollTop = container.scrollTop;
      const scrollHeight = container.scrollHeight;
      const clientHeight = container.clientHeight;
      return scrollHeight - scrollTop - clientHeight < threshold;
    };

    // Check if content changed (new message or streaming update)
    const isNewMessage = displayMessages.length > lastMessageCountRef.current;
    const isContentUpdate = currentContentLength > lastContentLengthRef.current;

    lastMessageCountRef.current = displayMessages.length;
    lastContentLengthRef.current = currentContentLength;

    // Only auto-scroll if:
    // 1. User hasn't manually scrolled up (or was near bottom)
    // 2. Content is updating (new message or streaming)
    const shouldAutoScroll =
      !isUserScrollingRef.current &&
      (isNewMessage || (isStreaming && isContentUpdate) || isNearBottom());

    if (shouldAutoScroll) {
      // Clear any pending scroll
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }

      // Use requestAnimationFrame for smooth scrolling
      scrollTimeoutRef.current = setTimeout(() => {
        requestAnimationFrame(() => {
          if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({
              behavior: isStreaming ? "smooth" : "auto",
              block: "end",
            });
          }
        });
      }, isStreaming ? 50 : 0); // Small delay for streaming to batch updates
    }

    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, [messages, isStreaming, displayMessages.length, currentContentLength]);

  // Continuous scroll during streaming (more aggressive for smooth experience)
  useEffect(() => {
    if (!isStreaming || !containerRef.current || !messagesEndRef.current) {
      return;
    }

    // More frequent updates during streaming for smoother experience
    const scrollInterval = setInterval(() => {
      if (!containerRef.current || !messagesEndRef.current) return;

      const container = containerRef.current;
      const scrollTop = container.scrollTop;
      const scrollHeight = container.scrollHeight;
      const clientHeight = container.clientHeight;
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

      // Only scroll if user is near bottom (within 200px) and not manually scrolling
      if (distanceFromBottom < 200 && !isUserScrollingRef.current) {
        requestAnimationFrame(() => {
          if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({
              behavior: "smooth",
              block: "end",
            });
          }
        });
      }
    }, 100); // Update every 100ms during streaming for smoother experience

    return () => clearInterval(scrollInterval);
  }, [isStreaming]);

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto px-2 sm:px-3 md:px-4 lg:px-6 py-3 sm:py-4 bg-transparent scroll-smooth"
      role="log"
      aria-label="Chat messages"
      style={{
        scrollBehavior: "smooth",
      }}
    >
      {displayMessages.length === 0 && !isLoading ? (
        <div className="flex items-center justify-center h-full px-4 animate-fade-in">
          <div className="text-center max-w-md w-full">
            <div className="mb-6 flex justify-center">
              <div className="relative">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br from-[var(--green)] to-[var(--green-hover)] flex items-center justify-center shadow-lg animate-pulse-ring">
                  <MessageSquare className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
                </div>
                <div className="absolute inset-0 rounded-full bg-[var(--green)] opacity-20 animate-ping" />
              </div>
            </div>
            <div className="mb-3">
              <TextGenerateEffect
                words="How can I help you today?"
                className="text-xl sm:text-2xl md:text-3xl font-semibold text-[var(--text-primary)] text-center animate-slide-in-right"
              />
            </div>
            <p className="text-sm sm:text-base text-[var(--text-secondary)] mb-8 animate-slide-in-left">
              Start a conversation or ask me anything
            </p>
            <div className="mt-8 space-y-4 text-sm text-[var(--text-secondary)] animate-fade-in">
              <p className="font-medium text-[var(--text-primary)]">
                Keyboard shortcuts:
              </p>
              <div className="flex flex-wrap gap-3 justify-center">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-[var(--surface-elevated)] backdrop-blur-sm rounded-lg border border-[var(--border)] hover:border-[var(--green)] transition-colors">
                  <kbd className="px-1.5 py-0.5 bg-[var(--surface)] backdrop-blur-sm rounded text-xs font-mono text-[var(--text-primary)]">
                    Ctrl/Cmd + N
                  </kbd>
                  <span className="text-[var(--text-secondary)] text-xs">
                    New chat
                  </span>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-[var(--surface-elevated)] backdrop-blur-sm rounded-lg border border-[var(--border)] hover:border-[var(--green)] transition-colors">
                  <kbd className="px-1.5 py-0.5 bg-[var(--surface)] backdrop-blur-sm rounded text-xs font-mono text-[var(--text-primary)]">
                    Ctrl/Cmd + K
                  </kbd>
                  <span className="text-[var(--text-secondary)] text-xs">
                    Toggle sidebar
                  </span>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-[var(--surface-elevated)] backdrop-blur-sm rounded-lg border border-[var(--border)] hover:border-[var(--green)] transition-colors">
                  <kbd className="px-1.5 py-0.5 bg-[var(--surface)] backdrop-blur-sm rounded text-xs font-mono text-[var(--text-primary)]">
                    Esc
                  </kbd>
                  <span className="text-[var(--text-secondary)] text-xs">
                    Close modals
                  </span>
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
          {/* Show thinking indicator when streaming */}
          {isStreaming && <ThinkingIndicator />}
          {isLoading && !isStreaming && (
            <div className="flex items-center justify-center py-8 sm:py-12">
              <div className="text-center">
                <Loader2
                  className="w-6 h-6 sm:w-8 sm:h-8 animate-spin text-[var(--green)] mx-auto mb-2"
                  aria-label="Loading"
                />
                <p className="text-xs sm:text-sm text-[var(--text-secondary)]">
                  Loading conversation...
                </p>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} aria-hidden="true" />
        </div>
      )}

      {/* Scroll to Bottom Button */}
      {showScrollButton && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-20 left-1/2 -translate-x-1/2 p-2 rounded-full bg-[var(--surface-elevated)] border border-[var(--border)] shadow-lg hover:bg-[var(--surface-hover)] transition-all duration-200 animate-in fade-in zoom-in cursor-pointer z-30 group"
          aria-label="Scroll to bottom"
        >
          <ArrowDown className="w-5 h-5 text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]" />
        </button>
      )}
    </div>
  );
}
