"use client";
import { jsx, jsxs } from "react/jsx-runtime";
import { useState, useEffect, useCallback } from "react";
import { AppSidebar } from "./app-sidebar.js";
import { Chat } from "./chat.js";
import { SidebarProvider, SidebarInset } from "./ui/sidebar.js";
import { ChatNavProvider } from "./chat-nav-context.js";
import { getChatMessages, getChatMeta, getWorkspace } from "../actions.js";
import { v4 as uuidv4 } from "uuid";
function ChatPage({ session, needsSetup, chatId }) {
  const [activeChatId, setActiveChatId] = useState(chatId || null);
  const [resolvedChatId, setResolvedChatId] = useState(() => chatId ? null : uuidv4());
  const [initialMessages, setInitialMessages] = useState([]);
  const [workspace, setWorkspace] = useState(null);
  const navigateToChat = useCallback((id) => {
    if (id) {
      window.history.pushState({}, "", `/chat/${id}`);
      setResolvedChatId(null);
      setInitialMessages([]);
      setWorkspace(null);
      setActiveChatId(id);
    } else {
      window.history.pushState({}, "", "/");
      setInitialMessages([]);
      setWorkspace(null);
      setActiveChatId(null);
      setResolvedChatId(uuidv4());
    }
  }, []);
  useEffect(() => {
    const onPopState = () => {
      const match = window.location.pathname.match(/^\/chat\/(.+)/);
      if (match) {
        setResolvedChatId(null);
        setInitialMessages([]);
        setWorkspace(null);
        setActiveChatId(match[1]);
      } else {
        setInitialMessages([]);
        setWorkspace(null);
        setActiveChatId(null);
        setResolvedChatId(uuidv4());
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);
  useEffect(() => {
    if (activeChatId) {
      getChatMessages(activeChatId).then(async (dbMessages) => {
        if (dbMessages.length === 0) {
          setInitialMessages([]);
          setWorkspace(null);
          setResolvedChatId(uuidv4());
          window.history.replaceState({}, "", "/");
          return;
        }
        const uiMessages = dbMessages.map((msg) => ({
          id: msg.id,
          role: msg.role,
          content: msg.content,
          parts: [{ type: "text", text: msg.content }],
          createdAt: new Date(msg.createdAt)
        }));
        setInitialMessages(uiMessages);
        try {
          const meta = await getChatMeta(activeChatId);
          if (meta?.codeWorkspaceId) {
            const ws = await getWorkspace(meta.codeWorkspaceId);
            setWorkspace(ws);
          } else {
            setWorkspace(null);
          }
        } catch {
          setWorkspace(null);
        }
        setResolvedChatId(activeChatId);
      });
    }
  }, [activeChatId]);
  if (needsSetup || !session) {
    return null;
  }
  return /* @__PURE__ */ jsx(ChatNavProvider, { value: { activeChatId: resolvedChatId, navigateToChat }, children: /* @__PURE__ */ jsxs(SidebarProvider, { children: [
    /* @__PURE__ */ jsx(AppSidebar, { user: session.user }),
    /* @__PURE__ */ jsx(SidebarInset, { children: resolvedChatId && /* @__PURE__ */ jsx(
      Chat,
      {
        chatId: resolvedChatId,
        initialMessages,
        workspace
      },
      resolvedChatId
    ) })
  ] }) });
}
export {
  ChatPage
};
