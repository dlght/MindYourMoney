import { urlBase64ToUint8Array } from "@/features/push/vapidKey";

describe("urlBase64ToUint8Array", () => {
  it("converts a VAPID-style base64url public key into a Uint8Array", () => {
    // A real, previously-generated VAPID public key (87 base64url chars,
    // decodes to the standard 65-byte uncompressed P-256 point).
    const key =
      "BNfPpLFJRqkp_QnvBcSBv3N7NIyuRSX9vQZdh1vM2kQxY3JtAk-PzI-JDKefdEntTrkwgX38IX_8WjBtgHyHMjQ";

    const result = urlBase64ToUint8Array(key);

    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBe(65);
    // An uncompressed EC point always starts with 0x04.
    expect(result[0]).toBe(4);
  });

  it("round-trips a known short base64url string correctly", () => {
    // "hello" -> base64 "aGVsbG8=" -> base64url "aGVsbG8" (no padding, no
    // +/ characters to substitute in this particular example).
    const result = urlBase64ToUint8Array("aGVsbG8");
    const decoded = String.fromCharCode(...result);

    expect(decoded).toBe("hello");
  });

  it("handles base64url characters (- and _) that differ from standard base64", () => {
    // Bytes [0xfb, 0xff] -> standard base64 "+/8=" -> base64url "-_8".
    const result = urlBase64ToUint8Array("-_8");

    expect(Array.from(result)).toEqual([0xfb, 0xff]);
  });
});
