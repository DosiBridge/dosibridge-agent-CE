/**
 * Message bubble component for chat messages
 */

"use client";

import { Message } from "@/lib/store";
import {
  Bot,
  Check,
  Copy,
  RefreshCw,
  ThumbsDown,
  ThumbsUp,
  User,
} from "lucide-react";
import { useState } from "react";
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
  const [showActions, setShowActions] = useState(false);

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

  const handleRegenerate = () => {
    // TODO: Implement regenerate functionality
    toast.success("Regenerate feature coming soon");
  };

  const handleFeedback = (type: "thumbs-up" | "thumbs-down") => {
    // TODO: Send feedback to backend
    toast.success(`Feedback: ${type === "thumbs-up" ? "👍" : "👎"}`);
  };

  return (
    <div
      className={`group flex gap-2 sm:gap-3 md:gap-4 mb-3 sm:mb-4 md:mb-6 px-1 sm:px-2 transition-all duration-200 hover:bg-transparent ${
        isUser ? "justify-end" : "justify-start"
      }`}
    >
      {!isUser && (
        <div className="flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 md:w-9 md:h-9 rounded-full bg-gradient-to-br from-[#10a37f] to-[#0d8f6e] flex items-center justify-center shadow-md ring-2 ring-[#10a37f]/20">
          <Bot className="w-3.5 h-3.5 sm:w-4 sm:h-4 md:w-5 md:h-5 text-white" />
        </div>
      )}

      <div
        className={`flex flex-col max-w-[85%] xs:max-w-[90%] sm:max-w-[85%] md:max-w-[75%] lg:max-w-[70%] ${
          isUser ? "items-end" : "items-start"
        }`}
      >
        <div className="relative w-full">
          <div
            className={`rounded-2xl px-3 py-2 sm:px-3.5 sm:py-2.5 md:px-4 md:py-3 shadow-sm transition-all duration-200 ${
              isUser
                ? "bg-[#10a37f] text-white hover:bg-[#0d8f6e] hover:shadow-md"
                : "bg-[#343541] dark:bg-[#2d2d2f] text-gray-100 hover:bg-[#40414f] hover:shadow-md"
            }`}
          >
            {isUser ? (
              <p className="whitespace-pre-wrap break-words leading-relaxed text-sm sm:text-base">
                {message.content}
              </p>
            ) : (
              <div className="prose prose-sm dark:prose-invert max-w-none prose-pre:bg-[#1e1e1e] prose-pre:border prose-pre:border-gray-700 prose-pre:overflow-x-auto prose-p:whitespace-pre-wrap prose-p:break-words">
                <ReactMarkdown
                  components={{
                    p: ({ children }) => (
                      <p className="whitespace-pre-wrap break-words leading-relaxed mb-2 last:mb-0">
                        {children}
                      </p>
                    ),
                    code({ className, children, ...props }: any) {
                      const match = /language-(\w+)/.exec(className || "");
                      const language = match ? match[1] : "";
                      const codeString = String(children).replace(/\n$/, "");
                      const inline = !match; // If no language match, it's inline code

                      return !inline && match ? (
                        <SyntaxHighlighter
                          style={vscDarkPlus}
                          language={language}
                          PreTag="div"
                          className="rounded-lg !my-2 text-xs sm:text-sm"
                          {...props}
                        >
                          {codeString}
                        </SyntaxHighlighter>
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
              className="absolute -top-1 -right-1 sm:-top-1.5 sm:-right-1.5 md:-top-2 md:-right-2 flex gap-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-all z-10"
              onMouseEnter={() => setShowActions(true)}
              onMouseLeave={() => setShowActions(false)}
            >
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleCopy();
                }}
                className="p-1.5 sm:p-1.5 md:p-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white transition-all shadow-md touch-manipulation"
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
                className="p-1.5 sm:p-1.5 md:p-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white transition-all shadow-md touch-manipulation"
                aria-label="Regenerate response"
                type="button"
                title="Regenerate"
              >
                <RefreshCw className="w-3 h-3 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4" />
              </button>
              <div className="flex gap-0.5">
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleFeedback("thumbs-up");
                  }}
                  className="p-1.5 sm:p-1.5 md:p-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-green-400 transition-all shadow-md touch-manipulation"
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
                  className="p-1.5 sm:p-1.5 md:p-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-red-400 transition-all shadow-md touch-manipulation"
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
            <span className="text-xs font-medium text-gray-400">Tools:</span>
            {message.tools_used.map((tool, idx) => (
              <span
                key={idx}
                className="text-xs px-1.5 sm:px-2 py-0.5 bg-[#40414f] text-gray-300 rounded-full font-medium"
              >
                {tool}
              </span>
            ))}
          </div>
        )}
      </div>

      {isUser && (
        <div className="flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 md:w-9 md:h-9 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-md ring-2 ring-blue-500/20">
          <User className="w-3.5 h-3.5 sm:w-4 sm:h-4 md:w-5 md:h-5 text-white" />
        </div>
      )}
    </div>
  );
}
