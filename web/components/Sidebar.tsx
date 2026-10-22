"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CheckSquare,
  Layers,
  Mic,
  UploadCloud,
  FolderKanban,
  Scale,
  CalendarDays,
  Sparkles,
  MailCheck,
  Zap,
  Cable,
  Users,
  LineChart,
  ShieldCheck,
  Settings,
  BookOpen,
} from "lucide-react";
import { UserRole } from "@/lib/types";

interface SidebarProps {
  currentRole: UserRole;
  userName: string;
  userEmail: string;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentRole,
  userName,
  userEmail,
}) => {
  const pathname = usePathname();

  const navSections = [
    {
      header: "Workspace",
      items: [
        { name: "Overview", href: "/", icon: LayoutDashboard },
        { name: "My Commitments", href: "/tasks", icon: CheckSquare },
        { name: "Priority Matrix", href: "/matrix", icon: Layers },
        { name: "Meeting Library", href: "/meetings", icon: Mic },
        { name: "Process Meeting", href: "/upload", icon: UploadCloud },
      ],
    },
    {
      header: "Planning & Intelligence",
      items: [
        { name: "Projects & Milestones", href: "/projects", icon: FolderKanban },
        { name: "Decision Register", href: "/decisions", icon: Scale },
        { name: "Meeting Preparation", href: "/prep", icon: CalendarDays },
        { name: "Organizational Knowledge", href: "/knowledge", icon: Sparkles },
      ],
    },
    {
      header: "Automation & Ecosystem",
      items: [
        { name: "Calendar Schedule", href: "/calendar", icon: CalendarDays },
        { name: "Absentee Follow-ups", href: "/followups", icon: MailCheck },
        { name: "Workflow Automations", href: "/automations", icon: Zap },
        { name: "Integrations Center", href: "/integrations", icon: Cable },
      ],
    },
    {
      header: "Governance",
      items: [
        ...(currentRole === "Admin" || currentRole === "Team Lead"
          ? [
              { name: "Team Directory", href: "/team", icon: Users },
              { name: "AI Quality & Benchmarks", href: "/quality", icon: LineChart },
              { name: "Audit Trail & Logs", href: "/audit", icon: ShieldCheck },
            ]
          : []),
        { name: "Preferences & Settings", href: "/settings", icon: Settings },
        { name: "Help & Learning Guide", href: "/help", icon: BookOpen },
      ],
    },
  ];

  return (
    <aside className="w-64 flex-shrink-0 border-r border-[var(--mt-border)] bg-[var(--mt-surface)] flex flex-col h-screen sticky top-0 select-none z-30 transition-colors">
      {/* Brand Header */}
      <div className="p-4 border-b border-[var(--mt-border)]">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-600 to-brand-400 flex items-center justify-center text-white font-bold shadow-md shadow-brand-500/20 group-hover:scale-105 transition-transform">
            ✦
          </div>
          <div>
            <div className="text-[1.05rem] font-bold tracking-tight text-[var(--mt-text)] leading-none flex items-center gap-1.5">
              MeetIntel AI
            </div>
            <div className="text-[0.72rem] font-medium text-[var(--mt-text-secondary)] mt-1 tracking-wide">
              Meeting-to-Execution
            </div>
          </div>
        </Link>

        {/* Workspace & Role Pill */}
        <div className="mt-4 p-2.5 rounded-lg bg-[var(--mt-primary-subtle)] border border-brand-500/15 flex items-center justify-between">
          <div className="overflow-hidden">
            <div className="text-[0.62rem] font-bold text-brand-500 uppercase tracking-wider">
              Workspace
            </div>
            <div className="text-xs font-semibold text-[var(--mt-text)] truncate">
              Acme Global
            </div>
          </div>
          <span
            className={`text-[0.68rem] font-semibold px-2 py-0.5 rounded-full border ${
              currentRole === "Admin"
                ? "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20"
                : currentRole === "Team Lead"
                ? "bg-brand-500/10 text-brand-600 dark:text-brand-400 border-brand-500/20"
                : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
            }`}
          >
            {currentRole}
          </span>
        </div>
      </div>

      {/* Navigation Sections */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-5">
        {navSections.map((sec) => (
          <div key={sec.header}>
            <div className="px-2.5 mb-1.5 text-[0.68rem] font-bold text-[var(--mt-text-muted)] uppercase tracking-wider">
              {sec.header}
            </div>
            <div className="space-y-0.5">
              {sec.items.map((item) => {
                const Icon = item.icon;
                const isActive =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(item.href);

                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium transition-all ${
                      isActive
                        ? "bg-brand-500 text-white shadow-sm shadow-brand-500/25 font-semibold"
                        : "text-[var(--mt-text-secondary)] hover:bg-[var(--mt-surface-soft)] hover:text-[var(--mt-text)]"
                    }`}
                  >
                    <Icon
                      className={`w-4 h-4 flex-shrink-0 ${
                        isActive ? "text-white" : "text-[var(--mt-text-muted)]"
                      }`}
                    />
                    <span className="truncate">{item.name}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* User Footer */}
      <div className="p-3 border-t border-[var(--mt-border)] bg-[var(--mt-surface-soft)]/50">
        <div className="flex items-center gap-2.5 p-1.5 rounded-lg">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-400 to-indigo-600 text-white font-bold text-xs flex items-center justify-center flex-shrink-0">
            {userName.charAt(0)}
          </div>
          <div className="overflow-hidden flex-1">
            <div className="text-xs font-semibold text-[var(--mt-text)] truncate">
              {userName}
            </div>
            <div className="text-[0.7rem] text-[var(--mt-text-secondary)] truncate">
              {userEmail}
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
};
