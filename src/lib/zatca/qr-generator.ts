import { createHash, createPrivateKey, createPublicKey, generateKeyPairSync } from "crypto";
import type { ZatcaInvoiceInput } from "./config";
import { signZatcaInvoice } from "./signer";
import { inferInvoiceKind } from "./xml-generator";

export function generateLocalSigningKey() {
  const { privateKey } = generateKeyPairSync("ec", { namedCurve: "secp256k1" });
  return privateKey.export({ type: "sec1", format: "pem" }).toString();
}

export function generateLocalCryptographicStamp(privateKeyPem: string) {
  const publicKey = createPublicKey(createPrivateKey(privateKeyPem));
  const publicKeyDer = publicKey.export({ type: "spki", format: "der" });

  // TODO: Replace this local-only stamp with the ZATCA certificate signature for live credentials.
  return createHash("sha256").update(publicKeyDer).digest("base64");
}

export function generateLocalQr(input: ZatcaInvoiceInput, privateKeyPem = generateLocalSigningKey()) {
  return signZatcaInvoice({
    input,
    kind: inferInvoiceKind(input.buyer?.vatNumber),
    privateKeyPem,
    cryptographicStamp: generateLocalCryptographicStamp(privateKeyPem),
  }).qrPayload;
}
