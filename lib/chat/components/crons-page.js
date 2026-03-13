"use client";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { useState, useEffect } from "react";
import { ClockIcon, SpinnerIcon, ChevronDownIcon } from "./icons.js";
import { getSwarmConfig } from "../actions.js";
function describeCron(schedule) {
  const parts = schedule.trim().split(/\s+/);
  if (parts.length !== 5) return schedule;
  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;
  if (minute.startsWith("*/") && hour === "*" && dayOfMonth === "*" && month === "*" && dayOfWeek === "*") {
    const n = parseInt(minute.slice(2), 10);
    if (n === 1) return "Every minute";
    return `Every ${n} minutes`;
  }
  if (hour.startsWith("*/") && dayOfMonth === "*" && month === "*" && dayOfWeek === "*") {
    const n = parseInt(hour.slice(2), 10);
    if (n === 1) return "Every hour";
    return `Every ${n} hours`;
  }
  if (minute !== "*" && hour !== "*" && !hour.includes("/") && !minute.includes("/") && dayOfMonth === "*" && month === "*" && dayOfWeek === "*") {
    const h = parseInt(hour, 10);
    const m = parseInt(minute, 10);
    const period = h >= 12 ? "PM" : "AM";
    const displayH = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `Daily at ${displayH}:${String(m).padStart(2, "0")} ${period}`;
  }
  if (minute !== "*" && hour !== "*" && dayOfMonth === "*" && month === "*" && dayOfWeek !== "*") {
    const dayNames = { "0": "Sun", "1": "Mon", "2": "Tue", "3": "Wed", "4": "Thu", "5": "Fri", "6": "Sat" };
    const days = dayOfWeek.split(",").map((d) => dayNames[d] || d).join(", ");
    const h = parseInt(hour, 10);
    const m = parseInt(minute, 10);
    const period = h >= 12 ? "PM" : "AM";
    const displayH = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${days} at ${displayH}:${String(m).padStart(2, "0")} ${period}`;
  }
  return schedule;
}
const typeBadgeStyles = {
  agent: "bg-purple-500/10 text-purple-500",
  command: "bg-blue-500/10 text-blue-500",
  webhook: "bg-orange-500/10 text-orange-500"
};
const typeOrder = { agent: 0, command: 1, webhook: 2 };
function sortByType(items) {
  return [...items].sort((a, b) => {
    const ta = typeOrder[a.type || "agent"] ?? 99;
    const tb = typeOrder[b.type || "agent"] ?? 99;
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
function CronCard({ cron }) {
  const [expanded, setExpanded] = useState(false);
  const type = cron.type || "agent";
  const disabled = cron.enabled === false;
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
              /* @__PURE__ */ jsx("div", { className: "shrink-0 rounded-md bg-muted p-2", children: /* @__PURE__ */ jsx(ClockIcon, { size: 16 }) }),
              /* @__PURE__ */ jsxs("div", { className: "flex-1 min-w-0", children: [
                /* @__PURE__ */ jsx("p", { className: "text-sm font-medium truncate", children: cron.name }),
                /* @__PURE__ */ jsxs("p", { className: "text-xs text-muted-foreground mt-0.5", children: [
                  /* @__PURE__ */ jsx("span", { className: "font-mono", children: cron.schedule }),
                  /* @__PURE__ */ jsx("span", { className: "mx-1.5 text-border", children: "|" }),
                  describeCron(cron.schedule)
                ] })
              ] }),
              /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2 shrink-0", children: [
                /* @__PURE__ */ jsx("span", { className: `inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${typeBadgeStyles[type] || typeBadgeStyles.agent}`, children: type }),
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
        expanded && /* @__PURE__ */ jsxs("div", { className: "border-t px-4 py-3", children: [
          type === "agent" && cron.job && /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("p", { className: "text-xs font-medium text-muted-foreground mb-1.5", children: "Job prompt" }),
            /* @__PURE__ */ jsx("pre", { className: "text-xs bg-muted rounded-md p-3 whitespace-pre-wrap break-words font-mono overflow-auto max-h-48", children: cron.job }),
            (cron.llm_provider || cron.llm_model) && /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2 mt-2", children: [
              /* @__PURE__ */ jsx("span", { className: "text-xs font-medium text-muted-foreground", children: "LLM:" }),
              /* @__PURE__ */ jsx("span", { className: "inline-flex items-center rounded-full bg-purple-500/10 text-purple-500 px-2 py-0.5 text-[10px] font-medium", children: [cron.llm_provider, cron.llm_model].filter(Boolean).join(" / ") })
            ] })
          ] }),
          type === "command" && cron.command && /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("p", { className: "text-xs font-medium text-muted-foreground mb-1.5", children: "Command" }),
            /* @__PURE__ */ jsx("pre", { className: "text-xs bg-muted rounded-md p-3 whitespace-pre-wrap break-words font-mono overflow-auto max-h-48", children: cron.command })
          ] }),
          type === "webhook" && /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-2", children: [
            /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsx("p", { className: "text-xs font-medium text-muted-foreground mb-1.5", children: "URL" }),
              /* @__PURE__ */ jsxs("pre", { className: "text-xs bg-muted rounded-md p-3 whitespace-pre-wrap break-words font-mono overflow-auto", children: [
                cron.method && cron.method !== "POST" ? `${cron.method} ` : "",
                cron.url
              ] })
            ] }),
            cron.vars && Object.keys(cron.vars).length > 0 && /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsx("p", { className: "text-xs font-medium text-muted-foreground mb-1.5", children: "Variables" }),
              /* @__PURE__ */ jsx("pre", { className: "text-xs bg-muted rounded-md p-3 whitespace-pre-wrap break-words font-mono overflow-auto max-h-48", children: JSON.stringify(cron.vars, null, 2) })
            ] })
          ] })
        ] })
      ]
    }
  );
}
function CronsPage() {
  const [crons, setCrons] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    getSwarmConfig().then((data) => {
      if (data?.crons) setCrons(data.crons);
    }).catch(() => {
    }).finally(() => setLoading(false));
  }, []);
  const enabled = sortByType(crons.filter((c) => c.enabled !== false));
  const disabled = sortByType(crons.filter((c) => c.enabled === false));
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    !loading && /* @__PURE__ */ jsxs("p", { className: "text-sm text-muted-foreground mb-4", children: [
      crons.length,
      " job",
      crons.length !== 1 ? "s" : "",
      " configured, ",
      enabled.length,
      " enabled"
    ] }),
    loading ? /* @__PURE__ */ jsx("div", { className: "flex flex-col gap-3", children: [...Array(3)].map((_, i) => /* @__PURE__ */ jsx("div", { className: "h-20 animate-pulse rounded-lg bg-border/50" }, i)) }) : crons.length === 0 ? /* @__PURE__ */ jsxs("div", { className: "flex flex-col items-center justify-center py-16 text-center", children: [
      /* @__PURE__ */ jsx("div", { className: "rounded-full bg-muted p-4 mb-4", children: /* @__PURE__ */ jsx(ClockIcon, { size: 24 }) }),
      /* @__PURE__ */ jsx("p", { className: "text-sm font-medium mb-1", children: "No cron jobs configured" }),
      /* @__PURE__ */ jsxs("p", { className: "text-xs text-muted-foreground max-w-sm", children: [
        "Add scheduled jobs by editing ",
        /* @__PURE__ */ jsx("span", { className: "font-mono", children: "config/CRONS.json" }),
        " in your project."
      ] })
    ] }) : /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-3", children: [
      enabled.length > 0 && /* @__PURE__ */ jsxs(Fragment, { children: [
        /* @__PURE__ */ jsx(GroupHeader, { label: "Enabled", count: enabled.length }),
        enabled.map((cron, i) => /* @__PURE__ */ jsx(CronCard, { cron }, `enabled-${i}`))
      ] }),
      disabled.length > 0 && /* @__PURE__ */ jsxs(Fragment, { children: [
        /* @__PURE__ */ jsx(GroupHeader, { label: "Disabled", count: disabled.length }),
        disabled.map((cron, i) => /* @__PURE__ */ jsx(CronCard, { cron }, `disabled-${i}`))
      ] })
    ] })
  ] });
}
export {
  CronsPage
};
