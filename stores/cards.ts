import { defineStore } from 'pinia'

export type CardRarity = 'common' | 'rare' | 'epic' | 'legendary'
export type CardCategory = 'wisdom' | 'architecture'

export interface BuddhistCard {
  id: string
  title: string
  subtitle: string
  category: CardCategory
  country: string
  rarity: CardRarity
  scriptureText?: string
  meaning: string
  lore: string
  unlockedAt: number | null
}

export const useCardsStore = defineStore('cards', {
  state: () => ({
    allCards: [
      {
        id: 'card_vn_truclam',
        title: 'Cư Trần Lạc Đạo Phú',
        subtitle: 'Thiền Phái Trúc Lâm Yên Tử',
        category: 'wisdom',
        country: 'Việt Nam',
        rarity: 'legendary',
        scriptureText: 'Cư trần lạc đạo thả tùy duyên / Cơ tắc xan hề khốn tắc miên...',
        meaning: 'Sống giữa trần tục mà vui với đạo, hãy thuận theo nhân duyên; đói thì ăn, mệt thì ngủ, không vướng bận tham sân.',
        lore: 'Tác phẩm bất hủ của Đức Vua - Phật Hoàng Trần Nhân Tông sau khi ngài đắc đạo trên non thiêng Yên Tử.',
        unlockedAt: Date.now()
      },
      {
        id: 'card_jp_ichigo',
        title: 'Nhất Kỳ Nhất Hội (一期一会)',
        subtitle: 'Triết Lý Thiền Trà Nhật Bản',
        category: 'wisdom',
        country: 'Nhật Bản',
        rarity: 'epic',
        scriptureText: 'Ichigo Ichie',
        meaning: 'Đời người chỉ gặp một lần. Mỗi khoảnh khắc hiện tại cùng chén trà là duy nhất và không bao giờ lặp lại.',
        lore: 'Triết lý cốt lõi của Trà Đạo khởi xướng bởi Thiền sư Sen no Rikyu tại Kyoto.',
        unlockedAt: Date.now()
      },
      {
        id: 'card_vn_motcot',
        title: 'Chùa Một Cột (Diên Hựu Tự)',
        subtitle: 'Đóa Sen Ngàn Năm Thăng Long',
        category: 'architecture',
        country: 'Việt Nam',
        rarity: 'legendary',
        meaning: 'Biểu tượng đóa hoa sen ngát hương vươn lên từ mặt nước, tượng trưng cho sự thuần khiết thoát tục.',
        lore: 'Xây dựng năm 1049 dưới triều vua Lý Thái Tông theo giấc chiêm bao Phật Bà Quan Âm ngự trên tòa sen.',
        unlockedAt: Date.now()
      },
      {
        id: 'card_jp_kinkaku',
        title: 'Chùa Vàng Kinkaku-ji',
        subtitle: 'Lộc Uyển Tự - Kyoto',
        category: 'architecture',
        country: 'Nhật Bản',
        rarity: 'epic',
        meaning: 'Ba tầng chùa dát vàng soi bóng xuống hồ Gương Sen (Kyoko-chi), tạo nên cảnh giới Tây Phương Cực Lạc chốn nhân gian.',
        lore: 'Di sản thế giới UNESCO, xây dựng từ thời Mạc Phủ Ashikaga Yoshimitsu.',
        unlockedAt: null
      },
      {
        id: 'card_th_watphra',
        title: 'Chùa Phật Ngọc (Wat Phra Kaew)',
        subtitle: 'Bảo Vật Hoàng Gia Thái Lan',
        category: 'architecture',
        country: 'Thái Lan',
        rarity: 'legendary',
        meaning: 'Tượng Phật tạc từ ngọc bích nguyên khối xanh biếc, mang lại phúc lành và thịnh vượng cho quốc gia.',
        lore: 'Tọa lạc bên trong Hoàng Cung Bangkok, nơi Vua Thái Lan tự tay thay 3 bộ y phục cho tượng theo 3 mùa.',
        unlockedAt: null
      },
      {
        id: 'card_kr_bulguk',
        title: 'Phật Quốc Tự (Bulguksa)',
        subtitle: 'Đỉnh Cao Kiến Trúc Đá Silla',
        category: 'architecture',
        country: 'Hàn Quốc',
        rarity: 'epic',
        meaning: 'Tượng trưng cho cõi Phật trần thế với tháp đá Đa Bảo Tháp (Dabotap) và Thích Ca Tháp (Seokgatap).',
        lore: 'Quần thể cổ tự linh thiêng bậc nhất xứ sở kim chi được xây dựng từ thế kỷ thứ 8.',
        unlockedAt: null
      }
    ] as BuddhistCard[]
  }),

  getters: {
    unlockedList: (state) => state.allCards.filter(c => c.unlockedAt !== null),
    lockedList: (state) => state.allCards.filter(c => c.unlockedAt === null)
  },

  actions: {
    unlockCard(id: string) {
      const card = this.allCards.find(c => c.id === id)
      if (card && !card.unlockedAt) {
        card.unlockedAt = Date.now()
        return true
      }
      return false
    }
  }
})

export const useCardStore = useCardsStore

