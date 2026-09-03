import { app, BrowserWindow } from "electron";
import { resolveHuayraUrl } from "../../src/host-url.js";

const url = resolveHuayraUrl(process.env);

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    backgroundColor: "#11111b",
    autoHideMenuBar: true,
    title: "Huayra",
  });
  void win.loadURL(url);
}

app.whenReady().then(createWindow);
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
