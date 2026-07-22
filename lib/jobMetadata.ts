export function inferJobMetadata(text: string, url?: string, pageTitle?: string): { title: string; company: string } {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const title =
    matchLabeledValue(lines, /^(job\s*title|position|role|title)\s*[:\-]\s*(.+)$/i) ||
    inferTitleFromPageTitle(pageTitle || "") ||
    firstLikelyTitle(lines) ||
    "Saved job";
  const company =
    matchLabeledValue(lines, /^(company|organization|employer)\s*[:\-]\s*(.+)$/i) ||
    inferCompanyFromPageTitle(pageTitle || "") ||
    inferCompanyFromUrl(url || "") ||
    firstLikelyCompany(lines, title) ||
    "Company not specified";

  return { title, company };
}

function matchLabeledValue(lines: string[], pattern: RegExp): string {
  for (const line of lines.slice(0, 20)) {
    const match = line.match(pattern);
    if (match?.[2]) return cleanMetadataValue(match[2]);
  }
  return "";
}

function firstLikelyTitle(lines: string[]): string {
  const blocked = /^(about|overview|job description|description|responsibilities|requirements|qualifications|benefits|who we are|company)$/i;
  const line = lines.find((item) => item.length >= 4 && item.length <= 90 && !blocked.test(item));
  return line ? cleanMetadataValue(line) : "";
}

function firstLikelyCompany(lines: string[], title: string): string {
  const titleIndex = lines.findIndex((line) => cleanMetadataValue(line) === title);
  const candidate = titleIndex >= 0 ? lines[titleIndex + 1] : "";
  if (!candidate || candidate.length > 70) return "";
  if (/^(remote|hybrid|full-time|part-time|internship|contract|job description)$/i.test(candidate)) return "";
  return cleanMetadataValue(candidate);
}

function inferTitleFromPageTitle(value: string): string {
  const clean = cleanMetadataValue(value);
  if (!clean) return "";
  const parts = clean.split(/\s+(?:-|\u2013|\||at)\s+/i).map(cleanMetadataValue).filter(Boolean);
  return parts[0] || "";
}

function inferCompanyFromPageTitle(value: string): string {
  const clean = cleanMetadataValue(value);
  if (!clean) return "";
  const parts = clean.split(/\s+(?:-|\u2013|\||at)\s+/i).map(cleanMetadataValue).filter(Boolean);
  return parts.length > 1 ? parts[parts.length - 1] : "";
}

function inferCompanyFromUrl(value: string): string {
  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^www\./, "");
    const pathParts = url.pathname.split("/").filter(Boolean);
    if (host.includes("greenhouse.io") || host.includes("lever.co") || host.includes("ashbyhq.com")) {
      return cleanMetadataValue(pathParts[0] || "");
    }
    return cleanMetadataValue(host.split(".")[0] || "");
  } catch {
    return "";
  }
}

function cleanMetadataValue(value: string): string {
  return value
    .replace(/\s+/g, " ")
    .replace(/\s*\|\s*.*$/g, "")
    .replace(/\s*-\s*(careers|jobs|greenhouse|lever|ashby|indeed).*$/i, "")
    .trim();
}
