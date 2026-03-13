"use client";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { WrenchIcon, SpinnerIcon, CheckIcon, XIcon, ChevronDownIcon } from "./icons.js";
import { cn } from "../utils.js";
const TOOL_DISPLAY_NAMES = {
  create_job: "Create Job",
  get_job_status: "Check Job Status",
  get_system_technical_specs: "Read Tech Docs",
  get_skill_building_guide: "Read Skill Docs",
  get_skill_details: "Get Skill",
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
export {
  ToolCall
};
