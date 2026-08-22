"use client";

import { useState } from "react";
import { Check, Copy, X } from "lucide-react";
import type { AuditReport, AuditSuggestion, HonestyFlag, KeywordStatus } from "@/types/audit";

type AuditCardProps = {
  report: AuditReport;
  compact?: boolean;
};

export default function AuditCard({ report, compact = false }: AuditCardProps) {
  const [copiedRank, setCopiedRank] = useState<number | null>(null);

  const copySuggestion = async (suggestion: AuditSuggestion) => {
    const text = `${suggestion.change}\nLocation: ${suggestion.location}\nHonesty: ${formatFlag(suggestion.honestyFlag)}`;
    await navigator.clipboard.writeText(text);
    setCopiedRank(suggestion.rank);
    window.setTimeout(() => setCopiedRank(null), 1500);
  };

  return (
    <div className={`audit-card ${compact ? "compact" : ""}`}>
      <div className="audit-card-header">
        <div>
          <span>ATS Audit</span>
          <strong className={`audit-score ${scoreTone(report.score)}`}>{report.score}%</strong>
        </div>
        <span>{new Date(report.generatedAt).toLocaleDateString()}</span>
      </div>

      {!compact && (
        <>
          <section className="audit-section">
            <h4>Keyword Match</h4>
            <div className="audit-keyword-table">
              {report.keywordResults.map((item) => (
                <div key={`${item.category}-${item.keyword}`} className="audit-keyword-row">
                  <strong>{item.keyword}</strong>
                  <span className={`audit-badge ${statusTone(item.status)}`}>{formatStatus(item.status)}</span>
                  <p>{item.reason}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="audit-section">
            <h4>Format Check</h4>
            <div className="audit-format-list">
              {report.formatResults.map((item) => (
                <div key={item.id}>
                  {item.passed ? <Check size={15} /> : <X size={15} />}
                  <span>{item.label}</span>
                  <p>{item.detail}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="audit-section">
            <h4>Gaps</h4>
            {report.gaps.length === 0 ? (
              <p className="audit-empty">No missing or weak keywords found.</p>
            ) : (
              <div className="audit-gap-list">
                {report.gaps.map((gap) => (
                  <div key={`${gap.category}-${gap.keyword}`}>
                    <strong>{gap.keyword}</strong>
                    <span className={`audit-badge ${statusTone(gap.status)}`}>{formatStatus(gap.status)}</span>
                    <span className={`audit-badge ${flagTone(gap.honestyFlag)}`}>{formatFlag(gap.honestyFlag)}</span>
                    <p>{gap.whyItMatters}</p>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="audit-section">
            <h4>Fix Suggestions</h4>
            <div className="audit-suggestion-list">
              {report.suggestions.map((suggestion) => (
                <div key={`${suggestion.rank}-${suggestion.keyword}`}>
                  <div>
                    <strong>{suggestion.rank}. {suggestion.keyword}</strong>
                    <span className={`audit-badge ${flagTone(suggestion.honestyFlag)}`}>
                      {formatFlag(suggestion.honestyFlag)}
                    </span>
                  </div>
                  <p>{suggestion.change}</p>
                  <span>{suggestion.location} | +{suggestion.estimatedImpact} possible points</span>
                  <button type="button" onClick={() => copySuggestion(suggestion)}>
                    <Copy size={14} />
                    {copiedRank === suggestion.rank ? "Copied" : "Copy"}
                  </button>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function scoreTone(score: number): string {
  if (score < 70) return "low";
  if (score <= 85) return "medium";
  return "high";
}

function statusTone(status: KeywordStatus): string {
  if (status === "present") return "good";
  if (status === "weak") return "warn";
  return "bad";
}

function flagTone(flag: HonestyFlag): string {
  if (flag === "safe") return "good";
  if (flag === "verify_first") return "warn";
  return "bad";
}

function formatStatus(status: KeywordStatus): string {
  return status.replace("_", " ");
}

function formatFlag(flag: HonestyFlag): string {
  return flag.replace(/_/g, " ");
}
