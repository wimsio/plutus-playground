{-# LANGUAGE OverloadedStrings #-}

module Main where

import Data.Aeson (decode, encode, object, (.=))
import qualified Data.ByteString as BS
import qualified Data.ByteString.Lazy as LBS
import Data.Text (Text)
import qualified Data.Text as T
import qualified Data.Text.Encoding as TE
import Network.HTTP.Types (status200, status400, status404)
import qualified Network.HTTP.Types.URI as URI
import Network.Wai
import Network.Wai.Handler.Warp (run)
import Network.Wai.Middleware.Cors
import Network.Wai.Parse
  ( fileContent
  , lbsBackEnd
  , parseRequestBody
  )
import System.Environment (lookupEnv)

import qualified Database as DB
import qualified Jobs
import Types
import qualified Workspace as W
import qualified WorkspaceImport

main :: IO ()
main = do
  putStrLn "Cardano IDE Haskell API on :8080"
  run 8080 =<< app

app :: IO Application
app = do
  allowed <- loadAllowedOrigins
  let corsMw = cors (const (Just (corsPolicy allowed)))
  pure $ corsMw $ \req respond -> route req >>= respond

loadAllowedOrigins :: IO [BS.ByteString]
loadAllowedOrigins = do
  v <- lookupEnv "ALLOWED_ORIGINS"
  pure $
    maybe
      [ "http://127.0.0.1:5173"
      , "http://localhost:5173"
      , "http://127.0.0.1:5174"
      , "http://localhost:5174"
      , "http://127.0.0.1:5175"
      , "http://localhost:5175"
      ]
      (map TE.encodeUtf8 . map T.pack . splitComma)
      v
 where
  splitComma s = map trim (splitOn ',' s)
  splitOn c xs =
    case break (== c) xs of
      (a, [])  -> [a]
      (a, _:b) -> a : splitOn c b
  trim = reverse . dropWhile (== ' ') . reverse . dropWhile (== ' ')

corsPolicy :: [BS.ByteString] -> CorsResourcePolicy
corsPolicy allowed =
  simpleCorsResourcePolicy
    { corsOrigins = Just (allowed, True)
    , corsMethods = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    , corsRequestHeaders = ["Content-Type", "Authorization", "X-Requested-With"]
    }

json :: LBS.ByteString -> Response
json b = responseLBS status200 [("Content-Type", "application/json")] b

jsonAttachment :: BS.ByteString -> LBS.ByteString -> Response
jsonAttachment filename b =
  responseLBS
    status200
    [ ("Content-Type", "application/json")
    , ("Content-Disposition", BS.concat ["attachment; filename=\"", filename, "\""])
    ]
    b

textPlain :: LBS.ByteString -> Response
textPlain b = responseLBS status200 [("Content-Type", "text/plain")] b

badReq :: Text -> Response
badReq msg =
  responseLBS status400 [("Content-Type", "application/json")] (encode (ImportErr msg))

notFound :: Response
notFound =
  responseLBS status404 [("Content-Type", "application/json")] (encode (ImportErr "Not found"))

route :: Request -> IO Response
route req =
  case (requestMethod req, pathInfo req) of

    ("GET", []) ->
      pure (textPlain "OK - Cardano IDE API")

    ("GET", ["health"]) ->
      pure (json (encode (OkResp True)))

    ("GET", ["api", "workspaces"]) -> do
      xs <- W.listWorkspaces
      pure (json (encode (ItemsResp xs)))

    ("POST", ["api", "workspaces", "create"]) -> do
      body <- strictRequestBody req
      let name = formField "name" body
      W.ensureProject name
      DB.recordWorkspaceCreated name
      pure (json (encode (OkResp True)))

    ("POST", ["api", "workspaces", "rename"]) -> do
      body <- strictRequestBody req
      let oldName = formField "oldName" body
      let newName = formField "newName" body
      W.renameWorkspace oldName newName
      DB.recordWorkspaceRenamed oldName newName
      pure (json (encode (OkResp True)))

    ("POST", ["api", "workspaces", "delete"]) -> do
      body <- strictRequestBody req
      let name = formField "name" body
      W.deleteWorkspace name
      DB.recordWorkspaceDeleted name
      pure (json (encode (OkResp True)))

    ("POST", ["api", "workspaces", "delete-all"]) -> do
      body <- strictRequestBody req
      let name = formField "name" body
      W.deleteAllWorkspace name
      DB.recordWorkspaceCleared name
      pure (json (encode (OkResp True)))

    ("GET", ["api", "workspaces", project, "download"]) -> do
      payload <- W.exportWorkspaceBackup project
      pure (jsonAttachment (TE.encodeUtf8 project <> ".workspace.json") (encode payload))

    ("GET", ["api", "workspaces", project, "backup"]) -> do
      payload <- W.exportWorkspaceBackup project
      pure (jsonAttachment (TE.encodeUtf8 project <> ".backup.json") (encode payload))

    ("POST", ["api", "workspaces", project, "restore"]) -> do
      (_, files) <- parseRequestBody lbsBackEnd req
      case lookup "file" files of
        Nothing -> pure (badReq "Missing restore file")
        Just fi ->
          case decode (fileContent fi) :: Maybe WorkspaceBackup of
            Nothing -> pure (badReq "Invalid backup file")
            Just backup -> do
              W.restoreWorkspaceBackup project backup
              DB.recordWorkspaceRestored project
              pure (json (encode (OkResp True)))

    ("GET", ["api", "workspaces", project, "meta"]) -> do
      meta <- DB.getWorkspaceMeta project
      pure (json (encode meta))

    ("GET", ["api", "workspaces", project, "builds"]) -> do
      builds <- DB.getBuildHistory project
      pure (json (encode (ItemsResp builds)))

    ("GET", ["api", "workspace", project, "tree"]) -> do
      let pathQ = queryParam "path" req
      items <- W.listTree project pathQ
      pure (json (encode (object ["items" .= items])))

    ("POST", ["api", "workspace", project, "mkdir"]) -> do
      body <- strictRequestBody req
      let p = formField "path" body
      W.mkdirp project p
      pure (json (encode (OkResp True)))

    ("POST", ["api", "workspace", project, "touch"]) -> do
      body <- strictRequestBody req
      let p = formField "path" body
      W.touch project p
      pure (json (encode (OkResp True)))

    ("POST", ["api", "workspace", project, "delete"]) -> do
      body <- strictRequestBody req
      let p = formField "path" body
      W.deletePath project p
      pure (json (encode (OkResp True)))

    ("POST", ["api", "workspace", project, "rename"]) -> do
      body <- strictRequestBody req
      let fromP = formField "from" body
      let toP = formField "to" body
      W.renamePath project fromP toP
      pure (json (encode (OkResp True)))

    ("POST", ["api", "workspace", project, "upload"]) -> do
      let dirQ = queryParam "dir" req
      (_, files) <- parseRequestBody lbsBackEnd req
      case lookup "file" files of
        Nothing -> pure (badReq "Missing file")
        Just fi -> do
          let contentBytes = fileContent fi
          let origName = "upload.bin"
          savedRel <- W.saveUploadBytes project dirQ contentBytes origName
          pure (json (encode (object ["ok" .= True, "path" .= savedRel])))

    ("GET", ["api", "workspace", project, "list"]) -> do
      let p = queryParam "path" req
      items <- W.listFiles project p
      pure (json (encode (ItemsResp items)))

    ("GET", ["api", "workspace", project, "read"]) -> do
      let p = queryParam "path" req
      c <- W.readFileText project p
      pure (json (encode (ContentResp c)))

    ("POST", ["api", "workspace", project, "write"]) -> do
      body <- strictRequestBody req
      let p = formField "path" body
      let c = formField "content" body
      W.writeFileText project p c
      DB.recordFileWrite project p
      pure (json (encode (OkResp True)))

    ("POST", ["api", "workspace", project, "clone"]) -> do
      body <- strictRequestBody req
      let repoUrl = formField "repoUrl" body
      r <- WorkspaceImport.cloneRepo project repoUrl
      pure (json (encode r))

    ("POST", ["api", "workspace", project, "gist"]) -> do
      body <- strictRequestBody req
      let gistUrl = formField "gistUrl" body
      r <- WorkspaceImport.importGist project gistUrl
      pure (json (encode r))

    ("POST", ["api", "build", project, "start"]) -> do
      body <- strictRequestBody req
      let selectedPath = formField "path" body
      jid <- Jobs.startCompile project selectedPath
      pure (json (encode (JobIdResp jid)))

    ("GET", ["api", "build", jobId, "stream"]) ->
      Jobs.streamLogs jobId

    _ ->
      pure notFound

queryParam :: Text -> Request -> Text
queryParam key req =
  case lookup (TE.encodeUtf8 key) (queryString req) of
    Just (Just v) -> TE.decodeUtf8 v
    _             -> ""

formField :: Text -> LBS.ByteString -> Text
formField key body =
  let pairs = parseFormUrlEncoded (LBS.toStrict body)
  in maybe "" id (lookup key pairs)

parseFormUrlEncoded :: BS.ByteString -> [(Text, Text)]
parseFormUrlEncoded bs =
  let s = TE.decodeUtf8 bs
      parts = T.splitOn "&" s
      kv p =
        case T.splitOn "=" p of
          [k, v] -> (urlDecode k, urlDecode v)
          [k]    -> (urlDecode k, "")
          _      -> ("", "")
  in filter (\(k, _) -> not (T.null k)) (map kv parts)

urlDecode :: Text -> Text
urlDecode = TE.decodeUtf8 . URI.urlDecode True . TE.encodeUtf8