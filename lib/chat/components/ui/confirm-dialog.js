"use client";
import { jsx, jsxs } from "react/jsx-runtime";
import { useEffect, useRef } from "react";
import { cn } from "../../utils.js";
function ConfirmDialog({ open, onConfirm, onCancel, title, description, confirmLabel = "Delete", cancelLabel = "Cancel", variant = "destructive" }) {
  const cancelRef = useRef(null);
  useEffect(() => {
    if (open && cancelRef.current) {
      cancelRef.current.focus();
    }
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const handleEsc = (e) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [open, onCancel]);
  if (!open) return null;
  return /* @__PURE__ */ jsxs("div", { className: "fixed inset-0 z-50 flex items-center justify-center", children: [
    /* @__PURE__ */ jsx("div", { className: "fixed inset-0 bg-black/50", onClick: onCancel }),
    /* @__PURE__ */ jsxs("div", { className: "relative z-50 w-full max-w-sm rounded-lg border border-border bg-background p-6 shadow-lg", onClick: (e) => e.stopPropagation(), children: [
      /* @__PURE__ */ jsx("h3", { className: "text-lg font-semibold", children: title }),
      description && /* @__PURE__ */ jsx("p", { className: "mt-2 text-sm text-muted-foreground", children: description }),
      /* @__PURE__ */ jsxs("div", { className: "mt-4 flex justify-end gap-2", children: [
        /* @__PURE__ */ jsx(
          "button",
          {
            ref: cancelRef,
            onClick: onCancel,
            className: "rounded-md px-3 py-1.5 text-sm font-medium border border-input bg-background hover:bg-muted",
            children: cancelLabel
          }
        ),
        /* @__PURE__ */ jsx(
          "button",
          {
            onClick: onConfirm,
            className: cn(
              "rounded-md px-3 py-1.5 text-sm font-medium text-white",
              variant === "destructive" ? "bg-destructive hover:bg-destructive/90" : "bg-foreground hover:bg-foreground/90"
            ),
            children: confirmLabel
          }
        )
      ] })
    ] })
  ] });
}
export {
  ConfirmDialog
};
