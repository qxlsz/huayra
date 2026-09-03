export const WINDOW_OPTIONS = Object.freeze({
  width: 1280,
  height: 800,
  backgroundColor: "#11111b",
  autoHideMenuBar: true,
  title: "Huayra",
});

export function shouldQuitOnLastWindow(platform = process.platform) {
  return platform !== "darwin";
}
