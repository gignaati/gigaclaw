"use client";
import { jsx, jsxs } from "react/jsx-runtime";
import { useState, useEffect } from "react";
import { Streamdown } from "streamdown";
import { PageLayout } from "./page-layout.js";
import { BellIcon } from "./icons.js";
import { linkSafety } from "./message.js";
import { getNotifications, markNotificationsRead } from "../actions.js";
function timeAgo(ts) {
  const seconds = Math.floor((Date.now() - ts) / 1e3);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}
function NotificationsPage({ session }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    async function load() {
      try {
        const result = await getNotifications();
        setNotifications(result);
        await markNotificationsRead();
      } catch (err) {
        console.error("Failed to load notifications:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);
  return /* @__PURE__ */ jsxs(PageLayout, { session, children: [
    /* @__PURE__ */ jsx("div", { className: "flex items-center justify-between mb-6", children: /* @__PURE__ */ jsx("h1", { className: "text-2xl font-semibold", children: "Notifications" }) }),
    /* @__PURE__ */ jsxs("p", { className: "text-sm text-muted-foreground mb-4", children: [
      notifications.length,
      " ",
      notifications.length === 1 ? "notification" : "notifications"
    ] }),
    loading ? /* @__PURE__ */ jsx("div", { className: "flex flex-col gap-3", children: [...Array(5)].map((_, i) => /* @__PURE__ */ jsx("div", { className: "h-14 animate-pulse rounded-md bg-border/50" }, i)) }) : notifications.length === 0 ? /* @__PURE__ */ jsx("p", { className: "text-sm text-muted-foreground py-8 text-center", children: "No notifications yet." }) : /* @__PURE__ */ jsx("div", { className: "flex flex-col gap-3", children: notifications.map((n) => /* @__PURE__ */ jsxs("div", { className: "flex items-start gap-3 p-4 border border-border rounded-lg", children: [
      /* @__PURE__ */ jsx("div", { className: "mt-0.5 shrink-0 text-muted-foreground", children: /* @__PURE__ */ jsx(BellIcon, { size: 16 }) }),
      /* @__PURE__ */ jsxs("div", { className: "flex-1 min-w-0", children: [
        /* @__PURE__ */ jsx("div", { className: "text-sm prose-sm", children: /* @__PURE__ */ jsx(Streamdown, { mode: "static", linkSafety, children: n.notification }) }),
        /* @__PURE__ */ jsx("span", { className: "text-xs text-muted-foreground", children: timeAgo(n.createdAt) })
      ] })
    ] }, n.id)) })
  ] });
}
export {
  NotificationsPage
};
