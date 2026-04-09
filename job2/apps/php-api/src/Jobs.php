<?php
declare(strict_types=1);

require_once __DIR__ . "/bootstrap.php";

final class Jobs {
  public static function startCompile(string $project): string {
    $jobId = bin2hex(random_bytes(8));
    $payload = json_encode(["jobId" => $jobId, "type" => "compile", "project" => $project], JSON_UNESCAPED_SLASHES);
    redis()->rpush("queue:jobs", [$payload]);

    redis()->del(["job:$jobId:logs"]);
    redis()->rpush("job:$jobId:logs", ["[job] started"]);

    return $jobId;
  }

  public static function streamLogs(string $jobId): void {
    $jobId = safe_path($jobId);

    ignore_user_abort(true);
    set_time_limit(0);
    while (ob_get_level() > 0) { ob_end_flush(); }
    ob_implicit_flush(true);

    header("Content-Type: text/event-stream");
    header("Cache-Control: no-cache");
    header("Connection: keep-alive");
    header("X-Accel-Buffering: no");

    $idx = 0;
    $lastPing = time();

    while (true) {
      $logs = redis()->lrange("job:$jobId:logs", $idx, -1);
      if ($logs) {
        foreach ($logs as $line) {
          $data = json_encode(["line" => $line], JSON_UNESCAPED_SLASHES);
          echo "event: log\n";
          echo "data: $data\n\n";
          @ob_flush(); @flush();
          $idx++;
        }
      }

      if (time() - $lastPing >= 10) {
        echo "event: ping\n";
        echo "data: {}\n\n";
        @ob_flush(); @flush();
        $lastPing = time();
      }

      if (connection_aborted()) break;

      usleep(250000);
    }
  }
}
