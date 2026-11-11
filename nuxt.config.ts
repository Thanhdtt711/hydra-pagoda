import tailwindcss from '@tailwindcss/vite'

// Nuxt 3 config for Hydra Pagoda (Virtual Sacred Pilgrimage MMO)
export default defineNuxtConfig({
  ssr: false, // SPA Mode for WebGL 3D, Web Audio API and Cardano Web3 Wallet integrations
  compatibilityDate: '2025-07-15',
  experimental: {
    appManifest: false
  },
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
    // Hydra L2 (Hybrid, mặc định TẮT; xem .env.example). Cũng đọc trực tiếp HYDRA_L2_ENABLED / HYDRA_NODE_WS_URL.
    hydraL2Enabled: false, // NUXT_HYDRA_L2_ENABLED
    hydraNodeWsUrl: 'ws://127.0.0.1:4001', // NUXT_HYDRA_NODE_WS_URL
    hydraSessionSecret: '', // NUXT_HYDRA_SESSION_SECRET (để trống: tự sinh & lưu trong bảng hydra_kv)
    hydraStateLovelace: 2000000, // NUXT_HYDRA_STATE_LOVELACE
    hydraFuelTarget: 10, // NUXT_HYDRA_FUEL_TARGET
    hydraSubmitTimeoutMs: 8000, // NUXT_HYDRA_SUBMIT_TIMEOUT_MS
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
      cardanoNetwork: 'preprod', // NUXT_PUBLIC_CARDANO_NETWORK: 'preprod' | 'mainnet'
      appCenterOrigin: 'https://dev.hydraone.app,https://beta.hydraone.app,*' // NUXT_PUBLIC_APP_CENTER_ORIGIN
    }
  },
  modules: [
    '@pinia/nuxt'
  ],
  app: {
    head: {
      link: [
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700;900&family=Noto+Serif:ital,wght@0,400;0,600;0,700;1,400&family=Playfair+Display:ital,wght@0,600;0,700;0,900;1,600&display=swap'
        }
      ]
    }
  },
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
