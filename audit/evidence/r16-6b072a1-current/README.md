# Independent local-browser evidence — current code HEAD 6b072a1

The PR advanced during the audit. Code/runtime tests here use the subsequent source HEAD `6b072a117c7391f53946770644efca05556572de`, which adds Classic typography/palette styling and fonts; do not merge these results into the exact `ae1c900` CI summary.

- `classic-scripture-shelf.json`: corrected font-family assertion (`GB Classic Literata`) and six mobile shelf scenarios at 320/390 px.
- `live-marks-dialog.json`: same independent two-tab/same-tab and dialog-focus check at 320/390 px.
- `w57-live-preview.json`: W57 integration test at 1280/1440 px; includes an intentional missing-ID fixture that is ambiguous after an inserted duplicate paragraph.
- Corresponding shelf screenshots are in `../r16-6b072a1-classic-scripture/`.

Viewport runs are synthetic Chromium only; not physical-device or WebKit sign-off.
