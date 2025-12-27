import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import typescript from "@rollup/plugin-typescript";
import terser from "@rollup/plugin-terser";
import dts from "rollup-plugin-dts";

const terserOptions = {
  compress: {
    pure_getters: true,
    unsafe: true,
    unsafe_comps: true,
    passes: 3,
    drop_console: false,
    dead_code: true,
    unused: true,
  },
  mangle: {
    properties: false,
  },
  format: {
    comments: false,
    ecma: 2020,
  },
};

const commonPlugins = [resolve(), commonjs(), terser(terserOptions)];

// Tree shaking options for all bundles
const treeshakeOptions = {
  moduleSideEffects: false,
  propertyReadSideEffects: false,
  tryCatchDeoptimization: false,
};

export default [
  // Main bundle (includes everything)
  {
    input: "src/index.ts",
    output: [
      {
        file: "dist/index.js",
        format: "cjs",
        sourcemap: false,
        exports: "named",
      },
      {
        file: "dist/index.esm.js",
        format: "esm",
        sourcemap: false,
      },
    ],
    plugins: [
      ...commonPlugins,
      typescript({
        tsconfig: "./tsconfig.json",
        declaration: true,
        declarationDir: "./dist",
        sourceMap: false,
        inlineSources: false,
      }),
    ],
    external: ["react", "react-dom"],
    treeshake: treeshakeOptions,
  },
  // Core bundle (SSR-safe, no React)
  {
    input: "src/core.ts",
    output: [
      {
        file: "dist/core.js",
        format: "cjs",
        sourcemap: false,
        exports: "named",
      },
      {
        file: "dist/core.esm.js",
        format: "esm",
        sourcemap: false,
      },
    ],
    plugins: [
      ...commonPlugins,
      typescript({
        tsconfig: "./tsconfig.json",
        declaration: true,
        declarationDir: "./dist",
        sourceMap: false,
        inlineSources: false,
      }),
    ],
    external: ["react", "react-dom"],
    treeshake: treeshakeOptions,
  },
  // React bundle (hooks, HOCs, decorators)
  {
    input: "src/react.ts",
    output: [
      {
        file: "dist/react.js",
        format: "cjs",
        sourcemap: false,
        exports: "named",
      },
      {
        file: "dist/react.esm.js",
        format: "esm",
        sourcemap: false,
      },
    ],
    plugins: [
      ...commonPlugins,
      typescript({
        tsconfig: "./tsconfig.json",
        declaration: true,
        declarationDir: "./dist",
        sourceMap: false,
        inlineSources: false,
      }),
    ],
    external: ["react", "react-dom"],
    treeshake: treeshakeOptions,
  },
  // Hooks only bundle
  {
    input: "src/hooks.ts",
    output: [
      {
        file: "dist/hooks.js",
        format: "cjs",
        sourcemap: false,
        exports: "named",
      },
      {
        file: "dist/hooks.esm.js",
        format: "esm",
        sourcemap: false,
      },
    ],
    plugins: [
      ...commonPlugins,
      typescript({
        tsconfig: "./tsconfig.json",
        declaration: true,
        declarationDir: "./dist",
        sourceMap: false,
        inlineSources: false,
      }),
    ],
    external: ["react", "react-dom"],
    treeshake: treeshakeOptions,
  },
  // Type declarations
  {
    input: "dist/index.d.ts",
    output: [{ file: "dist/index.d.ts", format: "esm" }],
    plugins: [dts()],
    external: [/\.css$/],
  },
];
