{-# LANGUAGE DataKinds #-}
{-# LANGUAGE NoImplicitPrelude #-}
{-# LANGUAGE TemplateHaskell #-}
{-# LANGUAGE ScopedTypeVariables #-}
{-# LANGUAGE OverloadedStrings #-}
{-# LANGUAGE TypeApplications #-}

module Main where

import Prelude (IO, String, FilePath, putStrLn, (<>), take)
import qualified Prelude as P
import qualified Data.Text as T

import Plutus.V2.Ledger.Api
import Plutus.V2.Ledger.Contexts
import qualified Plutus.V2.Ledger.Api as PlutusV2
import Plutus.V1.Ledger.Value (valueOf, adaSymbol, adaToken)
import PlutusTx
import PlutusTx.Prelude hiding (Semigroup(..), unless)

import qualified Codec.Serialise as Serialise
import qualified Data.ByteString.Lazy  as LBS
import qualified Data.ByteString.Short as SBS
import qualified Data.ByteString       as BS
import qualified Data.ByteString.Base16 as B16

import qualified Cardano.Api as C
import qualified Cardano.Api.Shelley as CS

------------------------------------------------------------
-- DATUM & REDEEMER
------------------------------------------------------------

data LoanDatum = LoanDatum
    { ldBorrower      :: PubKeyHash
    , ldLender        :: PubKeyHash
    , ldCollateral    :: Integer
    , ldPrincipal     :: Integer
    , ldInterest      :: Integer
    , ldMaxLTV        :: Integer   -- e.g. 60
    , ldLiquidationLTV:: Integer   -- e.g. 75
    , ldBonusPct      :: Integer   -- e.g. 5
    }
PlutusTx.unstableMakeIsData ''LoanDatum

data LoanAction
    = Open
    | Repay
    | Liquidate
PlutusTx.unstableMakeIsData ''LoanAction

------------------------------------------------------------
-- HELPERS
------------------------------------------------------------

{-# INLINABLE signedBy #-}
signedBy :: PubKeyHash -> ScriptContext -> Bool
signedBy pkh ctx =
    txSignedBy (scriptContextTxInfo ctx) pkh

{-# INLINABLE adaPaidTo #-}
adaPaidTo :: TxInfo -> PubKeyHash -> Integer
adaPaidTo info pkh =
    valueOf (valuePaidTo info pkh) adaSymbol adaToken

------------------------------------------------------------
-- VALIDATOR
------------------------------------------------------------

{-# INLINABLE mkValidator #-}
mkValidator :: LoanDatum -> LoanAction -> ScriptContext -> Bool
mkValidator dat action ctx =
    case action of

        ----------------------------------------------------
        -- Borrower opens loan
        ----------------------------------------------------
        Open ->
            traceIfFalse "borrower not signed" borrowerSigned &&
            traceIfFalse "LTV exceeded" safeLTV

        ----------------------------------------------------
        -- Borrower repays loan
        ----------------------------------------------------
        Repay ->
            traceIfFalse "borrower not signed" borrowerSigned &&
            traceIfFalse "lender not paid" lenderPaid &&
            traceIfFalse "collateral missing" collateralSpent

        ----------------------------------------------------
        -- Liquidation path
        ----------------------------------------------------
        Liquidate ->
            traceIfFalse "loan still healthy" liquidatable &&
            traceIfFalse "debt not repaid" liquidatorRepaid &&
            traceIfFalse "liquidator not rewarded" liquidatorPaid

  where
    info :: TxInfo
    info = scriptContextTxInfo ctx

    borrowerSigned :: Bool
    borrowerSigned =
        signedBy (ldBorrower dat) ctx

    ----------------------------------------------------
    -- LTV checks
    ----------------------------------------------------

    totalDebt :: Integer
    totalDebt = ldPrincipal dat + ldInterest dat

    safeLTV :: Bool
    safeLTV =
        totalDebt * 100 <= ldCollateral dat * ldMaxLTV dat

    liquidatable :: Bool
    liquidatable =
        totalDebt * 100 > ldCollateral dat * ldLiquidationLTV dat

    ----------------------------------------------------
    -- Repayment path
    ----------------------------------------------------

    lenderPaid :: Bool
    lenderPaid =
        adaPaidTo info (ldLender dat) >= totalDebt

    collateralSpent :: Bool
    collateralSpent =
        case findOwnInput ctx of
            Nothing -> traceError "no input"
            Just _  -> True

    ----------------------------------------------------
    -- Liquidation logic
    ----------------------------------------------------

    liquidatorRepaid :: Bool
    liquidatorRepaid =
        adaPaidTo info (ldLender dat) >= totalDebt

    liquidatorReward :: Integer
    liquidatorReward =
        (ldCollateral dat * (100 + ldBonusPct dat)) `divide` 100

    liquidatorPaid :: Bool
    liquidatorPaid =
        let paid =
                case txInfoSignatories info of
                    []     -> 0
                    (s:_)  -> adaPaidTo info s
        in paid >= liquidatorReward

------------------------------------------------------------
-- UNTYPED WRAPPER
------------------------------------------------------------

{-# INLINABLE mkUntyped #-}
mkUntyped :: BuiltinData -> BuiltinData -> BuiltinData -> ()
mkUntyped d r c =
    if mkValidator
        (unsafeFromBuiltinData d)
        (unsafeFromBuiltinData r)
        (unsafeFromBuiltinData c)
    then ()
    else error ()

validator :: Validator
validator =
    mkValidatorScript $$(PlutusTx.compile [|| mkUntyped ||])

------------------------------------------------------------
-- HASH & ADDRESS
------------------------------------------------------------

plutusValidatorHash :: PlutusV2.Validator -> PlutusV2.ValidatorHash
plutusValidatorHash val =
    let bytes  = Serialise.serialise val
        short  = SBS.toShort (LBS.toStrict bytes)
    in PlutusV2.ValidatorHash (toBuiltin (SBS.fromShort short))

plutusScriptAddress :: Address
plutusScriptAddress =
    Address
        (ScriptCredential (plutusValidatorHash validator))
        Nothing

------------------------------------------------------------
-- BECH32 ADDRESS
------------------------------------------------------------

toBech32ScriptAddress :: C.NetworkId -> Validator -> String
toBech32ScriptAddress network val =
    let serialised = SBS.toShort . LBS.toStrict $ Serialise.serialise val
        plutusScript = CS.PlutusScriptSerialised serialised
        scriptHash   = C.hashScript (C.PlutusScript C.PlutusScriptV2 plutusScript)
        shelleyAddr :: C.AddressInEra C.BabbageEra
        shelleyAddr =
            C.makeShelleyAddressInEra
                network
                (C.PaymentCredentialByScript scriptHash)
                C.NoStakeAddress
    in T.unpack (C.serialiseAddress shelleyAddr)

------------------------------------------------------------
-- FILE WRITERS
------------------------------------------------------------

writeValidator :: FilePath -> Validator -> IO ()
writeValidator path val = do
    LBS.writeFile path (Serialise.serialise val)
    putStrLn ("Validator written: " <> path)

writeCBOR :: FilePath -> Validator -> IO ()
writeCBOR path val = do
    let bytes = LBS.toStrict (Serialise.serialise val)
    BS.writeFile path (B16.encode bytes)
    putStrLn ("CBOR hex written: " <> path)

------------------------------------------------------------
-- MAIN
------------------------------------------------------------

main :: IO ()
main = do
    let network = C.Testnet (C.NetworkMagic 1)

    writeValidator "liquidation_lending.plutus" validator
    writeCBOR "liquidation_lending.cbor" validator

    putStrLn "\n--- Liquidation Lending Vault ---"
    putStrLn ("Bech32: " <> toBech32ScriptAddress network validator)
    putStrLn "--------------------------------"
