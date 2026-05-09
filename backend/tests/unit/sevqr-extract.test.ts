import { describe, it, expect } from "vitest";

// SEVQR matcher used by paymentService.handleWebhook to pick the order
// code out of the bank's free-form transfer description. Pulling the
// regex into a test directly rather than re-running the whole webhook,
// because the rest of the function touches DB / Sentry / sockets.
const SEVQR_REGEX = /SEVQR(\d+)/i;

function extract(content: string): number | null {
  const m = String(content).match(SEVQR_REGEX);
  return m ? Number(m[1]) : null;
}

describe("SEVQR order code extraction", () => {
  it("matches the canonical SePay form", () => {
    expect(extract("SEVQR123456")).toBe(123456);
  });

  it("matches when surrounded by other text (real bank transfer noise)", () => {
    expect(extract("CT TU 0123 - SEVQR789012 - NGUYEN TRI DUNG")).toBe(789012);
    expect(extract("Chuyen tien SEVQR42 cho dich vu")).toBe(42);
  });

  it("is case-insensitive", () => {
    expect(extract("sevqr111")).toBe(111);
    expect(extract("SeVqR222")).toBe(222);
  });

  it("returns null when no SEVQR token", () => {
    expect(extract("")).toBeNull();
    expect(extract("Random transfer note")).toBeNull();
    expect(extract("SEVQR")).toBeNull(); // no digits
    expect(extract("SEVQRabc")).toBeNull();
  });

  it("only captures the FIRST SEVQR if multiple appear", () => {
    expect(extract("SEVQR111 SEVQR222")).toBe(111);
  });

  it("doesn't accidentally match similar tokens", () => {
    expect(extract("VQR123")).toBeNull();
    expect(extract("SEVQ123")).toBeNull();
    expect(extract("XSEVQR")).toBeNull();
  });
});
