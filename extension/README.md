# JobOps AI Chrome Extension

This is the Sprint 2 Manifest V3 extension. It captures the active HTTP(S)
page, sends the visible text to the local Next.js ingestion route, and shows
created/duplicate/error states.

## Load locally

1. Start JobOps locally with `JOBOPS_LOCAL_TOKEN` configured, for example at
    `http://127.0.0.1:3000`.
2. Open `chrome://extensions`.
3. Enable **Developer mode**.
4. Choose **Load unpacked** and select this `extension/` directory.
5. Open the extension popup, enter the local app URL and the same local token,
   then save settings.

The token is stored in Chrome extension storage and is only sent to a loopback
JobOps ingestion endpoint. It is never exposed to the captured page.

## Scope

The extension uses `activeTab`, `scripting`, `storage`, and `tabs`. It does not
call Ollama, automate applications, access Gmail, or scrape saved-job pages.