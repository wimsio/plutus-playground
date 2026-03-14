{-# LANGUAGE OverloadedStrings #-}

module Schema
  ( workspaceMetaKey
  , workspaceBuildListKey
  , buildRecordKey
  ) where

import qualified Data.ByteString.Char8 as B8
import Data.Text (Text)
import qualified Data.Text as T

toKey :: Text -> B8.ByteString
toKey = B8.pack . T.unpack

workspaceMetaKey :: Text -> B8.ByteString
workspaceMetaKey project =
  toKey ("ide:workspace:" <> project <> ":meta")

workspaceBuildListKey :: Text -> B8.ByteString
workspaceBuildListKey project =
  toKey ("ide:workspace:" <> project <> ":builds")

buildRecordKey :: Text -> B8.ByteString
buildRecordKey jobId =
  toKey ("ide:build:" <> jobId)