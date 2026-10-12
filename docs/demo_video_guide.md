# 3-Minute PTW Demo Video Production Guide & Script

This guide outlines how to record, script, and produce a high-impact, professional demo video under 3 minutes, focusing on the end-to-end Permit-to-Work (PTW) lifecycle.

---

## 1. Recommended Recording Tools (Mac)

| Tool | Best For | Why Use It |
|---|---|---|
| **Screen Studio** *(Recommended)* | Polished product demos | Auto-zooms on mouse clicks, smooth cursor paths, clean studio backgrounds, zero editing effort. |
| **CleanShot X** | Quick recording | Crisp 60fps capture, microphone + internal audio, custom canvas frames. |
| **OBS Studio** | Free / Open Source | Free, configurable scenes, no watermark. |
| **QuickTime Player** | Built-in macOS | `Cmd + Shift + 5` -> Record Selected Portion -> No install required. |

---

## 2. Pre-Recording Checklist

1. **Resolution & Scaling**: Set browser zoom to `100%` or `110%` for crisp text readability at 1080p/4K.
2. **Clean Environment**:
   - Hide browser bookmarks bar (`Cmd + Shift + B` in Chrome).
   - Use Fullscreen or a focused window (`1920x1080` aspect ratio).
   - Turn on "Do Not Disturb" on macOS.
3. **Seed Data**: Ensure you have realistic demo data pre-populated (plant name, equipment tag, contractor details, active permits).
4. **Theme**: Use the **Control Room** or **Ledger Slate** theme for a sleek enterprise look.

---

## 3. 3-Minute Video Timeline Breakdown

```
0:00 - 0:25  | Hook & Operations Dashboard (Context & Overview)
0:25 - 1:15  | Permit Creation & Risk Assessment (Draft -> Review)
1:15 - 1:55  | LOTO Lockout Verification & Approval Gate (Safety Check)
1:55 - 2:35  | Issuance, Live Work Monitoring & SIMOPS Conflict Check
2:35 - 3:00  | Handback, Closeout & Audit Trail (Full Lifecycle Complete)
```

---

## 4. Scene-by-Scene Script & Walkthrough

### Scene 1: Dashboard & Operations Overview (0:00 – 0:25)
- **Screen**: `/dashboard` or `/active-permits`
- **Actions**:
  1. Open the main Dashboard.
  2. Hover over the KPI summary cards (Active Permits, Critical Hazards, Pending LOTO).
  3. Briefly toggle between dark/light mode or show the plant switcher.
- **Voiceover**:
  > *"Welcome to the Next-Gen Industrial Permit-to-Work and LOTO platform. Built for mission-critical operations, it ensures zero-compromise safety compliance and full lifecycle visibility. Let's walk through issuing and closing a high-risk permit."*

---

### Scene 2: Draft Creation & Risk Matrix (0:25 – 1:15)
- **Screen**: `/permits` -> `/permits/new` (or permit details)
- **Actions**:
  1. Click **"+ New Permit"**.
  2. Select Permit Type: *Hot Work (Welding on Flare Header)*.
  3. Select Location & Unit, assign Contractor.
  4. Fill Hazard Assessment & PPE checklist.
  5. Click **"Submit for Approval"**.
- **Voiceover**:
  > *"Initiating a permit takes seconds. The intelligent form guides the requester through location validation, risk scoring, and required PPE. Before submission, automated safety rules identify cross-dependencies and mandate isolation controls."*

---

### Scene 3: LOTO Isolation & Multi-Level Approvals (1:15 – 1:55)
- **Screen**: `/lototo` -> `/approvals`
- **Actions**:
  1. Navigate to the linked LOTO Certificate.
  2. Show isolation steps (Mechanical valve lockout + Electrical breaker tagout).
  3. Mark verification checklist complete.
  4. Switch to `/approvals`, approve permit with Safety Officer role.
- **Voiceover**:
  > *"Safety integrity is verified before a permit goes live. Here, the linked Lockout/Tagout certificate outlines mechanical and electrical isolation points. Once field verification and signatures are completed, the Safety Officer reviews and signs off."*

---

### Scene 4: SIMOPS Check & Live Work Execution (1:55 – 2:35)
- **Screen**: `/simops` -> `/execution` or `/active-permits`
- **Actions**:
  1. Switch to the **SIMOPS Matrix / Map** showing active overlapping permits in the same zone.
  2. Demonstrate the live permit badge in **ACTIVE / WORK IN PROGRESS** status.
  3. Show the real-time validity timer and gas test check-in log.
- **Voiceover**:
  > *"The SIMOPS engine continuously scans for spatial and hazard conflicts, alerting supervisors to concurrent jobs in the same unit. Now marked Active, the permit tracks live validity windows and ongoing gas test readings."*

---

### Scene 5: Work Completion, Handback & Audit Trail (2:35 – 3:00)
- **Screen**: `/closure` -> `/reports` or Permit History modal
- **Actions**:
  1. Click **"Handback & Complete"**.
  2. Confirm site housekeeping and de-isolation verification.
  3. Open the Permit Summary to show the complete tamper-evident audit timeline.
- **Voiceover**:
  > *"Once work concludes, the handback flow confirms de-isolation, housekeeping, and final sign-off. Every transition, signature, and timestamp is immutably logged in the audit trail. Enterprise safety, streamlined and compliant."*

---

## 5. Voiceover & Audio Tips

1. **Option A (AI Voiceover - Fastest & Most Professional)**:
   - Paste the script into [ElevenLabs](https://elevenlabs.io/) (choose voices like *"Adam"*, *"Marcus"*, or *"Rachel"* for corporate enterprise tone).
   - Sync the generated audio with your screen capture in CapCut, Screen Studio, or iMovie.
2. **Option B (Record Yourself)**:
   - Use a USB microphone or headset.
   - Speak with steady pacing (approx. 130–140 words per minute).
3. **Background Music**:
   - Use subtle, low-volume ambient corporate tech music (volume at ~10-15% under voice).
