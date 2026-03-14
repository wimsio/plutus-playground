<?php
declare(strict_types=1);

require_once __DIR__ . "/bootstrap.php";

final class Workspace
{
  public static function root(): string {
    return workspace_root();
  }

  public static function projectDir(string $project): string {
    $project = safe_path($project);
    return self::root() . "/" . $project;
  }

  public static function ensureProject(string $project): void {
    $dir = self::projectDir($project);
    if (!is_dir($dir)) mkdir($dir, 0777, true);
  }

  /** @return array<int,string> */
  public static function listWorkspaces(): array {
    $root = self::root();
    if (!is_dir($root)) mkdir($root, 0777, true);
    $items = array_values(array_filter(scandir($root) ?: [], fn($x) => $x !== "." && $x !== ".."));
    $items = array_values(array_filter($items, fn($x) => is_dir($root . "/" . $x)));
    sort($items);
    return $items;
  }

  public static function createWorkspace(string $project): void {
    $project = safe_path($project);
    self::ensureProject($project);
  }

  public static function listTree(string $project, string $path = ""): array {
    self::ensureProject($project);
    $base = self::projectDir($project) . "/" . safe_path($path);
    if (!is_dir($base)) return [];

    $walk = function(string $absDir, string $relDir) use (&$walk): array {
      $children = [];
      $items = array_values(array_filter(scandir($absDir) ?: [], fn($x) => $x !== "." && $x !== ".."));
      sort($items);

      foreach ($items as $name) {
        $abs = $absDir . "/" . $name;
        $rel = ($relDir === "" ? $name : $relDir . "/" . $name);

        if (is_dir($abs)) {
          $children[] = [
            "type" => "dir",
            "name" => $name,
            "path" => $rel,
            "children" => $walk($abs, $rel),
          ];
        } else {
          $children[] = [
            "type" => "file",
            "name" => $name,
            "path" => $rel,
          ];
        }
      }
      return $children;
    };

    return $walk($base, $path === "" ? "" : rtrim($path, "/"));
  }

  public static function readFile(string $project, string $path): string {
    self::ensureProject($project);
    $file = self::projectDir($project) . "/" . safe_path($path);
    if (!is_file($file)) throw new RuntimeException("Not found");
    return file_get_contents($file) ?: "";
  }

  public static function writeFile(string $project, string $path, string $content): void {
    self::ensureProject($project);
    $file = self::projectDir($project) . "/" . safe_path($path);
    $dir = dirname($file);
    if (!is_dir($dir)) mkdir($dir, 0777, true);
    file_put_contents($file, $content);
  }

  public static function mkdir(string $project, string $path): void {
    self::ensureProject($project);
    $dir = self::projectDir($project) . "/" . safe_path($path);
    if (!is_dir($dir)) mkdir($dir, 0777, true);
  }

  public static function touch(string $project, string $path): void {
    self::ensureProject($project);
    $file = self::projectDir($project) . "/" . safe_path($path);
    $dir = dirname($file);
    if (!is_dir($dir)) mkdir($dir, 0777, true);
    if (!file_exists($file)) file_put_contents($file, "");
  }

  public static function deletePath(string $project, string $path): void {
    self::ensureProject($project);
    $abs = self::projectDir($project) . "/" . safe_path($path);
    if (is_file($abs)) { unlink($abs); return; }

    if (is_dir($abs)) {
      $it = new RecursiveDirectoryIterator($abs, RecursiveDirectoryIterator::SKIP_DOTS);
      $files = new RecursiveIteratorIterator($it, RecursiveIteratorIterator::CHILD_FIRST);
      foreach ($files as $file) {
        if ($file->isDir()) rmdir($file->getPathname());
        else unlink($file->getPathname());
      }
      rmdir($abs);
    }
  }

  public static function renamePath(string $project, string $from, string $to): void {
    self::ensureProject($project);
    $a = self::projectDir($project) . "/" . safe_path($from);
    $b = self::projectDir($project) . "/" . safe_path($to);
    $dir = dirname($b);
    if (!is_dir($dir)) mkdir($dir, 0777, true);
    rename($a, $b);
  }

  public static function saveUpload(string $project, string $dirPath, array $fileInfo): string {
    self::ensureProject($project);
    $dirAbs = self::projectDir($project) . "/" . safe_path($dirPath);
    if (!is_dir($dirAbs)) mkdir($dirAbs, 0777, true);

    $name = basename((string)($fileInfo["name"] ?? "upload.bin"));
    $tmp  = (string)($fileInfo["tmp_name"] ?? "");
    if ($tmp === "" || !file_exists($tmp)) throw new RuntimeException("Invalid upload");

    $dest = $dirAbs . "/" . $name;
    @rename($tmp, $dest);

    $rel = ($dirPath === "" ? $name : rtrim($dirPath, "/") . "/" . $name);
    return $rel;
  }
}
