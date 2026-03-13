"use client";
import { jsx } from "react/jsx-runtime";
import { cn } from "../../utils.js";
function Separator({ className, orientation = "horizontal", ...props }) {
  return /* @__PURE__ */ jsx(
    "div",
    {
      role: "separator",
      "aria-orientation": orientation,
      className: cn(
        "shrink-0 bg-border",
        orientation === "horizontal" ? "h-[1px] w-full" : "h-full w-[1px]",
        className
      ),
      ...props
    }
  );
}
export {
  Separator
};
