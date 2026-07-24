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

const html = fs.readFileSync(indexPath, "utf8");

if (html.includes('rel="manifest"')) {
  console.log("inject-pwa-html: manifest link already present, skipping");
  process.exit(0);
}

const injected = [
  '<link rel="manifest" href="/manifest.json" />',
  '<meta name="theme-color" content="#6366f1" />',
  '<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />',
  '<meta name="apple-mobile-web-app-capable" content="yes" />',
  '<meta name="apple-mobile-web-app-status-bar-style" content="default" />',
  '<meta name="apple-mobile-web-app-title" content="MindYourMoney" />',
].join("\n    ");

const updated = html.replace("</head>", `    ${injected}\n  </head>`);

fs.writeFileSync(indexPath, updated);
console.log("inject-pwa-html: PWA meta tags injected into dist/index.html");
