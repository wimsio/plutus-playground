<?php
declare(strict_types=1);

require __DIR__ . '/../vendor/autoload.php';
require_once __DIR__ . '/../src/bootstrap.php';

use Slim\Factory\AppFactory;

$app = AppFactory::create();

// ---- CORS (allow dev frontend) ----
$app->add(function ($request, $handler) {
    $origin = $request->getHeaderLine('Origin');

    // Add any dev origins you use here
    $allowed = [
        'http://127.0.0.1:5173',
        'http://localhost:5173',
        'http://127.0.0.1:5175',
        'http://localhost:5175',
        'http://127.0.0.1:5174',
        'http://localhost:5174',
    ];

    $allowOrigin = in_array($origin, $allowed, true) ? $origin : '';

    // Preflight request
    if ($request->getMethod() === 'OPTIONS') {
        $response = new \Slim\Psr7\Response();
    } else {
        $response = $handler->handle($request);
    }

    if ($allowOrigin !== '') {
        $response = $response->withHeader('Access-Control-Allow-Origin', $allowOrigin);
    }

    return $response
        ->withHeader('Vary', 'Origin')
        ->withHeader('Access-Control-Allow-Credentials', 'true')
        ->withHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With')
        ->withHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
});

// Handle all OPTIONS routes
$app->options('/{routes:.+}', function ($request, $response) {
    return $response;
});

$app->addBodyParsingMiddleware();

$routes = require __DIR__ . '/../src/routes.php';
$routes($app);

$app->run();