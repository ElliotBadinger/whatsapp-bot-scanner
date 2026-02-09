export async function readJsonWithLimit(
  req: Request,
  maxBytes: number,
): Promise<unknown | null> {
  const reader = req.body?.getReader();
  if (!reader) return null;

  const decoder = new TextDecoder();
  let total = 0;
  let text = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > maxBytes) {
      throw new Error("body_too_large");
    }
    text += decoder.decode(value, { stream: true });
  }

  text += decoder.decode();
  return JSON.parse(text) as unknown;
}
