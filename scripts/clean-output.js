const fs = require("node:fs");
const path = require("node:path");

const siteDir = path.join(process.cwd(), "_site");

function removeRecursive(target) {
  if (!fs.existsSync(target)) return;
  const stat = fs.lstatSync(target);

  if (stat.isDirectory()) {
    for (const entry of fs.readdirSync(target)) {
      removeRecursive(path.join(target, entry));
    }
    fs.rmdirSync(target);
    return;
  }

  fs.unlinkSync(target);
}

if (fs.existsSync(siteDir)) {
  try {
    fs.rmSync(siteDir, { recursive: true, force: true });
  } catch (error) {
    removeRecursive(siteDir);
  }
}

process.stdout.write("Cleaned _site output directory\n");
