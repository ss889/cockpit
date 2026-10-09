import { execFile } from "node:child_process";
import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type PdfCompileResult = {
  pdf: Buffer;
  compiler: string;
};

export async function resolvePdflatexBinary(): Promise<string> {
  const candidates = new Set<string>();

  const pathEntries = (process.env.PATH ?? "").split(path.delimiter).filter(Boolean);
  for (const entry of pathEntries) {
    candidates.add(path.join(entry, os.platform() === "win32" ? "pdflatex.exe" : "pdflatex"));
  }

  if (os.platform() === "win32") {
    const programFiles = process.env.ProgramFiles ?? "C:\\Program Files";
    const programFilesX86 = process.env["ProgramFiles(x86)"] ?? "C:\\Program Files (x86)";
    const localAppData = process.env.LOCALAPPDATA ?? path.join(process.env.USERPROFILE ?? "C:\\Users\\Default", "AppData", "Local");

    for (const base of [
      path.join(programFiles, "MiKTeX", "miktex", "bin", "x64"),
      path.join(programFilesX86, "MiKTeX", "miktex", "bin", "x64"),
      path.join(localAppData, "Programs", "MiKTeX", "miktex", "bin", "x64"),
      path.join(localAppData, "Programs", "TeX Live", "bin", "windows"),
      path.join("C:\\texlive", "2024", "bin", "windows"),
      path.join("C:\\texlive", "2023", "bin", "windows"),
    ]) {
      candidates.add(path.join(base, os.platform() === "win32" ? "pdflatex.exe" : "pdflatex"));
    }
  }

  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Try the next discovered candidate.
    }
  }

  return os.platform() === "win32" ? "pdflatex.exe" : "pdflatex";
}

export async function compileLatexToPdf(latex: string): Promise<PdfCompileResult> {
  if (!latex.trim()) throw new Error("LaTeX source is required");
  if (!latex.includes("\\begin{document}") || !latex.includes("\\end{document}")) {
    throw new Error("LaTeX source must contain a complete document");
  }

  const directory = await mkdtemp(path.join(os.tmpdir(), "jobops-resume-"));
  const sourcePath = path.join(directory, "resume.tex");
  const pdfPath = path.join(directory, "resume.pdf");
  const pdflatexBinary = await resolvePdflatexBinary();

  try {
    await writeFile(sourcePath, latex, "utf8");
    await execFileAsync(pdflatexBinary, [
      "-interaction=nonstopmode",
      "-halt-on-error",
      "-no-shell-escape",
      "-output-directory",
      directory,
      sourcePath,
    ], { cwd: directory, windowsHide: true, maxBuffer: 2 * 1024 * 1024 });
    return { pdf: await readFile(pdfPath), compiler: path.basename(pdflatexBinary) };
  } catch (error) {
    const detail = error instanceof Error ? error.message : "LaTeX compilation failed";
    throw new Error(detail.includes("ENOENT") ? "pdflatex is not installed or is not on PATH" : detail);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}