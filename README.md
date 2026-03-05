# Coxy Plutus Playground

### Developer Documentation & Project Specification

An open development project to transform **Coxy Plutus Builder Studio (CPBS)** into a full **Plutus Smart Contract Playground**, similar to **Remix IDE** used in the Ethereum ecosystem.

The playground will provide developers with a **web-based development environment** where they can write, edit, compile, and test **Plutus** smart contracts without installing complex local toolchains.

The system integrates the **Glasgow Haskell Compiler**, **Cabal**, and **Nix** to compile Plutus contracts inside a secure backend environment.

This README serves as a **technical specification and implementation guide for developers** contributing to the project.

---

# Table of Contents

1. Project Overview
2. Key Features
3. System Specifications
4. System Requirements
5. Compiler and Build Architecture
6. Development Phases
7. Workspace Structure Specification
8. Backend Architecture
9. Compile API Specification
10. Job Management System
11. Security and Sandboxing
12. Caching Strategy
13. Observability and Monitoring
14. Frontend IDE Architecture
15. Expected Outputs and Artifacts
16. Contribution Guidelines

---

# 1. Project Overview

One of the main limitations in the **Cardano smart contract ecosystem** is the lack of a beginner-friendly development environment comparable to **Remix IDE** used by Ethereum developers.

Developing **Plutus smart contracts** typically requires installing and configuring multiple tools such as:

* GHC
* Cabal
* Nix
* Cardano development libraries
* Plutus frameworks

These requirements create a **significant barrier for beginners and students**.

To address this challenge, **Coxygen Global** developed **Coxy Plutus Builder Studio (CPBS)**, a tool that allows developers to generate Plutus validator templates using predefined smart contract structures.

The objective of this project is to **upgrade CPBS into a full Plutus Playground**, allowing developers to:

* Open smart contract templates
* Edit Plutus code
* Compile contracts online
* View compilation logs
* Download compiled contract artifacts

---

# 2. Key Features

The Plutus Playground must provide the following major features.

### 2.1 Web-Based IDE

Developers must be able to write and edit Plutus contracts directly in a browser.

Core IDE components include:

* File explorer
* Code editor
* Tabbed file views
* Compilation controls
* Console output panel

The editor must support:

* Haskell syntax highlighting
* Error highlighting
* Real-time editing

---

### 2.2 Template-Based Smart Contract Development

The playground must allow developers to start with predefined contract templates such as:

* Vesting contracts
* Parameterized vesting contracts
* Marketplace validators
* Auction validators

Templates will come from the **CPBS library**.

Each template contains:

* Validator logic
* Datum definitions
* Redeemer definitions
* Constraint rules

---

### 2.3 Online Compilation

The system must compile smart contracts directly in the browser environment using a backend compilation service.

Compilation must generate:

* `.plutus` compiled scripts
* CBOR encoded scripts
* Script hash values
* Contract addresses when applicable

---

### 2.4 Compilation Logs

Developers must be able to view detailed compilation logs including:

* parser errors
* typechecking errors
* dependency build logs
* build success messages

Logs must update in real time while compilation runs.

---

### 2.5 Artifact Download

After successful compilation the system must allow users to download build artifacts including:

* compiled Plutus scripts
* JSON artifact manifest
* generated Haskell modules
* CBOR encoded scripts

---

### 2.6 Workspace Management

The IDE must support a structured project workspace similar to a local development project.

Developers must be able to:

* create files
* edit files
* upload workspace archives
* download full workspaces

---

# 3. System Specifications

The system consists of four major subsystems.

### Frontend IDE

Browser-based development interface.

Responsibilities:

* code editing
* file navigation
* triggering compilation
* displaying logs

---

### Backend Compiler Service

Server-side service responsible for compiling Plutus contracts.

Responsibilities:

* executing compilation commands
* managing build environments
* returning compiled artifacts

---

### Containerized Build Environment

Each compilation must run inside a container to guarantee consistent builds.

Responsibilities:

* providing deterministic build environments
* isolating builds for security
* preventing resource abuse

---

### Job Orchestration System

Manages compilation jobs.

Responsibilities:

* queue management
* concurrency limits
* runtime limits
* job status tracking

---

# 4. System Requirements

The backend compilation system requires the following development tools.

### Core Development Tools

* **Glasgow Haskell Compiler**
* **Cabal**
* **Nix**

These tools are required to compile Plutus contracts and manage Haskell dependencies.

---

### Container Technology

