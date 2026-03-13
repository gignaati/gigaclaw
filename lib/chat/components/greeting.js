"use client";
import { jsx, jsxs } from "react/jsx-runtime";
function Greeting({ codeMode = false }) {
  return /* @__PURE__ */ jsxs("div", { className: "w-full text-center", children: [
    /* @__PURE__ */ jsx("div", { className: "font-semibold text-2xl md:text-3xl text-foreground", children: codeMode ? "How can I help you code today?" : "Hello! How can I help?" }),
    codeMode && /* @__PURE__ */ jsx("div", { className: "mt-2 text-sm text-muted-foreground", children: "Discuss your project and let me know when you're ready to start coding." })
  ] });
}
export {
  Greeting
};
