"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Mic,
  Calendar,
  Clock,
  Users,
  Search,
  Filter,
  ArrowRight,
  FileText,
  Sparkles,
} from "lucide-react";
import { api } from "@/lib/api";

export default function MeetingsPage() {
  const [meetings] = useState(api.getMeetings());
  const [search, setSearch] = useState("");
  const [platformFilter, setPlatformFilter] = useState("All");

  const filtered = meetings.filter((m) => {
    if (platformFilter !== "All" && m.source_platform !== platformFilter)
      return false;
    if (
      search &&
      !m.title.toLowerCase().includes(search.toLowerCase()) &&
      !m.executive_summary?.toLowerCase().includes(search.toLowerCase())
    )
      return false;
    return true;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[var(--mt-border)]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[0.68rem] font-bold uppercase tracking-wider text-brand-500 bg-brand-500/10 px-2.5 py-0.5 rounded-full border border-brand-500/20">
              Intelligence Dossiers
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--mt-text)]">
            Meeting Intelligence Library
          </h1>
          <p className="text-xs text-[var(--mt-text-secondary)] mt-1">
            Browse all analyzed meetings, speaker diarizations, extracted decisions, and MoM archives.
          </p>
        </div>

        <Link
          href="/upload"
          className="px-4 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-semibold text-xs shadow-md shadow-brand-500/20 transition-all flex items-center gap-2 self-start md:self-auto"
        >
          <Mic className="w-4 h-4" />
          <span>Ingest Recording</span>
        </Link>
      </div>

      {/* Search & Platform Filter */}
      <div className="p-4 rounded-xl bg-[var(--mt-surface)] border border-[var(--mt-border)] shadow-card flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-[var(--mt-text-muted)] absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search meetings by topic or title..."
            className="w-full pl-9 pr-3 py-1.5 rounded-lg text-xs bg-[var(--mt-surface-soft)] border border-[var(--mt-border)] text-[var(--mt-text)] focus:outline-none focus:border-brand-500"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between sm:justify-end gap-3 w-full sm:w-auto">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-[var(--mt-text-secondary)]">
              Source:
            </span>
            <div className="flex items-center gap-1.5">
              {[
                { id: "All", label: "All" },
                { id: "google_meet", label: "Google Meet" },
                { id: "zoom", label: "Zoom" },
                { id: "upload", label: "Audio Upload" },
              ].map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPlatformFilter(p.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    platformFilter === p.id
                      ? "bg-brand-500 text-white font-semibold shadow-sm"
                      : "bg-[var(--mt-surface-soft)] text-[var(--mt-text)] hover:bg-brand-500/10"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {(search || platformFilter !== "All") && (
            <button
              onClick={() => {
                setSearch("");
                setPlatformFilter("All");
              }}
              className="text-[0.72rem] text-brand-500 hover:underline font-semibold"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Result Count Indicator */}
      <div className="flex items-center justify-between text-xs text-[var(--mt-text-secondary)] px-1">
        <span>
          Showing <strong>{filtered.length}</strong> of <strong>{meetings.length}</strong> meeting dossiers
        </span>
      </div>

      {/* Meetings Grid or Empty State */}
      {filtered.length === 0 ? (
        <div className="p-12 rounded-2xl bg-[var(--mt-surface)] border border-[var(--mt-border)] text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-brand-500/10 text-brand-500 flex items-center justify-center mx-auto">
            <Search className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[var(--mt-text)]">
              No matching meeting dossiers found
            </h3>
            <p className="text-xs text-[var(--mt-text-secondary)] mt-1 max-w-sm mx-auto">
              No meetings matched &quot;{search}&quot;. Try refining your query or clear the filter to see all recordings.
            </p>
          </div>
          <button
            onClick={() => {
              setSearch("");
              setPlatformFilter("All");
            }}
            className="px-4 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-xs font-semibold shadow-sm transition-all"
          >
            Clear Search & Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((m) => {
            const durationMin = Math.floor(m.duration / 60);
            const durationSec = m.duration % 60;

            return (
              <div
                key={m.id}
                className="p-5 rounded-2xl bg-[var(--mt-surface)] border border-[var(--mt-border)] shadow-card hover:border-brand-500/40 hover:shadow-card-hover transition-all flex flex-col justify-between gap-4"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`text-[0.65rem] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                        m.source_platform === "google_meet"
                          ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                          : m.source_platform === "zoom"
                          ? "bg-blue-500/10 text-blue-600 border border-blue-500/20"
                          : "bg-purple-500/10 text-purple-600 border border-purple-500/20"
                      }`}
                    >
                      {m.source_platform.replace("_", " ")}
                    </span>
                    <span className="text-[0.68rem] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                      <Sparkles className="w-3 h-3" /> Fully Analyzed
                    </span>
                  </div>

                  <div>
                    <h3 className="text-base font-bold text-[var(--mt-text)] hover:text-brand-500 transition-colors">
                      {m.title}
                    </h3>
                    <div className="flex items-center gap-3 text-[0.72rem] text-[var(--mt-text-muted)] mt-1">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(m.date).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {durationMin}m {durationSec}s
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {m.speaker_count} Speakers
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-[var(--mt-text-secondary)] line-clamp-2 leading-relaxed">
                    {m.executive_summary}
                  </p>

                  {m.key_topics && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {m.key_topics.map((t) => (
                        <span
                          key={t}
                          className="px-2 py-0.5 rounded-md bg-[var(--mt-surface-soft)] text-[0.68rem] font-medium text-[var(--mt-text-secondary)] border border-[var(--mt-border)]"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-[var(--mt-border)] flex items-center justify-between">
                  <span className="text-[0.7rem] text-[var(--mt-text-muted)]">
                    Audio: {m.filename}
                  </span>

                  <Link
                    href={`/meetings/${m.id}`}
                    className="px-3.5 py-1.5 rounded-lg bg-brand-500 hover:bg-brand-600 text-white font-semibold text-xs transition-colors flex items-center gap-1.5 shadow-sm"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Open Dossier</span>
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
