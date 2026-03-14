{-# LANGUAGE OverloadedStrings #-}
{-# LANGUAGE ScopedTypeVariables #-}

module WorkspaceImport
  ( cloneRepo
  , importGist
  ) where

import Control.Exception (catch, IOException)
import Control.Monad (forM, forM_, when, filterM)
import Data.Text (Text)
import qualified Data.Text as T
import qualified Data.Text.IO as TIO
import System.Directory
import System.FilePath
import System.Process (readCreateProcessWithExitCode, shell)
import System.Exit (ExitCode(..))
import System.IO (withFile, IOMode(ReadMode), hFileSize)

import Types
import Workspace (ensureProject, projectDir)

-- Only allow GitHub HTTPS URLs
isAllowedGithub :: Text -> Bool
isAllowedGithub url =
  T.isPrefixOf "https://github.com/" url &&
  (T.count "/" url >= 4)

rrmdir :: FilePath -> IO ()
rrmdir p = removeDirectoryRecursive p `catch` \(_ :: IOException) -> pure ()

copyTree :: FilePath -> FilePath -> IO ()
copyTree src dst = do
  items <- listDirectory src `catch` \(_ :: IOException) -> pure []
  forM_ items $ \name -> do
    when (name /= ".git") $ do
      let sp = src </> name
      let dp = dst </> name
      isD <- doesDirectoryExist sp
      if isD
        then do
          createDirectoryIfMissing True dp
          copyTree sp dp
        else do
          sz <- getFileSizeSafe sp
          when (sz <= 2000000) $ do
            createDirectoryIfMissing True (takeDirectory dp)
            copyFile sp dp `catch` \(_ :: IOException) -> pure ()

getFileSizeSafe :: FilePath -> IO Integer
getFileSizeSafe f =
  withFile f ReadMode hFileSize `catch` \(_ :: IOException) -> pure 0

listFilesWithContent :: FilePath -> IO [ImportFile]
listFilesWithContent base = do
  allPaths <- listDirectoryRecursive base
  files <- filterM doesFileExist allPaths
  fmap concat $ forM files $ \f -> do
    sz <- getFileSizeSafe f
    if sz > 2000000
      then pure []
      else do
        txt <- TIO.readFile f `catch` \(_ :: IOException) -> pure ""
        let rel = makeRelative base f
        pure [ImportFile (toSlash rel) txt]
 where
  toSlash = T.pack . map (\c -> if c == '\\' then '/' else c)

listDirectoryRecursive :: FilePath -> IO [FilePath]
listDirectoryRecursive top = do
  items <- listDirectory top `catch` \(_ :: IOException) -> pure []
  fmap concat $ forM items $ \name -> do
    let p = top </> name
    isD <- doesDirectoryExist p
    if isD
      then
        if name == ".git"
          then pure []
          else listDirectoryRecursive p
      else pure [p]

cloneRepo :: Text -> Text -> IO ImportResp
cloneRepo project repoUrl0 = do
  let repoUrl = T.strip repoUrl0
  if T.null repoUrl
    then pure (ImportErr "Missing repoUrl")
    else
      if not (isAllowedGithub repoUrl)
        then pure (ImportErr "Only GitHub HTTPS repo URLs allowed (e.g. https://github.com/org/repo).")
        else do
          ensureProject project
          pdir <- projectDir project

          tmpBase <- getTemporaryDirectory
          let tmp = tmpBase </> ("cardanoide_clone_" <> T.unpack (T.take 12 (T.filter (/= '-') repoUrl)))
          createDirectoryIfMissing True tmp

          let cmd = "git clone --depth 1 " <> T.unpack repoUrl <> " " <> tmp <> " 2>&1"
          (ec, out, _) <- readCreateProcessWithExitCode (shell cmd) ""

          case ec of
            ExitFailure _ -> do
              rrmdir tmp
              pure (ImportErr (T.pack ("Clone failed: " <> out)))
            ExitSuccess -> do
              copyTree tmp pdir
              rrmdir tmp
              fs <- listFilesWithContent pdir
              pure (ImportOk fs)

importGist :: Text -> Text -> IO ImportResp
importGist _project _gistUrl =
  pure (ImportErr "Gist import endpoint is not implemented on server (client-side gist import works).")