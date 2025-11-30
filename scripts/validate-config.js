const fs = require("fs");
const path = require("path");

const envPath = path.join(__dirname, "..", ".env.example");

if (!fs.existsSync(envPath)) {
  console.error(`FAIL: Missing .env.example at ${envPath}`);
  process.exit(1);
}

const env = fs.readFileSync(envPath, "utf8");
const queueLines = env
  .split(/\r?\n/)
  .filter((line) => line.includes("_QUEUE="));
let hasError = false;

queueLines.forEach((line, index) => {
  const value = line.split("=")[1]?.trim();

  if (value && value.includes(":")) {
    console.error(
      `FAIL: Queue name contains colon: ${line} (line ${index + 1})`,
    );
    hasError = true;
  }
});

if (hasError) {
  process.exit(1);
}

console.log("PASS: All queue names compliant");
