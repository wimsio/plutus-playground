<?php
declare(strict_types=1);

require_once __DIR__ . "/bootstrap.php";
require_once __DIR__ . "/Workspace.php";

final class WorkspaceImport
{
  private static function rrmdir(string $dir): void
  {
    if (!is_dir($dir)) return;
    $items = scandir($dir);
    if (!is_array($items)) return;

    foreach ($items as $it) {
      if ($it === "." || $it === "..") continue;
      $p = $dir . "/" . $it;
      if (is_dir($p)) self::rrmdir($p);
      else @unlink($p);
    }
    @rmdir($dir);
  }

  private static function mkdirp(string $dir): void
  {
    if ($dir === "" || $dir === "." || is_dir($dir)) return;
    @mkdir($dir, 0777, true);
  }

  private static function copyTree(string $src, string $dest): void
  {
    $items = scandir($src);
    if (!is_array($items)) return;

    foreach ($items as $it) {
      if ($it === "." || $it === "..") continue;
      if ($it === ".git") continue;

      $sp = $src . "/" . $it;
      $dp = $dest . "/" . $it;

      if (is_dir($sp)) {
        self::mkdirp($dp);
        self::copyTree($sp, $dp);
      } else {
        $size = @filesize($sp);
        // skip huge binaries
        if (is_int($size) && $size > 2_000_000) continue;

        self::mkdirp(dirname($dp));
        @copy($sp, $dp);
      }
    }
  }

  private static function listFilesWithContent(string $projectDir): array
  {
    $out = [];

    $rii = new RecursiveIteratorIterator(
      new RecursiveDirectoryIterator($projectDir, FilesystemIterator::SKIP_DOTS)
    );

    $base = rtrim($projectDir, "/");
    $baseLen = strlen($base) + 1;

    foreach ($rii as $file) {
      /** @var SplFileInfo $file */
      if (!$file->isFile()) continue;
      if ($file->getSize() > 2_000_000) continue;

      $full = $file->getPathname();
      $rel = substr($full, $baseLen);
      $rel = str_replace("\\", "/", $rel);

      $content = @file_get_contents($full);
      if ($content === false) $content = "";

      $out[] = ["path" => $rel, "content" => $content];
    }

    return $out;
  }

  public static function cloneRepo(string $project, string $repoUrl): array
  {
    $project = safe_path($project);
    $repoUrl = trim($repoUrl);

    if ($repoUrl === "") {
      return ["ok" => false, "error" => "Missing repoUrl"];
    }

    // ✅ Safety: only allow GitHub HTTPS URLs (simple + predictable)
    if (!preg_match('#^https://github\.com/[\w\-.]+/[\w\-.]+(\.git)?/?$#', $repoUrl)) {
      return ["ok" => false, "error" => "Only GitHub HTTPS repo URLs allowed (e.g. https://github.com/org/repo)."];
    }

    // Ensure workspace exists using your existing logic
    Workspace::ensureProject($project);
    $projectDir = Workspace::projectDir($project);

    // Ensure git exists
    $git = trim((string) shell_exec("command -v git"));
    if ($git === "") {
      return ["ok" => false, "error" => "git is not installed on the server. Install git for clone to work."];
    }

    // Clone to temp directory
    $tmp = sys_get_temp_dir() . "/cardanoide_clone_" . bin2hex(random_bytes(6));
    @mkdir($tmp, 0777, true);

    $cmd = sprintf(
      "git clone --depth 1 %s %s 2>&1",
      escapeshellarg($repoUrl),
      escapeshellarg($tmp)
    );

    $output = (string) shell_exec($cmd);

    if (!is_dir($tmp . "/.git")) {
      self::rrmdir($tmp);
      return ["ok" => false, "error" => "Clone failed: " . trim($output)];
    }

    // Copy cloned files into workspace dir (skip .git)
    self::copyTree($tmp, $projectDir);

    // Return files (frontend uses this to import into UI workspace tree)
    $files = self::listFilesWithContent($projectDir);

    self::rrmdir($tmp);

    return ["ok" => true, "files" => $files];
  }
}