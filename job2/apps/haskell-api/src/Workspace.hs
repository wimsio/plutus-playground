{-# LANGUAGE OverloadedStrings #-}
{-# LANGUAGE ScopedTypeVariables #-}

module Workspace
  ( workspaceRoot
  , ensureProject
  , projectDir
  , listWorkspaces
  , listTree
  , listFiles
  , readFileText
  , writeFileText
  , mkdirp
  , touch
  , deletePath
  , renamePath
  , saveUpload
  , saveUploadBytes
  , renameWorkspace
  , deleteWorkspace
  , deleteAllWorkspace
  , exportWorkspaceBackup
  , restoreWorkspaceBackup
  ) where

import Control.Exception (catch, IOException)
import Control.Monad (forM, when, filterM, forM_)
import Data.Aeson (ToJSON(..), object, (.=), Value(..))
import Data.List (sort, dropWhileEnd)
import qualified Data.ByteString.Lazy as LBS
import Data.Text (Text)
import qualified Data.Text as T
import qualified Data.Text.IO as TIO
import qualified System.Directory as Dir
import System.Environment (lookupEnv)
import System.FilePath ((</>), takeDirectory, takeFileName, makeRelative)
import System.IO (withFile, IOMode(ReadMode), hFileSize)

import SafePath
import Types (ImportFile(..), WorkspaceBackup(..))

workspaceRoot :: IO FilePath
workspaceRoot = do
  env <- lookupEnv "WORKSPACE_ROOT"
  pure $ maybe "/data/workspaces" (\p -> dropWhileEnd (== '/') p) env

projectDir :: Text -> IO FilePath
projectDir project = do
  root <- workspaceRoot
  case safePath project of
    Left _  -> pure (root </> "invalid")
    Right p -> pure (root </> p)

ensureProject :: Text -> IO ()
ensureProject project = do
  dir <- projectDir project
  Dir.createDirectoryIfMissing True dir

listWorkspaces :: IO [Text]
listWorkspaces = do
  root <- workspaceRoot
  Dir.createDirectoryIfMissing True root
  xs <- Dir.listDirectory root `catch` \(_ :: IOException) -> pure []
  dirs <- filterM (\x -> Dir.doesDirectoryExist (root </> x)) xs
  pure (map T.pack (sort dirs))

listTree :: Text -> Text -> IO [TreeNode]
listTree project pathT = do
  ensureProject project
  base <- projectDir project
  case safePath pathT of
    Left _ -> pure []
    Right rel -> do
      let absDir = base </> rel
      ok <- Dir.doesDirectoryExist absDir
      if not ok
        then pure []
        else walk absDir (T.unpack (T.dropWhileEnd (== '/') pathT))
 where
  walk :: FilePath -> FilePath -> IO [TreeNode]
  walk absDir relDir = do
    items <- Dir.listDirectory absDir `catch` \(_ :: IOException) -> pure []
    let itemsS = sort items
    forM itemsS $ \name -> do
      let absP = absDir </> name
      let relP = if null relDir then name else relDir </> name
      isD <- Dir.doesDirectoryExist absP
      if isD
        then do
          kids <- walk absP relP
          pure (DirNode (T.pack name) (toSlash relP) kids)
        else pure (FileNode (T.pack name) (toSlash relP))

toSlash :: FilePath -> Text
toSlash = T.pack . map (\c -> if c == '\\' then '/' else c)

data TreeNode
  = DirNode  { tnName :: Text, tnPath :: Text, tnChildren :: [TreeNode] }
  | FileNode { tnName :: Text, tnPath :: Text }
  deriving (Show)

instance ToJSON TreeNode where
  toJSON (DirNode n p ch) =
    object ["type" .= String "dir", "name" .= n, "path" .= p, "children" .= ch]
  toJSON (FileNode n p) =
    object ["type" .= String "file", "name" .= n, "path" .= p]

listFiles :: Text -> Text -> IO [Text]
listFiles project pathT = do
  ensureProject project
  base <- projectDir project
  case safePath pathT of
    Left _ -> pure []
    Right rel -> do
      let absDir = base </> rel
      ok <- Dir.doesDirectoryExist absDir
      if not ok
        then pure []
        else do
          xs <- Dir.listDirectory absDir `catch` \(_ :: IOException) -> pure []
          pure (map T.pack (sort xs))

readFileText :: Text -> Text -> IO Text
readFileText project pathT = do
  ensureProject project
  base <- projectDir project
  case safePath pathT of
    Left e -> fail (T.unpack e)
    Right rel -> do
      let f = base </> rel
      ok <- Dir.doesFileExist f
      if not ok then fail "Not found" else TIO.readFile f

writeFileText :: Text -> Text -> Text -> IO ()
writeFileText project pathT content = do
  ensureProject project
  base <- projectDir project
  case safePath pathT of
    Left _ -> pure ()
    Right rel -> do
      let f = base </> rel
      Dir.createDirectoryIfMissing True (takeDirectory f)
      TIO.writeFile f content

mkdirp :: Text -> Text -> IO ()
mkdirp project pathT = do
  ensureProject project
  base <- projectDir project
  case safePath pathT of
    Left _   -> pure ()
    Right rel -> Dir.createDirectoryIfMissing True (base </> rel)

touch :: Text -> Text -> IO ()
touch project pathT = do
  ensureProject project
  base <- projectDir project
  case safePath pathT of
    Left _ -> pure ()
    Right rel -> do
      let f = base </> rel
      Dir.createDirectoryIfMissing True (takeDirectory f)
      ok <- Dir.doesFileExist f
      when (not ok) (TIO.writeFile f "")

deletePath :: Text -> Text -> IO ()
deletePath project pathT = do
  ensureProject project
  base <- projectDir project
  case safePath pathT of
    Left _ -> pure ()
    Right rel -> do
      let absP = base </> rel
      isF <- Dir.doesFileExist absP
      isD <- Dir.doesDirectoryExist absP
      if isF
        then Dir.removeFile absP
        else when isD (Dir.removeDirectoryRecursive absP)

renamePath :: Text -> Text -> Text -> IO ()
renamePath project fromT toT = do
  ensureProject project
  base <- projectDir project
  case (safePath fromT, safePath toT) of
    (Right a, Right b) -> do
      let src = base </> a
      let dst = base </> b
      Dir.createDirectoryIfMissing True (takeDirectory dst)
      renamePathIO src dst
    _ -> pure ()

renamePathIO :: FilePath -> FilePath -> IO ()
renamePathIO a b =
  Dir.renamePath a b `catch` \(_ :: IOException) -> pure ()

saveUpload :: Text -> Text -> FilePath -> Text -> IO Text
saveUpload project dirPath tmp originalName = do
  ensureProject project
  base <- projectDir project
  let name = takeFileName (T.unpack originalName)

  case safePath dirPath of
    Left _ -> do
      let dest = base </> name
      safeMove tmp dest
      pure (toSlash name)
    Right relDir -> do
      let destDir = base </> relDir
      Dir.createDirectoryIfMissing True destDir
      let dest = destDir </> name
      safeMove tmp dest
      let relOut = if null relDir then name else relDir </> name
      pure (toSlash relOut)

saveUploadBytes :: Text -> Text -> LBS.ByteString -> Text -> IO Text
saveUploadBytes project dirPath content originalName = do
  ensureProject project
  base <- projectDir project
  let name = takeFileName (T.unpack originalName)

  case safePath dirPath of
    Left _ -> do
      let dest = base </> name
      Dir.createDirectoryIfMissing True (takeDirectory dest)
      LBS.writeFile dest content
      pure (toSlash name)
    Right relDir -> do
      let destDir = base </> relDir
      Dir.createDirectoryIfMissing True destDir
      let dest = destDir </> name
      LBS.writeFile dest content
      let relOut = if null relDir then name else relDir </> name
      pure (toSlash relOut)

renameWorkspace :: Text -> Text -> IO ()
renameWorkspace oldName newName = do
  root <- workspaceRoot
  case (safePath oldName, safePath newName) of
    (Right oldP, Right newP) -> do
      let src = root </> oldP
      let dst = root </> newP
      Dir.createDirectoryIfMissing True (takeDirectory dst)
      Dir.renamePath src dst
    _ -> pure ()

deleteWorkspace :: Text -> IO ()
deleteWorkspace name = do
  dir <- projectDir name
  exists <- Dir.doesDirectoryExist dir
  when exists (Dir.removeDirectoryRecursive dir)

deleteAllWorkspace :: Text -> IO ()
deleteAllWorkspace name = do
  dir <- projectDir name
  Dir.createDirectoryIfMissing True dir
  items <- Dir.listDirectory dir `catch` \(_ :: IOException) -> pure []
  forM_ items $ \nm -> do
    let p = dir </> nm
    isD <- Dir.doesDirectoryExist p
    isF <- Dir.doesFileExist p
    when isD (Dir.removeDirectoryRecursive p)
    when isF (Dir.removeFile p)

exportWorkspaceBackup :: Text -> IO WorkspaceBackup
exportWorkspaceBackup project = do
  ensureProject project
  base <- projectDir project
  files <- listAllFilesWithContent base
  pure (WorkspaceBackup project files)

restoreWorkspaceBackup :: Text -> WorkspaceBackup -> IO ()
restoreWorkspaceBackup project (WorkspaceBackup _ files) = do
  deleteAllWorkspace project
  ensureProject project
  forM_ files $ \(ImportFile p c) -> writeFileText project p c

listAllFilesWithContent :: FilePath -> IO [ImportFile]
listAllFilesWithContent base = do
  allPaths <- listDirectoryRecursive base
  files <- filterM Dir.doesFileExist allPaths
  fmap concat $ forM files $ \f -> do
    sz <- getFileSizeSafe f
    if sz > 2000000
      then pure []
      else do
        txt <- TIO.readFile f `catch` \(_ :: IOException) -> pure ""
        let rel = makeRelative base f
        pure [ImportFile (toSlash rel) txt]

listDirectoryRecursive :: FilePath -> IO [FilePath]
listDirectoryRecursive top = do
  items <- Dir.listDirectory top `catch` \(_ :: IOException) -> pure []
  fmap concat $ forM items $ \name -> do
    let p = top </> name
    isD <- Dir.doesDirectoryExist p
    if isD then listDirectoryRecursive p else pure [p]

getFileSizeSafe :: FilePath -> IO Integer
getFileSizeSafe f =
  withFile f ReadMode hFileSize `catch` \(_ :: IOException) -> pure 0

safeMove :: FilePath -> FilePath -> IO ()
safeMove tmp dest =
  Dir.renameFile tmp dest `catch` \(_ :: IOException) -> do
    Dir.copyFile tmp dest
    Dir.removeFile tmp `catch` \(_ :: IOException) -> pure ()