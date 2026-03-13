"use client";
import { jsx, jsxs } from "react/jsx-runtime";
import dynamic from "next/dynamic";
import { AppSidebar } from "../chat/components/app-sidebar.js";
import { SidebarProvider, SidebarInset } from "../chat/components/ui/sidebar.js";
import { ChatNavProvider } from "../chat/components/chat-nav-context.js";
import { ChatHeader } from "../chat/components/chat-header.js";
const TerminalView = dynamic(() => import("./terminal-view.js"), { ssr: false });
function CodePage({ session, codeWorkspaceId }) {
  return /* @__PURE__ */ jsx(ChatNavProvider, { value: { activeChatId: null, navigateToChat: (id) => {
    window.location.href = id ? `/chat/${id}` : "/";
  } }, children: /* @__PURE__ */ jsxs(SidebarProvider, { children: [
    /* @__PURE__ */ jsx(AppSidebar, { user: session.user }),
    /* @__PURE__ */ jsx(SidebarInset, { children: /* @__PURE__ */ jsxs("div", { className: "flex h-svh flex-col overflow-hidden", children: [
      /* @__PURE__ */ jsx(ChatHeader, { workspaceId: codeWorkspaceId }),
      /* @__PURE__ */ jsx(TerminalView, { codeWorkspaceId })
    ] }) })
  ] }) });
}
export {
  CodePage as default
};
