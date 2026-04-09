{-# LANGUAGE OverloadedStrings #-}

module SafePath where

import Data.Text (Text)
import qualified Data.Text as T
import System.FilePath (isAbsolute, normalise, splitDirectories, joinPath)

-- Mirrors your PHP safe_path behavior:
-- - remove leading slash
-- - forbid ".."
-- - forbid NUL
safePath :: Text -> Either Text FilePath
safePath raw =
  let s0 = T.replace "\0" "" raw
      s1 = T.dropWhile (== '/') s0
      fp = T.unpack s1
      norm = normalise fp
      parts = splitDirectories norm
  in if isAbsolute norm
       then Left "Invalid path"
       else if any (== "..") parts
              then Left "Invalid path"
              else Right (joinPath parts)