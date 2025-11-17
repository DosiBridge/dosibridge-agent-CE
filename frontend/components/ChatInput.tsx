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
  Plus,
  Send,
  Settings,
  Sparkles,
  Square,
} from "lucide-react";
import type { KeyboardEvent } from "react";
import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";

export default function ChatInput() {
  const [input, setInput] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const abortRef = useRef<(() => void) | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const modelDropdownRef = useRef<HTMLDivElement>(null);
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
  const setSettingsOpen = useStore((state) => state.setSettingsOpen);
  const addMessage = useStore((state) => state.addMessage);
  const updateLastMessage = useStore((state) => state.updateLastMessage);
  const updateLastMessageTools = useStore(
    (state) => state.updateLastMessageTools
  );
  const setStreaming = useStore((state) => state.setStreaming);
  const setStreamingStatus = useStore((state) => state.setStreamingStatus);
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

          // New Suggestions
          "Define",
          "Generate",
          "Fix",
          "Debug",
          "Summarize",
          "Translate",
          "Improve",
          "Optimize",
          "List",
          "Guide me through",
          "Teach me",
          "Why does",
          "When should",
          "Where can I",
          "Suggest",
          "Recommend",
          "Build",
          "Design",
          "Plan",
          "Solve",
          "Check",
          "Convert",
          "Explain step by step",
          "Give examples of",
          "Break down",
          "Walk me through",
          "Clarify",
          "Correct",
          "Find",
          "Identify",
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

  // Close model dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        modelDropdownRef.current &&
        !modelDropdownRef.current.contains(e.target as Node)
      ) {
        setShowModelDropdown(false);
      }
    };

    if (showModelDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showModelDropdown]);

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
            if (!hasReceivedContent) {
              // First chunk received - switch from thinking to answering
              setStreamingStatus("answering");
            }
            hasReceivedContent = true;
            updateLastMessage(chunk.chunk);
          }

          // Update status based on tools being used
          if (chunk.tool && !hasReceivedContent) {
            setStreamingStatus("analyzing");
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

  const handleVoiceClick = () => {
    // TODO: Implement voice input
    toast("Voice input coming soon", { icon: "🎤" });
  };

  const handleAttachmentClick = () => {
    // TODO: Implement file attachment
    toast("File attachment coming soon", { icon: "📎" });
  };

  const getModeDisplayName = () => {
    return mode === "agent" ? "Agent" : "RAG";
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
    <div className=" shrink-0 sticky bottom-0 z-40">
      <div className="px-2 sm:px-3 md:px-4 lg:px-6 py-3 sm:py-4">
        <div className="max-w-4xl mx-auto w-full flex flex-col">
          {/* Chat input form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="w-full relative"
          >
            {/* Suggestions dropdown */}
            {showSuggestions && suggestions.length > 0 && (
              <div
                ref={suggestionsRef}
                className="absolute bottom-full left-0 right-0 mb-2 bg-[var(--surface)]/95 backdrop-blur-lg border border-[var(--border)] rounded-lg shadow-xl overflow-hidden z-50"
              >
                {suggestions.map((suggestion, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => handleSuggestionClick(suggestion)}
                    className="w-full text-left px-4 py-2.5 text-sm text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors flex items-center gap-2"
                  >
                    <Sparkles className="w-4 h-4 text-[var(--green)] shrink-0" />
                    <span className="flex-1">{suggestion}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Input container with all buttons inside */}
            <div className="w-full relative">
              {/* Input field */}
              <div className="relative w-full">
                <div className="relative w-full bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl shadow-sm hover:border-[var(--border-hover)] focus-within:border-[var(--green)] focus-within:ring-1 focus-within:ring-[var(--green)]/30 transition-all">
                  {/* Plus button - Left side */}
                  <button
                    type="button"
                    onClick={handleAttachmentClick}
                    disabled={inputDisabled}
                    className="absolute left-2 bottom-2 h-8 w-8 rounded-full bg-transparent hover:bg-[var(--surface-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                    aria-label="Attach file"
                    title="Attach file"
                  >
                    <Plus className="w-5 h-5" />
                  </button>

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
                    placeholder="Ask anything"
                    disabled={inputDisabled}
                    rows={1}
                    className="w-full px-12 py-3 pr-24 resize-none focus:outline-none bg-transparent text-[var(--text-primary)] placeholder-[var(--text-tertiary)] disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm sm:text-base leading-relaxed"
                    style={{
                      minHeight: "52px",
                      maxHeight: "200px",
                      boxSizing: "border-box",
                    }}
                    aria-label="Message input"
                  />

                  {/* Buttons on right side - Inside input area */}
                  <div className="absolute bottom-2 right-2 flex items-center gap-2">
                    {/* Character counter - Before buttons */}
                    {charCount > 0 && (
                      <div className="text-xs text-[var(--text-secondary)] pointer-events-none mr-1">
                        <span
                          className={
                            exceedMax
                              ? "text-red-500 font-medium"
                              : charCount > MAX_CHARS * 0.9
                              ? "text-yellow-500"
                              : ""
                          }
                        >
                          {charCount}/{MAX_CHARS}
                        </span>
                      </div>
                    )}
                    {/* Model selector - Small icon button */}
                    <div className="relative" ref={modelDropdownRef}>
                      <button
                        type="button"
                        onClick={() => setShowModelDropdown(!showModelDropdown)}
                        disabled={inputDisabled}
                        className="h-8 w-8 rounded-full bg-transparent hover:bg-[var(--surface-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                        aria-label="Select mode"
                        title={`Mode: ${getModeDisplayName()}`}
                      >
                        <Settings className="w-4 h-4" />
                      </button>

                      {/* Model dropdown menu */}
                      {showModelDropdown && (
                        <div className="absolute bottom-full right-0 mb-2 bg-[var(--surface)]/95 backdrop-blur-lg border border-[var(--border)] rounded-lg shadow-xl overflow-hidden z-50 min-w-[120px]">
                          <button
                            type="button"
                            onClick={() => {
                              setMode("agent");
                              setShowModelDropdown(false);
                            }}
                            className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                              mode === "agent"
                                ? "bg-[var(--green)]/10 text-[var(--green)] font-medium"
                                : "text-[var(--text-primary)] hover:bg-[var(--surface-hover)]"
                            }`}
                          >
                            Agent
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (!isAuthenticated) {
                                toast.error(
                                  "Please log in to use RAG mode. RAG mode requires authentication to upload and query documents."
                                );
                                setShowModelDropdown(false);
                                return;
                              }
                              setMode("rag");
                              setShowModelDropdown(false);
                            }}
                            disabled={!isAuthenticated}
                            className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                              mode === "rag"
                                ? "bg-[var(--green)]/10 text-[var(--green)] font-medium"
                                : "text-[var(--text-primary)] hover:bg-[var(--surface-hover)]"
                            } disabled:opacity-50 disabled:cursor-not-allowed`}
                          >
                            RAG
                          </button>
                          {mode === "rag" && (
                            <button
                              type="button"
                              onClick={() => {
                                setRagSettingsOpen(true);
                                setSettingsOpen(true);
                                setShowModelDropdown(false);
                              }}
                              className="w-full text-left px-4 py-2.5 text-sm text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors border-t border-[var(--border)] flex items-center gap-2"
                            >
                              <Settings className="w-3.5 h-3.5" />
                              <span>RAG Settings</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Microphone button */}
                    <button
                      type="button"
                      onClick={handleVoiceClick}
                      disabled={inputDisabled}
                      className="h-8 w-8 rounded-full bg-transparent hover:bg-[var(--surface-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                      aria-label="Voice input"
                      title="Voice input"
                    >
                      <Mic className="w-4 h-4" />
                    </button>

                    {/* Send/Stop button */}
                    {isStreaming ? (
                      <button
                        type="button"
                        onClick={handleStop}
                        className="h-8 w-8 rounded-full bg-red-500 hover:bg-red-600 text-white transition-all shadow-md hover:shadow-lg flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-[#40414f]"
                        aria-label="Stop generation"
                        title="Stop"
                      >
                        <Square className="w-4 h-4 fill-white" />
                      </button>
                    ) : (
                      <button
                        type="submit"
                        disabled={sendDisabled}
                        className="h-8 w-8 rounded-full bg-gray-600 dark:bg-gray-500 hover:bg-gray-700 dark:hover:bg-gray-600 disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed text-white transition-all shadow-md hover:shadow-lg disabled:shadow-none flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-[#40414f]"
                        aria-label="Send message"
                        title="Send (Enter)"
                      >
                        {isLoading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Send className="w-4 h-4" />
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Disclaimer */}
            <div className="mt-2 text-center">
              <p className="text-xs text-[var(--text-secondary)]">
                DosiBridge can make mistakes. Check important info.
              </p>
            </div>

            {/* Error message for exceeded limit */}
            {exceedMax && (
              <div className="mt-2 text-xs text-red-500 flex items-center gap-1.5">
                <span>⚠️</span>
                <span>Message exceeds {MAX_CHARS} characters</span>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
