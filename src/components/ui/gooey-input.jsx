"use client";;
import { useState, useRef, useEffect, useCallback } from "react";
// eslint-disable-next-line no-unused-vars
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

function SearchIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      className="size-4 shrink-0">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

const transition = {
  duration: 0.22,
  ease: [0.16, 1, 0.3, 1],
};

export function GooeyInput({
  placeholder = "Type to search...",
  className,
  classNames,
  collapsedWidth = 115,
  expandedWidth = 200,
  value: valueProp,
  defaultValue = "",
  onValueChange,
  onOpenChange,
  // Changing number: each new value expands the field and focuses it. Lets a
  // global shortcut reach in without the parent holding a ref.
  focusSignal = 0,
  disabled = false
}) {
  const inputRef = useRef(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [uncontrolledValue, setUncontrolledValue] = useState(defaultValue);

  const isControlled = valueProp !== undefined;
  const searchText = isControlled ? valueProp : uncontrolledValue;

  const setSearchText = useCallback((next) => {
    if (!isControlled) {
      setUncontrolledValue(next);
    }
    onValueChange?.(next);
  }, [isControlled, onValueChange]);

  const setExpanded = useCallback((next) => {
    setIsExpanded(next);
    // Collapsing discards the query. Doing it here rather than in an effect
    // keeps it a single render instead of a state update cascading off one.
    if (!next) setSearchText("");
    onOpenChange?.(next);
  }, [onOpenChange, setSearchText]);

  useEffect(() => {
    if (isExpanded) inputRef.current?.focus();
  }, [isExpanded]);

  // Reacting to a changed prop by adjusting state during render — the pattern
  // React prescribes over an effect, which would cost a second render pass.
  // The effect above does the actual focusing once expansion lands.
  const [handledFocusSignal, setHandledFocusSignal] = useState(focusSignal);
  if (focusSignal !== handledFocusSignal) {
    setHandledFocusSignal(focusSignal);
    if (!disabled) setIsExpanded(true);
  }

  const handleExpand = useCallback(() => {
    if (!disabled) setExpanded(true);
  }, [disabled, setExpanded]);

  const handleChange = useCallback((e) => {
    setSearchText(e.target.value);
  }, [setSearchText]);

  const handleBlur = useCallback(() => {
    if (!searchText) setExpanded(false);
  }, [searchText, setExpanded]);

  return (
    <div className={cn("relative flex items-center justify-center", className, classNames?.root)}>
      <motion.div
        className={cn("flex h-10 items-center", classNames?.buttonRow)}
        initial={false}
        animate={{ width: isExpanded ? expandedWidth : collapsedWidth }}
        transition={transition}>
        <button
          type="button"
          disabled={disabled}
          onClick={handleExpand}
          className={cn(
            "flex h-10 w-full cursor-pointer items-center gap-2 rounded-full px-4 text-sm font-medium outline-none transition-[color,box-shadow] focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
            classNames?.trigger
          )}>
          <SearchIcon />
          <input
            ref={inputRef}
            type="search"
            enterKeyHint="search"
            autoComplete="off"
            value={searchText}
            onChange={handleChange}
            onBlur={handleBlur}
            disabled={disabled || !isExpanded}
            placeholder={isExpanded ? placeholder : ""}
            className={cn(
              "h-full min-w-0 flex-1 bg-transparent outline-none",
              !isExpanded && "pointer-events-none opacity-0",
              classNames?.input
            )} />
        </button>
      </motion.div>
    </div>
  );
}
