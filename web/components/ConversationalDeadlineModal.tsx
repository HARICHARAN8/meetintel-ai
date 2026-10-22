"use client";

import React, { useState, useEffect } from "react";
import {
  Calendar,
  Clock,
  Sparkles,
  Check,
  AlertCircle,
  HelpCircle,
  X,
  ArrowRight,
  Globe,
} from "lucide-react";
import { parseNaturalDeadline, ParsedDeadlineResult } from "@/lib/dateParser";

interface ConversationalDeadlineModalProps {
  isOpen: boolean;
  initialText?: string;
  taskTitle: string;
  userTimezone?: string;
  onConfirm: (parsed: ParsedDeadlineResult) => void;
  onCancel: () => void;
}

export const ConversationalDeadlineModal: React.FC<ConversationalDeadlineModalProps> = ({
  isOpen,
  initialText = "",
  taskTitle,
  userTimezone = "UTC",
  onConfirm,
  onCancel,
}) => {
  const [inputText, setInputText] = useState(initialText);
  const [selectedTz, setSelectedTz] = useState(userTimezone);
  const [parseResult, setParseResult] = useState<ParsedDeadlineResult | null>(null);

  useEffect(() => {
    setInputText(initialText);
  }, [initialText]);

  useEffect(() => {
    if (inputText.trim()) {
      const res = parseNaturalDeadline(inputText, undefined, selectedTz);
      setParseResult(res);
    } else {
      setParseResult(null);
    }
  }, [inputText, selectedTz]);

  if (!isOpen) return null;

  const quickPresets = [
    "tomorrow at 3 PM",
    "next Friday EOD",
    "in 2 business days",
    "in two weeks",
    "by the end of this month",
    "in 90 minutes",
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-lg bg-[var(--mt-surface)] border border-[var(--mt-border)] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-[var(--mt-border)] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-brand-500/10 text-brand-500 flex items-center justify-center font-bold">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[var(--mt-text)] leading-none">
                Natural-Language Deadline Interpreter
              </h3>
              <p className="text-[0.72rem] text-[var(--mt-text-secondary)] mt-1">
                Deterministic date & timezone resolution engine
              </p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="p-1.5 rounded-lg text-[var(--mt-text-secondary)] hover:bg-[var(--mt-surface-soft)] hover:text-[var(--mt-text)] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4 overflow-y-auto">
          <div>
            <div className="text-[0.75rem] font-semibold text-[var(--mt-text-secondary)] mb-1">
              Target Deliverable
            </div>
            <div className="p-3 rounded-xl bg-[var(--mt-surface-soft)] text-xs font-medium text-[var(--mt-text)] border border-[var(--mt-border)]">
              {taskTitle}
            </div>
          </div>

          {/* Natural Language Input */}
          <div>
            <label className="block text-[0.75rem] font-semibold text-[var(--mt-text)] mb-1.5">
              Enter target timeframe or deadline phrase
            </label>
            <div className="relative">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="e.g. tomorrow at 3 PM, next Friday, in 2 business days"
                className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-[var(--mt-surface-soft)] border border-[var(--mt-border)] text-[var(--mt-text)] placeholder-[var(--mt-text-muted)] focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15"
                autoFocus
              />
            </div>
          </div>

          {/* Timezone Selector */}
          <div className="flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-1.5 text-[var(--mt-text-secondary)] text-[0.75rem]">
              <Globe className="w-3.5 h-3.5 text-brand-500" />
              <span>Reference Timezone:</span>
            </div>
            <select
              value={selectedTz}
              onChange={(e) => setSelectedTz(e.target.value)}
              className="px-2.5 py-1 text-[0.75rem] rounded-lg bg-[var(--mt-surface-soft)] border border-[var(--mt-border)] text-[var(--mt-text)] focus:outline-none focus:border-brand-500"
            >
              <option value="UTC">UTC (Universal Time)</option>
              <option value="America/New_York">America/New York (EST/EDT)</option>
              <option value="America/Los_Angeles">America/Los Angeles (PST/PDT)</option>
              <option value="Europe/London">Europe/London (GMT/BST)</option>
              <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
              <option value="Asia/Tokyo">Asia/Tokyo (JST)</option>
            </select>
          </div>

          {/* Quick Presets */}
          <div>
            <div className="text-[0.68rem] font-bold uppercase tracking-wider text-[var(--mt-text-muted)] mb-1.5">
              Supported Examples & Quick Presets
            </div>
            <div className="flex flex-wrap gap-1.5">
              {quickPresets.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setInputText(preset)}
                  className="px-2.5 py-1 rounded-lg text-[0.7rem] bg-[var(--mt-surface-soft)] text-[var(--mt-text)] border border-[var(--mt-border)] hover:border-brand-500 hover:text-brand-500 transition-colors"
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          {/* Live Interpretation Box */}
          {parseResult && (
            <div className="p-4 rounded-xl border border-[var(--mt-border)] bg-[var(--mt-surface-soft)] space-y-2.5">
              <div className="flex items-center justify-between text-xs pb-2 border-b border-[var(--mt-border)]">
                <span className="font-bold text-[var(--mt-text)] flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-brand-500" />
                  Interpretation Result
                </span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[0.65rem] font-bold uppercase tracking-wider ${
                    parseResult.status === "success"
                      ? "bg-emerald-500/15 text-emerald-600 border border-emerald-500/20"
                      : parseResult.status === "needs_clarification"
                      ? "bg-amber-500/15 text-amber-600 border border-amber-500/20"
                      : "bg-rose-500/15 text-rose-600 border border-rose-500/20"
                  }`}
                >
                  {parseResult.status === "success"
                    ? "Deterministically Interpreted"
                    : parseResult.status === "needs_clarification"
                    ? "Ambiguity Detected"
                    : "Invalid Format"}
                </span>
              </div>

              {parseResult.status === "success" ? (
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between items-baseline">
                    <span className="text-[var(--mt-text-secondary)] text-[0.75rem]">Parsed Deadline:</span>
                    <span className="font-bold text-[var(--mt-text)] text-right">
                      {parseResult.formattedLocal}
                    </span>
                  </div>
                  <div className="flex justify-between items-baseline">
                    <span className="text-[var(--mt-text-secondary)] text-[0.75rem]">Normalized ISO 8601:</span>
                    <code className="text-[0.7rem] bg-[var(--mt-surface)] px-1.5 py-0.5 rounded border border-[var(--mt-border)] text-brand-600 dark:text-brand-400 font-mono">
                      {parseResult.parsedIso}
                    </code>
                  </div>
                  <div className="flex justify-between items-baseline">
                    <span className="text-[var(--mt-text-secondary)] text-[0.75rem]">Countdown:</span>
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                      {parseResult.countdownText}
                    </span>
                  </div>
                  <div className="flex justify-between items-baseline">
                    <span className="text-[var(--mt-text-secondary)] text-[0.75rem]">Precision:</span>
                    <span className="text-[var(--mt-text-secondary)]">
                      {parseResult.isDateOnly ? "Date-only (EOD 5:00 PM)" : "Explicit Date & Time"}
                    </span>
                  </div>
                </div>
              ) : parseResult.status === "needs_clarification" ? (
                <div className="flex items-start gap-2.5 text-xs text-amber-700 dark:text-amber-400 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <HelpCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-500" />
                  <div className="leading-relaxed">
                    <strong>Clarification Required:</strong> {parseResult.clarificationQuestion}
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2.5 text-xs text-rose-700 dark:text-rose-400 p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-500" />
                  <div className="leading-relaxed">
                    <strong>Invalid Date:</strong> {parseResult.errorMessage || "Unable to parse this date."}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Buttons */}
        <div className="p-4 border-t border-[var(--mt-border)] bg-[var(--mt-surface)] flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-[var(--mt-text-secondary)] hover:bg-[var(--mt-surface-soft)] transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!parseResult || parseResult.status !== "success"}
            onClick={() => parseResult && onConfirm(parseResult)}
            className="px-5 py-2 rounded-xl text-xs font-semibold bg-brand-500 text-white shadow-sm hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 transition-all"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Confirm Deadline</span>
          </button>
        </div>
      </div>
    </div>
  );
};
