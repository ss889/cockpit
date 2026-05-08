'use client';

import { AnalysisResult } from '@/types';

interface AnalysisPanelProps {
  analysis: AnalysisResult | null;
  isLoading: boolean;
  onSave?: (title: string) => void;
}

const Pill: React.FC<{ children: React.ReactNode; variant: 'green' | 'orange' | 'indigo' | 'zinc' }> = ({ children, variant }) => {
  const styles = {
    green: 'bg-green-900 text-green-300 border border-green-700',
    orange: 'bg-orange-900 text-orange-300 border border-orange-700',
    indigo: 'bg-indigo-900 text-indigo-300 border border-indigo-700',
    zinc: 'bg-zinc-800 text-zinc-300',
  };

  return (
    <span className={`inline-block px-2.5 py-1 rounded text-xs font-medium ${styles[variant]}`}>
      {children}
    </span>
  );
};

const AnalysisPanel: React.FC<AnalysisPanelProps> = ({ analysis, isLoading, onSave }) => {
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-64 bg-zinc-800 rounded-lg border border-zinc-700 animate-pulse" />
        <div className="h-64 bg-zinc-800 rounded-lg border border-zinc-700 animate-pulse" />
        <div className="h-64 bg-zinc-800 rounded-lg border border-zinc-700 animate-pulse" />
      </div>
    );
  }

  if (!analysis || (!analysis.parsed && !analysis.gap && !analysis.projects)) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Card 1: Role Overview */}
      {analysis.parsed && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
          <div className="mb-4">
            <h2 className="text-lg font-bold text-zinc-100 mb-2">
              {analysis.parsed.job_title}
            </h2>
            <p className="text-sm text-zinc-400 mb-3">{analysis.parsed.company}</p>
            <div className="flex gap-2 mb-4">
              <Pill variant="indigo">{analysis.parsed.role_type}</Pill>
              <Pill variant="zinc">{analysis.parsed.seniority}</Pill>
            </div>
          </div>

          <div className="mb-4">
            <h3 className="text-xs font-semibold text-zinc-400 mb-2 uppercase tracking-wide">
              Top Responsibilities
            </h3>
            <ul className="space-y-1 text-sm text-zinc-300">
              {analysis.parsed.top_responsibilities.map((resp, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-indigo-400">•</span>
                  <span>{resp}</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-zinc-400 mb-2 uppercase tracking-wide">
              Required Skills
            </h3>
            <div className="flex flex-wrap gap-2 mb-4">
              {analysis.parsed.required_skills.map((skill) => (
                <Pill key={skill} variant="indigo">
                  {skill}
                </Pill>
              ))}
            </div>

            {analysis.parsed.preferred_skills.length > 0 && (
              <>
                <h3 className="text-xs font-semibold text-zinc-400 mb-2 uppercase tracking-wide">
                  Preferred Skills
                </h3>
                <div className="flex flex-wrap gap-2">
                  {analysis.parsed.preferred_skills.map((skill) => (
                    <Pill key={skill} variant="zinc">
                      {skill}
                    </Pill>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Card 2: Gap Analysis */}
      {analysis.gap && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
          <div className="mb-4">
            <div className="flex items-baseline gap-2 mb-4">
              <span className="text-4xl font-bold text-indigo-400">
                {analysis.gap.fit_score}
              </span>
              <Pill variant="indigo">{analysis.gap.fit_label}</Pill>
            </div>
          </div>

          <div className="mb-4">
            <h3 className="text-xs font-semibold text-zinc-400 mb-2 uppercase tracking-wide">
              Matching Skills
            </h3>
            <div className="flex flex-wrap gap-2 mb-4">
              {analysis.gap.matching_skills.map((skill) => (
                <Pill key={skill} variant="green">
                  {skill}
                </Pill>
              ))}
            </div>
          </div>

          <div className="mb-4">
            <h3 className="text-xs font-semibold text-zinc-400 mb-2 uppercase tracking-wide">
              Gap Skills
            </h3>
            <div className="flex flex-wrap gap-2 mb-4">
              {analysis.gap.gap_skills.map((skill) => (
                <Pill key={skill} variant="orange">
                  {skill}
                </Pill>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-zinc-400 mb-2 uppercase tracking-wide">
              Analysis
            </h3>
            <p className="text-sm text-zinc-300 leading-relaxed">
              {analysis.gap.gap_summary}
            </p>
          </div>
        </div>
      )}

      {/* Card 3: Suggested Projects */}
      {analysis.projects && (
        <div className="space-y-3">
          {analysis.projects.projects.map((project, idx) => (
            <div key={idx} className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
              <div className="mb-3">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-base font-bold text-zinc-100">
                    {project.title}
                  </h3>
                  <Pill variant="zinc">{project.difficulty}</Pill>
                </div>
                <p className="text-sm text-zinc-300 leading-relaxed mb-3">
                  {project.description}
                </p>
              </div>

              <div className="mb-3">
                <h4 className="text-xs font-semibold text-zinc-400 mb-2 uppercase tracking-wide">
                  Skills Addressed
                </h4>
                <div className="flex flex-wrap gap-2">
                  {project.skills_addressed.map((skill) => (
                    <Pill key={skill} variant="indigo">
                      {skill}
                    </Pill>
                  ))}
                </div>
              </div>

              <p className="text-xs text-zinc-400 italic">
                {project.why_it_matters}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Save button */}
      {analysis.parsed && onSave && (
        <button
          onClick={() => onSave(analysis.parsed!.job_title)}
          className="w-full px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 font-semibold rounded-lg transition-colors text-sm border border-zinc-700"
        >
          Save this role
        </button>
      )}
    </div>
  );
};

export default AnalysisPanel;
