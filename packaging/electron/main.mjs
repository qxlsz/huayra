import { app, BrowserWindow } from "electron";
import { resolveHuayraUrl } from "../../src/host-url.js";
import { WINDOW_OPTIONS, shouldQuitOnLastWindow } from "./shell.js";

const url = resolveHuayraUrl(process.env);

function createWindow() {
  const win = new BrowserWindow(WINDOW_OPTIONS);
  void win.loadURL(url);
}

app.whenReady().then(createWindow);
app.on("window-all-closed", () => {
  if (shouldQuitOnLastWindow()) {
    app.quit();
  }
});
