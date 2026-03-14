export type CardanoTemplateKind =
  | "plutus-starter"
  | "minting-policy"
  | "validator-script";

export function templateFileName(kind: CardanoTemplateKind): string {
  switch (kind) {
    case "plutus-starter":
      return "plutus-starter.hs";
    case "minting-policy":
      return "minting-policy.hs";
    case "validator-script":
      return "validator-script.hs";
    default:
      return "template.hs";
  }
}

export function templateContent(kind: CardanoTemplateKind): string {
  switch (kind) {
    case "plutus-starter":
      return `{-# LANGUAGE DataKinds #-}
{-# LANGUAGE NoImplicitPrelude #-}
{-# LANGUAGE OverloadedStrings #-}
{-# LANGUAGE TemplateHaskell #-}
{-# LANGUAGE TypeApplications #-}
{-# LANGUAGE ScopedTypeVariables #-}

module Main where

import Prelude (IO, putStrLn)
import qualified Prelude as P

import PlutusTx
import PlutusTx.Prelude hiding (Semigroup(..), unless)

--------------------------------------------------------------------------------
-- Basic starter module
--------------------------------------------------------------------------------

{-# INLINABLE helloCardano #-}
helloCardano :: BuiltinByteString
helloCardano = "Hello, Cardano from Plutus Starter"

main :: IO ()
main = do
  putStrLn "Plutus Starter template created successfully."
`;

    case "minting-policy":
      return `{-# LANGUAGE DataKinds #-}
{-# LANGUAGE NoImplicitPrelude #-}
{-# LANGUAGE TemplateHaskell #-}
{-# LANGUAGE ScopedTypeVariables #-}
{-# LANGUAGE OverloadedStrings #-}
{-# LANGUAGE TypeApplications #-}

module Main where

import Prelude (IO, FilePath, putStrLn)
import qualified Prelude as P
import qualified Data.ByteString.Short as SBS
import qualified Data.ByteString.Lazy as LBS
import qualified Codec.Serialise as Serialise

import Plutus.V2.Ledger.Api
import Plutus.V2.Ledger.Contexts
import PlutusTx
import PlutusTx.Prelude hiding (Semigroup(..), unless)

import qualified Cardano.Api as C

--------------------------------------------------------------------------------
-- Simple minting policy
--------------------------------------------------------------------------------

{-# INLINABLE mkPolicy #-}
mkPolicy :: () -> ScriptContext -> Bool
mkPolicy _ _ = True

policy :: MintingPolicy
policy = mkMintingPolicyScript
  $$(PlutusTx.compile [|| \\_ -> Scripts.wrapMintingPolicy mkPolicy ||])

plutusScript :: PlutusScript
plutusScript = unMintingPolicyScript policy

main :: IO ()
main = putStrLn "Minting policy template created."
`;

    case "validator-script":
      return `{-# LANGUAGE DataKinds #-}
{-# LANGUAGE NoImplicitPrelude #-}
{-# LANGUAGE TemplateHaskell #-}
{-# LANGUAGE ScopedTypeVariables #-}
{-# LANGUAGE OverloadedStrings #-}
{-# LANGUAGE TypeApplications #-}

module Main where

import Prelude (IO, putStrLn)
import qualified Prelude as P

import Plutus.V2.Ledger.Api
import Plutus.V2.Ledger.Contexts
import PlutusTx
import PlutusTx.Prelude hiding (Semigroup(..), unless)

--------------------------------------------------------------------------------
-- Basic validator
--------------------------------------------------------------------------------

data MyDatum = MyDatum BuiltinByteString
PlutusTx.unstableMakeIsData ''MyDatum

data MyRedeemer = MyRedeemer BuiltinByteString
PlutusTx.unstableMakeIsData ''MyRedeemer

{-# INLINABLE mkValidator #-}
mkValidator :: MyDatum -> MyRedeemer -> ScriptContext -> Bool
mkValidator _ _ _ = True

validator :: Validator
validator =
  mkValidatorScript
    $$(PlutusTx.compile [|| wrap ||])
  where
    wrap = Scripts.wrapValidator @MyDatum @MyRedeemer mkValidator

main :: IO ()
main = putStrLn "Validator script template created."
`;
  }
}