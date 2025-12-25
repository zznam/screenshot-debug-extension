## Naming Convention

#### 1. File and folder naming

We'll use **kebab-case** for files and folders naming, the project architecture seems to be easier to understand and navigate.

**Examples:**

- my-candidates.po.ts;
- feature-flags.enum.ts
- is-phone-number.util.ts
- job-proposals.spec.ts

#### 2. File extension naming

To solve the duplicate file name issue, use a suffix to display from which domain the file is part of. This practice being inspired from Angular development and uses single-responsible principle.

**Examples:**

- **Specs** should be suffixed with `.spec.ts`;
- **Pages** Objects should be suffixed with` .po.ts`;
- **Data** should be suffixed with` .data.ts`;
- **Utilities** should be suffixed with `.util.ts`;
- **Interfaces** should be suffixed with `.interface.ts`;
- **Services** should be suffixed with `.service.ts`.

> **Note:**
>
> Other files **should be named according to what they do**, for example a file containing utility filter functions should be stored in a file named `filtering.util.ts` inside of **utils** folder at the **common** folder level.
