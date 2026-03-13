"use client";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Messages } from "./messages.js";
import { ChatInput } from "./chat-input.js";
import { ChatHeader } from "./chat-header.js";
import { Greeting } from "./greeting.js";
import { CodeModeToggle } from "./code-mode-toggle.js";
import { getRepositories, getBranches } from "../actions.js";
function Chat({ chatId, initialMessages = [], workspace = null }) {
  const [input, setInput] = useState("");
  const [files, setFiles] = useState([]);
  const hasNavigated = useRef(false);
  const [codeMode, setCodeMode] = useState(!!workspace);
  const [repo, setRepo] = useState(workspace?.repo || "");
  const [branch, setBranch] = useState(workspace?.branch || "");
  const codeModeRef = useRef({ codeMode, repo, branch });
  codeModeRef.current = { codeMode, repo, branch };
  const transport = useMemo(
    () => new DefaultChatTransport({
      api: "/stream/chat",
      body: () => ({
        chatId,
        ...codeModeRef.current.codeMode && codeModeRef.current.repo && codeModeRef.current.branch ? { codeMode: true, repo: codeModeRef.current.repo, branch: codeModeRef.current.branch } : {}
      })
    }),
    [chatId]
  );
  const {
    messages,
    status,
    stop,
    error,
    sendMessage,
    regenerate,
    setMessages
  } = useChat({
    id: chatId,
    messages: initialMessages,
    transport,
    onError: (err) => console.error("Chat error:", err)
  });
  useEffect(() => {
    if (!hasNavigated.current && messages.length >= 1 && status !== "ready" && window.location.pathname !== `/chat/${chatId}`) {
      hasNavigated.current = true;
      window.history.replaceState({}, "", `/chat/${chatId}`);
      window.dispatchEvent(new Event("chatsupdated"));
      setTimeout(() => window.dispatchEvent(new Event("chatsupdated")), 5e3);
    }
  }, [messages.length, status, chatId]);
  const handleSend = () => {
    if (!input.trim() && files.length === 0) return;
    const text = input;
    const currentFiles = files;
    setInput("");
    setFiles([]);
    if (currentFiles.length === 0) {
      sendMessage({ text });
    } else {
      const fileParts = currentFiles.map((f) => ({
        type: "file",
        mediaType: f.file.type || "text/plain",
        url: f.previewUrl,
        filename: f.file.name
      }));
      sendMessage({ text: text || void 0, files: fileParts });
    }
  };
  const handleRetry = useCallback((message) => {
    if (message.role === "assistant") {
      regenerate({ messageId: message.id });
    } else {
      const idx = messages.findIndex((m) => m.id === message.id);
      const nextAssistant = messages.slice(idx + 1).find((m) => m.role === "assistant");
      if (nextAssistant) {
        regenerate({ messageId: nextAssistant.id });
      } else {
        const text = message.parts?.filter((p) => p.type === "text").map((p) => p.text).join("\n") || message.content || "";
        if (text.trim()) {
          sendMessage({ text });
        }
      }
    }
  }, [messages, regenerate, sendMessage]);
  const handleEdit = useCallback((message, newText) => {
    const idx = messages.findIndex((m) => m.id === message.id);
    if (idx === -1) return;
    setMessages(messages.slice(0, idx));
    sendMessage({ text: newText });
  }, [messages, setMessages, sendMessage]);
  const isWorkspaceLaunched = !!workspace?.containerName || messages.some(
    (m) => m.parts?.some((p) => p.type === "tool-invocation" && p.toolName === "start_coding" && p.state === "output-available")
  );
  const codeModeCanSend = !codeMode || !!repo && !!branch;
  const codeModeToggle = /* @__PURE__ */ jsx(
    CodeModeToggle,
    {
      enabled: codeMode,
      onToggle: setCodeMode,
      repo,
      onRepoChange: setRepo,
      branch,
      onBranchChange: setBranch,
      locked: messages.length > 0,
      getRepositories,
      getBranches
    }
  );
  return /* @__PURE__ */ jsxs("div", { className: "flex h-svh flex-col", children: [
    /* @__PURE__ */ jsx(ChatHeader, { chatId }),
    messages.length === 0 ? /* @__PURE__ */ jsx("div", { className: "flex flex-1 flex-col items-center justify-center px-4 md:px-6", children: /* @__PURE__ */ jsxs("div", { className: "w-full max-w-4xl", children: [
      /* @__PURE__ */ jsx(Greeting, { codeMode }),
      error && /* @__PURE__ */ jsx("div", { className: "mt-4 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-2 text-sm text-destructive", children: error.message || "Something went wrong. Please try again." }),
      /* @__PURE__ */ jsx("div", { className: "mt-4", children: /* @__PURE__ */ jsx(
        ChatInput,
        {
          input,
          setInput,
          onSubmit: handleSend,
          status,
          stop,
          files,
          setFiles,
          canSendOverride: codeModeCanSend ? void 0 : false
        }
      ) }),
      /* @__PURE__ */ jsx("div", { className: "mt-5 pb-8", children: codeModeToggle })
    ] }) }) : /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsx(Messages, { messages, status, onRetry: handleRetry, onEdit: handleEdit }),
      error && /* @__PURE__ */ jsx("div", { className: "mx-auto w-full max-w-4xl px-2 md:px-4", children: /* @__PURE__ */ jsx("div", { className: "rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-2 text-sm text-destructive", children: error.message || "Something went wrong. Please try again." }) }),
      /* @__PURE__ */ jsx(
        ChatInput,
        {
          input,
          setInput,
          onSubmit: handleSend,
          status,
          stop,
          files,
          setFiles,
          disabled: isWorkspaceLaunched,
          placeholder: isWorkspaceLaunched ? "Workspace launched \u2014 click the link above to start coding." : "Send a message..."
        }
      ),
      codeMode && /* @__PURE__ */ jsx("div", { className: "mx-auto w-full max-w-4xl px-4 pb-8 md:px-6", children: codeModeToggle })
    ] })
  ] });
}
export {
  Chat
};
