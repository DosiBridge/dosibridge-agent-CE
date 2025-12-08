/**
 * Code block component using Shiki for syntax highlighting
 * Uses Shiki (https://shiki.style/) for accurate VS Code-like syntax highlighting
 */
"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useState } from "react";
import { codeToHtml } from "shiki";
import toast from "react-hot-toast";

interface CodeBlockProps {
  code: string;
  language: string;
  isDarkMode: boolean;
}

export default function CodeBlock({
  code,
  language,
  isDarkMode,
}: CodeBlockProps) {
  const [highlightedCode, setHighlightedCode] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const highlight = async () => {
      setIsLoading(true);
      try {
        // Use codeToHtml which handles highlighter creation internally
        const html = await codeToHtml(code, {
          lang: language || "text",
          theme: isDarkMode ? "github-dark-default" : "github-light-default",
        });
        if (mounted) {
          setHighlightedCode(html);
          setIsLoading(false);
        }
      } catch (error) {
        console.error("Failed to highlight code with Shiki:", error);
        // Fallback to plain text with proper escaping
        if (mounted) {
          const escapedCode = code
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
          setHighlightedCode(`<pre class="shiki"><code>${escapedCode}</code></pre>`);
          setIsLoading(false);
        }
      }
    };

    highlight();

    return () => {
      mounted = false;
    };
  }, [code, language, isDarkMode]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast.success("Code copied!");
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error("Failed to copy code");
    }
  };

  if (isLoading) {
    return (
      <div className="relative my-3 group/codeblock">
        <div className="flex items-center justify-between px-4 py-2 bg-[var(--code-header-bg)] border-b border-[var(--code-border)] rounded-t-lg">
          <span className="text-xs font-medium text-[var(--text-secondary)] uppercase">
            {language || "text"}
          </span>
          <div className="w-16 h-4 bg-[var(--surface-hover)] rounded animate-pulse" />
        </div>
        <div className="bg-[var(--code-bg)] border border-[var(--code-border)] rounded-b-lg p-4">
          <div className="space-y-2">
            <div className="h-4 bg-[var(--surface-hover)] rounded w-3/4 animate-pulse" />
            <div className="h-4 bg-[var(--surface-hover)] rounded w-1/2 animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative my-3 group/codeblock">
      {/* Code block header with language and copy button */}
      <div className="flex items-center justify-between px-4 py-2 bg-[var(--code-header-bg)] border-b border-[var(--code-border)] rounded-t-lg">
        <span className="text-xs font-medium text-[var(--text-secondary)] uppercase">
          {language || "text"}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-2 py-1 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] rounded transition-colors"
          title="Copy code"
        >
          {copied ? (
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
      {/* Shiki highlighted code */}
      <div
        className="shiki-code-block rounded-b-lg text-xs sm:text-sm mt-0 overflow-x-auto border border-t-0 border-[var(--code-border)]"
        dangerouslySetInnerHTML={{ __html: highlightedCode }}
      />
    </div>
  );
}

