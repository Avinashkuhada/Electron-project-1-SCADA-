# Project Handoff Notes

Updated: 24/11/2026
Project: AVI Web SCADA / Pharma Intervention Record System (IRS)
Workspace: `D:\demo-electron\avi-web-scada`

## Project Structure

- Electron main process: `src/main/index.js`
- Electron preload: `src/preload/index.js`
- Renderer HTML: `src/renderer/index.html`
- React entry: `src/renderer/src/main.jsx`
- App root: `src/renderer/src/App.jsx`
- Active login and dashboard: `src/renderer/src/components/02_Welcome.jsx`
- User/group/rights screen: `src/renderer/src/components/03_Management.jsx`
- Report views: `src/renderer/src/components/04_reports.jsx`
- Alarm console: `src/renderer/src/components/05_Alarms.jsx`
- Batch setup/control: `src/renderer/src/components/06_BatchControl.jsx`
- Live clock/User/batch footer: `src/renderer/src/components/07_Footer.jsx`
- Live alarm text header: `src/renderer/src/components/08_Header.jsx`
- Shared date/duration utilities: `src/renderer/src/utils/dateTime.js`
- Renderer styles: `src/renderer/src/assets/main.css`
- Electron/Vite configuration: `electron.vite.config.mjs`

`App.jsx` currently renders `02_Welcome.jsx`. `01_Login.jsx` is not the active screen.

## Startup Fixes

The original blank renderer was caused by a stray `MN` token at the end of the starter `App.jsx`, which raised `ReferenceError: MN is not defined`. The starter `Versions` component also read Electron-only APIs directly in a regular browser. These issues were removed/guarded so the renderer works in browser and Electron.

Electron startup diagnostics were added for window creation, renderer URL, load completion/failure, renderer exits, and startup errors. Renderer global errors and React render failures are logged and surfaced. In development, DevTools opens automatically.

Electron loads `ELECTRON_RENDERER_URL` in development and the generated `out/renderer/index.html` in production. The BrowserWindow uses `contextIsolation: true`, `nodeIntegration: false`, `frame: false`, and `fullscreen: true`. The live renderer URL can be `http://localhost:5173/` or another port such as `5174` if 5173 is occupied.

## Current IRS Demo Features

- Login demo credentials: Login ID `Admin`, password `1`.
- Tabs: Batch Overview, Batch Control, Door, Glove, Alarms, Reports, Live Trend, Audit Trail, User Management.
- Door and Glove assets have 12 preventive/corrective/verification activities each.
- An activity can move Pending -> Running -> Complete. Only one intervention per asset can be Running at a time. Running rows are animated.
- Activity codes are seven characters, for example `DR01001` and `GL01001`.
- Batch numbers accept ASCII letters and underscores only. Duplicate checks are case-insensitive. Batch records include product name, equipment name, equipment ID, status, and start/stop timestamps.
- Only one batch may be Running at a time. Batch create/start/stop actions are reflected in the local Audit Trail.
- Header displays rotating active-alarm text only; acknowledgement/deactivation controls are in the Alarm screen.
- Footer displays `DD/MM/YYYY HH:mm:ss`, `User: <id>`, and the selected batch. It does not show an Operator field.
- User Management has Users, Groups, and User Rights screens. User creation requires Login ID, Complete Name, Password, and Group; duplicate Login IDs are rejected.
- Reports are separated into Intervention Activity, Audit Report, and Alarm Report. Each type can export its own CSV.
- Alarm records show active/deactive time, duration, acknowledgement time, and acknowledging user ID.

## Run Commands

Run in PowerShell:

```powershell
Set-Location 'D:\demo-electron\avi-web-scada'
npm run dev
```

Build and preview production output:

```powershell
npm run build
npm start
```

If port 5173 is already used, electron-vite selects another available port. Use the URL printed by the dev command.

## Verification

- `npm run build` passed after the current implementation.
- Error-only ESLint on changed JS files passed.
- Browser workflow checks passed at 1366x768 and 1920x1080 with no document overflow.
- Verified batch creation rejects invalid characters and duplicate IDs, Start/Stop updates status, and activity codes are seven characters.
- Verified audit has five columns and uses `DD/MM/YYYY HH:mm:ss`.
- Verified alarms display the requested lifecycle fields and acknowledge/deactivate actions.
- Verified reports have separate Intervention Activity, Audit, and Alarm views.
- Electron development logs confirmed `did-finish-load` and `ready-to-show` at the selected Vite URL.
- Chromium printed disk-cache permission warnings in this environment, but the renderer loaded successfully.

## Important Limitations

This is currently a frontend demo. Batches, interventions, users, alarms, groups, rights, and audit events are held in memory and disappear when the app restarts. Sample alarm and process data are not connected to PLCs or equipment telemetry. CSV reports are generated locally.

The `Admin` / `1` login is hard-coded demo authentication. New-user password presence is validated, but passwords are not stored or authenticated by a backend. The audit trail is not immutable or compliant electronic-record storage. Do not use this build for official GMP batch records until it is integrated with validated authentication, persistent storage, equipment interfaces, immutable audit controls, and required electronic signatures.
