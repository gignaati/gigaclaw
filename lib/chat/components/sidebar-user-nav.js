"use client";
import { jsx, jsxs } from "react/jsx-runtime";
import { signOut } from "next-auth/react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "./ui/dropdown-menu.js";
import { SidebarMenu, SidebarMenuItem, SidebarMenuButton } from "./ui/sidebar.js";
import { SettingsIcon, SunIcon, MoonIcon, BugIcon, LogOutIcon } from "./icons.js";
import { cn } from "../utils.js";
function SidebarUserNav({ user, collapsed }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return /* @__PURE__ */ jsx(SidebarMenu, { children: /* @__PURE__ */ jsx(SidebarMenuItem, { children: /* @__PURE__ */ jsxs(DropdownMenu, { children: [
    /* @__PURE__ */ jsx(DropdownMenuTrigger, { asChild: true, children: /* @__PURE__ */ jsxs(SidebarMenuButton, { className: cn("bg-background text-foreground hover:bg-muted", collapsed ? "justify-center" : "justify-between"), children: [
      /* @__PURE__ */ jsxs("div", { className: cn("flex items-center overflow-hidden", collapsed ? "" : "gap-2"), children: [
        /* @__PURE__ */ jsx("div", { className: "flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-medium", children: (user?.email?.[0] || "U").toUpperCase() }),
        !collapsed && /* @__PURE__ */ jsx("span", { className: "truncate text-sm", children: user?.email || "User" })
      ] }),
      !collapsed && /* @__PURE__ */ jsxs("svg", { className: "size-4 text-muted-foreground", width: 16, height: 16, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, children: [
        /* @__PURE__ */ jsx("path", { d: "m7 15 5 5 5-5" }),
        /* @__PURE__ */ jsx("path", { d: "m7 9 5-5 5 5" })
      ] })
    ] }) }),
    /* @__PURE__ */ jsxs(DropdownMenuContent, { align: "start", side: "top", className: "w-56", children: [
      /* @__PURE__ */ jsx(DropdownMenuItem, { asChild: true, children: /* @__PURE__ */ jsxs("a", { href: "/settings", className: "flex items-center gap-2", style: { textDecoration: "inherit", color: "inherit" }, children: [
        /* @__PURE__ */ jsx(SettingsIcon, { size: 14 }),
        /* @__PURE__ */ jsx("span", { children: "Settings" })
      ] }) }),
      mounted && /* @__PURE__ */ jsxs(DropdownMenuItem, { onClick: () => setTheme(theme === "dark" ? "light" : "dark"), children: [
        theme === "dark" ? /* @__PURE__ */ jsx(SunIcon, { size: 14 }) : /* @__PURE__ */ jsx(MoonIcon, { size: 14 }),
        /* @__PURE__ */ jsx("span", { children: theme === "dark" ? "Light Mode" : "Dark Mode" })
      ] }),
      /* @__PURE__ */ jsx(DropdownMenuItem, { asChild: true, children: /* @__PURE__ */ jsxs("a", { href: "https://github.com/gignaati/gigabot/issues", target: "_blank", rel: "noopener noreferrer", className: "flex items-center gap-2", style: { textDecoration: "inherit", color: "inherit" }, children: [
        /* @__PURE__ */ jsx(BugIcon, { size: 14 }),
        /* @__PURE__ */ jsx("span", { children: "Report Issues" })
      ] }) }),
      /* @__PURE__ */ jsx(DropdownMenuSeparator, {}),
      /* @__PURE__ */ jsxs(
        DropdownMenuItem,
        {
          onClick: () => signOut({ callbackUrl: "/" }),
          className: "text-destructive",
          children: [
            /* @__PURE__ */ jsx(LogOutIcon, { size: 14 }),
            /* @__PURE__ */ jsx("span", { children: "Sign Out" })
          ]
        }
      )
    ] })
  ] }) }) });
}
export {
  SidebarUserNav
};
