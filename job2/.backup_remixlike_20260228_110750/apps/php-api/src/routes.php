<?php
declare(strict_types=1);

use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Slim\App;

require_once __DIR__ . "/Workspace.php";
require_once __DIR__ . "/Jobs.php";

return function (App $app) {
    // Workspaces
  $app->get("/api/workspaces", function (Request $req, Response $res) {
    $res->getBody()->write(json_encode(["items" => Workspace::listWorkspaces()]));
    return $res->withHeader("Content-Type", "application/json");
  });

  $app->post("/api/workspaces/create", function (Request $req, Response $res) {
    $body = (array)($req->getParsedBody() ?? []);
    $name = (string)($body["name"] ?? "");
    Workspace::createWorkspace($name);
    $res->getBody()->write(json_encode(["ok" => true]));
    return $res->withHeader("Content-Type", "application/json");
  });

  // Tree
  $app->get("/api/workspace/{project}/tree", function (Request $req, Response $res, array $args) {
    $project = $args["project"];
    $path = (string)($req->getQueryParams()["path"] ?? "");
    $tree = Workspace::listTree($project, $path);
    $res->getBody()->write(json_encode(["items" => $tree]));
    return $res->withHeader("Content-Type", "application/json");
  });

  // File ops
  $app->post("/api/workspace/{project}/mkdir", function (Request $req, Response $res, array $args) {
    $project = $args["project"];
    $body = (array)($req->getParsedBody() ?? []);
    Workspace::mkdir($project, (string)($body["path"] ?? ""));
    $res->getBody()->write(json_encode(["ok" => true]));
    return $res->withHeader("Content-Type", "application/json");
  });

  $app->post("/api/workspace/{project}/touch", function (Request $req, Response $res, array $args) {
    $project = $args["project"];
    $body = (array)($req->getParsedBody() ?? []);
    Workspace::touch($project, (string)($body["path"] ?? ""));
    $res->getBody()->write(json_encode(["ok" => true]));
    return $res->withHeader("Content-Type", "application/json");
  });

  $app->post("/api/workspace/{project}/delete", function (Request $req, Response $res, array $args) {
    $project = $args["project"];
    $body = (array)($req->getParsedBody() ?? []);
    Workspace::deletePath($project, (string)($body["path"] ?? ""));
    $res->getBody()->write(json_encode(["ok" => true]));
    return $res->withHeader("Content-Type", "application/json");
  });

  $app->post("/api/workspace/{project}/rename", function (Request $req, Response $res, array $args) {
    $project = $args["project"];
    $body = (array)($req->getParsedBody() ?? []);
    Workspace::renamePath($project, (string)($body["from"] ?? ""), (string)($body["to"] ?? ""));
    $res->getBody()->write(json_encode(["ok" => true]));
    return $res->withHeader("Content-Type", "application/json");
  });

  // Upload (multipart/form-data)
  $app->post("/api/workspace/{project}/upload", function (Request $req, Response $res, array $args) {
    $project = $args["project"];
    $dir = (string)($req->getQueryParams()["dir"] ?? "");
    $files = $req->getUploadedFiles();
    if (!isset($files["file"])) throw new RuntimeException("Missing file");

    // Slim UploadedFile -> array compatible
    $uf = $files["file"];
    $tmp = tempnam(sys_get_temp_dir(), "upl_");
    $uf->moveTo($tmp);

    $saved = Workspace::saveUpload($project, $dir, [
      "name" => $uf->getClientFilename(),
      "tmp_name" => $tmp,
    ]);

    $res->getBody()->write(json_encode(["ok" => true, "path" => $saved]));
    return $res->withHeader("Content-Type", "application/json");
  });

  $app->get("/", function (Request $req, Response $res) {
    $res->getBody()->write("OK - Cardano IDE API");
    return $res->withHeader("Content-Type", "text/plain");
  });

  $app->get("/health", function (Request $req, Response $res) {
    $res->getBody()->write(json_encode(["ok" => true]));
    return $res->withHeader("Content-Type", "application/json");
  });

  $app->get("/api/workspace/{project}/list", function (Request $req, Response $res, array $args) {
    $project = $args["project"];
    $path = $req->getQueryParams()["path"] ?? "";
    $items = Workspace::listFiles($project, (string)$path);
    $res->getBody()->write(json_encode(["items" => $items]));
    return $res->withHeader("Content-Type", "application/json");
  });

  $app->get("/api/workspace/{project}/read", function (Request $req, Response $res, array $args) {
    $project = $args["project"];
    $path = (string)($req->getQueryParams()["path"] ?? "");
    $content = Workspace::readFile($project, $path);
    $res->getBody()->write(json_encode(["content" => $content]));
    return $res->withHeader("Content-Type", "application/json");
  });

  $app->post("/api/workspace/{project}/write", function (Request $req, Response $res, array $args) {
    $project = $args["project"];
    $body = (array)($req->getParsedBody() ?? []);
    $path = (string)($body["path"] ?? "");
    $content = (string)($body["content"] ?? "");
    Workspace::writeFile($project, $path, $content);
    $res->getBody()->write(json_encode(["ok" => true]));
    return $res->withHeader("Content-Type", "application/json");
  });

  $app->post("/api/build/{project}/start", function (Request $req, Response $res, array $args) {
    $project = $args["project"];
    $jobId = Jobs::startCompile($project);
    $res->getBody()->write(json_encode(["jobId" => $jobId]));
    return $res->withHeader("Content-Type", "application/json");
  });

    $app->get("/api/build/{jobId}/stream", function (Request $req, Response $res, array $args) {
    Jobs::streamLogs($args["jobId"]);
    exit; // <-- keep SSE from returning through Slim middleware
  });
};
