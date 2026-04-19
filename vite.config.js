import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import os from 'os'
import path from 'path'

// Keep Vite's dep cache outside Dropbox — Dropbox file locks cause EBUSY on
// the deps_temp → deps rename Vite performs on dep re-optimization.
const cacheDir = path.join(os.tmpdir(), 'vite-cap-collective')

export default defineConfig({
  plugins: [react()],
  cacheDir,
})
