'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { SidebarTrigger } from './ui/sidebar.js';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent } from './ui/dropdown-menu.js';
import { ConfirmDialog } from './ui/confirm-dialog.js';
import { RenameDialog } from './ui/rename-dialog.jsx';
import { ChevronDownIcon, StarIcon, StarFilledIcon, PencilIcon, TrashIcon, ExportIcon } from './icons.js';
import { getChatMeta, getChatMetaByWorkspace, renameChat, deleteChat, starChat, exportChat } from '../actions.js';
import { useChatNav } from './chat-nav-context.js';

export function ChatHeader({ chatId: chatIdProp, workspaceId }) {
  const [title, setTitle] = useState(null);
  const [starred, setStarred] = useState(0);
  const [resolvedChatId, setResolvedChatId] = useState(chatIdProp || null);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const inputRef = useRef(null);
  const nav = useChatNav();

  // The actual chatId to use for actions (either passed directly or resolved from workspace)
  const chatId = resolvedChatId;

  // Whether to show the dropdown and inline-edit features
  const showControls = chatId && title && title !== 'New Chat';

  const fetchMeta = useCallback(() => {
    if (workspaceId) {
      getChatMetaByWorkspace(workspaceId)
        .then((meta) => {
          if (meta?.title && meta.title !== 'New Chat') {
            setTitle(meta.title);
            setStarred(meta.starred || 0);
            setResolvedChatId(meta.chatId);
          }
        })
        .catch(() => {});
      return;
    }
    if (!chatIdProp) return;
    getChatMeta(chatIdProp)
      .then((meta) => {
        if (meta?.title && meta.title !== 'New Chat') {
          setTitle(meta.title);
          setStarred(meta.starred || 0);
        }
      })
      .catch(() => {});
  }, [chatIdProp, workspaceId]);

  useEffect(() => {
    fetchMeta();
    const handler = () => fetchMeta();
    window.addEventListener('chatsupdated', handler);
    return () => window.removeEventListener('chatsupdated', handler);
  }, [fetchMeta]);

  // Auto-focus and select all when entering inline edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const enterEditMode = () => {
    setEditValue(title || '');
    setIsEditing(true);
  };

  const saveEdit = async () => {
    setIsEditing(false);
    const trimmed = editValue.trim();
    if (!trimmed || trimmed === title) return;
    setTitle(trimmed);
    await renameChat(chatId, trimmed);
    window.dispatchEvent(new Event('chatsupdated'));
  };

  const cancelEdit = () => {
    setIsEditing(false);
  };

  const handleRenameFromDialog = async (newTitle) => {
    setTitle(newTitle);
    await renameChat(chatId, newTitle);
    window.dispatchEvent(new Event('chatsupdated'));
  };

  const handleStar = async () => {
    const newStarred = starred ? 0 : 1;
    setStarred(newStarred);
    await starChat(chatId);
    window.dispatchEvent(new Event('chatsupdated'));
  };

  const handleExport = async (format) => {
    if (!chatId || isExporting) return;
    setIsExporting(true);
    try {
      const { filename, content, mimeType } = await exportChat(chatId, format);
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setIsExporting(false);
    }
  };

  const handleDelete = async () => {
    setShowDeleteConfirm(false);
    await deleteChat(chatId);
    window.dispatchEvent(new Event('chatsupdated'));
    nav?.navigateToChat?.(null);
  };

  return (
    <>
      <header className="sticky top-0 flex items-center gap-2 bg-background px-2 py-1.5 md:px-2 z-10">
        {/* Mobile-only: open sidebar sheet */}
        <div className="md:hidden">
          <SidebarTrigger />
        </div>

        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') saveEdit();
              if (e.key === 'Escape') cancelEdit();
            }}
            onBlur={saveEdit}
            className="text-base font-medium text-foreground bg-background rounded-md border border-ring px-2 py-0.5 outline-none ring-2 ring-ring/30"
          />
        ) : showControls ? (
          <div className="group/title flex items-center gap-0.5 rounded-md px-1.5 py-0.5 hover:bg-muted transition-colors">
            <h1
              className="text-base font-medium text-muted-foreground truncate cursor-pointer"
              onClick={enterEditMode}
            >
              {title}
            </h1>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center justify-center h-6 w-6 rounded text-muted-foreground shrink-0" aria-label="Chat options">
                  <ChevronDownIcon size={14} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={handleStar}>
                  {starred ? <StarFilledIcon size={14} /> : <StarIcon size={14} />}
                  <span>{starred ? 'Unstar' : 'Star'}</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowRenameDialog(true)}>
                  <PencilIcon size={14} />
                  <span>Rename</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <ExportIcon size={14} />
                    <span>{isExporting ? 'Exporting…' : 'Export'}</span>
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    <DropdownMenuItem onClick={() => handleExport('md')}>
                      <span>Markdown (.md)</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleExport('txt')}>
                      <span>Plain Text (.txt)</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleExport('json')}>
                      <span>JSON (.json)</span>
                    </DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setShowDeleteConfirm(true)}>
                  <TrashIcon size={14} />
                  <span className="text-destructive">Delete</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ) : (
          <h1 className="text-base font-medium text-muted-foreground truncate">
            {title || '\u00A0'}
          </h1>
        )}
      </header>

      <RenameDialog
        open={showRenameDialog}
        onSave={handleRenameFromDialog}
        onCancel={() => setShowRenameDialog(false)}
        title="Rename chat"
        currentValue={title || ''}
      />

      <ConfirmDialog
        open={showDeleteConfirm}
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
        title="Delete chat?"
        description="This will permanently delete this chat and all its messages."
        confirmLabel="Delete"
      />
    </>
  );
}
