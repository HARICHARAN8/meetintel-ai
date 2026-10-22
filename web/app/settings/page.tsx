"use client";

import React, { useState, useEffect } from "react";
import {
  Settings,
  User,
  Sparkles,
  Shield,
  Save,
  CheckCircle2,
  Sliders,
  Globe,
  Clock,
  Calendar,
} from "lucide-react";
import { api } from "@/lib/api";

export default function SettingsPage() {
  const currentUser = api.getCurrentUser();
  const [fullName, setFullName] = useState(currentUser.full_name);
  const [email, setEmail] = useState(currentUser.email);
  const [department, setDepartment] = useState(currentUser.department);
  const [timezone, setTimezone] = useState("UTC");
  const [eodHour, setEodHour] = useState("17:00");
  const [weekStart, setWeekStart] = useState("Monday");
  const [provider, setProvider] = useState("gemini");
  const [geminiModel, setGeminiModel] = useState("gemini-2.5-flash");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("meetintel_user_settings");
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (parsed.timezone) setTimezone(parsed.timezone);
          if (parsed.eodHour) setEodHour(parsed.eodHour);
          if (parsed.weekStart) setWeekStart(parsed.weekStart);
        } catch {
          // ignore
        }
      } else {
        const detectedTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (detectedTz) setTimezone(detectedTz);
      }
    }
  }, []);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (typeof window !== "undefined") {
      localStorage.setItem(
        "meetintel_user_settings",
        JSON.stringify({
          fullName,
          email,
          department,
          timezone,
          eodHour,
          weekStart,
          provider,
          geminiModel,
        })
      );
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="max-w-4xl space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[var(--mt-border)]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[0.68rem] font-bold uppercase tracking-wider text-brand-500 bg-brand-500/10 px-2.5 py-0.5 rounded-full border border-brand-500/20">
              Platform Configuration
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--mt-text)]">
            Preferences & AI Configuration
          </h1>
          <p className="text-xs text-[var(--mt-text-secondary)] mt-1">
            Configure profile credentials, select AI intelligence providers, and customize execution parameters.
          </p>
        </div>
      </div>

      {saved && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4" />
          <span>Configuration saved successfully.</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* User Profile Card */}
        <div className="p-6 rounded-2xl bg-[var(--mt-surface)] border border-[var(--mt-border)] shadow-card space-y-4 text-xs">
          <div className="flex items-center gap-2 font-bold text-sm text-[var(--mt-text)] pb-2 border-b border-[var(--mt-border)]">
            <User className="w-4 h-4 text-brand-500" />
            <span>Profile & Organizational Identity</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="font-semibold text-[var(--mt-text-secondary)] block mb-1">
                Full Name
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-xs bg-[var(--mt-surface-soft)] border border-[var(--mt-border)] text-[var(--mt-text)] focus:outline-none focus:border-brand-500"
              />
            </div>

            <div>
              <label className="font-semibold text-[var(--mt-text-secondary)] block mb-1">
                Corporate Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-xs bg-[var(--mt-surface-soft)] border border-[var(--mt-border)] text-[var(--mt-text)] focus:outline-none focus:border-brand-500"
              />
            </div>

            <div>
              <label className="font-semibold text-[var(--mt-text-secondary)] block mb-1">
                Department
              </label>
              <input
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-xs bg-[var(--mt-surface-soft)] border border-[var(--mt-border)] text-[var(--mt-text)] focus:outline-none focus:border-brand-500"
              />
            </div>

            <div>
              <label className="font-semibold text-[var(--mt-text-secondary)] block mb-1">
                Assigned RBAC Role
              </label>
              <input
                type="text"
                disabled
                value={currentUser.role}
                className="w-full px-3 py-2 rounded-xl text-xs bg-[var(--mt-surface-soft)] border border-[var(--mt-border)] text-[var(--mt-text-muted)] cursor-not-allowed"
              />
            </div>
          </div>
        </div>

        {/* Timezone & Localization Card */}
        <div className="p-6 rounded-2xl bg-[var(--mt-surface)] border border-[var(--mt-border)] shadow-card space-y-4 text-xs">
          <div className="flex items-center gap-2 font-bold text-sm text-[var(--mt-text)] pb-2 border-b border-[var(--mt-border)]">
            <Globe className="w-4 h-4 text-brand-500" />
            <span>Timezone & Deterministic Deadline Localization</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="font-semibold text-[var(--mt-text-secondary)] block mb-1">
                Configured Timezone
              </label>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-xs bg-[var(--mt-surface-soft)] border border-[var(--mt-border)] text-[var(--mt-text)] focus:outline-none focus:border-brand-500"
              >
                <option value="UTC">UTC (Coordinated Universal Time)</option>
                <option value="America/New_York">America/New_York (EST / EDT)</option>
                <option value="America/Chicago">America/Chicago (CST / CDT)</option>
                <option value="America/Denver">America/Denver (MST / MDT)</option>
                <option value="America/Los_Angeles">America/Los_Angeles (PST / PDT)</option>
                <option value="Europe/London">Europe/London (GMT / BST)</option>
                <option value="Europe/Paris">Europe/Paris (CET / CEST)</option>
                <option value="Europe/Berlin">Europe/Berlin (CET / CEST)</option>
                <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                <option value="Asia/Singapore">Asia/Singapore (SGT)</option>
                <option value="Asia/Tokyo">Asia/Tokyo (JST)</option>
                <option value="Australia/Sydney">Australia/Sydney (AEST / AEDT)</option>
              </select>
              <span className="text-[0.65rem] text-[var(--mt-text-muted)] mt-1 block">
                Used to interpret natural-language deadlines like &quot;tomorrow at 3 PM&quot;.
              </span>
            </div>

            <div>
              <label className="font-semibold text-[var(--mt-text-secondary)] block mb-1">
                Default EOD (End of Day) Hour
              </label>
              <select
                value={eodHour}
                onChange={(e) => setEodHour(e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-xs bg-[var(--mt-surface-soft)] border border-[var(--mt-border)] text-[var(--mt-text)] focus:outline-none focus:border-brand-500"
              >
                <option value="17:00">17:00 (5:00 PM - Standard Enterprise)</option>
                <option value="18:00">18:00 (6:00 PM - Extended Business Day)</option>
                <option value="23:59">23:59 (End of Calendar Day)</option>
              </select>
              <span className="text-[0.65rem] text-[var(--mt-text-muted)] mt-1 block">
                Applied when expressions specify &quot;by EOD&quot; or &quot;Friday EOD&quot;.
              </span>
            </div>

            <div>
              <label className="font-semibold text-[var(--mt-text-secondary)] block mb-1">
                First Day of Working Week
              </label>
              <select
                value={weekStart}
                onChange={(e) => setWeekStart(e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-xs bg-[var(--mt-surface-soft)] border border-[var(--mt-border)] text-[var(--mt-text)] focus:outline-none focus:border-brand-500"
              >
                <option value="Monday">Monday (ISO 8601 Business Standard)</option>
                <option value="Sunday">Sunday</option>
              </select>
              <span className="text-[0.65rem] text-[var(--mt-text-muted)] mt-1 block">
                Defines &quot;next week&quot; and business-day calculation boundaries.
              </span>
            </div>
          </div>
        </div>

        {/* AI Provider Config */}
        <div className="p-6 rounded-2xl bg-[var(--mt-surface)] border border-[var(--mt-border)] shadow-card space-y-4 text-xs">
          <div className="flex items-center gap-2 font-bold text-sm text-[var(--mt-text)] pb-2 border-b border-[var(--mt-border)]">
            <Sparkles className="w-4 h-4 text-brand-500" />
            <span>AI Intelligence Provider & Failover Chain</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="font-semibold text-[var(--mt-text-secondary)] block mb-1">
                Primary Intelligence Provider
              </label>
              <select
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-xs bg-[var(--mt-surface-soft)] border border-[var(--mt-border)] text-[var(--mt-text)] focus:outline-none focus:border-brand-500"
              >
                <option value="gemini">Google Gemini (Recommended & Primary)</option>
                <option value="openai">OpenAI GPT-4o-mini</option>
                <option value="demo">Demo Deterministic Fallback</option>
              </select>
            </div>

            <div>
              <label className="font-semibold text-[var(--mt-text-secondary)] block mb-1">
                Gemini Model Selection
              </label>
              <select
                value={geminiModel}
                onChange={(e) => setGeminiModel(e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-xs bg-[var(--mt-surface-soft)] border border-[var(--mt-border)] text-[var(--mt-text)] focus:outline-none focus:border-brand-500"
              >
                <option value="gemini-2.5-flash">gemini-2.5-flash (Fast & Structured)</option>
                <option value="gemini-2.5-pro">gemini-2.5-pro (Deep Reasoning)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-end">
          <button
            type="submit"
            className="px-6 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-semibold text-xs shadow-md shadow-brand-500/20 transition-all flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            <span>Save Preferences</span>
          </button>
        </div>
      </form>
    </div>
  );
}
