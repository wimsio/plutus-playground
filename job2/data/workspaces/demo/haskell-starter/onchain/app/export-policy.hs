module Main where

import System.Directory (createDirectoryIfMissing)
import System.FilePath ((</>))
import Contract

main :: IO ()
main = do
  createDirectoryIfMissing True "artifacts"
  writeFile ("artifacts" </> "policy.plutus") policyName
  writeFile ("artifacts" </> "policy.cbor") policyCborHex
  writeFile ("artifacts" </> "policy.script") policyCborHex
  putStrLn "policy artifacts written"
