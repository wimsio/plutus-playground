import test from "node:test";
import assert from "node:assert/strict";
import { buildOpshinTxPayload } from "../src/index";

test("buildOpshinTxPayload builds a payload", () => {
  const payload = buildOpshinTxPayload({
    action: "lock",
    walletAddress: "addr_test1...",
    amountLovelace: 5000000,
  });

  assert.equal(payload.stack, "opshin");
  assert.equal(payload.action, "lock");
  assert.equal(payload.amountLovelace, 5000000);
});
