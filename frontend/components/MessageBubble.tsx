/**
 * Message bubble component for chat messages
 */

"use client";

import { StreamChunk, createStreamReader } from "@/lib/api";
import { getUserFriendlyError, logError } from "@/lib/errors";
import { Message, useStore } from "@/lib/store";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  RefreshCw,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";

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
  const [showStatusDetails, setShowStatusDetails] = useState(false);
  const abortRef = useRef<(() => void) | null>(null);

  const isStreaming = useStore((state) => state.isStreaming);
  const streamingStatus = useStore((state) => state.streamingStatus);
  const streamingStartTime = useStore((state) => state.streamingStartTime);
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

  const handleRegenerate = () => {
    if (isUser) {
      toast.error("Cannot regenerate user messages");
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

    // Remove this AI response and any messages after it
    const newMessages = messages.slice(0, messageIndex);
    useStore.setState({ messages: newMessages });

    // Set loading states
    setIsRegenerating(true);
    setLoading(true);
    setStreaming(true);

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
            setIsRegenerating(false);
            return;
          }

          if (chunk.tool) {
            toolsUsed.push(chunk.tool);
          }

          // Process content chunks
          if (chunk.chunk !== undefined && chunk.chunk !== null) {
            hasReceivedContent = true;
            updateLastMessage(chunk.chunk);
          }

          if (chunk.done) {
            setStreaming(false);
            setLoading(false);
            setIsRegenerating(false);

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
          setIsRegenerating(false);
        },
        () => {
          setStreaming(false);
          setLoading(false);
          setIsRegenerating(false);
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

  // Update thinking time display
  const [thinkingTime, setThinkingTime] = useState<number | null>(null);
  useEffect(() => {
    if (!isLastMessage || !isStreaming || !streamingStartTime) {
      // Use setTimeout to avoid synchronous setState in effect
      const timeoutId = setTimeout(() => setThinkingTime(null), 0);
      return () => clearTimeout(timeoutId);
    }

    const interval = setInterval(() => {
      const seconds = Math.floor((Date.now() - streamingStartTime) / 1000);
      setThinkingTime(seconds);
    }, 1000);

    return () => clearInterval(interval);
  }, [isLastMessage, isStreaming, streamingStartTime]);

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
        {/* Status indicators for streaming AI messages */}
        {!isUser && isLastMessage && isStreaming && streamingStatus && (
          <div className="mb-2 flex items-center gap-4 text-xs text-[var(--text-secondary)]">
            {/* Thinking/Thought status */}
            {streamingStatus === "thinking" && (
              <button
                onClick={() => setShowStatusDetails(!showStatusDetails)}
                className="flex items-center gap-1 hover:text-[var(--text-primary)] transition-colors"
              >
                {showStatusDetails ? (
                  <ChevronDown className="w-3 h-3" />
                ) : (
                  <ChevronRight className="w-3 h-3" />
                )}
                <span>
                  {thinkingTime !== null
                    ? `Thought for ${thinkingTime}s`
                    : "Thinking"}
                </span>
              </button>
            )}

            {/* Analyzing status */}
            {streamingStatus === "analyzing" && (
              <button
                onClick={() => setShowStatusDetails(!showStatusDetails)}
                className="flex items-center gap-1 hover:text-[var(--text-primary)] transition-colors"
              >
                {showStatusDetails ? (
                  <ChevronDown className="w-3 h-3" />
                ) : (
                  <ChevronRight className="w-3 h-3" />
                )}
                <span>Analyzing</span>
              </button>
            )}

            {/* Answering status */}
            {streamingStatus === "answering" && (
              <span className="text-[var(--text-secondary)]">Answering...</span>
            )}

            {/* Answer now button */}
            {streamingStatus === "thinking" && (
              <button className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] underline decoration-dotted underline-offset-2 transition-colors">
                Answer now
              </button>
            )}

            {/* Progress bar */}
            {streamingStatus && (
              <div className="flex-1 h-0.5 bg-[var(--border)]/50 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[var(--green)] transition-all duration-300"
                  style={{
                    width: streamingStatus === "answering" ? "100%" : "30%",
                    animation:
                      streamingStatus === "thinking" ||
                      streamingStatus === "analyzing"
                        ? "pulse 2s ease-in-out infinite"
                        : "none",
                  }}
                />
              </div>
            )}
          </div>
        )}

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
                    code({ className, children, ...props }: any) {
                      const match = /language-(\w+)/.exec(className || "");
                      const language = match ? match[1] : "";
                      const codeString = String(children).replace(/\n$/, "");
                      const inline = !match; // If no language match, it's inline code

                      return !inline && match ? (
                        <div className="relative my-3 group/codeblock">
                          {/* Code block header with language and copy button */}
                          <div className="flex items-center justify-between px-4 py-2 bg-[var(--code-header-bg)] border-b border-[var(--code-border)] rounded-t-lg">
                            <span className="text-xs font-medium text-[var(--text-secondary)] uppercase">
                              {language}
                            </span>
                            <button
                              onClick={() => handleCopyCode(codeString)}
                              className="flex items-center gap-1.5 px-2 py-1 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] rounded transition-colors"
                              title="Copy code"
                            >
                              {copiedCodeBlock === codeString ? (
                                <>
                                  <Check className="w-3 h-3" />
                                  <span>Copied</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3 h-3" />
                                  <span>Copy code</span>
                                </>
                              )}
                            </button>
                          </div>
                          <SyntaxHighlighter
                            style={vscDarkPlus}
                            language={language}
                            PreTag="div"
                            className="rounded-b-lg text-xs sm:text-sm mt-0"
                            customStyle={{
                              margin: 0,
                              borderRadius: "0 0 0.5rem 0.5rem",
                            }}
                            {...props}
                          >
                            {codeString}
                          </SyntaxHighlighter>
                        </div>
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
            <div
              className="absolute -bottom-1 -left-1 sm:-bottom-1.5 sm:-left-1.5 md:-bottom-2 md:-left-2 flex gap-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-all z-10"
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
                disabled={isRegenerating}
                className={`p-1.5 sm:p-1.5 md:p-2 rounded-lg bg-[var(--surface-elevated)] hover:bg-[var(--surface-hover)] text-[var(--text-primary)] hover:text-[var(--text-inverse)] transition-all shadow-md touch-manipulation ${
                  isRegenerating ? "opacity-50 cursor-not-allowed" : ""
                }`}
                aria-label="Regenerate response"
                type="button"
                title="Regenerate"
              >
                <RefreshCw
                  className={`w-3 h-3 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4 ${
                    isRegenerating ? "animate-spin" : ""
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
