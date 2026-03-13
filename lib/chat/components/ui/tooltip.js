"use client";
import { jsx } from "react/jsx-runtime";
import { useState, useRef, useEffect, createContext, useContext, cloneElement } from "react";
import { cn } from "../../utils.js";
const TooltipContext = createContext({ open: false });
function TooltipProvider({ children, delayDuration = 200 }) {
  return children;
}
function Tooltip({ children }) {
  const [open, setOpen] = useState(false);
  const timeoutRef = useRef(null);
  const handleOpen = () => {
    timeoutRef.current = setTimeout(() => setOpen(true), 200);
  };
  const handleClose = () => {
    clearTimeout(timeoutRef.current);
    setOpen(false);
  };
  useEffect(() => () => clearTimeout(timeoutRef.current), []);
  return /* @__PURE__ */ jsx(TooltipContext.Provider, { value: { open, handleOpen, handleClose }, children: /* @__PURE__ */ jsx("div", { className: "relative inline-flex", onMouseEnter: handleOpen, onMouseLeave: handleClose, children }) });
}
function TooltipTrigger({ children, asChild }) {
  if (asChild && children) {
    return children;
  }
  return children;
}
function TooltipContent({ children, className, align = "center", side = "bottom", ...props }) {
  const { open } = useContext(TooltipContext);
  if (!open) return null;
  return /* @__PURE__ */ jsx(
    "div",
    {
      className: cn(
        "absolute z-50 overflow-hidden rounded-md border border-border bg-muted px-3 py-1.5 text-sm text-foreground shadow-md",
        "animate-in fade-in-0 zoom-in-95",
        side === "bottom" && "top-full mt-1",
        side === "top" && "bottom-full mb-1",
        side === "right" && "left-full ml-1 top-1/2 -translate-y-1/2",
        side === "left" && "right-full mr-1 top-1/2 -translate-y-1/2",
        side !== "right" && side !== "left" && align === "center" && "left-1/2 -translate-x-1/2",
        side !== "right" && side !== "left" && align === "end" && "right-0",
        side !== "right" && side !== "left" && align === "start" && "left-0",
        className
      ),
      ...props,
      children
    }
  );
}
export {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
};
