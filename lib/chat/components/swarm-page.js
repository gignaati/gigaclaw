"use client";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { useState, useEffect, useCallback } from "react";
import { PageLayout } from "./page-layout.js";
import { SpinnerIcon, RefreshIcon } from "./icons.js";
import { getSwarmStatus } from "../actions.js";
function formatDuration(seconds) {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (minutes < 60) return `${minutes}m ${secs}s`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}m`;
}
function timeAgo(timestamp) {
  const seconds = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1e3);
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
function LoadingSkeleton() {
  return /* @__PURE__ */ jsx("div", { className: "flex flex-col gap-4", children: [...Array(5)].map((_, i) => /* @__PURE__ */ jsx("div", { className: "h-14 animate-pulse rounded-md bg-border/50" }, i)) });
}
const conclusionBadgeStyles = {
  success: "bg-green-500/10 text-green-500",
  failure: "bg-red-500/10 text-red-500",
  cancelled: "bg-yellow-500/10 text-yellow-500",
  skipped: "bg-muted text-muted-foreground"
};
function SwarmWorkflowList({ runs }) {
  if (!runs || runs.length === 0) {
    return /* @__PURE__ */ jsx("div", { className: "text-sm text-muted-foreground py-4 text-center", children: "No workflow runs." });
  }
  return /* @__PURE__ */ jsx("div", { className: "flex flex-col divide-y divide-border", children: runs.map((run) => {
    const isActive = run.status === "in_progress" || run.status === "queued";
    const isRunning = run.status === "in_progress";
    const isQueued = run.status === "queued";
    return /* @__PURE__ */ jsxs(
      "a",
      {
        href: run.html_url,
        target: "_blank",
        rel: "noopener noreferrer",
        className: "flex items-center gap-3 py-3 px-2 -mx-2 rounded-md hover:bg-accent transition-colors no-underline text-inherit",
        children: [
          isRunning && /* @__PURE__ */ jsx("span", { className: "inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-green-500 animate-pulse" }),
          isQueued && /* @__PURE__ */ jsx("span", { className: "inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-yellow-500" }),
          !isActive && /* @__PURE__ */ jsx(
            "span",
            {
              className: `inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium uppercase shrink-0 ${conclusionBadgeStyles[run.conclusion] || "bg-muted text-muted-foreground"}`,
              children: run.conclusion || "unknown"
            }
          ),
          /* @__PURE__ */ jsx("span", { className: "text-sm font-medium truncate", children: run.workflow_name || run.branch }),
          /* @__PURE__ */ jsx("span", { className: "text-xs text-muted-foreground shrink-0", children: isActive ? formatDuration(run.duration_seconds) : timeAgo(run.updated_at || run.started_at) }),
          /* @__PURE__ */ jsx("div", { className: "flex-1" }),
          /* @__PURE__ */ jsx("span", { className: "text-xs text-blue-500 shrink-0", children: "View" })
        ]
      },
      run.run_id
    );
  }) });
}
function SwarmPage({ session }) {
  const [runs, setRuns] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const fetchPage = useCallback(async (p) => {
    try {
      const data = await getSwarmStatus(p);
      setRuns(data.runs || []);
      setHasMore(data.hasMore || false);
      setPage(p);
    } catch (err) {
      console.error("Failed to fetch swarm status:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);
  useEffect(() => {
    fetchPage(1);
  }, [fetchPage]);
  useEffect(() => {
    const interval = setInterval(() => fetchPage(page), 1e4);
    return () => clearInterval(interval);
  }, [fetchPage, page]);
  return /* @__PURE__ */ jsxs(PageLayout, { session, children: [
    /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between mb-6", children: [
      /* @__PURE__ */ jsx("h1", { className: "text-2xl font-semibold", children: "Swarm" }),
      !loading && /* @__PURE__ */ jsx(
        "button",
        {
          onClick: () => {
            setRefreshing(true);
            fetchPage(1);
          },
          disabled: refreshing,
          className: "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium border border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50 disabled:pointer-events-none",
          children: refreshing ? /* @__PURE__ */ jsxs(Fragment, { children: [
            /* @__PURE__ */ jsx(SpinnerIcon, { size: 14 }),
            "Refreshing..."
          ] }) : /* @__PURE__ */ jsxs(Fragment, { children: [
            /* @__PURE__ */ jsx(RefreshIcon, { size: 14 }),
            "Refresh"
          ] })
        }
      )
    ] }),
    loading ? /* @__PURE__ */ jsx(LoadingSkeleton, {}) : /* @__PURE__ */ jsxs("div", { children: [
      /* @__PURE__ */ jsx(SwarmWorkflowList, { runs }),
      /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between mt-4 pt-4 border-t border-border", children: [
        /* @__PURE__ */ jsx(
          "button",
          {
            onClick: () => {
              setRefreshing(true);
              fetchPage(page - 1);
            },
            disabled: page <= 1 || refreshing,
            className: "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium border border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50 disabled:pointer-events-none",
            children: "Previous"
          }
        ),
        /* @__PURE__ */ jsxs("span", { className: "text-sm text-muted-foreground", children: [
          "Page ",
          page
        ] }),
        /* @__PURE__ */ jsx(
          "button",
          {
            onClick: () => {
              setRefreshing(true);
              fetchPage(page + 1);
            },
            disabled: !hasMore || refreshing,
            className: "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium border border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50 disabled:pointer-events-none",
            children: "Next"
          }
        )
      ] })
    ] })
  ] });
}
export {
  SwarmPage
};
