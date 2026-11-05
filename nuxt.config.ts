import tailwindcss from '@tailwindcss/vite'

// Nuxt 3 config for Hydra Pagoda (Virtual Sacred Pilgrimage MMO)
export default defineNuxtConfig({
  ssr: false, // SPA Mode for WebGL 3D, Web Audio API and Cardano Web3 Wallet integrations
  compatibilityDate: '2025-07-15',
  nitro: {
    experimental: {
      websocket: true
    },
    esbuild: {
      options: {
        target: 'es2022'
      }
    },
    externals: {
      external: ['@hydra-sdk/cardano-wasm'],
      inline: [
        '@hydra-sdk/core',
        '@harmoniclabs/uplc',
        '@harmoniclabs/plutus-data',
        '@harmoniclabs/crypto',
        '@scure/base',
        '@noble/curves',
        '@noble/hashes',
        'cbor2',
        'bip39',
        'cbor-x'
      ]
    }
  },
  // Ví Cardano & MC coin. Mọi giá trị ghi đè bằng biến môi trường NUXT_* (xem .env.example).
  // Chỉ `public.*` được gửi xuống trình duyệt; phần còn lại là bí mật/vận hành phía server.
  runtimeConfig: {
    dbPath: './.data/pagoda.sqlite', // NUXT_DB_PATH
    sessionTtlHours: 168, // NUXT_SESSION_TTL_HOURS (7 ngày)
    trustProxy: false, // NUXT_TRUST_PROXY: chỉ bật khi chạy sau reverse proxy tin cậy
    treasuryAddress: '', // NUXT_TREASURY_ADDRESS (hoặc biến môi trường TREASURY_ADDRESS)
    blockfrostApiKey: '', // NUXT_BLOCKFROST_API_KEY (hoặc BLOCKFROST_API_KEY)
    blockfrostBaseUrl: '', // NUXT_BLOCKFROST_BASE_URL (để trống = tự suy theo mạng)
    confirmationsRequired: 0, // NUXT_CONFIRMATIONS_REQUIRED (0 = tự chọn: 1 cho preprod, 3 cho mainnet)
    orderTtlMinutes: 30, // NUXT_ORDER_TTL_MINUTES (hạn đơn mặc định 30 phút)
    orderMetadataLabel: 8181, // NUXT_ORDER_METADATA_LABEL (nhãn metadata gắn orderId)
    webhookSecret: '', // NUXT_WEBHOOK_SECRET (tùy chọn cho Blockfrost webhook)
    public: {
      cardanoNetwork: 'preprod' // NUXT_PUBLIC_CARDANO_NETWORK: 'preprod' | 'mainnet'
    }
  },
  modules: [
    '@pinia/nuxt'
  ],
  devServer: {
    host: '127.0.0.1',
    port: 3012
  },
  css: [
    '~/assets/css/main.css'
  ],
  vite: {
    plugins: [
      tailwindcss()
    ],
    build: {
      target: 'es2022'
    }
  }
})
