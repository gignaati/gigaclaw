"use client";
import { jsx, jsxs } from "react/jsx-runtime";
import { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { cn } from "../../utils.js";
import { Sheet, SheetContent } from "./sheet.js";
const SIDEBAR_WIDTH = "16rem";
const SIDEBAR_WIDTH_ICON = "3rem";
const SIDEBAR_WIDTH_MOBILE = "18rem";
const SIDEBAR_COOKIE_NAME = "sidebar:state";
const SIDEBAR_KEYBOARD_SHORTCUT = "b";
const SidebarContext = createContext(null);
function useSidebar() {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider");
  }
  return context;
}
function SidebarProvider({
  children,
  defaultOpen = true,
  open: openProp,
  onOpenChange: setOpenProp
}) {
  const [isMobile, setIsMobile] = useState(false);
  const [openMobile, setOpenMobile] = useState(false);
  const [_open, _setOpen] = useState(defaultOpen);
  const open = openProp !== void 0 ? openProp : _open;
  const setOpen = useCallback(
    (value) => {
      const newOpen = typeof value === "function" ? value(open) : value;
      if (setOpenProp) {
        setOpenProp(newOpen);
      } else {
        _setOpen(newOpen);
      }
      try {
        document.cookie = `${SIDEBAR_COOKIE_NAME}=${newOpen}; path=/; max-age=${60 * 60 * 24 * 7}`;
      } catch (e) {
      }
    },
    [setOpenProp, open]
  );
  const toggleSidebar = useCallback(() => {
    if (isMobile) {
      setOpenMobile((prev) => !prev);
    } else {
      setOpen((prev) => !prev);
    }
  }, [isMobile, setOpen]);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === SIDEBAR_KEYBOARD_SHORTCUT && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        toggleSidebar();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleSidebar]);
  const state = open ? "expanded" : "collapsed";
  const contextValue = useMemo(
    () => ({
      state,
      open,
      setOpen,
      isMobile,
      openMobile,
      setOpenMobile,
      toggleSidebar
    }),
    [state, open, setOpen, isMobile, openMobile, setOpenMobile, toggleSidebar]
  );
  return /* @__PURE__ */ jsx(SidebarContext.Provider, { value: contextValue, children: /* @__PURE__ */ jsx(
    "div",
    {
      className: "group/sidebar-wrapper flex min-h-svh w-full",
      style: {
        "--sidebar-width": SIDEBAR_WIDTH,
        "--sidebar-width-icon": SIDEBAR_WIDTH_ICON,
        "--sidebar-width-mobile": SIDEBAR_WIDTH_MOBILE
      },
      "data-sidebar-state": state,
      children
    }
  ) });
}
function Sidebar({ children, className, side = "left" }) {
  const { isMobile, open, openMobile, setOpenMobile } = useSidebar();
  if (isMobile) {
    return /* @__PURE__ */ jsx(Sheet, { open: openMobile, onOpenChange: setOpenMobile, children: /* @__PURE__ */ jsx(
      SheetContent,
      {
        side,
        className: cn("w-[var(--sidebar-width-mobile)] p-0 [&>button]:hidden", className),
        children: /* @__PURE__ */ jsx("div", { className: "flex h-full w-full flex-col", children })
      }
    ) });
  }
  return /* @__PURE__ */ jsx(
    "div",
    {
      className: cn(
        "sticky top-0 flex h-svh flex-col border-r border-border bg-muted transition-[width] duration-200",
        open ? "w-[var(--sidebar-width)]" : "w-[var(--sidebar-width-icon)]",
        className
      ),
      children: /* @__PURE__ */ jsx(
        "div",
        {
          className: cn(
            "flex h-full flex-col overflow-hidden",
            open ? "w-[var(--sidebar-width)]" : "w-[var(--sidebar-width-icon)]"
          ),
          children
        }
      )
    }
  );
}
function SidebarHeader({ children, className }) {
  return /* @__PURE__ */ jsx("div", { className: cn("flex flex-col gap-2 p-2", className), children });
}
function SidebarContent({ children, className }) {
  return /* @__PURE__ */ jsx("div", { className: cn("flex min-h-0 flex-1 flex-col overflow-y-auto", className), children });
}
function SidebarFooter({ children, className }) {
  return /* @__PURE__ */ jsx("div", { className: cn("flex flex-col gap-2 p-2", className), children });
}
function SidebarMenu({ children, className }) {
  return /* @__PURE__ */ jsx("ul", { className: cn("flex w-full min-w-0 flex-col gap-1", className), children });
}
function SidebarMenuItem({ children, className }) {
  return /* @__PURE__ */ jsx("li", { className: cn("group/menu-item relative", className), children });
}
function SidebarMenuButton({ children, className, isActive, asChild, tooltip, href, ...props }) {
  const Tag = asChild ? "span" : href ? "a" : "button";
  return /* @__PURE__ */ jsx(
    Tag,
    {
      className: cn(
        "flex w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm outline-none transition-colors",
        "hover:bg-background hover:text-foreground",
        isActive && "bg-background text-foreground font-medium",
        className
      ),
      ...href ? { href } : {},
      ...props,
      children
    }
  );
}
function SidebarGroup({ children, className }) {
  return /* @__PURE__ */ jsx("div", { className: cn("relative flex w-full min-w-0 flex-col p-2", className), children });
}
function SidebarGroupLabel({ children, className }) {
  return /* @__PURE__ */ jsx(
    "div",
    {
      className: cn(
        "flex h-8 shrink-0 items-center rounded-md px-2 text-xs font-medium text-muted-foreground",
        className
      ),
      children
    }
  );
}
function SidebarGroupContent({ children, className }) {
  return /* @__PURE__ */ jsx("div", { className: cn("w-full", className), children });
}
function SidebarInset({ children, className }) {
  return /* @__PURE__ */ jsx("main", { className: cn("relative flex min-h-svh flex-1 flex-col bg-background", className), children });
}
function SidebarTrigger({ className, ...props }) {
  const { toggleSidebar } = useSidebar();
  return /* @__PURE__ */ jsxs(
    "button",
    {
      className: cn(
        "inline-flex items-center justify-center rounded-md p-2 text-foreground hover:bg-muted",
        className
      ),
      onClick: toggleSidebar,
      ...props,
      children: [
        /* @__PURE__ */ jsxs("svg", { xmlns: "http://www.w3.org/2000/svg", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", className: "size-4", children: [
          /* @__PURE__ */ jsx("rect", { width: "18", height: "18", x: "3", y: "3", rx: "2" }),
          /* @__PURE__ */ jsx("path", { d: "M9 3v18" })
        ] }),
        /* @__PURE__ */ jsx("span", { className: "sr-only", children: "Toggle Sidebar" })
      ]
    }
  );
}
function SidebarRail() {
  const { toggleSidebar } = useSidebar();
  return /* @__PURE__ */ jsx(
    "button",
    {
      className: "absolute inset-y-0 right-0 w-1 cursor-col-resize hover:bg-border",
      onClick: toggleSidebar,
      "aria-label": "Toggle Sidebar"
    }
  );
}
export {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
  useSidebar
};
