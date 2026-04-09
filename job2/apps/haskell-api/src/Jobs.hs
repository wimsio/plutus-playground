{-# LANGUAGE OverloadedStrings #-}
{-# LANGUAGE ScopedTypeVariables #-}

module Jobs
  ( startCompile
  , appendLog
  , streamLogs
  ) where

import Control.Concurrent
import Control.Concurrent.MVar
import Control.Exception (SomeException, try)
import Control.Monad (forM_, unless, void)
import qualified Data.Aeson as Aeson
import Data.Aeson ((.=))
import qualified Data.ByteString.Builder as BB
import qualified Data.Map.Strict as Map
import Data.Map.Strict (Map)
import Data.List (isPrefixOf, isSuffixOf)
import Data.Text (Text)
import qualified Data.Text as T
import qualified Data.Text.Encoding as TE
import Network.HTTP.Types (status200)
import Network.Wai (Response, responseStream)
import System.Directory
import System.Environment (lookupEnv)
import System.Exit (ExitCode(..))
import System.FilePath
import System.IO
import System.IO.Error (isEOFError)
import System.IO.Unsafe (unsafePerformIO)
import System.Process
import System.Random (randomIO)

import qualified Database as DB

data JobState = JobState
  { jsLogs :: [Text]
  , jsDone :: Bool
  , jsOk :: Bool
  }

jobStore :: MVar (Map Text JobState)
jobStore = unsafePerformIO (newMVar Map.empty)
{-# NOINLINE jobStore #-}

randomHex :: IO Text
randomHex = do
  (n :: Int) <- randomIO
  pure (T.pack (take 16 (show (abs n) ++ repeat '0')))

newJob :: IO Text
newJob = do
  jid <- randomHex
  modifyMVar_ jobStore $ \m ->
    pure (Map.insert jid (JobState [] False False) m)
  pure jid

appendLog :: Text -> Text -> IO ()
appendLog jobId line =
  modifyMVar_ jobStore $ \m ->
    pure $ Map.adjust (\s -> s { jsLogs = jsLogs s ++ [line] }) jobId m

finishJob :: Text -> Bool -> IO ()
finishJob jobId ok =
  modifyMVar_ jobStore $ \m ->
    pure $ Map.adjust (\s -> s { jsDone = True, jsOk = ok }) jobId m

workspaceRootFor :: Text -> IO FilePath
workspaceRootFor project = do
  root <- lookupEnv "WORKSPACE_ROOT"
  pure $ maybe "/data/workspaces" id root </> T.unpack project

safeListDirectory :: FilePath -> IO [FilePath]
safeListDirectory dir = do
  r <- try (listDirectory dir) :: IO (Either SomeException [FilePath])
  pure $ either (const []) id r

hasCabalRoot :: FilePath -> IO Bool
hasCabalRoot dir = do
  hasProject <- doesFileExist (dir </> "cabal.project")
  hasCabal <- doesFileExist (dir </> takeFileName dir <.> "cabal")
  files <- safeListDirectory dir
  let anyCabal = any (\f -> ".cabal" `isSuffixOf` f) files
  pure (hasProject || hasCabal || anyCabal)

findBuildRoot :: FilePath -> Text -> IO FilePath
findBuildRoot wsRoot selectedPath = do
  let rel = dropWhile (== '/') (T.unpack selectedPath)
  let start =
        if null rel
          then wsRoot
          else
            let full = wsRoot </> rel
            in if takeExtension full == ".hs" then takeDirectory full else full

  let go dir = do
        exists <- doesDirectoryExist dir
        if not exists
          then pure wsRoot
          else do
            ok <- hasCabalRoot dir
            if ok
              then pure dir
              else
                if normalise dir == normalise wsRoot || takeDirectory dir == dir
                  then pure wsRoot
                  else go (takeDirectory dir)

  go start

pumpHandle :: Text -> Handle -> IO ()
pumpHandle jobId h = do
  hSetBuffering h LineBuffering
  let loop = do
        r <- try (hGetLine h) :: IO (Either IOError String)
        case r of
          Left e ->
            unless (isEOFError e) $
              appendLog jobId (T.pack ("[io] " <> show e))
          Right line -> do
            appendLog jobId (T.pack line)
            loop
  loop

runCommandStreaming :: Text -> FilePath -> String -> IO ExitCode
runCommandStreaming jobId cwd cmd = do
  appendLog jobId (T.pack ("$ " <> cmd))

  procResult <- try $
    createProcess
      (shell cmd)
        { cwd = Just cwd
        , std_out = CreatePipe
        , std_err = CreatePipe
        }

  case procResult of
    Left (e :: SomeException) -> do
      appendLog jobId (T.pack ("[process] " <> show e))
      pure (ExitFailure 1)
    Right (_, mout, merr, ph) ->
      case (mout, merr) of
        (Just hout, Just herr) -> do
          t1 <- forkIO (pumpHandle jobId hout)
          t2 <- forkIO (pumpHandle jobId herr)
          ec <- waitForProcess ph
          killThread t1
          killThread t2
          pure ec
        _ -> pure (ExitFailure 1)

discoverExportExecutables :: FilePath -> IO [String]
discoverExportExecutables buildRoot = do
  let appDir = buildRoot </> "app"
  exists <- doesDirectoryExist appDir
  if not exists
    then pure []
    else do
      names <- safeListDirectory appDir
      pure
        [ dropExtension n
        | n <- names
        , ".hs" `isSuffixOf` n
        , "export" `isPrefixOf` map toLowerAscii n
        ]

toLowerAscii :: Char -> Char
toLowerAscii c
  | 'A' <= c && c <= 'Z' = toEnum (fromEnum c + 32)
  | otherwise = c

runExportExecutables :: Text -> FilePath -> IO ()
runExportExecutables jobId buildRoot = do
  createDirectoryIfMissing True (buildRoot </> "artifacts")
  exes <- discoverExportExecutables buildRoot

  if null exes
    then appendLog jobId "[compile] no export executables found in app/"
    else
      forM_ exes $ \exeName -> do
        appendLog jobId ("[export] running " <> T.pack exeName)
        ec <- runCommandStreaming jobId buildRoot ("cabal run " <> exeName)
        case ec of
          ExitSuccess ->
            appendLog jobId ("[export] " <> T.pack exeName <> " succeeded")
          ExitFailure code ->
            appendLog jobId ("[export] " <> T.pack exeName <> " failed with exit code " <> T.pack (show code))

startCompile :: Text -> Text -> IO Text
startCompile project selectedPath = do
  jobId <- newJob
  DB.recordBuildStarted project selectedPath jobId

  void . forkIO $ do
    appendLog jobId ("[compile] workspace: " <> project)
    if T.null selectedPath
      then appendLog jobId "[compile] no selected file supplied"
      else appendLog jobId ("[compile] selected file: " <> selectedPath)

    wsRoot <- workspaceRootFor project
    buildRoot <- findBuildRoot wsRoot selectedPath
    appendLog jobId ("[compile] build root: " <> T.pack buildRoot)

    rootExists <- doesDirectoryExist buildRoot
    if not rootExists
      then do
        appendLog jobId "[compile] build root does not exist"
        DB.recordBuildFinished project jobId False
        finishJob jobId False
      else do
        buildEc <- runCommandStreaming jobId buildRoot "cabal build"
        case buildEc of
          ExitFailure code -> do
            appendLog jobId ("[compile] cabal build failed with exit code " <> T.pack (show code))
            DB.recordBuildFinished project jobId False
            finishJob jobId False
          ExitSuccess -> do
            appendLog jobId "[compile] cabal build succeeded"
            runExportExecutables jobId buildRoot
            appendLog jobId "[compile] finished"
            DB.recordBuildFinished project jobId True
            finishJob jobId True

  pure jobId

streamLogs :: Text -> IO Response
streamLogs jobId =
  pure $
    responseStream
      status200
      [ ("Content-Type", "text/event-stream")
      , ("Cache-Control", "no-cache")
      , ("Connection", "keep-alive")
      , ("X-Accel-Buffering", "no")
      ]
      (\write flush -> loop write flush 0)
 where
  loop write flush seen = do
    store <- readMVar jobStore
    case Map.lookup jobId store of
      Nothing -> do
        write (BB.string8 "event: done\n")
        write (BB.string8 "data: {\"ok\":false}\n\n")
        flush
      Just st -> do
        let pending = drop seen (jsLogs st)

        forM_ pending $ \line -> do
          write (BB.string8 "event: log\n")
          write (BB.string8 "data: ")
          write (BB.byteString (TE.encodeUtf8 line))
          write (BB.string8 "\n\n")

        flush

        if jsDone st
          then do
            write (BB.string8 "event: done\n")
            write (BB.string8 "data: ")
            write (BB.lazyByteString (Aeson.encode (Aeson.object ["ok" .= jsOk st])))
            write (BB.string8 "\n\n")
            flush
          else do
            threadDelay 250000
            loop write flush (seen + length pending)