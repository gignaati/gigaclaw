"use client";
import { jsx, jsxs } from "react/jsx-runtime";
import { useState, useEffect } from "react";
import { KeyIcon, CopyIcon, CheckIcon, TrashIcon, RefreshIcon } from "./icons.js";
import { createNewApiKey, getApiKeys, deleteApiKey } from "../actions.js";
function timeAgo(ts) {
  if (!ts) return "Never";
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
function formatDate(ts) {
  if (!ts) return "\u2014";
  return new Date(ts).toLocaleDateString(void 0, {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}
function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2e3);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2e3);
    }
  };
  return /* @__PURE__ */ jsxs(
    "button",
    {
      onClick: handleCopy,
      className: "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium border border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground",
      children: [
        copied ? /* @__PURE__ */ jsx(CheckIcon, { size: 14 }) : /* @__PURE__ */ jsx(CopyIcon, { size: 14 }),
        copied ? "Copied" : "Copy"
      ]
    }
  );
}
function Section({ title, description, children }) {
  return /* @__PURE__ */ jsxs("div", { className: "pb-8 mb-8 border-b border-border last:border-b-0 last:pb-0 last:mb-0", children: [
    /* @__PURE__ */ jsx("h2", { className: "text-base font-medium mb-1", children: title }),
    description && /* @__PURE__ */ jsx("p", { className: "text-sm text-muted-foreground mb-4", children: description }),
    children
  ] });
}
function ApiKeySection() {
  const [currentKey, setCurrentKey] = useState(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmRegenerate, setConfirmRegenerate] = useState(false);
  const [error, setError] = useState(null);
  const loadKey = async () => {
    try {
      const result = await getApiKeys();
      setCurrentKey(result);
    } catch {
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    loadKey();
  }, []);
  const handleCreate = async () => {
    if (creating) return;
    setCreating(true);
    setError(null);
    setConfirmRegenerate(false);
    try {
      const result = await createNewApiKey();
      if (result.error) {
        setError(result.error);
      } else {
        setNewKey(result.key);
        await loadKey();
      }
    } catch {
      setError("Failed to create API key");
    } finally {
      setCreating(false);
    }
  };
  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3e3);
      return;
    }
    try {
      await deleteApiKey();
      setCurrentKey(null);
      setNewKey(null);
      setConfirmDelete(false);
    } catch {
    }
  };
  const handleRegenerate = () => {
    if (!confirmRegenerate) {
      setConfirmRegenerate(true);
      setTimeout(() => setConfirmRegenerate(false), 3e3);
      return;
    }
    handleCreate();
  };
  if (loading) {
    return /* @__PURE__ */ jsx("div", { className: "h-14 animate-pulse rounded-md bg-border/50" });
  }
  return /* @__PURE__ */ jsxs("div", { children: [
    error && /* @__PURE__ */ jsx("p", { className: "text-sm text-destructive mb-4", children: error }),
    newKey && /* @__PURE__ */ jsxs("div", { className: "rounded-lg border border-green-500/30 bg-green-500/5 p-4 mb-4", children: [
      /* @__PURE__ */ jsxs("div", { className: "flex items-start justify-between gap-3 mb-2", children: [
        /* @__PURE__ */ jsx("p", { className: "text-sm font-medium text-green-600 dark:text-green-400", children: "API key created \u2014 copy it now. You won't be able to see it again." }),
        /* @__PURE__ */ jsx(
          "button",
          {
            onClick: () => setNewKey(null),
            className: "text-xs text-muted-foreground hover:text-foreground shrink-0",
            children: "Dismiss"
          }
        )
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
        /* @__PURE__ */ jsx("code", { className: "flex-1 rounded-md bg-muted px-3 py-2 text-xs font-mono break-all select-all", children: newKey }),
        /* @__PURE__ */ jsx(CopyButton, { text: newKey })
      ] })
    ] }),
    currentKey ? /* @__PURE__ */ jsx("div", { className: "rounded-lg border bg-card p-4", children: /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between", children: [
      /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3", children: [
        /* @__PURE__ */ jsx("div", { className: "shrink-0 rounded-md bg-muted p-2", children: /* @__PURE__ */ jsx(KeyIcon, { size: 16 }) }),
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsxs("code", { className: "text-sm font-mono", children: [
            currentKey.keyPrefix,
            "..."
          ] }),
          /* @__PURE__ */ jsxs("p", { className: "text-xs text-muted-foreground mt-0.5", children: [
            "Created ",
            formatDate(currentKey.createdAt),
            currentKey.lastUsedAt && /* @__PURE__ */ jsxs("span", { className: "ml-2", children: [
              "\xB7 Last used ",
              timeAgo(currentKey.lastUsedAt)
            ] })
          ] })
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
        /* @__PURE__ */ jsxs(
          "button",
          {
            onClick: handleRegenerate,
            disabled: creating,
            className: `inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium border ${confirmRegenerate ? "border-yellow-500 text-yellow-600 hover:bg-yellow-500/10" : "border-border text-muted-foreground hover:bg-accent hover:text-foreground"} disabled:opacity-50`,
            children: [
              /* @__PURE__ */ jsx(RefreshIcon, { size: 12 }),
              creating ? "Generating..." : confirmRegenerate ? "Confirm regenerate" : "Regenerate"
            ]
          }
        ),
        /* @__PURE__ */ jsxs(
          "button",
          {
            onClick: handleDelete,
            className: `inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium border ${confirmDelete ? "border-destructive text-destructive hover:bg-destructive/10" : "border-border text-muted-foreground hover:text-destructive hover:border-destructive/50"}`,
            children: [
              /* @__PURE__ */ jsx(TrashIcon, { size: 12 }),
              confirmDelete ? "Confirm delete" : "Delete"
            ]
          }
        )
      ] })
    ] }) }) : /* @__PURE__ */ jsxs("div", { className: "rounded-lg border border-dashed bg-card p-6 flex flex-col items-center text-center", children: [
      /* @__PURE__ */ jsx("p", { className: "text-sm text-muted-foreground mb-3", children: "No API key configured" }),
      /* @__PURE__ */ jsx(
        "button",
        {
          onClick: handleCreate,
          disabled: creating,
          className: "inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium bg-foreground text-background hover:bg-foreground/90 disabled:opacity-50 disabled:pointer-events-none",
          children: creating ? "Creating..." : "Create API key"
        }
      )
    ] })
  ] });
}
function SettingsSecretsPage() {
  return /* @__PURE__ */ jsx("div", { children: /* @__PURE__ */ jsx(
    Section,
    {
      title: "API Key",
      description: "Authenticates external requests to /api endpoints. Pass via the x-api-key header.",
      children: /* @__PURE__ */ jsx(ApiKeySection, {})
    }
  ) });
}
export {
  SettingsSecretsPage
};
