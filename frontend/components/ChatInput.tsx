/**
 * Chat input component with send button and mode toggle
 * Uses AI SDK UI patterns for enhanced chat experience
 */

"use client";

import { useAutoResize } from "@/hooks/useAutoResize";
import { useDebounce } from "@/hooks/useDebounce";
import { useInputHistory } from "@/hooks/useInputHistory";
import { createStreamReader, StreamChunk } from "@/lib/api";
import { getUserFriendlyError, logError } from "@/lib/errors";
import { useStore } from "@/lib/store";
import {
  Loader2,
  Mic,
  Paperclip,
  Send,
  Settings,
  Sparkles,
  Square,
  X,
} from "lucide-react";
import type { KeyboardEvent } from "react";
import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";

export default function ChatInput() {
  const [input, setInput] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const abortRef = useRef<(() => void) | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const prevAuthRef = useRef<boolean | null>(null);

  // Auto-resize textarea
  useAutoResize(textareaRef, input, 1, 8);

  // Input history
  const { addToHistory, navigateHistory, saveCurrentInput } = useInputHistory();

  // Debounced input for suggestions
  const debouncedInput = useDebounce(input, 300);

  const currentSessionId = useStore((state) => state.currentSessionId);
  const mode = useStore((state) => state.mode);
  const isStreaming = useStore((state) => state.isStreaming);
  const isLoading = useStore((state) => state.isLoading);
  const useReact = useStore((state) => state.useReact);
  const selectedCollectionId = useStore((state) => state.selectedCollectionId);
  const isAuthenticated = useStore((state) => state.isAuthenticated);
  const setMode = useStore((state) => state.setMode);
  const setRagSettingsOpen = useStore((state) => state.setRagSettingsOpen);
  const addMessage = useStore((state) => state.addMessage);
  const updateLastMessage = useStore((state) => state.updateLastMessage);
  const updateLastMessageTools = useStore(
    (state) => state.updateLastMessageTools
  );
  const setStreaming = useStore((state) => state.setStreaming);
  const setLoading = useStore((state) => state.setLoading);

  // Cancel ongoing requests only when user explicitly logs out
  // Don't cancel on initial page load when not authenticated (agent mode works without login)
  useEffect(() => {
    // Track previous auth state - skip on first render
    if (prevAuthRef.current === null) {
      prevAuthRef.current = isAuthenticated;
      return; // Skip on first render
    }

    // Only cancel if user was authenticated and now logged out
    if (prevAuthRef.current && !isAuthenticated && (isStreaming || isLoading)) {
      // User logged out - cancel any ongoing requests
      if (abortRef.current) {
        abortRef.current();
        abortRef.current = null;
      }
      setStreaming(false);
      setLoading(false);
    }

    // Update previous auth state
    prevAuthRef.current = isAuthenticated;
  }, [isAuthenticated, isStreaming, isLoading, setStreaming, setLoading]);

  // textarea should be disabled only while loading/streaming
  const inputDisabled = isLoading || isStreaming;
  // send button should be disabled while loading/streaming or when there's no input
  const MAX_CHARS = 2000;
  const charCount = input.length;
  const exceedMax = charCount > MAX_CHARS;
  const sendDisabled = inputDisabled || !input.trim() || exceedMax;

  // Generate suggestions based on input
  useEffect(() => {
    let mounted = true;

    const updateSuggestions = () => {
      if (!mounted) return;

      if (
        debouncedInput.trim().length > 0 &&
        debouncedInput.trim().length < 20
      ) {
        // Simple suggestion logic - can be enhanced with AI
        const commonQueries = [
          "What is",
          "How to",
          "Explain",
          "Tell me about",
          "Help me with",
          "Show me",
          "Create",
          "Write",
          "Analyze",
          "Compare",
        ];

        const inputLower = debouncedInput.toLowerCase();
        const matched = commonQueries
          .filter((q) => q.toLowerCase().startsWith(inputLower))
          .slice(0, 3);

        if (matched.length > 0 && input.length > 0) {
          setSuggestions(matched);
          setShowSuggestions(true);
        } else {
          setSuggestions([]);
          setShowSuggestions(false);
        }
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    };

    // Use requestAnimationFrame to avoid synchronous setState
    const rafId = requestAnimationFrame(updateSuggestions);

    return () => {
      mounted = false;
      cancelAnimationFrame(rafId);
    };
  }, [debouncedInput, input]);

  // Close suggestions on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(e.target as Node) &&
        textareaRef.current &&
        !textareaRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    if (showSuggestions) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showSuggestions]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortRef.current) {
        abortRef.current();
      }
    };
  }, []);

  const handleSend = async () => {
    if (sendDisabled) return;

    // Check authentication only for RAG mode
    if (mode === "rag" && !isAuthenticated) {
      toast.error(
        "Please log in to use RAG mode. RAG mode requires authentication."
      );
      return;
    }

    const message = input.trim();
    if (!message) return;

    // Add to history
    addToHistory(message);

    // Close suggestions
    setShowSuggestions(false);

    setInput("");
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    // keep focus on textarea so user can continue typing
    setTimeout(() => textareaRef.current?.focus(), 0);
    setLoading(true);
    setStreaming(true);

    // Add user message
    addMessage({
      role: "user",
      content: message,
    });

    // Add placeholder assistant message
    addMessage({
      role: "assistant",
      content: "",
    });

    const toolsUsed: string[] = [];
    let hasReceivedContent = false;

    try {
      abortRef.current = createStreamReader(
        {
          message,
          session_id: currentSessionId,
          mode,
          collection_id: mode === "rag" ? selectedCollectionId : null,
          use_react: mode === "rag" ? useReact : false,
        },
        (chunk: StreamChunk) => {
          if (chunk.error) {
            toast.error(chunk.error);
            // Remove empty assistant message on error
            const messages = useStore.getState().messages;
            if (
              messages.length > 0 &&
              messages[messages.length - 1].role === "assistant" &&
              !messages[messages.length - 1].content
            ) {
              useStore.setState({ messages: messages.slice(0, -1) });
            }
            setStreaming(false);
            setLoading(false);
            // Auto-focus on chat input when error occurs
            setTimeout(() => textareaRef.current?.focus(), 100);
            return;
          }

          if (chunk.tool) {
            toolsUsed.push(chunk.tool);
          }

          // Process content chunks - accept all chunks including spaces
          if (chunk.chunk !== undefined && chunk.chunk !== null) {
            hasReceivedContent = true;
            updateLastMessage(chunk.chunk);
          }

          if (chunk.done) {
            setStreaming(false);
            setLoading(false);

            // Remove empty assistant message if no content was received
            if (!hasReceivedContent) {
              const messages = useStore.getState().messages;
              if (
                messages.length > 0 &&
                messages[messages.length - 1].role === "assistant" &&
                !messages[messages.length - 1].content
              ) {
                useStore.setState({ messages: messages.slice(0, -1) });
              }
            }

            // Update last message with tools used
            if (chunk.tools_used && chunk.tools_used.length > 0) {
              updateLastMessageTools(chunk.tools_used);
            } else if (toolsUsed.length > 0) {
              updateLastMessageTools([...toolsUsed]);
            }

            // Auto-focus on chat input when response is complete
            setTimeout(() => textareaRef.current?.focus(), 100);
          }
        },
        (error: Error) => {
          logError(error, { session_id: currentSessionId, mode });
          const errorMessage = getUserFriendlyError(error);
          toast.error(errorMessage);
          // Remove empty assistant message on error
          const messages = useStore.getState().messages;
          if (
            messages.length > 0 &&
            messages[messages.length - 1].role === "assistant" &&
            !messages[messages.length - 1].content
          ) {
            useStore.setState({ messages: messages.slice(0, -1) });
          }
          setStreaming(false);
          setLoading(false);
          // Auto-focus on chat input when error occurs
          setTimeout(() => textareaRef.current?.focus(), 100);
        },
        () => {
          setStreaming(false);
          setLoading(false);
          // Auto-focus on chat input when stream is cancelled
          setTimeout(() => textareaRef.current?.focus(), 100);
        }
      );
    } catch (error) {
      logError(error instanceof Error ? error : new Error(String(error)), {
        session_id: currentSessionId,
        mode,
        message_length: message.length,
      });
      const errorMessage = getUserFriendlyError(error);
      toast.error(errorMessage);
      // Remove empty assistant message on error
      const messages = useStore.getState().messages;
      if (
        messages.length > 0 &&
        messages[messages.length - 1].role === "assistant" &&
        !messages[messages.length - 1].content
      ) {
        useStore.setState({ messages: messages.slice(0, -1) });
      }
      setStreaming(false);
      setLoading(false);
      // Auto-focus on chat input when error occurs
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  };

  const handleClear = () => {
    setInput("");
    setShowSuggestions(false);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
    setTimeout(() => textareaRef.current?.focus(), 0);
  };

  const handleSuggestionClick = (suggestion: string) => {
    setInput(suggestion);
    setShowSuggestions(false);
    setTimeout(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(
        suggestion.length,
        suggestion.length
      );
    }, 0);
  };

  const handleStop = () => {
    if (abortRef.current) {
      abortRef.current();
      abortRef.current = null;
      setStreaming(false);
      setLoading(false);
      toast.success("Generation stopped");
      // Auto-focus on chat input when stopped
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  };

  const handleKeyPress = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Handle arrow keys for history navigation
    if (e.key === "ArrowUp" && input === "" && e.ctrlKey === false) {
      e.preventDefault();
      const historyItem = navigateHistory("up");
      if (historyItem !== null) {
        setInput(historyItem);
        // Move cursor to end
        setTimeout(() => {
          if (textareaRef.current) {
            textareaRef.current.setSelectionRange(
              historyItem.length,
              historyItem.length
            );
          }
        }, 0);
      }
      return;
    }

    if (e.key === "ArrowDown" && e.ctrlKey === false) {
      const historyItem = navigateHistory("down");
      if (historyItem !== null) {
        setInput(historyItem);
        setTimeout(() => {
          if (textareaRef.current) {
            textareaRef.current.setSelectionRange(
              historyItem.length,
              historyItem.length
            );
          }
        }, 0);
      }
      return;
    }

    // Save current input for history
    saveCurrentInput(input);

    // Enter (without Shift) sends. Ctrl/Cmd+Enter also sends.
    if (e.key === "Enter") {
      if ((e.ctrlKey || e.metaKey) && !sendDisabled) {
        e.preventDefault();
        handleSend();
        return;
      }

      if (!e.shiftKey && !sendDisabled) {
        e.preventDefault();
        handleSend();
      }
    }

    // Close suggestions on Escape
    if (e.key === "Escape") {
      setShowSuggestions(false);
    }
  };

  return (
    <div className="border-t border-gray-700 bg-[#343541] dark:bg-[#2d2d2f] shrink-0 safe-area-inset-bottom">
      <div className="max-w-4xl mx-auto px-2 sm:px-3 md:px-4 lg:px-6 py-2 sm:py-3 md:py-4">
        {/* Mode selector */}
        <div className="flex justify-center items-center gap-2 mb-2 sm:mb-2.5 md:mb-3">
          <div className="inline-flex items-center rounded-lg border border-gray-600 bg-[#40414f] p-0.5 sm:p-1 shadow-sm">
            <button
              onClick={() => {
                setMode("agent");
              }}
              disabled={inputDisabled}
              className={`px-2.5 py-1.5 sm:px-3 sm:py-1.5 md:px-4 text-xs sm:text-sm font-medium rounded-md transition-all duration-200 touch-manipulation relative ${
                mode === "agent"
                  ? "bg-[#10a37f] text-white shadow-sm hover:bg-[#0d8f6e]"
                  : "text-gray-400 hover:text-gray-200 hover:bg-[#2d2d2f]"
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              Agent
              {mode === "agent" && (
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              )}
            </button>
            <button
              onClick={() => {
                if (!isAuthenticated) {
                  toast.error(
                    "Please log in to use RAG mode. RAG mode requires authentication to upload and query documents."
                  );
                  return;
                }
                setMode("rag");
              }}
              disabled={!isAuthenticated || inputDisabled}
              className={`px-2.5 py-1.5 sm:px-3 sm:py-1.5 md:px-4 text-xs sm:text-sm font-medium rounded-md transition-all duration-200 touch-manipulation relative ${
                mode === "rag"
                  ? "bg-[#10a37f] text-white shadow-sm hover:bg-[#0d8f6e]"
                  : "text-gray-400 hover:text-gray-200 hover:bg-[#2d2d2f]"
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              RAG
              {mode === "rag" && (
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              )}
            </button>
          </div>
          {mode === "rag" && (
            <button
              onClick={() => setRagSettingsOpen(true)}
              disabled={inputDisabled}
              className="p-1.5 sm:p-2 hover:bg-[#40414f] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="RAG Settings"
            >
              <Settings className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 hover:text-[#10a37f]" />
            </button>
          )}
        </div>

        {/* Chat input */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex gap-2 sm:gap-2.5 md:gap-3 relative"
        >
          <div className="flex-1 relative">
            {/* Suggestions dropdown */}
            {showSuggestions && suggestions.length > 0 && (
              <div
                ref={suggestionsRef}
                className="absolute bottom-full left-0 right-0 mb-2 bg-[#343541] border border-gray-700 rounded-lg shadow-xl overflow-hidden z-50 animate-scale-in"
              >
                {suggestions.map((suggestion, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => handleSuggestionClick(suggestion)}
                    className="w-full text-left px-4 py-2.5 text-sm text-gray-300 hover:bg-[#40414f] transition-colors flex items-center gap-2"
                  >
                    <Sparkles className="w-4 h-4 text-[#10a37f] shrink-0" />
                    <span className="flex-1">{suggestion}</span>
                  </button>
                ))}
              </div>
            )}

            <div className="relative">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  saveCurrentInput(e.target.value);
                }}
                onKeyDown={handleKeyPress}
                onFocus={() => {
                  if (suggestions.length > 0 && input.length > 0) {
                    setShowSuggestions(true);
                  }
                }}
                placeholder={
                  mode === "agent"
                    ? "Ask me anything with tools..."
                    : "Ask me about your documents..."
                }
                disabled={inputDisabled}
                rows={1}
                className="w-full px-3 py-2.5 sm:px-3.5 sm:py-3 md:px-4 md:py-3.5 pr-20 sm:pr-24 md:pr-28 border border-gray-600 rounded-2xl resize-none focus:outline-none focus:ring-2 focus:ring-[#10a37f] focus:border-[#10a37f] bg-[#40414f] text-gray-100 placeholder-gray-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm sm:text-base shadow-sm hover:border-gray-500 focus:shadow-md"
                style={{
                  minHeight: "44px",
                  maxHeight: "200px",
                  boxSizing: "border-box",
                }}
                aria-label="Message input"
              />

              {/* Action buttons inside textarea */}
              <div className="absolute right-2 sm:right-2.5 md:right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                {/* File attachment button (future feature) */}
                <button
                  type="button"
                  onClick={() => {
                    toast("File attachment coming soon!", { icon: "📎" });
                  }}
                  disabled={inputDisabled}
                  className="p-1.5 sm:p-2 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-[#2d2d2f] transition-all disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
                  aria-label="Attach file"
                  title="Attach file (coming soon)"
                >
                  <Paperclip className="w-4 h-4 sm:w-4 sm:h-4" />
                </button>

                {/* Voice input button (future feature) */}
                <button
                  type="button"
                  onClick={() => {
                    toast("Voice input coming soon!", { icon: "🎤" });
                  }}
                  disabled={inputDisabled}
                  className="p-1.5 sm:p-2 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-[#2d2d2f] transition-all disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
                  aria-label="Voice input"
                  title="Voice input (coming soon)"
                >
                  <Mic className="w-4 h-4 sm:w-4 sm:h-4" />
                </button>

                {/* Clear button */}
                {input && !inputDisabled && (
                  <button
                    type="button"
                    onClick={handleClear}
                    className="p-1.5 sm:p-1.5 md:p-2 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-[#2d2d2f] transition-all touch-manipulation animate-fade-in"
                    aria-label="Clear message"
                    title="Clear (Esc)"
                  >
                    <X className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Character counter */}
            {charCount > 0 && (
              <div className="absolute -bottom-5 right-0 text-xs flex items-center gap-1">
                <span
                  className={
                    exceedMax
                      ? "text-red-500 font-medium animate-pulse"
                      : charCount > MAX_CHARS * 0.9
                      ? "text-yellow-500"
                      : "text-gray-400"
                  }
                >
                  {charCount}
                </span>
                <span className="text-gray-500">/</span>
                <span className="text-gray-400">{MAX_CHARS}</span>
                {exceedMax && (
                  <span className="ml-2 text-red-500 text-xs">⚠️ Too long</span>
                )}
              </div>
            )}
          </div>

          {/* Stop / Send button */}
          {isStreaming ? (
            <button
              type="button"
              onClick={handleStop}
              className="shrink-0 h-11 w-11 sm:h-12 sm:w-12 md:h-14 md:w-14 rounded-2xl bg-red-500 hover:bg-red-600 active:bg-red-700 text-white transition-all shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 touch-manipulation relative group"
              aria-label="Stop generation"
              title="Stop generation"
            >
              <Square className="w-4 h-4 sm:w-4 sm:h-4 md:w-5 md:h-5 fill-white" />
              <span className="absolute inset-0 rounded-2xl bg-red-500 opacity-0 group-hover:opacity-20 animate-pulse" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={sendDisabled}
              className="shrink-0 h-11 w-11 sm:h-12 sm:w-12 md:h-14 md:w-14 rounded-2xl bg-[#10a37f] hover:bg-[#0d8f6e] active:bg-[#0b7d5f] disabled:bg-gray-600 disabled:cursor-not-allowed text-white transition-all shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 disabled:scale-100 disabled:shadow-none flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-[#10a37f] focus:ring-offset-2 touch-manipulation relative group"
              aria-label="Send message"
              title={
                sendDisabled
                  ? exceedMax
                    ? "Message too long"
                    : "Enter a message to send"
                  : "Send message (Enter)"
              }
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 sm:w-4 sm:h-4 md:w-5 md:h-5 animate-spin" />
              ) : (
                <>
                  <Send className="w-4 h-4 sm:w-4 sm:h-4 md:w-5 md:h-5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  <span className="absolute inset-0 rounded-2xl bg-[#10a37f] opacity-0 group-hover:opacity-20 animate-pulse" />
                </>
              )}
            </button>
          )}
        </form>

        {/* Bottom section: Status and hints */}
        <div className="mt-2 sm:mt-3 flex items-center justify-between gap-2 text-xs">
          {/* Left: Status indicators */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Suggestions indicator */}
            {showSuggestions && suggestions.length > 0 && (
              <div className="flex items-center gap-1.5 text-[#10a37f] animate-fade-in">
                <Sparkles className="w-3 h-3 animate-pulse" />
                <span className="hidden sm:inline">Suggestions available</span>
                <span className="sm:hidden">Tips</span>
              </div>
            )}

            {/* Character count warning */}
            {charCount > MAX_CHARS * 0.9 && charCount <= MAX_CHARS && (
              <div className="flex items-center gap-1.5 text-yellow-500">
                <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 animate-pulse" />
                <span className="hidden sm:inline">
                  {MAX_CHARS - charCount} characters left
                </span>
                <span className="sm:hidden">{MAX_CHARS - charCount} left</span>
              </div>
            )}

            {/* Character limit exceeded */}
            {exceedMax && (
              <div className="flex items-center gap-1.5 text-red-500 animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                <span>Message too long</span>
              </div>
            )}
          </div>

          {/* Right: Keyboard shortcuts (hidden on mobile) */}
          <div className="hidden md:flex items-center gap-3 text-gray-500">
            <div className="flex items-center gap-1.5">
              <kbd className="px-1.5 py-0.5 text-xs font-mono bg-[#40414f] border border-gray-600 rounded text-gray-300 shadow-sm">
                Enter
              </kbd>
              <span>Send</span>
            </div>
            <div className="flex items-center gap-1.5">
              <kbd className="px-1.5 py-0.5 text-xs font-mono bg-[#40414f] border border-gray-600 rounded text-gray-300 shadow-sm">
                Shift
              </kbd>
              <span>+</span>
              <kbd className="px-1.5 py-0.5 text-xs font-mono bg-[#40414f] border border-gray-600 rounded text-gray-300 shadow-sm">
                Enter
              </kbd>
              <span>New line</span>
            </div>
            <div className="flex items-center gap-1.5">
              <kbd className="px-1.5 py-0.5 text-xs font-mono bg-[#40414f] border border-gray-600 rounded text-gray-300 shadow-sm">
                ↑↓
              </kbd>
              <span>History</span>
            </div>
            {showSuggestions && suggestions.length > 0 && (
              <div className="flex items-center gap-1.5">
                <kbd className="px-1.5 py-0.5 text-xs font-mono bg-[#40414f] border border-gray-600 rounded text-gray-300 shadow-sm">
                  Esc
                </kbd>
                <span>Close</span>
              </div>
            )}
          </div>

          {/* Mobile: Compact shortcuts */}
          <div className="md:hidden flex items-center gap-2 text-gray-500">
            {charCount > 0 && !exceedMax && (
              <span className="text-xs">
                {charCount}/{MAX_CHARS}
              </span>
            )}
            {showSuggestions && suggestions.length > 0 && (
              <button
                type="button"
                onClick={() => setShowSuggestions(false)}
                className="px-2 py-0.5 text-xs bg-[#40414f] border border-gray-600 rounded text-gray-400 hover:text-gray-300 transition-colors"
                aria-label="Close suggestions"
              >
                Esc
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
