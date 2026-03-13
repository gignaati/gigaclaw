"use client";
import { jsx, jsxs } from "react/jsx-runtime";
import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
function RenameDialog({ open, onSave, onCancel, title = "Rename chat", currentValue = "" }) {
  const [value, setValue] = useState(currentValue);
  const inputRef = useRef(null);
  useEffect(() => {
    if (open) {
      setValue(currentValue);
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.select();
        }
      }, 0);
    }
  }, [open, currentValue]);
  useEffect(() => {
    if (!open) return;
    const handleEsc = (e) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [open, onCancel]);
  const handleSave = () => {
    const trimmed = value.trim();
    if (trimmed && trimmed !== currentValue) {
      onSave(trimmed);
    }
    onCancel();
  };
  if (!open) return null;
  return createPortal(
    /* @__PURE__ */ jsxs("div", { className: "fixed inset-0 z-50 flex items-center justify-center", children: [
      /* @__PURE__ */ jsx("div", { className: "fixed inset-0 bg-black/50", onClick: onCancel }),
      /* @__PURE__ */ jsxs("div", { className: "relative z-50 w-full max-w-sm rounded-lg border border-border bg-background p-6 shadow-lg", onClick: (e) => e.stopPropagation(), children: [
        /* @__PURE__ */ jsx("h3", { className: "text-lg font-semibold", children: title }),
        /* @__PURE__ */ jsx(
          "input",
          {
            ref: inputRef,
            type: "text",
            value,
            onChange: (e) => setValue(e.target.value),
            onKeyDown: (e) => {
              if (e.key === "Enter") handleSave();
            },
            className: "mt-3 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          }
        ),
        /* @__PURE__ */ jsxs("div", { className: "mt-4 flex justify-end gap-2", children: [
          /* @__PURE__ */ jsx(
            "button",
            {
              onClick: onCancel,
              className: "rounded-md px-3 py-1.5 text-sm font-medium border border-input bg-background hover:bg-muted",
              children: "Cancel"
            }
          ),
          /* @__PURE__ */ jsx(
            "button",
            {
              onClick: handleSave,
              className: "rounded-md px-3 py-1.5 text-sm font-medium text-white bg-foreground hover:bg-foreground/90",
              children: "Save"
            }
          )
        ] })
      ] })
    ] }),
    document.body
  );
}
export {
  RenameDialog
};
