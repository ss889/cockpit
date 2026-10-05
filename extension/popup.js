import { DEFAULT_AGENT_URL, DEFAULT_JOBOPS_URL } from "./shared.js";

const status = document.querySelector("#status");
const importButton = document.querySelector("#import-button");
const openButton = document.querySelector("#open-button");
const saveButton = document.querySelector("#save-button");
const agentUrl = document.querySelector("#agent-url");
const localToken = document.querySelector("#local-token");
let jobOpsUrl = DEFAULT_JOBOPS_URL;

loadSettings();
importButton.addEventListener("click", importJob);
openButton.addEventListener("click", () => chrome.tabs.create({ url: jobOpsUrl }));
saveButton.addEventListener("click", saveSettings);

async function loadSettings() {
  const settings = await chrome.storage.local.get({ agentUrl: DEFAULT_AGENT_URL, localToken: "" });
  agentUrl.value = settings.agentUrl;
  localToken.value = settings.localToken;
  jobOpsUrl = `${settings.agentUrl}/workspace`;
}

async function saveSettings() {
  const value = agentUrl.value.trim().replace(/\/$/, "");
  if (!/^https?:\/\//i.test(value)) {
    setStatus("Use a valid local http(s) app URL.", true);
    return;
  }
  await chrome.storage.local.set({ agentUrl: value, localToken: localToken.value.trim() });
  jobOpsUrl = `${value}/workspace`;
  setStatus("Connection settings saved.");
}

async function importJob() {
  importButton.disabled = true;
  openButton.classList.add("hidden");
  setStatus("Capturing the active page...");
  try {
    const result = await chrome.runtime.sendMessage({ type: "CAPTURE_ACTIVE_TAB" });
    if (!result?.ok) throw new Error(result?.error || "Import failed.");
    jobOpsUrl = result.jobOpsUrl || jobOpsUrl;
    setStatus(result.action === "duplicate" ? "Already in JobOps." : "Imported successfully.");
    openButton.classList.remove("hidden");
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "Import failed.", true);
  } finally {
    importButton.disabled = false;
  }
}

function setStatus(message, isError = false) {
  status.textContent = message;
  status.style.color = isError ? "#ff9d9d" : "#aeb7c4";
}