/**
 * Chat input component with send button and mode toggle
 * Refactored to "Thick Box" style (Shadcn AI look)
 */

"use client";

import { useDebounce } from "@/hooks/useDebounce";
import { useInputHistory } from "@/hooks/useInputHistory";
import { createStreamReader, StreamChunk } from "@/lib/api";
import { getUserFriendlyError, logError } from "@/lib/errors";
import { useStore } from "@/lib/store";
import { getTodayUsage } from "@/lib/api/monitoring";
import {
  Loader2,
  Mic,
  Settings,
  Sparkles,
  Square,
  Paperclip,
  ArrowUp,
} from "lucide-react";
import type { KeyboardEvent, ChangeEvent } from "react";
import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import RAGEnablePopup from "@/components/RAGEnablePopup";
import GuestEmailDialog from "@/components/chat/GuestEmailDialog";

import { cn } from "@/lib/utils";

export default function ChatInput() {
  const [input, setInput] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [showRAGPopup, setShowRAGPopup] = useState(false);
  const [showGuestEmailDialog, setShowGuestEmailDialog] = useState(false);

  const abortRef = useRef<(() => void) | null>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const modelDropdownRef = useRef<HTMLDivElement>(null);
  const prevAuthRef = useRef<boolean | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
  const addActiveTool = useStore((state) => state.addActiveTool);
  const clearActiveTools = useStore((state) => state.clearActiveTools);
  const setLoading = useStore((state) => state.setLoading);

  // Auto-resize textarea
  const adjustTextareaHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  };

  useEffect(() => {
    adjustTextareaHeight();
  }, [input]);

  // Cancel ongoing requests only when user explicitly logs out
  useEffect(() => {
    if (prevAuthRef.current === null) {
      prevAuthRef.current = isAuthenticated;
      return;
    }

    if (prevAuthRef.current && !isAuthenticated && (isStreaming || isLoading)) {
      if (abortRef.current) {
        abortRef.current();
        abortRef.current = null;
      }
      setStreaming(false);
      setLoading(false);
    }

    prevAuthRef.current = isAuthenticated;
  }, [isAuthenticated, isStreaming, isLoading, setStreaming, setLoading]);

  const inputDisabled = isLoading || isStreaming;
  const MAX_CHARS = 2000;
  const charCount = input.length;
  const exceedMax = charCount > MAX_CHARS;
  const sendDisabled = inputDisabled || !input.trim() || exceedMax;

  // Generate autocomplete suggestions based on input
  useEffect(() => {
    let mounted = true;

    const updateSuggestions = () => {
      if (!mounted) return;

      if (
        debouncedInput.trim().length > 0 &&
        debouncedInput.trim().length < 20
      ) {
        const commonQueries = [
          "What is", "How to", "Explain", "Tell me about", "Help me with",
          "Show me", "Create", "Write", "Analyze", "Compare",
          "Define", "Generate", "Fix", "Debug", "Summarize",
          "Translate", "Improve", "Optimize", "List", "Suggest",
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
        !suggestionsRef.current.contains(e.target as Node)
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

  useEffect(() => {
    return () => {
      if (abortRef.current) {
        abortRef.current();
      }
    };
  }, []);

  const handleSend = async () => {
    if (sendDisabled) return;

    if (mode === "rag" && !isAuthenticated) {
      toast.error("Please log in to use RAG mode.");
      return;
    }

    // Check for guest email if not authenticated
    let guestEmail = null;
    if (!isAuthenticated) {
      const storedGuestEmail = localStorage.getItem("guest_email");
      if (!storedGuestEmail) {
        setShowGuestEmailDialog(true);
        return;
      }
      guestEmail = storedGuestEmail;
    }

    try {
      const todayUsage = await getTodayUsage();
      if (todayUsage.is_default_llm && todayUsage.limit !== -1) {
        if (!todayUsage.is_allowed) {
          toast.error("Daily limit reached! Add your own API key for unlimited requests.", { duration: 6000 });
          return;
        }
        if (todayUsage.remaining <= 10 && todayUsage.remaining > 0) {
          toast(`Warning: Only ${todayUsage.remaining} requests remaining today.`, { duration: 4000, icon: "⚠️" });
        }
      }
    } catch (error) {
      console.warn("Failed to check daily limit:", error);
    }

    const message = input.trim();
    if (!message) return;

    addToHistory(message);
    setShowSuggestions(false);
    setInput("");

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    setLoading(true);
    setStreaming(true);
    setStreamingStatus("thinking");
    clearActiveTools();

    addMessage({ role: "user", content: message });
    addMessage({ role: "assistant", content: "" });

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
          guest_email: guestEmail || undefined,
        },
        (chunk: StreamChunk) => {
          if (chunk.error) {
            toast.error(chunk.error);
            const messages = useStore.getState().messages;
            if (messages.length > 0 && messages[messages.length - 1].role === "assistant" && !messages[messages.length - 1].content) {
              useStore.setState({ messages: messages.slice(0, -1) });
            }
            setStreaming(false);
            setLoading(false);
            setStreamingStatus(null);
            clearActiveTools();
            return;
          }

          if (chunk.status) {
            if (chunk.status === "connected" || chunk.status === "creating_agent" || chunk.status === "agent_ready") {
              setStreamingStatus("thinking");
            } else {
              setStreamingStatus(chunk.status as any);
            }
          }

          if (chunk.tool) {
            toolsUsed.push(chunk.tool);
            addActiveTool(chunk.tool);
          }

          if (chunk.chunk !== undefined && chunk.chunk !== null) {
            if (!hasReceivedContent) {
              if (chunk.status !== "answering") setStreamingStatus("answering");
            }
            hasReceivedContent = true;
            updateLastMessage(chunk.chunk);
          }

          if (chunk.done) {
            setStreaming(false);
            setLoading(false);
            setStreamingStatus(null);
            clearActiveTools();
            if (!hasReceivedContent) {
              const messages = useStore.getState().messages;
              if (messages.length > 0 && messages[messages.length - 1].role === "assistant" && !messages[messages.length - 1].content) {
                useStore.setState({ messages: messages.slice(0, -1) });
              }
            }
            if (chunk.tools_used && chunk.tools_used.length > 0) {
              updateLastMessageTools(chunk.tools_used);
            } else if (toolsUsed.length > 0) {
              updateLastMessageTools([...toolsUsed]);
            }
          }
        },
        (error: Error) => {
          logError(error, { session_id: currentSessionId, mode });
          toast.error(getUserFriendlyError(error));
          const messages = useStore.getState().messages;
          if (messages.length > 0 && messages[messages.length - 1].role === "assistant" && !messages[messages.length - 1].content) {
            useStore.setState({ messages: messages.slice(0, -1) });
          }
          setStreaming(false);
          setLoading(false);
          setStreamingStatus(null);
          clearActiveTools();
        },
        () => {
          setStreaming(false);
          setLoading(false);
          setStreamingStatus(null);
          clearActiveTools();
        }
      );
    } catch (error) {
      logError(error instanceof Error ? error : new Error(String(error)), { session_id: currentSessionId, mode });
      toast.error(getUserFriendlyError(error));
      setStreaming(false);
      setLoading(false);
      setStreamingStatus(null);
      clearActiveTools();
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setInput(suggestion);
    setShowSuggestions(false);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  const handleStop = () => {
    if (abortRef.current) {
      abortRef.current();
      abortRef.current = null;
      setStreaming(false);
      setLoading(false);
      setStreamingStatus(null);
      clearActiveTools();
      toast.success("Generation stopped");
    }
  };

  const handleVoiceClick = () => {
    toast("Voice input coming soon", { icon: "🎤" });
  };

  const handleGuestEmailSubmit = (email: string) => {
    localStorage.setItem("guest_email", email);
    handleSend();
  };

  const getModeDisplayName = () => {
    return mode === "agent" ? "Agent" : "RAG";
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
      return;
    }

    // History navigation logic
    if (e.key === "ArrowUp" && input.trim() === "" && textareaRef.current?.selectionStart === 0) {
      e.preventDefault();
      const prev = navigateHistory("up");
      if (prev !== null) setInput(prev);
    } else if (e.key === "ArrowDown" && input.trim() === "") {
      e.preventDefault();
      const next = navigateHistory("down");
      if (next !== null) setInput(next);
    }
  };

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    saveCurrentInput(e.target.value);
  };

  return (
    <div className="shrink-0 sticky bottom-0 z-40 w-full pb-6 pt-4">
      <div className="max-w-4xl mx-auto w-full px-2 sm:px-4 flex flex-col gap-2">

        {/* Autocomplete Suggestions */}
        {showSuggestions && suggestions.length > 0 && (
          <div
            ref={suggestionsRef}
            className="mb-2 mx-4 bg-zinc-900/95 backdrop-blur-lg border border-zinc-800 rounded-xl shadow-xl overflow-hidden z-50 max-w-xl self-center w-full"
          >
            {suggestions.map((suggestion, index) => (
              <button
                key={index}
                type="button"
                onClick={() => handleSuggestionClick(suggestion)}
                className="w-full text-left px-4 py-2.5 text-sm text-zinc-200 hover:bg-zinc-800 transition-colors flex items-center gap-2"
              >
                <Sparkles className="w-4 h-4 text-indigo-400 shrink-0" />
                <span className="flex-1">{suggestion}</span>
              </button>
            ))}
          </div>
        )}

        {/* Input Component - "Thick Box" Style */}
        <div className={cn(
          "relative z-10 flex flex-col bg-zinc-900 border border-zinc-800 rounded-2xl shadow-xl transition-all duration-200",
          "focus-within:ring-1 focus-within:ring-zinc-700/50 focus-within:border-zinc-700",
          isLoading && "opacity-50 cursor-not-allowed"
        )}>

          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            disabled={inputDisabled}
            placeholder="How can I help you today?"
            className="w-full bg-transparent border-none text-zinc-100 placeholder:text-zinc-500 text-base py-3 px-4 min-h-[60px] max-h-[200px] resize-none focus:ring-0 focus:outline-none scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent rounded-t-2xl"
            rows={1}
          />

          {/* Toolbar */}
          <div className="flex justify-between items-center p-2 pt-0">
            {/* Left Tools */}
            <div className="flex items-center gap-1.5">
              {/* Voice */}
              <button
                onClick={handleVoiceClick}
                disabled={inputDisabled}
                className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors disabled:opacity-50"
                title="Voice Input"
              >
                <Mic className="w-4 h-4" />
              </button>

              {/* Mode Selector */}
              <div className="relative" ref={modelDropdownRef}>
                <button
                  onClick={() => setShowModelDropdown(!showModelDropdown)}
                  disabled={inputDisabled}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors hover:bg-zinc-800",
                    mode === 'rag' ? "text-indigo-400" : "text-zinc-400"
                  )}
                >
                  <Settings className="w-4 h-4" />
                  <span>{getModeDisplayName()}</span>
                </button>

                {showModelDropdown && (
                  <div className="absolute bottom-full left-0 mb-2 bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl overflow-hidden min-w-[140px] z-50">
                    <button
                      onClick={() => { setMode('agent'); setShowModelDropdown(false); }}
                      className="w-full text-left px-4 py-2.5 text-xs text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
                    >
                      Agent Mode
                    </button>
                    <button
                      onClick={() => { setMode('rag'); setShowModelDropdown(false); }}
                      className="w-full text-left px-4 py-2.5 text-xs text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
                    >
                      RAG Mode
                    </button>
                    {mode === 'rag' && (
                      <button
                        onClick={() => { setRagSettingsOpen(true); setSettingsOpen(true); setShowModelDropdown(false); }}
                        className="w-full text-left px-4 py-2.5 text-xs text-indigo-400 hover:bg-zinc-800 border-t border-zinc-800 transition-colors"
                      >
                        Settings
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Right Tools - Send Button */}
            <div className="flex items-center gap-2">
              {/* Char Count */}
              <div className={cn("text-[10px]", exceedMax ? "text-red-500" : "text-zinc-600")}>
                {charCount}/{MAX_CHARS}
              </div>

              {isStreaming ? (
                <button
                  onClick={handleStop}
                  className="p-2 rounded-full bg-zinc-100 hover:bg-zinc-300 transition-colors group"
                  title="Stop generation"
                >
                  <Square className="w-4 h-4 text-black fill-black" />
                </button>
              ) : (
                <button
                  onClick={handleSend}
                  disabled={sendDisabled}
                  className={cn(
                    "p-2 rounded-full transition-all duration-200",
                    sendDisabled
                      ? "bg-zinc-800 text-zinc-600 cursor-not-allowed"
                      : "bg-white text-black hover:bg-zinc-200 shadow-md hover:shadow-lg"
                  )}
                  title="Send message"
                >
                  <ArrowUp className="w-5 h-5" strokeWidth={2.5} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <RAGEnablePopup
        isOpen={showRAGPopup}
        onClose={() => setShowRAGPopup(false)}
        onEnable={() => { }}
      />

      <GuestEmailDialog
        isOpen={showGuestEmailDialog}
        onClose={() => setShowGuestEmailDialog(false)}
        onSubmit={handleGuestEmailSubmit}
      />

    </div>
  );
}
