export default defineBackground(() => {
  // Clicking the toolbar icon opens the side panel (a user gesture the panel
  // later reuses to start screen capture).
  browser.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error: unknown) => console.error('Failed to set side panel behavior', error));
});
