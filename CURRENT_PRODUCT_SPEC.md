# TeamGRIT Ops — current product behavior to preserve

## Project detail
- Project status selector.
- Google Drive folder connection.
- Existing Drive files listed in a bounded scroll container.
- Work request + structured detail fields.
- Reference area inside the work-request panel.

## Reference handling
- File chooser and clipboard paste.
- Clipboard paste should accept image/png and image/jpeg exposed by Chrome/Safari, which enables copying rendered frames/images from Figma when Figma writes bitmap data to the clipboard.
- Temporary images stay local to the active browser session and are sent to analysis only; they are not uploaded to Drive automatically.
- Reference links can be stored separately.

## AI
- User can choose Gemini model manually or Auto.
- Auto can fail over across configured models.
- If a specific model is chosen, user can choose whether fallback is allowed.
- Gemini quota dashboard is opened externally for authoritative RPM/TPM/RPD state; in-app usage is only local estimated/returned usage metadata.

## Results
- Visible execution-result list is ephemeral per analysis session.
- Starting a new analysis clears it.
- Re-entering a project should not resurrect old result links from localStorage/project state.
- The actual generated files remain in Google Drive and therefore appear under Existing files.

## Visual system
- TeamGRIT Ops itself: Google Material Design 3.
- Do not apply CoBiz UI design system to TeamGRIT Ops.
- Do not use Drive design-system docs as hidden context for arbitrary user design tasks unless explicitly requested for that task.
