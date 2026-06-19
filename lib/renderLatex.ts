import type { ResumeProfile } from "@/types/profile";

export function renderResumeLatex(profile: ResumeProfile): string {
  const skillsBlock = profile.skills
    .map((skill) => `     \\textbf{${escapeLatex(skill.category)}}{: ${skill.items.map(escapeLatex).join(", ")}} \\\\`)
    .join("\n");

  const projectsBlock = profile.projects
    .map(
      (project) => `
      \\resumeProjectHeading
          {\\textbf{${escapeLatex(project.title)}} $|$ \\emph{${escapeLatex(project.tags)}}}{${escapeLatex(project.status)}}
          \\resumeItemListStart
${project.bullets.map((bullet) => `            \\resumeItem{${escapeLatex(bullet)}}`).join("\n")}
          \\resumeItemListEnd`
    )
    .join("\n");

  const experienceBlock = profile.experience
    .map(
      (experience) => `
    \\resumeSubheading
      {${escapeLatex(experience.title)}}{${escapeLatex(experience.dates)}}
      {${escapeLatex(experience.company)}}{${escapeLatex(experience.location)}}
      \\resumeItemListStart
${experience.bullets.map((bullet) => `        \\resumeItem{${escapeLatex(bullet)}}`).join("\n")}
      \\resumeItemListEnd`
    )
    .join("\n");

  return `\\documentclass[letterpaper,11pt]{article}

\\usepackage{latexsym}
\\usepackage[empty]{fullpage}
\\usepackage{titlesec}
\\usepackage{marvosym}
\\usepackage[usenames,dvipsnames]{color}
\\usepackage{verbatim}
\\usepackage{enumitem}
\\usepackage[hidelinks]{hyperref}
\\usepackage{fancyhdr}
\\usepackage[english]{babel}
\\usepackage{tabularx}
\\input{glyphtounicode}

\\pagestyle{fancy}
\\fancyhf{}
\\fancyfoot{}
\\renewcommand{\\headrulewidth}{0pt}
\\renewcommand{\\footrulewidth}{0pt}

\\addtolength{\\oddsidemargin}{-0.5in}
\\addtolength{\\evensidemargin}{-0.5in}
\\addtolength{\\textwidth}{1in}
\\addtolength{\\topmargin}{-.5in}
\\addtolength{\\textheight}{1.0in}

\\urlstyle{same}
\\raggedbottom
\\raggedright
\\setlength{\\tabcolsep}{0in}

\\titleformat{\\section}{
  \\vspace{-4pt}\\scshape\\raggedright\\large
}{}{0em}{}[\\color{black}\\titlerule \\vspace{-5pt}]

\\pdfgentounicode=1

\\newcommand{\\resumeItem}[1]{
  \\item\\small{
    {#1 \\vspace{-2pt}}
  }
}

\\newcommand{\\resumeSubheading}[4]{
  \\vspace{-2pt}\\item
    \\begin{tabular*}{0.97\\textwidth}[t]{l@{\\extracolsep{\\fill}}r}
      \\textbf{#1} & #2 \\\\
      \\textit{\\small#3} & \\textit{\\small #4} \\\\
    \\end{tabular*}\\vspace{-7pt}
}

\\newcommand{\\resumeProjectHeading}[2]{
    \\item
    \\begin{tabular*}{0.97\\textwidth}{l@{\\extracolsep{\\fill}}r}
      \\small#1 & #2 \\\\
    \\end{tabular*}\\vspace{-7pt}
}

\\newcommand{\\resumeSubHeadingListStart}{\\begin{itemize}[leftmargin=0.15in, label={}]}
\\newcommand{\\resumeSubHeadingListEnd}{\\end{itemize}}
\\newcommand{\\resumeItemListStart}{\\begin{itemize}}
\\newcommand{\\resumeItemListEnd}{\\end{itemize}\\vspace{-5pt}}

\\begin{document}

\\begin{center}
    \\textbf{\\Huge \\scshape ${escapeLatex(profile.header.name)}} \\\\ \\vspace{1pt}
    \\small ${escapeLatex(profile.header.phone)} $|$
    \\href{mailto:${escapeUrl(profile.header.email)}}{\\underline{${escapeLatex(profile.header.email)}}} $|$
    \\href{https://${escapeUrl(profile.header.linkedin)}}{\\underline{${escapeLatex(profile.header.linkedin)}}} $|$
    \\href{https://${escapeUrl(profile.header.github)}}{\\underline{${escapeLatex(profile.header.github)}}}
\\end{center}

\\section{Education}
  \\resumeSubHeadingListStart
${profile.education.map((ed) => `    \\resumeSubheading{${escapeLatex(ed.school)}}{${escapeLatex(ed.location)}}{${escapeLatex(ed.degree)}}{${escapeLatex(ed.dates)}}`).join("\n")}
  \\resumeSubHeadingListEnd

\\section{Skills}
 \\begin{itemize}[leftmargin=0.15in, label={}]
    \\small{\\item{
${skillsBlock}
    }}
 \\end{itemize}

\\section{Projects}
    \\resumeSubHeadingListStart
${projectsBlock}
    \\resumeSubHeadingListEnd

\\section{Experience}
  \\resumeSubHeadingListStart
${experienceBlock}
  \\resumeSubHeadingListEnd

\\end{document}
`;
}

export function escapeLatex(value: string): string {
  return value
    .replace(/\\/g, "\\textbackslash{}")
    .replace(/&/g, "\\&")
    .replace(/%/g, "\\%")
    .replace(/\$/g, "\\$")
    .replace(/#/g, "\\#")
    .replace(/_/g, "\\_")
    .replace(/{/g, "\\{")
    .replace(/}/g, "\\}")
    .replace(/~/g, "\\textasciitilde{}")
    .replace(/\^/g, "\\textasciicircum{}");
}

function escapeUrl(value: string): string {
  return value.trim().replace(/\s/g, "%20");
}
