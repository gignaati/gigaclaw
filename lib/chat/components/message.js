"use client";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { useState, useRef, useEffect, useCallback } from "react";
import { Streamdown } from "streamdown";
import { cn } from "../utils.js";
import { SpinnerIcon, FileTextIcon, CopyIcon, CheckIcon, RefreshIcon, SquarePenIcon, WrenchIcon, XIcon, ChevronDownIcon } from "./icons.js";
function LinkSafetyModal({ url, isOpen, onClose, onConfirm }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2e3);
    } catch {
    }
  }, [url]);
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);
  if (!isOpen) return null;
  return /* @__PURE__ */ jsx(
    "div",
    {
      className: "fixed inset-0 z-50 flex items-center justify-center bg-black/40",
      onClick: onClose,
      children: /* @__PURE__ */ jsxs(
        "div",
        {
          className: "relative mx-4 flex w-full flex-col gap-3 rounded-lg border border-border bg-background p-4 shadow-lg",
          style: { maxWidth: "340px" },
          onClick: (e) => e.stopPropagation(),
          children: [
            /* @__PURE__ */ jsx("div", { className: "font-medium text-sm text-foreground", children: "Open external link?" }),
            /* @__PURE__ */ jsx("div", { className: "break-all rounded bg-muted px-2.5 py-2 font-mono text-xs text-foreground", children: url }),
            /* @__PURE__ */ jsxs("div", { className: "flex gap-2", children: [
              /* @__PURE__ */ jsxs(
                "button",
                {
                  onClick: handleCopy,
                  className: "flex flex-1 items-center justify-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted",
                  children: [
                    copied ? /* @__PURE__ */ jsx(CheckIcon, { size: 12 }) : /* @__PURE__ */ jsx(CopyIcon, { size: 12 }),
                    /* @__PURE__ */ jsx("span", { children: copied ? "Copied" : "Copy" })
                  ]
                }
              ),
              /* @__PURE__ */ jsx(
                "button",
                {
                  onClick: () => {
                    onConfirm();
                    onClose();
                  },
                  className: "flex flex-1 items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90",
                  children: /* @__PURE__ */ jsx("span", { children: "Open" })
                }
              )
            ] })
          ]
        }
      )
    }
  );
}
const linkSafety = {
  enabled: true,
  renderModal: (props) => /* @__PURE__ */ jsx(LinkSafetyModal, { ...props })
};
const TOOL_DISPLAY_NAMES = {
  create_job: "Create Job",
  get_job_status: "Check Job Status",
  get_system_technical_specs: "Read Tech Docs",
  get_skill_building_guide: "Read Skill Docs",
  start_coding: "Start Coding",
  get_repository_details: "Get Repository Details"
};
function getToolDisplayName(toolName) {
  return TOOL_DISPLAY_NAMES[toolName] || toolName.replace(/_/g, " ");
}
function formatContent(content) {
  if (content == null) return null;
  if (typeof content === "string") {
    try {
      const parsed = JSON.parse(content);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return content;
    }
  }
  return JSON.stringify(content, null, 2);
}
function ToolCall({ part }) {
  const [expanded, setExpanded] = useState(false);
  const toolName = part.toolName || (part.type?.startsWith("tool-") ? part.type.slice(5) : "tool");
  const displayName = getToolDisplayName(toolName);
  const state = part.state || "input-available";
  const isRunning = state === "input-streaming" || state === "input-available";
  const isDone = state === "output-available";
  const isError = state === "output-error";
  const mountedDone = useRef(isDone);
  useEffect(() => {
    if (toolName !== "start_coding" || !isDone || mountedDone.current) return;
    try {
      const output = typeof part.output === "string" ? JSON.parse(part.output) : part.output;
      if (output?.success && output?.workspaceUrl) {
        window.location.href = output.workspaceUrl;
      }
    } catch {
    }
  }, [toolName, isDone, part.output]);
  return /* @__PURE__ */ jsxs("div", { className: "my-1 rounded-lg border border-border bg-background", children: [
    /* @__PURE__ */ jsxs(
      "button",
      {
        onClick: () => setExpanded(!expanded),
        className: "flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted/50 rounded-lg",
        children: [
          /* @__PURE__ */ jsx(WrenchIcon, { size: 14, className: "text-muted-foreground shrink-0" }),
          /* @__PURE__ */ jsx("span", { className: "font-medium text-foreground", children: displayName }),
          /* @__PURE__ */ jsxs("span", { className: "ml-auto flex items-center gap-1.5 text-xs text-muted-foreground", children: [
            isRunning && /* @__PURE__ */ jsxs(Fragment, { children: [
              /* @__PURE__ */ jsx(SpinnerIcon, { size: 12 }),
              /* @__PURE__ */ jsx("span", { children: "Running..." })
            ] }),
            isDone && /* @__PURE__ */ jsxs(Fragment, { children: [
              /* @__PURE__ */ jsx(CheckIcon, { size: 12, className: "text-green-500" }),
              /* @__PURE__ */ jsx("span", { children: "Done" })
            ] }),
            isError && /* @__PURE__ */ jsxs(Fragment, { children: [
              /* @__PURE__ */ jsx(XIcon, { size: 12, className: "text-red-500" }),
              /* @__PURE__ */ jsx("span", { children: "Error" })
            ] })
          ] }),
          /* @__PURE__ */ jsx(
            ChevronDownIcon,
            {
              size: 14,
              className: cn(
                "text-muted-foreground transition-transform shrink-0",
                expanded && "rotate-180"
              )
            }
          )
        ]
      }
    ),
    expanded && /* @__PURE__ */ jsxs("div", { className: "border-t border-border px-3 py-2 text-xs", children: [
      part.input != null && /* @__PURE__ */ jsxs("div", { className: "mb-2", children: [
        /* @__PURE__ */ jsx("div", { className: "font-medium text-muted-foreground mb-1", children: "Input" }),
        /* @__PURE__ */ jsx("pre", { className: "whitespace-pre-wrap break-all rounded bg-muted p-2 text-foreground overflow-x-auto", children: formatContent(part.input) })
      ] }),
      part.output != null && /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsx("div", { className: "font-medium text-muted-foreground mb-1", children: "Output" }),
        /* @__PURE__ */ jsx("pre", { className: "whitespace-pre-wrap break-all rounded bg-muted p-2 text-foreground overflow-x-auto max-h-64 overflow-y-auto", children: formatContent(part.output) })
      ] }),
      part.input == null && part.output == null && /* @__PURE__ */ jsx("div", { className: "text-muted-foreground italic", children: "Waiting for data..." })
    ] })
  ] });
}
function PreviewMessage({ message, isLoading, onRetry, onEdit }) {
  const isUser = message.role === "user";
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState("");
  const textareaRef = useRef(null);
  const text = message.parts?.filter((p) => p.type === "text").map((p) => p.text).join("\n") || message.content || "";
  const fileParts = message.parts?.filter((p) => p.type === "file") || [];
  const imageParts = fileParts.filter((p) => p.mediaType?.startsWith("image/"));
  const otherFileParts = fileParts.filter((p) => !p.mediaType?.startsWith("image/"));
  const hasToolParts = message.parts?.some((p) => p.type?.startsWith("tool-")) || false;
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2e3);
    } catch {
    }
  };
  const handleEditStart = () => {
    setEditText(text);
    setEditing(true);
  };
  const handleEditCancel = () => {
    setEditing(false);
    setEditText("");
  };
  const handleEditSubmit = () => {
    const trimmed = editText.trim();
    if (trimmed && trimmed !== text) {
      onEdit?.(message, trimmed);
    }
    setEditing(false);
    setEditText("");
  };
  useEffect(() => {
    if (editing && textareaRef.current) {
      const ta = textareaRef.current;
      ta.focus();
      ta.style.height = "auto";
      ta.style.height = `${ta.scrollHeight}px`;
      ta.setSelectionRange(ta.value.length, ta.value.length);
    }
  }, [editing]);
  return /* @__PURE__ */ jsx(
    "div",
    {
      className: cn(
        "group flex gap-4 w-full",
        isUser ? "justify-end" : "justify-start"
      ),
      children: /* @__PURE__ */ jsx("div", { className: cn("flex flex-col", isUser ? "max-w-[80%]" : "w-full"), children: editing ? /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-2", children: [
        /* @__PURE__ */ jsx(
          "textarea",
          {
            ref: textareaRef,
            value: editText,
            onChange: (e) => {
              setEditText(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = `${e.target.scrollHeight}px`;
            },
            onKeyDown: (e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleEditSubmit();
              }
              if (e.key === "Escape") {
                handleEditCancel();
              }
            },
            className: "w-full resize-none rounded-xl border border-border bg-muted px-4 py-3 text-sm leading-relaxed text-foreground focus:outline-none focus:ring-1 focus:ring-primary",
            rows: 1
          }
        ),
        /* @__PURE__ */ jsxs("div", { className: "flex justify-end gap-2", children: [
          /* @__PURE__ */ jsx(
            "button",
            {
              onClick: handleEditCancel,
              className: "rounded-md px-3 py-1 text-xs text-muted-foreground hover:text-foreground",
              children: "Cancel"
            }
          ),
          /* @__PURE__ */ jsx(
            "button",
            {
              onClick: handleEditSubmit,
              className: "rounded-md bg-primary px-3 py-1 text-xs text-primary-foreground hover:opacity-80",
              children: "Send"
            }
          )
        ] })
      ] }) : /* @__PURE__ */ jsxs(Fragment, { children: [
        /* @__PURE__ */ jsx(
          "div",
          {
            className: cn(
              "text-sm leading-relaxed",
              isUser ? "rounded-xl px-4 py-3 bg-muted text-foreground" : "text-foreground"
            ),
            children: isUser ? /* @__PURE__ */ jsxs(Fragment, { children: [
              imageParts.length > 0 && /* @__PURE__ */ jsx("div", { className: "mb-2 flex flex-wrap gap-2", children: imageParts.map((part, i) => /* @__PURE__ */ jsx(
                "img",
                {
                  src: part.url,
                  alt: "attachment",
                  className: "max-h-64 max-w-full rounded-lg object-contain"
                },
                i
              )) }),
              otherFileParts.length > 0 && /* @__PURE__ */ jsx("div", { className: "mb-2 flex flex-wrap gap-2", children: otherFileParts.map((part, i) => /* @__PURE__ */ jsxs(
                "div",
                {
                  className: "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs bg-foreground/10",
                  children: [
                    /* @__PURE__ */ jsx(FileTextIcon, { size: 12 }),
                    /* @__PURE__ */ jsx("span", { className: "max-w-[150px] truncate", children: part.name || part.mediaType || "file" })
                  ]
                },
                i
              )) }),
              text ? /* @__PURE__ */ jsx("div", { className: "whitespace-pre-wrap break-words", children: text }) : null
            ] }) : /* @__PURE__ */ jsx(Fragment, { children: message.parts?.length > 0 ? message.parts.map((part, i) => {
              if (part.type === "text") {
                return /* @__PURE__ */ jsx(Streamdown, { mode: isLoading ? "streaming" : "static", linkSafety, children: part.text }, i);
              }
              if (part.type === "file") {
                if (part.mediaType?.startsWith("image/")) {
                  return /* @__PURE__ */ jsx("div", { className: "mb-2", children: /* @__PURE__ */ jsx("img", { src: part.url, alt: "attachment", className: "max-h-64 max-w-full rounded-lg object-contain" }) }, i);
                }
                return /* @__PURE__ */ jsxs("div", { className: "mb-2 inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs bg-foreground/10", children: [
                  /* @__PURE__ */ jsx(FileTextIcon, { size: 12 }),
                  /* @__PURE__ */ jsx("span", { className: "max-w-[150px] truncate", children: part.name || part.mediaType || "file" })
                ] }, i);
              }
              if (part.type?.startsWith("tool-")) {
                return /* @__PURE__ */ jsx(ToolCall, { part }, part.toolCallId || i);
              }
              return null;
            }) : text ? /* @__PURE__ */ jsx(Streamdown, { mode: isLoading ? "streaming" : "static", linkSafety, children: text }) : isLoading && !hasToolParts ? /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2 text-muted-foreground", children: [
              /* @__PURE__ */ jsx(SpinnerIcon, { size: 14 }),
              /* @__PURE__ */ jsx("span", { children: "Working..." })
            ] }) : null })
          }
        ),
        !isLoading && text && /* @__PURE__ */ jsxs(
          "div",
          {
            className: cn(
              "flex gap-1 mt-1 opacity-0 transition-opacity group-hover:opacity-100",
              isUser ? "justify-end" : "justify-start"
            ),
            children: [
              /* @__PURE__ */ jsx(
                "button",
                {
                  onClick: handleCopy,
                  className: "rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-muted",
                  "aria-label": "Copy message",
                  children: copied ? /* @__PURE__ */ jsx(CheckIcon, { size: 14 }) : /* @__PURE__ */ jsx(CopyIcon, { size: 14 })
                }
              ),
              onRetry && /* @__PURE__ */ jsx(
                "button",
                {
                  onClick: () => onRetry(message),
                  className: "rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-muted",
                  "aria-label": "Retry",
                  children: /* @__PURE__ */ jsx(RefreshIcon, { size: 14 })
                }
              ),
              isUser && onEdit && /* @__PURE__ */ jsx(
                "button",
                {
                  onClick: handleEditStart,
                  className: "rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-muted",
                  "aria-label": "Edit message",
                  children: /* @__PURE__ */ jsx(SquarePenIcon, { size: 14 })
                }
              )
            ]
          }
        )
      ] }) })
    }
  );
}
function ThinkingMessage() {
  return /* @__PURE__ */ jsx("div", { className: "flex gap-4 w-full justify-start", children: /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground", children: [
    /* @__PURE__ */ jsx(SpinnerIcon, { size: 14 }),
    /* @__PURE__ */ jsx("span", { children: "Thinking..." })
  ] }) });
}
export {
  PreviewMessage,
  ThinkingMessage,
  linkSafety
};
