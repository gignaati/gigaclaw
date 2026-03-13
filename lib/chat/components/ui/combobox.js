"use client";
import { jsx, jsxs } from "react/jsx-runtime";
import { useState, useRef, useEffect, useCallback } from "react";
import { ChevronDownIcon, CheckIcon, SearchIcon } from "../icons.js";
import { cn } from "../../utils.js";
function Combobox({ options = [], value, onChange, placeholder = "Select...", loading = false, disabled = false }) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const ref = useRef(null);
  const inputRef = useRef(null);
  const selectedLabel = options.find((o) => o.value === value)?.label || "";
  const filtered = filter ? options.filter((o) => o.label.toLowerCase().includes(filter.toLowerCase())) : options;
  useEffect(() => {
    if (!open) return;
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
        setFilter("");
      }
    };
    const handleEsc = (e) => {
      if (e.key === "Escape") {
        setOpen(false);
        setFilter("");
      }
    };
    setTimeout(() => document.addEventListener("click", handleClick), 0);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("click", handleClick);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [open]);
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);
  const handleSelect = useCallback((val) => {
    onChange(val);
    setOpen(false);
    setFilter("");
  }, [onChange]);
  return /* @__PURE__ */ jsxs("div", { ref, className: "relative", children: [
    /* @__PURE__ */ jsxs(
      "button",
      {
        type: "button",
        disabled,
        onClick: () => !disabled && setOpen(!open),
        className: cn(
          "flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition-colors w-full",
          disabled ? "border-border bg-muted text-muted-foreground cursor-not-allowed opacity-60" : "border-border bg-background text-foreground hover:bg-muted cursor-pointer"
        ),
        children: [
          /* @__PURE__ */ jsx("span", { className: cn("flex-1 text-left truncate", !value && "text-muted-foreground"), children: value ? selectedLabel : placeholder }),
          /* @__PURE__ */ jsx(ChevronDownIcon, { size: 14, className: cn("text-muted-foreground transition-transform shrink-0", open && "rotate-180") })
        ]
      }
    ),
    open && /* @__PURE__ */ jsxs("div", { className: "absolute z-50 mt-1 w-full min-w-[200px] overflow-hidden rounded-lg border border-border bg-background shadow-lg", children: [
      /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2 border-b border-border px-3 py-2", children: [
        /* @__PURE__ */ jsx(SearchIcon, { size: 14, className: "text-muted-foreground shrink-0" }),
        /* @__PURE__ */ jsx(
          "input",
          {
            ref: inputRef,
            type: "text",
            value: filter,
            onChange: (e) => setFilter(e.target.value),
            placeholder: "Search...",
            className: "flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          }
        )
      ] }),
      /* @__PURE__ */ jsx("div", { className: "max-h-[200px] overflow-y-auto p-1", children: loading ? /* @__PURE__ */ jsx("div", { className: "px-3 py-2 text-sm text-muted-foreground", children: "Loading..." }) : filtered.length === 0 ? /* @__PURE__ */ jsx("div", { className: "px-3 py-2 text-sm text-muted-foreground", children: "No results" }) : filtered.map((opt) => /* @__PURE__ */ jsxs(
        "button",
        {
          type: "button",
          onClick: () => handleSelect(opt.value),
          className: cn(
            "flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-sm text-left transition-colors",
            "hover:bg-muted",
            opt.value === value && "bg-muted"
          ),
          children: [
            /* @__PURE__ */ jsx("span", { className: "flex-1 truncate", children: opt.label }),
            opt.value === value && /* @__PURE__ */ jsx(CheckIcon, { size: 14, className: "text-foreground shrink-0" })
          ]
        },
        opt.value
      )) })
    ] })
  ] });
}
export {
  Combobox
};
