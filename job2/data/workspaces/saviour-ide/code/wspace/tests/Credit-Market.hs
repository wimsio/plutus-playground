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

------------------------------------------------------------------------
-- Datum & Redeemer
------------------------------------------------------------------------

data OfferDatum = OfferDatum
    { odBorrower   :: PubKeyHash
    , odLender     :: Maybe PubKeyHash
    , odPrincipal  :: Integer
    , odInterest   :: Integer
    , odCollateral :: Integer
    }
PlutusTx.unstableMakeIsData ''OfferDatum

data OfferAction
    = PostOffer
    | AcceptOffer
    | RepayLoan
PlutusTx.unstableMakeIsData ''OfferAction

------------------------------------------------------------------------
-- Validator Logic
------------------------------------------------------------------------

{-# INLINABLE mkOfferValidator #-}
mkOfferValidator :: OfferDatum -> OfferAction -> ScriptContext -> Bool
mkOfferValidator dat action ctx =
    case action of

        --------------------------------------------------
        -- Borrower posts offer with collateral
        --------------------------------------------------
        PostOffer ->
            traceIfFalse "borrower not signed" borrowerSigned &&
            traceIfFalse "collateral missing" collateralLocked

        --------------------------------------------------
        -- Lender manually accepts offer
        --------------------------------------------------
        AcceptOffer ->
            traceIfFalse "offer already taken" offerOpen &&
            traceIfFalse "principal not paid" lenderPaid &&
            traceIfFalse "datum not updated" datumUpdated

        --------------------------------------------------
        -- Borrower repays loan
        --------------------------------------------------
        RepayLoan ->
            traceIfFalse "borrower not signed" borrowerSigned &&
            traceIfFalse "lender not paid" lenderRepaid &&
            traceIfFalse "collateral not released" collateralReleased

  where
    info :: TxInfo
    info = scriptContextTxInfo ctx

    borrowerSigned :: Bool
    borrowerSigned =
        txSignedBy info (odBorrower dat)

    offerOpen :: Bool
    offerOpen =
        case odLender dat of
            Nothing -> True
            Just _  -> False

    --------------------------------------------------
    -- Collateral must be locked at script
    --------------------------------------------------
    collateralLocked :: Bool
    collateralLocked =
        case findOwnInput ctx of
            Nothing -> False
            Just i  ->
                valueOf
                    (txOutValue $ txInInfoResolved i)
                    adaSymbol
                    adaToken
                >= odCollateral dat

    --------------------------------------------------
    -- Lender pays principal to borrower
    --------------------------------------------------
    lenderPaid :: Bool
    lenderPaid =
        valueOf
            (valuePaidTo info (odBorrower dat))
            adaSymbol
            adaToken
        >= odPrincipal dat

    --------------------------------------------------
    -- Continuing output must update lender field
    --------------------------------------------------
    datumUpdated :: Bool
    datumUpdated =
        case getContinuingOutputs ctx of
            [o] ->
                case txOutDatum o of
                    OutputDatum (Datum d) ->
                        case unsafeFromBuiltinData d of
                            OfferDatum _ (Just _) _ _ _ -> True
                            _ -> False
                    _ -> False
            _ -> False

    --------------------------------------------------
    -- Borrower repays principal + interest
    --------------------------------------------------
    lenderRepaid :: Bool
    lenderRepaid =
        case odLender dat of
            Nothing -> False
            Just lender ->
                valueOf
                    (valuePaidTo info lender)
                    adaSymbol
                    adaToken
                >= (odPrincipal dat + odInterest dat)

    --------------------------------------------------
    -- Script releases full collateral
    --------------------------------------------------
    collateralReleased :: Bool
    collateralReleased =
        case findOwnInput ctx of
            Nothing -> False
            Just i  ->
                let inVal = txOutValue (txInInfoResolved i)
                in valueOf inVal adaSymbol adaToken == odCollateral dat

------------------------------------------------------------------------
-- Untyped Wrapper
------------------------------------------------------------------------

{-# INLINABLE mkValidatorUntyped #-}
mkValidatorUntyped :: BuiltinData -> BuiltinData -> BuiltinData -> ()
mkValidatorUntyped d r c =
    if mkOfferValidator
        (unsafeFromBuiltinData d)
        (unsafeFromBuiltinData r)
        (unsafeFromBuiltinData c)
    then ()
    else error ()

------------------------------------------------------------------------
-- Validator
------------------------------------------------------------------------

validator :: Validator
validator =
    mkValidatorScript $$(PlutusTx.compile [|| mkValidatorUntyped ||])

------------------------------------------------------------------------
-- Validator Hash & Script Address
------------------------------------------------------------------------

plutusValidatorHash :: PlutusV2.Validator -> PlutusV2.ValidatorHash
plutusValidatorHash val =
    let bytes = Serialise.serialise val
        short = SBS.toShort (LBS.toStrict bytes)
    in PlutusV2.ValidatorHash (toBuiltin (SBS.fromShort short))

plutusScriptAddress :: Address
plutusScriptAddress =
    Address
        (ScriptCredential (plutusValidatorHash validator))
        Nothing

------------------------------------------------------------------------
-- Bech32 Script Address (Off-chain)
------------------------------------------------------------------------

toBech32ScriptAddress :: C.NetworkId -> Validator -> String
toBech32ScriptAddress network val =
    let serialised = SBS.toShort . LBS.toStrict $ Serialise.serialise val
        plutusScript :: C.PlutusScript C.PlutusScriptV2
        plutusScript = CS.PlutusScriptSerialised serialised
        scriptHash   = C.hashScript (C.PlutusScript C.PlutusScriptV2 plutusScript)
        shelleyAddr :: C.AddressInEra C.BabbageEra
        shelleyAddr =
            C.makeShelleyAddressInEra
                network
                (C.PaymentCredentialByScript scriptHash)
                C.NoStakeAddress
    in T.unpack (C.serialiseAddress shelleyAddr)

------------------------------------------------------------------------
-- CBOR HEX
------------------------------------------------------------------------

validatorToCBORHex :: Validator -> String
validatorToCBORHex val =
    let bytes = LBS.toStrict $ Serialise.serialise val
    in BS.foldr (\b acc -> byteToHex b <> acc) "" bytes
  where
    hexChars = "0123456789abcdef"
    byteToHex b =
        let hi = P.fromIntegral b `P.div` 16
            lo = P.fromIntegral b `P.mod` 16
        in [ hexChars P.!! hi, hexChars P.!! lo ]

------------------------------------------------------------------------
-- File Writers
------------------------------------------------------------------------

writeValidator :: FilePath -> Validator -> IO ()
writeValidator path val = do
    LBS.writeFile path (Serialise.serialise val)
    putStrLn $ "Validator written to: " <> path

writeCBOR :: FilePath -> Validator -> IO ()
writeCBOR path val = do
    let bytes = LBS.toStrict (Serialise.serialise val)
        hex   = B16.encode bytes
    BS.writeFile path hex
    putStrLn $ "CBOR hex written to: " <> path

------------------------------------------------------------------------
-- Main
------------------------------------------------------------------------

main :: IO ()
main = do
    let network = C.Testnet (C.NetworkMagic 1)

    writeValidator "p2p_credit_market.plutus" validator
    writeCBOR      "p2p_credit_market.cbor"   validator

    let vh      = plutusValidatorHash validator
        addr    = plutusScriptAddress
        bech32  = toBech32ScriptAddress network validator
        cborHex = validatorToCBORHex validator

    putStrLn "\n--- Peer-to-Peer Credit Market ---"
    putStrLn $ "Validator Hash: " <> P.show vh
    putStrLn $ "Script Address: " <> P.show addr
    putStrLn $ "Bech32 Address: " <> bech32
    putStrLn $ "CBOR Hex (first 120 chars): " <> P.take 120 cborHex <> "..."
    putStrLn "--------------------------------"
