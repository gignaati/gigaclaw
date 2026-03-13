"use client";
import { jsx, jsxs } from "react/jsx-runtime";
import { AppSidebar } from "./app-sidebar.js";
import { SidebarProvider, SidebarInset } from "./ui/sidebar.js";
import { ChatNavProvider } from "./chat-nav-context.js";
function defaultNavigateToChat(id) {
  if (id) {
    window.location.href = `/chat/${id}`;
  } else {
    window.location.href = "/";
  }
}
function PageLayout({ session, children, contentClassName }) {
  return /* @__PURE__ */ jsx(ChatNavProvider, { value: { activeChatId: null, navigateToChat: defaultNavigateToChat }, children: /* @__PURE__ */ jsxs(SidebarProvider, { children: [
    /* @__PURE__ */ jsx(AppSidebar, { user: session.user }),
    /* @__PURE__ */ jsx(SidebarInset, { children: /* @__PURE__ */ jsx("div", { className: contentClassName || "flex flex-col h-full max-w-4xl mx-auto w-full px-4 py-6", children }) })
  ] }) });
}
export {
  PageLayout
};
