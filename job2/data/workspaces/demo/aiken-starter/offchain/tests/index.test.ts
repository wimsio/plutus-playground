import test from "node:test";
import assert from "node:assert/strict";
import { buildAikenTxPayload } from "../src/index";

test("buildAikenTxPayload builds a payload", () => {
  const payload = buildAikenTxPayload({
    action: "lock",
    walletAddress: "addr_test1...",
    amountLovelace: 5000000,
  });

  assert.equal(payload.stack, "aiken");
  assert.equal(payload.action, "lock");
  assert.equal(payload.amountLovelace, 5000000);
});
