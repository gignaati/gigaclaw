'use client';

import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { cn } from '../../utils.js';

const DropdownContext = createContext({ open: false, onOpenChange: () => {} });

export function DropdownMenu({ children, open: controlledOpen, onOpenChange: controlledOnOpenChange }) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const onOpenChange = controlledOnOpenChange || setInternalOpen;

  return (
    <DropdownContext.Provider value={{ open, onOpenChange }}>
      <div className="relative inline-block">{children}</div>
    </DropdownContext.Provider>
  );
}

export function DropdownMenuTrigger({ children, asChild, ...props }) {
  const { open, onOpenChange } = useContext(DropdownContext);
  const handleClick = (e) => {
    e.stopPropagation();
    onOpenChange(!open);
  };

  // Slot pattern: when asChild=true (or when the child is already a button/a),
  // clone the child and merge in our handler instead of wrapping in another element.
  // This prevents <button><button> nesting which causes React hydration errors.
  const child = Array.isArray(children) ? children[0] : children;
  const childIsInteractive =
    child && typeof child === 'object' && 'type' in child &&
    (child.type === 'button' || child.type === 'a');

  if ((asChild || childIsInteractive) && child && typeof child === 'object' && 'props' in child) {
    return (
      <child.type
        {...child.props}
        onClick={(e) => {
          child.props.onClick?.(e);
          handleClick(e);
        }}
        aria-expanded={open}
        data-state={open ? 'open' : 'closed'}
      />
    );
  }

  // Default: render a semantically neutral <span> (not <button>) so callers
  // that pass <button> children never produce invalid <button><button> nesting.
  return (
    <span
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleClick(e); }}
      aria-expanded={open}
      data-state={open ? 'open' : 'closed'}
      {...props}
    >
      {children}
    </span>
  );
}

export function DropdownMenuContent({ children, className, align = 'start', side = 'bottom', sideOffset = 4, ...props }) {
  const { open, onOpenChange } = useContext(DropdownContext);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        onOpenChange(false);
      }
    };
    const handleEsc = (e) => {
      if (e.key === 'Escape') onOpenChange(false);
    };
    setTimeout(() => document.addEventListener('click', handleClickOutside), 0);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <div
      ref={ref}
      className={cn(
        'absolute z-50 min-w-[8rem] overflow-hidden rounded-md border border-border bg-background/80 backdrop-blur-sm p-1 text-foreground shadow-lg',
        side === 'bottom' && `top-full mt-1`,
        side === 'top' && `bottom-full mb-1`,
        align === 'end' && 'right-0',
        align === 'start' && 'left-0',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function DropdownMenuItem({ children, className, onClick, asChild, ...props }) {
  const { onOpenChange } = useContext(DropdownContext);
  const handleClick = (e) => {
    onClick?.(e);
    onOpenChange(false);
  };

  // When asChild=true, clone the single child element and merge in our
  // click handler + className instead of wrapping in a <div>.
  // This prevents React from seeing `asChild` as an unknown DOM attribute.
  if (asChild && children) {
    const child = Array.isArray(children) ? children[0] : children;
    if (child && typeof child === 'object' && 'props' in child) {
      return (
        <child.type
          {...child.props}
          className={cn(
            'relative flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-background focus:bg-background',
            child.props.className,
            className
          )}
          onClick={(e) => {
            child.props.onClick?.(e);
            handleClick(e);
          }}
          role="menuitem"
        />
      );
    }
  }

  return (
    <div
      role="menuitem"
      className={cn(
        'relative flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-background focus:bg-background',
        className
      )}
      onClick={handleClick}
      {...props}
    >
      {children}
    </div>
  );
}

export function DropdownMenuSeparator({ className }) {
  return <div className={cn('-mx-1 my-1 h-px bg-border', className)} />;
}

export function DropdownMenuLabel({ children, className }) {
  return (
    <div className={cn('px-2 py-1.5 text-sm font-semibold', className)}>
      {children}
    </div>
  );
}

export function DropdownMenuGroup({ children }) {
  return <div>{children}</div>;
}

// ─── Submenu ─────────────────────────────────────────────────────────────────
const SubContext = createContext({ open: false, setOpen: () => {} });

export function DropdownMenuSub({ children }) {
  const [open, setOpen] = useState(false);
  return (
    <SubContext.Provider value={{ open, setOpen }}>
      <div className="relative">{children}</div>
    </SubContext.Provider>
  );
}

export function DropdownMenuSubTrigger({ children, className }) {
  const { open, setOpen } = useContext(SubContext);
  return (
    <div
      role="menuitem"
      aria-haspopup="menu"
      aria-expanded={open}
      className={cn(
        'relative flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-background focus:bg-background justify-between',
        className
      )}
      onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
    >
      <span className="flex items-center gap-2">{children}</span>
      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
    </div>
  );
}

export function DropdownMenuSubContent({ children, className }) {
  const { open } = useContext(SubContext);
  if (!open) return null;
  return (
    <div
      role="menu"
      className={cn(
        'absolute left-full top-0 z-50 min-w-[8rem] overflow-hidden rounded-md border border-border bg-background/80 backdrop-blur-sm p-1 text-foreground shadow-lg ml-1',
        className
      )}
    >
      {children}
    </div>
  );
}
