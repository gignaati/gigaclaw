"use client";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { SidebarHistoryItem } from "./sidebar-history-item.js";
import { SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu } from "./ui/sidebar.js";
import { useChatNav } from "./chat-nav-context.js";
import { getChats, deleteChat, renameChat, starChat } from "../actions.js";
import { cn } from "../utils.js";
import { MessageIcon, CodeIcon } from "./icons.js";
function groupChatsByDate(chats) {
  const now = /* @__PURE__ */ new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 864e5);
  const last7Days = new Date(today.getTime() - 7 * 864e5);
  const last30Days = new Date(today.getTime() - 30 * 864e5);
  const groups = {
    Starred: [],
    Today: [],
    Yesterday: [],
    "Last 7 Days": [],
    "Last 30 Days": [],
    Older: []
  };
  for (const chat of chats) {
    if (chat.starred) {
      groups.Starred.push(chat);
      continue;
    }
    const date = new Date(chat.updatedAt);
    if (date >= today) {
      groups.Today.push(chat);
    } else if (date >= yesterday) {
      groups.Yesterday.push(chat);
    } else if (date >= last7Days) {
      groups["Last 7 Days"].push(chat);
    } else if (date >= last30Days) {
      groups["Last 30 Days"].push(chat);
    } else {
      groups.Older.push(chat);
    }
  }
  return groups;
}
const FILTERS = [
  { value: "all", label: "All", icon: null },
  { value: "chat", label: "Chat", icon: MessageIcon },
  { value: "code", label: "Code", icon: CodeIcon }
];
function ChatTypeFilter({ filter, setFilter }) {
  return /* @__PURE__ */ jsx("div", { className: "flex items-center gap-0.5 px-2 mb-1", children: FILTERS.map(({ value, label, icon: Icon }) => /* @__PURE__ */ jsxs(
    "button",
    {
      onClick: () => setFilter(value),
      className: cn(
        "flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium transition-colors",
        filter === value ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
      ),
      children: [
        Icon && /* @__PURE__ */ jsx(Icon, { size: 12 }),
        label
      ]
    },
    value
  )) });
}
const isCodeChat = (chat) => Boolean(chat.codeWorkspaceId && chat.containerName);
function SidebarHistory() {
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const updateFilter = (v) => {
    setFilter(v);
    try {
      localStorage.setItem("sidebar-chat-filter", v);
    } catch {
    }
  };
  useEffect(() => {
    try {
      const v = localStorage.getItem("sidebar-chat-filter");
      if (v === "chat" || v === "code") setFilter(v);
    } catch {
    }
  }, []);
  const { activeChatId, navigateToChat } = useChatNav();
  const loadChats = async () => {
    try {
      const result = await getChats();
      setChats(result);
    } catch (err) {
      console.error("Failed to load chats:", err);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    loadChats();
  }, [activeChatId]);
  useEffect(() => {
    const handler = () => loadChats();
    window.addEventListener("chatsupdated", handler);
    return () => window.removeEventListener("chatsupdated", handler);
  }, []);
  const handleDelete = async (chatId) => {
    setChats((prev) => prev.filter((c) => c.id !== chatId));
    const { success } = await deleteChat(chatId);
    if (success) {
      if (chatId === activeChatId) {
        navigateToChat(null);
      }
    } else {
      loadChats();
    }
  };
  const handleStar = async (chatId) => {
    setChats(
      (prev) => prev.map((c) => c.id === chatId ? { ...c, starred: c.starred ? 0 : 1 } : c)
    );
    const { success } = await starChat(chatId);
    if (!success) loadChats();
  };
  const handleRename = async (chatId, title) => {
    setChats(
      (prev) => prev.map((c) => c.id === chatId ? { ...c, title } : c)
    );
    const { success } = await renameChat(chatId, title);
    if (!success) loadChats();
  };
  if (loading && chats.length === 0) {
    return /* @__PURE__ */ jsx(SidebarGroup, { children: /* @__PURE__ */ jsxs(SidebarGroupContent, { children: [
      /* @__PURE__ */ jsx(ChatTypeFilter, { filter, setFilter: updateFilter }),
      /* @__PURE__ */ jsx("div", { className: "flex flex-col gap-2 px-2", children: [...Array(5)].map((_, i) => /* @__PURE__ */ jsx("div", { className: "h-8 animate-pulse rounded-md bg-border/50" }, i)) })
    ] }) });
  }
  if (chats.length === 0) {
    return /* @__PURE__ */ jsx(SidebarGroup, { children: /* @__PURE__ */ jsx(SidebarGroupContent, { children: /* @__PURE__ */ jsx("p", { className: "px-4 py-2 text-sm text-muted-foreground", children: "No chats yet. Start a conversation!" }) }) });
  }
  const filteredChats = filter === "all" ? chats : filter === "code" ? chats.filter(isCodeChat) : chats.filter((c) => !isCodeChat(c));
  const grouped = groupChatsByDate(filteredChats);
  const hasResults = Object.values(grouped).some((g) => g.length > 0);
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx(SidebarGroup, { children: /* @__PURE__ */ jsx(SidebarGroupContent, { children: /* @__PURE__ */ jsx(ChatTypeFilter, { filter, setFilter: updateFilter }) }) }),
    hasResults ? Object.entries(grouped).map(
      ([label, groupChats]) => groupChats.length > 0 && /* @__PURE__ */ jsxs(SidebarGroup, { children: [
        /* @__PURE__ */ jsx(SidebarGroupLabel, { children: label }),
        /* @__PURE__ */ jsx(SidebarGroupContent, { children: /* @__PURE__ */ jsx(SidebarMenu, { children: groupChats.map((chat) => /* @__PURE__ */ jsx(
          SidebarHistoryItem,
          {
            chat,
            isActive: chat.id === activeChatId,
            onDelete: handleDelete,
            onStar: handleStar,
            onRename: handleRename
          },
          chat.id
        )) }) })
      ] }, label)
    ) : /* @__PURE__ */ jsx(SidebarGroup, { children: /* @__PURE__ */ jsx(SidebarGroupContent, { children: /* @__PURE__ */ jsxs("p", { className: "px-4 py-2 text-sm text-muted-foreground", children: [
      "No ",
      filter === "code" ? "code" : "chat",
      " chats yet."
    ] }) }) })
  ] });
}
export {
  SidebarHistory
};
