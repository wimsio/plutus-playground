 **Full System Architecture Diagram** for the **Coxy Plutus Playground**. This diagram shows how all components interact, from the **frontend IDE used by developers** to the **backend compilation infrastructure** that builds Plutus smart contracts.

The architecture integrates tools like **Plutus**, **Glasgow Haskell Compiler**, **Cabal**, and **Nix**.

---

# Full System Architecture Diagram

## Coxy Plutus Playground

```
                           ┌───────────────────────────┐
                           │        Developer           │
                           │  (Browser User Interface)  │
                           └─────────────┬─────────────┘
                                         │
                                         │ HTTPS Requests
                                         │
                          ┌──────────────▼──────────────┐
                          │        Frontend IDE          │
                          │ (Remix-like Playground UI)   │
                          │                              │
                          │  • File Explorer             │
                          │  • Monaco Code Editor        │
                          │  • Compile Button            │
                          │  • Logs Panel                │
                          │  • Artifact Download         │
                          └──────────────┬──────────────┘
                                         │
                                         │ REST API Calls
                                         │
                       ┌─────────────────▼─────────────────┐
                       │           Compile API              │
                       │                                    │
                       │ POST /compile                      │
                       │ GET  /health                       │
                       │ GET  /version                      │
                       │                                    │
                       └─────────────────┬─────────────────┘
                                         │
                                         │ Job Submission
                                         │
                    ┌────────────────────▼────────────────────┐
                    │          Job Orchestration Layer         │
                    │                                          │
                    │  • Job Queue                             │
                    │  • Concurrency Control                   │
                    │  • Job States (Queued / Running / Done)  │
                    │  • Runtime Limits                        │
                    │  • Workspace Cleanup                     │
                    └────────────────────┬────────────────────┘
                                         │
                                         │ Start Build Job
                                         │
                  ┌──────────────────────▼──────────────────────┐
                  │        Containerized Build Environment       │
                  │              (Docker + Nix)                  │
                  │                                              │
                  │  Secure isolated environment for builds      │
                  │                                              │
                  │  Includes:                                   │
                  │  • Nix toolchain                             │
                  │  • GHC compiler                              │
                  │  • Cabal build system                        │
                  │  • Plutus libraries                          │
                  └──────────────────────┬──────────────────────┘
                                         │
                                         │ Run Compiler
                                         │
                    ┌────────────────────▼────────────────────┐
                    │           Compilation Pipeline           │
                    │                                          │
                    │  1. Lexical Analysis                     │
                    │  2. Syntax Analysis                      │
                    │  3. Semantic Analysis                    │
                    │  4. Intermediate Code Generation         │
                    │  5. Code Optimization                    │
                    │  6. Code Generation                      │
                    │                                          │
                    └────────────────────┬────────────────────┘
                                         │
                                         │ Produce Artifacts
                                         │
                ┌────────────────────────▼────────────────────────┐
                │                Artifact Generator                │
                │                                                  │
                │ Outputs:                                         │
                │  • compiled.plutus                               │
                │  • contract.cbor                                 │
                │  • artifact.json                                 │
                │  • script hash                                   │
                │  • contract address                              │
                └────────────────────────┬────────────────────────┘
                                         │
                                         │ Return Results
                                         │
                        ┌────────────────▼────────────────┐
                        │        Logs & Metrics System     │
                        │                                  │
                        │  • Build logs                    │
                        │  • Error reports                 │
                        │  • Job metrics                   │
                        │  • Cache statistics              │
                        └────────────────┬────────────────┘
                                         │
                                         │ Response
                                         │
                       ┌─────────────────▼─────────────────┐
                       │             Frontend IDE           │
                       │                                   │
                       │  Displays:                         │
                       │  • Compilation Logs                │
                       │  • Errors                          │
                       │  • Download Links                  │
                       │                                   │
                       └─────────────────┬─────────────────┘
                                         │
                                         │ Download Artifacts
                                         │
                               ┌─────────▼─────────┐
                               │      Developer     │
                               │  Gets .plutus file │
                               └────────────────────┘
```

---

# Architecture Layer Explanation

## 1. Frontend Layer (IDE Interface)

This layer provides the **developer workspace** where users interact with the system.

Main responsibilities:

* code editing
* file management
* triggering compilation
* displaying compilation logs
* downloading compiled artifacts

The editor will typically use **Monaco Editor** (the same editor used in VS Code).

---

# 2. API Layer (Compile Service)

The API layer connects the frontend IDE with the backend build system.

Key endpoints:

```
POST /compile
GET  /health
GET  /version
```

Responsibilities:

* receive compilation requests
* validate uploaded workspaces
* create compilation jobs
* return logs and artifacts

---

# 3. Job Orchestration Layer

The orchestration layer manages compilation workloads.

Responsibilities include:

• limiting number of concurrent builds
• queueing compilation jobs
• enforcing runtime limits
• cleaning temporary build directories

Example job states:

```
Queued
Running
Succeeded
Failed
```

---

# 4. Containerized Build Environment

Each compilation runs inside a **secure container**.

This container contains the full Plutus development environment including:

* **Glasgow Haskell Compiler**
* **Cabal**
* **Nix**
* Plutus smart contract libraries

Benefits:

• reproducible builds
• isolation between users
• improved security

---

# 5. Compilation Pipeline

Inside the container the Plutus contract is compiled through multiple compiler phases:

1. **Lexical Analysis** – converts source code into tokens
2. **Syntax Analysis** – checks grammar correctness
3. **Semantic Analysis** – validates logical correctness
4. **Intermediate Code Generation** – produces machine-independent representation
5. **Code Optimization** – improves efficiency
6. **Code Generation** – produces compiled Plutus scripts

---

# 6. Artifact Generation Layer

After compilation the system generates artifacts such as:

```
contract.plutus
contract.cbor
artifact.json
script hash
contract address
```

These artifacts are returned to the developer.

---

# 7. Observability Layer

The system must track metrics including:

• build duration
• compilation errors
• queue depth
• cache hit rate

Logs must be linked to specific **job IDs** for debugging.

---

# 8. Security Layer

To prevent abuse, compilation jobs must enforce:

* CPU limits
* memory limits
* time limits
* file upload limits
* network restrictions

Builds must run as **non-root users**.

---

# End-to-End Workflow

```
Developer → IDE → Compile API → Job Queue → Container Build
→ Compiler Pipeline → Artifact Generation → Logs + Results
→ IDE → Developer Download
```
