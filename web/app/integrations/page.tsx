"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Cable,
  CheckCircle2,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  Video,
  Calendar,
  Mail,
  CalendarDays,
} from "lucide-react";
import { api } from "@/lib/api";
import { IntegrationStatus } from "@/lib/types";

export default function IntegrationsPage() {
  const [integrations, setIntegrations] = useState<IntegrationStatus[]>(api.getIntegrations());
  const [testingProvider, setTestingProvider] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ provider: string; message: string } | null>(null);

  const handleTest = (provider: string) => {
    setTestingProvider(provider);
    setTimeout(() => {
      const res = api.testIntegration(provider);
      setIntegrations(api.getIntegrations());
      setTestingProvider(null);
      setTestResult({ provider, message: `${res.message} (Latency: ${res.latency_ms}ms)` });
      setTimeout(() => setTestResult(null), 4000);
    }, 800);
  };

  const getIcon = (provider: string) => {
    switch (provider) {
      case "google_meet":
        return <Video className="w-5 h-5 text-emerald-500" />;
      case "google_calendar":
        return <Calendar className="w-5 h-5 text-blue-500" />;
      case "zoom":
        return <Video className="w-5 h-5 text-blue-600" />;
      case "email_smtp":
        return <Mail className="w-5 h-5 text-purple-500" />;
      default:
        return <Cable className="w-5 h-5 text-brand-500" />;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[var(--mt-border)]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[0.68rem] font-bold uppercase tracking-wider text-brand-500 bg-brand-500/10 px-2.5 py-0.5 rounded-full border border-brand-500/20">
              Ecosystem Connectivity
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--mt-text)]">
            Enterprise Integrations Center
          </h1>
          <p className="text-xs text-[var(--mt-text-secondary)] mt-1">
            Manage authorized connections to Google Workspace, Zoom Cloud, and transactional email services.
          </p>
        </div>
      </div>

      {testResult && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4" />
          <span>{testResult.message}</span>
        </div>
      )}

      {/* Grid of integrations */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {integrations.map((item) => (
          <div
            key={item.provider}
            className="p-6 rounded-2xl bg-[var(--mt-surface)] border border-[var(--mt-border)] shadow-card hover:border-brand-500/30 transition-all flex flex-col justify-between gap-4"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[var(--mt-surface-soft)] flex items-center justify-center">
                    {getIcon(item.provider)}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-[var(--mt-text)]">
                      {item.display_name}
                    </h3>
                    <div className="text-[0.7rem] text-[var(--mt-text-secondary)]">
                      {item.account_email || "System Service Account"}
                    </div>
                  </div>
                </div>

                <span
                  className={`text-[0.68rem] font-bold px-2.5 py-0.5 rounded-full ${
                    item.status === "Connected"
                      ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                      : "bg-amber-500/10 text-amber-600 border border-amber-500/20"
                  }`}
                >
                  ● {item.status}
                </span>
              </div>

              {/* Supported Features */}
              <div className="space-y-1 pt-1">
                <div className="text-[0.68rem] font-bold text-[var(--mt-text-muted)] uppercase tracking-wider">
                  Active Capabilities:
                </div>
                <div className="space-y-1">
                  {item.features.map((feat, i) => (
                    <div key={i} className="text-xs text-[var(--mt-text-secondary)] flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-brand-500 flex-shrink-0" />
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-[var(--mt-border)] flex items-center justify-between text-xs flex-wrap gap-2">
              <span className="text-[0.7rem] text-[var(--mt-text-muted)]">
                Last Ping: {item.last_sync ? new Date(item.last_sync).toLocaleTimeString() : "Ready"}
              </span>

              <div className="flex items-center gap-2">
                {item.provider === "google_calendar" && (
                  <Link
                    href="/calendar"
                    className="px-3 py-1.5 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 text-xs font-semibold hover:bg-blue-500/20 transition-all flex items-center gap-1"
                  >
                    <CalendarDays className="w-3.5 h-3.5" />
                    <span>Open Calendar</span>
                  </Link>
                )}

                <button
                  onClick={() => handleTest(item.provider)}
                  disabled={testingProvider === item.provider}
                  className="px-3.5 py-1.5 rounded-lg bg-[var(--mt-surface-soft)] hover:bg-brand-500 hover:text-white border border-[var(--mt-border)] text-xs font-semibold text-[var(--mt-text)] transition-all flex items-center gap-1.5 disabled:opacity-50"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${
                      testingProvider === item.provider ? "animate-spin text-brand-500" : ""
                    }`}
                  />
                  <span>{testingProvider === item.provider ? "Testing..." : "Test Connection"}</span>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
