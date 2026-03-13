"use client";
import { jsx } from "react/jsx-runtime";
import { cn } from "../../utils.js";
function ScrollArea({ children, className, ...props }) {
  return /* @__PURE__ */ jsx("div", { className: cn("relative overflow-hidden", className), ...props, children: /* @__PURE__ */ jsx("div", { className: "h-full w-full overflow-y-auto scrollbar-thin", children }) });
}
function ScrollBar() {
  return null;
}
export {
  ScrollArea,
  ScrollBar
};
