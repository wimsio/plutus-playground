{-# LANGUAGE DataKinds #-}
{-# LANGUAGE NoImplicitPrelude #-}
{-# LANGUAGE TemplateHaskell #-}
{-# LANGUAGE ScopedTypeVariables #-}
{-# LANGUAGE OverloadedStrings #-}

module Main where

import Prelude (IO, FilePath, putStrLn)
import qualified Prelude as P

import Plutus.V2.Ledger.Api
import Plutus.V2.Ledger.Contexts
import Plutus.V1.Ledger.Value
import PlutusTx
import PlutusTx.Prelude hiding (Semigroup(..))

import qualified PlutusTx.Builtins as Builtins
import qualified Codec.Serialise as Serialise
import qualified Data.ByteString.Lazy as LBS
import qualified Data.ByteString as BS
import qualified Data.ByteString.Base16 as B16

-------------------------------------------------
-- CONSTANTS
-------------------------------------------------

{-# INLINABLE shareTokenName #-}
shareTokenName :: TokenName
shareTokenName = TokenName "POOLSHARE"

-------------------------------------------------
-- SHARE MINTING POLICY
-------------------------------------------------

{-# INLINABLE mkSharePolicy #-}
mkSharePolicy :: ValidatorHash -> () -> ScriptContext -> Bool
mkSharePolicy poolVH _ ctx =
  traceIfFalse "pool utxo not consumed" poolSpent &&
  traceIfFalse "invalid share mint/burn" mintNonZero
  where
    info :: TxInfo
    info = scriptContextTxInfo ctx

    -- Pool script must be consumed
    poolSpent :: Bool
    poolSpent =
      any (\i ->
        case txOutAddress (txInInfoResolved i) of
          Address (ScriptCredential vh) _ -> vh == poolVH
          _ -> False
      ) (txInfoInputs info)

    -- Mint or burn must be non-zero
    mintNonZero :: Bool
    mintNonZero =
      assetClassValueOf
        (txInfoMint info)
        (AssetClass (ownCurrencySymbol ctx, shareTokenName))
        /= 0

{-# INLINABLE mkShareUntyped #-}
mkShareUntyped :: ValidatorHash -> BuiltinData -> BuiltinData -> ()
mkShareUntyped vh r c =
  if mkSharePolicy vh
       (unsafeFromBuiltinData r :: ())
       (unsafeFromBuiltinData c)
  then ()
  else error ()

sharePolicy :: ValidatorHash -> MintingPolicy
sharePolicy vh =
  mkMintingPolicyScript $
    $$(PlutusTx.compile [|| \h -> mkShareUntyped h ||])
      `PlutusTx.applyCode`
        PlutusTx.liftCode vh

-------------------------------------------------
-- SERIALIZATION
-------------------------------------------------

-- 🔴 IMPORTANT:
-- REPLACE THIS WITH YOUR REAL POOL VALIDATOR HASH
{-# INLINABLE poolValidatorHash #-}
poolValidatorHash :: ValidatorHash
poolValidatorHash =
  ValidatorHash "d734a4972bf5c7316f23c275bfde598255670889fef48bcfb4d1d28e"

policy :: MintingPolicy
policy = sharePolicy poolValidatorHash

-------------------------------------------------
-- WRITE SCRIPT
-------------------------------------------------

main :: IO ()
main = do
  writeCBOR "share_policy.plutus" policy
  putStrLn "✅ Share minting policy compiled"

writeCBOR :: Serialise.Serialise a => FilePath -> a -> IO ()
writeCBOR path script =
  BS.writeFile path $
    B16.encode $
      LBS.toStrict $
        Serialise.serialise script
