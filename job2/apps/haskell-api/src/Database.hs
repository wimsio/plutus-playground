{-# LANGUAGE OverloadedStrings #-}

module Database
  ( withRedis
  , initDatabase
  , saveWorkspaceMeta
  , loadWorkspaceMeta
  , getWorkspaceMeta
  , appendBuildLog
  , loadBuildLogs
  , getBuildHistory
  , recordBuildStarted
  , recordBuildFinished
  , recordWorkspaceCreated
  , recordWorkspaceRenamed
  , recordWorkspaceDeleted
  , recordWorkspaceCleared
  , recordWorkspaceRestored
  , recordFileWrite
  ) where

import Control.Exception (SomeException, try)
import Control.Monad (void)
import qualified Data.Aeson as Aeson
import Data.Aeson (FromJSON, ToJSON, Value, object, (.=))
import qualified Data.ByteString.Char8 as B8
import qualified Data.ByteString.Lazy as LBS
import Data.Maybe (fromMaybe)
import Data.Text (Text)
import qualified Data.Text as T
import qualified Data.Text.Encoding as TE
import Database.Redis
import System.Environment (lookupEnv)

withRedis :: Redis a -> IO a
withRedis action = do
  host <- lookupEnv "REDIS_HOST"
  let redisHost = maybe "127.0.0.1" id host
  conn <- checkedConnect defaultConnectInfo
    { connectHost = redisHost
    , connectPort = PortNumber 6379
    }
  runRedis conn action

decodeStrict :: FromJSON a => B8.ByteString -> Maybe a
decodeStrict = Aeson.decode . LBS.fromStrict

encodeStrict :: ToJSON a => a -> B8.ByteString
encodeStrict = LBS.toStrict . Aeson.encode

liftRedisResult :: Either Reply a -> Redis a
liftRedisResult (Right x) = pure x
liftRedisResult (Left e) = fail (show e)

initDatabase :: IO ()
initDatabase = do
  _ <- (try $
    withRedis $ do
      pong <- ping
      liftRedisResult pong) :: IO (Either SomeException Status)
  pure ()

workspaceMetaKey :: Text -> B8.ByteString
workspaceMetaKey workspace = TE.encodeUtf8 ("ide:workspace:" <> workspace <> ":meta")

workspaceBuildsKey :: Text -> B8.ByteString
workspaceBuildsKey workspace = TE.encodeUtf8 ("ide:workspace:" <> workspace <> ":builds")

workspaceFilesKey :: Text -> B8.ByteString
workspaceFilesKey workspace = TE.encodeUtf8 ("ide:workspace:" <> workspace <> ":files")

buildLogKey :: Text -> B8.ByteString
buildLogKey jobId = TE.encodeUtf8 ("ide:build:" <> jobId <> ":logs")

buildMetaKey :: Text -> B8.ByteString
buildMetaKey jobId = TE.encodeUtf8 ("ide:build:" <> jobId <> ":meta")

saveWorkspaceMeta :: Text -> Value -> IO ()
saveWorkspaceMeta workspace meta =
  void $ withRedis $ set (workspaceMetaKey workspace) (encodeStrict meta)

loadWorkspaceMeta :: Text -> IO (Maybe Value)
loadWorkspaceMeta workspace = do
  result <- withRedis $ get (workspaceMetaKey workspace)
  case result of
    Right (Just bs) -> pure (decodeStrict bs)
    _ -> pure Nothing

getWorkspaceMeta :: Text -> IO Value
getWorkspaceMeta workspace = do
  meta <- loadWorkspaceMeta workspace
  pure $ fromMaybe (object ["workspace" .= workspace]) meta

appendBuildLog :: Text -> Text -> IO ()
appendBuildLog jobId line =
  void $ withRedis $ rpush (buildLogKey jobId) [TE.encodeUtf8 line]

loadBuildLogs :: Text -> IO [Text]
loadBuildLogs jobId = do
  result <- withRedis $ lrange (buildLogKey jobId) 0 (-1)
  case result of
    Right xs -> pure (map TE.decodeUtf8 xs)
    Left _ -> pure []

getBuildHistory :: Text -> IO [Value]
getBuildHistory workspace = do
  result <- withRedis $ lrange (workspaceBuildsKey workspace) 0 (-1)
  case result of
    Right xs ->
      pure [ v | bs <- xs, Just v <- [decodeStrict bs :: Maybe Value] ]
    Left _ -> pure []

recordBuildStarted :: Text -> Text -> Text -> IO ()
recordBuildStarted project selectedPath jobId = do
  let payload =
        object
          [ "project" .= project
          , "selectedPath" .= selectedPath
          , "jobId" .= jobId
          , "status" .= T.pack "started"
          ]
  void $ withRedis $ do
    _ <- set (buildMetaKey jobId) (encodeStrict payload)
    _ <- lpush (workspaceBuildsKey project) [encodeStrict payload]
    pure ()

recordBuildFinished :: Text -> Text -> Bool -> IO ()
recordBuildFinished project jobId ok = do
  let payload =
        object
          [ "project" .= project
          , "jobId" .= jobId
          , "status" .= if ok then T.pack "success" else T.pack "failed"
          , "ok" .= ok
          ]
  void $ withRedis $ do
    _ <- set (buildMetaKey jobId) (encodeStrict payload)
    _ <- lpush (workspaceBuildsKey project) [encodeStrict payload]
    pure ()

recordWorkspaceCreated :: Text -> IO ()
recordWorkspaceCreated workspace =
  saveWorkspaceMeta workspace $
    object
      [ "workspace" .= workspace
      , "status" .= T.pack "created"
      ]

recordWorkspaceRenamed :: Text -> Text -> IO ()
recordWorkspaceRenamed oldName newName =
  saveWorkspaceMeta newName $
    object
      [ "workspace" .= newName
      , "previousName" .= oldName
      , "status" .= T.pack "renamed"
      ]

recordWorkspaceDeleted :: Text -> IO ()
recordWorkspaceDeleted workspace =
  saveWorkspaceMeta workspace $
    object
      [ "workspace" .= workspace
      , "status" .= T.pack "deleted"
      ]

recordWorkspaceCleared :: Text -> IO ()
recordWorkspaceCleared workspace =
  saveWorkspaceMeta workspace $
    object
      [ "workspace" .= workspace
      , "status" .= T.pack "cleared"
      ]

recordWorkspaceRestored :: Text -> IO ()
recordWorkspaceRestored workspace =
  saveWorkspaceMeta workspace $
    object
      [ "workspace" .= workspace
      , "status" .= T.pack "restored"
      ]

recordFileWrite :: Text -> Text -> IO ()
recordFileWrite workspace path = do
  let payload =
        object
          [ "workspace" .= workspace
          , "path" .= path
          , "event" .= T.pack "write"
          ]
  void $ withRedis $ lpush (workspaceFilesKey workspace) [encodeStrict payload]