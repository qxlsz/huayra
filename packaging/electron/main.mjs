import { app, BrowserWindow } from "electron";

const url = process.env.HUAYRA_URL || "http://127.0.0.1:8080";

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
