/**
 * Chat API client
 */

import type { ChatRequest, ChatResponse, StreamChunk } from "@/types/api";
import { getApiBaseUrl, getAuthHeaders, handleResponse } from "./client";

export async function sendChatMessage(
  request: ChatRequest
): Promise<ChatResponse> {
  const apiBaseUrl = await getApiBaseUrl();
  const response = await fetch(`${apiBaseUrl}/api/chat`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(request),
  });
  return handleResponse<ChatResponse>(response);
}

/**
 * Streaming chat API
 * Creates a stream reader for real-time chat responses
 */
export function createStreamReader(
  request: ChatRequest,
  onChunk: (chunk: StreamChunk) => void,
  onError: (error: Error) => void,
  onComplete: () => void
): () => void {
  const abortController = new AbortController();
  let isAborted = false;

  (async () => {
    try {
      const apiBaseUrl = await getApiBaseUrl();
      // Prepare request body with optional RAG parameters
      const requestBody: ChatRequest = {
        message: request.message,
        session_id: request.session_id,
        mode: request.mode,
        guest_email: request.guest_email,
      };
      if (request.mode === "rag") {
        if (
          request.collection_id !== undefined &&
          request.collection_id !== null
        ) {
          requestBody.collection_id = request.collection_id;
        }
        if (request.use_react !== undefined) {
          requestBody.use_react = request.use_react;
        }
      }

      const headers = getAuthHeaders();
      const url = `${apiBaseUrl}/api/chat/stream`;

      let response: Response;
      try {
        const fetchPromise = fetch(url, {
          method: "POST",
          headers,
          body: JSON.stringify(requestBody),
          signal: abortController.signal,
        });

        // Add a timeout to detect if fetch hangs
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => {
            reject(new Error("Fetch timeout after 30 seconds"));
          }, 30000);
        });

        response = await Promise.race([fetchPromise, timeoutPromise]);
      } catch (fetchError) {
        const errorMessage =
          fetchError instanceof Error ? fetchError.message : String(fetchError);
        throw new Error(
          `Failed to connect to server: ${errorMessage}. Please check if the backend is running at ${url}.`
        );
      }

      if (!response.ok) {
        // For agent mode, 401 should not happen - backend allows unauthenticated access
        // But if it does, try to parse the error message
        let errorDetail = `HTTP ${response.status}: ${response.statusText}`;
        try {
          // Try to read the error response body
          const errorText = await response.text();
          if (errorText) {
            try {
              const error = JSON.parse(errorText);
              errorDetail = error.detail || error.message || errorDetail;
            } catch {
              // If not JSON, use the text as error detail
              errorDetail = errorText || errorDetail;
            }
          }
        } catch (parseError) {
          // If we can't read the response, use status text
          console.error("Failed to parse error response:", parseError);
        }

        // For 401 errors in agent mode, this shouldn't happen but handle gracefully
        if (response.status === 401 && request.mode === "agent") {
          // Agent mode should work without auth - this might be a backend configuration issue
          // Still throw the error but with a helpful message
          throw new Error(
            `Backend authentication error: ${errorDetail}. Agent mode should work without login. Please check backend configuration.`
          );
        }

        throw new Error(errorDetail);
      }

      // Check if response body exists
      if (!response.body) {
        throw new Error(
          `No response body received from server. Status: ${response.status} ${response.statusText}`
        );
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      let buffer = "";
      try {
        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            break;
          }

          if (isAborted) {
            break;
          }

          if (value) {
            const decoded = decoder.decode(value, { stream: true });
            buffer += decoded;
          }

          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (isAborted) break;

            const trimmedLine = line.trim();
            if (!trimmedLine) continue;

            if (trimmedLine.startsWith("data: ")) {
              try {
                const jsonStr = trimmedLine.slice(6);
                // Skip completely empty JSON strings
                if (jsonStr.trim() === "") continue;

                const data = JSON.parse(jsonStr) as StreamChunk;

                // Always call onChunk to handle status messages and chunks
                onChunk(data);

                if (data.done || data.error) {
                  onComplete();
                  return;
                }
              } catch {
                // Continue processing other lines - don't break the stream
                // Silently skip malformed lines
              }
            }
          }
        }

        // Process remaining buffer
        if (buffer.trim() && !isAborted) {
          const trimmedBuffer = buffer.trim();
          if (trimmedBuffer.startsWith("data: ")) {
            try {
              const jsonStr = trimmedBuffer.slice(6);
              if (jsonStr.trim()) {
                const data = JSON.parse(jsonStr);
                onChunk(data);
                // If this was the final message, don't call onComplete again
                if (data.done || data.error) {
                  return;
                }
              }
            } catch {
              // Silently skip malformed buffer data
            }
          }
        }

        // Only call onComplete if we haven't already (stream ended normally)
        // This handles the case where the stream ends without a "done" message
        if (!isAborted) {
          onComplete();
        }
      } catch (error) {
        if (
          !isAborted &&
          error instanceof Error &&
          error.name !== "AbortError"
        ) {
          onError(error);
        } else if (error instanceof Error && error.name === "AbortError") {
          onComplete();
        }
      } finally {
        try {
          reader.releaseLock();
        } catch {
          // Reader already released
        }
      }
    } catch (error) {
      // Handle network errors or fetch failures
      if (error instanceof Error && error.name === "AbortError") {
        onComplete();
        return;
      }
      if (!isAborted) {
        const errorMessage =
          error instanceof Error
            ? error
            : new Error(
              `Network error: ${String(
                error
              )}. Please check your connection and ensure the backend is running.`
            );
        onError(errorMessage);
      }
    }
  })(); // Invoke the async IIFE

  return () => {
    isAborted = true;
    abortController.abort();
  };
}
