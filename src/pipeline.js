// Derived from the "ITSM Project - GENAI Engine" n8n export (29 nodes).
// Endpoints, collection names, credentials and internal branding are left out.

export const STEPS = [
  { t: 'Upload', d: 'An incident log arrives through a secure internal form.', ai: false },
  { t: 'Read', d: 'An AI agent reads the headers and keeps only the columns the audit needs.', ai: true },
  { t: 'Clean', d: 'ETL normalises timestamps and computes overrun days for each ticket.', ai: false },
  { t: 'Judge', d: 'A RAG agent checks every ticket against the SLA document itself.', ai: true },
  { t: 'Sort', d: 'Breached tickets are classified into 12 incident categories.', ai: true },
  { t: 'Price', d: 'A second RAG agent pulls the penalty rate and cap; credits are calculated per vendor.', ai: true },
  { t: 'Report', d: 'An executive HTML dashboard and an Excel file, ready for review.', ai: false },
];

export function pipelineHTML() {
  const items = STEPS.map(
    (s, i) => `
    <li class="pipe-step${s.ai ? ' is-ai' : ''}" style="--i:${i}">
      <span class="pipe-node" aria-hidden="true"></span>
      <span class="pipe-n">${String(i + 1).padStart(2, '0')}</span>
      <span class="pipe-t">${s.t}${s.ai ? '<em>AI agent</em>' : ''}</span>
      <span class="pipe-d">${s.d}</span>
    </li>`,
  ).join('');
  return `<ol class="pipe"><span class="pipe-line" aria-hidden="true"><span class="pipe-fill"></span><span class="pipe-pulse"></span></span>${items}</ol>`;
}
