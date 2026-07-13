import typescript from '@rollup/plugin-typescript';
import {nodeResolve} from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import terser from '@rollup/plugin-terser';

// `npm run dev` (watch mode) keeps a readable build with inline sourcemaps;
// `npm run build` minifies for release
const isProduction = !process.env.ROLLUP_WATCH;

export default {
  input: 'src/main.ts',
  output: {
    dir: '.',
    sourcemap: isProduction ? false : 'inline',
    format: 'cjs',
    exports: 'default'
  },
  external: ['obsidian'],
  plugins: [
    typescript({
      include: ['src/**/*.ts'],
      inlineSourceMap: !isProduction,
      inlineSources: !isProduction,
    }),
    nodeResolve({browser: true}),
    commonjs(),
    isProduction && terser(),
  ]
};