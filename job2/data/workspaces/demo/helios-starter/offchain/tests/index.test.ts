import test from "node:test";
import assert from "node:assert/strict";
import { buildHeliosTxPayload } from "../src/index";

test("buildHeliosTxPayload builds a payload", () => {
  const payload = buildHeliosTxPayload({
    action: "lock",
    walletAddress: "addr_test1...",
    amountLovelace: 5000000,
  });

  assert.equal(payload.stack, "helios");
  assert.equal(payload.action, "lock");
  assert.equal(payload.amountLovelace, 5000000);
});
