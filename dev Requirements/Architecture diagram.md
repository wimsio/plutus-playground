# Architecture Diagrams for Plutus Playground Studio

These diagrams illustrate the **core system architecture, services, and workflows** that implement the usability flow specification.

Below are **clear architecture and workflow diagrams** you can include in your GitHub README or documentation to explain **Plutus Playground Studio** visually.
These diagrams are written in **Mermaid**, which GitHub renders automatically.


```
Table of contents
│
├── Introduction
├── Features
├── Architecture Diagram
├── Developer Workflow
├── Compilation Pipeline
├── AI Project Generation
├── Smart Contract Interaction
├── Deployment Pipeline
├── Development Modes
├── Project Structure
├── Roadmap
```

---


# 1. System Architecture Diagram

This diagram shows how **frontend, backend, compilers, and blockchain interact**.

```mermaid
flowchart TB

Developer[Developer]

subgraph Browser IDE
Editor[Monaco Code Editor]
AI[AI Assistant]
ProjectManager[Project Manager]
Wallet[Coxy Wallet Integration]
end

subgraph Backend Services
API[Node.js API Server]
Auth[Authentication Service]
ProjectDB[(Project Database)]
ArtifactDB[(Artifact Storage)]
end

subgraph Compilation Workers
PlutusWorker[Plutus Compiler Worker]
AikenWorker[Aiken Compiler Worker]
HeliosWorker[Helios Compiler Worker]
OpShinWorker[OpShin Compiler Worker]
end

subgraph Blockchain
Cardano[Cardano Network]
end

Developer --> Editor
Editor --> API
AI --> API
ProjectManager --> API

API --> ProjectDB
API --> ArtifactDB

API --> PlutusWorker
API --> AikenWorker
API --> HeliosWorker
API --> OpShinWorker

PlutusWorker --> ArtifactDB
AikenWorker --> ArtifactDB
HeliosWorker --> ArtifactDB
OpShinWorker --> ArtifactDB

Wallet --> Cardano
API --> Cardano
```

---

# 2. Developer Workflow Diagram

This explains **how developers use the platform step by step**.

```mermaid
flowchart TD

Start[Developer Opens IDE]

Language[Select Smart Contract Language]

Prompt[Enter AI Project Prompt]

Generate[AI Generates Project Structure]

Code[Write or Edit Smart Contract]

Compile[Compile Contract]

Test[Run Simulations & Tests]

Debug[Debug Validator Execution]

Integrate[Generate Off-Chain Logic]

Frontend[Build Frontend UI]

Deploy[Deploy to Cardano Network]

Export[Export or Push to GitHub]

Start --> Language
Language --> Prompt
Prompt --> Generate
Generate --> Code
Code --> Compile
Compile --> Test
Test --> Debug
Debug --> Integrate
Integrate --> Frontend
Frontend --> Deploy
Deploy --> Export
```

---

# 3. Compilation Pipeline Diagram

This shows **how contracts are compiled internally**.

```mermaid
flowchart LR

Source[Smart Contract Source Code]

Parser[Language Parser]

IR[Intermediate Representation]

Compiler[Language Compiler]

UPLC[UPLC Script]

CBOR[CBOR Artifact]

Hash[Script Hash]

Cost[Execution Cost Analysis]

Source --> Parser
Parser --> IR
IR --> Compiler
Compiler --> UPLC
UPLC --> CBOR
CBOR --> Hash
UPLC --> Cost
```

---

# 4. AI Project Generation Flow

This explains how **AI builds the entire project automatically**.

```mermaid
flowchart TD

Prompt[Developer Prompt]

AIEngine[AI Generation Engine]

Contracts[Generate On-Chain Contracts]

OffChain[Generate Off-Chain Logic]

Frontend[Generate Frontend UI]

Backend[Generate Backend API]

Tests[Generate Tests]

Config[Generate Config Files]

Project[Complete Project Workspace]

Prompt --> AIEngine

AIEngine --> Contracts
AIEngine --> OffChain
AIEngine --> Frontend
AIEngine --> Backend
AIEngine --> Tests
AIEngine --> Config

Contracts --> Project
OffChain --> Project
Frontend --> Project
Backend --> Project
Tests --> Project
Config --> Project
```

