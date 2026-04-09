export type DocEntry = {
  id: string;
  title: string;
  url: string;
  keywords: string[];
};

export const DOC_INDEX: DocEntry[] = [
  {
    id: "cardano-node",
    title: "Cardano Node Overview",
    url: "https://developers.cardano.org/docs/get-started/infrastructure/node/cardano-components/",
    keywords: ["cardano node", "node", "block producer", "relay"]
  },
  {
    id: "cardano-ledger",
    title: "Cardano Ledger Explained",
    url: "https://developers.cardano.org/docs/learn/core-concepts/eutxo/",
    keywords: ["ledger", "cardano ledger", "utxo", "eutxo"]
  },
  {
    id: "plutus-overview",
    title: "Plutus Smart Contracts",
    url: "https://developers.cardano.org/docs/get-started/infrastructure/cardano-cli/plutus-scripts/",
    keywords: ["plutus", "validator", "datum", "redeemer", "smart contract", "plutus script"]
  },
  {
    id: "cardano-api",
    title: "Cardano API Guide",
    url: "https://developers.cardano.org/docs/get-started/infrastructure/cardano-cli/basic-operations/get-started/",
    keywords: ["api", "cardano api", "cardano-cli", "transaction"]
  },
  {
    id: "minting-policy",
    title: "Minting Policies",
    url: "https://developers.cardano.org/docs/learn/core-concepts/assets/",
    keywords: ["minting", "policy", "native tokens"]
  },
  {
    id: "cardano-docs",
    title: "Cardano Developer Portal",
    url: "https://developers.cardano.org/",
    keywords: ["cardano", "docs", "developer portal", "getting started"],
  },
  {
    id: "cip",
    title: "Cardano Improvement Proposals (CIPs)",
    url: "https://cips.cardano.org/",
    keywords: ["cip", "standards", "improvement proposals", "spec"],
  },
  {
    id: "cip30",
    title: "CIP-30: Cardano dApp-Wallet Web Bridge",
    url: "https://cips.cardano.org/cips/cip30/",
    keywords: ["cip-30", "cip30", "wallet", "web bridge", "connect wallet"],
  },
  {
    id: "plutus-tx",
    title: "Plutus Tx (Docs / Reference)",
    url: "https://playground.plutus.iohkdev.io/",
    keywords: ["plutus", "plutustx", "validator", "on-chain", "script"],
  },
  {
    id: "aiken",
    title: "Aiken Language",
    url: "https://aiken-lang.org/",
    keywords: ["aiken", "smart contract", "validator", "language"],
  },
  {
    id: "helios",
    title: "Helios Language",
    url: "https://www.hyperion-bt.org/helios-book/",
    keywords: ["helios", "smart contract", "validator", "language"],
  },
  {
    id: "lucid",
    title: "Lucid (Off-chain Tx Builder)",
    url: "https://lucid.spacebudz.io/",
    keywords: ["lucid", "offchain", "transaction builder", "cip-30"],
  },
  {
    id: "utxo",
    title: "eUTxO Explanation (Cardano)",
    url: "https://docs.cardano.org/about-cardano/learn/eutxo-explainer/",
    keywords: ["eutxo", "utxo", "model", "state", "datum", "redeemer"],
  },
];