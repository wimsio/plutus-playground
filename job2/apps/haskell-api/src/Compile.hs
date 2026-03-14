{-# LANGUAGE OverloadedStrings #-}
{-# LANGUAGE ScopedTypeVariables #-}

module Compile
  ( randomHex
  , compileSelected
  ) where

import Control.Concurrent (forkIO, killThread)
import Control.Exception (SomeException, try)
import Control.Monad (unless, void, when)
import Data.Text (Text)
import qualified Data.Text as T
import qualified Data.Text.Encoding as TE
import System.Directory
  ( createDirectoryIfMissing
  , doesDirectoryExist
  , doesFileExist
  , removePathForcibly
  )
import System.Environment (lookupEnv)
import System.Exit (ExitCode(..))
import System.FilePath
  ( takeBaseName
  , takeDirectory
  , (</>)
  )
import System.IO
  ( BufferMode(LineBuffering)
  , Handle
  , hGetLine
  , hSetBuffering
  )
import System.IO.Error (isEOFError)
import System.Process
  ( CreateProcess(..)
  , StdStream(CreatePipe)
  , proc
  , createProcess
  , waitForProcess
  )
import System.Random (randomIO)

randomHex :: IO Text
randomHex = do
  (n :: Int) <- randomIO
  pure (T.pack (take 16 (show (abs n) ++ repeat '0')))

workspaceRootFor :: Text -> IO FilePath
workspaceRootFor project = do
  root <- lookupEnv "WORKSPACE_ROOT"
  pure $ maybe "/data/workspaces" id root </> T.unpack project

templateRootFor :: IO FilePath
templateRootFor = do
  v <- lookupEnv "PLUTUS_TEMPLATE_ROOT"
  pure $ maybe "/opt/cardano-ide/plutus-template" id v

cabalDirFor :: IO FilePath
cabalDirFor = do
  v <- lookupEnv "CABAL_DIR"
  pure $ maybe "/opt/cardano-ide/cabal-home" id v

compileScriptFor :: IO FilePath
compileScriptFor = pure "/app/scripts/compile-plutus-main.sh"

pumpHandle :: (Text -> IO ()) -> Handle -> IO ()
pumpHandle logger h = do
  hSetBuffering h LineBuffering
  let loop = do
        r <- try (hGetLine h) :: IO (Either IOError String)
        case r of
          Left e ->
            unless (isEOFError e) $
              logger (T.pack ("[io] " <> show e))
          Right line -> do
            logger (T.pack line)
            loop
  loop

runProcessStreaming :: (Text -> IO ()) -> FilePath -> [String] -> IO ExitCode
runProcessStreaming logger exe args = do
  logger ("$ " <> T.pack (unwords (exe : args)))

  r <- try $
    createProcess
      (proc exe args)
        { std_out = CreatePipe
        , std_err = CreatePipe
        }

  case r of
    Left (e :: SomeException) -> do
      logger (T.pack ("[process] " <> show e))
      pure (ExitFailure 1)

    Right (_, mout, merr, ph) ->
      case (mout, merr) of
        (Just hout, Just herr) -> do
          t1 <- forkIO (pumpHandle logger hout)
          t2 <- forkIO (pumpHandle logger herr)
          ec <- waitForProcess ph
          killThread t1
          killThread t2
          pure ec
        _ -> pure (ExitFailure 1)

compileSelected :: Text -> Text -> (Text -> IO ()) -> IO Bool
compileSelected project selectedPath logger = do
  let relSelected = T.unpack selectedPath

  if null relSelected
    then do
      logger "[compile] no selected file supplied"
      pure False
    else do
      wsRoot <- workspaceRootFor project
      templateRoot <- templateRootFor
      cabalDir <- cabalDirFor
      compileScript <- compileScriptFor

      let selectedAbs = wsRoot </> relSelected
      let contractName = takeBaseName selectedAbs
      let artifactOut = wsRoot </> "artifacts" </> contractName

      logger ("[compile] workspace: " <> project)
      logger ("[compile] selected file: " <> selectedPath)
      logger ("[compile] workspace root: " <> T.pack wsRoot)
      logger ("[compile] template root: " <> T.pack templateRoot)
      logger ("[compile] artifact output: " <> T.pack artifactOut)

      srcExists <- doesFileExist selectedAbs
      unless srcExists $
        logger ("[compile] selected source file not found: " <> T.pack selectedAbs)

      scriptExists <- doesFileExist compileScript
      unless scriptExists $
        logger ("[compile] compile script not found: " <> T.pack compileScript)

      tplExists <- doesDirectoryExist templateRoot
      unless tplExists $
        logger ("[compile] template root not found: " <> T.pack templateRoot)

      if not srcExists || not scriptExists || not tplExists
        then pure False
        else do
          jobId <- randomHex
          let jobRoot = "/tmp/cardano-ide-jobs" </> T.unpack jobId

          exists <- doesDirectoryExist jobRoot
          when exists (removePathForcibly jobRoot)
          createDirectoryIfMissing True (takeDirectory jobRoot)

          ec <-
            runProcessStreaming
              logger
              compileScript
              [ selectedAbs
              , templateRoot
              , jobRoot
              , artifactOut
              , cabalDir
              ]

          case ec of
            ExitSuccess -> do
              logger "[compile] main-driven wrapper completed successfully"
              pure True
            ExitFailure code -> do
              logger ("[compile] wrapper failed with exit code " <> T.pack (show code))
              pure False