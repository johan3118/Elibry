---
description: File size limits for Elibry source
globs: ["**/*.ts", "**/*.tsx"]
---

# File size

Healthy range: <=500 lines per file.

- A file over ~500 lines is a refactor signal — flag it.
- When a task would push a file past 500 lines, prefer extracting a module over growing the file. Note the split in the plan; don't do it silently.
- Splitting a file is itself a scoped task — never bundle it into a feature task.
