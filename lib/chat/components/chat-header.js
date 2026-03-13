"use client";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { useState, useEffect, useCallback, useRef } from "react";
import { SidebarTrigger } from "./ui/sidebar.js";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "./ui/dropdown-menu.js";
import { ConfirmDialog } from "./ui/confirm-dialog.js";
import { RenameDialog } from "./ui/rename-dialog.jsx";
import { ChevronDownIcon, StarIcon, StarFilledIcon, PencilIcon, TrashIcon } from "./icons.js";
import { getChatMeta, getChatMetaByWorkspace, renameChat, deleteChat, starChat } from "../actions.js";
import { useChatNav } from "./chat-nav-context.js";
function ChatHeader({ chatId: chatIdProp, workspaceId }) {
  const [title, setTitle] = useState(null);
  const [starred, setStarred] = useState(0);
  const [resolvedChatId, setResolvedChatId] = useState(chatIdProp || null);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const inputRef = useRef(null);
  const nav = useChatNav();
  const chatId = resolvedChatId;
  const showControls = chatId && title && title !== "New Chat";
  const fetchMeta = useCallback(() => {
    if (workspaceId) {
      getChatMetaByWorkspace(workspaceId).then((meta) => {
        if (meta?.title && meta.title !== "New Chat") {
          setTitle(meta.title);
          setStarred(meta.starred || 0);
          setResolvedChatId(meta.chatId);
        }
      }).catch(() => {
      });
      return;
    }
    if (!chatIdProp) return;
    getChatMeta(chatIdProp).then((meta) => {
      if (meta?.title && meta.title !== "New Chat") {
        setTitle(meta.title);
        setStarred(meta.starred || 0);
      }
    }).catch(() => {
    });
  }, [chatIdProp, workspaceId]);
  useEffect(() => {
    fetchMeta();
    const handler = () => fetchMeta();
    window.addEventListener("chatsupdated", handler);
    return () => window.removeEventListener("chatsupdated", handler);
  }, [fetchMeta]);
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);
  const enterEditMode = () => {
    setEditValue(title || "");
    setIsEditing(true);
  };
  const saveEdit = async () => {
    setIsEditing(false);
    const trimmed = editValue.trim();
    if (!trimmed || trimmed === title) return;
    setTitle(trimmed);
    await renameChat(chatId, trimmed);
    window.dispatchEvent(new Event("chatsupdated"));
  };
  const cancelEdit = () => {
    setIsEditing(false);
  };
  const handleRenameFromDialog = async (newTitle) => {
    setTitle(newTitle);
    await renameChat(chatId, newTitle);
    window.dispatchEvent(new Event("chatsupdated"));
  };
  const handleStar = async () => {
    const newStarred = starred ? 0 : 1;
    setStarred(newStarred);
    await starChat(chatId);
    window.dispatchEvent(new Event("chatsupdated"));
  };
  const handleDelete = async () => {
    setShowDeleteConfirm(false);
    await deleteChat(chatId);
    window.dispatchEvent(new Event("chatsupdated"));
    nav?.navigateToChat?.(null);
  };
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsxs("header", { className: "sticky top-0 flex items-center gap-2 bg-background px-2 py-1.5 md:px-2 z-10", children: [
      /* @__PURE__ */ jsx("div", { className: "md:hidden", children: /* @__PURE__ */ jsx(SidebarTrigger, {}) }),
      isEditing ? /* @__PURE__ */ jsx(
        "input",
        {
          ref: inputRef,
          type: "text",
          value: editValue,
          onChange: (e) => setEditValue(e.target.value),
          onKeyDown: (e) => {
            if (e.key === "Enter") saveEdit();
            if (e.key === "Escape") cancelEdit();
          },
          onBlur: saveEdit,
          className: "text-base font-medium text-foreground bg-background rounded-md border border-ring px-2 py-0.5 outline-none ring-2 ring-ring/30"
        }
      ) : showControls ? /* @__PURE__ */ jsxs("div", { className: "group/title flex items-center gap-0.5 rounded-md px-1.5 py-0.5 hover:bg-muted transition-colors", children: [
        /* @__PURE__ */ jsx(
          "h1",
          {
            className: "text-base font-medium text-muted-foreground truncate cursor-pointer",
            onClick: enterEditMode,
            children: title
          }
        ),
        /* @__PURE__ */ jsxs(DropdownMenu, { children: [
          /* @__PURE__ */ jsx(DropdownMenuTrigger, { asChild: true, children: /* @__PURE__ */ jsx("button", { className: "flex items-center justify-center h-6 w-6 rounded text-muted-foreground shrink-0", "aria-label": "Chat options", children: /* @__PURE__ */ jsx(ChevronDownIcon, { size: 14 }) }) }),
          /* @__PURE__ */ jsxs(DropdownMenuContent, { align: "start", children: [
            /* @__PURE__ */ jsxs(DropdownMenuItem, { onClick: handleStar, children: [
              starred ? /* @__PURE__ */ jsx(StarFilledIcon, { size: 14 }) : /* @__PURE__ */ jsx(StarIcon, { size: 14 }),
              /* @__PURE__ */ jsx("span", { children: starred ? "Unstar" : "Star" })
            ] }),
            /* @__PURE__ */ jsxs(DropdownMenuItem, { onClick: () => setShowRenameDialog(true), children: [
              /* @__PURE__ */ jsx(PencilIcon, { size: 14 }),
              /* @__PURE__ */ jsx("span", { children: "Rename" })
            ] }),
            /* @__PURE__ */ jsxs(DropdownMenuItem, { onClick: () => setShowDeleteConfirm(true), children: [
              /* @__PURE__ */ jsx(TrashIcon, { size: 14 }),
              /* @__PURE__ */ jsx("span", { className: "text-destructive", children: "Delete" })
            ] })
          ] })
        ] })
      ] }) : /* @__PURE__ */ jsx("h1", { className: "text-base font-medium text-muted-foreground truncate", children: title || "\xA0" })
    ] }),
    /* @__PURE__ */ jsx(
      RenameDialog,
      {
        open: showRenameDialog,
        onSave: handleRenameFromDialog,
        onCancel: () => setShowRenameDialog(false),
        title: "Rename chat",
        currentValue: title || ""
      }
    ),
    /* @__PURE__ */ jsx(
      ConfirmDialog,
      {
        open: showDeleteConfirm,
        onConfirm: handleDelete,
        onCancel: () => setShowDeleteConfirm(false),
        title: "Delete chat?",
        description: "This will permanently delete this chat and all its messages.",
        confirmLabel: "Delete"
      }
    )
  ] });
}
export {
  ChatHeader
};
