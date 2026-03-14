module Main where

import Contract
import System.Exit (exitFailure)

assert :: Bool -> String -> IO ()
assert condition message =
  if condition then pure () else putStrLn message >> exitFailure

main :: IO ()
main = do
  assert (not (null validatorName)) "validatorName should not be empty"
  assert (not (null validatorCborHex)) "validatorCborHex should not be empty"
  assert (not (null policyName)) "policyName should not be empty"
  assert (not (null policyCborHex)) "policyCborHex should not be empty"
  putStrLn "onchain tests passed"