Compilation must run inside containers built using:

* Docker

Containers guarantee that all developers use identical environments.

---

### Development Environment

The project uses a Nix development shell that pins:

* compiler versions
* package versions
* build dependencies

This ensures deterministic builds.

---

# 5. Compiler and Build Architecture

The compilation pipeline consists of several phases similar to traditional compiler architecture.

### Phase 1 — Source Code Input

Developers write or modify Plutus smart contract source files in the IDE.

These files are stored in the workspace.

---

### Phase 2 — Lexical Analysis

The compiler scans source code and converts characters into tokens.

Tokens include:

* keywords
* identifiers
* operators
* constants

Example:

```
int x = 10;
```

Tokens:

```
int
x
=
10
;
```

---

### Phase 3 — Syntax Analysis

The compiler checks whether tokens follow valid language grammar.

Invalid syntax results in parser errors.

---

### Phase 4 — Semantic Analysis

The compiler verifies logical correctness.

Checks include:

* type compatibility
* variable declarations
* valid operations

---

### Phase 5 — Intermediate Code Generation

The compiler converts source code into intermediate representations before generating machine code.

Intermediate code allows optimization and platform independence.

---

### Phase 6 — Code Optimization

The compiler optimizes the code to improve performance.

Examples include:

* removing unused code
* simplifying constant expressions
* improving loops

---

### Phase 7 — Code Generation

The final compilation step produces executable artifacts such as:

* `.plutus` contract scripts
* CBOR encoded scripts

---

# 6. Development Phases

Developers must follow the phases below to implement the playground.

---

# Phase 1 — Product Definition and UX Flow

The user workflow must be clearly defined.

The expected workflow is:

1. user opens a template
2. user edits the contract
3. user clicks compile
4. logs appear in console
5. compiled artifacts are produced
6. user downloads outputs

Each compile target must map to specific build commands.

---

# Phase 2 — Workspace Layout Definition

A standard project workspace format must be defined.

Workspace must include:

```
workspace/
 ├── src/
 ├── validators/
 ├── plutus.json
 ├── cabal.project
 └── README.md
```

Templates must exist for:

* Vesting
* Parameterized Vesting

---

# Phase 3 — CLI Compiler Runner

A command line tool must be implemented.

Example command:

```
plutus-playground compile <module>
```

The CLI must:

* compile modules
* produce artifacts
* generate build logs

---

# Phase 4 — Containerized Build System

A Docker image must be created containing:

* Nix
* GHC
* Cabal
* Plutus libraries

The image must be able to compile example contracts.

---

# Phase 5 — Compile API

The backend must expose HTTP endpoints.

Example:

```
POST /compile
GET /health
GET /version
```

The `/compile` endpoint must:

* accept workspace upload
* start compilation job
* return logs
* return artifact bundle

---

# Phase 6 — Job Orchestration

Compilation jobs must be controlled by a queue system.

Features include:

* concurrency limits
* job timeout limits
* automatic cleanup

Job states must include:

* queued
* running
* succeeded
* failed

---

# Phase 7 — Build Caching

The system must implement caching to reduce build times.

Possible methods include:

* Nix binary cache
* prebuilt dependency layers

The system must track:

* cache hits
* cache misses

---

# Phase 8 — Security and Sandboxing

Compilation jobs must run in restricted environments.

Security rules include:

* non-root execution
* CPU limits
* memory limits
* network restrictions

Additional protections:

* upload size limits
* request rate limits

---

# Phase 9 — Frontend IDE Development

The final phase implements the web-based IDE.

Required components include:

* file explorer
* code editor
* compile button
* compilation logs panel

Users must see compilation states:

* queued
* running
* success
* failure

---

# 7. Expected Outputs

Successful compilation must produce the following outputs.

### Script Artifacts

```
contract.plutus
contract.cbor
artifact.json
```

---

### Artifact Manifest

Example manifest:

```
{
 "scriptHash": "...",
 "address": "...",
 "compiledScript": "contract.plutus"
}
```

---

# 8. Contribution Guidelines

Developers contributing to the project should:

1. follow the workspace structure
2. ensure builds run in the Nix environment
3. test compile targets before submission
4. document new features
5. maintain deterministic builds

---

# 9. Project Goal

The final objective is to deliver a **fully functional Plutus smart contract playground** that enables developers to prototype and test contracts directly in the browser.

This will significantly improve accessibility and productivity for **Cardano smart contract developers**.

---

