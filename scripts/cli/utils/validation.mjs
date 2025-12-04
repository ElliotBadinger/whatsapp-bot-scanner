export function validateApiKey(key) {
  if (!key) return "API key is required";
  if (key.length < 32) return "API key must be at least 32 characters";
  if (!/^[A-Za-z0-9_-]+$/.test(key))
    return "API key contains invalid characters";
  return true;
}

export function validatePhoneNumber(phone) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 10) return "Phone number must have at least 10 digits";
  if (!/^\+?[0-9\s-]+$/.test(phone)) return "Invalid phone number format";
  return true;
}

export function validatePort(port) {
  const num = parseInt(port);
  if (isNaN(num)) return "Port must be a number";
  if (num < 1 || num > 65535) return "Port must be between 1 and 65535";
  return true;
}

export function validateEmail(email) {
  if (!email) return "Email is required";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Invalid email format";
  return true;
}

export function validateUrl(url) {
  try {
    new URL(url);
    return true;
  } catch {
    return "Invalid URL format";
  }
}
