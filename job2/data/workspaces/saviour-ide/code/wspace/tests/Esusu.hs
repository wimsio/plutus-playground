{-# LANGUAGE DataKinds #-}
{-# LANGUAGE NoImplicitPrelude #-}
{-# LANGUAGE TemplateHaskell #-}
{-# LANGUAGE ScopedTypeVariables #-}
{-# LANGUAGE OverloadedStrings #-}
{-# LANGUAGE TypeApplications #-}

module Main where

import Prelude (IO, FilePath, putStrLn, (<>), String)
import qualified Prelude as P
import qualified Data.Text as T

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

-------------------------------------------------------------------------------
-- DATUM & REDEEMER
-------------------------------------------------------------------------------

data CircleDatum = CircleDatum
    { cdParticipants :: [PubKeyHash]
    , cdAmount       :: Integer
    , cdOrder        :: [PubKeyHash]
    , cdRound        :: Integer
    }
PlutusTx.unstableMakeIsData ''CircleDatum

data CircleAction = Deposit | Payout
PlutusTx.unstableMakeIsData ''CircleAction

-------------------------------------------------------------------------------
-- HELPERS
-------------------------------------------------------------------------------

{-# INLINABLE signedBy #-}
signedBy :: PubKeyHash -> ScriptContext -> Bool
signedBy pkh ctx =
    txSignedBy (scriptContextTxInfo ctx) pkh

{-# INLINABLE getOnlyContinuing #-}
getOnlyContinuing :: ScriptContext -> TxOut
getOnlyContinuing ctx =
    case getContinuingOutputs ctx of
        [o] -> o
        _   -> traceError "expected exactly one continuing output"

{-# INLINABLE indexList #-}
indexList :: [a] -> Integer -> Maybe a
indexList xs idx = go xs idx
  where
    go [] _ = Nothing
    go (y:ys) i =
        if i == 0 then Just y else go ys (i - 1)

{-# INLINABLE currentBeneficiary #-}
currentBeneficiary :: CircleDatum -> PubKeyHash
currentBeneficiary dat =
    case indexList (cdOrder dat) (cdRound dat) of
        Just p  -> p
        Nothing -> traceError "invalid round index"

-------------------------------------------------------------------------------
-- VALIDATOR
-------------------------------------------------------------------------------

{-# INLINABLE mkCircleValidator #-}
mkCircleValidator :: CircleDatum -> CircleAction -> ScriptContext -> Bool
mkCircleValidator dat action ctx =
    case action of

        -----------------------------------------------------------------------
        -- DEPOSIT
        -----------------------------------------------------------------------
        Deposit ->
            traceIfFalse "deposit must be signed by participant"
                signedAnyParticipant
            &&
            traceIfFalse "must have exactly one continuing output"
                hasOneContinuing

        -----------------------------------------------------------------------
        -- PAYOUT
        -----------------------------------------------------------------------
        Payout ->
            traceIfFalse "wrong beneficiary"
                correctBeneficiary
            &&
            traceIfFalse "must have exactly one continuing output"
                hasOneContinuing
            &&
            traceIfFalse "round must increment"
                roundIncremented

  where
    info :: TxInfo
    info = scriptContextTxInfo ctx

    signedAnyParticipant :: Bool
    signedAnyParticipant =
        any (\pkh -> signedBy pkh ctx) (cdParticipants dat)

    hasOneContinuing :: Bool
    hasOneContinuing =
        length (getContinuingOutputs ctx) == 1

    correctBeneficiary :: Bool
    correctBeneficiary =
        signedBy (currentBeneficiary dat) ctx

    roundIncremented :: Bool
    roundIncremented =
        case getContinuingOutputs ctx of
            [o] ->
                case txOutDatum o of
                    OutputDatum (Datum d) ->
                        case PlutusTx.fromBuiltinData d of
                            Just newDat ->
                                cdRound newDat == cdRound dat + 1
                            _ -> traceError "invalid updated datum"
                    _ -> traceError "datum must be inline"
            _ -> traceError "expected one continuing output"

-------------------------------------------------------------------------------
-- UNTYPED WRAPPER
-------------------------------------------------------------------------------

{-# INLINABLE mkValidatorUntyped #-}
mkValidatorUntyped :: BuiltinData -> BuiltinData -> BuiltinData -> ()
mkValidatorUntyped d r c =
    if mkCircleValidator (unsafeFromBuiltinData d)
                         (unsafeFromBuiltinData r)
                         (unsafeFromBuiltinData c)
    then ()
    else error ()

validator :: Validator
validator =
    mkValidatorScript $$(PlutusTx.compile [|| mkValidatorUntyped ||])

-------------------------------------------------------------------------------
-- ADDRESS & CBOR GENERATION
-------------------------------------------------------------------------------

plutusValidatorHash :: PlutusV2.Validator -> PlutusV2.ValidatorHash
plutusValidatorHash val =
    let bytes    = Serialise.serialise val
        short    = SBS.toShort (LBS.toStrict bytes)
        strictBS = SBS.fromShort short
    in PlutusV2.ValidatorHash (toBuiltin strictBS)

plutusScriptAddress :: Address
plutusScriptAddress =
    Address (ScriptCredential (plutusValidatorHash validator)) Nothing

toBech32ScriptAddress :: C.NetworkId -> Validator -> String
toBech32ScriptAddress network val =
    let serialised = SBS.toShort . LBS.toStrict $ Serialise.serialise val
        plutusScript :: C.PlutusScript C.PlutusScriptV2
        plutusScript = CS.PlutusScriptSerialised serialised
        scriptHash = C.hashScript (C.PlutusScript C.PlutusScriptV2 plutusScript)
        shelleyAddr :: C.AddressInEra C.BabbageEra
        shelleyAddr =
            C.makeShelleyAddressInEra
                network
                (C.PaymentCredentialByScript scriptHash)
                C.NoStakeAddress
    in T.unpack (C.serialiseAddress shelleyAddr)

-------------------------------------------------------------------------------
-- FILE OUTPUT
-------------------------------------------------------------------------------

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

-------------------------------------------------------------------------------
-- MAIN
-------------------------------------------------------------------------------

main :: IO ()
main = do
    let network = C.Testnet (C.NetworkMagic 1)

    writeValidator "circle.plutus" validator
    writeCBOR "circle.cbor" validator

    putStrLn "Savings Circle validator generated successfully."
