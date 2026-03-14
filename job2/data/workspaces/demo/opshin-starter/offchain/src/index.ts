export type ContractAction =
  | "lock"
  | "unlock"
  | "mint"
  | "burn"
  | "custom";

export type BuildTxInput = {
  action: ContractAction;
  walletAddress: string;
  amountLovelace?: number;
  metadata?: Record<string, unknown>;
};

export function buildOpshinTxPayload(input: BuildTxInput) {
  if (!input.walletAddress) {
    throw new Error("walletAddress is required");
  }

  return {
    stack: "opshin",
    action: input.action,
    walletAddress: input.walletAddress,
    amountLovelace: input.amountLovelace ?? 0,
    metadata: input.metadata ?? {},
  };
}
