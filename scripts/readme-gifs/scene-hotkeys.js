// Still: the Hotkeys settings tab filtered to the plugin's commands.
// On this build the Settings dialog opens in its own popout window, so the
// shot comes from THAT window's webContents (document-wide selectors for
// .modal in the main window came back empty, 2026-09-08).
(async () => {
    const G = window.__gif;
    const S = window.__gifScene;
    await S.run({}, async () => {
        app.setting.open();
        await G.sleep(300);
        app.setting.openTabById("hotkeys");
        await G.sleep(900);
        const modal = app.setting.modalEl;
        const tab = app.setting.activeTab && app.setting.activeTab.containerEl;
        if (!modal || !tab) throw new Error("settings dialog not found");
        const search = tab.querySelector("input[type='search']");
        if (!search) throw new Error("hotkeys search box not found");
        search.value = "Footnote Shortcut";
        search.dispatchEvent(new Event("input", { bubbles: true }));
        await G.sleep(1200);
        const remote = require("electron").remote;
        const here = remote.getCurrentWindow();
        const view = modal.ownerDocument.defaultView;
        const popout = remote.BrowserWindow.getAllWindows().find((w) => w !== here && w.isVisible() && Math.abs(w.getContentSize()[0] - view.innerWidth) <= 2);
        const contents = modal.ownerDocument === document ? null : popout && popout.webContents;
        if (modal.ownerDocument !== document && !contents) throw new Error("settings popout window not found");
        const r = modal.getBoundingClientRect();
        const rect = { x: Math.max(0, Math.round(r.left)), y: Math.max(0, Math.round(r.top)), width: Math.round(r.width), height: Math.round(r.height) };
        const still = await G.snapshot("hotkeys", rect, contents);
        app.setting.close();
        return { still };
    });
})();
