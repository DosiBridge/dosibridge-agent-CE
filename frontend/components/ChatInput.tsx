/**
 * Chat input component with send button and mode toggle
 * Uses Aceternity UI PlaceholdersAndVanishInput
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
  Plus,
  Settings,
  Sparkles,
  Square,
  Paperclip,
} from "lucide-react";
import type { KeyboardEvent } from "react";
import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import RAGEnablePopup from "@/components/RAGEnablePopup";
import { PlaceholdersAndVanishInput } from "./ui/placeholders-and-vanish-input";
import { cn } from "@/lib/utils";

export default function ChatInput() {
  const [input, setInput] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [showRAGPopup, setShowRAGPopup] = useState(false);
  const abortRef = useRef<(() => void) | null>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const modelDropdownRef = useRef<HTMLDivElement>(null);
  const prevAuthRef = useRef<boolean | null>(null);

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

  // Placeholder prompts for the Vanish Input
  const placeholders = [
    "Ask anything...",
    "What is the capital of France?",
    "Explain quantum computing",
    "Write a Python script to parse CSV",
    "Help me debug this code",
    "Generate a creative story",
    "Summarize this article",
  ];

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

    // Note: setInput("") is handled by VanishInput component visually upon submit, 
    // but we need to ensure our state reflects it if we are controlling it. 
    // The VanishInput animation clears its internal value, and if we pass `value` prop, 
    // we should also clear it.
    setInput("");

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
    setInput(suggestion); // Will update VanishInput value via prop
    setShowSuggestions(false);
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

  const handleAttachmentClick = () => {
    toast("File attachment coming soon", { icon: "📎" });
  };

  const getModeDisplayName = () => {
    return mode === "agent" ? "Agent" : "RAG";
  };

  return (
    <div className="shrink-0 sticky bottom-0 z-40 w-full bg-gradient-to-t from-black via-black/80 to-transparent pb-6 pt-4">
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

        {/* Input Component */}
        <div className="relative z-10">
          <PlaceholdersAndVanishInput
            placeholders={placeholders}
            onChange={(e) => {
              setInput(e.target.value);
              saveCurrentInput(e.target.value); // Sync to history
            }}
            onSubmit={(e) => {
              handleSend();
            }}
            value={input}
            setValue={setInput}
          />
        </div>

        {/* Toolbar */}
        <div className="flex justify-center items-center gap-4 mt-2">
          {/* Attachment */}
          <button
            onClick={handleAttachmentClick}
            disabled={inputDisabled}
            className="p-2 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-full transition-colors disabled:opacity-50"
            title="Attach File"
          >
            <Paperclip className="w-5 h-5" />
          </button>

          {/* Voice */}
          <button
            onClick={handleVoiceClick}
            disabled={inputDisabled}
            className="p-2 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-full transition-colors disabled:opacity-50"
            title="Voice Input"
          >
            <Mic className="w-5 h-5" />
          </button>

          {/* Mode Selector */}
          <div className="relative" ref={modelDropdownRef}>
            <button
              onClick={() => setShowModelDropdown(!showModelDropdown)}
              disabled={inputDisabled}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-colors border border-zinc-800",
                mode === 'rag' ? "bg-indigo-500/10 text-indigo-400 border-indigo-500/20" : "bg-zinc-900 text-zinc-400 hover:text-white hover:bg-zinc-800"
              )}
            >
              <Settings className="w-3.5 h-3.5" />
              <span>{getModeDisplayName()}</span>
            </button>

            {showModelDropdown && (
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl overflow-hidden min-w-[120px]">
                <button
                  onClick={() => { setMode('agent'); setShowModelDropdown(false); }}
                  className="w-full text-left px-4 py-2 text-xs text-zinc-300 hover:bg-zinc-800 hover:text-white"
                >
                  Agent Mode
                </button>
                <button
                  onClick={() => { setMode('rag'); setShowModelDropdown(false); }}
                  className="w-full text-left px-4 py-2 text-xs text-zinc-300 hover:bg-zinc-800 hover:text-white"
                >
                  RAG Mode
                </button>
                {mode === 'rag' && (
                  <button
                    onClick={() => { setRagSettingsOpen(true); setSettingsOpen(true); setShowModelDropdown(false); }}
                    className="w-full text-left px-4 py-2 text-xs text-indigo-400 hover:bg-zinc-800 border-t border-zinc-800"
                  >
                    Settings
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Stop Button (only if streaming) */}
          {isStreaming && (
            <button
              onClick={handleStop}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors"
            >
              <Square className="w-3.5 h-3.5 fill-red-400" />
              Stop
            </button>
          )}

          {/* Char Count */}
          <div className={cn("text-xs", exceedMax ? "text-red-500" : "text-zinc-600")}>
            {charCount}/{MAX_CHARS}
          </div>
        </div>
      </div>

      <RAGEnablePopup
        isOpen={showRAGPopup}
        onClose={() => setShowRAGPopup(false)}
        onEnable={() => { }}
      />
    </div>
  );
}
