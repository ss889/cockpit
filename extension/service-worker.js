import { DEFAULT_AGENT_URL, buildCapture, getIngestUrl } from "./shared.js";

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "CAPTURE_ACTIVE_TAB") return undefined;

  captureActiveTab()
    .then(sendResponse)
    .catch((error) => sendResponse({ ok: false, error: error instanceof Error ? error.message : "Capture failed" }));
  return true;
});

async function captureActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];
  if (!tab?.id || !tab.url || !/^https?:\/\//i.test(tab.url)) {
    throw new Error("Open a normal http or https job page first.");
  }

  const [{ result: visibleText } = {}] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => document.body?.innerText || "",
  });
  const capture = buildCapture(tab, typeof visibleText === "string" ? visibleText : "");
  if (!capture.visibleText) throw new Error("No visible page text was found.");

  const settings = await chrome.storage.local.get({
    agentUrl: DEFAULT_AGENT_URL,
    localToken: "",
  });
  if (!settings.localToken) throw new Error("Add your local token in the extension settings.");

  const response = await fetch(getIngestUrl(settings.agentUrl), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${settings.localToken}`,
    },
    body: JSON.stringify(capture),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `JobOps returned ${response.status}`);

  return { ok: true, action: data.action, jobId: data.jobId, jobOpsUrl: `${settings.agentUrl}/workspace` };
}