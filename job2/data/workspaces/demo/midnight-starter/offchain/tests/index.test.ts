import test from "node:test";
import assert from "node:assert/strict";
import { buildMidnightTxPayload } from "../src/index";

test("buildMidnightTxPayload builds a payload", () => {
  const payload = buildMidnightTxPayload({
    action: "lock",
    walletAddress: "addr_test1...",
    amountLovelace: 5000000,
  });

  assert.equal(payload.stack, "midnight");
  assert.equal(payload.action, "lock");
  assert.equal(payload.amountLovelace, 5000000);
});
