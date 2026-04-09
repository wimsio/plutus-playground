<?php
declare(strict_types=1);

use Predis\Client as RedisClient;

function env(string $key, string $default = ""): string {
  $v = getenv($key);
  return ($v === false || $v === "") ? $default : $v;
}

function redis(): RedisClient {
  static $client = null;
  if ($client) return $client;
  $host = env("REDIS_HOST", "127.0.0.1");
  $client = new RedisClient(["scheme" => "tcp", "host" => $host, "port" => 6379]);
  return $client;
}

function workspace_root(): string {
  return rtrim(env("WORKSPACE_ROOT", __DIR__ . "/../../data/workspaces"), "/");
}

function safe_path(string $path): string {
  $path = str_replace("\0", "", $path);
  $path = ltrim($path, "/");
  if (str_contains($path, "..")) throw new RuntimeException("Invalid path");
  return $path;
}
