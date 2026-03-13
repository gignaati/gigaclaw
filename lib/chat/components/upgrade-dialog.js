"use client";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { useState, useEffect, useCallback } from "react";
import { ArrowUpCircleIcon, SpinnerIcon, CheckIcon, XIcon, RefreshIcon } from "./icons.js";
import { triggerUpgrade } from "../actions.js";
function UpgradeDialog({ open, onClose, version, updateAvailable, changelog }) {
  const [upgrading, setUpgrading] = useState(false);
  const [result, setResult] = useState(null);
  const handleClose = useCallback(() => onClose(), [onClose]);
  useEffect(() => {
    if (!open) return;
    const handleEsc = (e) => {
      if (e.key === "Escape") handleClose();
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [open, handleClose]);
  useEffect(() => {
    if (!open) {
      setUpgrading(false);
      setResult(null);
    }
  }, [open]);
  if (!open) return null;
  const handleUpgrade = async () => {
    setUpgrading(true);
    setResult(null);
    try {
      await triggerUpgrade();
      setResult("success");
    } catch {
      setResult("error");
    } finally {
      setUpgrading(false);
    }
  };
  return /* @__PURE__ */ jsxs("div", { className: "fixed inset-0 z-50 flex items-center justify-center", children: [
    /* @__PURE__ */ jsx("div", { className: "fixed inset-0 bg-black/50", onClick: handleClose }),
    /* @__PURE__ */ jsx("div", { className: "relative z-50 w-full max-w-md rounded-lg border border-border bg-background p-6 shadow-lg", onClick: (e) => e.stopPropagation(), children: result === "success" ? /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between mb-4", children: [
        /* @__PURE__ */ jsx("h3", { className: "text-lg font-semibold", children: "Upgrade Initiated" }),
        /* @__PURE__ */ jsx("button", { onClick: handleClose, className: "text-muted-foreground hover:text-foreground", children: /* @__PURE__ */ jsx(XIcon, { size: 16 }) })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3 mb-4", children: [
        /* @__PURE__ */ jsx("div", { className: "flex items-center justify-center h-10 w-10 rounded-full bg-emerald-500/10 shrink-0", children: /* @__PURE__ */ jsx(CheckIcon, { size: 20, className: "text-emerald-500" }) }),
        /* @__PURE__ */ jsxs("p", { className: "text-sm font-medium", children: [
          "Upgrading to ",
          /* @__PURE__ */ jsxs("span", { className: "font-mono text-emerald-500", children: [
            "v",
            updateAvailable
          ] })
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "space-y-3 text-sm text-muted-foreground", children: [
        /* @__PURE__ */ jsxs("p", { children: [
          "The upgrade process has been triggered and could take",
          " ",
          /* @__PURE__ */ jsx("strong", { className: "text-foreground", children: "5\u201310 minutes" }),
          " to complete."
        ] }),
        /* @__PURE__ */ jsxs("p", { children: [
          "You can monitor progress from the",
          " ",
          /* @__PURE__ */ jsx("a", { href: "/swarm", className: "text-emerald-500 hover:underline font-medium", children: "Swarm" }),
          " page."
        ] }),
        /* @__PURE__ */ jsx("p", { children: "The site may be briefly unresponsive for a few seconds when the server restarts." }),
        /* @__PURE__ */ jsxs("p", { children: [
          "Some files (prompts, crons, triggers) won't be auto-updated to avoid breaking your bot.",
          " ",
          /* @__PURE__ */ jsx(
            "a",
            {
              href: "https://github.com/gignaati/gigabot?tab=readme-ov-file#understanding-init",
              target: "_blank",
              rel: "noopener noreferrer",
              className: "text-emerald-500 hover:underline",
              children: "Learn more"
            }
          ),
          "."
        ] })
      ] }),
      /* @__PURE__ */ jsx("div", { className: "mt-4 rounded-md border border-border bg-muted/30 p-3", children: /* @__PURE__ */ jsxs("p", { className: "text-xs text-muted-foreground", children: [
        "If you hit unrecoverable errors, see the",
        " ",
        /* @__PURE__ */ jsx(
          "a",
          {
            href: "https://github.com/gignaati/gigabot?tab=readme-ov-file#manual-updating",
            target: "_blank",
            rel: "noopener noreferrer",
            className: "text-emerald-500 hover:underline",
            children: "manual update guide"
          }
        ),
        "."
      ] }) })
    ] }) : /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between mb-4", children: [
        /* @__PURE__ */ jsx("h3", { className: "text-lg font-semibold", children: "Upgrade Available" }),
        /* @__PURE__ */ jsx("button", { onClick: handleClose, className: "text-muted-foreground hover:text-foreground", children: /* @__PURE__ */ jsx(XIcon, { size: 16 }) })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3 mb-4", children: [
        /* @__PURE__ */ jsx(ArrowUpCircleIcon, { size: 24 }),
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("p", { className: "text-sm text-muted-foreground", children: "Installed version" }),
          /* @__PURE__ */ jsxs("p", { className: "text-lg font-mono font-semibold", children: [
            "v",
            version
          ] })
        ] })
      ] }),
      /* @__PURE__ */ jsx("div", { className: "rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3 mb-4", children: /* @__PURE__ */ jsxs("p", { className: "text-sm font-medium", children: [
        "Version ",
        /* @__PURE__ */ jsxs("span", { className: "font-mono text-emerald-500", children: [
          "v",
          updateAvailable
        ] }),
        " is available"
      ] }) }),
      changelog && /* @__PURE__ */ jsxs("div", { className: "mb-4", children: [
        /* @__PURE__ */ jsx("p", { className: "text-sm font-medium mb-2", children: "What's new" }),
        /* @__PURE__ */ jsx("div", { className: "max-h-48 overflow-y-auto rounded-md border border-border bg-muted/30 p-3 text-sm text-muted-foreground whitespace-pre-wrap", children: changelog })
      ] }),
      /* @__PURE__ */ jsx(
        "button",
        {
          onClick: handleUpgrade,
          disabled: upgrading,
          className: "w-full inline-flex items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-medium bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50 disabled:pointer-events-none",
          children: upgrading ? /* @__PURE__ */ jsxs(Fragment, { children: [
            /* @__PURE__ */ jsx(SpinnerIcon, { size: 16 }),
            "Triggering upgrade..."
          ] }) : result === "error" ? /* @__PURE__ */ jsxs(Fragment, { children: [
            /* @__PURE__ */ jsx(RefreshIcon, { size: 16 }),
            "Retry"
          ] }) : /* @__PURE__ */ jsxs(Fragment, { children: [
            /* @__PURE__ */ jsx(ArrowUpCircleIcon, { size: 16 }),
            "Upgrade to v",
            updateAvailable
          ] })
        }
      ),
      result === "error" && /* @__PURE__ */ jsx("p", { className: "text-xs text-red-400 mt-3", children: "Failed to trigger the upgrade workflow. Check that your GitHub token has workflow permissions." })
    ] }) })
  ] });
}
export {
  UpgradeDialog
};
