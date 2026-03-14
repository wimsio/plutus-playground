module Main where

import System.Directory (createDirectoryIfMissing)
import System.FilePath ((</>))
import Validator

main :: IO ()
main = do
  createDirectoryIfMissing True "artifacts"
  writeFile ("artifacts" </> "validator.plutus") validatorName
  writeFile ("artifacts" </> "validator.cbor") validatorCborHex
  writeFile ("artifacts" </> "validator.script") validatorCborHex
  putStrLn "validator artifacts written"
