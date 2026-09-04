/* ============================================================ CONFIG ============================================================
   The one file that makes this copy of the app Tara's. Everything else in
   the shell (app.js, lift.js, schedule.js, drag.js, styles.css, index.html,
   sw.js) is byte-identical across the sibling apps and is synced from the
   routines repo with its claude_workspace/sync-shell.sh — never edited here.

   dbKey and the CACHE name in sw.js must differ from every sibling: all the
   apps are served from adanerusmani.com, and localStorage is per-origin,
   so a shared key would merge two people's logs. Never rename either back. */
const APP = {
  name: "Tara",
  dbKey: "tara.v1",
  exportTitle: "Tara export",
  exportFile:  "tara-export",
  exportHint:  "send it to Adaner for Sunday",
  notesLabel:  "To send",
  notesIntro:  "Anything next week's programming should take into account — what hurt, what " +
               "felt easy, what you skipped. Kept on this device until you export: the app has no server, so " +
               "<strong>tap Copy everything on Sunday and send it to Adaner</strong>. That is the whole hand-off.",
  areas: {
    mobility: { label:"Prehab", cap:"daily, non-negotiable" },
    cardio:   { label:"Cardio", cap:"swim, spin, tennis" }
  },
  history: false,                            // no Hevy import, no baked history.js
  textScale: 1
};
