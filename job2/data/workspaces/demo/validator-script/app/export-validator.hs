module Main where

import System.Directory (createDirectoryIfMissing)
import System.FilePath ((</>))
import ScriptValidator

main :: IO ()
main = do
  createDirectoryIfMissing True "artifacts"
  writeFile ("artifacts" </> "validator.plutus") scriptName
  writeFile ("artifacts" </> "validator.cbor") scriptCborHex
  writeFile ("artifacts" </> "validator.script") scriptCborHex
  putStrLn "validator artifacts written"
