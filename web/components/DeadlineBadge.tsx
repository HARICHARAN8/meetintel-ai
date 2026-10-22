"use client";

import React, { useMemo } from "react";
import { Clock, AlertTriangle, Calendar, CheckCircle2, HelpCircle } from "lucide-react";
import { parseNaturalDeadline } from "@/lib/dateParser";

interface DeadlineBadgeProps {
  deadline?: string | null;
  isCompleted?: boolean;
  timezone?: string;
  className?: string;
  showIcon?: boolean;
}

export const DeadlineBadge: React.FC<DeadlineBadgeProps> = ({
  deadline,
  isCompleted = false,
  timezone = "UTC",
  className = "",
  showIcon = true,
}) => {
  const parsed = useMemo(() => {
    if (!deadline || deadline === "Not specified") {
      return {
        badgeStatus: "no_deadline" as const,
        countdownText: "No deadline",
      };
    }
    return parseNaturalDeadline(deadline, undefined, timezone, isCompleted);
  }, [deadline, isCompleted, timezone]);

  if (isCompleted) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[0.68rem] font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 ${className}`}
        title={`Completed commitment`}
      >
        {showIcon && <CheckCircle2 className="w-3 h-3 text-emerald-500 flex-shrink-0" />}
        <span>Completed</span>
      </span>
    );
  }

  if (parsed.badgeStatus === "overdue") {
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[0.68rem] font-bold bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/25 animate-pulse ${className}`}
        title={`Overdue: ${parsed.formattedLocal || deadline}`}
      >
        {showIcon && <AlertTriangle className="w-3 h-3 text-rose-500 flex-shrink-0" />}
        <span>{parsed.countdownText}</span>
      </span>
    );
  }

  if (parsed.badgeStatus === "due_today") {
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[0.68rem] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 ${className}`}
        title={`Due Today: ${parsed.formattedLocal || deadline}`}
      >
        {showIcon && <Clock className="w-3 h-3 text-amber-500 flex-shrink-0" />}
        <span>{parsed.countdownText}</span>
      </span>
    );
  }

  if (parsed.badgeStatus === "due_soon") {
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[0.68rem] font-semibold bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20 ${className}`}
        title={`Due Soon: ${parsed.formattedLocal || deadline}`}
      >
        {showIcon && <Clock className="w-3 h-3 text-blue-500 flex-shrink-0" />}
        <span>{parsed.countdownText}</span>
      </span>
    );
  }

  if (parsed.badgeStatus === "upcoming") {
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[0.68rem] font-medium bg-[var(--mt-surface-soft)] text-[var(--mt-text)] border border-[var(--mt-border)] ${className}`}
        title={`Target: ${parsed.formattedLocal || deadline}`}
      >
        {showIcon && <Calendar className="w-3 h-3 text-brand-500 flex-shrink-0" />}
        <span>{parsed.countdownText}</span>
      </span>
    );
  }

  if (parsed.badgeStatus === "unconfirmed") {
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[0.68rem] font-medium bg-amber-500/10 text-amber-600 border border-amber-500/20 ${className}`}
        title={parsed.clarificationQuestion || "Needs explicit deadline clarification"}
      >
        {showIcon && <HelpCircle className="w-3 h-3 text-amber-500 flex-shrink-0" />}
        <span>Needs clarification</span>
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[0.68rem] font-normal bg-[var(--mt-surface-soft)] text-[var(--mt-text-secondary)] border border-dashed border-[var(--mt-border)] ${className}`}
    >
      {showIcon && <Calendar className="w-3 h-3 opacity-40 flex-shrink-0" />}
      <span>No deadline</span>
    </span>
  );
};