---

# 5. Smart Contract Interaction Diagram

This shows **how the frontend interacts with Cardano smart contracts**.

```mermaid
sequenceDiagram

participant User
participant Frontend
participant Wallet
participant Backend
participant Cardano

User->>Frontend: Connect Wallet
Frontend->>Wallet: Request Connection
Wallet-->>Frontend: Wallet Connected

User->>Frontend: Lock ADA

Frontend->>Backend: Build Transaction
Backend->>Wallet: Request Signature
Wallet-->>Backend: Signed Transaction

Backend->>Cardano: Submit Transaction

Cardano-->>Frontend: Transaction Confirmation
```

---

# 6. Deployment Pipeline

This explains how **dApps are deployed from the IDE**.

```mermaid
flowchart LR

Code[Project Source Code]

Build[Compile Smart Contract]

Artifacts[Generate Artifacts]

Upload[Upload to Backend]

Deploy[Deploy to Cardano Network]

Host[Deploy Frontend]

Live[dApp Live]

Code --> Build
Build --> Artifacts
Artifacts --> Upload
Upload --> Deploy
Deploy --> Host
Host --> Live
```

---

# 7. Project Directory Structure Diagram

```mermaid
flowchart TD

ProjectRoot[Project Root]

Contracts[contracts/]
Tests[tests/]
Offchain[offchain/]
Frontend[frontend/]
Backend[backend/]
Database[database/]
Config[config/]

ProjectRoot --> Contracts
ProjectRoot --> Tests
ProjectRoot --> Offchain
ProjectRoot --> Frontend
ProjectRoot --> Backend
ProjectRoot --> Database
ProjectRoot --> Config
```

---

# 8. Development Modes Diagram

```mermaid
flowchart TD

Developer[Developer]

Mode{Choose Development Mode}

Wizard[Wizard-Based Builder]

IDE[IDE Manual Coding]

Builder[Coxy Plutus Builder]

Marlowe[Marlowe Block Editor]

Editor[Code Editor]

Compile[Compile & Test]

Developer --> Mode

Mode --> Wizard
Mode --> IDE

Wizard --> Builder
Wizard --> Marlowe

IDE --> Editor

Builder --> Compile
Marlowe --> Compile
Editor --> Compile
```

---

# 9. Platform Component Architecture

```mermaid
flowchart TB

subgraph Frontend
IDE[Web IDE]
Wallet[Coxy Wallet]
UI[User Interface]
end

subgraph Backend
API[Node.js API]
Services[Microservices]
Auth[Auth Service]
end

subgraph Workers
Compiler[Compiler Workers]
AI[AI Engine]
end

subgraph Storage
DB[(PostgreSQL)]
Artifacts[(Artifacts Storage)]
end

subgraph Blockchain
Cardano[Cardano Network]
end

IDE --> API
UI --> API
Wallet --> Cardano

API --> Services
API --> DB
API --> Artifacts

Services --> Compiler
Services --> AI

Compiler --> Artifacts
API --> Cardano
```

---

# 10. Full Platform Overview

```mermaid
flowchart LR

Dev[Developer]

IDE[Plutus Playground Studio]

AI[AI Assistant]

Compiler[Smart Contract Compilers]

Tests[Testing Framework]

Deploy[Deployment System]

Cardano[Cardano Blockchain]

GitHub[GitHub Repository]

Dev --> IDE
IDE --> AI
IDE --> Compiler
IDE --> Tests
Tests --> Deploy
Compiler --> Deploy
Deploy --> Cardano
IDE --> GitHub
```

---

