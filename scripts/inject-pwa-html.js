// Post-processes dist/index.html after `expo export -p web` to add PWA
// tags (manifest link, theme-color, iOS home-screen meta). Not done via
// Expo Router's app/+html.tsx because that hook is only honored in "static"
// web output mode — switching to it risks breaking client-only code
// (localStorage, window) that would otherwise run during Node-side
// prerendering. This script is the lower-risk alternative for "single"
// (SPA) output, which is what this project actually uses.
const fs = require("fs");
const path = require("path");

const indexPath = path.join(__dirname, "..", "dist", "index.html");

if (!fs.existsSync(indexPath)) {
  console.error(`inject-pwa-html: ${indexPath} not found — run "expo export -p web" first`);
  process.exit(1);
}

let html = fs.readFileSync(indexPath, "utf8");

// Expo's default web template omits `viewport-fit=cover`, which means
// browsers never expose non-zero env(safe-area-inset-*) values at all —
// this is why the tab bar's safe-area padding (src/theme/tabBarStyle.ts)
// was always falling back to its 8px floor on the deployed PWA regardless
// of device, even on phones with a real home indicator. Fixed here rather
// than in tabBarStyle.ts, since the actual bug is the missing opt-in this
// meta tag provides, not the consumer of the resulting (always-zero) inset.
if (html.includes("viewport-fit=cover")) {
  console.log("inject-pwa-html: viewport-fit=cover already present, skipping");
} else {
  const before = html;
  html = html.replace(
    /<meta name="viewport" content="[^"]*"\s*\/>/,
    '<meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover" />'
  );
  if (html === before) {
    console.error("inject-pwa-html: could not find a viewport meta tag to patch");
    process.exit(1);
  }
  console.log("inject-pwa-html: added viewport-fit=cover");
}

if (html.includes('rel="manifest"')) {
  console.log("inject-pwa-html: manifest link already present, skipping");
} else {
  const injected = [
    '<link rel="manifest" href="/manifest.json" />',
    '<meta name="theme-color" content="#6366f1" />',
    '<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />',
    '<meta name="apple-mobile-web-app-capable" content="yes" />',
    '<meta name="apple-mobile-web-app-status-bar-style" content="default" />',
    '<meta name="apple-mobile-web-app-title" content="MindYourMoney" />',
  ].join("\n    ");

  html = html.replace("</head>", `    ${injected}\n  </head>`);
  console.log("inject-pwa-html: PWA meta tags injected into dist/index.html");
}

fs.writeFileSync(indexPath, html);
