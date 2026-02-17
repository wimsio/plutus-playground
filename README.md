# Plutus Playground 

Company: Coxygen Global

Author:  Bernard Sibanda

Date:    17-02-2026

## Table of Contents

1. [Document Control](#1-document-control)
2. [Background and Problem Statement](#2-background-and-problem-statement)
3. [Goals and Non-Goals](#3-goals-and-non-goals)
4. [Scope and Release Phases](#4-scope-and-release-phases)
5. [Users, Personas, and Primary Workflows](#5-users-personas-and-primary-workflows)
6. [Functional Requirements](#6-functional-requirements)
7. [Non-Functional Requirements](#7-non-functional-requirements)
8. [System Architecture](#8-system-architecture)
9. [Compiler Service Specification](#9-compiler-service-specification)
10. [API Specification](#10-api-specification)
11. [Data Models and Artifact Formats](#11-data-models-and-artifact-formats)
12. [Frontend Application Specification](#12-frontend-application-specification)
13. [Security, Abuse Prevention, and Compliance](#13-security-abuse-prevention-and-compliance)
14. [Operations, Deployment, and Observability](#14-operations-deployment-and-observability)
15. [Testing Strategy](#15-testing-strategy)
16. [Migration Plan](#16-migration-plan)
17. [Risks and Open Questions](#17-risks-and-open-questions)
18. [Glossary](#18-glossary)

## 1. Document Control

1.1. **Document title.** This document specifies the product and engineering requirements for an online “Plutus Playground” built on top of the `plutus-nix` repository and its pinned Nix + Cabal toolchain. 

1.2. **Status.** This specification is intended to be implementation-ready for an MVP that supports browser-based editing and server-side compilation, and it defines an extension path that integrates the existing CHPB (Coxy Haskell Plutus Builder) workflow into the same web experience. 

1.3. **Scope boundary.** This specification treats compilation as a server-side operation and does not require running GHC or Nix inside the user’s browser.

## 2. Background and Problem Statement

2.1. **Current state.** Today, `plutus-nix` is used by entering a reproducible Nix development shell and building the Haskell packages with Cabal, including the `wspace` contract modules under `code/wspace/lecture`. 

2.2. **Existing builder (static).** The CHPB tool is a web-based interface that generates machine-readable JSON specifications and a downloadable `ValidatorLogic.hs` module that the user currently integrates into a local Haskell project for compilation and deployment. 

2.3. **Problem.** New and intermediate developers frequently want a “Remix-like” experience where they can write, generate, compile, and inspect outputs in a single web UI, without first installing Nix, GHC, Cabal, or platform-specific dependencies.

2.4. **Opportunity.** Plutus Playground historically used a client + server model where compilation happens on a server, with a browser UI driving compilation and showing logs and results, and where Nix and binary caches can speed builds. 

## 3. Goals and Non-Goals

3.1. **Goal: Web-first authoring and compilation.** The system shall provide an in-browser code editor and a one-click compile flow that produces downloadable artifacts, without requiring local Nix for the user.

3.2. **Goal: Reproducible compiler environment.** The system shall compile using a pinned environment consistent with the repo’s Nix flake setup, including the specified GHC and cabal-install versions, so that outputs are deterministic across users and over time. 

3.3. **Goal: Templates aligned with repository examples.** The system shall offer starter templates based on the repository’s contract modules (for example, Vesting and Parameterized Vesting) so users can start from known-working code. 

3.4. **Goal: CHPB integration path.** The system shall support generating JSON specs and `ValidatorLogic.hs` from CHPB and compiling those outputs in the same online environment. 

3.5. **Non-goal: Full on-chain deployment from the browser (MVP).** The MVP shall not be required to submit transactions to Cardano mainnet or testnet, because that requires wallet integration, key management, and network-specific operational concerns.

3.6. **Non-goal: Client-side compilation.** The MVP shall not compile inside the browser, because the Nix + GHC toolchain is too heavy and would create inconsistent performance across devices.

## 4. Scope and Release Phases

4.1. **Phase 1 (MVP): Online Editor + Compile + Artifacts.** The MVP shall include a browser editor, template loading, server-side compilation jobs, streaming or polled logs, and artifact download.

4.2. **Phase 2 (Enhanced): CHPB in the same Playground.** The enhanced release shall embed or integrate CHPB so that “Generate Logic Spec” produces the same JSON and Haskell outputs as today, and a “Compile” action compiles those outputs using the server toolchain. 

4.3. **Phase 3 (Optional): Simulation and scenario runner.** A later release may run emulator scenarios and show traces, but this is optional and not required for the initial platform conversion.

## 5. Users, Personas, and Primary Workflows

5.1. **Persona A: Beginner learner.** This user wants to open a known-good contract, make small edits, compile, and download a `.plutus` artifact and related outputs without setting up a local environment.

5.2. **Persona B: Contract author.** This user wants rapid iteration loops with clear errors and logs, and they want reproducible builds that match CI and teammates.

5.3. **Persona C: CHPB-driven builder.** This user prefers configuring datum/redeemer/actions/constraints via CHPB and expects the system to generate JSON and `ValidatorLogic.hs`, then compile them without leaving the browser. 

5.4. **Workflow 1: Compile a template contract.** The user selects a template (for example a Vesting module), edits code, clicks “Compile”, reviews logs, and downloads artifacts.

5.5. **Workflow 2: Generate with CHPB then compile.** The user configures an industry, datum, redeemer, and constraints, clicks “Generate Logic Spec”, reviews JSON and Haskell outputs, and then clicks “Compile” to produce artifacts. 

5.6. **Workflow 3: Share a reproducible build.** The user exports a workspace bundle (or share link) that can be compiled again to produce the same outputs under the pinned toolchain.

## 6. Functional Requirements

### 6.1 Workspace and File Management

6.1.1. **Workspace definition.** A workspace shall be a named collection of source files and configuration files that represent a compilable unit, including Haskell modules and any required Cabal project metadata.

6.1.2. **Template workspaces.** The system shall ship with templates that map to existing repo modules located under `code/wspace/lecture`, so that templates are aligned with known examples. 

6.1.3. **In-browser persistence.** The frontend shall store the user’s current workspace state in browser storage so that accidental refresh does not destroy work, unless the user explicitly resets or clears it.

6.1.4. **Workspace export.** The system shall allow exporting a workspace as a single archive file so that the same content can be compiled later or shared offline.

### 6.2 Editor and UX Behavior

6.2.1. **Editor features.** The editor shall support syntax highlighting for Haskell and provide basic developer affordances such as search, replace, file tabs, and jump-to-error navigation.

6.2.2. **Compile trigger.** The UI shall expose a clear “Compile” action that initiates a server-side compilation job and returns logs and results to the user.

6.2.3. **Error display.** Compilation errors shall be shown with enough structure for the UI to highlight file and line numbers when available, and raw logs shall remain accessible for copy/paste.

### 6.3 Compilation Targets and Outputs

6.3.1. **Target selection.** The user shall be able to select a compilation target that indicates which module or entry point should be compiled, because a repository may contain multiple modules and tests. 

6.3.2. **Artifact manifest.** Every successful compile shall produce an artifact manifest that lists all outputs, their types, file names, sizes, hashes, and logical meaning (for example “compiled script”, “generated JSON spec”, “validator module source”).

6.3.3. **Downloadable bundle.** The system shall provide a single downloadable zip bundle per compile job that includes the artifact manifest and all referenced artifact files.

6.3.4. **Log retention.** Logs shall remain accessible for a bounded retention window so that users can return to results without immediately re-running a compile.

### 6.4 CHPB Integration Requirements (Phase 2)

6.4.1. **Preserve CHPB semantics.** The integrated CHPB experience shall continue to support industries, datum fields, redeemer actions, constraints, and optional parameter datum as described in the current CHPB tutorial. ([GitHub][2])

6.4.2. **Generate the same outputs.** CHPB shall generate datum JSON, redeemer JSON, a mkValidator preview, and a full Haskell module, and it shall support downloading `ValidatorLogic.hs` as an artifact. 

6.4.3. **Compile CHPB outputs.** The Playground shall be able to place the generated `ValidatorLogic.hs` into the active workspace and compile it using the same server-side pipeline as template projects.

## 7. Non-Functional Requirements

7.1. **Reproducibility.** A given workspace compiled under a given toolchain version shall produce stable outputs, and the UI shall display the toolchain identity to the user, including the pinned versions visible in the Nix flake configuration. 

7.2. **Performance targets.** The system shall provide acceptable compile latency by using caching, and it shall explicitly distinguish cold-start latency from warm-start latency, because Nix builds can be heavy without a cache. 

7.3. **Scalability.** The system shall support concurrent compile jobs by using a job queue and worker pool, and it shall have explicit per-user rate limits.

7.4. **Availability.** The system shall be designed so that transient worker failures do not lose user work, and jobs shall fail with clear error messages when the system is overloaded.

7.5. **Security.** The system shall treat user-provided code as untrusted input and shall compile it in a sandbox with restricted permissions, bounded resources, and explicit limits.

## 8. System Architecture

8.1. **High-level model.** The system shall follow a client/server pattern where the browser UI handles editing and orchestration, and the server performs compilation and returns outputs, which matches the historical “playground server + client” concept. 

8.2. **Frontend.** The frontend shall be a single-page web application that manages workspaces, renders templates, provides editor and CHPB panels, and communicates with the backend via a versioned HTTP API.

8.3. **Backend services.** The backend shall be composed of an API service and one or more compile workers. The API service shall accept job submissions, return job status, and mediate artifact download. Compile workers shall run in sandboxed environments and execute the actual Nix + Cabal compilation steps.

8.4. **Artifact storage.** The backend shall store job logs and artifacts in a durable store (local filesystem, object storage, or equivalent) for the retention period, and it shall remove them after expiry.

8.5. **Caching layer.** The system shall implement caching for Nix store artifacts and build dependencies, and it shall support binary cache usage to reduce repeated compile time. 

## 9. Compiler Service Specification

9.1. **Pinned toolchain.** The compile environment shall use the repository’s flake-defined toolchain, including the configured GHC and cabal-install versions, because the flake establishes the intended reproducible environment. 

9.2. **Build procedure (conceptual).** For each job, the worker shall (a) materialize the workspace into an isolated directory, (b) enter the pinned environment, (c) execute the configured build commands, and (d) collect outputs into the artifact bundle.

9.3. **Timeouts.** Each compile job shall have a strict maximum runtime (for example 2–5 minutes for MVP), and jobs that exceed the limit shall be terminated and marked as timed out.

9.4. **Resource limits.** Each job shall have explicit CPU and memory limits that prevent noisy-neighbor behavior and mitigate denial-of-service attempts.

9.5. **Network policy.** By default, compilation shall run with network egress disabled, except where a controlled cache endpoint is required, because untrusted code should not be allowed to exfiltrate data.

9.6. **Output constraints.** Jobs shall have maximum log size and maximum artifact size to prevent storage abuse, and truncation behavior shall be explicit in both API responses and UI messaging.

## 10. API Specification

10.1. **API versioning.** The API shall be versioned (for example `/api/v1/`) so that frontend and backend can evolve without breaking existing deployments.

10.2. **Submit compile job.**
`POST /api/v1/jobs` shall accept a request containing (a) workspace content, (b) selected compile target, and (c) optional build parameters. The response shall return a `jobId`, an initial `status`, and a URL for job status polling.

10.3. **Get job status.**
`GET /api/v1/jobs/{jobId}` shall return the current job status, timestamps, toolchain identity, and a pointer to logs. The status model shall support at least: `queued`, `running`, `succeeded`, `failed`, `timed_out`, and `canceled`.

10.4. **Get logs.**
`GET /api/v1/jobs/{jobId}/logs` shall return logs either as a single payload or as a paged/streamed response. The API shall clearly indicate if logs were truncated.

10.5. **Download artifacts.**
`GET /api/v1/jobs/{jobId}/artifacts.zip` shall return a zip bundle that includes all artifacts plus a manifest file.

10.6. **List templates.**
`GET /api/v1/templates` shall return a list of templates that the frontend can display in a gallery, and each template shall have an identifier, display name, description, and template contents.

10.7. **Health and version.**
`GET /api/v1/health` shall return a basic liveness response.
`GET /api/v1/version` shall return the backend build version and the compiler toolchain identity as displayed in the UI.

## 11. Data Models and Artifact Formats

11.1. **Job object.** A job shall include at least `jobId`, `createdAt`, `startedAt`, `finishedAt`, `status`, `target`, `toolchain`, and `resultSummary`.

11.2. **Toolchain identity.** The toolchain identity shall include sufficient information to explain reproducibility, including the Nix flake identity and visible compiler tool versions such as GHC and cabal-install. 

11.3. **Artifact manifest.** The manifest shall be a JSON document that lists each artifact with fields such as `name`, `path`, `contentType`, `sha256`, `bytes`, and `role`. The manifest shall also include a summary describing what was compiled and how.

11.4. **CHPB artifacts.** When CHPB is used, the artifact bundle shall include the generated datum JSON, redeemer JSON, and `ValidatorLogic.hs`, because those outputs are part of the CHPB export pipeline described in the existing tutorial.

## 12. Frontend Application Specification

12.1. **Core layout.** The UI shall provide a three-pane experience: a left navigation panel for templates and files, a central editor panel, and a bottom or right output panel for logs and artifacts.

12.2. **Compile experience.** When the user compiles, the UI shall show a clear running state, stream or poll logs, and provide a stable job detail view that remains accessible even after navigation.

12.3. **Artifact exploration.** After a successful compile, the UI shall show a structured artifact list derived from the manifest, and it shall provide one-click download of the full bundle.

12.4. **CHPB experience (Phase 2).** The UI shall provide a CHPB tab or mode that exposes industry selection, datum fields, redeemer actions and constraints, and “Generate Logic Spec,” matching CHPB’s described flow, and it shall expose “Compile” so that generation and compilation are connected. 

## 13. Security, Abuse Prevention, and Compliance

13.1. **Threat model.** The system shall assume that workspace contents are hostile, and it shall treat compilation as an untrusted execution task that must be sandboxed and rate-limited.

13.2. **Sandboxing.** Workers shall compile under a non-root user, inside an isolated environment with limited filesystem access, and with clear CPU/memory/time constraints.

13.3. **Rate limiting.** The API shall apply per-IP and per-user limits that prevent repeated heavy compiles from degrading service.

13.4. **Content limits.** The API shall reject overly large workspace submissions and shall enforce limits on number of files and total bytes.

13.5. **Secret handling.** The system shall not require users to provide wallet secrets or private keys for the MVP, because that would dramatically increase security and compliance risk.

## 14. Operations, Deployment, and Observability

14.1. **Deployment model.** The backend shall run as a set of services (API + workers) that can be scaled independently, and the frontend shall be deployable as a static web app.

14.2. **Caching operations.** Operators shall be able to pre-warm caches and enable controlled binary cache usage, because this materially affects compile latency in Nix-based systems. 

14.3. **Observability.** The system shall record metrics including job duration, failure rate, queue depth, cache hit rate, and artifact size distribution, and it shall retain server logs for debugging.

14.4. **Cost controls.** The system shall include job quotas and retention policies, because compilation is compute-heavy and artifacts can consume storage.

## 15. Testing Strategy

15.1. **Unit tests.** Backend code shall be unit-tested for request validation, job state transitions, artifact bundling, and manifest correctness.

15.2. **Integration tests.** The system shall include end-to-end tests that submit a known template workspace and verify that compilation succeeds and produces expected artifact types.

15.3. **Regression tests for templates.** Templates derived from `code/wspace/lecture` shall be continuously compiled in CI to ensure that the online experience remains aligned with the repository examples.

15.4. **Security tests.** The sandbox shall be tested with adversarial payloads that attempt excessive CPU usage, oversized outputs, and prohibited filesystem access.

## 16. Migration Plan

16.1. **MVP migration.** The first migration step shall port only the “edit + compile” flows while keeping CHPB external or embedded as a link, so that compilation infrastructure is validated before UI complexity increases.

16.2. **CHPB migration (Phase 2).** The second step shall integrate CHPB into the Playground and connect “Generate Logic Spec” to the workspace and compiler pipeline, while preserving its current outputs and behavior. 

16.3. **User documentation.** The migration shall include updated docs that explain the new online flow and explicitly call out that local Nix is no longer required for compilation, while still allowing local development as an option.

## 17. Risks and Open Questions

17.1. **Cold-start latency risk.** Nix-based builds can be slow without caches, so the success of the online experience depends on careful caching and pre-warming practices.

17.2. **Target definition risk.** The system must define “what to compile” in a way that is understandable to users and maps cleanly to repo structure, otherwise users will be confused by Cabal target selection.

17.3. **Artifact format risk.** The system must be explicit about which outputs are produced for which contract and which are only available when a module contains serialization/export code.

17.4. **CHPB integration risk.** If CHPB-generated `ValidatorLogic.hs` requires additional surrounding project scaffolding, the Playground must supply that scaffolding automatically to make “Generate then Compile” succeed reliably.

## 18. Glossary

**Artifact** means any file produced by a compilation job, including logs, compiled scripts, generated JSON, and generated Haskell modules.

**Artifact manifest** means a machine-readable JSON file that enumerates all artifacts produced by a job and describes their roles, hashes, and sizes.

**Binary cache** means a cache of prebuilt Nix store outputs that can be substituted instead of rebuilt, which can substantially reduce build time. 

**Cabal** means the Haskell build tool and package manager used to build project components and run tests. 

**CHPB (Coxy Haskell Plutus Builder)** means the web-based builder that helps users define Plutus validator logic via industry templates or custom configuration, and that generates JSON specs and `ValidatorLogic.hs`.

**Compile job** means a single server-side execution that takes a workspace and produces logs and artifacts under a sandbox.

**Constraint** means a named logical requirement enforced by a validator, which CHPB can bind to redeemer actions and translate into Haskell guards.

**Datum** means the on-chain data associated with a contract instance, typically attached to a UTxO and modeled as a Haskell data type in Plutus. 

**Flake** means a Nix project structure defined by `flake.nix` that pins inputs and outputs to produce reproducible environments. 

**GHC** means the Glasgow Haskell Compiler, which is part of the pinned toolchain used by the project’s Nix flake. 

**Nix dev shell** means the reproducible development environment entered via `nix develop` that provides the correct compiler toolchain for building the repository. 

**Redeemer** means an on-chain input that represents the user’s intended action when spending a script output, and which CHPB models as action variants with constraints. 

**Sandbox** means an isolated environment with restricted permissions and resources that is used to compile untrusted user code.

**ScriptContext** means the transaction context provided to a validator during validation, which is referenced by validators when enforcing constraints (for example signature checks).

**Template** means a preconfigured workspace or contract starting point supplied by the Playground, typically derived from repository examples such as the `wspace` lecture modules. 

**Toolchain identity** means a structured description of the compiler environment used for a job, including the pinned Nix and compiler versions, so results are explainable and reproducible. 

**UTxO** means an Unspent Transaction Output, which is Cardano’s accounting model and the unit that scripts lock and unlock.

**ValidatorLogic.hs** means the CHPB-generated Haskell module that contains a validator skeleton, pattern matching over redeemer actions, and placeholder constraint calls, intended to be integrated and compiled.

[1]: https://raw.githubusercontent.com/wimsio/plutus-nix/main/README.md "raw.githubusercontent.com"
[2]: https://raw.githubusercontent.com/wimsio/plutus-nix/main/coxy-plutus-builder/coxy-plutus-builder-tutorial.md "raw.githubusercontent.com"
[3]: https://iohk.zendesk.com/hc/en-us/articles/4415402727321-Running-a-local-version-of-Plutus-playground "Running a local version of Plutus playground – IOHK Support"
[4]: https://raw.githubusercontent.com/wimsio/plutus-nix/main/flake.nix "raw.githubusercontent.com"
