// @mobile
// Still: Obsidian's mobile emulation with the plugin's commands on the toolbar.
// The driver turns emulation on before loading this scene and off after it,
// because app.emulateMobile() reloads the window (a scene that toggled it
// itself died with the reload and left emulation on, 2026-09-08). The window
// is shrunk to a phone shape for the shot and put back afterwards; resizing
// does not reload.
(async () => {
    const G = window.__gif;
    const S = window.__gifScene;
    await S.run({}, async () => {
        if (!document.body.classList.contains("is-mobile")) throw new Error("mobile emulation is off; run this through record.mjs");
        const w = require("electron").remote.getCurrentWindow();
        const bounds = w.getBounds();
        const wasMaximized = w.isMaximized();
        try {
            // a maximized window ignores setBounds
            if (wasMaximized) w.unmaximize();
            await G.sleep(500);
            // aim for a phone-shaped PAGE: something docked beside it (DevTools
            // on the right, in the sandbox) eats window width, so size once,
            // measure what the page got, and correct for the difference
            const want = { width: 412, height: 860 };
            const place = (width, height) => w.setBounds({ x: bounds.x + 40, y: bounds.y + 60, width, height });
            place(want.width, want.height);
            await G.sleep(900);
            // the docked panel grows with the window, so converge in a few steps
            let width = want.width;
            let height = want.height;
            for (let i = 0; i < 6; i++) {
                const dw = want.width - window.innerWidth;
                const dh = want.height - window.innerHeight;
                if (Math.abs(dw) <= 4 && Math.abs(dh) <= 4) break;
                width += dw;
                height += dh;
                place(width, height);
                await G.sleep(900);
            }
            G.beginStyle();
            await G.sleep(600);
            const line = "The reef survey counted 412 colonies along the northern transect.";
            await G.setNote("# Field notes\n\n" + line, { line: 2, ch: line.length });
            const v = G.view();
            v.editor.focus();
            await G.sleep(1500);
            // the toolbar appears once the editor has focus; the plugin's
            // commands sit on it in the sandbox's mobile toolbar config
            const toolbar = document.querySelector(".mobile-toolbar");
            if (!toolbar) throw new Error("mobile toolbar did not render (needs the editor focused)");
            const still = await G.snapshot("mobile", { x: 0, y: 0, width: Math.round(window.innerWidth), height: Math.round(window.innerHeight) });
            return { still };
        } finally {
            G.endStyle();
            w.setBounds(bounds);
            if (wasMaximized) w.maximize();
        }
    });
})();
