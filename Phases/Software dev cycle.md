 **Developer-oriented implementation guide for Week 1**, designed to help multiple contributors **start coding immediately** on the Cardano Playground IDE.
This focuses on **clear tasks, responsibilities, and deliverables** so developers can begin implementation without confusion.

---

# Week 1 Developer Implementation Guide

**Project:** Cardano Smart Contract Playground IDE
**Start Date:** 5 March
**Goal of Week 1:** Establish the **foundation architecture and development environment** so that all contributors can work in parallel.

---

# Week 1 Objectives

By the end of Week 1, the project must have:

1. A working **repository structure**
2. A **basic IDE interface (Monaco editor)**
3. A **workspace project system**
4. A **backend API skeleton**
5. A **containerized build environment**
6. A **basic compile runner (CLI prototype)**

This week focuses on **infrastructure**, not full functionality.

---

# Phase 1 — Project Initialization

**Duration:** Day 1

The first step is preparing the development environment and repository.

## Tasks

### Create the Main Repository

Example structure:

```
cardano-playground
│
├── frontend
├── backend
├── workers
├── adapters
├── templates
├── docs
├── scripts
└── docker
```

---

### Configure Version Control

Initialize Git repository.

```
git init
git remote add origin <repo-url>
```

Create branches:

```
main
develop
feature/*
```

---

### Configure Development Tools

All developers must install:

Required tools:

```
Node.js
Docker
Git
Nix
Cabal
GHC
```

Optional but recommended:

```
VS Code
PostgreSQL
Redis
```

---

# Phase 2 — Define the Workspace Standard

**Duration:** Day 1–2

The workspace format defines **how projects are stored and compiled**.

Every project must follow a **standard layout**.

## Example Workspace

```
workspace/
│
├── src/
│   └── contract.hs
│
├── tests/
│
├── fixtures/
│
├── plutus.json
│
└── metadata.json
```

---

## Entry Point Definition

Every project must define the validator entry point.

Example:

```
mkValidator :: Datum -> Redeemer -> ScriptContext -> Bool
```

---

## Supported File Types

Allowed file types:

```
.hs
.aiken
.hl
.py
.scala
.ts
.json
```

---

# Phase 3 — Frontend IDE Shell

**Duration:** Day 2–4

The frontend team must build the **basic IDE interface**.

## Tasks

### Create React Project

```
npx create-next-app frontend
```

Install dependencies:

```
npm install monaco-editor
npm install axios
npm install zustand
```

---

## Implement IDE Layout

Required UI components:

### File Explorer

Displays project files.

Example structure:

```
src/
tests/
fixtures/
```

---

### Code Editor

Use **Monaco Editor**.

Features:

```
syntax highlighting
multi-file editing
tab system
language selection
```

---

### Bottom Panel

Displays:

```
compile logs
errors
job status
```

---

### Compile Button

The compile button must trigger:

```
POST /compile
```

---

# Phase 4 — Backend API Skeleton

**Duration:** Day 3–5

Backend developers must create the API structure.

Recommended stack:

```
Node.js
Express
TypeScript
PostgreSQL
Redis
```

---

## API Endpoints

### Health Check

```
GET /health
```

Response:

```
{
 "status": "ok"
}
```

---

### Version Info

```
GET /version
```

Returns toolchain versions.

---

### Compile Endpoint

```
POST /compile
```

Input:

```
workspace.zip
compileTarget
```

Output:

```
jobId
logs
artifact link
```

---

# Phase 5 — Headless Compiler Runner (CLI)

**Duration:** Day 4–5

A CLI runner will be used by backend workers.

Purpose:

```
compile smart contracts
generate artifacts
return build logs
```

---

## Example Command

```
playground-compile \
  --workspace ./workspace \
  --target plutus
```

---

## Expected Output

Artifacts:

```
script.cbor
scriptHash
uplc.pretty
build.log
```

Manifest:

```
artifact-manifest.json
```

---

# Phase 6 — Dockerized Build Environment

**Duration:** Day 5–6

Compilation must run inside containers.

Each container must include:

```
GHC
Cabal
Plutus libraries
Aiken toolchain
Helios runtime
OpShin
```

---

## Example Dockerfile

```
FROM nixos/nix

RUN nix-env -iA \
  nixpkgs.haskell.compiler.ghc \
  nixpkgs.cabal-install
```

---

## Build the Image

```
docker build -t cardano-playground .
```

---

# Phase 7 — Job Queue System

**Duration:** Day 6–7

The backend must manage compilation jobs.

Recommended system:

```
Redis + BullMQ
```

---

## Job Flow

```
User clicks compile
        ↓
API receives workspace
        ↓
Job added to queue
        ↓
Worker executes compilation
        ↓
Artifacts stored
        ↓
Logs streamed to user
```

---

# Phase 8 — Artifact Storage

**Duration:** Day 6–7

Artifacts must be stored for download.

Recommended storage:

```
S3 compatible storage
```

Examples:

```
MinIO
AWS S3
Cloudflare R2
```

Stored artifacts:

```
UPLC scripts
CBOR
logs
metadata
```

---

# Developer Team Responsibilities

To accelerate development, divide contributors into groups.

---

## Frontend Team

Responsible for:

```
IDE interface
editor
project manager
artifact viewer
```

---

## Backend Team

Responsible for:

```
API development
job queue
artifact storage
authentication
```

---

## Compiler Infrastructure Team

Responsible for:

```
toolchain integration
worker containers
adapter system
artifact normalization
```

---

# End of Week 1 Deliverables

By the end of Week 1 the system must include:

### Working IDE Interface

```
file explorer
monaco editor
compile button
```

---

### Backend API

Endpoints implemented:

```
/health
/version
/compile
```

---

### CLI Compiler Runner

Command:

```
playground-compile
```

Must generate:

```
script.cbor
uplc
scriptHash
logs
```

---

### Docker Build Environment

Container capable of compiling at least **one smart contract example**.

Example target:

```
vesting contract
```

---

# Development Priority

Developers should follow this order:

```
1 repository setup
2 workspace standard
3 IDE interface
4 backend API
5 compiler runner
6 container build environment
7 job queue
```

---
