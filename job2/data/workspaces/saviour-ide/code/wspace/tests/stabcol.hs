{-# LANGUAGE DataKinds #-}
{-# LANGUAGE NoImplicitPrelude #-}
{-# LANGUAGE TemplateHaskell #-}
{-# LANGUAGE ScopedTypeVariables #-}
{-# LANGUAGE OverloadedStrings #-}
{-# LANGUAGE TypeApplications #-}

module Main where

import Prelude (IO, FilePath, putStrLn)
import qualified Prelude as P

import Plutus.V2.Ledger.Api
import Plutus.V2.Ledger.Contexts
import Plutus.V1.Ledger.Value
import PlutusTx
import PlutusTx.Prelude hiding (Semigroup(..), unless)

import qualified Codec.Serialise as Serialise
import qualified Data.ByteString.Lazy as LBS
import qualified Data.ByteString as BS
import qualified Data.ByteString.Base16 as B16

-------------------------------------------------
-- DATUM
-------------------------------------------------

data PoolDatum = PoolDatum
  { pdTotalLiquidity :: Integer
  , pdTotalShares    :: Integer
  }
PlutusTx.unstableMakeIsData ''PoolDatum

-------------------------------------------------
-- REDEEMER (NO INPUTS)
-------------------------------------------------

data PoolAction = Deposit | Withdraw
PlutusTx.unstableMakeIsData ''PoolAction

-------------------------------------------------
-- HELPERS
-------------------------------------------------

{-# INLINABLE findPoolOutput #-}
findPoolOutput :: ScriptContext -> TxOut
findPoolOutput ctx =
  case getContinuingOutputs ctx of
    [o] -> o
    _   -> traceError "expected exactly one pool output"

{-# INLINABLE getPoolDatum #-}
getPoolDatum :: TxOut -> PoolDatum
getPoolDatum o =
  case txOutDatum o of
    OutputDatum (Datum d) -> unsafeFromBuiltinData d
    _ -> traceError "datum missing"

-------------------------------------------------
-- VALIDATOR (PARAMETERIZED BY SHARE CS)
-------------------------------------------------

{-# INLINABLE mkPoolValidator #-}
mkPoolValidator :: CurrencySymbol -> PoolDatum -> PoolAction -> ScriptContext -> Bool
mkPoolValidator shareCS dat action ctx =
  case action of
    Deposit  -> depositCorrect
    Withdraw -> withdrawCorrect

  where
    info :: TxInfo
    info = scriptContextTxInfo ctx

    ownInput :: TxOut
    ownInput =
      case findOwnInput ctx of
        Just i  -> txInInfoResolved i
        Nothing -> traceError "missing pool input"

    ownOutput :: TxOut
    ownOutput = findPoolOutput ctx

    oldAda :: Integer
    oldAda = valueOf (txOutValue ownInput) adaSymbol adaToken

    newAda :: Integer
    newAda = valueOf (txOutValue ownOutput) adaSymbol adaToken

    newDatum :: PoolDatum
    newDatum = getPoolDatum ownOutput

    -------------------------------------------------
    -- SHARE DELTA (FROM MINT/BURN)
    -------------------------------------------------

    shareDelta :: Integer
    shareDelta =
      assetClassValueOf
        (txInfoMint info)
        (AssetClass (shareCS, TokenName "POOLSHARE"))

    -------------------------------------------------
    -- DEPOSIT
    -------------------------------------------------

    deposited :: Integer
    deposited = newAda - oldAda

    depositCorrect :: Bool
    depositCorrect =
      traceIfFalse "no ADA deposited" (deposited > 0) &&
      traceIfFalse "shares not minted" (shareDelta > 0) &&
      traceIfFalse "bad liquidity update"
        (pdTotalLiquidity newDatum == oldAda + deposited) &&
      traceIfFalse "bad share update"
        (pdTotalShares newDatum == pdTotalShares dat + shareDelta)

    -------------------------------------------------
    -- WITHDRAW
    -------------------------------------------------

    burned :: Integer
    burned = negate shareDelta

    expectedWithdraw :: Integer
    expectedWithdraw =
      traceIfFalse "zero total shares" (pdTotalShares dat > 0) &&
      (burned * oldAda) `divide` pdTotalShares dat

    withdrawn :: Integer
    withdrawn = oldAda - newAda

    withdrawCorrect :: Bool
    withdrawCorrect =
      traceIfFalse "shares not burned" (burned > 0) &&
      traceIfFalse "wrong ADA withdrawn"
        (withdrawn == expectedWithdraw) &&
      traceIfFalse "bad share update"
        (pdTotalShares newDatum == pdTotalShares dat - burned) &&
      traceIfFalse "bad liquidity update"
        (pdTotalLiquidity newDatum == oldAda - withdrawn)

-------------------------------------------------
-- UNTYPED WRAPPER
-------------------------------------------------

{-# INLINABLE mkUntyped #-}
mkUntyped :: CurrencySymbol -> BuiltinData -> BuiltinData -> BuiltinData -> ()
mkUntyped cs d r c =
  if mkPoolValidator
       cs
       (unsafeFromBuiltinData d)
       (unsafeFromBuiltinData r)
       (unsafeFromBuiltinData c)
  then ()
  else error ()

validator :: CurrencySymbol -> Validator
validator cs =
  mkValidatorScript $
    $$(PlutusTx.compile [|| mkUntyped ||])
      `PlutusTx.applyCode`
        PlutusTx.liftCode cs

-------------------------------------------------
-- WRITE SCRIPT (PLACEHOLDER CS)
-------------------------------------------------

main :: IO ()
main = do
  putStrLn "Compile via applied CurrencySymbol from share policy"
