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

export function buildHaskellTxPayload(input: BuildTxInput) {
  if (!input.walletAddress) {
    throw new Error("walletAddress is required");
  }

  return {
    stack: "haskell",
    action: input.action,
    walletAddress: input.walletAddress,
    amountLovelace: input.amountLovelace ?? 0,
    metadata: input.metadata ?? {},
  };
}
