import test from "node:test";
import assert from "node:assert/strict";
import { buildHaskellTxPayload } from "../src/index";

test("buildHaskellTxPayload builds a payload", () => {
  const payload = buildHaskellTxPayload({
    action: "lock",
    walletAddress: "addr_test1...",
    amountLovelace: 5000000,
  });

  assert.equal(payload.stack, "haskell");
  assert.equal(payload.action, "lock");
  assert.equal(payload.amountLovelace, 5000000);
});
