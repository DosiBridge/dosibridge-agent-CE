/**
 * Message bubble component for chat messages
 */

"use client";

import { StreamChunk, createStreamReader } from "@/lib/api";
import { getUserFriendlyError, logError } from "@/lib/errors";
import { Message, useStore } from "@/lib/store";
import {
  Check,
  Copy,
  RefreshCw,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import ReactMarkdown from "react-markdown";
import CodeBlock from "./CodeBlock";

interface MessageBubbleProps {
  message: Message;
  isLast?: boolean;
}

export default function MessageBubble({
  message,
  isLast = false,
}: MessageBubbleProps) {
  const isUser = message.role === "user";
  const [copied, setCopied] = useState(false);
  const [copiedCodeBlock, setCopiedCodeBlock] = useState<string | null>(null);
  const [showActions, setShowActions] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const abortRef = useRef<(() => void) | null>(null);
  
  // Detect current theme for code block styling
  useEffect(() => {
    const checkTheme = () => {
      setIsDarkMode(document.documentElement.classList.contains("dark"));
    };
    
    // Check on mount
    checkTheme();
    
    // Watch for theme changes
    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    
    return () => observer.disconnect();
  }, []);

  const isStreaming = useStore((state) => state.isStreaming);
  const isLastMessage = useStore((state) => {
    const messages = state.messages;
    return (
      messages.length > 0 && messages[messages.length - 1].id === message.id
    );
  });

  const messages = useStore((state) => state.messages);
  const currentSessionId = useStore((state) => state.currentSessionId);
  const mode = useStore((state) => state.mode);
  const selectedCollectionId = useStore((state) => state.selectedCollectionId);
  const useReact = useStore((state) => state.useReact);
  const setLoading = useStore((state) => state.setLoading);
  const setStreaming = useStore((state) => state.setStreaming);
  const addMessage = useStore((state) => state.addMessage);
  const updateLastMessage = useStore((state) => state.updateLastMessage);
  const updateLastMessageTools = useStore(
    (state) => state.updateLastMessageTools
  );

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      toast.success("Message copied!");
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error("Failed to copy message");
    }
  };

  const handleCopyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCodeBlock(code);
      toast.success("Code copied!");
      setTimeout(() => setCopiedCodeBlock(null), 2000);
    } catch (error) {
      toast.error("Failed to copy code");
    }
  };

  const handleRegenerate = async () => {
    if (isUser) {
      toast.error("Cannot regenerate user messages");
      return;
    }

    // Prevent regeneration if already streaming
    if (isStreaming) {
      toast.error("Please wait for the current response to finish");
      return;
    }

    // Prevent regeneration if already regenerating
    if (isRegenerating) {
      return;
    }

    // Find the index of this message
    const messageIndex = messages.findIndex((m) => m.id === message.id);
    if (messageIndex === -1) {
      toast.error("Message not found");
      return;
    }

    // Find the previous user message
    let userMessageIndex = -1;
    for (let i = messageIndex - 1; i >= 0; i--) {
      if (messages[i].role === "user") {
        userMessageIndex = i;
        break;
      }
    }

    if (userMessageIndex === -1) {
      toast.error("No user message found to regenerate");
      return;
    }

    const userMessage = messages[userMessageIndex];

    // Cancel any ongoing request
    if (abortRef.current) {
      abortRef.current();
      abortRef.current = null;
    }

    // Stop any current streaming
    setStreaming(false);
    setLoading(false);

    // Remove this AI response and any messages after it
    const newMessages = messages.slice(0, messageIndex);
    useStore.setState({ messages: newMessages });

    // Small delay to ensure state is updated
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Set loading states
    setIsRegenerating(true);
    setLoading(true);
    setStreaming(true);
    const setStreamingStatus = useStore.getState().setStreamingStatus;
    const clearActiveTools = useStore.getState().clearActiveTools;
    setStreamingStatus("thinking");
    clearActiveTools();

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
          message: userMessage.content,
          session_id: currentSessionId,
          mode,
          collection_id: mode === "rag" ? selectedCollectionId : null,
          use_react: mode === "rag" ? useReact : false,
        },
        (chunk: StreamChunk) => {
          if (chunk.error) {
            toast.error(chunk.error);
            // Remove empty assistant message on error
            const currentMessages = useStore.getState().messages;
            if (
              currentMessages.length > 0 &&
              currentMessages[currentMessages.length - 1].role ===
                "assistant" &&
              !currentMessages[currentMessages.length - 1].content
            ) {
              useStore.setState({ messages: currentMessages.slice(0, -1) });
            }
            setStreaming(false);
            setLoading(false);
            setStreamingStatus(null);
            setIsRegenerating(false);
            clearActiveTools();
            return;
          }

          // Process status updates from backend
          if (chunk.status) {
            if (
              chunk.status === "thinking" ||
              chunk.status === "tool_calling" ||
              chunk.status === "answering" ||
              chunk.status === "connected" ||
              chunk.status === "creating_agent" ||
              chunk.status === "agent_ready"
            ) {
              if (chunk.status === "connected" || chunk.status === "creating_agent" || chunk.status === "agent_ready") {
                setStreamingStatus("thinking");
              } else {
                setStreamingStatus(chunk.status);
              }
            }
          }

          // Process tool calls
          if (chunk.tool) {
            toolsUsed.push(chunk.tool);
            const addActiveTool = useStore.getState().addActiveTool;
            addActiveTool(chunk.tool);
          }

          // Process content chunks
          if (chunk.chunk !== undefined && chunk.chunk !== null) {
            if (!hasReceivedContent) {
              // First chunk received - switch to answering if not already set
              if (chunk.status !== "answering") {
                setStreamingStatus("answering");
              }
            }
            hasReceivedContent = true;
            updateLastMessage(chunk.chunk);
          }

          if (chunk.done) {
            setStreaming(false);
            setLoading(false);
            setStreamingStatus(null);
            setIsRegenerating(false);
            clearActiveTools();

            // Remove empty assistant message if no content was received
            if (!hasReceivedContent) {
              const currentMessages = useStore.getState().messages;
              if (
                currentMessages.length > 0 &&
                currentMessages[currentMessages.length - 1].role ===
                  "assistant" &&
                !currentMessages[currentMessages.length - 1].content
              ) {
                useStore.setState({ messages: currentMessages.slice(0, -1) });
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
          logError(error, { session_id: currentSessionId, mode });
          const errorMessage = getUserFriendlyError(error);
          toast.error(errorMessage);
          // Remove empty assistant message on error
          const currentMessages = useStore.getState().messages;
          if (
            currentMessages.length > 0 &&
            currentMessages[currentMessages.length - 1].role === "assistant" &&
            !currentMessages[currentMessages.length - 1].content
          ) {
            useStore.setState({ messages: currentMessages.slice(0, -1) });
          }
          setStreaming(false);
          setLoading(false);
          setStreamingStatus(null);
          setIsRegenerating(false);
          clearActiveTools();
        },
        () => {
          setStreaming(false);
          setLoading(false);
          setStreamingStatus(null);
          setIsRegenerating(false);
          clearActiveTools();
        }
      );
    } catch (error) {
      logError(error instanceof Error ? error : new Error(String(error)), {
        session_id: currentSessionId,
        mode,
      });
      const errorMessage = getUserFriendlyError(error);
      toast.error(errorMessage);
      // Remove empty assistant message on error
      const currentMessages = useStore.getState().messages;
      if (
        currentMessages.length > 0 &&
        currentMessages[currentMessages.length - 1].role === "assistant" &&
        !currentMessages[currentMessages.length - 1].content
      ) {
        useStore.setState({ messages: currentMessages.slice(0, -1) });
      }
      setStreaming(false);
      setLoading(false);
      setIsRegenerating(false);
    }
  };

  const handleFeedback = (type: "thumbs-up" | "thumbs-down") => {
    // TODO: Send feedback to backend
    toast.success(`Feedback: ${type === "thumbs-up" ? "👍" : "👎"}`);
  };


  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortRef.current) {
        abortRef.current();
        abortRef.current = null;
      }
    };
  }, []);

  return (
    <div
      className={`group flex mb-3 sm:mb-4 md:mb-6 px-1 sm:px-2 transition-all duration-200 hover:bg-transparent ${
        isUser ? "justify-end" : "justify-start"
      }`}
    >
      <div
        className={`flex flex-col ${
          isUser
            ? "max-w-[85%] xs:max-w-[90%] sm:max-w-[85%] md:max-w-[75%] lg:max-w-[70%] items-end"
            : "w-full max-w-full items-start"
        }`}
      >

        <div className="relative w-full">
          <div
            className={`rounded-2xl px-3 py-2 sm:px-3.5 sm:py-2.5 md:px-4 md:py-3 transition-all duration-200 ${
              isUser
                ? "bg-[var(--message-user-bg)]/90 backdrop-blur-sm text-white hover:bg-[var(--message-user-hover)]/90 hover:shadow-md shadow-sm"
                : "bg-transparent text-[var(--message-ai-text)]"
            }`}
          >
            {isUser ? (
              <p className="whitespace-pre-wrap break-words leading-relaxed text-sm sm:text-base">
                {message.content}
              </p>
            ) : (
              <div className="prose prose-sm prose-invert max-w-full prose-pre:bg-[var(--code-bg)] prose-pre:border prose-pre:border-[var(--code-border)] prose-pre:overflow-x-auto prose-p:whitespace-pre-wrap prose-p:break-words prose-code:break-words prose-p:text-[var(--message-ai-text)]">
                <ReactMarkdown
                  components={{
                    p: ({ children }) => (
                      <p className="whitespace-pre-wrap break-words leading-relaxed mb-2 last:mb-0">
                        {children}
                      </p>
                    ),
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    ul: ({ children, ...props }: any) => (
                      <ul className="list-disc list-outside ml-6 mb-2 mt-2 space-y-1 text-[var(--message-ai-text)]" {...props}>
                        {children}
                      </ul>
                    ),
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    ol: ({ children, ...props }: any) => (
                      <ol className="list-decimal list-outside ml-6 mb-2 mt-2 space-y-1 text-[var(--message-ai-text)]" {...props}>
                        {children}
                      </ol>
                    ),
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    li: ({ children, ...props }: any) => (
                      <li className="pl-1 mb-1 leading-relaxed text-[var(--message-ai-text)]" {...props}>
                        {children}
                      </li>
                    ),
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    a: ({ href, children, ...props }: any) => (
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[var(--green)] hover:text-[var(--green)]/80 underline transition-colors"
                        {...props}
                      >
                        {children}
                      </a>
                    ),
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    code({ className, children, ...props }: any) {
                      const match = /language-(\w+)/.exec(className || "");
                      const language = match ? match[1] : "";
                      const codeString = String(children).replace(/\n$/, "");
                      const inline = !match; // If no language match, it's inline code

                      return !inline && match ? (
                        <CodeBlock
                          code={codeString}
                          language={language}
                          isDarkMode={isDarkMode}
                        />
                      ) : (
                        <code 
                          className={className} 
                          style={{
                            backgroundColor: isDarkMode ? "#1e1e1e" : "#f6f8fa",
                            color: isDarkMode ? "#d4d4d4" : "#24292e",
                            border: `1px solid ${isDarkMode ? "#3e3e3e" : "#e1e4e8"}`,
                            padding: "0.125em 0.25em",
                            borderRadius: "0.25rem",
                          }}
                          {...props}
                        >
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
            <div
              className="absolute -bottom-1 -left-1 sm:-bottom-1.5 sm:-left-1.5 md:-bottom-2 md:-left-2 flex gap-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-all z-20"
              onMouseEnter={() => setShowActions(true)}
              onMouseLeave={() => setShowActions(false)}
            >
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleCopy();
                }}
                className="p-1.5 sm:p-1.5 md:p-2 rounded-lg bg-[var(--surface-hover)] hover:bg-[var(--surface-elevated)] text-[var(--text-primary)] hover:text-[var(--text-primary)] transition-all shadow-md touch-manipulation"
                aria-label="Copy message"
                type="button"
                title="Copy"
              >
                {copied ? (
                  <Check className="w-3 h-3 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4" />
                ) : (
                  <Copy className="w-3 h-3 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4" />
                )}
              </button>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleRegenerate();
                }}
                disabled={isRegenerating || isStreaming}
                className={`p-1.5 sm:p-1.5 md:p-2 rounded-lg bg-[var(--surface-elevated)] hover:bg-[var(--surface-hover)] text-[var(--text-primary)] hover:text-[var(--text-inverse)] transition-all shadow-md touch-manipulation ${
                  isRegenerating || isStreaming
                    ? "opacity-50 cursor-not-allowed"
                    : ""
                }`}
                aria-label="Regenerate response"
                type="button"
                title="Regenerate"
              >
                <RefreshCw
                  className={`w-3 h-3 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4 ${
                    isRegenerating || isStreaming ? "animate-spin" : ""
                  }`}
                />
              </button>
              <div className="flex gap-0.5">
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleFeedback("thumbs-up");
                  }}
                  className="p-1.5 sm:p-1.5 md:p-2 rounded-lg bg-[var(--surface-elevated)] hover:bg-[var(--surface-hover)] text-[var(--text-primary)] hover:text-[var(--green)] transition-all shadow-md touch-manipulation"
                  aria-label="Thumbs up"
                  type="button"
                  title="Good response"
                >
                  <ThumbsUp className="w-3 h-3 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4" />
                </button>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleFeedback("thumbs-down");
                  }}
                  className="p-1.5 sm:p-1.5 md:p-2 rounded-lg bg-[var(--surface-elevated)] hover:bg-[var(--surface-hover)] text-[var(--text-primary)] hover:text-[var(--error)] transition-all shadow-md touch-manipulation"
                  aria-label="Thumbs down"
                  type="button"
                  title="Poor response"
                >
                  <ThumbsDown className="w-3 h-3 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        {message.tools_used && message.tools_used.length > 0 && (
          <div className="mt-1 sm:mt-1.5 md:mt-2 flex items-center gap-1 sm:gap-1.5 md:gap-2 flex-wrap">
            <span className="text-xs font-medium text-[var(--text-secondary)]">
              Tools:
            </span>
            {message.tools_used.map((tool, idx) => (
              <span
                key={idx}
                className="text-xs px-1.5 sm:px-2 py-0.5 bg-[var(--surface-elevated)] text-[var(--text-primary)] rounded-full font-medium"
              >
                {tool}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
