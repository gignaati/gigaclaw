"use client";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { useState, useEffect, useCallback } from "react";
import { PageLayout } from "./page-layout.js";
import { GitPullRequestIcon, SpinnerIcon, RefreshIcon } from "./icons.js";
import { getPullRequests } from "../actions.js";
function timeAgo(ts) {
  const seconds = Math.floor((Date.now() - new Date(ts).getTime()) / 1e3);
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
function PullRequestsPage({ session }) {
  const [pullRequests, setPullRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const fetchPRs = useCallback(async () => {
    try {
      const result = await getPullRequests();
      setPullRequests(result);
    } catch (err) {
      console.error("Failed to load pull requests:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);
  useEffect(() => {
    fetchPRs();
  }, [fetchPRs]);
  useEffect(() => {
    const interval = setInterval(() => fetchPRs(), 6e4);
    return () => clearInterval(interval);
  }, [fetchPRs]);
  return /* @__PURE__ */ jsxs(PageLayout, { session, children: [
    /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between mb-6", children: [
      /* @__PURE__ */ jsx("h1", { className: "text-2xl font-semibold", children: "Pull Requests" }),
      !loading && /* @__PURE__ */ jsx(
        "button",
        {
          onClick: () => {
            setRefreshing(true);
            fetchPRs();
          },
          disabled: refreshing,
          className: "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium border border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50 disabled:pointer-events-none",
          children: refreshing ? /* @__PURE__ */ jsxs(Fragment, { children: [
            /* @__PURE__ */ jsx(SpinnerIcon, { size: 14 }),
            " Refreshing..."
          ] }) : /* @__PURE__ */ jsxs(Fragment, { children: [
            /* @__PURE__ */ jsx(RefreshIcon, { size: 14 }),
            " Refresh"
          ] })
        }
      )
    ] }),
    /* @__PURE__ */ jsxs("p", { className: "text-sm text-muted-foreground mb-4", children: [
      pullRequests.length,
      " open ",
      pullRequests.length === 1 ? "pull request" : "pull requests"
    ] }),
    loading ? /* @__PURE__ */ jsx("div", { className: "flex flex-col gap-3", children: [...Array(5)].map((_, i) => /* @__PURE__ */ jsx("div", { className: "h-14 animate-pulse rounded-md bg-border/50" }, i)) }) : pullRequests.length === 0 ? /* @__PURE__ */ jsx("p", { className: "text-sm text-muted-foreground py-8 text-center", children: "No open pull requests." }) : /* @__PURE__ */ jsx("div", { className: "flex flex-col gap-3", children: pullRequests.map((pr) => /* @__PURE__ */ jsxs(
      "a",
      {
        href: pr.html_url,
        target: "_blank",
        rel: "noopener noreferrer",
        className: "flex items-start gap-3 p-4 border border-border rounded-lg hover:bg-accent transition-colors no-underline text-inherit",
        children: [
          /* @__PURE__ */ jsx("div", { className: "mt-0.5 shrink-0 text-muted-foreground", children: /* @__PURE__ */ jsx(GitPullRequestIcon, { size: 16 }) }),
          /* @__PURE__ */ jsxs("div", { className: "flex-1 min-w-0", children: [
            /* @__PURE__ */ jsxs("div", { className: "text-sm font-medium", children: [
              "#",
              pr.number,
              " ",
              pr.title
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "text-xs text-muted-foreground mt-1", children: [
              pr.head_branch,
              " \u2192 ",
              pr.base_branch,
              " \xB7 opened by ",
              pr.user,
              " \xB7 ",
              timeAgo(pr.created_at)
            ] })
          ] }),
          /* @__PURE__ */ jsx("span", { className: "text-xs text-blue-500 shrink-0 mt-1", children: "View \u2192" })
        ]
      },
      pr.id
    )) })
  ] });
}
export {
  PullRequestsPage
};
