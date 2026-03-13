"use client";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { useState, useEffect } from "react";
import { ZapIcon, ChevronDownIcon } from "./icons.js";
import { getSwarmConfig } from "../actions.js";
const typeBadgeStyles = {
  agent: "bg-purple-500/10 text-purple-500",
  command: "bg-blue-500/10 text-blue-500",
  webhook: "bg-orange-500/10 text-orange-500"
};
const typeOrder = { agent: 0, command: 1, webhook: 2 };
function sortByType(items) {
  return [...items].sort((a, b) => {
    const actions_a = a.actions || [];
    const actions_b = b.actions || [];
    const ta = typeOrder[actions_a[0]?.type || "agent"] ?? 99;
    const tb = typeOrder[actions_b[0]?.type || "agent"] ?? 99;
    return ta - tb;
  });
}
function GroupHeader({ label, count }) {
  return /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2 pt-2 pb-1", children: [
    /* @__PURE__ */ jsx("span", { className: "text-xs font-medium text-muted-foreground uppercase tracking-wide", children: label }),
    /* @__PURE__ */ jsxs("span", { className: "text-xs text-muted-foreground", children: [
      "(",
      count,
      ")"
    ] })
  ] });
}
function ActionCard({ action, index }) {
  const type = action.type || "agent";
  return /* @__PURE__ */ jsxs("div", { className: "rounded-md border bg-background p-3", children: [
    /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2 mb-2", children: [
      /* @__PURE__ */ jsxs("span", { className: "text-xs text-muted-foreground font-medium", children: [
        "Action ",
        index + 1
      ] }),
      /* @__PURE__ */ jsx("span", { className: `inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${typeBadgeStyles[type] || typeBadgeStyles.agent}`, children: type })
    ] }),
    type === "agent" && action.job && /* @__PURE__ */ jsxs("div", { children: [
      /* @__PURE__ */ jsx("pre", { className: "text-xs bg-muted rounded-md p-3 whitespace-pre-wrap break-words font-mono overflow-auto max-h-48", children: action.job }),
      (action.llm_provider || action.llm_model) && /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2 mt-2", children: [
        /* @__PURE__ */ jsx("span", { className: "text-xs font-medium text-muted-foreground", children: "LLM:" }),
        /* @__PURE__ */ jsx("span", { className: "inline-flex items-center rounded-full bg-purple-500/10 text-purple-500 px-2 py-0.5 text-[10px] font-medium", children: [action.llm_provider, action.llm_model].filter(Boolean).join(" / ") })
      ] })
    ] }),
    type === "command" && action.command && /* @__PURE__ */ jsx("pre", { className: "text-xs bg-muted rounded-md p-3 whitespace-pre-wrap break-words font-mono overflow-auto max-h-48", children: action.command }),
    type === "webhook" && /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-2", children: [
      /* @__PURE__ */ jsxs("pre", { className: "text-xs bg-muted rounded-md p-3 whitespace-pre-wrap break-words font-mono overflow-auto", children: [
        action.method && action.method !== "POST" ? `${action.method} ` : "",
        action.url
      ] }),
      action.vars && Object.keys(action.vars).length > 0 && /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsx("p", { className: "text-xs font-medium text-muted-foreground mb-1", children: "Variables" }),
        /* @__PURE__ */ jsx("pre", { className: "text-xs bg-muted rounded-md p-3 whitespace-pre-wrap break-words font-mono overflow-auto max-h-48", children: JSON.stringify(action.vars, null, 2) })
      ] })
    ] })
  ] });
}
function TriggerCard({ trigger }) {
  const [expanded, setExpanded] = useState(false);
  const disabled = trigger.enabled === false;
  const actions = trigger.actions || [];
  const actionTypes = actions.map((a) => a.type || "agent").filter((v, i, arr) => arr.indexOf(v) === i);
  return /* @__PURE__ */ jsxs(
    "div",
    {
      className: `rounded-lg border bg-card transition-opacity ${disabled ? "opacity-60" : ""}`,
      children: [
        /* @__PURE__ */ jsxs(
          "button",
          {
            onClick: () => setExpanded(!expanded),
            className: "flex items-center gap-3 w-full text-left p-4 hover:bg-accent/50 rounded-lg",
            children: [
              /* @__PURE__ */ jsx("div", { className: "shrink-0 rounded-md bg-muted p-2", children: /* @__PURE__ */ jsx(ZapIcon, { size: 16 }) }),
              /* @__PURE__ */ jsxs("div", { className: "flex-1 min-w-0", children: [
                /* @__PURE__ */ jsx("p", { className: "text-sm font-medium truncate", children: trigger.name }),
                /* @__PURE__ */ jsxs("p", { className: "text-xs text-muted-foreground mt-0.5", children: [
                  /* @__PURE__ */ jsx("span", { className: "font-mono", children: trigger.watch_path }),
                  /* @__PURE__ */ jsx("span", { className: "mx-1.5 text-border", children: "|" }),
                  actions.length,
                  " action",
                  actions.length !== 1 ? "s" : "",
                  actionTypes.length > 0 && /* @__PURE__ */ jsxs("span", { className: "ml-1", children: [
                    "(",
                    actionTypes.join(", "),
                    ")"
                  ] })
                ] })
              ] }),
              /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2 shrink-0", children: [
                /* @__PURE__ */ jsx(
                  "span",
                  {
                    className: `inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${disabled ? "bg-muted text-muted-foreground" : "bg-green-500/10 text-green-500"}`,
                    children: disabled ? "disabled" : "enabled"
                  }
                ),
                /* @__PURE__ */ jsx("span", { className: `transition-transform ${expanded ? "rotate-180" : ""}`, children: /* @__PURE__ */ jsx(ChevronDownIcon, { size: 14 }) })
              ] })
            ]
          }
        ),
        expanded && /* @__PURE__ */ jsx("div", { className: "border-t px-4 py-3 flex flex-col gap-2", children: actions.length === 0 ? /* @__PURE__ */ jsx("p", { className: "text-xs text-muted-foreground", children: "No actions defined." }) : actions.map((action, i) => /* @__PURE__ */ jsx(ActionCard, { action, index: i }, i)) })
      ]
    }
  );
}
function TriggersPage() {
  const [triggers, setTriggers] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    getSwarmConfig().then((data) => {
      if (data?.triggers) setTriggers(data.triggers);
    }).catch(() => {
    }).finally(() => setLoading(false));
  }, []);
  const enabled = sortByType(triggers.filter((t) => t.enabled !== false));
  const disabled = sortByType(triggers.filter((t) => t.enabled === false));
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    !loading && /* @__PURE__ */ jsxs("p", { className: "text-sm text-muted-foreground mb-4", children: [
      triggers.length,
      " trigger",
      triggers.length !== 1 ? "s" : "",
      " configured, ",
      enabled.length,
      " enabled"
    ] }),
    loading ? /* @__PURE__ */ jsx("div", { className: "flex flex-col gap-3", children: [...Array(3)].map((_, i) => /* @__PURE__ */ jsx("div", { className: "h-20 animate-pulse rounded-lg bg-border/50" }, i)) }) : triggers.length === 0 ? /* @__PURE__ */ jsxs("div", { className: "flex flex-col items-center justify-center py-16 text-center", children: [
      /* @__PURE__ */ jsx("div", { className: "rounded-full bg-muted p-4 mb-4", children: /* @__PURE__ */ jsx(ZapIcon, { size: 24 }) }),
      /* @__PURE__ */ jsx("p", { className: "text-sm font-medium mb-1", children: "No triggers configured" }),
      /* @__PURE__ */ jsxs("p", { className: "text-xs text-muted-foreground max-w-sm", children: [
        "Add webhook triggers by editing ",
        /* @__PURE__ */ jsx("span", { className: "font-mono", children: "config/TRIGGERS.json" }),
        " in your project."
      ] })
    ] }) : /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-3", children: [
      enabled.length > 0 && /* @__PURE__ */ jsxs(Fragment, { children: [
        /* @__PURE__ */ jsx(GroupHeader, { label: "Enabled", count: enabled.length }),
        enabled.map((trigger, i) => /* @__PURE__ */ jsx(TriggerCard, { trigger }, `enabled-${i}`))
      ] }),
      disabled.length > 0 && /* @__PURE__ */ jsxs(Fragment, { children: [
        /* @__PURE__ */ jsx(GroupHeader, { label: "Disabled", count: disabled.length }),
        disabled.map((trigger, i) => /* @__PURE__ */ jsx(TriggerCard, { trigger }, `disabled-${i}`))
      ] })
    ] })
  ] });
}
export {
  TriggersPage
};
