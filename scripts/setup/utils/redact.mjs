const SECRET_HINTS = [
  "SECRET",
  "TOKEN",
  "KEY",
  "PASSWORD",
  "PASS",
  "AUTH",
  "SESSION",
  "API",
  "CLIENT_ID",
];

function hasSecretHint(label = "") {
  const upper = String(label).toUpperCase();
  return SECRET_HINTS.some((hint) => upper.includes(hint));
}

function maskValue(value) {
  if (!value) return "";
  const str = String(value);
  if (str.length <= 4) return "***";
  const visible = str.slice(-4);
  return `${"•".repeat(Math.min(str.length - 4, 12))}${visible}`;
}

export function redactPair(label, value) {
  if (value == null) return { label, value: value ?? "" };
  if (hasSecretHint(label)) {
    return { label, value: maskValue(value) };
  }
  if (/^[A-Za-z0-9+/=]{24,}$/.test(value)) {
    return { label, value: maskValue(value) };
  }
  if (/^\+\d{6,}$/.test(value)) {
    return { label, value: maskValue(value) };
  }
  return { label, value };
}

export function scrubObject(obj) {
  if (!obj || typeof obj !== "object") return obj;
  const copy = Array.isArray(obj) ? [] : {};
  for (const [key, val] of Object.entries(obj)) {
    if (typeof val === "object" && val !== null) {
      copy[key] = scrubObject(val);
    } else if (typeof val === "string" || typeof val === "number") {
      copy[key] = redactPair(key, val).value;
    } else {
      copy[key] = val;
    }
  }
  return copy;
}
