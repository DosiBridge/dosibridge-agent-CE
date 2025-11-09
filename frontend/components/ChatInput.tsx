/**
 * Chat input component with send button and mode toggle
 * Uses AI SDK UI patterns for enhanced chat experience
 */

"use client";

import { createStreamReader, StreamChunk } from "@/lib/api";
import { useStore } from "@/lib/store";
import { Loader2, Send, Square, X } from "lucide-react";
import type { KeyboardEvent } from "react";
import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";

export default function ChatInput() {
  const [input, setInput] = useState("");
  const abortRef = useRef<(() => void) | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const currentSessionId = useStore((state) => state.currentSessionId);
  const mode = useStore((state) => state.mode);
  const isStreaming = useStore((state) => state.isStreaming);
  const isLoading = useStore((state) => state.isLoading);
  const setMode = useStore((state) => state.setMode);
  const addMessage = useStore((state) => state.addMessage);
  const updateLastMessage = useStore((state) => state.updateLastMessage);
  const updateLastMessageTools = useStore(
    (state) => state.updateLastMessageTools
  );
  const setStreaming = useStore((state) => state.setStreaming);
  const setLoading = useStore((state) => state.setLoading);

  // textarea should be disabled only while loading/streaming
  const inputDisabled = isLoading || isStreaming;
  // send button should be disabled while loading/streaming or when there's no input
  const MAX_CHARS = 2000;
  const charCount = input.length;
  const exceedMax = charCount > MAX_CHARS;
  const sendDisabled = inputDisabled || !input.trim() || exceedMax;

  // Auto-resize textarea with min/max bounds and overflow handling
  useEffect(() => {
    const ta = textareaRef.current;
    if (ta) {
      const MIN_HEIGHT = 56; // px - AI SDK style
      const MAX_HEIGHT = 200; // px

      ta.style.boxSizing = "border-box";
      ta.style.height = "0px";
      const scroll = ta.scrollHeight;
      const newHeight = Math.min(Math.max(scroll, MIN_HEIGHT), MAX_HEIGHT);
      ta.style.height = `${newHeight}px`;
      ta.style.overflowY = scroll > MAX_HEIGHT ? "auto" : "hidden";
    }
  }, [input]);

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

    const message = input.trim();
    if (!message) return;

    setInput("");
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
            return;
          }

          if (chunk.tool) {
            toolsUsed.push(chunk.tool);
          }

          if (chunk.chunk) {
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
          }
        },
        (error: Error) => {
          toast.error(`Error: ${error.message}`);
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
        },
        () => {
          setStreaming(false);
          setLoading(false);
        }
      );
    } catch (error) {
      toast.error(
        `Failed to send message: ${error instanceof Error ? error.message : "Unknown error"
        }`
      );
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
    }
  };

  const handleClear = () => {
    setInput("");
    setTimeout(() => textareaRef.current?.focus(), 0);
  };

  const handleStop = () => {
    if (abortRef.current) {
      abortRef.current();
      abortRef.current = null;
      setStreaming(false);
      setLoading(false);
      toast.success('Generation stopped');
    }
  };

  const handleKeyPress = (e: KeyboardEvent<HTMLTextAreaElement>) => {
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
  };

  return (
    <div className="border-t border-gray-700 bg-[#343541] dark:bg-[#2d2d2f] shrink-0">
      <div className="max-w-4xl mx-auto px-3 sm:px-4 md:px-6 py-3 sm:py-4">
        {/* Mode selector */}
        <div className="flex justify-center mb-2 sm:mb-3">
          <div className="inline-flex items-center rounded-lg border border-gray-600 bg-[#40414f] p-0.5 sm:p-1">
            <button
              onClick={() => setMode("agent")}
              disabled={inputDisabled}
              className={`px-3 py-1.5 sm:px-4 text-xs sm:text-sm font-medium rounded-md transition-all duration-200 ${mode === "agent"
                ? "bg-[#10a37f] text-white shadow-sm"
                : "text-gray-400 hover:text-gray-200"
                } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              Agent
            </button>
            <button
              onClick={() => setMode("rag")}
              disabled={inputDisabled}
              className={`px-3 py-1.5 sm:px-4 text-xs sm:text-sm font-medium rounded-md transition-all duration-200 ${mode === "rag"
                ? "bg-[#10a37f] text-white shadow-sm"
                : "text-gray-400 hover:text-gray-200"
                } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              RAG
            </button>
          </div>
        </div>

        {/* Chat input */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex gap-2 sm:gap-3"
        >
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Message DOSI-AI-agent..."
              disabled={inputDisabled}
              rows={1}
              className="w-full px-3 py-2.5 sm:px-4 sm:py-3.5 pr-10 sm:pr-12 border border-gray-600 rounded-2xl resize-none focus:outline-none focus:ring-2 focus:ring-[#10a37f] focus:border-[#10a37f] bg-[#40414f] text-gray-100 placeholder-gray-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm sm:text-base"
              style={{
                minHeight: "48px",
                maxHeight: "200px",
                boxSizing: "border-box",
              }}
              aria-label="Message input"
            />

            {/* Clear button */}
            {input && !inputDisabled && (
              <button
                type="button"
                onClick={handleClear}
                className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-[#2d2d2f] transition-colors"
                aria-label="Clear message"
                title="Clear"
              >
                <X className="w-4 h-4" />
              </button>
            )}

            {/* Character counter */}
            {charCount > 0 && (
              <div className="absolute -bottom-5 right-0 text-xs">
                <span
                  className={
                    exceedMax
                      ? "text-red-500 font-medium"
                      : "text-gray-400 dark:text-gray-500"
                  }
                >
                  {charCount}
                </span>
                <span className="text-gray-300 dark:text-gray-600">
                  /{MAX_CHARS}
                </span>
              </div>
            )}
          </div>

          {/* Stop / Send button */}
          {isStreaming ? (
            <button
              type="button"
              onClick={handleStop}
              className="shrink-0 h-12 w-12 sm:h-14 sm:w-14 rounded-2xl bg-red-500 hover:bg-red-600 active:bg-red-700 text-white transition-all shadow-md hover:scale-105 active:scale-95 flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
              aria-label="Stop generation"
              title="Stop generation"
            >
              <Square className="w-4 h-4 sm:w-5 sm:h-5 fill-white" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={sendDisabled}
              className="shrink-0 h-12 w-12 sm:h-14 sm:w-14 rounded-2xl bg-[#10a37f] hover:bg-[#0d8f6e] active:bg-[#0b7d5f] disabled:bg-gray-600 disabled:cursor-not-allowed text-white transition-all shadow-md hover:scale-105 active:scale-95 disabled:scale-100 disabled:shadow-none flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-[#10a37f] focus:ring-offset-2"
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
                <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
              ) : (
                <Send className="w-4 h-4 sm:w-5 sm:h-5" />
              )}
            </button>
          )}
        </form>

        {/* Keyboard shortcuts hint */}
        <div className="mt-2 text-center text-xs text-gray-500">
          <span className="hidden sm:inline">
            Press{" "}
            <kbd className="px-1.5 py-0.5 text-xs font-mono bg-[#40414f] border border-gray-600 rounded text-gray-300">
              Enter
            </kbd>{" "}
            to send,{" "}
            <kbd className="px-1.5 py-0.5 text-xs font-mono bg-[#40414f] border border-gray-600 rounded text-gray-300">
              Shift+Enter
            </kbd>{" "}
            for new line
          </span>
        </div>
      </div>
    </div>
  );
}
