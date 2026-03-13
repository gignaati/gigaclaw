"use client";
import { jsx, jsxs } from "react/jsx-runtime";
import { createContext, useContext, useEffect } from "react";
import { cn } from "../../utils.js";
const SheetContext = createContext({ open: false, onOpenChange: () => {
} });
function Sheet({ children, open, onOpenChange }) {
  return /* @__PURE__ */ jsx(SheetContext.Provider, { value: { open, onOpenChange }, children });
}
function SheetTrigger({ children, asChild, ...props }) {
  const { onOpenChange } = useContext(SheetContext);
  if (asChild && children) {
    return /* @__PURE__ */ jsx("span", { onClick: () => onOpenChange(true), ...props, children });
  }
  return /* @__PURE__ */ jsx("button", { onClick: () => onOpenChange(true), ...props, children });
}
function SheetContent({ children, className, side = "left", ...props }) {
  const { open, onOpenChange } = useContext(SheetContext);
  useEffect(() => {
    if (!open) return;
    const handleEsc = (e) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [open, onOpenChange]);
  if (!open) return null;
  return /* @__PURE__ */ jsxs("div", { className: "fixed inset-0 z-50", children: [
    /* @__PURE__ */ jsx(
      "div",
      {
        className: "fixed inset-0 bg-black/50",
        onClick: () => onOpenChange(false)
      }
    ),
    /* @__PURE__ */ jsx(
      "div",
      {
        className: cn(
          "fixed z-50 bg-background shadow-lg transition-transform",
          side === "left" && "inset-y-0 left-0 w-3/4 max-w-sm border-r border-border",
          side === "right" && "inset-y-0 right-0 w-3/4 max-w-sm border-l border-border",
          className
        ),
        ...props,
        children
      }
    )
  ] });
}
function SheetHeader({ children, className }) {
  return /* @__PURE__ */ jsx("div", { className: cn("flex flex-col space-y-2 p-4", className), children });
}
function SheetTitle({ children, className }) {
  return /* @__PURE__ */ jsx("h2", { className: cn("text-lg font-semibold text-foreground", className), children });
}
function SheetDescription({ children, className }) {
  return /* @__PURE__ */ jsx("p", { className: cn("text-sm text-muted-foreground", className), children });
}
function SheetClose({ children, asChild, ...props }) {
  const { onOpenChange } = useContext(SheetContext);
  if (asChild && children) {
    return /* @__PURE__ */ jsx("span", { onClick: () => onOpenChange(false), ...props, children });
  }
  return /* @__PURE__ */ jsx("button", { onClick: () => onOpenChange(false), ...props, children });
}
export {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger
};
