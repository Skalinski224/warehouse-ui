// scripts/find-dead-files.mjs
import { promises as fs } from "fs";
import path from "path";

const projectRoot = path.resolve(process.cwd());
const SRC_DIR = path.join(projectRoot, "src");

// alias z tsconfig:
// "@/*": ["src/*"]
const ALIAS_PREFIX = "@/";
const ALIAS_TARGET = SRC_DIR;

// rozszerzenia, które nas interesują
const exts = [".ts", ".tsx"];

// 🔹 1. Zbierz wszystkie pliki TS/TSX w src
async function getAllFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    // pomijamy node_modules, .next, testy itp. – dostosuj pod siebie
    if (entry.isDirectory()) {
      if (
        entry.name === "node_modules" ||
        entry.name === ".next" ||
        entry.name === ".turbo" ||
        entry.name === "__tests__"
      ) {
        continue;
      }
      files.push(...(await getAllFiles(fullPath)));
    } else {
      if (exts.includes(path.extname(entry.name))) {
        files.push(fullPath);
      }
    }
  }
  return files;
}

// 🔹 2. Parser importów (prosty, ale wystarczy w 90% przypadków)
const importRegex =
  /import\s+(?:[^'"]*from\s+)?["']([^"']+)["']|require\(["']([^"']+)["']\)/g;

async function getImports(filePath) {
  const content = await fs.readFile(filePath, "utf8");
  const imports = new Set();
  let match;

  while ((match = importRegex.exec(content)) !== null) {
    const importPath = match[1] || match[2];
    if (!importPath) continue;

    // interesują nas:
    //  - relative imports: ./, ../
    //  - alias imports: @/...
    if (
      importPath.startsWith(".") ||
      importPath.startsWith(ALIAS_PREFIX)
    ) {
      imports.add(importPath);
    }
  }

  return Array.from(imports);
}

// 🔹 helper: rozwiązywanie ścieżki importu do pełnej ścieżki pliku
function resolveImport(importPath, fromFile, fileSet) {
  let base;

  if (importPath.startsWith(".")) {
    // relative
    base = path.resolve(path.dirname(fromFile), importPath);
  } else if (importPath.startsWith(ALIAS_PREFIX)) {
    // alias "@/foo/bar" -> "src/foo/bar"
    const relativeFromAlias = importPath.slice(ALIAS_PREFIX.length); // po "@/"
    base = path.join(ALIAS_TARGET, relativeFromAlias);
  } else {
    return null;
  }

  const candidates = [
    base,
    base + ".ts",
    base + ".tsx",
    path.join(base, "index.ts"),
    path.join(base, "index.tsx"),
  ];

  const found = candidates.find((c) => fileSet.has(path.normalize(c)));
  return found ? path.normalize(found) : null;
}

// 🔹 3. Zbuduj mapę: plik -> lista importowanych plików (pełne ścieżki)
async function buildDependencyGraph(files) {
  const graph = new Map();

  const fileSet = new Set(files.map((f) => path.normalize(f)));

  for (const file of files) {
    const relImports = await getImports(file);
    const resolvedImports = [];

    for (const importPath of relImports) {
      const resolved = resolveImport(importPath, file, fileSet);
      if (resolved) {
        resolvedImports.push(resolved);
      }
    }

    graph.set(path.normalize(file), resolvedImports);
  }

  return graph;
}

// 🔹 4. ENTRYPOINTY – DOSTOSOWANE DO TWOJEGO PROJEKTU
function getEntryPoints(allFiles) {
  const rel = (p) => path.relative(projectRoot, p).replace(/\\/g, "/");

  return allFiles.filter((f) => {
    const r = rel(f);
    // page/layout/route w app routerze → prawdziwe roots
    if (r.startsWith("src/app/") && /\/(page|layout|route)\.tsx?$/.test(r)) {
      return true;
    }
    return false;
  });
}

// 🔹 5. DFS/BFS po grafie od entrypointów
function findUsedFiles(entryPoints, graph) {
  const used = new Set();
  const stack = [...entryPoints.map((f) => path.normalize(f))];

  while (stack.length) {
    const current = stack.pop();
    if (used.has(current)) continue;
    used.add(current);

    const deps = graph.get(current) || [];
    for (const dep of deps) {
      if (!used.has(dep)) {
        stack.push(dep);
      }
    }
  }

  return used;
}

async function main() {
  console.log("🔍 Szukam plików w:", SRC_DIR);
  const allFiles = await getAllFiles(SRC_DIR);
  console.log(`📄 Znaleziono plików TS/TSX: ${allFiles.length}`);

  const graph = await buildDependencyGraph(allFiles);
  const entryPoints = getEntryPoints(allFiles);

  console.log("🚪 Entry points:");
  entryPoints.forEach((f) =>
    console.log("  -", path.relative(projectRoot, f))
  );

  const used = findUsedFiles(entryPoints, graph);

  const unused = allFiles.filter((f) => !used.has(path.normalize(f)));

  console.log("\n🧹 POTENCJALNIE NIEUŻYWANE PLIKI:");
  if (unused.length === 0) {
    console.log("Brak – przynajmniej z perspektywy importów od entrypointów.");
  } else {
    unused
      .map((f) => path.relative(projectRoot, f))
      .sort()
      .forEach((f) => console.log("  -", f));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
