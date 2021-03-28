import babel from "rollup-plugin-babel";
import { nodeResolve } from '@rollup/plugin-node-resolve';

export default [{
  input: "./src/index.js",
  output: {
    file: "./es/frlinnstrument.js",
    format: "es",
    name: "frlinnstrument"
  },
  plugins: [
    babel ({
      exclude: "node_modules/**"
    }),
    nodeResolve ()
]}, {
  input: "./src/index.js",
  output: {
    file: "./umd/frlinnstrument.js",
    format: "umd",
    name: "frlinnstrument"
  },
  plugins: [
    babel ({
      exclude: "node_modules/**"
    }),
    nodeResolve ()
]}]
