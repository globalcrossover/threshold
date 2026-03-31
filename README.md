# THRESHOLD
### A browser by Global Crossover

---

## Setup — Step by Step

**1. Make sure Node.js is installed**
Download from: https://nodejs.org (choose LTS version)
Confirm it works: open Terminal and type `node -v`

**2. Create the GitHub repo**
Go to github.com → New repository → Name it `threshold` → Public → No README → Create

**3. Put all these files in a folder on your machine called `threshold`**

```
threshold/
  main.js
  preload.js
  package.json
  renderer/
    index.html
    style.css
    browser.js
  assets/
    icon.icns    ← Mac icon (512x512)
    icon.ico     ← Windows icon
    icon.png     ← Linux icon (512x512)
  .github/
    workflows/
      build.yml
```

**4. Add placeholder icons (for v0.1 testing)**
For now, find any 512x512 PNG and name it icon.png and put it in assets/.
Use a tool like https://cloudconvert.com to convert it to .icns and .ico.

**5. Open Terminal in your threshold folder, run:**
```
npm install
```

**6. Test it locally:**
```
npm start
```
Threshold should open. You're looking at your browser.

**7. Push to GitHub:**
```
git init
git add .
git commit -m "Threshold v0.1"
git remote add origin https://github.com/globalcrossover/threshold.git
git push -u origin main
```

**8. Trigger a release build:**
```
git tag v0.1.0
git push origin v0.1.0
```
GitHub Actions will compile for Mac, Windows, and Linux.
Check the Releases tab on your GitHub repo in ~10 minutes.

---

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| Cmd/Ctrl + L | Focus address bar |
| Cmd/Ctrl + T | New tab |
| Cmd/Ctrl + W | Close tab |
| Cmd/Ctrl + R | Reload |
| Cmd/Ctrl + 1-8 | Jump to pinned tab |
| Cmd/Ctrl + [ | Back |
| Cmd/Ctrl + ] | Forward |

---

## Default Pinned Tabs (always open, can't close)
1. Knock Knock — knockknock.email
2. Seeface — seeface.app
3. Truth Net — truthnet.news
4. Sonify — sonify.stream
5. Mydo Games — mydogames.com
6. Make A Vid — makeavid.com
7. Oath Tracker — oathtracker.com
8. Claude — claude.ai

---

بِسْمِ اللهِ الرَّحْمٰنِ الرَّحِيْمِ
