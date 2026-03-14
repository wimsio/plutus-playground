{-# LANGUAGE DataKinds #-}
{-# LANGUAGE NoImplicitPrelude #-}
{-# LANGUAGE TemplateHaskell #-}
{-# LANGUAGE ScopedTypeVariables #-}
{-# LANGUAGE OverloadedStrings #-}
{-# LANGUAGE TypeApplications #-}

module Main where

import Prelude (IO, String, FilePath, putStrLn, (<>))
import qualified Prelude as P

import Plutus.V2.Ledger.Api
import Plutus.V2.Ledger.Contexts
import qualified Plutus.V2.Ledger.Api as PlutusV2
import PlutusTx
import PlutusTx.Prelude hiding (Semigroup(..), unless)

import qualified Codec.Serialise as Serialise
import qualified Data.ByteString.Lazy  as LBS
import qualified Data.ByteString.Short as SBS
import qualified Data.ByteString       as BS
import qualified Data.ByteString.Base16 as B16

import qualified Cardano.Api as C
import qualified Cardano.Api.Shelley as CS

--------------------------------------------------------------------------------
-- Datum & Redeemer
--------------------------------------------------------------------------------

data PoolDatum = PoolDatum
    { pdSigners   :: [PubKeyHash]
    , pdThreshold :: Integer
    }
PlutusTx.unstableMakeIsData ''PoolDatum

data PoolAction
    = Deposit
    | Payout
PlutusTx.unstableMakeIsData ''PoolAction

--------------------------------------------------------------------------------
-- Helpers
--------------------------------------------------------------------------------

{-# INLINABLE countValidSigners #-}
countValidSigners :: [PubKeyHash] -> [PubKeyHash] -> Integer
countValidSigners allowed actual =
    foldr
        (\pkh acc ->
            if elem pkh allowed then acc + 1 else acc
        )
        0
        actual

--------------------------------------------------------------------------------
-- Validator Logic
--------------------------------------------------------------------------------

{-# INLINABLE mkPoolValidator #-}
mkPoolValidator :: PoolDatum -> PoolAction -> ScriptContext -> Bool
mkPoolValidator dat action ctx =
    case action of

        Deposit ->
            True

        Payout ->
            traceIfFalse "insufficient signatories!!" thresholdMet
  where
    info :: TxInfo
    info = scriptContextTxInfo ctx

    thresholdMet :: Bool
    thresholdMet =
        countValidSigners (pdSigners dat) (txInfoSignatories info)
            >= pdThreshold dat

--------------------------------------------------------------------------------
-- Untyped Wrapper
--------------------------------------------------------------------------------

{-# INLINABLE mkValidatorUntyped #-}
mkValidatorUntyped :: BuiltinData -> BuiltinData -> BuiltinData -> ()
mkValidatorUntyped d r c =
    if mkPoolValidator
        (unsafeFromBuiltinData d)
        (unsafeFromBuiltinData r)
        (unsafeFromBuiltinData c)
    then ()
    else error ()

validator :: Validator
validator =
    mkValidatorScript $$(PlutusTx.compile [|| mkValidatorUntyped ||])

--------------------------------------------------------------------------------
-- Script Address & CBOR Helpers
--------------------------------------------------------------------------------

plutusValidatorHash :: Validator -> PlutusV2.ValidatorHash
plutusValidatorHash val =
    let bytes = Serialise.serialise val
    in PlutusV2.ValidatorHash . toBuiltin . SBS.fromShort . SBS.toShort $ LBS.toStrict bytes

plutusScriptAddress :: Address
plutusScriptAddress =
    Address (ScriptCredential (plutusValidatorHash validator)) Nothing

writeCBOR :: FilePath -> Validator -> IO ()
writeCBOR path val = do
    let bytes = LBS.toStrict (Serialise.serialise val)
        hex   = B16.encode bytes
    BS.writeFile path hex
    putStrLn $ "CBOR hex is written to: " <> path

--------------------------------------------------------------------------------
-- Main
--------------------------------------------------------------------------------

main :: IO ()
main = do
    writeCBOR "insurance_pool_multisig.cbor" validator
    putStrLn "\n--- Insurance Pool Multisig Validator Compiled ---"
    putStrLn $ "Script Address: " <> P.show plutusScriptAddress