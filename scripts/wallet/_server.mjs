// Helper dùng chung cho các test wallet: dựng server Nitro đã build (.output) trên cổng riêng với DB thử.
// Yêu cầu đã build: npm run build.
import fs from 'node:fs'
import { spawn } from 'node:child_process'

const TREASURY_TEST_ADDR =
  'addr_test1qqn4u45fks9kd0jk7tgqrwcnkcds8cqyyzcuqkzp73yh84fcrse0mymwzap6e9vvwt9yv3wddg28lft4p7hszvpyucjstn9ug9'

/** Xóa DB thử cũ (kèm -wal, -shm). */
export function removeDbFiles(dbPath) {
  for (const ext of ['', '-wal', '-shm']) {
    try { fs.unlinkSync(dbPath + ext) } catch { /* chưa tồn tại */ }
  }
}

/**
 * Khởi động server thử và chờ tới khi /api/auth/me trả 200.
 * `env` ghi đè biến môi trường mặc định (ví dụ NUXT_CONFIRMATIONS_REQUIRED, NUXT_BLOCKFROST_BASE_URL).
 * Trả về `{ proc, stop }`; `stop()` tắt server và xóa DB thử.
 */
export async function startTestServer({ port, dbPath, env = {} }) {
  removeDbFiles(dbPath)
  let stderrTail = ''
  // SERVER_ENTRY cho phép trỏ tới bản build ở thư mục khác (ví dụ .nuxt-verify/.output) mà không ghi đè .output.
  const proc = spawn(process.execPath, [process.env.SERVER_ENTRY || '.output/server/index.mjs'], {
    env: {
      ...process.env,
      PORT: String(port),
      HOST: '127.0.0.1',
      NUXT_DB_PATH: dbPath,
      NUXT_TREASURY_ADDRESS: TREASURY_TEST_ADDR,
      NUXT_BLOCKFROST_API_KEY: 'preprod_mock_key_test',
      NUXT_HYDRA_L2_ENABLED: 'false',
      ...env
    },
    stdio: ['ignore', 'ignore', 'pipe']
  })
  proc.stderr.on('data', chunk => {
    stderrTail = (stderrTail + chunk.toString()).slice(-2000)
  })

  const base = `http://127.0.0.1:${port}`
  let ready = false
  for (let i = 0; i < 100 && !ready; i++) {
    try {
      const r = await fetch(`${base}/api/auth/me`)
      if (r.status === 200) ready = true
    } catch { /* server chưa lắng nghe */ }
    if (!ready) await new Promise(r => setTimeout(r, 150))
  }
  if (!ready) {
    proc.kill()
    throw new Error(`Server thử không khởi động được trên cổng ${port}. stderr: ${stderrTail}`)
  }

  return {
    proc,
    base,
    async stop() {
      proc.kill()
      await new Promise(r => setTimeout(r, 300))
      removeDbFiles(dbPath)
    }
  }
}
