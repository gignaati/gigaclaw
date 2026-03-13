"use client";
import { jsx, jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { MessageIcon, CodeIcon, TrashIcon, MoreHorizontalIcon, StarIcon, StarFilledIcon, PencilIcon } from "./icons.js";
import { SidebarMenuButton, SidebarMenuItem, useSidebar } from "./ui/sidebar.js";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "./ui/dropdown-menu.js";
import { ConfirmDialog } from "./ui/confirm-dialog.js";
import { RenameDialog } from "./ui/rename-dialog.js";
import { useChatNav } from "./chat-nav-context.js";
import { cn } from "../utils.js";
function SidebarHistoryItem({ chat, isActive, onDelete, onStar, onRename }) {
  const { navigateToChat } = useChatNav();
  const { setOpenMobile } = useSidebar();
  const [hovered, setHovered] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const showMenu = hovered || dropdownOpen;
  return /* @__PURE__ */ jsxs(SidebarMenuItem, { children: [
    /* @__PURE__ */ jsxs(
      "div",
      {
        className: "relative group",
        onMouseEnter: () => setHovered(true),
        onMouseLeave: () => setHovered(false),
        children: [
          /* @__PURE__ */ jsxs(
            SidebarMenuButton,
            {
              href: chat.codeWorkspaceId && chat.containerName ? `/code/${chat.codeWorkspaceId}` : `/chat/${chat.id}`,
              className: "pr-8",
              isActive,
              onClick: (e) => {
                e.preventDefault();
                if (chat.codeWorkspaceId && chat.containerName) {
                  window.location.href = `/code/${chat.codeWorkspaceId}`;
                } else {
                  navigateToChat(chat.id);
                }
                setOpenMobile(false);
              },
              children: [
                chat.codeWorkspaceId && chat.containerName ? /* @__PURE__ */ jsx(CodeIcon, { size: 14 }) : /* @__PURE__ */ jsx(MessageIcon, { size: 14 }),
                /* @__PURE__ */ jsx("span", { className: "truncate flex-1", children: chat.title })
              ]
            }
          ),
          /* @__PURE__ */ jsx("div", { className: cn(
            "absolute right-1 top-1/2 -translate-y-1/2 z-10",
            showMenu ? "opacity-100" : "opacity-0 pointer-events-none"
          ), children: /* @__PURE__ */ jsxs(DropdownMenu, { open: dropdownOpen, onOpenChange: setDropdownOpen, children: [
            /* @__PURE__ */ jsx(DropdownMenuTrigger, { asChild: true, children: /* @__PURE__ */ jsx(
              "button",
              {
                className: cn(
                  "rounded-md p-1",
                  "text-muted-foreground hover:text-foreground",
                  "bg-foreground/10 hover:bg-foreground/15"
                ),
                "aria-label": "Chat options",
                children: /* @__PURE__ */ jsx(MoreHorizontalIcon, { size: 16 })
              }
            ) }),
            /* @__PURE__ */ jsxs(DropdownMenuContent, { align: "end", side: "bottom", children: [
              /* @__PURE__ */ jsxs(
                DropdownMenuItem,
                {
                  onClick: (e) => {
                    e.stopPropagation();
                    onStar(chat.id);
                  },
                  children: [
                    chat.starred ? /* @__PURE__ */ jsx(StarFilledIcon, { size: 14 }) : /* @__PURE__ */ jsx(StarIcon, { size: 14 }),
                    chat.starred ? "Unstar" : "Star"
                  ]
                }
              ),
              /* @__PURE__ */ jsxs(
                DropdownMenuItem,
                {
                  onClick: (e) => {
                    e.stopPropagation();
                    setRenameDialogOpen(true);
                  },
                  children: [
                    /* @__PURE__ */ jsx(PencilIcon, { size: 14 }),
                    "Rename"
                  ]
                }
              ),
              /* @__PURE__ */ jsx(DropdownMenuSeparator, {}),
              /* @__PURE__ */ jsxs(
                DropdownMenuItem,
                {
                  className: "text-destructive hover:text-destructive",
                  onClick: (e) => {
                    e.stopPropagation();
                    setConfirmDelete(true);
                  },
                  children: [
                    /* @__PURE__ */ jsx(TrashIcon, { size: 14 }),
                    "Delete"
                  ]
                }
              )
            ] })
          ] }) })
        ]
      }
    ),
    /* @__PURE__ */ jsx(
      ConfirmDialog,
      {
        open: confirmDelete,
        title: "Delete chat?",
        description: "This will permanently delete this chat and all its messages.",
        confirmLabel: "Delete",
        onConfirm: () => {
          setConfirmDelete(false);
          onDelete(chat.id);
        },
        onCancel: () => setConfirmDelete(false)
      }
    ),
    /* @__PURE__ */ jsx(
      RenameDialog,
      {
        open: renameDialogOpen,
        currentValue: chat.title || "",
        onSave: (newTitle) => onRename(chat.id, newTitle),
        onCancel: () => setRenameDialogOpen(false)
      }
    )
  ] });
}
export {
  SidebarHistoryItem
};
