import { nextTick, watch } from 'vue'
import { currentLocale } from './copy'

/**
 * Bộ dịch tự động toàn diện trên DOM khi chuyển sang Tiếng Anh (`currentLocale === 'en'`),
 * và khôi phục nguyên vẹn chuỗi Tiếng Việt gốc (`origTextMap` / `origAttrMap`) khi quay về `'vi'`.
 */
const PHRASE_PAIRS: ReadonlyArray< readonly [string, string] > = [
  [
    "A Di Đà Phật, người Việt có câu \"Tiền Phật - Hậu Mẫu\", thể hiện sự chung sống rất hài hòa nhưng vẫn rạch ròi giữa hai truyền thống. Phật giáo hướng con người tu tập tâm thức, giữ giới và giác ngộ thoát khổ theo lời dạy của Đức Phật Thích Ca; còn Tín ngưỡng Thờ Mẫu Tam Tứ phủ là di sản văn hóa bản địa tôn vinh Mẹ Thiên nhiên, các vị anh hùng dân tộc như Đức Thánh Trần và nghi lễ Hầu đồng đã được UNESCO ghi danh năm 2016. Hai bên khác nhau về mục đích tối hậu và nghi thức hành trì, nhưng cùng gặp nhau ở lòng hướng thiện và tri ân tiền nhân. Trong game Pagoda, Nhà Hầu Đồng đặt trang nghiêm ở phía Đông Chánh Điện để người chơi tìm hiểu nét đẹp văn hóa dân tộc một cách tôn trọng.",
    "Amitabha Buddha, Vietnamese tradition honors \"Buddha in Front, Mother Goddess Behind,\" harmonizing two distinct heritages: Buddhism guides mindfulness and awakening, while the Four Palaces Mother Goddess worship—inscribed by UNESCO in 2016—celebrates Nature and national heroes like Lord Tran Hung Dao. Both share gratitude and compassion."
  ],
  [
    "A Di Đà Phật, theo tinh thần Luật Tín ngưỡng, tôn giáo năm 2016 và các quy định quản lý lễ hội của Nhà nước, mọi người đều có quyền tự do tín ngưỡng, tôn giáo nhưng cần thực hiện văn minh, đúng pháp luật và không lợi dụng lễ hội để mê tín dị đoan hay trục lợi. Tại nơi thờ tự và di tích, người tham gia cần giữ gìn trật tự, an toàn phòng cháy chữa cháy và bảo vệ cảnh quan chung. Nếu con cần tra cứu chi tiết từng điều khoản pháp lý hoặc thủ tục hành chính cụ thể ngoài những nét chung này, thầy chưa nắm đầy đủ từng mục luật nên con hãy xem văn bản gốc hoặc hỏi cơ quan quản lý có thẩm quyền nhé.",
    "Amitabha Buddha, under the Law on Belief and Religion and festival regulations, everyone enjoys freedom of belief practiced respectfully, lawfully, and free from superstition or profiteering, while preserving heritage order and safety."
  ],
  [
    "A Di Đà Phật, tâm hay lo âu cũng giống như mặt hồ bị gió thổi xao động; nếu ta cứ lấy tay đập xuống nước cho phẳng thì nước càng đục hơn. Thay vì gồng mình xua đuổi suy nghĩ, con hãy thử ngồi yên một chút, hít vào chậm rãi và nhận ra mình đang hít vào, thở ra nhẹ nhàng và buông lỏng hai vai. Nhiều nỗi sợ đến từ việc tâm chạy trước về tương lai chưa tới hoặc ngoái lại quá khứ đã qua, nên kéo ý thức trở về hơi thở hiện tại sẽ giúp ngọn đèn trong lòng sáng và đứng gió hơn. Con có thể bước vào Đại Hùng Bảo Điện trải nghiệm nhịp thở 4-4-6 trên bồ đoàn thiền 432Hz để cảm nhận sự lắng dịu này.",
    "Amitabha Buddha, an anxious mind is like a wind-rippled pond; striking the water only stirs more mud. Instead, sit quietly, inhale gently, relax your shoulders on the exhale, and bring awareness back to the present breath. You can enter the Main Sanctuary Hall to practice 4-4-6 breathing with the 432Hz singing bowls."
  ],
  [
    "A Di Đà Phật, thiền không phải ép đầu óc trống rỗng như tảng đá, mà là nghệ thuật quay về quan sát thân tâm mình một cách tỉnh thức và dịu dàng. Người mới bắt đầu chỉ cần ngồi thẳng lưng tự nhiên, thả lỏng vai, chọn một điểm neo đơn giản là hơi thở ra vào ở cánh mũi hoặc vùng bụng. Khi tâm chạy đi suy nghĩ chuyện công việc hay gia đình, con chỉ cần mỉm cười nhận ra rồi nhẹ nhàng đưa chú ý về lại hơi thở, mỗi ngày năm mười phút đều đặn là quý lắm rồi. Trong chùa Pagoda, con có thể vào Chánh Điện ngồi bồ đoàn nghe tiếng chuông 432Hz để tập nhịp thở chánh niệm ấy.",
    "Amitabha Buddha, meditation is not forcing the mind blank like stone, but gently observing body and mind with awareness. Sit upright naturally, relax your shoulders, and anchor your attention on the breath. When thoughts wander, smile and gently return to your breathing."
  ],
  [
    "A Di Đà Phật, Tứ diệu đế là bốn sự thật màu nhiệm mà Đức Phật chỉ ra ngay từ bài pháp đầu tiên: Khổ đế, Tập đế, Diệt đế và Đạo đế. Hiểu nôm na như chuyện chữa bệnh: Khổ là nhận diện nỗi bất an đang có, Tập là tìm đúng gốc rễ sinh ra nó từ tham sân si, Diệt là trạng thái lòng lắng dịu khi buông được chấp niệm, còn Đạo là tám bước thực hành để đi tới bình an. Sở dĩ gọi là \"diệu\" vì đây là sự thật chắc chắn, ai chịu nhìn thẳng và thực hành đúng đều có thể chuyển hóa khổ đau ngay trong đời này. Con có muốn thầy nói sâu hơn về bước đầu tiên của Bát chánh đạo không?",
    "Amitabha Buddha, the Four Noble Truths are the four profound truths taught by the Buddha in His first discourse: Suffering (Dukkha), the Origin of Suffering (Samudaya), the Cessation of Suffering (Nirodha), and the Path (Magga). Like healing an illness: first recognize the unease, find its root in craving and attachment, experience peace when clinging is released, and walk the Noble Eightfold Path toward lasting serenity. Would you like me to share more about the first step of the Eightfold Path?"
  ],
  [
    "A Di Đà Phật, công đức đích thực không nằm ở con số tiền lớn hay nhỏ, mà ở tâm hoan hỉ, trong sáng khi cho đi mà không mong cầu đổi chác hay khoe khoang. Một lời an ủi chân thành, một hành động nhường nhịn hay giúp người lúc ngặt nghèo đều là công đức lớn. Khi đóng góp tiền công đức hay làm từ thiện, cả tinh thần Phật pháp lẫn quy định pháp luật hiện hành đều đề cao sự tự nguyện, công khai và minh bạch đúng mục đích tu bổ di tích, giúp đỡ cộng đồng. Trong game cũng vậy, góp công đức ở Hòm Công Đức hoàn toàn tùy tâm, tuyệt đối không phải để mua bán phước phần.",
    "Amitabha Buddha, true merit lies not in the size of a donation, but in a pure, joyful heart that gives without seeking praise. A kind word or helping hand is already great merit. Donations at the Sanctuary Merit Box are completely voluntary and transparent."
  ],
  [
    "A Di Đà Phật, nhiều người nghe tới \"nghiệp\" thường thấy sợ, nhưng thực ra nghiệp chỉ có nghĩa là hành động có tác ý qua thân, miệng và ý của mình. Nhân giống như hạt giống con gieo xuống đất, gặp đủ nắng mưa gọi là duyên thì mới nảy mầm thành quả. Nhân quả không phải bản án cố định trói buộc con người, bởi ngay phút giây hiện tại con luôn có quyền gieo thêm những hạt lành mới để chuyển hóa dòng chảy cũ. Như cốc nước muối mặn, nếu ta rót thêm nhiều nước ngọt tinh khiết thì vị mặn tự khắc dịu đi. Con có muốn hỏi thêm về cách giữ tâm thiện lành mỗi ngày không?",
    "Amitabha Buddha, Karma simply means intentional action through body, speech, and mind. A cause is like a seed planted in the soil; when met with conditions such as sunlight and rain, it ripens into fruit. Cause and effect is never a fixed sentence—in every present moment you can plant wholesome new seeds to transform the stream of life, just as pouring fresh water softens a salty cup."
  ],
  [
    "A Di Đà Phật, câu hỏi của con rất tinh tế vì nhiều người hay gộp chung hai điều này. Kinh Dịch là bộ sách triết học và văn hóa cổ đại phương Đông bàn về quy luật biến đổi không ngừng của Âm Dương, Bát quái và Ngũ hành, hoàn toàn không phải giáo lý Phật giáo. Điểm tương đồng thú vị chỉ nằm ở chỗ cả hai đều nhìn thấy vạn vật luôn vận động, thịnh rồi suy như thủy triều lên xuống. Khi xem quẻ Kinh Dịch trong chùa để chiêm nghiệm, con hãy coi đó như tấm gương nhắc mình suy nghĩ chín chắn, bởi vận mệnh cuối cùng vẫn nằm ở việc con làm chứ không phải ở que tre.",
    "Amitabha Buddha, the I Ching is an ancient Eastern philosophical classic on the changing cycles of Yin-Yang, Eight Trigrams, and Five Elements rather than Buddhist scripture. Both observe that all things are in constant flux. Treat divination as a mirror for mindful reflection—your destiny always lies in your own wholesome actions."
  ],
  [
    "A Di Đà Phật, người Việt mình giữ nếp lên chùa vào ngày mồng một đầu tháng và ngày rằm giữa tháng như hai khoảng dừng quý giá giữa nhịp sống bận rộn. Đầu tháng là dịp phát nguyện sống hiền hòa, bớt nóng nảy; còn ngày rằm trăng tròn nhắc mình soi lại lòng xem nửa tháng qua đã giữ được bình an hay chưa. Ở nhiều truyền thống Phật giáo, đây cũng là những ngày Bố-tát để chư Tăng tụng giới và Phật tử về chùa tụng kinh, giữ tâm thanh tịnh. Trong game Pagoda, mồng một và ngày rằm Âm lịch cũng là dịp sinh hoạt cộng đồng đặc biệt của chùa và Nhà Hầu Đồng.",
    "Amitabha Buddha, visiting the temple on the Lunar New Moon (1st) and Full Moon (15th) offers two precious pauses in busy life—setting wholesome intentions at the start of the month and reflecting under the full moon. In the Pagoda sanctuary, these Uposatha days also feature special lunar festival lanterns, fireworks, and community ceremonies."
  ],
  [
    "A Di Đà Phật, Ngũ giới của người Phật tử tại gia gồm năm điều thực tập: không sát sinh, không trộm cắp, không tà dâm, không nói dối và không dùng chất say nghiện làm mờ trí tuệ. Giới luật không phải sợi dây trói buộc hay điều răn phạt, mà giống như hàng rào ven vực giúp mình đi đứng vững vàng mà không trượt ngã. Người tại gia giữ giới tùy theo sức và hoàn cảnh, lỡ vấp chỗ nào thì tự nhận biết để sửa chỗ ấy, nuôi lớn lòng từ bi và sự chân thật. Nhờ giữ năm điều này, gia đình ấm êm mà lòng mình cũng ngủ yên hơn mỗi tối.",
    "Amitabha Buddha, the Five Precepts for lay practitioners are: refraining from harming living beings, not taking what is not given, sexual misconduct, false speech, and intoxicants that cloud the mind. Precepts are not restrictions, but protective guardrails along a mountain path that nurture compassion, honesty, and peaceful sleep each night."
  ],
  [
    "A Di Đà Phật, điều quý nhất con mang theo khi vào chùa không phải mâm cao cỗ đầy, mà là y phục chỉnh tề, kín đáo và một tấm lòng thanh tịnh. Khi thắp hương, con chỉ cần một nén hương lòng hoặc một cành hoa tươi ở đỉnh hương ngoài sân, không chen lấn hay khấn xin điều gây hại cho ai. Trong khuôn viên chùa, ta đi nhẹ nói khẽ để giữ sự tĩnh lặng chung cho những người đang tọa thiền. Một cái chắp tay cúi đầu thành kính trước Tam Bảo đã đủ trọn vẹn ý nghĩa lễ Phật rồi.",
    "Amitabha Buddha, the most precious offering you bring to a temple is not lavish gifts, but modest attire and a sincere, peaceful heart. Offer a single stick of incense with mindfulness, walk gently, and speak softly so others may meditate in stillness. A sincere bow with palms joined before the Three Jewels is already complete."
  ],
  [
    "A Di Đà Phật, điều con hỏi thật thú vị nhưng trong tủ sách nhỏ ở chùa thầy chưa có tài liệu đối chiếu đủ rõ để trả lời trọn vẹn. Thầy chỉ xin chia sẻ những điều thuộc phạm vi Phật pháp căn bản, giới luật, văn hóa chùa, Kinh Dịch hoặc hướng dẫn sinh hoạt tại Pagoda thôi nhé.",
    "Amitabha Buddha, your question is thoughtful, though our temple library does not have enough reference material to answer it in full. I can share insights on core Dharma, precepts, temple culture, I Ching, or Pagoda sanctuary activities."
  ],
  [
    "A Di Đà Phật, thầy chào con vừa bước lên thềm Đại Hùng Bảo Điện. Thầy đứng đây đón khách thập phương; con có thắc mắc gì về Phật pháp, giới luật, nghi lễ chùa, Kinh Dịch, quy định hay cách sinh hoạt trong chùa Pagoda thì cứ thong thả hỏi thầy nhé.",
    "Amitabha Buddha, welcome to the Main Sanctuary steps. I am here to greet pilgrims from all directions; feel free to ask me anything about Buddhist teachings, precepts, temple rituals, I Ching, regulations, or sanctuary activities."
  ],
  [
    "A Di Đà Phật, về các điều khoản quy định cụ thể của Giáo hội hoặc văn bản pháp luật ngoài phạm vi tổng quan sẵn có, thầy chưa nắm chính xác nên con hãy tham khảo văn bản gốc hoặc cơ quan có thẩm quyền để chắc chắn nhé.",
    "Amitabha Buddha, regarding specific legal clauses or Sangha regulations beyond our general overview, please consult the official documents or relevant authorities for accuracy."
  ],
  [
    "Hai bạn hãy cùng nhau nuôi dưỡng lòng thấu hiểu và bao dung. Khi gặp điều bất đồng, hãy ngồi lại hít thở sâu, cùng lắng nghe bằng trái tim để chuyển hóa vướng mắc thành duyên lành bền vững.",
    "Nurture mutual understanding and kindness together. Whenever disagreements arise, sit quietly, breathe deeply, and listen with an open heart to transform tension into lasting harmony."
  ],
  [
    "Nghi lễ Khai Đàn định kỳ diễn ra vào đúng 11h00 Trưa (Giờ Ngọ) hằng ngày. Quý đạo hữu có thể hoan hỷ chờ hoặc Phát Tâm Mở Đàn Đặc Cách / Góp Bách Gia.",
    "Scheduled rituals open daily at 11:00 AM (Noon). You may wait or sponsor a Private Ritual / Community Pool session."
  ],
  [
    "Con nhớ giúp thầy rằng Kinh Dịch là triết học văn hóa phương Đông chứ không phải giáo lý Phật giáo, và vận mệnh vẫn nằm ở việc con làm hôm nay.",
    "Please remember that the I Ching is Eastern cultural philosophy rather than Buddhist doctrine, and your destiny always rests in your wholesome actions today."
  ],
  [
    "Yếu tố bù đắp: Căn cứ có xung khắc nhưng quẻ đắc Cát do phúc duyên niên vận sao lành nâng đỡ, khuyên tích đức hành thiện để bảo toàn vượng khí.",
    "Supportive factor: Although elements show tension, auspicious stars uplift the draw; continue doing good deeds to preserve positive energy."
  ],
  [
    "Quần thể cổ tự trên núi Tohamsan xây dựng từ triều đại Silla thế kỷ thứ 8, biểu tượng cho lòng mộ đạo thuần thành của nhân dân Hàn Quốc.",
    "8th-century Silla monastery on Mount Tohamsan, a pinnacle of Korean Buddhist stone architecture."
  ],
  [
    "Di sản thế giới UNESCO tại Kyoto, xây dựng từ thời Mạc Phủ Ashikaga Yoshimitsu kết hợp kiến trúc quý tộc Shinden và thiền viện Bukke.",
    "UNESCO World Heritage site in Kyoto blending Shinden court elegance and Zen temple architecture."
  ],
  [
    "Cây thông vỏ trắng cổ thụ 500 năm tuổi tỏa bóng mát giữa lòng đô thị náo nhiệt, che chở cho người lữ hành tìm về phút giây tịnh niệm.",
    "500-year-old lacebark pine casting serene shade in the heart of bustling Seoul."
  ],
  [
    "Bảo tượng Phật tạc từ khối ngọc bích xanh biếc thuần khiết, mang lại phúc lành, mưa thuận gió hòa và sự che chở tâm linh tối thượng.",
    "Sacred Buddha carved from pure green jadeite, bringing peace, harmony, and spiritual protection."
  ],
  [
    "Hải Ấn tam muội: Khi sóng biển lặng yên, bóng trời trăng muôn sao hiển hiện rõ ràng; tâm thanh tịnh thì trí huệ vô thượng bừng sáng.",
    "Ocean Mudra Samadhi: when the waves of the sea grow still, moon and stars reflect clearly—so too does wisdom shine in a calm mind."
  ],
  [
    "Giác ngộ huyền thoại của Thiền sư Wonhyo trong đêm tối tại ngôi mộ hoang, đặt nền móng cho Phật giáo hòa hợp của bán đảo Triều Tiên.",
    "Master Wonhyo’s legendary awakening on a stormy night, founding Korea’s unified One-Mind Buddhist tradition."
  ],
  [
    "Tơ hồng Nguyệt Lão khéo se dây,\\nLoan phượng song phi giữa tầng mây,\\nHai chữ đồng tâm bền tạc đá,\\nTrăm năm hạnh phúc trọn sum vầy.",
    "The Matchmaker gently weaves the crimson thread,\\nTwo phoenixes soar together through the clouds,\\nTwo hearts united, carved in enduring stone,\\nA hundred years of joy and harmony."
  ],
  [
    "Bảo tháp Prang cao vút cẩn hàng triệu mảnh gốm sứ hoa văn lấp lánh, đón nhận những tia nắng bình minh đầu tiên rọi chiếu cõi Ta Bà.",
    "Soaring Prang spire inlaid with gleaming porcelain mosaics, greeting the first rays of dawn."
  ],
  [
    "Khi ở đỉnh cao phong độ, chớ sinh tâm kiêu ngạo; hãy giữ tâm khiêm nhường như bông lúa chín cúi đầu và sẵn lòng giúp đỡ người khác.",
    "At the peak of success, remain humble like ripened grain bowing low, and generously uplift others."
  ],
  [
    "Mười lăm hòn đá trên thảm sỏi trắng cào gợn sóng; đứng ở bất kỳ góc nào cũng chỉ đếm được tối đa 14 hòn, nhắc nhở về sự bất toàn.",
    "Fifteen stones set in raked white gravel; from any vantage point only fourteen are visible, a quiet lesson on humility and perspective."
  ],
  [
    "Tơ hồng Nguyệt Lão khéo se dây,\nLoan phượng song phi giữa tầng mây,\nHai chữ đồng tâm bền tạc đá,\nTrăm năm hạnh phúc trọn sum vầy.",
    "The Matchmaker gently weaves the crimson thread,\nTwo phoenixes soar together through the clouds,\nTwo hearts united, carved in enduring stone,\nA hundred years of joy and harmony."
  ],
  [
    "Thời vận hanh thông đến độ chín muồi. Mọi dự định ấp ủ đều có thể triển khai mạnh dạn, lấy đạo đức làm gốc thì thành công rực rỡ.",
    "Fortune has ripened auspiciously. Pursue your plans with confidence—rooted in virtue, great success follows."
  ],
  [
    "Mối nhân duyên sâu đậm gặp lại. Dù có thử thách ban đầu, chỉ cần đôi bên chân thành và kiên nhẫn thì kết quả sẽ đơm hoa kết trái.",
    "A deep bond blossoms through sincerity and patience."
  ],
  [
    "Chỉ mang tính giải trí — Nội dung chiêm bốc văn hóa dân gian & hướng dẫn chánh niệm, không thay thế tư vấn y khoa hay tài chính.",
    "For entertainment only — Folk cultural divination & mindfulness guidance; not a substitute for medical or financial advice."
  ],
  [
    "Ngôi đại tự cổ kính bậc nhất vùng châu thổ sông Hồng thờ Quốc sư Không Lộ, lưu giữ kỹ nghệ kiến trúc mộng gỗ đỉnh cao thế kỷ 17.",
    "Ancient Red River Delta monastery honoring National Master Khong Lo, preserving 17th-century timber joinery."
  ],
  [
    "Yếu tố cảnh báo: Căn cứ tuy tương sinh nhưng vận trình thời điểm gặp điểm lắng, nhắc nhở giữ tâm kiên định và hành sự cẩn trọng.",
    "Mindful note: Although elements are harmonious, current timing calls for patience, steadiness, and prudent action."
  ],
  [
    "Gác chuông gỗ 3 tầng độc nhất vô nhị ghép từ hàng ngàn thanh gỗ mộng mị, biểu trưng cho sự hòa hợp bền vững của lòng kiên định.",
    "Three-tiered timber bell tower joined without nails, symbolizing enduring harmony and steadfastness."
  ],
  [
    "Cư trần lạc đạo thả tùy duyên / Cơ tắc xan hề khốn tắc miên / Gia trung hữu bảo hưu tầm mịch / Đối cảnh vô tâm mạc vấn thiền.",
    "Dwell in the world with joy in the Way / Hungry, eat; weary, sleep / The treasure is at home, seek no further / Facing all scenes with a serene mind, ask no more of Zen."
  ],
  [
    "Vạn pháp quy tâm. Tâm sinh thì muôn pháp sinh, tâm diệt thì gáo sọ dừa hôi hám cũng chỉ là một giọt nước cam lộ thanh lương.",
    "All phenomena return to the Mind: when thought arises, all things arise; when thought stills, all is pure."
  ],
  [
    "Của cải nhiều cần biết san sẻ cho những mảnh đời cơ nhỡ; phước đức bố thí chính là chiếc khiên bảo vệ gia tộc vững bền nhất.",
    "Share abundance with those in need; generosity is the strongest shield protecting your family."
  ],
  [
    "Nét bút mực thiền khép lại thành vòng tròn tượng trưng cho sự trọn vẹn của vũ trụ, vạn vật chuyển hóa không khởi không dứt.",
    "A single brushstroke forming the Enso circle—symbolizing cosmic wholeness without beginning or end."
  ],
  [
    "Ngôi chùa biểu tượng bên dòng sông Mẹ Chao Phraya, đặt theo tên thần Aruna - vị thần bình minh của Ấn Độ giáo và Phật giáo.",
    "Iconic riverside temple on the Chao Phraya River, named after Aruna, the herald of dawn."
  ],
  [
    "Tượng trưng cho cõi Phật trần thế với tháp đá Đa Bảo Tháp (Dabotap) phức hợp và Thích Ca Tháp (Seokgatap) mộc mạc đăng đối.",
    "Manifesting the Buddha Land on earth with the paired Dabotap and Seokgatap stone pagodas."
  ],
  [
    "Khí vận đang có chút thử thách nhỏ. Hoàn thành nhiệm vụ hóa giải bên dưới để chuyển hóa thành trạng thái Tâm Bình Khí Hòa.",
    "Minor turbulence ahead. Complete the mindful remedy below to restore Balanced Mind & Qi."
  ],
  [
    "Ngôi Tam Bảo Tự lưu giữ hơn 80.000 mộc bản Đại Tạng Kinh Triều Tiên nguyên vẹn suốt 750 năm, di sản ký ức thế giới UNESCO.",
    "Three-Jewel Temple preserving over 80,000 Tripitaka Koreana woodblocks intact for 750 years (UNESCO Memory of the World)."
  ],
  [
    "Tọa lạc bên trong Hoàng Cung Bangkok, nơi Quốc Vương Thái Lan đích thân thay áo ngọc cho tượng 3 lần mỗi năm theo 3 mùa.",
    "Enshrined within Bangkok’s Grand Palace, where the King of Thailand ceremonially changes the statue’s golden vestments each season."
  ],
  [
    "Vị Thánh Quan trấn giữ miền sông nước Thoải Phủ, múa đôi song kiếm uy nghiêm, khai quang tẩy tịnh và độ trì hanh thông.",
    "Sacred Mandarin guarding the Water Palace, wielding twin swords to purify and bless all journeys."
  ],
  [
    "Xây dựng năm 1049 dưới triều vua Lý Thái Tông theo giấc chiêm bao Phật Bà Quan Âm ngự trên tòa sen dắt vua lên tòa sen.",
    "Built in 1049 under Emperor Ly Thai Tong after an auspicious dream of Bodhisattva Guanyin seated upon a lotus throne."
  ],
  [
    "Bánh xe Pháp tám nan hoa tượng trưng cho Bát Chánh Đạo, con đường đưa đến chấm dứt khổ đau và đạt tới an tịnh Niết Bàn.",
    "Eight-spoked Wheel of the Dhamma representing the Noble Eightfold Path to liberation and Nirvana."
  ],
  [
    "Thực hành tọa thiền 432Hz hoặc phát tâm Hòm Công Đức để hồi hướng thiện nghiệp, hóa giải hoàn toàn vận xấu trong ngày.",
    "Practice 432Hz meditation or donate to the Merit Box to dedicate wholesome karma and resolve today’s challenges."
  ],
  [
    "Triết lý cốt lõi của Trà Đạo khởi xướng bởi Thiền sư Sen no Rikyu, nhắc nhở con người trân quý từng phút giây tri ngộ.",
    "Core philosophy of the Way of Tea taught by Master Sen no Rikyu, cherishing each present moment."
  ],
  [
    "Sở hữu nhiều phước lành và tài nguyên quý giá. Thời điểm tốt để hợp tác, mở mang công việc thiện nguyện và kinh doanh.",
    "Blessed with abundant merit and resources—an ideal time for collaboration, charity, and commerce."
  ],
  [
    "Tình yêu bền vững không phải là tìm kiếm một người hoàn hảo, mà là học cách nhìn nhận nhau bằng sự bao dung trọn vẹn.",
    "Lasting love is not finding a perfect person, but seeing each other with wholehearted compassion."
  ],
  [
    "Thư pháp thiền tông Nhật Bản được vẽ bằng một hơi thở duy nhất, phản ánh trung thực tâm thái buông xả của thiền giả.",
    "Japanese Zen calligraphy drawn in a single breath, reflecting the practitioner’s unattached mind."
  ],
  [
    "Ghi dấu bài pháp thoại đầu tiên của Đức Phật tại Vườn Lộc Uyển chuyển bánh xe chánh pháp khai mở kỷ nguyên giác ngộ.",
    "Commemorates the Buddha’s first discourse at Deer Park, setting in motion the Wheel of the Dhamma."
  ],
  [
    "Hãy trở thành phiên bản lương thiện và bình an nhất của chính mình; bông hoa thơm tự khắc thu hút đàn bướm ghé thăm.",
    "Become the kindest, most peaceful version of yourself—a fragrant blossom naturally attracts butterflies."
  ],
  [
    "Quần thể tâm linh Hương Sơn tại Mỹ Đức Hà Nội, nơi hàng triệu phật tử trẩy hội đầu xuân tìm về nguồn cội tâm linh.",
    "Sacred Huong Son pilgrimage complex in Hanoi where millions of pilgrims gather each spring."
  ],
  [
    "Trụ sở trung ương của Thiền phái Tào Khê Hàn Quốc, ngập tràn lồng đèn hoa sen lung linh muôn màu mỗi mùa Phật Đản.",
    "Head temple of the Jogye Order of Korean Seon Buddhism, illuminated by vibrant lotus lanterns."
  ],
  [
    "Tác phẩm thiền học kinh điển của Đức Vua - Phật Hoàng Trần Nhân Tông sau khi ngài đắc đạo trên non thiêng Yên Tử.",
    "Classic Zen prose-poem composed byBuddha-Emperor Tran Nhan Tong on sacred Mount Yen Tu."
  ],
  [
    "Đời người chỉ gặp một lần. Mỗi khoảnh khắc hiện tại cùng chén trà là duy nhất và không bao giờ lặp lại trong đời.",
    "One time, one meeting—every shared moment over a bowl of tea is unique and never repeated."
  ],
  [
    "Sống giữa trần tục mà vui với đạo, hãy thuận theo nhân duyên; đói thì ăn, mệt thì ngủ, không vướng bận tham sân.",
    "Dwelling in the world yet joyful in the Way—eating when hungry, resting when tired, free from greed and anger."
  ],
  [
    "Tầng vàng óng soi bóng xuống hồ Gương Sen (Kyoko-chi), hiển hiện cảnh giới Tây Phương Tịnh Độ giữa cõi trần thế.",
    "Gold-leaf tiers reflected in Mirror Pond (Kyoko-chi), manifesting the Pure Land on earth."
  ],
  [
    "Pháp môn thiền định căn bản của truyền thống Phật giáo Nam truyền, xua tan sân hận và kiến tạo an lạc đích thực.",
    "Foundational Theravada meditation practice that dissolves anger and cultivates genuine peace."
  ],
  [
    "Nữ Thánh cai quản 81 cửa rừng Đông Cuông - Tuần Quán, múa mồi đuốc thiêng truyền sinh khí xanh tươi và bình an.",
    "Sacred Lady presiding over the mountain forests, dancing with sacred torches to bestow vitality and peace."
  ],
  [
    "Đại Phật Tỳ Lô Giá Na bằng đồng lớn nhất thế giới, phóng hào quang chiếu rọi khắp tam thiên đại thiên thế giới.",
    "World’s largest bronze Vairocana Buddha statue, radiating compassion across the cosmos."
  ],
  [
    "Giữ tâm luôn hoan hỷ, nghe nhạc thiền, thường niệm Phật và làm việc thiện giúp đời để bồi đắp phúc đức gia môn.",
    "Keep a joyful heart, listen to serene music, and practice kindness to nurture family merit."
  ],
  [
    "Quốc Công Tiết Chế Hưng Đạo Đại Vương Trần Quốc Tuấn, uy linh hộ quốc an dân, trừ tà ma và ban sức mạnh ý chí.",
    "Supreme Commander Tran Quoc Tuan, protecting the realm and granting unwavering inner strength."
  ],
  [
    "Vận trình nhắc nhở cần dừng lại quán chiếu. Hãy hoàn thành Pháp Hóa Giải để gỡ bỏ debuff và khôi phục bình an.",
    "A reminder to pause and reflect. Complete the Mindful Remedy to clear the debuff and restore peace."
  ],
  [
    "Tâm từ trải rộng khắp muôn loài không phân biệt oán thân, như người mẹ hiền suốt đời chở che đứa con duy nhất.",
    "Boundless loving-kindness embracing all beings without distinction, like a mother protecting her only child."
  ],
  [
    "Đồng tiền chân chính kiếm bằng mồ hôi và chữ Tín mới giữ được lâu bền. Hãy trích một phần giúp người khó khăn.",
    "Honest wealth earned through diligence and integrity endures longest; share a portion with those in need."
  ],
  [
    "Tâm thần sáng suốt, hào quang cát tường hộ trì. Tăng +15% điểm Tâm An khi tọa thiền và dâng hương trong ngày.",
    "Clear spirit blessed by auspicious light. +15% Serenity bonus when meditating and offering incense today."
  ],
  [
    "Tượng trưng cho sự thuần khiết thoát tục, đóa hoa sen thanh tịnh vươn lên từ bùn nhơ mà không nhuốm mùi trần.",
    "Symbolizes transcendent purity—a sacred lotus rising from muddy waters completely untainted."
  ],
  [
    "Kiệt tác vườn khô thiền viện Kyoto thế kỷ 15, mời gọi người ngắm tự lắng đọng tâm tư để nhận diện chính mình.",
    "15th-century Kyoto dry landscape garden inviting silent contemplation."
  ],
  [
    "Thực hành 1 thời khóa Hội Thiền 432Hz hoặc gieo duyên Hòm Công Đức để tĩnh tâm và gỡ bỏ trạng thái Tâm Động.",
    "Complete one 432Hz Meditation session or donate to the Merit Box to calm the mind and clear restlessness."
  ],
  [
    "Công trình bằng gỗ lớn nhất hành tinh được Thiên hoàng Shomu khởi dựng vào thế kỷ thứ 8 nhằm hộ quốc an dân.",
    "Monumental 8th-century wooden hall commissioned by Emperor Shomu for peace and prosperity."
  ],
  [
    "Kinh điển tụng niệm mỗi sớm tối tại chốn thiền môn Việt Nam, cô đọng tinh hoa giáo lý Bát Nhã Ba La Mật Đa.",
    "Chanted morning and evening across Vietnamese temples, distilling the essence of Prajnaparamita wisdom."
  ],
  [
    "Sắc bất dị không, không bất dị sắc; thấu suốt bản tánh không của vạn pháp để vượt qua mọi khổ đau ách nạn.",
    "Form is no other than emptiness, emptiness no other than form; realizing the empty nature of all phenomena transcends suffering."
  ],
  [
    "Vị Thánh Cậu thông minh lanh lợi, múa hèo hoa chuông nhạc rộn rã, ban lộc phát tài và tin vui cát tường.",
    "Bright Young Prince dancing with flower batons and bells, bringing joyful news and good fortune."
  ],
  [
    "Nếu cần đối chiếu điều khoản chi tiết hơn, con nên xem thêm văn bản gốc hoặc hỏi cơ quan có thẩm quyền.",
    "For detailed legal clauses, please consult the original text or competent authorities."
  ],
  [
    "A Di Đà Phật, thầy chào con. Con muốn hỏi thầy điều gì về Phật pháp, nghi lễ hay sinh hoạt trong chùa?",
    "Amitabha Buddha, greetings my child. What would you like to ask about Dharma teachings, rituals, or temple life?"
  ],
  [
    "Hành trình suối Yến thanh tẩy tâm trần, bước vào hang sâu chiêm bái Bồ Tát Quan Thế Âm cầu an độ mệnh.",
    "A tranquil journey along Yen Stream into the sacred grotto of Bodhisattva Avalokiteshvara."
  ],
  [
    "Hãy cùng nhau làm việc thiện, chăm sóc sức khỏe khoa học; tâm an thì mầm sống thiện lành tự nhiên đến.",
    "Do good deeds together and care for your health; when the mind is peaceful, wholesome blessings arrive naturally."
  ],
  [
    "Gieo quẻ chiêm bốc 6 môn (Xin Xăm, Tình Duyên, Cầu Tự, Tài Lộc, Sức Khỏe, Dâng Sao) — 50 MC/lượt thêm",
    "Draw across 6 subjects (Trigram Sticks, Red Thread, Offspring, Wealth, Wellbeing, Nine Stars) — 50 MC/extra draw"
  ],
  [
    "Vị Thánh Hoàng văn võ song toàn đất Nghệ An, múa quạt đề thơ ban lộc công danh sự nghiệp và phú quý.",
    "Scholar-warrior Prince of Nghe An, dancing with fan and poetry to bless career and prosperity."
  ],
  [
    "Thần Vệ Quốc trấn giữ miền biên ải Bảo Hà - Lào Cai, ban lộc chiêu tài tấn bảo và quý nhân phù trợ.",
    "Guardian deity of the Bao Ha frontier, bestowing wealth, business success, and noble allies."
  ],
  [
    "Cơ sở dữ liệu: Supabase PostgreSQL (đang dùng DATABASE_URL — dữ liệu bền vững qua các lần deploy).",
    "Database: Supabase PostgreSQL (persistent across deployments)."
  ],
  [
    "Khí vận hanh thông, bước chân nhẹ nhàng. Tăng +8% điểm Tâm An khi hành lễ và tọa thiền trong ngày.",
    "Smooth energy and light footsteps. +8% Serenity bonus during rituals and meditation today."
  ],
  [
    "A Di Đà Phật, tín hiệu chốn thiền môn vừa chập chờn đôi chút. Con vui lòng hỏi lại giúp thầy nhé.",
    "Amitabha Buddha, the sanctuary connection flickered for a moment. Please kindly ask your question again."
  ],
  [
    "Nàng tiên nữ hầu cận Mẫu Thượng Ngàn, múa quạt lụa hái hoa rừng, ban duyên lành và niềm hoan hỷ.",
    "Celestial attendant of the Mother of Mountains, dancing with silk fans to bestow harmony and joy."
  ],
  [
    "Tài khí vượng phát, lộc chính và lộc phụ đều hanh thông; nên trích một phần làm việc thiện lành.",
    "Prosperous financial flow across main and side endeavors; share a portion in wholesome charity."
  ],
  [
    "Cách giải hạn tốt nhất chính là khởi tâm từ bi, làm việc thiện và nói lời hòa ái với mọi người.",
    "The best remedy for any star challenge is compassion, good deeds, and gentle speech."
  ],
  [
    "Nguyện đem công đức này, hồi hướng khắp tất cả, đệ tử và chúng sanh, đều trọn thành Phật đạo.",
    "May this merit be dedicated to all beings everywhere, that all may awaken together on the Buddha Path."
  ],
  [
    "Đại hội di sản cổ tự, đảm bảo ít nhất 1 thẻ Giác Ngộ hoặc Chân Như (Legendary) huyền thoại.",
    "Grand heritage collection pack guaranteeing at least 1 Epic or Legendary card."
  ],
  [
    "Game đang chạy Preprod (testnet); hãy chuyển Eternl sang Preprod trong phần Cài đặt → Mạng.",
    "Game is on Preprod (testnet); please switch Eternl to Preprod in Settings → Network."
  ],
  [
    "Bạn đã dùng hết 1 lượt miễn phí hôm nay cho Đài Tơ Duyên. Vui lòng thỉnh thêm lượt (50 MC)!",
    "You have used your daily free draw at the Red Thread Shrine. Please use an extra draw (50 MC)!"
  ],
  [
    "Đã khai đàn Đặc Cách thành công! Danh vị của bạn đã khắc lên Cuốn Thư Vàng trên Chiếu Hầu.",
    "Private ritual opened! Your name is inscribed on the Golden Scroll."
  ],
  [
    "Giao dịch được ghi nhận ở sổ cái PostgreSQL (Supabase), chưa được xác nhận trên Hydra L2.",
    "Transaction recorded in PostgreSQL (Supabase) ledger, not yet confirmed on Hydra L2."
  ],
  [
    "Tài chính cân bằng thu chi, nên giữ nguyên kế hoạch hiện tại và tránh chi tiêu ngẫu hứng.",
    "Balanced income and expenses; maintain your current plan and avoid impulse spending."
  ],
  [
    "Giữ tâm tịnh khẩu trước xung đột, không quyết định nóng vội khi cảm xúc đang căng thẳng.",
    "Keep calm speech during conflict and avoid hasty decisions when emotions run high."
  ],
  [
    "Tính năng Đúc NFT CIP-68 trên Cardano Preprod đang chuẩn bị ra mắt trong phiên bản tới!",
    "CIP-68 NFT Minting on Cardano Preprod is coming in the next release!"
  ],
  [
    "Bói duyên cặp đôi đồng tu, tính điểm tương hợp Bát Tự và trao tặng Bùa Chỉ Đỏ Uyên Ương",
    "Couple BaZi compatibility scoring, sacred poetry, and Red Thread Charm"
  ],
  [
    "Đạo hữu cần bước lại gần Bàn Xin Xăm & Pháp Bảo ngoài sân Chùa để thành tâm thỉnh quẻ.",
    "Please walk closer to the Divination Table in the courtyard to draw a fortune."
  ],
  [
    "Đệ nhất phúc tinh (Hỏa) — Ánh nhật quang chiếu rọi, công danh và quý nhân hanh thông.",
    "Supreme Blessing Star (Fire) — Bright sunlight brings career progress and noble allies."
  ],
  [
    "Thân tâm an thái, khí huyết lưu thông; duy trì giấc ngủ điều độ để giữ trọn sinh lực.",
    "Peaceful body and mind with smooth vitality; maintain regular sleep to preserve energy."
  ],
  [
    "Tinh thần minh mẫn, thể lực tốt; nên duy trì vận động nhẹ và thở chánh niệm mỗi ngày.",
    "Clear mind and good stamina; keep up light exercise and daily mindful breathing."
  ],
  [
    "Mở khóa vĩnh viễn trang phục hành hương truyền thống của 9 quốc gia Á Đông & Làng Mai",
    "Permanently unlock traditional pilgrim attire from 9 Asian & Plum Village traditions"
  ],
  [
    "Vui lòng nhập câu hỏi của bạn (tối thiểu 3 ký tự) hoặc chuyển sang chế độ Xin Nhanh.",
    "Please enter a question (at least 3 characters) or switch to Quick Draw."
  ],
  [
    "Đạo hữu cần bước lại gần Hòm Công Đức Tam Bảo ngoài sân Chùa để phát tâm cúng dường.",
    "Please walk closer to the Merit Box in the courtyard to make an offering."
  ],
  [
    "Bình tinh thử thách (Thổ) — Đề phòng tiểu nhân gièm pha, kiên định giữ tâm bất động.",
    "Testing Star (Earth) — Stay steadfast and unmoved by gossip."
  ],
  [
    "Bạn đã dùng hết 1 lượt miễn phí hôm nay cho môn này. Hãy chọn Lễ Phẩm hoặc MC Coin!",
    "You have used your daily free draw for this subject. Please select an Offering or MC Coin!"
  ],
  [
    "Bảo toàn ngân khố tối đa, tuyệt đối tránh vay mượn lớn hoặc đầu tư tất tay lúc này.",
    "Conserve your finances carefully and avoid heavy borrowing or all-in speculation now."
  ],
  [
    "Cơ thể cần được nghỉ ngơi và tái tạo năng lượng sau chuỗi ngày làm việc căng thẳng.",
    "Your body needs rest and renewal after busy workdays."
  ],
  [
    "Hơi thở vào, tâm tĩnh lặng. Hơi thở ra, miệng mỉm cười. — Thiền sư Thích Nhất Hạnh",
    "Breathing in, I calm body and mind. Breathing out, I smile. — Thich Nhat Hanh"
  ],
  [
    "Cần kiên nhẫn, chú ý nghỉ ngơi, nên đi khám định kỳ để chăm sóc sức khỏe khoa học.",
    "Stay patient, get proper rest, and schedule regular check-ups for scientific self-care."
  ],
  [
    "Phát tâm công đức tự nguyện (số MC tùy chọn) ghi danh bảng vàng công đức toàn chùa",
    "Make a voluntary MC offering and inscribe your name on the Sanctuary Merit Honor Roll"
  ],
  [
    "Biết đủ là giàu nhất. Giữ tâm chánh niệm sẽ tránh được muôn vàn cạm bẫy tài chính.",
    "Knowing contentment is the greatest wealth; mindfulness protects against financial pitfalls."
  ],
  [
    "Thực hành thiền thở sâu 15 phút mỗi ngày; buông bỏ những muộn phiền không đáng có.",
    "Practice 15 minutes of deep breathing meditation daily and release unnecessary worries."
  ],
  [
    "Cầu Quốc Thái Dân An · Gia Đạo Cát Tường · Tâm Khai Trí Sáng · Tài Lộc Hanh Thông",
    "May the nation prosper, families live in harmony, minds awaken in wisdom, and blessings flow"
  ],
  [
    "Chỉ mang tính giải trí — Triết lý di sản văn hóa dân gian & hướng dẫn chánh niệm.",
    "For entertainment only — Cultural heritage philosophy & mindfulness guidance."
  ],
  [
    "Khẩu thiệt tinh (Kim) — Cần giữ lời ăn tiếng nói hòa ái, tránh tranh cãi thị phi.",
    "Speech Star (Metal) — Speak gently and avoid unnecessary disputes."
  ],
  [
    "Có thử thách nhỏ nơi công sở, cần kiểm tra kỹ từng chi tiết và giữ tâm điềm tĩnh.",
    "Minor workplace challenges; double-check details and keep a calm mind."
  ],
  [
    "Cần kiên nhẫn, chú ý nghỉ ngơi, nên đi khám định kỳ và ưu tiên phục hồi thân tâm.",
    "Stay patient, rest well, schedule regular check-ups, and prioritize recovery of body and mind."
  ],
  [
    "Ám tinh (Thổ) — Tâm dễ suy tư lo lắng, nên năng tĩnh tọa và làm việc thiện lành.",
    "Shadow Star (Earth) — Prone to overthinking; practice meditation and good deeds."
  ],
  [
    "Giai đoạn củng cố nội lực và hoàn thiện việc cũ, chưa nên vội vàng thay đổi lớn.",
    "A time to consolidate inner strength and finish existing tasks rather than rushing major changes."
  ],
  [
    "Cần kiên nhẫn, chú ý nghỉ ngơi, nên đi khám định kỳ và tránh thức khuya quá sức.",
    "Be patient, prioritize rest, schedule regular check-ups, and avoid staying up late."
  ],
  [
    "Khai thông ngũ uẩn, đảm bảo sở hữu ít nhất 1 thẻ bài phẩm cấp Tinh Tấn trở lên.",
    "Awaken the five aggregates with at least 1 guaranteed Rare or higher heritage card."
  ],
  [
    "Bạn chưa có lễ phẩm này trong túi đồ. Hãy thỉnh tại Cửa Hàng hoặc chọn dùng MC!",
    "You do not have this offering in your bag. Purchase it in the Shop or use MC!"
  ],
  [
    "Đề phòng chi phí phát sinh hoặc chậm trễ thu hồi vốn; tạm hoãn đầu tư mạo hiểm.",
    "Watch for unexpected expenses or delayed returns; pause high-risk investments."
  ],
  [
    "Dễ nảy sinh hiểu lầm vì lời nói lúc mệt mỏi; hãy nhường một câu để giữ hòa khí.",
    "Misunderstandings may arise when tired; speak gently to preserve harmony."
  ],
  [
    "Lấy phòng thủ làm gốc, tập trung giữ vững phần việc cốt lõi và chờ thời cơ mới.",
    "Focus on steady defense and core responsibilities while awaiting a better opportunity."
  ],
  [
    "Vận may tài chính khởi sắc, những nỗ lực trước đây bắt đầu thu hoạch trái ngọt.",
    "Financial fortune rises as past efforts bear sweet fruit."
  ],
  [
    "Thích hợp cho sơ tâm hành giả bắt đầu sưu tập thẻ bài di sản cổ tự và kinh kệ.",
    "Ideal for novice pilgrims beginning their collection of 3D heritage temples and scriptures."
  ],
  [
    "Phúc lộc tinh (Thủy) — Tài vận khởi sắc, lưu ý cẩn trọng lời nói và sông nước.",
    "Fortune Star (Water) — Rising wealth; be mindful in speech and near water."
  ],
  [
    "Họ tên chỉ gồm chữ cái tiếng Việt có dấu, không chứa số, emoji hay ký hiệu lạ.",
    "Full name may only contain letters, spaces, hyphens, or apostrophes."
  ],
  [
    "Quý nhân nâng đỡ, mưu sự lớn dễ thành, uy tín cá nhân tỏa sáng trong tập thể.",
    "Supported by noble allies; major plans progress smoothly and personal credibility shines."
  ],
  [
    "Thu nhập ổn định và tăng trưởng đều, thuận lợi cho kế hoạch tích lũy dài hạn.",
    "Steady and growing income, favorable for long-term savings plans."
  ],
  [
    "Triều nguyên cát tinh (Mộc) — Bình an, nhân duyên tốt đẹp, sự nghiệp nảy nở.",
    "Auspicious Wood Star — Peace, harmonious relationships, and flourishing career."
  ],
  [
    "Sắc tức thị không, không tức thị sắc, thọ tưởng hành thức diệc phục như thị.",
    "Form is emptiness, emptiness is form; feeling, perception, volition, and consciousness are likewise thus."
  ],
  [
    "Nhân duyên hòa hợp, gia đạo đón tin vui ấm áp, đôi lứa thấu hiểu và sẻ chia.",
    "Harmonious relationships and warm family news, with mutual understanding and care."
  ],
  [
    "Duyên tình bình lặng, cần kiên nhẫn lắng nghe để bồi đắp sự gắn kết lâu dài.",
    "Calm relationships; practice patient listening to nurture long-term connection."
  ],
  [
    "Giao dịch chỉ nằm ở sổ cái cục bộ SQLite, chưa được xác nhận trên Hydra L2.",
    "Transaction stored in local SQLite ledger, not yet confirmed on Hydra L2."
  ],
  [
    "Nguyện cho tất cả chúng sinh không hận thù, không khổ đau, thân tâm an lạc.",
    "May all beings be free from enmity, free from affliction, and dwell in peace."
  ],
  [
    "Gặp thử thách cần lấy chữ Nhẫn làm đầu, bình tĩnh thì mọi việc đều êm xuôi.",
    "Meet challenges with patience first; calmness resolves all things smoothly."
  ],
  [
    "Vui lòng kết nối ví Cardano (góc phải trên) để thỉnh lộc MC vào tài khoản!",
    "Please connect your Cardano wallet (top right) to claim MC blessings!"
  ],
  [
    "Đã hoàn thành pháp hóa giải! Tâm trí bạn đã lấy lại sự cân bằng và an lạc.",
    "Remediation complete! Your mind has restored balance and peace."
  ],
  [
    "Cần thời gian bồi bổ cả về sức khỏe lẫn phước đức, tránh căng thẳng âu lo.",
    "Take time to nurture both health and merit, letting go of anxiety."
  ],
  [
    "Một câu nhịn chín câu lành. Khi tâm bình thì mọi sóng gió đều tự tan biến.",
    "One patient word brings nine blessings; when the mind is calm, every storm subsides."
  ],
  [
    "Nguyệt cung phúc tinh (Thủy) — Hỷ sự, tài lộc và gia đạo êm ấm thuận hòa.",
    "Lunar Blessing Star (Water) — Joyful news, prosperity, and warm family harmony."
  ],
  [
    "Công việc tiến triển đúng lộ trình, chăm chỉ bền bỉ ắt gặt hái thành quả.",
    "Work progresses on schedule; steady diligence will bear fruit."
  ],
  [
    "Mở khóa mô hình 3D cổ tự và triết lý kinh điển theo chuẩn metadata CIP-68",
    "Unlock 3D ancient temple models and classic Zen scriptures with CIP-68 metadata"
  ],
  [
    "Cần ký xác nhận ví trên HydraOne để xác thực tài khoản trước khi nạp MC.",
    "Please sign the wallet verification on HydraOne before topping up MC."
  ],
  [
    "Bình tinh phòng thủ (Hỏa) — Cần giữ tâm ôn hòa, tránh nóng nảy vội vàng.",
    "Defensive Star (Fire) — Keep a gentle mind and avoid haste."
  ],
  [
    "Cơ sở dữ liệu: SQLite cục bộ (fallback khi chưa cấu hình DATABASE_URL).",
    "Database: Local SQLite (fallback when DATABASE_URL is not set)."
  ],
  [
    "Làm sao hóa giải những hiểu lầm và khoảng cách hiện tại giữa hai người?",
    "How can we resolve current misunderstandings and distance between us?"
  ],
  [
    "Tâm sinh tắc chủng chủng pháp sinh, tâm diệt tắc chủng chủng pháp diệt.",
    "When mind arises, all dharmas arise; when mind ceases, all dharmas cease."
  ],
  [
    "Sức khỏe ổn định, lưu ý cân đối thời gian làm việc và nghỉ ngơi hợp lý.",
    "Stable health; balance work hours with proper rest."
  ],
  [
    "Xin hoan hỷ đợi tới Bước 5 (Ban Lộc Tứ Phủ) của giá đồng để thỉnh lộc!",
    "Please wait until Step 5 (Bestowing Blessings) to claim MC!"
  ],
  [
    "Làm thế nào để cân bằng giữa phát triển tài chính và giữ gìn phúc đức?",
    "How can I balance financial growth with cultivating merit and virtue?"
  ],
  [
    "Giai đoạn này bạn cần kiên nhẫn, chú ý nghỉ ngơi, nên đi khám định kỳ.",
    "During this period, stay patient, rest well, and schedule regular health check-ups."
  ],
  [
    "Vợ chồng đồng lòng tát biển Đông cũng cạn, kinh tế ngày càng khấm khá.",
    "United in heart, husband and wife build growing prosperity together."
  ],
  [
    "Nghi lễ Hầu Đồng 5 Giá (8 phút/buổi), Thỉnh Lộc MC và Mở Đàn Đặc Cách",
    "5-Stage Mediumship Ritual (8 min/session), MC Blessings & Private Rituals"
  ],
  [
    "Làm sao để dung hòa quan điểm nuôi dạy con giữa các thế hệ trong nhà?",
    "How can we harmonize parenting views across generations at home?"
  ],
  [
    "Thỉnh nhang trầm, hoa đăng, bánh oản và mâm ngũ quả dâng cúng Tam Bảo",
    "Acquire agarwood incense, lotus lanterns, temple cakes, and five-fruit trays for the Three Jewels"
  ],
  [
    "Khai Đàn Giờ Ngọ (11h00) · Cầu Quốc Thái Dân An · Bách Gia Hưởng Lộc",
    "Noon Ritual (11:00 AM) · National Peace & Shared Blessings"
  ],
  [
    "Làm sao giữ tâm bình an không mê tín trước những lời đồn về sao hạn?",
    "How can I stay peaceful and free from superstition regarding star omens?"
  ],
  [
    "Khi thời tiết giao mùa, gia đình cần lưu ý chăm sóc cơ thể thế nào?",
    "How should our family care for our health during seasonal changes?"
  ],
  [
    "Duyên lành đang được chuẩn bị cho bạn vào thời điểm thích hợp nhất.",
    "Auspicious connection is being prepared for you at the right moment."
  ],
  [
    "Trang phục hành hương 9 quốc gia, nhang trầm và lễ phẩm cúng dường",
    "Pilgrim attire from 9 traditions, agarwood incense, and sacred offerings"
  ],
  [
    "Gửi lời nguyện chánh niệm và kết nối cùng hành giả đang trực tuyến",
    "Share mindful wishes and connect with fellow pilgrims online"
  ],
  [
    "Hồ sơ Bát Tự đã xác nhận thành công! Đã mở khóa các môn thỉnh quẻ.",
    "BaZi profile confirmed! All divination subjects unlocked."
  ],
  [
    "Hai tuổi kết hợp vun đắp tài chính và xây dựng tổ ấm có thuận hòa?",
    "Will our two birth signs harmonize in building finances and a warm home?"
  ],
  [
    "Chế độ sinh hoạt và nghỉ ngơi của gia đình nên điều chỉnh thế nào?",
    "How should our family adjust daily routines and rest?"
  ],
  [
    "Hao tài tinh (Kim) — Cẩn trọng quản lý tiền bạc, giữ gìn sức khỏe.",
    "Wealth-Caution Star (Metal) — Manage finances prudently and care for your health."
  ],
  [
    "Tình cảm êm đềm, khúc mắc nhỏ được tháo gỡ nhờ lời nói chân thành.",
    "Gentle affection; minor misunderstandings dissolve through sincere words."
  ],
  [
    "Hãy ăn uống thanh đạm, ngủ đủ giấc và tập thở chánh niệm mỗi ngày.",
    "Eat wholesomely, sleep well, and practice mindful breathing daily."
  ],
  [
    "Mọi vận hạn ách tắc đều được hóa giải êm đẹp nhờ tâm đức tích lũy.",
    "Obstacles dissolve smoothly through accumulated virtue and mindfulness."
  ],
  [
    "Tôi nên buông bỏ chuyện cũ hay kiên nhẫn chờ đợi thêm một cơ hội?",
    "Should I let go of the past or patiently wait for another chance?"
  ],
  [
    "Khoản công nợ hoặc thanh toán đang chờ có sớm thu hồi được không?",
    "Will pending debts or receivables be recovered soon?"
  ],
  [
    "Phương pháp thiền thở nào phù hợp để giải tỏa căng thẳng mỗi tối?",
    "What breathing meditation suits releasing stress each evening?"
  ],
  [
    "Cách tu tập và làm việc thiện để nghênh cát tinh, giải hung tinh?",
    "How can mindful practice and good deeds welcome auspicious stars and dissolve challenges?"
  ],
  [
    "Bồ đề vốn không cây, gương sáng cũng chẳng đài. — Lục Tổ Huệ Năng",
    "Bodhi originally has no tree; the bright mirror also has no stand. — Sixth Patriarch Huineng"
  ],
  [
    "Luận giải chi tiết 4 khối & phương pháp chuyển hóa theo Seed ngày",
    "4-part detailed interpretation & mindful remedy by daily seed"
  ],
  [
    "Nguyện chúc đôi lứa thuận hòa, trăm năm gắn kết, an lạc tròn đầy.",
    "Wishing both of you lasting harmony, deep connection, and peace."
  ],
  [
    "Tùy chỉnh 6 kênh âm thanh thiên nhiên và pháp khí thời gian thực",
    "Customize 6 real-time spatial nature and dharma instrument channels"
  ],
  [
    "Trình duyệt không hỗ trợ sao chép ảnh. Hãy bấm \"Tải ảnh về máy\"!",
    "Clipboard image copy not supported. Please click \"Download PNG\"!"
  ],
  [
    "Làm thế nào để giữ lửa yêu thương và sự bình yên trong hôn nhân?",
    "How can we keep warmth, love, and peace alive in marriage?"
  ],
  [
    "Việc học tập và rèn luyện nhân cách của con cái sắp tới thế nào?",
    "How will our children’s learning and character growth progress?"
  ],
  [
    "Chuyến đi xa hoặc thay đổi công việc trong năm nay có thuận lợi?",
    "Will long travel or career changes go smoothly this year?"
  ],
  [
    "Năng lượng sinh học và sức đề kháng rất tốt, tinh thần minh mẫn.",
    "Strong vitality, immunity, and mental clarity."
  ],
  [
    "Vui lòng kết nối ví trên thanh Header của HydraOne để tiếp tục.",
    "Please connect your wallet in the HydraOne Header to continue."
  ],
  [
    "Bộ sưu tập cổ tự 3D, thuyết minh âm thanh và khai quang bằng MC",
    "3D heritage temples, audio narration, and gacha card packs"
  ],
  [
    "Gia đạo mong cầu tin vui con cái trong năm nay cần chuẩn bị gì?",
    "What should our family prepare while hoping for joyful news of a child this year?"
  ],
  [
    "Bí mật kỹ thuật thông gió tự nhiên bảo tồn mộc bản Chùa Hải Ấn.",
    "Natural ventilation engineering preserving the woodblocks of Haeinsa."
  ],
  [
    "Không gian thiền định bình yên giữa lòng thủ đô Seoul hiện đại.",
    "Peaceful Seon sanctuary in the heart of modern Seoul."
  ],
  [
    "). Trạng thái Debuff đã được gỡ bỏ và chuyển hóa thành bình an.",
    "). The debuff has been cleared and transformed into peace."
  ],
  [
    "Tâm nguyện cầu con cái và bình an gia đạo sắp được toại nguyện.",
    "Heartfelt wishes for children and family peace will soon be fulfilled."
  ],
  [
    "A Di Đà Phật, về điều con vừa hỏi, theo tài liệu của nhà chùa:",
    "Amitabha Buddha, regarding what you asked, according to the temple scriptures:"
  ],
  [
    "Làm sao để cải thiện giấc ngủ và phục hồi năng lượng mỗi ngày?",
    "How can I improve sleep quality and restore daily energy?"
  ],
  [
    "Thói quen sinh hoạt nào tôi cần thay đổi để sống khỏe lâu dài?",
    "What daily habits should I change for long-term vitality?"
  ],
  [
    "Sao chiếu mệnh năm nay của tôi tác động thế nào đến vận trình?",
    "How does my annual ruling star influence my path this year?"
  ],
  [
    "Mọi sự tùy duyên, giữ chánh niệm vững vàng trong từng hơi thở.",
    "All things flow naturally; maintain steady mindfulness in every breath."
  ],
  [
    "Tiếng nước sôi reo và bài học chánh niệm trong chén thiền trà.",
    "Simmering kettle and mindful presence in a bowl of Zen tea."
  ],
  [
    "Thời gian này tập trung học tập, phát triển sự nghiệp cá nhân.",
    "Focus on learning and personal career growth during this season."
  ],
  [
    "Tiền bạc tích lũy đều đặn, tránh xa các cạm bẫy đầu cơ rủi ro.",
    "Steady savings while avoiding risky speculation."
  ],
  [
    "Gieo quẻ 6 môn, luận giải theo chủ đề và hướng dẫn chánh niệm",
    "Draw across 6 traditional subjects with topic insights and mindful guidance"
  ],
  [
    "Kỳ thi hoặc việc học tập nâng cao sắp tới có đạt kết quả tốt?",
    "Will my upcoming exam or advanced studies achieve good results?"
  ],
  [
    "Trạng thái cân bằng thân - tâm - trí hiện tại của tôi ra sao?",
    "How is my current balance of body, heart, and mind?"
  ],
  [
    "Sự bình an và sức khỏe của cha mẹ, người thân trong gia đình?",
    "How is the peace and health of my parents and loved ones?"
  ],
  [
    "Tháng nào trong năm cần cẩn trọng lời ăn tiếng nói và đi lại?",
    "Which months require extra mindfulness in speech and travel?"
  ],
  [
    "Mỗi bước chân đi trên mặt đất là mỗi bước đi vào cõi tịnh độ.",
    "Every step upon the earth is a step into the Pure Land."
  ],
  [
    "Sự nghiệp hanh thông, động lực phấn đấu vì tương lai con trẻ.",
    "Smooth career inspired by building a bright future for your children."
  ],
  [
    "Vui lòng hoàn tất xác nhận hồ sơ Bát Tự trước khi thỉnh quẻ.",
    "Please confirm your BaZi profile before drawing a fortune."
  ],
  [
    "Việc nuôi dạy và đồng hành cùng con trẻ cần lưu tâm điều gì?",
    "What should we keep in mind when raising and accompanying our children?"
  ],
  [
    "Huyền thoại đôi tháp đá Đa Bảo và Thích Ca tại Phật Quốc Tự.",
    "Legend of the twin stone pagodas Dabotap and Seokgatap at Bulguksa."
  ],
  [
    "Hiếu kính với cha mẹ hai bên để tăng thêm phước báo tổ tiên.",
    "Honor parents on both sides to deepen ancestral blessings."
  ],
  [
    "Đầu tư sinh lời tốt, kinh doanh phát đạt, dòng tiền dồi dào.",
    "Profitable investments, thriving business, and strong cash flow."
  ],
  [
    "Tài chính vững vàng giúp đời sống tình cảm thêm phần an tâm.",
    "Financial stability brings peace of mind to family life."
  ],
  [
    "Làm việc chuyên cần, được cấp trên và đồng nghiệp tin tưởng.",
    "Diligent work earning trust from colleagues and leaders."
  ],
  [
    "Tâm trạng vui vẻ hòa ái, lan tỏa niềm an vui cho người thân.",
    "Joyful, gentle mood spreading peace to loved ones."
  ],
  [
    "Cúng dường tự nguyện bằng MC và lưu danh Bảng vàng công đức",
    "Voluntary MC donations recorded on the Sanctuary Merit Honor Roll"
  ],
  [
    "Ghi dấu mỗi ngày, nối thành chuỗi và nhận quà ở các cột mốc",
    "Mark your daily practice, build your streak, and claim milestone gifts"
  ],
  [
    "Vui lòng kết nối ví Eternl để sử dụng lễ phẩm trong túi đồ!",
    "Please connect your Eternl wallet to use offerings from your bag!"
  ],
  [
    "Nhân duyên giữa tôi và người ấy có tương hợp lâu dài không?",
    "Is the bond between me and my partner harmonious for the long term?"
  ],
  [
    "Gia đình hai bên và chuyện trăm năm sắp tới có được êm đẹp?",
    "Will both families and our future marriage plans go smoothly?"
  ],
  [
    "Tâm thế nào giúp hai vợ chồng an nhiên đón nhận duyên lành?",
    "What mindset helps a couple serenely welcome auspicious blessings?"
  ],
  [
    "Việc hợp tác làm ăn với đối tác hiện tại cần lưu ý điểm gì?",
    "What should I pay attention to when collaborating with current partners?"
  ],
  [
    "Hướng phát triển nghề nghiệp phụ để tăng thu nhập bền vững?",
    "What side career direction can build sustainable additional income?"
  ],
  [
    "Vận hạn tài chính và công việc dưới sao chiếu mệnh năm nay?",
    "How are finances and work affected under this year’s ruling star?"
  ],
  [
    "Con cái mang lại tài lộc và sinh khí hưng thịnh cho cha mẹ.",
    "Children bring joy, vitality, and prosperity to the home."
  ],
  [
    "Chú ý nghỉ ngơi điều độ, không tham công tiếc việc quá sức.",
    "Rest in moderation and avoid overworking."
  ],
  [
    "Tín vật thắt gút đồng tâm Nguyệt Lão chúc phúc lương duyên",
    "True-heart knot talisman blessed by the Matchmaker Deity"
  ],
  [
    "Công việc và dự định sự nghiệp sắp tới có thuận lợi không?",
    "Will my upcoming work and career plans go smoothly?"
  ],
  [
    "Vận khí kinh doanh và buôn bán trong giai đoạn này ra sao?",
    "How is my business and commercial fortune during this period?"
  ],
  [
    "Cách quản trị dòng tiền và phòng tránh thất thoát năm nay?",
    "How should I manage cash flow and prevent losses this year?"
  ],
  [
    "Gia đạo và bình an nội tâm trong năm có điểm gì cần lưu ý?",
    "What should I note regarding family and inner peace this year?"
  ],
  [
    "Hoa sen nở trong bùn nhơ mà không nhuốm mùi bùn trần gian.",
    "The lotus blooms in the mud yet remains untainted by it."
  ],
  [
    "Tiết kiệm tài chính chuẩn bị chu đáo cho thế hệ tương lai.",
    "Save prudently to prepare warmly for the next generation."
  ],
  [
    "Pháp luật quy định thế nào về hoạt động tôn giáo, lễ hội?",
    "What do regulations say about religious activities and festivals?"
  ],
  [
    "Quan Đệ Tam · Chầu Đôi · Ông Hoàng Mười · Cô Đôi · Cậu Bé",
    "Third Mandarin · Second Lady · Tenth Prince · Second Maiden · Young Prince"
  ],
  [
    "Quỹ Bách Gia đã đủ 2,500 MC và tự động Khai Đàn Hầu Đồng!",
    "Community Pool reached 2,500 MC and automatically opened the ritual!"
  ],
  [
    "Đang xác thực chữ ký ví HydraOne trước khi tạo đơn nạp...",
    "Verifying HydraOne wallet signature before creating order..."
  ],
  [
    "Chuyện tình cảm và nhân duyên đang mong cầu sẽ đi về đâu?",
    "Where is the relationship and connection I hope for heading?"
  ],
  [
    "Tài lộc dồi dào, kinh doanh buôn bán thu nhiều lợi nhuận.",
    "Abundant prosperity; business and trade yield generous returns."
  ],
  [
    "Người độc thân sắp gặp được đối tượng hòa hợp về tâm hồn.",
    "Single seekers will soon meet a kindred spirit."
  ],
  [
    "Cần cân bằng giữa công việc và nghỉ ngơi, tránh kiệt sức.",
    "Balance work and rest to prevent burnout."
  ],
  [
    "Tài lộc và kế hoạch tài chính hiện tại nên tiến hay thủ?",
    "Should I advance or conserve in my current financial plans?"
  ],
  [
    "Chuyến xuất hành hoặc thay đổi chỗ ở sắp tới có bình an?",
    "Will my upcoming journey or change of residence be safe and smooth?"
  ],
  [
    "Tình cảm mặn nồng son sắt, thấu hiểu và sẻ chia sâu sắc.",
    "Deep, steadfast affection with mutual understanding."
  ],
  [
    "Tập trung bồi dưỡng tài chính cá nhân, vững vàng tự chủ.",
    "Cultivate personal financial independence and steadiness."
  ],
  [
    "Chi tiêu điều độ, cùng nhau tích lũy xây dựng tương lai.",
    "Mindful spending and shared savings for the future."
  ],
  [
    "Khai mở 10 thẻ di sản · Bảo hiểm 1 thẻ Giác Ngộ (Epic+)",
    "Open 10 heritage cards · Guaranteed 1+ Epic card"
  ],
  [
    "Chiêu tài tấn bảo, thuận lợi đầu tư kinh doanh quý nhân",
    "Prosperity, smooth business ventures, and noble benefactors"
  ],
  [
    "Đã gửi giao dịch — đang chờ đưa vào block trên chuỗi...",
    "Transaction submitted — waiting for on-chain block inclusion..."
  ],
  [
    "Có nên mở rộng quy mô hoặc xuống vốn dự án mới lúc này?",
    "Should I expand operations or invest capital in a new project now?"
  ],
  [
    "Cách giữ tâm thanh tịnh trước áp lực công việc quá tải?",
    "How can I keep a serene mind amidst heavy work pressure?"
  ],
  [
    "Lễ thay y Phật Ngọc linh thiêng tại Hoàng Cung Bangkok.",
    "Sacred seasonal vestment ceremony of the Emerald Buddha in Bangkok."
  ],
  [
    "Tâm an vui vẻ, đôi bên cùng chăm sóc sức khỏe cho nhau.",
    "Joyful peace of mind as both partners care for each other’s health."
  ],
  [
    "Ký kết hợp đồng lớn, đối tác tin cậy, vị thế vững chắc.",
    "Major agreements signed with trusted partners and solid standing."
  ],
  [
    "Khai mở 5 thẻ di sản · Bảo hiểm 1 thẻ Tinh Tấn (Rare+)",
    "Open 5 heritage cards · Guaranteed 1+ Rare card"
  ],
  [
    "Đại chúng đồng tu hòa hợp · Đồng bộ mạng đa người chơi",
    "Harmonious Sangha · Real-time multiplayer sync"
  ],
  [
    "Vui lòng kết nối ví Cardano trước khi công đức Mở Đàn!",
    "Please connect your Cardano wallet before sponsoring a ritual!"
  ],
  [
    "Tiếng sỏi cào tĩnh lặng trong sân thiền viện Ryoan-ji.",
    "Quiet raked gravel in the courtyard of Ryoan-ji."
  ],
  [
    "Quẻ Tiền Tài: Tích Tiểu Thành Đại - Vững Như Bàn Thạch",
    "Wealth Fortune: Steady Accumulation"
  ],
  [
    "Chú ý giấc ngủ và thư giãn thần kinh sau giờ làm việc.",
    "Prioritize deep sleep and evening relaxation."
  ],
  [
    "Ngũ giới gồm những gì? Người tại gia giữ giới ra sao?",
    "What are the Five Precepts and how do laypeople practice them?"
  ],
  [
    "Hydra L2 được bật nhưng chưa kết nối được hydra-node.",
    "Hydra L2 is enabled but not connected to hydra-node."
  ],
  [
    "Vận trình bổn mạng và bình an trong tháng này ra sao?",
    "How is my overall destiny and peace of mind this month?"
  ],
  [
    "Bao giờ nhân duyên lành mới thực sự mỉm cười với tôi?",
    "When will auspicious love truly smile upon me?"
  ],
  [
    "Hòa khí vợ chồng và sự gắn kết tổ ấm hiện tại ra sao?",
    "How is our marital harmony and household bond at present?"
  ],
  [
    "Thuyết minh Đại Tự Todai-ji và Đại Phật Nara cổ kính.",
    "Narration on Todai-ji Temple and the Great Buddha of Nara."
  ],
  [
    "Nhất kỳ nhất hội, đương hạ tức thị, mạc đãi lai sinh.",
    "One encounter in a lifetime; cherish the present moment without waiting for tomorrow."
  ],
  [
    "Hơi thở chánh niệm tạo tác vòng tròn Enso tối thượng.",
    "Mindful breath shaping the Enso circle of wholeness."
  ],
  [
    "Phật ngọc an trụ, quốc thái dân an, vạn linh bảo bọc.",
    "Where the Emerald Buddha abides, the realm and people dwell in peace."
  ],
  [
    "Lời kinh rải tâm từ bằng tiếng Pali truyền cảm ấm áp.",
    "Warm Pali chanting radiating loving-kindness (Metta)."
  ],
  [
    "Hải ấn tam muội, ba lãng bất sinh, vạn tượng tề hiện.",
    "In Ocean Seal Samadhi, no waves arise and all phenomena appear clearly."
  ],
  [
    "Điển tích ngộ đạo uống nước sọ dừa của Đại sư Wonhyo.",
    "Story of Grand Master Wonhyo’s awakening of the One Mind."
  ],
  [
    "Công việc ổn định, tạo nền tảng vững chắc cho mái ấm.",
    "Stable work providing a solid foundation for your home."
  ],
  [
    "Gia đình cùng nhau tập thiền, đi bộ hít thở khí trời.",
    "Practice meditation and outdoor walks together as a family."
  ],
  [
    "Lắng nghe và nhường nhịn để giữ gìn hòa khí gia đình.",
    "Listen patiently and yield gently to keep family peace."
  ],
  [
    "Ký giao dịch bị từ chối hoặc thất bại trên HydraOne.",
    "Transaction signature was rejected or failed on HydraOne."
  ],
  [
    "Nhập câu hỏi tâm niệm (hệ thống tự động dò từ khóa):",
    "Enter your heartfelt question (auto-matches topic keywords):"
  ],
  [
    "Huyền thoại kiến trúc gác chuông Chùa Keo Thái Bình.",
    "Architectural legend of the Keo Pagoda Bell Tower in Thai Binh."
  ],
  [
    "Hành trình trẩy hội Chùa Hương linh thiêng non nước.",
    "Sacred spring pilgrimage to the Perfume Pagoda."
  ],
  [
    "Tỳ Lô Giá Na Phật quang phổ chiếu, bình đẳng đại từ.",
    "Vairocana Buddha’s light shines universally with boundless compassion."
  ],
  [
    "Vẻ đẹp vượt thời gian của Chùa Vàng Kinkakuji Kyoto.",
    "Timeless beauty of Kyoto’s Kinkaku-ji Golden Pavilion."
  ],
  [
    "Quẻ Sức Khỏe: Dược Sư Quán Chiếu - Tiêu Tai Diên Thọ",
    "Wellbeing Fortune: Medicine Buddha’s Light"
  ],
  [
    "Bấm phím [3] hoặc nhấp chuột để mở Di Sản & Cửa Hàng",
    "Press [3] or click to open Heritage & Shop"
  ],
  [
    "Đã ghi danh Mở Đàn Đặc Cách vào hàng chờ tiếp theo!",
    "Your Private Ritual sponsorship is queued for the next session!"
  ],
  [
    "Game đang chạy Mainnet; hãy chuyển ví sang Mainnet.",
    "Game is on Mainnet; please switch your wallet to Mainnet."
  ],
  [
    "Đã ký — đang phát tán giao dịch lên mạng Cardano...",
    "Signed — broadcasting transaction to Cardano network..."
  ],
  [
    "Cần kết nối ví Eternl để dùng lễ phẩm hoặc tiêu MC.",
    "Connect Eternl wallet to use offerings or spend MC."
  ],
  [
    "Gia đạo và hòa khí trong nhà thời gian tới thế nào?",
    "How will family harmony and household peace be in the coming time?"
  ],
  [
    "Tâm Bình Khí Hòa (Đã Hóa Giải Vận Hạn · +5% Tâm An)",
    "Balanced Mind & Qi (Challenge Resolved · +5% Serenity)"
  ],
  [
    "Phát Nguyện Hóa Giải (Tọa Thiền 432Hz / Cúng Dường)",
    "Mindful Remedy Vow (432Hz Meditation / Merit Offering)"
  ],
  [
    "Triết lý nhập thế tự do tự tại của Trúc Lâm Yên Tử.",
    "Engaged mindfulness philosophy of the Truc Lam Yen Tu Zen lineage."
  ],
  [
    "Chuông chiều ngân vang bên bảo tháp Chùa Bình Minh.",
    "Evening bells echoing beside the spire of Wat Arun."
  ],
  [
    "cần kiên nhẫn, chú ý nghỉ ngơi, nên đi khám định kỳ",
    "stay patient, rest well, and schedule regular health check-ups"
  ],
  [
    "Công danh thăng tiến rực rỡ, được quý nhân nâng đỡ.",
    "Bright career advancement supported by noble benefactors."
  ],
  [
    "Tinh thần sảng khoái, không có bệnh tật hiểm nghèo.",
    "Refreshed spirit and sound wellbeing."
  ],
  [
    "Giữ tâm lý thoải mái, yêu thương chăm sóc bản thân.",
    "Keep a relaxed heart and practice gentle self-care."
  ],
  [
    "Gia tộc có người nối dõi đức hạnh, dòng họ vẻ vang.",
    "Virtuous descendants bringing honor to the family."
  ],
  [
    "Quẻ Tiền Tài: Chiêu Tài Tấn Bảo - Lộc Phát Vô Cương",
    "Wealth Fortune: Abundant Prosperity"
  ],
  [
    "Năng lượng tràn đầy, làm việc hiệu quả và minh mẫn.",
    "Abundant energy, clear mind, and effective work."
  ],
  [
    "Tài sản được bảo toàn nguyên vẹn, hóa giải hao tài.",
    "Assets are preserved safely and financial leaks are resolved."
  ],
  [
    "Hạn chế tranh cãi nơi công sở, lấy chữ Hòa làm quý.",
    "Avoid workplace disputes and cherish harmony above all."
  ],
  [
    "Bấm phím [2] hoặc nhấp chuột để mở Thiền & Công Đức",
    "Press [2] or click to open Meditation & Merit"
  ],
  [
    "Kinh Dịch là gì? Có liên quan đến Phật giáo không?",
    "What is the I Ching, and how does it relate to Buddhism?"
  ],
  [
    "Phật giáo và tín ngưỡng thờ Mẫu khác nhau thế nào?",
    "How do Buddhism and Mother Goddess worship differ and harmonize?"
  ],
  [
    "Đang khởi tạo đơn hàng & dựng giao dịch Cardano...",
    "Creating order & building Cardano transaction..."
  ],
  [
    "Vui lòng kết nối ví để nhận MC và ghi nhận kỷ lục!",
    "Please connect your wallet to earn MC and record best times!"
  ],
  [
    "Bạn chưa có Hoa Đăng Cầu An. Hãy thỉnh ở Cửa Hàng.",
    "You do not have a Peace Lotus Lantern in your bag. Please purchase one in the Shop."
  ],
  [
    "Thân thể tráng kiện, khí huyết lưu thông sung túc.",
    "Strong vitality and harmonious energy flow."
  ],
  [
    "Gia đạo hưng vượng, con cháu hiếu thuận thảo hiền.",
    "Flourishing household with filial, virtuous children."
  ],
  [
    "Trong ấm ngoài êm, đón nhận nhiều tin vui mừng rỡ.",
    "Warmth within and peace without, welcoming joyful news."
  ],
  [
    "Vợ chồng thông cảm, san sẻ áp lực tâm lý với nhau.",
    "Mutual empathy and shared support between partners."
  ],
  [
    "Thỉnh Giá Đức Ông Trần Triều (Hưng Đạo Đại Vương)",
    "Invoke Lord Tran Hung Dao (Tran Dynasty)"
  ],
  [
    "Số dư không đủ 50 MC để thỉnh thêm lượt Tơ Duyên.",
    "Insufficient balance (50 MC required) for an extra Red Thread draw."
  ],
  [
    "Thân thể khỏe mạnh chính là tài sản quý giá nhất.",
    "A healthy body is the most precious treasure."
  ],
  [
    "Đi chùa lễ Phật nên chuẩn bị gì, ứng xử thế nào?",
    "How should one prepare and behave when visiting a Buddhist temple?"
  ],
  [
    "Hãy thử điều chỉnh bộ lọc Quốc gia hoặc Phẩm cấp",
    "Try adjusting the Country or Rarity filters"
  ],
  [
    "Khai đàn uy linh trừ tà, hộ quốc an dân định tâm",
    "Righteous protection, peace for the realm, and steadfast mind"
  ],
  [
    "Ví của bạn chưa có UTxO (ADA) nào để thanh toán.",
    "Your wallet has no UTxO (ADA) available for payment."
  ],
  [
    "Ví dụ: Tháng này mở cửa hàng có thuận lợi không?",
    "E.g., Will opening a shop this month go smoothly?"
  ],
  [
    "Chuông xoay 432Hz và vòng điều hòa hơi thở 4-4-6",
    "432Hz singing bowls and 4-4-6 mandala breath pacing"
  ],
  [
    "Vui lòng nhập Họ tên người thương / bạn đồng tu.",
    "Please enter your partner’s full name."
  ],
  [
    "Ý nghĩa biểu tượng Bánh Xe Pháp Luân linh thánh.",
    "Sacred symbolism of the Eight-Spoked Dharmachakra."
  ],
  [
    "Xin quẻ cầu an và chỉ dẫn chánh niệm trong ngày.",
    "Daily sacred fortune draw and mindfulness guidance."
  ],
  [
    "Tình duyên thắm thiết, gia đạo viên mãn bình an.",
    "Warm affection and peaceful, fulfilling family life."
  ],
  [
    "Gia đình hai bên thuận hòa, xóm giềng ngợi khen.",
    "Harmony between both families and neighbors."
  ],
  [
    "Gia đình ủng hộ, không nên chịu áp lực giục giã.",
    "Supportive family without rushing or pressure."
  ],
  [
    "Đón nhận sự chăm sóc và động viên từ người thân.",
    "Welcome care and encouragement from loved ones."
  ],
  [
    "Bấm phím [1] hoặc nhấp chuột để mở Bói Quẻ 6 Môn",
    "Press [1] or click to open Divination"
  ],
  [
    "Mọi bồ đoàn đã có người. Chờ hoặc quay lại sau.",
    "All mats are occupied. Please wait or return later."
  ],
  [
    "Nguyện cầu gia đạo bình an, thân tâm thường lạc",
    "May our family be blessed with peace and lasting serenity"
  ],
  [
    "Thuyết minh di tích ngàn năm Thăng Long Hà Nội.",
    "Narration on the millennium heritage of Thang Long, Hanoi."
  ],
  [
    "Tụng kinh Bát Nhã trầm hùng thanh tịnh tâm can.",
    "Resonant Heart Sutra chanting that purifies the mind."
  ],
  [
    "[economy] Không tải được danh mục MC từ server:",
    "[economy] Failed to load MC catalog from server:"
  ],
  [
    "Thường xuyên cầu an, vun bồi phúc đức gia tiên.",
    "Offer prayers for peace and nurture family virtue."
  ],
  [
    "Hiện bạn đang tịnh tu một mình nơi chánh điện.",
    "You are currently practicing solo in the sanctuary."
  ],
  [
    "Nguyệt Lão Thắt Chỉ Hồng · Duyên Khởi Trăm Năm",
    "Red Thread of Destiny · Century of Harmony"
  ],
  [
    "Mở rộng quy mô thuận lợi, đồng nghiệp kính nể.",
    "Smooth expansion and respected teamwork."
  ],
  [
    "Hậu phương vững chắc giúp sự nghiệp thăng hoa.",
    "A peaceful home empowers career flourishing."
  ],
  [
    "Tài vận đang ở thế tích lũy an toàn, bền vững.",
    "Finances are in a safe, sustainable accumulation phase."
  ],
  [
    "Cẩn trọng tiền bạc, quản lý chi tiêu chặt chẽ.",
    "Be prudent with finances and manage spending carefully."
  ],
  [
    "Vì sao có ngày mồng một và ngày rằm lên chùa?",
    "Why do people visit the temple on New Moon and Full Moon days?"
  ],
  [
    "Thời lượng 8 phút · 5 Giá Thỉnh Lộc Thánh Ban",
    "8-minute ritual · 5 Sacred Blessing Stages"
  ],
  [
    "Vui lòng kết nối ví Eternl trước khi tiêu MC!",
    "Please connect your Eternl wallet before spending MC!"
  ],
  [
    "Lòng thành dâng Phật • Nguyện thân tâm an lạc",
    "Sincere offering to the Buddha • May body and mind be at peace"
  ],
  [
    "Nam mô Hương Tích Cực Lạc Quan Thế Âm Bồ Tát.",
    "Homage to Avalokiteshvara Bodhisattva of Huong Tich Grotto."
  ],
  [
    "Pháp luân thường chuyển, bát chánh đạo thông.",
    "The Wheel of Dhamma turns unceasingly along the Eightfold Path."
  ],
  [
    "Tiền tài sung túc, có của ăn của để vững bền.",
    "Plentiful wealth and steady, lasting savings."
  ],
  [
    "Thân thể an khang, thai kỳ bình an thuận lợi.",
    "Peaceful wellbeing and smooth nurturing."
  ],
  [
    "Vượt qua sóng gió thị phi, công việc ổn định.",
    "Overcoming gossip and obstacles toward stable work."
  ],
  [
    "Thỉnh Quẻ Tơ Duyên (Nguyệt Lão Thắt Chỉ Hồng)",
    "Consult Red Thread Love Altar"
  ],
  [
    "Đổi giới tính nhân vật Nam / Nữ (Phím tắt: G)",
    "Switch Male / Female character (Hotkey: G)"
  ],
  [
    "Đã giải trừ phong ấn toàn bộ bảo vật di sản!",
    "All sacred heritage cards have been unsealed!"
  ],
  [
    "Nhập lời nguyện hoặc chia sẻ cùng đồng tu...",
    "Enter a prayer or share with fellow pilgrims..."
  ],
  [
    "Thở vào tâm tĩnh lặng, thở ra miệng mỉm cười",
    "Breathing in, I calm body and mind; breathing out, I smile"
  ],
  [
    "Số lượng mua tối thiểu là 2 ADA (số nguyên).",
    "Minimum purchase is 2 ADA (whole number)."
  ],
  [
    "Nhập họ và tên đầy đủ (ví dụ: Nguyễn Văn An)",
    "Enter full name (e.g., Nguyen Van An)"
  ],
  [
    "Áo Tấc lụa lam Hà Đông dệt viền chỉ vàng kim",
    "Ha Dong indigo silk ceremonial robe with gold trim"
  ],
  [
    "Hồ sơ bản thân và người thương không hợp lệ.",
    "Your profile and partner profile are invalid."
  ],
  [
    "Bồi bổ thân thể, kết hợp nghỉ ngơi tĩnh tâm.",
    "Nourish the body and combine with peaceful rest."
  ],
  [
    "Rung Đại Hồng Chung & Mở Rương Báu (+100 MC)",
    "Ring Great Bell & Claim Chest (+100 MC)"
  ],
  [
    "Danh sách đồng tu đang trực tuyến & Pháp đàm",
    "Online pilgrims & Dharma talk"
  ],
  [
    "Thiền là gì? Người mới nên bắt đầu thế nào?",
    "What is meditation, and how should a beginner start?"
  ],
  [
    "Singing Bowl 432Hz · Hòa nhập cùng nhịp thở",
    "432Hz Singing Bowl · Harmonize with your breath"
  ],
  [
    "Vào trong Đại Hùng Bảo Điện để tìm bồ đoàn.",
    "Enter the Main Sanctuary Hall to find a mat."
  ],
  [
    "Chọn Mức Công Đức Góp Quỹ (Tối thiểu 50 MC)",
    "Select Contribution Amount (Min 50 MC)"
  ],
  [
    "Đã sao chép ảnh vào bộ nhớ tạm (Clipboard)!",
    "Copied image to clipboard!"
  ],
  [
    "Tọa Thiền Chánh Niệm hoặc Dâng Hương Cầu An",
    "Mindful Meditation or Peace Incense Offering"
  ],
  [
    "Phật quốc trang nghiêm, kim cang thạch trụ.",
    "Solemn Buddha Land anchored by enduring stone pagodas."
  ],
  [
    "Đôi bên hòa hợp, tìm được tri kỷ đồng điệu.",
    "Mutual harmony and kindred companionship."
  ],
  [
    "Chi tiêu hợp lý cho sức khỏe và dinh dưỡng.",
    "Invest wisely in nourishment and wellbeing."
  ],
  [
    "Quốc gia hiện tại (Nhấn phím 1-9 để chuyển)",
    "Current country (Press 1-9 to switch)"
  ],
  [
    "Tần số an định tâm trí, xua tan căng thẳng",
    "Calming resonance that dissolves tension"
  ],
  [
    "Lời Khấn Nguyện Ghi Danh Lên Cuốn Thư Vàng",
    "Prayer Inscribed on the Golden Scroll"
  ],
  [
    "Thẻ Di Sản: Chùa Phật Ngọc (Wat Phra Kaew)",
    "Heritage Card: Temple of the Emerald Buddha"
  ],
  [
    "Quẻ Dâng Sao: Tịnh Tâm Chuyển Hóa Niên Hạn",
    "Nine-Star Fortune: Mindful Transformation"
  ],
  [
    "Hầu đồng 5 Giá (8p), Thỉnh Lộc MC & Mở Đàn",
    "5-Stage Ritual (8m), Blessings & Sponsorship"
  ],
  [
    "Thầy đang đứng ngoài thềm Hiên Tiền Điện.",
    "The Abbot is standing at the Front Veranda steps."
  ],
  [
    "Nhân quả và nghiệp hiểu thế nào cho đúng?",
    "How should we properly understand Karma and Cause & Effect?"
  ],
  [
    "Hoặc nhập số ADA tùy ý (tối thiểu 2 ADA):",
    "Or enter custom ADA amount (min 2 ADA):"
  ],
  [
    "Danh sách câu hỏi chiêm bốc theo từng môn",
    "Curated questions for each subject"
  ],
  [
    "Vui lòng chọn Ngày sinh của người thương.",
    "Please select your partner’s birth date."
  ],
  [
    "Tâm an vạn sự an. Tâm bình thế giới bình.",
    "When the mind is peaceful, all things are peaceful."
  ],
  [
    "Hiểu lầm được tháo gỡ, gia đạo thuận hòa.",
    "Misunderstandings dissolve into family harmony."
  ],
  [
    "Hỏi đáp Phật pháp, Nghi lễ & Văn hóa chùa",
    "Buddhist wisdom, etiquette & temple lore"
  ],
  [
    "Số dư Merit Coin trong game (Bấm để nạp)",
    "In-game Merit Coin balance (Click to top up)"
  ],
  [
    "Nhập câu hỏi để dò từ khóa quy về chủ đề",
    "Enter your own question for keyword topic matching"
  ],
  [
    "Giao thoa thanh lịch thời Đường hiện đại",
    "Elegant modern Tang-inspired silk ceremonial wear"
  ],
  [
    "Mộng mị tương liên, thiên niên bất dịch.",
    "Interlocking timber joints, unshaken for a thousand years."
  ],
  [
    "Bình minh phá hiểu, tuệ nhật quang minh.",
    "Dawn breaks through darkness as the sun of wisdom shines."
  ],
  [
    "Bệnh tật tiêu trừ, hồi phục nhanh chóng.",
    "Ailments recede and recovery is swift."
  ],
  [
    "Mở Đàn & Thỉnh Lộc Nhà Hầu Đồng (Tứ Phủ)",
    "Enter Four Palaces Ritual Shrine"
  ],
  [
    "6 kênh âm cảnh không gian thời gian thực",
    "6 real-time spatial audio channels"
  ],
  [
    "Tứ diệu đế là gì? Vì sao gọi là \"diệu\"?",
    "What are the Four Noble Truths, and why are they called Noble?"
  ],
  [
    "Hoặc Khai Mở Vấn Hầu Riêng Ngay Bây Giờ",
    "Or Sponsor a Private Ritual Session Now"
  ],
  [
    "Đức Ông Trần Triều (Hưng Đạo Đại Vương)",
    "Lord Tran Hung Dao (Grand Commander)"
  ],
  [
    "(Thao tác quá nhanh, hãy đợi một chút.)",
    "(Too many requests; please wait a moment.)"
  ],
  [
    "Rút quẻ tức thì theo Bát Tự đã xác nhận",
    "Instant draw based on your confirmed BaZi"
  ],
  [
    "Thanh khiết hương trầm chùa cổ Nhật Bản",
    "Pure sandalwood fragrance of ancient Kyoto temples"
  ],
  [
    "Hoàng kim chiếu ảnh, tịnh độ hiện tiền.",
    "Golden light reflected on still water; the Pure Land appears right here."
  ],
  [
    "PHÁP HÓA GIẢI VẬN HẠN & TỌA THIỀN 432HZ",
    "MINDFUL REMEDY & 432HZ MEDITATION"
  ],
  [
    "Họ và tên không được vượt quá 50 ký tự.",
    "Full name must not exceed 50 characters."
  ],
  [
    "Tình cảm vợ chồng thêm gắn kết keo sơn.",
    "Deeper bond and affection between husband and wife."
  ],
  [
    "Quẻ Dâng Sao: Bắc Đẩu Thất Tinh Hộ Mệnh",
    "Nine-Star Fortune: Seven Stars Protection"
  ],
  [
    "Chú ý giữ ấm cơ thể và đi lại cẩn thận.",
    "Keep warm and travel with care."
  ],
  [
    "Làm sao để bớt lo âu, giữ tâm bình an?",
    "How can I reduce anxiety and keep a peaceful mind?"
  ],
  [
    "Hoa đăng lung linh trôi theo dòng nước",
    "Glowing lotus lantern drifting on water"
  ],
  [
    "Gởi lời nguyện chúc an lành... (Enter)",
    "Send a peaceful blessing... (Enter)"
  ],
  [
    "Mưa rơi êm đềm trên mái chùa rêu phong",
    "Gentle rain falling on mossy temple eaves"
  ],
  [
    "Âm vang tần số thiêng liêng Om 136.1Hz",
    "Sacred 136.1Hz Om chant resonance"
  ],
  [
    "- Thở ra từ từ bằng miệng trong 6 giây",
    "- Exhale slowly through the mouth for 6 seconds"
  ],
  [
    "Ngũ Giá Tứ Phủ Truyền Thống (Mặc định)",
    "Traditional 5-Stage Four Palaces (Default)"
  ],
  [
    "Hiện tại Điện Thờ chưa mở vấn hầu nào.",
    "No ritual session is currently active at the Shrine."
  ],
  [
    "Đã gửi lên Hydra L2, đang chờ snapshot",
    "Submitted to Hydra L2, awaiting snapshot"
  ],
  [
    "Vui lòng kiểm tra lại thông tin hồ sơ.",
    "Please check your profile information."
  ],
  [
    "Đen chàm Zen tối giản đan nón rơm Kasa",
    "Minimalist indigo-black Zen samue with woven kasa hat"
  ],
  [
    "Xám khói thanh tịnh thiền phái Tào Khê",
    "Serene smoke-grey Jogye Seon ceremonial hanbok"
  ],
  [
    "Đèn sen lung linh thắp sáng ước nguyện",
    "Glowing lotus lantern illuminating heartfelt wishes"
  ],
  [
    "Hoa quả tươi ngũ sắc kính dâng Tam Bảo",
    "Five-colored fresh fruit tray offered to the Three Jewels"
  ],
  [
    "Linh Khí Đại Cát (+15% Công Đức Thiền)",
    "Great Auspicious Aura (+15% Meditation Merit)"
  ],
  [
    "Tâm Bình Khí Hòa (Trạng thái cân bằng)",
    "Balanced Mind & Qi (Harmonious State)"
  ],
  [
    "Thử Thách Nghịch Cảnh (-10% Tập Trung)",
    "Adversity Challenge (-10% Focus)"
  ],
  [
    "Liên hoa xuất thủy, bất nhiễm trần ai.",
    "The lotus rises from water, unstained by worldly dust."
  ],
  [
    "Tri túc thường lạc, bất cầu thập toàn.",
    "Knowing sufficiency brings lasting joy."
  ],
  [
    "Thẻ Di Sản: Chùa Một Cột (Diên Hựu Tự)",
    "Heritage Card: One Pillar Pagoda"
  ],
  [
    "Đóa Sen Ngàn Năm Thăng Long · Việt Nam",
    "Millennium Lotus of Thang Long · Vietnam"
  ],
  [
    "Đỉnh Cao Kiến Trúc Đá Silla · Hàn Quốc",
    "Silla Stone Architecture · South Korea"
  ],
  [
    "Không khí gia đình ấm cúng, hòa thuận.",
    "Warm and harmonious family atmosphere."
  ],
  [
    "Thời gian, Đồ họa, Góc nhìn & Ngôn ngữ",
    "Time, Graphics, Camera & Language"
  ],
  [
    "Công đức và từ thiện đúng cách là gì?",
    "What is the true meaning of merit and mindful charity?"
  ],
  [
    "Chuông gió Furin Á Đông ngân vang nhẹ",
    "Softly chiming East Asian Furin wind bell"
  ],
  [
    "Có vật cản, thử lại hoặc tự bước tới.",
    "Obstacle ahead; try again or walk manually."
  ],
  [
    "Chưa ghi được việc lành, thử lại sau.",
    "Could not record deed; please try again later."
  ],
  [
    "Vải thô mộc mạc từng bước chân an lạc",
    "Rustic linen attire for peaceful walking meditation"
  ],
  [
    "Chưa thể xác nhận hoàn thành leo núi.",
    "Unable to verify Cloud Peak completion."
  ],
  [
    "Thiền Phái Trúc Lâm Yên Tử · Việt Nam",
    "Truc Lam Yen Tu Zen · Vietnam"
  ],
  [
    "Quẻ Cầu Tự: Quan Âm Tống Tử Ban Phước",
    "Offspring Fortune: Guanyin’s Blessing"
  ],
  [
    "Nhấp hoặc bấm phím M để mở Sơ đồ Chùa",
    "Click or press M to open Sanctuary Map"
  ],
  [
    "Hoặc chọn nhanh câu niệm / kệ thiền:",
    "Or quick-select a mindful verse:"
  ],
  [
    "Bộ Trộn Âm Thanh Thiền 3D Không Gian",
    "3D Spatial Zen Soundscape Mixer"
  ],
  [
    "- Giữ hơi thở nhẹ nhàng trong 4 giây",
    "- Hold your breath gently for 4 seconds"
  ],
  [
    "Bấm Ngồi thiền lại để chọn chỗ khác.",
    "Click Meditate again to pick another mat."
  ],
  [
    "Chế độ khách. Kết nối ví để nhận MC.",
    "Guest mode. Connect wallet to earn MC."
  ],
  [
    "Vị trí: Hướng Đông Đại Hùng Bảo Điện",
    "Location: East of the Main Sanctuary Hall"
  ],
  [
    "Non-Custodial — Không lưu khóa riêng",
    "Non-Custodial — Private keys never leave your wallet"
  ],
  [
    "Saffron vàng nghệ hoàng gia Thái Lan",
    "Royal Thai saffron-gold monastic robe"
  ],
  [
    "Đại Phật nhân gian thêu hoa sen ngọc",
    "Humanistic Buddhist robe embroidered with jade lotus"
  ],
  [
    "Họ và tên phải có tối thiểu 2 ký tự.",
    "Full name must be at least 2 characters."
  ],
  [
    "Vui lòng chọn giới tính Nam hoặc Nữ.",
    "Please select Male or Female gender."
  ],
  [
    "Quẻ Số 01: Thuần Càn (Bát Thuần Càn)",
    "Hexagram 01: The Creative (Qian)"
  ],
  [
    "Ăn uống lành mạnh, sức khỏe dẻo dai.",
    "Healthy nourishment and resilient stamina."
  ],
  [
    "Gia đạo bình an, đón nhận điềm lành.",
    "Peaceful household welcoming auspicious signs."
  ],
  [
    "Nhấp vào cảnh để tiếp tục điều khiển",
    "Click on the scene to resume control"
  ],
  [
    "Nhấp để xem bảng phím tắt điều khiển",
    "Click to view control hotkeys"
  ],
  [
    "Hiến chương & Nội quy chùa (GHPGVN)",
    "Sangha Charter & Temple Rules"
  ],
  [
    "Hành trì thân giáo — Phím tắt 1 - 6",
    "Mindful body gestures — Hotkeys 1 - 6"
  ],
  [
    "Thân tâm bất động, hơi thở tự nhiên",
    "Still body and mind, natural breath"
  ],
  [
    "Dòng nước thanh lương Shishi-odoshi",
    "Refreshing stream and bamboo water clapper"
  ],
  [
    "- Hít vào sâu bằng mũi trong 4 giây",
    "- Inhale deeply through the nose for 4 seconds"
  ],
  [
    "Đã ghi nhận. Kết nối ví để nhận MC.",
    "Recorded. Connect wallet to receive MC."
  ],
  [
    "Đang hiện diện tại Chiếu Hầu Tứ Phủ",
    "Present at the Four Palaces Ritual Hall"
  ],
  [
    "Trình Tự 5 Giá Đồng (8 Phút / Buổi)",
    "5-Stage Mediumship Sequence (8 Min / Session)"
  ],
  [
    "Hãy bấm \"+ Nạp\" trên thanh công cụ!",
    "Click \"+ Top Up\" in the top bar!"
  ],
  [
    "Lộc Duyên Lành & Hòa Hợp Nhân Duyên",
    "Blessing of Harmony & Auspicious Bonds"
  ],
  [
    "Chính Khí Hộ Thân & Trừ Tà Định Tâm",
    "Righteous Protection & Steadfast Spirit"
  ],
  [
    "Lễ Thánh Giáng (Tung Khăn Phủ Diện)",
    "Sacred Descent (Unveiling the Red Scarf)"
  ],
  [
    "Không thể thực hiện công đức mở đàn",
    "Unable to process ritual sponsorship"
  ],
  [
    "Chuỗi về nửa, bạn vẫn đang đi tiếp.",
    "Streak halved gently; you are still on the path."
  ],
  [
    "Tỏa làn khói trầm thơm ngát 30 phút",
    "Releases fragrant agarwood incense smoke for 30 minutes"
  ],
  [
    "Chưa thể bắt đầu thử thách leo núi.",
    "Unable to start the Cloud Peak climb right now."
  ],
  [
    "Bạch tùng cổ thụ, đô thị thiền tâm.",
    "Ancient white pine, a tranquil Zen heart within the city."
  ],
  [
    "Thẻ Di Sản: Phật Quốc Tự (Bulguksa)",
    "Heritage Card: Bulguksa Temple"
  ],
  [
    "Nhấp vào cảnh để bắt đầu điều khiển",
    "Click on the scene to start moving"
  ],
  [
    "Nghe chuông tại Lầu Đại Hồng Chung",
    "Visit the Great Bell Tower"
  ],
  [
    "Thắp hương tại Đỉnh Hương Sân Chùa",
    "Visit the Courtyard Incense Burner"
  ],
  [
    "Lộc Công Danh, Khoa Bảng & Tài Lộc",
    "Blessing of Career, Scholarship & Fortune"
  ],
  [
    "Đang chờ bạn ký xác nhận giao dịch",
    "Waiting for you to sign the"
  ],
  [
    "Vải dạ viền gấm Tây Tạng tuyết sơn",
    "Himalayan wool chuba trimmed with Tibetan brocade"
  ],
  [
    "Thanh Phong Cát Tường (+8% Tâm An)",
    "Auspicious Breeze (+8% Serenity)"
  ],
  [
    "Tâm Động Vọng Niệm (-5% Tập Trung)",
    "Restless Thoughts (-5% Focus)"
  ],
  [
    "Viên đồng thái hư, vô khiếm vô dư.",
    "Complete like vast space, lacking nothing and nothing in excess."
  ],
  [
    "Quẻ Tơ Duyên: Nguyệt Lão Se Chỉ Đỏ",
    "Red Thread Fortune: Bound by the Matchmaker"
  ],
  [
    "Quẻ Sức Khỏe: Điều Thân Dưỡng Tánh",
    "Wellbeing Fortune: Restoring Balance"
  ],
  [
    "Mở Hòm Công Đức (ADA / Cúng Dường)",
    "Open Merit Box (ADA / Donate)"
  ],
  [
    "Cổ phục 9 nước, nhang trầm, lễ vật",
    "9-country attire, incense & offerings"
  ],
  [
    "10 cổ tự mini, âm cảnh, NFT CIP-68",
    "Sacred temples, audio lore & CIP-68 NFT"
  ],
  [
    "Lưu ý thêm giữa các truyền thống:",
    "Additional note across traditions:"
  ],
  [
    "Hiên Tiền Điện, hỏi đáp Phật pháp",
    "Front Veranda · Dharma Q&A"
  ],
  [
    "Con muốn thưa hỏi thầy điều gì...",
    "Ask the Venerable Abbot a question..."
  ],
  [
    "Khai mở 1 nhân duyen di sản cổ tự",
    "Unseal 1 sacred temple heritage card"
  ],
  [
    "Vườn Đá Khô Thiền Viện Karesansui",
    "Karesansui Dry Landscape Zen Garden"
  ],
  [
    "Thân tâm an lạc, vạn sự cát tường",
    "Peaceful body and mind, auspiciousness in all things"
  ],
  [
    "Mỗi bước chân nở một đóa sen vàng",
    "Every footstep blooms a golden lotus"
  ],
  [
    "Chánh Điện đã kín toàn bộ bồ đoàn",
    "All meditation mats in the Main Hall are occupied"
  ],
  [
    "Có vật cản, hãy tự bước vào điện.",
    "Path blocked; please walk into the hall manually."
  ],
  [
    "Lộc Trí Tuệ & Thuận Buồm Xuôi Gió",
    "Blessing of Wisdom & Smooth Sailing"
  ],
  [
    "Lộc Kinh Doanh, Đầu Tư & Quý Nhân",
    "Blessing of Commerce, Investment & Benefactors"
  ],
  [
    "Đang chờ đủ xác nhận trên chuỗi (",
    "Waiting for required on-chain confirmations ("
  ],
  [
    "Đơn hàng kết thúc với trạng thái:",
    "Order finished with status:"
  ],
  [
    "VẠN CẢNH CHÙA · VẠN CẢNH THIỀN TỰ",
    "VAN CANH PAGODA · ZEN SANCTUARY"
  ],
  [
    "🪷 LỜI KHUYÊN DUNG HÒA CHÁNH NIỆM",
    "🪷 MINDFUL HARMONY ADVICE"
  ],
  [
    "— Sinh nhập, vượng khí hanh thông",
    "— Inward generation, flourishing energy"
  ],
  [
    "Quẻ Tơ Duyên: Hoa Nở Đợi Gió Đông",
    "Red Thread Fortune: Blossoms Awaiting the Spring Breeze"
  ],
  [
    "Tai qua nạn khỏi, đi lại bình an.",
    "Safe travels and protection from mishaps."
  ],
  [
    "Chuông xoay & Điều tức chánh niệm",
    "Singing bowls & 4-4-6 breathing"
  ],
  [
    "Con xin phép chắp tay chào thầy.",
    "I respectfully bow in farewell, Venerable Abbot."
  ],
  [
    "VẠN CẢNH THIỀN TỰ · DI SẢN CỔ TỰ",
    "VAN CANH SANCTUARY · HERITAGE CARDS"
  ],
  [
    "Khai Quang Thần Khí Di Sản Cổ Tự",
    "Unseal Sacred Heritage Cards"
  ],
  [
    "KHẨU Ý THANH TỊNH // SANGHA CHAT",
    "MINDFUL SPEECH // SANGHA CHAT"
  ],
  [
    "Mỗi bước chân nở một đóa hoa sen",
    "Every footstep blooms a lotus flower"
  ],
  [
    "Đã đạt giới hạn công đức hôm nay",
    "Daily merit limit reached"
  ],
  [
    "Chưa xác nhận được, thử lại sau.",
    "Could not verify; please try again later."
  ],
  [
    "Lễ Khai Đàn Giờ Ngọ (11:00 Trưa)",
    "Noon Ritual Opening (11:00 AM)"
  ],
  [
    "Chọn Giá Đồng Tâm Nguyện Chủ Đạo",
    "Select Primary Ritual Dedication"
  ],
  [
    "Lộc Sức Khỏe & Sinh Khí Đại Ngàn",
    "Blessing of Vitality & Forest Energy"
  ],
  [
    "Gửi giao dịch lên mạng thất bại:",
    "Failed to submit transaction:"
  ],
  [
    "Chưa nhận được quà, thử lại sau.",
    "Could not claim reward; please try again later."
  ],
  [
    "Ngày tháng năm sinh (Dương lịch)",
    "Date of Birth (Solar Calendar)"
  ],
  [
    "Y đỏ phù sa đất Phật Tứ Động Tâm",
    "Sacred earth-crimson attire of the Four Holy Sites"
  ],
  [
    "Lễ phẩm trang nghiêm thời Nguyễn",
    "Solemn royal temple cake offering"
  ],
  [
    "— đang chờ xác nhận trên chuỗi (",
    "— waiting for on-chain confirmations ("
  ],
  [
    "CĂN CỨ DỊCH LÝ & NGŨ HÀNH BÁT TỰ",
    "I CHING & FIVE-ELEMENT BAZI BASIS"
  ],
  [
    "LỜI KHUYÊN HÀNH TRÌ & CHÁNH NIỆM",
    "MINDFUL PRACTICE & GUIDANCE"
  ],
  [
    "Thẻ Di Sản: Chùa Vàng Kinkaku-ji",
    "Heritage Card: Kinkaku-ji Golden Pavilion"
  ],
  [
    "Thỉnh Hoa Đăng Cầu An (Cửa Hàng)",
    "Get Peace Lantern (Shop)"
  ],
  [
    "Sơ đồ Thiền Tự, hướng Bắc ở trên",
    "Sanctuary Map, North up"
  ],
  [
    "Tâm Duyên, Sen Vàng, Cardano ADA",
    "Micro-donations & Cardano ADA"
  ],
  [
    "Bảo hiểm 1 thẻ Tinh Tấn (Rare+)",
    "Guaranteed 1+ Rare (Tinh Tan) Card"
  ],
  [
    "Bảo hiểm 1 thẻ Giác Ngộ (Epic+)",
    "Guaranteed 1+ Epic (Giac Ngo) Card"
  ],
  [
    "Bạn đang ở bên ngoài Chánh Điện",
    "You are currently outside the Main Hall"
  ],
  [
    "Nhịp thở 4-4-6. Viên mãn nhận +",
    "4-4-6 breath. Complete to earn +"
  ],
  [
    "Chưa viên mãn nên chưa nhận MC.",
    "Session incomplete; no MC awarded."
  ],
  [
    "Ngày nghỉ đã giữ chuỗi cho bạn.",
    "Weekly rest day preserved your streak."
  ],
  [
    "Chưa ghi được dấu, thử lại sau.",
    "Could not mark streak; please try again later."
  ],
  [
    "Số dư còn lại sau khi xác nhận:",
    "Remaining balance after confirmation:"
  ],
  [
    "Ví dụ: Trần Thị Mai, Lê Minh...",
    "E.g., Tran Thi Mai, Le Minh..."
  ],
  [
    "Đang tải cảnh giới thiền môn...",
    "Loading sacred sanctuary..."
  ],
  [
    "Hồ sơ người thương không hợp lệ",
    "Invalid partner profile"
  ],
  [
    "Thẻ Di Sản: Cư Trần Lạc Đạo Phú",
    "Heritage Card: Dwelling in the World with Joy in the Dharma"
  ],
  [
    "Dâng Hương Tam Bảo (Chánh Điện)",
    "Offer Incense at Main Altar"
  ],
  [
    "Đăng Ký Leo Núi (Lượt Miễn Phí)",
    "Start Mountain Climb (Free Daily)"
  ],
  [
    "Thử Thách Leo Núi (5 MC / Lượt)",
    "Mountain Climb Challenge (5 MC)"
  ],
  [
    "Các tông phái & Thiền Trúc Lâm",
    "Buddhist Schools & Truc Lam Zen"
  ],
  [
    "Phật giáo & Tín ngưỡng Thờ Mẫu",
    "Buddhism & Mother Goddess Worship"
  ],
  [
    "Không tìm thấy thẻ bài phù hợp",
    "No matching heritage cards found"
  ],
  [
    "Xác suất ngẫu nhiên 4 bậc hiếm",
    "Random draw across 4 rarity tiers"
  ],
  [
    "Chùa Phật Ngọc (Wat Phra Kaew)",
    "Temple of the Emerald Buddha (Wat Phra Kaew)"
  ],
  [
    "Hoa sen bừng nở dưới bước chân",
    "Lotus blossoms beneath your footsteps"
  ],
  [
    "Bấm Ngồi thiền để tìm bồ đoàn.",
    "Click Meditate to find a mat."
  ],
  [
    "Đợi cảnh tải xong rồi thử lại.",
    "Wait for the scene to load and try again."
  ],
  [
    "Thỉnh Giá Ông Hoàng Bảy Bảo Hà",
    "Invoke Seventh Prince of Bao Ha"
  ],
  [
    "Giao dịch hợp lệ trên Hydra L2",
    "Valid transaction on Hydra L2"
  ],
  [
    "Số ADA nạp tối thiểu là 2 ADA.",
    "Minimum top-up amount is 2 ADA."
  ],
  [
    "Đang chờ xác nhận trên chuỗi (",
    "Waiting for on-chain confirmations ("
  ],
  [
    "Lời Khuyên Dung Hòa Chánh Niệm",
    "Mindful Harmony Advice"
  ],
  [
    "Bổn Mạng & Tổng Quan Vận Trình",
    "Destiny & General Outlook"
  ],
  [
    "Đối sánh Ngũ Hành Cung - Mệnh:",
    "Trigram-Destiny Element Comparison:"
  ],
  [
    "— Khắc nhập, thử thách nội tâm",
    "— Inward overcoming, inner resilience needed"
  ],
  [
    "Vui lòng điền thông tin hồ sơ.",
    "Please fill in your profile details."
  ],
  [
    "Gia đình sung túc, hưng vượng.",
    "Prosperous and thriving household."
  ],
  [
    "Dâng Hương Đại Đỉnh (Sân Chùa)",
    "Offer Incense at Courtyard Burner"
  ],
  [
    "Bật hoặc tắt âm thanh thiền tự",
    "Mute or unmute sanctuary audio"
  ],
  [
    "Dâng lễ tại Đại Hùng Bảo Điện",
    "Visit the Main Sanctuary Hall"
  ],
  [
    "Pháp luật Tín ngưỡng & Lễ hội",
    "Law on Belief & Festivals"
  ],
  [
    "Công đức & Từ thiện minh bạch",
    "Transparent Merit & Charity"
  ],
  [
    "Kiệt Tác Gỗ Thần Vũ Cổ Truyền",
    "Masterpiece of Traditional Timber Joinery"
  ],
  [
    "Bảo Tháp Ánh Sáng Chao Phraya",
    "Spire of Light on the Chao Phraya"
  ],
  [
    "Thiền Sư Wonhyo (Nguyên Hiểu)",
    "Zen Master Wonhyo"
  ],
  [
    "Bấm phím 1 - 6 hoặc nhấp chọn",
    "Press keys 1 - 6 or click to perform"
  ],
  [
    "Lộc Hỷ Tín, May Mắn & Khởi Sự",
    "Blessing of Good News, Luck & New Beginnings"
  ],
  [
    "Ban Lộc Tứ Phủ (Thỉnh Lộc MC)",
    "Bestowing Sacred Blessings (Claim MC)"
  ],
  [
    "Thánh Thăng (Xe Giá Hồi Cung)",
    "Sacred Ascent (Return to Palace)"
  ],
  [
    "Chuẩn CIP-30 / CIP-8 Verified",
    "CIP-30 / CIP-8 Verified"
  ],
  [
    "Chưa có giao dịch nạp MC nào.",
    "No MC top-up transactions yet."
  ],
  [
    "Thẻ Xem Trước Dữ Liệu Tự Tính",
    "Calculated BaZi Preview"
  ],
  [
    "2. Người Thương / Bạn Đồng Tu",
    "2. Partner / Beloved"
  ],
  [
    "Đã nhận Bùa Chỉ Đỏ Uyên Ương!",
    "Received Mandarin Duck Red Thread Charm!"
  ],
  [
    "Đã xóa toàn bộ hồ sơ cá nhân.",
    "Personal profile cleared."
  ],
  [
    "Không thể thực hiện công đức.",
    "Unable to process donation."
  ],
  [
    "Không thể mở gói thẻ lúc này.",
    "Unable to open card pack right now."
  ],
  [
    "Không thể mở khóa thẻ di sản.",
    "Unable to unlock heritage card."
  ],
  [
    "Đã hoàn thành pháp hóa giải (",
    "Completed mindful remedy ("
  ],
  [
    "Triết Lý Thiền Trà · Nhật Bản",
    "Zen Tea Philosophy · Japan"
  ],
  [
    "Đồng bộ ví từ HydraOne Header",
    "Sync wallet from HydraOne Header"
  ],
  [
    "Thầy Trụ Trì (Hiên Tiền Điện)",
    "Temple Abbot (Front Veranda)"
  ],
  [
    "Đại Lễ Sóc Vọng Mồng 1 Tháng",
    "Lunar New Moon Festival · Month"
  ],
  [
    "Đại Lễ Vọng Nguyệt Rằm Tháng",
    "Lunar Full Moon Festival · Month"
  ],
  [
    "Tứ vô lượng tâm & Chánh niệm",
    "Four Immeasurables & Mindfulness"
  ],
  [
    "Đại Tạng Kinh Bát Vạn Bản Gỗ",
    "Tripitaka Koreana Woodblocks"
  ],
  [
    "Kính chào đồng tu chánh niệm",
    "Respectfully greet fellow pilgrims"
  ],
  [
    "Đang dẫn bước vào Chánh Điện",
    "Walking into the Main Hall"
  ],
  [
    "Cần vào bên trong Chánh Điện",
    "Please enter the Main Hall"
  ],
  [
    "Viên mãn thời khóa tọa thiền",
    "Meditation session completed"
  ],
  [
    "Lộc Hầu Đồng đã nhận hôm nay",
    "Ritual blessings claimed today"
  ],
  [
    "Thượng Ngàn / Bảo Hà Lào Cai",
    "Highlands · Bao Ha (Lao Cai)"
  ],
  [
    "PostgreSQL · Sổ cái Supabase",
    "PostgreSQL · Supabase Ledger"
  ],
  [
    "Đang kiểm tra cơ sở dữ liệu…",
    "Checking database…"
  ],
  [
    "Đang kiểm tra chế độ sổ cái…",
    "Checking ledger mode…"
  ],
  [
    "Đã phát hiện tiện ích Eternl",
    "Eternl extension detected"
  ],
  [
    "Chưa cài đặt tiện ích Eternl",
    "Eternl extension not installed"
  ],
  [
    "(chưa gồm phí mạng ~0.2 ADA)",
    "(excluding ~0.2 ADA network fee)"
  ],
  [
    "Không rõ giờ sinh (Mặc định)",
    "Unknown birth hour (Default)"
  ],
  [
    "Độc Thân Cầu Duyên (1 Người)",
    "Single Love Seeker (1 Person)"
  ],
  [
    "Muốn so khớp Bát Tự cặp đôi?",
    "Want to compare Couple BaZi Compatibility?"
  ],
  [
    "Điện Thờ Tứ Phủ & Trần Triều",
    "Four Palaces & Tran Dynasty Shrine"
  ],
  [
    "Pháp Đàm & Đồng Tu Hiện Diện",
    "Sangha Chat & Online Pilgrims"
  ],
  [
    "Gieo quẻ (Thêm lượt hôm nay)",
    "Extra Fortune Draw Today"
  ],
  [
    "Không thể thỉnh quẻ lúc này.",
    "Unable to draw fortune right now."
  ],
  [
    "📜 THƠ TƠ DUYÊN THIÊNG LIÊNG",
    "📜 SACRED RED THREAD POEM"
  ],
  [
    "— Sinh xuất, hao khí trợ lực",
    "— Outward generation, supportive energy"
  ],
  [
    "Khai Quang Thẻ Bài Di Sản 3D",
    "Unseal 3D Heritage Temple Cards"
  ],
  [
    "Thẻ Di Sản: Nhất Kỳ Nhất Hội",
    "Heritage Card: Ichigo Ichie"
  ],
  [
    "Lộc Uyển Tự Kyoto · Nhật Bản",
    "Deer Garden Temple Kyoto · Japan"
  ],
  [
    "Bảo Vật Hoàng Gia · Thái Lan",
    "Royal Treasure · Thailand"
  ],
  [
    "Quẻ Số 14: Hỏa Thiên Đại Hữu",
    "Hexagram 14: Great Possession (Da You)"
  ],
  [
    "Thưa chuyện với Thầy Trụ Trì",
    "Speak with the Abbot"
  ],
  [
    "Cửa Hàng Pháp Bảo & Cổ Phục",
    "Sanctuary Attire & Offerings Shop"
  ],
  [
    "Chắp tay chào tạm biệt thầy",
    "Bow and bid farewell to the Abbot"
  ],
  [
    "Đóng khung trò chuyện (ESC)",
    "Close chat drawer (ESC)"
  ],
  [
    "Đóa Sen Ngàn Năm Thăng Long",
    "Millennium Lotus of Thang Long"
  ],
  [
    "Quốc Bảo Hoàng Gia Thái Lan",
    "Royal National Treasure of Thailand"
  ],
  [
    "Bánh Xe Chánh Pháp Vận Hành",
    "Turning of the Noble Truths"
  ],
  [
    "Đỉnh Cao Kiến Trúc Đá Silla",
    "Pinnacle of Silla Stone Architecture"
  ],
  [
    "Tâm hương dâng cúng Tam Bảo",
    "Heartfelt incense offering to the Three Jewels"
  ],
  [
    "ĐỒNG TU ĐANG CÙNG CHIÊM BÁI",
    "PILGRIMS CURRENTLY ONLINE"
  ],
  [
    "Nguyện cầu quốc thái dân an",
    "May the nation prosper and all people live in peace"
  ],
  [
    "Không thể bắt đầu tọa thiền",
    "Cannot start meditation"
  ],
  [
    "Có lỗi xảy ra, xin thử lại.",
    "An error occurred; please try again."
  ],
  [
    "Không thể thỉnh lộc lúc này",
    "Unable to claim blessing right now"
  ],
  [
    "Tự động đồng bộ số dư L1/L2",
    "Auto-sync L1/L2 balance"
  ],
  [
    "Thơ Nguyệt Lão Thiêng Liêng",
    "Sacred Red Thread Poem"
  ],
  [
    "Hoặc nhập số MC cúng dường:",
    "Or enter custom MC donation:"
  ],
  [
    "Hình tướng Hành Giả của bạn",
    "Your Pilgrim Appearance"
  ],
  [
    "Điều hướng phân hệ thiền tự",
    "Sanctuary Module Navigation"
  ],
  [
    "Sổ Tu Tập Chuỗi Ngày An Lạc",
    "Mindful Practice Streak Journal"
  ],
  [
    "Không thể gieo quẻ lúc này.",
    "Unable to draw fortune right now."
  ],
  [
    "Không thể xuất ảnh chia sẻ:",
    "Unable to export share image:"
  ],
  [
    "Samue Thiền Tăng & Nón Kasa",
    "Zen Monk Samue & Kasa Straw Hat"
  ],
  [
    "Kết nối ví Cardano (Eternl)",
    "Connect Cardano Wallet (Eternl)"
  ],
  [
    "Cài đặt hiển thị & Góc nhìn",
    "Display, Camera & Language"
  ],
  [
    "Phím tắt điều khiển & Chuột",
    "Keyboard & Mouse Controls"
  ],
  [
    "Bộ Trộn Âm Cảnh Không Gian",
    "3D Spatial Soundscape Mixer"
  ],
  [
    "Thập thiện & Giới xuất gia",
    "Ten Wholesome Actions & Monastic Precepts"
  ],
  [
    "Hướng dẫn sinh hoạt Pagoda",
    "Pagoda Sanctuary Guide"
  ],
  [
    "Chùa Một Cột (Diên Hựu Tự)",
    "One Pillar Pagoda (Dien Huu Temple)"
  ],
  [
    "Thiền Phái Trúc Lâm Yên Tử",
    "Truc Lam Yen Tu Zen School"
  ],
  [
    "Từ Bi Quán (Metta Bhavana)",
    "Loving-Kindness Meditation (Metta Bhavana)"
  ],
  [
    "Đồng tu một cõi thanh tịnh",
    "Fellow pilgrims in the peaceful sanctuary"
  ],
  [
    "Nhịp mõ trầm ấm gõ đều đặn",
    "Warm, steady wooden fish temple rhythm"
  ],
  [
    "Hồng Bào Đỏ Thẫm Giáp Vàng",
    "Crimson Robe & Golden Armor"
  ],
  [
    "· Hydra L2 chưa sẵn sàng (",
    "· Hydra L2 not ready ("
  ],
  [
    "Danh hiệu Hành Giả Bền Tâm",
    "Title: Steadfast Pilgrim"
  ],
  [
    "Thẻ Bài Song Duyên Kỷ Niệm",
    "Commemorative Couple Card"
  ],
  [
    "Tổng tiền công đức thực tế",
    "Total Verified Merit"
  ],
  [
    "Hãy bấm \"Nạp MC\" bên trên!",
    "Click \"Top Up MC\" above!"
  ],
  [
    "— Khí vận bình ổn, hòa hợp",
    "— Balanced and harmonious energy"
  ],
  [
    "— Khắc xuất, nhiều hao tổn",
    "— Outward overcoming, requires conservation"
  ],
  [
    "Tọa Thiền Chánh Niệm 432Hz",
    "432Hz Mindful Meditation"
  ],
  [
    "Quẻ Cầu Tự: Đắp Bồi Cội Rễ",
    "Offspring Fortune: Nourishing the Roots"
  ],
  [
    "Nhà Hầu Đồng (Điện Tứ Phủ)",
    "Four Palaces Ritual Shrine"
  ],
  [
    "Pháp Phục Trắng Tinh Khôi",
    "White Ceremonial Robe"
  ],
  [
    "Hỏi đáp cùng Thầy Trụ Trì",
    "Dharma Q&A with the Abbot"
  ],
  [
    "Văn hóa đi chùa & Nghi lễ",
    "Temple Etiquette & Rituals"
  ],
  [
    "Tiến Độ Khai Quang Di Sản",
    "Heritage Collection Progress"
  ],
  [
    "Lộc Uyển Tự - Cố Đô Kyoto",
    "Deer Garden Temple · Ancient Kyoto"
  ],
  [
    "Chùa Bình Minh (Wat Arun)",
    "Temple of Dawn (Wat Arun)"
  ],
  [
    "Tứ Vô Lượng Tâm Theravada",
    "Theravada Four Immeasurables"
  ],
  [
    "Trái Tim Thiền Tông Seoul",
    "Heart of Seon Buddhism in Seoul"
  ],
  [
    "Ngũ thể đầu địa cung kính",
    "Full reverent prostration"
  ],
  [
    "Chọn thời lượng tọa thiền",
    "Select meditation duration"
  ],
  [
    "Bồ đoàn vừa có người ngồi",
    "Mat just taken"
  ],
  [
    "Quan Lớn Đệ Tam Thoải Phủ",
    "Third Grand Mandarin of the Water Palace"
  ],
  [
    "Đã xác nhận trên Hydra L2",
    "Confirmed on Hydra L2"
  ],
  [
    "Hydra L2 đang chạy (Head:",
    "Hydra L2 active (Head:"
  ],
  [
    "Thẻ ảnh kết quả quẻ (PNG)",
    "Fortune Result Card (PNG)"
  ],
  [
    "Đang Khai Quẻ Tơ Duyên...",
    "Drawing Red Thread Fortune..."
  ],
  [
    "Chưa có dữ liệu Bảng Vàng",
    "No Honor Roll entries yet"
  ],
  [
    "Mức công đức tối thiểu là",
    "Minimum merit donation is"
  ],
  [
    "Thỉnh Lễ Vật & Nhang Trầm",
    "Acquire Offerings & Incense"
  ],
  [
    "Cả nhà khỏe mạnh bình an.",
    "The whole family enjoys health and peace."
  ],
  [
    "Hội Thiền Định Tâm 432Hz",
    "432Hz Mindful Meditation"
  ],
  [
    "Dạo quanh Hồ Sen Bát Nhã",
    "Walk around the Lotus Pond"
  ],
  [
    "Nhân vật tự đi vào điện.",
    "Your pilgrim is walking into the hall."
  ],
  [
    "Chưa nhận được thưởng MC",
    "Could not claim MC reward"
  ],
  [
    "Xác nhận Công Đức Mở Đàn",
    "Confirm Ritual Sponsorship"
  ],
  [
    "Nhạc Phủ (Miền Rừng Núi)",
    "Forest Palace (Mountain Realm)"
  ],
  [
    "Ông Hoàng Mười (Nghệ An)",
    "Tenth Sacred Prince (Nghe An)"
  ],
  [
    "Hoàng Y (Vàng Hoàng Kim)",
    "Imperial Gold Vestment"
  ],
  [
    "vào Quỹ Bách Gia Mở Đàn!",
    "to the Community Ritual Pool!"
  ],
  [
    "Không thể xử lý đơn hàng",
    "Unable to process order"
  ],
  [
    "Ngồi thiền trọn một thời",
    "Complete one meditation session"
  ],
  [
    "Chọn câu hỏi chiêm bốc (",
    "Select a divination question ("
  ],
  [
    "Chọn mức công đức nhanh:",
    "Quick-select donation amount:"
  ],
  [
    "Nguyệt Lão thắt chỉ hồng",
    "Red Thread of Destiny"
  ],
  [
    "Hanbok Durumagi & Mũ Gat",
    "Seon Durumagi Hanbok & Gat Hat"
  ],
  [
    "Sao Chiếu Mệnh niên vận:",
    "Annual Ruling Star:"
  ],
  [
    "Thả Hoa Đăng Cầu An (Có ",
    "Release Lotus Lantern (Owned "
  ],
  [
    "không tồn tại trên lịch.",
    "does not exist on the calendar."
  ],
  [
    "Thỉnh Cổ Phục 9 Quốc Gia",
    "Unlock Attire from 9 Traditions"
  ],
  [
    "Bấm để tự động bước tới:",
    "Click to walk automatically to:"
  ],
  [
    "Tổng công đức toàn chùa",
    "Total Sanctuary Merit"
  ],
  [
    "Bát chánh đạo & Tam bảo",
    "Noble Eightfold Path & Three Jewels"
  ],
  [
    "Đại Phật Vĩ Đại Xứ Nara",
    "Great Vairocana Buddha of Nara"
  ],
  [
    "Nhất Kỳ Nhất Hội (一期一会)",
    "Ichigo Ichie (One Time, One Meeting)"
  ],
  [
    "Phật Quốc Tự (Bulguksa)",
    "Bulguksa Temple of the Buddha Land"
  ],
  [
    "Đồng Tu Đang Trực Tuyến",
    "Online Pilgrims"
  ],
  [
    "Quy tắc nhịp thở 4-4-6:",
    "4-4-6 Breathing Rhythm:"
  ],
  [
    "quay mặt lên tôn tượng.",
    "facing the Buddha statue."
  ],
  [
    "Lịch Sóc Vọng (Âm Lịch)",
    "Lunar Festival Schedule"
  ],
  [
    "Thiện Tín Vừa Góp Quỹ (",
    "Recent Contributors ("
  ],
  [
    "Địa Phủ (Đất Nghệ Tĩnh)",
    "Earth Palace (Nghe Tinh Land)"
  ],
  [
    "Múa Đồng & Hát Chầu Văn",
    "Sacred Dance & Chau Van Chanting"
  ],
  [
    "Bản Đền Tứ Phủ Vạn Cảnh",
    "Van Canh Four Palaces Shrine"
  ],
  [
    "ADA trên ví HydraOne...",
    "ADA transaction in HydraOne..."
  ],
  [
    "Dấu đầu tiên đã vào sổ.",
    "First mindful day recorded in your journal."
  ],
  [
    "Hôm nay đã ghi dấu rồi.",
    "Already marked for today."
  ],
  [
    "Đối chiếu trước khi lưu",
    "Verify before saving"
  ],
  [
    "Đài Tơ Duyên Nguyệt Lão",
    "Red Thread Matchmaking Shrine"
  ],
  [
    "Áo Lam Cổ Phục & Nón Lá",
    "Traditional Lam Robe & Conical Hat"
  ],
  [
    "Pháp Phục Lụa Singapore",
    "Singapore Tang Silk Dharma Attire"
  ],
  [
    "Không thể mua vật phẩm.",
    "Unable to purchase item."
  ],
  [
    "Cúng dường Hòm Công Đức",
    "Donate to Merit Box"
  ],
  [
    "Khai quang thẻ di sản \"",
    "Unlock heritage card \""
  ],
  [
    "Lượt miễn phí, lên đỉnh",
    "Free attempt — climb to the peak!"
  ],
  [
    "ĐÀI TƠ DUYÊN NGUYỆT LÃO",
    "RED THREAD MATCHMAKING SHRINE"
  ],
  [
    "Cúng Dường Hòm Công Đức",
    "Donate to Sanctuary Merit Box"
  ],
  [
    "Góc nhìn thứ nhất (FPP)",
    "First-Person (FPP)"
  ],
  [
    "Nam Hành Giả (Tóc ngắn)",
    "Male Pilgrim (Short hair)"
  ],
  [
    "Đang hiện con trỏ chuột",
    "Cursor visible"
  ],
  [
    "Dâng hương ngày mùng 1",
    "New-moon incense offering"
  ],
  [
    "Mâm Ngũ Quả Cúng Dường",
    "Five-Fruit Offering Tray"
  ],
  [
    "Điển Tích Cổ Tự (Lore)",
    "Temple Lore"
  ],
  [
    "Chỉ mang tính giải trí",
    "For cultural entertainment only"
  ],
  [
    "Bước qua Cổng Tam Quan",
    "Walk through Tam Quan Gate"
  ],
  [
    "Con muốn hỏi điều khác",
    "I would like to ask something else"
  ],
  [
    "Vô thường & Duyên khởi",
    "Impermanence & Dependent Origination"
  ],
  [
    "Đệ Nhất Động Nam Thiên",
    "First Grotto Under the Southern Sky"
  ],
  [
    "Triết Lý Thiền Trà Đạo",
    "Zen Way of Tea Philosophy"
  ],
  [
    "Nhắn gửi lời pháp đàm:",
    "Send a Dharma message:"
  ],
  [
    "Tâm bình thế giới bình",
    "When the mind is at peace, the world is at peace"
  ],
  [
    "Tiếng mưa rơi mái chùa",
    "Rain on temple roof"
  ],
  [
    "MC, đã chạm trần ngày.",
    "MC (daily cap reached)."
  ],
  [
    "Không đến được bồ đoàn",
    "Could not reach mat"
  ],
  [
    "Dâng Hương Thỉnh Thánh",
    "Incense Invocation"
  ],
  [
    "Thỉnh lộc thành công +",
    "Claimed blessing +"
  ],
  [
    "SQLite · Sổ cái cục bộ",
    "SQLite · Local Ledger"
  ],
  [
    "Chọn gói ADA nạp nhanh",
    "Quick-select ADA top-up package"
  ],
  [
    "Họ và tên người thương",
    "Partner Full Name"
  ],
  [
    "Ngày sinh (Dương lịch)",
    "Birth Date (Solar)"
  ],
  [
    "Thắt Chỉ Hồng Khai Quẻ",
    "Tie Red Thread & Draw"
  ],
  [
    "Mỗi ngày một việc lành",
    "Three Daily Good Deeds"
  ],
  [
    "Pháp Phục Nâu Làng Mai",
    "Plum Village Brown Practitioner Robe"
  ],
  [
    "Khăn Quàng Dhoti Bồ Đề",
    "Bodhi Crimson Dhoti & Shawl"
  ],
  [
    "Bình Tinh · Trung tính",
    "Neutral Star · Balanced"
  ],
  [
    "Bắt đầu ở hòm chân núi",
    "Start at the base chest"
  ],
  [
    "Thông tin chưa hợp lệ.",
    "Invalid profile information."
  ],
  [
    "Bói Quẻ 6 Môn & Cầu An",
    "6-Subject Sacred Divination"
  ],
  [
    "ĐƯỜNG LÊN ĐỈNH PHÙ VÂN",
    "SACRED PEAK CLIMB"
  ],
  [
    "Thỉnh Gói Thẻ (Gacha)",
    "Open Card Packs"
  ],
  [
    "Xem Mặt Sau (Kinh Kệ)",
    "Flip Card (Scripture)"
  ],
  [
    "Lượt miễn phí hôm nay",
    "Daily free draw"
  ],
  [
    "Số MC muốn cúng dường",
    "MC amount to donate"
  ],
  [
    "Chuông Đại Hồng Chung",
    "Great Temple Bell"
  ],
  [
    "Thầy đang suy ngẫm...",
    "The Abbot is contemplating..."
  ],
  [
    "Gói Bát Nhã Hoàng Kim",
    "Golden Prajna Pack"
  ],
  [
    "Viên Mãn & Tính Không",
    "Completeness & Emptiness"
  ],
  [
    "Pháp Luân Chuyển Tạng",
    "Wheel of the Dhamma (Dharmachakra)"
  ],
  [
    "Phong Linh Chuông Gió",
    "Eastern Wind Chimes"
  ],
  [
    "Tụng Niệm Phạn / Pali",
    "Sanskrit / Pali Chanting"
  ],
  [
    "THỜI LƯỢNG THIỀN ĐỊNH",
    "MEDITATION DURATION"
  ],
  [
    "Cảnh 3D chưa sẵn sàng",
    "3D scene not ready"
  ],
  [
    "Thoải Phủ (Miền Nước)",
    "Water Palace (Realm of Waters)"
  ],
  [
    "Trần Triều Hiển Thánh",
    "Sacred Tran Dynasty"
  ],
  [
    "Áo Tím Chàm Thêu Rồng",
    "Indigo-Violet Dragon Embroidered Robe"
  ],
  [
    "Thay Lễ Phục (Sửa Lễ)",
    "Vestment Preparation"
  ],
  [
    "CSDL: SQLite (cục bộ)",
    "DB: SQLite (local)"
  ],
  [
    "Xác nhận tiêu MC Coin",
    "Confirm MC Spend"
  ],
  [
    "Sự nghiệp & Công danh",
    "Career & Honour"
  ],
  [
    "Lịch sử quẻ đã gieo (",
    "Divination History ("
  ],
  [
    "1. Bản Thân (Đạo Hữu)",
    "1. Yourself (Pilgrim)"
  ],
  [
    "ĐIỂM TƯƠNG HỢP BÁT TỰ",
    "BAZI COMPATIBILITY SCORE"
  ],
  [
    "Chưa đến Hòm Công Đức",
    "Not at the Merit Box"
  ],
  [
    "Phương thức thỉnh quẻ",
    "Select divination mode"
  ],
  [
    "Áo Chuba & Mũ Pandita",
    "Tibetan Chuba Robe & Pandita Hat"
  ],
  [
    "Công Danh & Sự Nghiệp",
    "Career & Achievement"
  ],
  [
    "Xuất Hành & Di Chuyển",
    "Travel & Relocation"
  ],
  [
    "quang minh chiếu mệnh",
    "shines auspiciously upon your destiny"
  ],
  [
    "Đang tới hòm công đức",
    "Walking to Merit Box"
  ],
  [
    "Đang tới Đài Tơ Duyên",
    "Walking to Red Thread Shrine"
  ],
  [
    "Đang tới cổng leo núi",
    "Walking to Cloud Peak Gate"
  ],
  [
    "Kết nối ví để leo núi",
    "Connect wallet for Parkour"
  ],
  [
    "Thượng Thượng Đại Cát",
    "Supreme Great Fortune"
  ],
  [
    "Thượng Cát Hanh Thông",
    "Auspicious & Smooth"
  ],
  [
    "Lương Duyên Tiền Định",
    "Destined Union"
  ],
  [
    "Sinh Quý Tử Cát Khánh",
    "Auspicious Blessing of Children"
  ],
  [
    "Thân Khang Kiện Tráng",
    "Vibrant Health & Vitality"
  ],
  [
    "Mở / Đóng Cửa Bức Bàn",
    "Open / Close Sanctuary Doors"
  ],
  [
    "Kết nối trên HydraOne",
    "Connect on HydraOne"
  ],
  [
    "Góc nhìn thứ ba (TPP)",
    "Third-Person (TPP)"
  ],
  [
    "Nữ Hành Giả (Tóc dài)",
    "Female Pilgrim (Long hair)"
  ],
  [
    "Giữ ALT để hiện chuột",
    "Hold ALT for cursor"
  ],
  [
    "Lời nguyện chánh niệm",
    "Mindful wishes"
  ],
  [
    "Thẻ Bài Di Sản Cổ Tự",
    "3D Heritage Temple Cards"
  ],
  [
    "Chân Như (Legendary)",
    "Legendary (Chan Nhu)"
  ],
  [
    "Bói Quẻ 6 Môn Cầu An",
    "6 Sacred Divination Topics"
  ],
  [
    "Ngày sinh dương lịch",
    "Solar Birth Date"
  ],
  [
    "Hòm Công Đức Tam Bảo",
    "Sanctuary Merit Box"
  ],
  [
    "Chuông Xoay Tây Tạng",
    "Tibetan Singing Bowl"
  ],
  [
    "Suối Nguồn Tĩnh Lặng",
    "Mountain Stream"
  ],
  [
    "Mặt Trước (Triết Lý)",
    "Front Side (Wisdom)"
  ],
  [
    "Thuyết Minh Âm Thanh",
    "Audio Narration"
  ],
  [
    "Audio thiền tịnh tâm",
    "Mindful audio narration"
  ],
  [
    "Đông Đại Tự Todai-ji",
    "Todai-ji Great Eastern Temple"
  ],
  [
    "Chùa Vàng Kinkaku-ji",
    "Kinkaku-ji Golden Pavilion"
  ],
  [
    "Tào Khê Tự (Jogyesa)",
    "Jogyesa Temple"
  ],
  [
    "Bảng Cử Chỉ Tâm Linh",
    "Sacred Gesture Wheel"
  ],
  [
    "Chưa thể tự dẫn bước",
    "Cannot auto-walk"
  ],
  [
    "Chầu Đôi Thượng Ngàn",
    "Second Sacred Lady of the Forest"
  ],
  [
    "Ông Hoàng Bảy Bảo Hà",
    "Seventh Sacred Prince of Bao Ha"
  ],
  [
    "Không thể kết nối ví",
    "Unable to connect wallet"
  ],
  [
    "Chức năng ví Cardano",
    "Cardano Wallet Actions"
  ],
  [
    "Trả thiếu (Đối soát)",
    "Underpaid (Reconcile)"
  ],
  [
    "Chưa đến Bàn Xem Quẻ",
    "Not at the Divination Table"
  ],
  [
    "Chủ đề tự động khớp:",
    "Auto-matched topic:"
  ],
  [
    "Duyên tình & Gia đạo",
    "Love & Family"
  ],
  [
    "Hình thức thanh toán",
    "Payment Method"
  ],
  [
    "Phương thức gieo quẻ",
    "Divination Method"
  ],
  [
    "Song Duyên Tương Hợp",
    "Couple Harmony"
  ],
  [
    "Tóc dài truyền thống",
    "Traditional long hair"
  ],
  [
    "Lượt hỷ cúng thực tế",
    "Total Verified Donations"
  ],
  [
    "Triết lý & Kiến trúc",
    "Wisdom & Architecture"
  ],
  [
    "Bổn mạng & Sự nghiệp",
    "Destiny & Career"
  ],
  [
    "Bùa Chỉ Đỏ Uyên Ương",
    "Mandarin Duck Red Thread Charm"
  ],
  [
    "Đã khoác trang phục ",
    "Equipped attire "
  ],
  [
    "Khai mở thành công \"",
    "Successfully opened \""
  ],
  [
    "Tài Lộc & Kinh Doanh",
    "Wealth & Commerce"
  ],
  [
    "Tiếng Việt (Chủ đạo)",
    "Vietnamese (Primary)"
  ],
  [
    "Chưa nhập ngày sinh.",
    "Birth date is required."
  ],
  [
    "Chưa chọn giới tính.",
    "Gender selection is required."
  ],
  [
    "Hành Trì & Phước Đức",
    "Mindfulness & Merit"
  ],
  [
    "Dâng hương ngày rằm",
    "Full-moon incense offering"
  ],
  [
    "Trầm Hương Xứ Quảng",
    "Quang Agarwood Incense"
  ],
  [
    "Bánh Oản Hoàng Cung",
    "Royal Temple Cake"
  ],
  [
    "Áo Lam Truyền Thống",
    "Traditional Lam Robe"
  ],
  [
    "Đã thỉnh thành công",
    "Purchased successfully"
  ],
  [
    "Ghé Điện Thờ Tứ Phủ",
    "Visit the Four Palaces Shrine"
  ],
  [
    "Triết học Kinh Dịch",
    "I Ching Philosophy"
  ],
  [
    "Bát quái & Ngũ hành",
    "Eight Trigrams & Five Elements"
  ],
  [
    "Ngày Rằm & Mồng Một",
    "Full Moon & New Moon Days"
  ],
  [
    "Cư Trần Lạc Đạo Phú",
    "Dwelling in the World with Joy in the Dharma"
  ],
  [
    "Trí Huệ Đáo Bỉ Ngạn",
    "Wisdom Reaching the Other Shore"
  ],
  [
    "Vòng Tròn Enso (円相)",
    "Enso Zen Circle (円相)"
  ],
  [
    "Thạch Đình Ryoan-ji",
    "Ryoan-ji Rock Garden"
  ],
  [
    "Hải Ấn Tự (Haeinsa)",
    "Haeinsa Temple of the Ocean Mudra"
  ],
  [
    "Nam Mô A Di Đà Phật",
    "Namo Amitabha Buddha"
  ],
  [
    "Suối Reo & Gáo Trúc",
    "Mountain Stream & Bamboo Shishi-odoshi"
  ],
  [
    "Đã Khánh Hỷ (+5 MC)",
    "Praised (+5 MC)"
  ],
  [
    "Số dư MC trong game",
    "In-Game MC Balance"
  ],
  [
    "Ví Cardano & Nạp MC",
    "Cardano Wallet & Top Up MC"
  ],
  [
    "Hoàn tất! Đã cộng +",
    "Completed! Credited +"
  ],
  [
    "Thắp hương đầu ngày",
    "Offer morning incense"
  ],
  [
    "Gieo một quẻ cầu an",
    "Draw a daily fortune"
  ],
  [
    "Ngắm Hồ Sen Bát Nhã",
    "Visit the Prajna Lotus Pond"
  ],
  [
    "Đứng dưới Cây Bồ Đề",
    "Stand beneath the Bodhi Tree"
  ],
  [
    "Một thẻ di sản hiếm",
    "One Rare Heritage Card"
  ],
  [
    "Giờ sinh (Tùy chọn)",
    "Birth Hour (Optional)"
  ],
  [
    "Cung phi Bát Trạch:",
    "Eight Mansions Trigram:"
  ],
  [
    "Nhất quán theo ngày",
    "Daily deterministic seed"
  ],
  [
    "Sự nghiệp Công danh",
    "Career & Honour"
  ],
  [
    "Tiền tài & Lộc pháp",
    "Wealth & Prosperity"
  ],
  [
    "Sức khỏe & Thân tâm",
    "Health & Mind"
  ],
  [
    "Thông Tin Chiêm Bái",
    "Divination Summary"
  ],
  [
    "Nguyệt Lão Chỉ Hồng",
    "Red Thread of Destiny"
  ],
  [
    "Xuất Thẻ Song Duyên",
    "Export Couple Card"
  ],
  [
    "Đồng bộ Multiplayer",
    "Multiplayer Sync"
  ],
  [
    "Thẻ ảnh kết quả quẻ",
    "Fortune result card"
  ],
  [
    "Chánh niệm định tâm",
    "Mindful Serenity"
  ],
  [
    "Hồ sơ người thương:",
    "Partner profile:"
  ],
  [
    "Nguyệt Lão chỉ hồng",
    "Red Thread of Love"
  ],
  [
    "Kinh doanh phát đạt",
    "Prosperous Commerce"
  ],
  [
    "Không thể xuất ảnh:",
    "Unable to export image:"
  ],
  [
    "Tình Duyên & Tri Kỷ",
    "Love & Soulmate"
  ],
  [
    "An Khang & Thân Tâm",
    "Health & Wellbeing"
  ],
  [
    "Nghịch Duyên Tu Tâm",
    "Mindful Growth Bond"
  ],
  [
    "Cát Tinh · Thuận Bù",
    "Auspicious Star · Supportive"
  ],
  [
    "Điều hướng danh mục",
    "Category navigation"
  ],
  [
    "Bị cản, hãy tự bước",
    "Path blocked; please walk manually"
  ],
  [
    "Đã đến hòm công đức",
    "Arrived at Merit Box"
  ],
  [
    "Đã tới Nhà Hầu Đồng",
    "Arrived at Mediumship Shrine"
  ],
  [
    "Đang vào Chánh Điện",
    "Walking into Main Hall"
  ],
  [
    "· VẬN KHÍ CHIÊM BÁI",
    "· DIVINATION OUTLOOK"
  ],
  [
    "Duyên Lành Đang Đến",
    "Auspicious Love Approaching"
  ],
  [
    "HOAN HỶ TƯƠNG PHÙNG",
    "JOYFUL ENCOUNTER"
  ],
  [
    "Cần Tịnh Dưỡng Thân",
    "Time for Mindful Rest"
  ],
  [
    "Rút Quẻ Xăm Linh Tự",
    "Draw Sacred Fortune Stick"
  ],
  [
    "Bộ Trộn Âm Thanh 3D",
    "3D Soundscape Mixer"
  ],
  [
    "Trường Sam Lễ Phật",
    "Taiwanese Ceremonial Robe"
  ],
  [
    "Đang có trong túi:",
    "In bag:"
  ],
  [
    "Bộ Sưu Tập Thẻ Bài",
    "Card Collection"
  ],
  [
    "Ý Nghĩa Chánh Niệm",
    "Mindful Meaning"
  ],
  [
    "Tơ Duyên Tương Ngộ",
    "Red Thread Matchmaking"
  ],
  [
    "Bảng Vàng Công Đức",
    "Merit Honor Roll"
  ],
  [
    "Lịch sử cúng dường",
    "Donation History"
  ],
  [
    "Kết thúc tọa thiền",
    "End Meditation"
  ],
  [
    "Tiếng Mõ Tụng Kinh",
    "Wooden Fish"
  ],
  [
    "Ghé Cây Nguyệt Lão",
    "Visit the Red Thread Love Tree"
  ],
  [
    "Kết nối ví Cardano",
    "Connect Cardano Wallet"
  ],
  [
    "Giác Ngộ · Bậc III",
    "Epic · Tier III"
  ],
  [
    "Nhận & Cất Vào Kho",
    "Claim & Store in Vault"
  ],
  [
    "Chùa Keo Thái Bình",
    "Keo Pagoda (Thai Binh)"
  ],
  [
    "Tọa Thiền Kiết Già",
    "Full Lotus Meditation"
  ],
  [
    "Tọa thiền kiết già",
    "Sitting in lotus meditation"
  ],
  [
    "Tọa Thiền Điều Tức",
    "Mindful Breath Meditation"
  ],
  [
    "Hít sâu chánh niệm",
    "Deep mindful inhale"
  ],
  [
    "Định tâm tĩnh lặng",
    "Calm centered hold"
  ],
  [
    "Thả lỏng buông thư",
    "Relax and let go"
  ],
  [
    "Chứng thực sổ cái:",
    "Ledger Proof:"
  ],
  [
    "Chánh niệm sâu sắc",
    "Deep mindfulness"
  ],
  [
    "Khoan thai bước...",
    "Walking mindfully..."
  ],
  [
    "cần vào trong điện",
    "must enter the Main Hall"
  ],
  [
    "Góp Quỹ Bách Gia (",
    "Contribute to Pool ("
  ],
  [
    "Bạch Y (Trắng Kim)",
    "White & Gold Vestment"
  ],
  [
    "Thanh Y (Xanh Lục)",
    "Emerald Green Vestment"
  ],
  [
    "Cô Đôi Thượng Ngàn",
    "Second Sacred Maiden of the Mountains"
  ],
  [
    "Nhạc Phủ (Sơn Lâm)",
    "Mountain Forest Palace"
  ],
  [
    "Áo Lam / Xanh Ngọc",
    "Jade & Indigo Silk Robe"
  ],
  [
    "GMT+7 (Giờ Hà Nội)",
    "GMT+7 (Hanoi Time)"
  ],
  [
    "Hydra L2 đang tắt.",
    "Hydra L2 is disabled."
  ],
  [
    "vẫn là sổ cái gốc.",
    "remains the primary ledger."
  ],
  [
    "Kết Nối Ví Cardano",
    "Connect Cardano Wallet"
  ],
  [
    "Âm lịch & Can Chi:",
    "Lunar Date & Sexagenary:"
  ],
  [
    "Bản mệnh (Nạp âm):",
    "Destiny Element (Nayin):"
  ],
  [
    "6 môn truyền thống",
    "6 traditional subjects"
  ],
  [
    "Duyên tình Gia đạo",
    "Love & Family"
  ],
  [
    "Giới tính nhân vật",
    "Character Gender"
  ],
  [
    "Hồi hướng công đức",
    "Merit Dedication"
  ],
  [
    "Thẻ bài Song Duyên",
    "Couple compatibility card"
  ],
  [
    "Chiêm bốc tâm linh",
    "Sacred Folk Divination"
  ],
  [
    "Pháp bảo & Cổ phục",
    "Attire & Offerings"
  ],
  [
    "Áo Tràng Lam Cổ Tự",
    "Taiwanese Temple Haiqing Robe"
  ],
  [
    "Tri Kỷ Tương Phùng",
    "Kindred Spirits"
  ],
  [
    "Hung Tinh · Nghịch",
    "Challenging Star · Caution"
  ],
  [
    "Đối sánh Bản Mệnh:",
    "Destiny Comparison:"
  ],
  [
    "Đối sánh Ngũ Hành:",
    "Five-Element Comparison:"
  ],
  [
    "Đã gửi giao dịch (",
    "Transaction submitted ("
  ],
  [
    "Hiện con trỏ chuột",
    "Show mouse cursor"
  ],
  [
    "LUẬN GIẢI CHỦ ĐỀ (",
    "TOPIC INTERPRETATION ("
  ],
  [
    "Hồ sơ không hợp lệ",
    "Invalid profile"
  ],
  [
    "PHI LONG TẠI THIÊN",
    "SOARING DRAGON IN HEAVEN"
  ],
  [
    "KHO TÀNG PHƯỚC ĐỨC",
    "TREASURY OF MERIT"
  ],
  [
    "KIM NGỌC MÃN ĐƯỜNG",
    "HALL FILLED WITH GOLD & JADE"
  ],
  [
    "Hóa Hung Thành Cát",
    "Transforming Challenges into Blessings"
  ],
  [
    "Tọa Thiền Tĩnh Tâm",
    "Sit in Mindful Meditation"
  ],
  [
    "Đóng bảng phím tắt",
    "Close hotkeys"
  ],
  [
    "Pháp Đàm & Đồng Tu",
    "Dharma Talk & Sangha"
  ],
  [
    "Khách Thập Phương",
    "Visiting Pilgrim"
  ],
  [
    "Đang có trong túi",
    "In bag"
  ],
  [
    "Chiêu Tài Tấn Bảo",
    "Wealth & Prosperity"
  ],
  [
    "Dâng Sao Giải Hạn",
    "Nine-Star Harmony"
  ],
  [
    "Lời nguyện cầu an",
    "Peaceful Prayer"
  ],
  [
    "Bắt đầu tọa thiền",
    "Start Meditation"
  ],
  [
    "Đồng Tu Hiện Diện",
    "Online Pilgrims"
  ],
  [
    "Tủ sách Thiền môn",
    "Sanctuary Dharma Library"
  ],
  [
    "Nghiệp & Luân hồi",
    "Karma & Samsara"
  ],
  [
    "Mặt Sau (Kinh Kệ)",
    "Back Side (Scripture)"
  ],
  [
    "Chân Như · Bậc IV",
    "Legendary · Tier IV"
  ],
  [
    "Tinh Tấn · Bậc II",
    "Rare · Tier II"
  ],
  [
    "Nhất Tâm Chân Như",
    "One Mind of True Suchness"
  ],
  [
    "Đứng trang nghiêm",
    "Standing serenely"
  ],
  [
    "Suối reo róc rách",
    "Babbling brook"
  ],
  [
    "Chuông Xoay 432Hz",
    "432Hz Singing Bowl"
  ],
  [
    "Chuông xoay 432Hz",
    "432Hz singing bowl"
  ],
  [
    "Tiếng Mõ Định Tâm",
    "Mindful Wooden Fish"
  ],
  [
    "Bắt Đầu Tọa Thiền",
    "Start Meditation"
  ],
  [
    "Định tâm thư giãn",
    "Relaxed focus"
  ],
  [
    "Đang di chuyển...",
    "Moving..."
  ],
  [
    "Tiến độ thời khóa",
    "Session Progress"
  ],
  [
    "Đã vào Chánh Điện",
    "Entered Main Hall"
  ],
  [
    "Thời gian còn lại",
    "Time remaining"
  ],
  [
    "Chắp Tay Khánh Hỷ",
    "Join Palms in Praise"
  ],
  [
    "Thỉnh Lộc Ngay (+",
    "Claim Blessing (+"
  ],
  [
    "Mở Đàn Đặc Cách (",
    "Sponsor Private Ritual ("
  ],
  [
    "MC vào tài khoản.",
    "MC to your account."
  ],
  [
    "Không rõ giờ sinh",
    "Unknown birth hour"
  ],
  [
    "Can Chi Giờ sinh:",
    "Birth Hour Pillar:"
  ],
  [
    "Hồ sơ đã xác nhận",
    "Confirmed Profile"
  ],
  [
    "Tiền tài Lộc pháp",
    "Wealth & Prosperity"
  ],
  [
    "Sức khỏe Thân tâm",
    "Health & Mind"
  ],
  [
    "0 MC (1 lần/ngày)",
    "0 MC (1/day)"
  ],
  [
    "Tóc ngắn gọn gàng",
    "Neat short hair"
  ],
  [
    "Cộng đồng đồng tu",
    "Sangha Community"
  ],
  [
    "Hãy bấm \"Nạp MC\"!",
    "Click \"Top Up MC\"!"
  ],
  [
    "Tiêu tai trừ bệnh",
    "Healing & Wellbeing"
  ],
  [
    "Bắc Đẩu Thất Tinh",
    "Seven Stars of the Northern Dipper"
  ],
  [
    "Vạn Cảnh Thiền Tự",
    "Van Canh Zen Sanctuary"
  ],
  [
    "Hành Giả Thiền Tự",
    "Sanctuary Pilgrim"
  ],
  [
    "Y Cà Sa Theravada",
    "Theravada Saffron Kasaya Robe"
  ],
  [
    "Gia Đạo & Con Cái",
    "Family & Offspring"
  ],
  [
    "Học Vấn & Khoa Cử",
    "Study & Examinations"
  ],
  [
    "Bằng Hữu Đồng Tâm",
    "Harmonious Companions"
  ],
  [
    "VẠN CẢNH THIỀN TỰ",
    "VAN CANH SANCTUARY"
  ],
  [
    "Đang tới Điện Thờ",
    "Walking to Four Palaces Shrine"
  ],
  [
    "Đã dừng thử thách",
    "Challenge stopped"
  ],
  [
    "SẮC QUẺ CHIÊM BÁI",
    "SACRED FORTUNE SCROLL"
  ],
  [
    "Chưa nhập họ tên.",
    "Full name is required."
  ],
  [
    "BÁCH NIÊN HẢO HỢP",
    "HUNDRED YEARS OF HARMONY"
  ],
  [
    "LIÊN HOA HÓA SANH",
    "LOTUS BLOSSOM BIRTH"
  ],
  [
    "CĂN LÀNH BỀN CHẶT",
    "DEEP WHOLESOME ROOTS"
  ],
  [
    "BÌNH AN CHIÊU TÀI",
    "PEACEFUL PROSPERITY"
  ],
  [
    "LƯU LY QUANG MINH",
    "RADIANT LAPIS LIGHT"
  ],
  [
    "THẤT TINH HỘ MẠNG",
    "SEVEN STARS PROTECTION"
  ],
  [
    "ĐIỆN TỨ PHỦ · GIÁ",
    "FOUR PALACES · STAGE"
  ],
  [
    "Đang tự bước tới:",
    "Auto-walking to:"
  ],
  [
    "Cửa Hàng Pháp Bảo",
    "Sanctuary Shop"
  ],
  [
    "Thẻ Bài Di Sản 3D",
    "3D Heritage Cards"
  ],
  [
    "Di Sản & Cửa Hàng",
    "Heritage & Shop"
  ],
  [
    "Thiện Nam Tín Nữ",
    "Devoted Pilgrim"
  ],
  [
    "Ngày Rằm Âm Lịch",
    "Lunar Full Moon"
  ],
  [
    "Hàn Phục Chùa Cổ",
    "Korean Temple Hanbok"
  ],
  [
    "Áo Choàng Lạt Ma",
    "Tibetan Monastic Robe"
  ],
  [
    "Xin Xăm Bát Quái",
    "Eight-Trigram Sticks"
  ],
  [
    "Dược Sư An Khang",
    "Medicine Buddha Peace"
  ],
  [
    "Thỉnh Quẻ Cầu An",
    "Draw Sacred Fortune"
  ],
  [
    "Lịch sử gieo quẻ",
    "Fortune History"
  ],
  [
    "Giáo lý Nhân quả",
    "Law of Cause & Effect"
  ],
  [
    "Ngũ giới tại gia",
    "Five Lay Precepts"
  ],
  [
    "Phát Thuyết Minh",
    "Play Narration"
  ],
  [
    "Bát Nhã Tâm Kinh",
    "Heart of Prajnaparamita Sutra"
  ],
  [
    "Niệm Phật Sen Nở",
    "Blooming Lotus Step"
  ],
  [
    "Dâng 3 Nén Hương",
    "Offer 3 Incense Sticks"
  ],
  [
    "Thả Đèn Hoa Đăng",
    "Release Lotus Lantern"
  ],
  [
    "Chắp tay cúi lạy",
    "Bowing with palms joined"
  ],
  [
    "Kinh hành an lạc",
    "Walking mindfully"
  ],
  [
    "Mưa Rào Mái Ngói",
    "Rain on Temple Tiles"
  ],
  [
    "Đang đến bồ đoàn",
    "Walking to mat"
  ],
  [
    "Chủ lễ / Mở đàn:",
    "Ritual Sponsor:"
  ],
  [
    "25% Tu Bổ (Burn)",
    "25% Temple Restoration (Burn)"
  ],
  [
    "Số dư không đủ (",
    "Insufficient balance ("
  ],
  [
    "Thoải / Nhạc Phủ",
    "Water & Forest Palaces"
  ],
  [
    "Hoàng Y Khăn Rìu",
    "Golden Robe & Brocade Headscarf"
  ],
  [
    "Số dư ví Cardano",
    "Cardano Wallet Balance"
  ],
  [
    "Đã gửi lên chuỗi",
    "Submitted on-chain"
  ],
  [
    "Đến Đài Tơ Duyên",
    "Visit the Red Thread Shrine"
  ],
  [
    "Đứng dưới Cây Đa",
    "Stand beneath the Banyan Tree"
  ],
  [
    "Hành Giả Bền Tâm",
    "Steadfast Pilgrim"
  ],
  [
    "Độ tuổi tự tính:",
    "Calculated Age:"
  ],
  [
    "Miễn phí hôm nay",
    "Free today"
  ],
  [
    "Đã dùng miễn phí",
    "Free draw used"
  ],
  [
    "Phước đức tâm an",
    "Mindful Merit"
  ],
  [
    "Âm cảnh thiền tự",
    "Sanctuary Soundscape"
  ],
  [
    "Niên Vận Hỗ Trợ:",
    "Annual Star Support:"
  ],
  [
    "Lời Vàng Pháp Cú",
    "Golden Dharma Verse"
  ],
  [
    "Đang tới bàn xăm",
    "Walking to Divination Table"
  ],
  [
    "Đang ra Tam Quan",
    "Walking to Tam Quan Gate"
  ],
  [
    "Chưa Đạt Yêu Cầu",
    "Requirement Not Met"
  ],
  [
    "lại gần mục tiêu",
    "walk closer to target"
  ],
  [
    "Quốc Sư Không Lộ",
    "Master Khong Lo"
  ],
  [
    "Tuyền Trung Thủy",
    "Spring Water"
  ],
  [
    "Thiên Thượng Hỏa",
    "Heavenly Sun Fire"
  ],
  [
    "Dưỡng Đức Cầu Tự",
    "Cultivating Virtue & Vitality"
  ],
  [
    "DƯỠNG TÂM AN THỂ",
    "NOURISH MIND & BODY"
  ],
  [
    "Tu Thân Giải Hạn",
    "Cultivating Virtue & Peace"
  ],
  [
    "TÂM ĐỨC TIÊU TAI",
    "VIRTUE DISSOLVES ADVERSITY"
  ],
  [
    "Kỷ lục tốt nhất:",
    "Best record:"
  ],
  [
    "Bói Quẻ & Cầu An",
    "Divination"
  ],
  [
    "Thiền & Công Đức",
    "Meditation & Merit"
  ],
  [
    "Di Sản & Bảo Vật",
    "Heritage & Treasures"
  ],
  [
    "Hành Giả Tâm An",
    "Peaceful Pilgrim"
  ],
  [
    "Sơ Tâm Nhập Đạo",
    "Novice Pilgrim"
  ],
  [
    "Hoa Đăng Cầu An",
    "Peace Lotus Lantern"
  ],
  [
    "Đàn Hương Kyoto",
    "Kyoto Sandalwood Incense"
  ],
  [
    "Samue Thiền Môn",
    "Zen Samue Attire"
  ],
  [
    "Tải Hình Nền 4K",
    "Download 4K Art"
  ],
  [
    "Chưa khai quang",
    "Locked"
  ],
  [
    "Giác Ngộ (Epic)",
    "Epic (Giac Ngo)"
  ],
  [
    "Tinh Tấn (Rare)",
    "Rare (Tinh Tan)"
  ],
  [
    "Thường (Common)",
    "Common"
  ],
  [
    "Cúng dường ngay",
    "Donate Now"
  ],
  [
    "Chưa hoàn thành",
    "Incomplete"
  ],
  [
    "Đang kết nối...",
    "Connecting..."
  ],
  [
    "Kiến Trúc Cổ Tự",
    "Temple Architecture"
  ],
  [
    "Phòng Trưng Bày",
    "Card Gallery"
  ],
  [
    "Chùa Hương Tích",
    "Perfume Pagoda (Huong Tich Cave)"
  ],
  [
    "Đảnh Lễ Tam Bảo",
    "Prostrate to Three Jewels"
  ],
  [
    "Đủ rồi hôm nay.",
    "Daily meditation reward cap reached."
  ],
  [
    "Đã xả thiền sớm",
    "Ended meditation early"
  ],
  [
    "Quỹ lộc đàn lễ:",
    "Ritual Blessing Pool:"
  ],
  [
    "Đã Thỉnh Lộc (+",
    "Blessing Claimed (+"
  ],
  [
    "60% Quỹ Ban Lộc",
    "60% Blessing Pool"
  ],
  [
    "Cậu Bé Hoàng Tử",
    "Sacred Young Prince"
  ],
  [
    "Đơn nạp gần đây",
    "Recent Top-Up Orders"
  ],
  [
    "Quá hạn có tiền",
    "Expired with payment"
  ],
  [
    "Chuỗi nối tiếp.",
    "Your practice streak continues!"
  ],
  [
    "(bạn đã có sẵn)",
    "(already owned)"
  ],
  [
    "Bát Tự bản mệnh",
    "Personal BaZi"
  ],
  [
    "Chưa lưu Bát Tự",
    "BaZi not saved"
  ],
  [
    "Lời nguyện cầu:",
    "Prayer / Dedication:"
  ],
  [
    "Sổ cái xác thực",
    "Verified Ledger"
  ],
  [
    "lượt cúng dường",
    "donations"
  ],
  [
    "Chọn môn cầu an",
    "Select divination subject"
  ],
  [
    "Quan Âm Tống Tử",
    "Guanyin Blessing of Children"
  ],
  [
    "MC (số nguyên).",
    "MC (whole number)."
  ],
  [
    "Ẩn danh đồng tu",
    "Anonymous Pilgrim"
  ],
  [
    "Đã khai quang \"",
    "Unlocked \""
  ],
  [
    "Duyên Tiền Định",
    "Destined Soulmates"
  ],
  [
    "Thiên thời Ngày",
    "Daily Cosmic Qi"
  ],
  [
    "Thông tin lưu ý",
    "Important note"
  ],
  [
    "Đảnh lễ Tam Bảo",
    "Prostrate to Three Jewels"
  ],
  [
    "-5 MC, lên đỉnh",
    "-5 MC — climb to the peak!"
  ],
  [
    "Đã ẩn ngày sinh",
    "Birth date hidden"
  ],
  [
    "Trường Lưu Thủy",
    "Long-Flowing Water"
  ],
  [
    "Bích Thượng Thổ",
    "Wall Earth"
  ],
  [
    "Đại Phú Đại Quý",
    "Great Prosperity & Honor"
  ],
  [
    "Tài Vận Ổn Định",
    "Steady Financial Flow"
  ],
  [
    "Hủy / Xuống Núi",
    "Cancel / Descend"
  ],
  [
    "Leo núi Parkour",
    "Mountain Climb"
  ],
  [
    "Leo Núi Parkour",
    "Mountain Climb"
  ],
  [
    "Hội Thiền 432Hz",
    "432Hz Meditation Hall"
  ],
  [
    "Mùng 1 Âm Lịch",
    "Lunar New Moon"
  ],
  [
    "Mặc trang phục",
    "Equip Attire"
  ],
  [
    "Xác nhận thỉnh",
    "Confirm Purchase"
  ],
  [
    "Đúc NFT CIP-68",
    "Mint CIP-68 NFT"
  ],
  [
    "Triết Lý Thiền",
    "Zen Philosophy"
  ],
  [
    "Cầu Tự Con Cái",
    "Family & Offspring"
  ],
  [
    "Mưa Thiền Viện",
    "Sanctuary Rain"
  ],
  [
    "Số dư hiện tại",
    "Current Balance"
  ],
  [
    "Gửi lời nguyện",
    "Send Wish"
  ],
  [
    "Đã tải ảnh 4K!",
    "4K Wallpaper Downloaded!"
  ],
  [
    "Thường · Bậc I",
    "Common · Tier I"
  ],
  [
    "Chi phí mở hộp",
    "Pack Cost"
  ],
  [
    "Gói Duyên Khởi",
    "Duyen Khoi Starter Pack"
  ],
  [
    "Vào Chánh Điện",
    "Enter Main Hall"
  ],
  [
    "Đang tọa thiền",
    "Meditating"
  ],
  [
    "Chứng thực L2:",
    "L2 Proof:"
  ],
  [
    "15% Quỹ Rằm/M1",
    "15% Lunar Festival Pool"
  ],
  [
    "Nhập số ADA...",
    "Enter ADA amount..."
  ],
  [
    "· Hydra L2 tắt",
    "· Hydra L2 off"
  ],
  [
    "Chuỗi hiện tại",
    "Current Streak"
  ],
  [
    "Đến Lầu Chuông",
    "Visit the Bell Tower"
  ],
  [
    "Bói Quẻ Cầu An",
    "Sacred Divination"
  ],
  [
    "/10 vị đồng tu",
    "/10 fellow pilgrims"
  ],
  [
    "Đồng tu hộ trì",
    "Sanctuary Patron"
  ],
  [
    "Căn cứ Bát Tự:",
    "BaZi Basis:"
  ],
  [
    "kết duyên cùng",
    "paired with"
  ],
  [
    "kết duyên Mệnh",
    "paired with Element"
  ],
  [
    "Cuộn sang trái",
    "Scroll left"
  ],
  [
    "Cuộn sang phải",
    "Scroll right"
  ],
  [
    "Hiệu năng: bật",
    "Performance stats: ON"
  ],
  [
    "Hiệu năng: tắt",
    "Performance stats: OFF"
  ],
  [
    "Đã đến bàn xăm",
    "Arrived at Divination Table"
  ],
  [
    "Điểm việc lành",
    "Good Deed Spot"
  ],
  [
    "Bảng hiệu năng",
    "Performance panel"
  ],
  [
    "Trần Nhân Tông",
    "Tran Nhan Tong"
  ],
  [
    "Thẻ Quẻ Cầu An",
    "Sacred Fortune Card"
  ],
  [
    "Mã chứng nhận:",
    "Certificate ID:"
  ],
  [
    "ĐIỂM TƯƠNG HỢP",
    "COMPATIBILITY SCORE"
  ],
  [
    "Kiếm Phong Kim",
    "Sword-Edge Metal"
  ],
  [
    "Dương Liễu Mộc",
    "Willow Wood"
  ],
  [
    "Thoa Xuyến Kim",
    "Hairpin & Bracelet Gold"
  ],
  [
    "Sơ Đồ Thiền Tự",
    "Sanctuary Map"
  ],
  [
    "Cây Nguyệt Lão",
    "Love Tree"
  ],
  [
    "Nhà phát triển",
    "Developer"
  ],
  [
    "Xem Mặt Trước",
    "Flip to Front"
  ],
  [
    "Đã khai quang",
    "Unlocked"
  ],
  [
    "Gió Rừng Trúc",
    "Bamboo Wind"
  ],
  [
    "Đã hoàn thành",
    "Completed"
  ],
  [
    "Gợi ý cho con",
    "Suggested Questions"
  ],
  [
    "Tiết kiệm 12%",
    "Save 12%"
  ],
  [
    "Chắp Tay Chào",
    "Lotus Bow"
  ],
  [
    "Bồ đoàn trống",
    "Available Mats"
  ],
  [
    "Hủy Dẫn Đường",
    "Cancel Walk"
  ],
  [
    "96 giây / Giá",
    "96 sec / Stage"
  ],
  [
    "Đang xác nhận",
    "Confirming"
  ],
  [
    "Cột mốc ngày:",
    "Milestone:"
  ],
  [
    "Đang xử lý...",
    "Processing..."
  ],
  [
    "Sao niên vận:",
    "Annual Ruling Star:"
  ],
  [
    "Lượt miễn phí",
    "Daily Free Draw"
  ],
  [
    "Lượt Miễn Phí",
    "Daily Free Draw"
  ],
  [
    "Chọn lễ phẩm:",
    "Select offering:"
  ],
  [
    "+ Nạp thêm MC",
    "+ Top Up MC"
  ],
  [
    "Di sản UNESCO",
    "UNESCO Heritage"
  ],
  [
    "Câu Hỏi Tự Do",
    "Custom Question"
  ],
  [
    "Quẻ Cát Tường",
    "Auspicious Fortune"
  ],
  [
    "chắp tay chào",
    "bowed in greeting"
  ],
  [
    "Đợi giá thứ 5",
    "Wait for Stage 5"
  ],
  [
    "(KỶ LỤC MỚI!)",
    "(NEW RECORD!)"
  ],
  [
    "Chắp tay chào",
    "Lotus Bow"
  ],
  [
    "Còn trong túi",
    "Left in bag"
  ],
  [
    "Mở 3 cụm menu",
    "Open 3 bottom docks"
  ],
  [
    "Xoay góc nhìn",
    "Rotate camera"
  ],
  [
    "Khung va chạm",
    "Collision wireframes"
  ],
  [
    "Bát Chánh Đạo",
    "Eightfold Path"
  ],
  [
    "Mã biên nhận:",
    "Receipt ID:"
  ],
  [
    "Người thương:",
    "Partner:"
  ],
  [
    "Hải Trung Kim",
    "Sea Gold (Metal)"
  ],
  [
    "Thành Đầu Thổ",
    "Fortress Wall Earth"
  ],
  [
    "Ốc Thượng Thổ",
    "Rooftop Earth"
  ],
  [
    "Tích Lịch Hỏa",
    "Thunderbolt Fire"
  ],
  [
    "Tùng Bách Mộc",
    "Pine & Cypress Wood"
  ],
  [
    "Thiên Hà Thủy",
    "Milky Way Water"
  ],
  [
    "Đại Trạch Thổ",
    "Great Marsh Earth"
  ],
  [
    "Thạch Lựu Mộc",
    "Pomegranate Wood"
  ],
  [
    "Thời gian leo",
    "Climb time"
  ],
  [
    "Cổng Tam Quan",
    "Tam Quan Gate"
  ],
  [
    "Cư Sĩ Tâm An",
    "Mindful Layperson"
  ],
  [
    "Hồ sơ Bát Tự",
    "BaZi Profile"
  ],
  [
    "Chưa kết nối",
    "Disconnected"
  ],
  [
    "Đăng xuất ví",
    "Disconnect Wallet"
  ],
  [
    "Thầy Trụ Trì",
    "Temple Abbot"
  ],
  [
    "Trang nghiêm",
    "Solemn"
  ],
  [
    "Đã sở hữu (x",
    "Owned (x"
  ],
  [
    "Hộp Mù Gacha",
    "Card Packs"
  ],
  [
    "Chuỗi tu tập",
    "Practice Streak"
  ],
  [
    "Đang Đến Đệm",
    "Walking to Mat"
  ],
  [
    "Xả Thiền Sớm",
    "End Early"
  ],
  [
    "Hết chỗ ngồi",
    "No mats available"
  ],
  [
    "Góp Bách Gia",
    "Community Pool"
  ],
  [
    "Đã tích lũy:",
    "Accumulated:"
  ],
  [
    "Chọn gói ADA",
    "Select ADA Package"
  ],
  [
    "ADA trong ví",
    "ADA transaction in"
  ],
  [
    "Sao chép ảnh",
    "Copy Image"
  ],
  [
    "Phương thức:",
    "Method:"
  ],
  [
    "Dùng lễ phẩm",
    "Use Offering"
  ],
  [
    "Thêm lượt MC",
    "Extra Draw (MC)"
  ],
  [
    "Thêm Lượt MC",
    "Extra Draw (MC)"
  ],
  [
    "50 MC / lượt",
    "50 MC / draw"
  ],
  [
    "50 MC / Lượt",
    "50 MC / Draw"
  ],
  [
    "Nam Hành Giả",
    "Male Pilgrim"
  ],
  [
    "Hòm Công Đức",
    "Merit Box"
  ],
  [
    "Toàn tự viện",
    "Sanctuary Total"
  ],
  [
    "Chọn Câu Hỏi",
    "Preset Question"
  ],
  [
    "Đông Tứ Mệnh",
    "East Quadrant"
  ],
  [
    "[Trung tính]",
    "[Neutral]"
  ],
  [
    "Đã dừng bước",
    "Stopped walking"
  ],
  [
    "Va chạm: bật",
    "Collision debug: ON"
  ],
  [
    "Va chạm: tắt",
    "Collision debug: OFF"
  ],
  [
    "Thả hoa đăng",
    "Release lantern"
  ],
  [
    "Nam hành giả",
    "Male Pilgrim"
  ],
  [
    "Đài Tơ Duyên",
    "Red Thread Shrine"
  ],
  [
    "Cổng leo núi",
    "Cloud Peak Gate"
  ],
  [
    "Đang leo núi",
    "Climbing Cloud Peak"
  ],
  [
    "Di Sản Cổ Tự",
    "Temple Heritage"
  ],
  [
    "Đổi góc nhìn",
    "Switch camera"
  ],
  [
    "Lý Thái Tông",
    "Ly Thai Tong"
  ],
  [
    "Kinh Bát Nhã",
    "Heart Sutra"
  ],
  [
    "Tỳ Lô Giá Na",
    "Vairocana"
  ],
  [
    "Người Thương",
    "Partner"
  ],
  [
    "(Dương lịch)",
    "(Solar)"
  ],
  [
    "Lư Trung Hỏa",
    "Furnace Fire"
  ],
  [
    "Giản Hạ Thủy",
    "Ravine Water"
  ],
  [
    "Bạch Lạp Kim",
    "White Wax Metal"
  ],
  [
    "Sa Trung Kim",
    "Sand Gold (Metal)"
  ],
  [
    "Bình Địa Mộc",
    "Meadow Wood"
  ],
  [
    "Kim Bạch Kim",
    "Pure Gold Foil (Metal)"
  ],
  [
    "Phú Đăng Hỏa",
    "Lantern Fire"
  ],
  [
    "Đại Khê Thủy",
    "Great Stream Water"
  ],
  [
    "Sa Trung Thổ",
    "Sand Earth"
  ],
  [
    "Đại Hải Thủy",
    "Great Ocean Water"
  ],
  [
    "Nhà Hầu Đồng",
    "Four Palaces"
  ],
  [
    "Bậc Chân Tu",
    "awakened Practitioner"
  ],
  [
    "Trạng thái:",
    "Status:"
  ],
  [
    "Nạp thêm MC",
    "Top Up MC"
  ],
  [
    "Kinh Văn Kệ",
    "Sacred Scripture"
  ],
  [
    "Chạm Để Lật",
    "Tap to Flip"
  ],
  [
    "Gói Ngũ Uẩn",
    "Five Aggregates Pack"
  ],
  [
    "Bồ đoàn số ",
    "Mat #"
  ],
  [
    "Ban Lộc sau",
    "Blessing in"
  ],
  [
    "Đã viên mãn",
    "Completed"
  ],
  [
    "Ví HydraOne",
    "HydraOne Wallet"
  ],
  [
    "Khuyên dùng",
    "Recommended"
  ],
  [
    "Đang chờ...",
    "Waiting..."
  ],
  [
    "3. Xác nhận",
    "3. Confirm"
  ],
  [
    "Nạp MC Coin",
    "Top Up MC Coin"
  ],
  [
    "Lịch sử nạp",
    "Top-Up History"
  ],
  [
    "tx xác nhận",
    "confirmed txs"
  ],
  [
    "Đang chờ ký",
    "Awaiting signature"
  ],
  [
    "Đã nhận quà",
    "Reward Claimed"
  ],
  [
    "Thẻ di sản:",
    "Heritage Card:"
  ],
  [
    "Xác nhận (-",
    "Confirm (-"
  ],
  [
    "Tuổi dương:",
    "Solar age:"
  ],
  [
    "Tải ảnh PNG",
    "Download PNG"
  ],
  [
    "Nhập Bát Tự",
    "Enter BaZi"
  ],
  [
    "Nữ Hành Giả",
    "Female Pilgrim"
  ],
  [
    "Phím tắt: G",
    "Hotkey: G"
  ],
  [
    "Đóng cửa sổ",
    "Close window"
  ],
  [
    "Tây Tứ Mệnh",
    "West Quadrant"
  ],
  [
    "MC Lộc Phật",
    "MC Blessing"
  ],
  [
    "Nữ hành giả",
    "Female Pilgrim"
  ],
  [
    "Bàn Xin Xăm",
    "Divination Table"
  ],
  [
    "Bản đồ chùa",
    "Sanctuary map"
  ],
  [
    "Bình thường",
    "Normal"
  ],
  [
    "Đại Lâm Mộc",
    "Great Forest Wood"
  ],
  [
    "Lộ Bàng Thổ",
    "Roadside Earth"
  ],
  [
    "Sơn Đầu Hỏa",
    "Mountain-Top Fire"
  ],
  [
    "Tang Đố Mộc",
    "Mulberry Wood"
  ],
  [
    "Đóng bản đồ",
    "Close map"
  ],
  [
    "đang online",
    "online"
  ],
  [
    "Phương Tây",
    "Western"
  ],
  [
    "Khai quang",
    "Unlock"
  ],
  [
    "Tương Sinh",
    "Harmonious"
  ],
  [
    "Tương Khắc",
    "Challenging"
  ],
  [
    "Đã kết nối",
    "Connected"
  ],
  [
    "Tham khảo:",
    "Reference:"
  ],
  [
    "Đóng (ESC)",
    "Close (ESC)"
  ],
  [
    "Tứ Diệu Đế",
    "Four Noble Truths"
  ],
  [
    "Đang mở...",
    "Opening..."
  ],
  [
    "Lật Tất Cả",
    "Flip All"
  ],
  [
    "Trực Tuyến",
    "Online"
  ],
  [
    "Đã hết hạn",
    "Expired"
  ],
  [
    "Đã ghi dấu",
    "Marked Today"
  ],
  [
    "Seed ngày:",
    "Daily Seed:"
  ],
  [
    "Kết nối ví",
    "Connect Wallet"
  ],
  [
    "Lỗi canvas",
    "Canvas error"
  ],
  [
    "Tương sinh",
    "Harmonious (Generating)"
  ],
  [
    "Tương khắc",
    "Challenging (Overcoming)"
  ],
  [
    "[Thuận Bù]",
    "[Supportive]"
  ],
  [
    "Dâng hương",
    "Offer incense"
  ],
  [
    "Chuột phải",
    "Right Click"
  ],
  [
    "Chạy nhanh",
    "Sprint"
  ],
  [
    "Thăng Long",
    "Thang Long"
  ],
  [
    "Gác Chuông",
    "Bell Tower"
  ],
  [
    "Chùa Hương",
    "Perfume Pagoda"
  ],
  [
    "Hương Tích",
    "Huong Tich"
  ],
  [
    "Thiền Tông",
    "Zen"
  ],
  [
    "· Mã Seed:",
    "· Seed ID:"
  ],
  [
    "NGUYỆT LÃO",
    "MATCHMAKER"
  ],
  [
    "Sinh nhật:",
    "Birth Date:"
  ],
  [
    "Sơn Hạ Hỏa",
    "Mountain-Foot Fire"
  ],
  [
    "Thái Dương",
    "Thai Duong (Sun Star)"
  ],
  [
    "Quẻ Cầu An",
    "Sacred Fortune"
  ],
  [
    "Trung tính",
    "Neutral"
  ],
  [
    "Hành Trang",
    "Balance"
  ],
  [
    "Ví Cardano",
    "Cardano Wallet"
  ],
  [
    "Lầu Chuông",
    "Bell Tower"
  ],
  [
    "Chánh Điện",
    "Main Hall"
  ],
  [
    "Nguyệt Lão",
    "Love Tree"
  ],
  [
    "Mùng 1 · ",
    "New Moon · "
  ],
  [
    "Đã sở hữu",
    "Owned"
  ],
  [
    "Quốc gia:",
    "Country:"
  ],
  [
    "Phẩm cấp:",
    "Rarity:"
  ],
  [
    "Kiến Trúc",
    "Architecture"
  ],
  [
    "Họ và tên",
    "Full Name"
  ],
  [
    "Giới tính",
    "Gender"
  ],
  [
    "Chào thầy",
    "Greet Abbot"
  ],
  [
    "Trầm ngâm",
    "Contemplative"
  ],
  [
    "Phổ thông",
    "Standard"
  ],
  [
    "Hoàng Kim",
    "Golden"
  ],
  [
    "Phím tắt:",
    "Hotkey:"
  ],
  [
    "TẮT TIẾNG",
    "MUTE"
  ],
  [
    "Bồ Đoàn #",
    "Mat #"
  ],
  [
    "Dẫn Đường",
    "Auto-Walk"
  ],
  [
    "Tĩnh Lặng",
    "Serene"
  ],
  [
    "Sắc phục:",
    "Vestment:"
  ],
  [
    "Còn thiếu",
    "Remaining"
  ],
  [
    "1. Chờ ký",
    "1. Sign"
  ],
  [
    "2. Đã gửi",
    "2. Sent"
  ],
  [
    "Xác nhận:",
    "Confirmations:"
  ],
  [
    "Chỉnh sửa",
    "Edit"
  ],
  [
    "Xóa hồ sơ",
    "Clear Profile"
  ],
  [
    "Sinh ngày",
    "Born"
  ],
  [
    "Tổng Quan",
    "Overview"
  ],
  [
    "quy đổi ≈",
    "approx. ≈"
  ],
  [
    "Thông Báo",
    "Notice"
  ],
  [
    "Sổ Tu Tập",
    "Streak"
  ],
  [
    "Di chuyển",
    "Move"
  ],
  [
    "Tương tác",
    "Interact"
  ],
  [
    "Tọa thiền",
    "Meditate"
  ],
  [
    "Đang chọn",
    "Selected"
  ],
  [
    "đang chọn",
    "selected"
  ],
  [
    "Thái Bình",
    "Thai Binh"
  ],
  [
    "Vô Thường",
    "Impermanence"
  ],
  [
    "Phật Ngọc",
    "Emerald Buddha"
  ],
  [
    "Hoàng Gia",
    "Royal"
  ],
  [
    "Bình Minh",
    "Dawn"
  ],
  [
    "Pháp Luân",
    "Dharma Wheel"
  ],
  [
    "KẾT DUYÊN",
    "BLESSED BOND"
  ],
  [
    "TỔNG QUAN",
    "OVERVIEW"
  ],
  [
    "Sinh năm:",
    "Birth Year:"
  ],
  [
    "Niên vận:",
    "Annual Star:"
  ],
  [
    "(Âm lịch)",
    "(Lunar)"
  ],
  [
    "Thủy Diệu",
    "Thuy Dieu (Water Star)"
  ],
  [
    "Thái Bạch",
    "Thai Bach (Metal Star)"
  ],
  [
    "Đồng hành",
    "Same Element"
  ],
  [
    "Tương Tác",
    "Interact"
  ],
  [
    "Thời gian",
    "Time of Day"
  ],
  [
    "Hoàng hôn",
    "Sunset"
  ],
  [
    "Dừng bước",
    "Stop"
  ],
  [
    " Âm Lịch",
    " Lunar"
  ],
  [
    "Việt Nam",
    "Vietnam"
  ],
  [
    "Nhật Bản",
    "Japan"
  ],
  [
    "Thái Lan",
    "Thailand"
  ],
  [
    "Hàn Quốc",
    "South Korea"
  ],
  [
    "Đài Loan",
    "Taiwan"
  ],
  [
    "Tây Tạng",
    "Tibet"
  ],
  [
    "Đang mặc",
    "Equipped"
  ],
  [
    "Mặc định",
    "Default"
  ],
  [
    "Miễn phí",
    "Free"
  ],
  [
    "Chân Như",
    "Legendary"
  ],
  [
    "Giác Ngộ",
    "Epic"
  ],
  [
    "Tinh Tấn",
    "Rare"
  ],
  [
    "Triết Lý",
    "Wisdom"
  ],
  [
    "Giờ sinh",
    "Birth Hour"
  ],
  [
    "Đại Hung",
    "Major Caution"
  ],
  [
    "Bình Hòa",
    "Balanced"
  ],
  [
    "Hỏi thầy",
    "Ask Abbot"
  ],
  [
    "An nhiên",
    "Serene"
  ],
  [
    "Tạm Dừng",
    "Pause"
  ],
  [
    "Sẵn Sàng",
    "Ready"
  ],
  [
    "Đang ngự",
    "Active"
  ],
  [
    "Hoàn tất",
    "Completed"
  ],
  [
    "Dài nhất",
    "Best Streak"
  ],
  [
    "Cột mốc ",
    "Milestone "
  ],
  [
    "Đã nhận:",
    "Received:"
  ],
  [
    "Nam mệnh",
    "Male (Yang)"
  ],
  [
    "Nam Mệnh",
    "Male (Yang)"
  ],
  [
    "Tuổi mụ:",
    "Lunar age:"
  ],
  [
    "chủ đề):",
    "topics):"
  ],
  [
    "Môn bói:",
    "Subject:"
  ],
  [
    "Nam giới",
    "Male"
  ],
  [
    "Gieo Lại",
    "Draw Again"
  ],
  [
    "Bản Mệnh",
    "Destiny"
  ],
  [
    "Bình hòa",
    "Balanced"
  ],
  [
    "[Nghịch]",
    "[Challenging]"
  ],
  [
    "Bản mệnh",
    "Destiny"
  ],
  [
    "Cung phi",
    "Trigram"
  ],
  [
    "Giờ Thìn",
    "Chen Hour (Dragon)"
  ],
  [
    "Giờ Thân",
    "Shen Hour (Monkey)"
  ],
  [
    "Giờ Tuất",
    "Xu Hour (Dog)"
  ],
  [
    "Xả thiền",
    "End meditation"
  ],
  [
    "Cần 5 MC",
    "Requires 5 MC"
  ],
  [
    "Đóng cửa",
    "Close door"
  ],
  [
    "Tơ Duyên",
    "Matchmaking"
  ],
  [
    "Hầu Đồng",
    "Mediumship"
  ],
  [
    "Cửa Hàng",
    "Shop"
  ],
  [
    "Công Đức",
    "Merit"
  ],
  [
    "Pháp đàm",
    "Sangha chat"
  ],
  [
    "Ngày mai",
    "Tomorrow"
  ],
  [
    "Làng Mai",
    "Plum Village"
  ],
  [
    "Bắt buộc",
    "Required"
  ],
  [
    "Trúc Lâm",
    "Truc Lam"
  ],
  [
    "Tâm Kinh",
    "Heart Sutra"
  ],
  [
    "Suối Yến",
    "Yen Stream"
  ],
  [
    "Hiện Tại",
    "Present Moment"
  ],
  [
    "Thư Pháp",
    "Calligraphy"
  ],
  [
    "Lộc Uyển",
    "Deer Park"
  ],
  [
    "Niết Bàn",
    "Nirvana"
  ],
  [
    "Nhất Tâm",
    "One Mind"
  ],
  [
    "Bản Thân",
    "Yourself"
  ],
  [
    "VẠN CẢNH",
    "VAN CANH"
  ],
  [
    "THIỀN TỰ",
    "SANCTUARY"
  ],
  [
    "ĐẠI HUNG",
    "MAJOR CAUTION"
  ],
  [
    "Âm lịch:",
    "Lunar:"
  ],
  [
    "Hành Giả",
    "Pilgrim"
  ],
  [
    "Hiển thị",
    "Display"
  ],
  [
    "Ban ngày",
    "Daylight"
  ],
  [
    "Góc nhìn",
    "Camera View"
  ],
  [
    "Nhân vật",
    "Character"
  ],
  [
    "Ngôn ngữ",
    "Language"
  ],
  [
    "Phím tắt",
    "Hotkeys"
  ],
  [
    "Đồng tu:",
    "Pilgrims:"
  ],
  [
    "Cổ phục",
    "Attire"
  ],
  [
    "Thỉnh (",
    "Buy ("
  ],
  [
    "Bậc III",
    "Tier III"
  ],
  [
    "Đại Cát",
    "Great Fortune"
  ],
  [
    "Hít vào",
    "Inhale"
  ],
  [
    "Giữ hơi",
    "Hold"
  ],
  [
    "Hoan hỉ",
    "Joyful"
  ],
  [
    "Sở hữu:",
    "Owned:"
  ],
  [
    "Chưa Mở",
    "Locked"
  ],
  [
    "Chưa mở",
    "Locked"
  ],
  [
    "Hít Vào",
    "Inhale"
  ],
  [
    "Giữ Hơi",
    "Hold"
  ],
  [
    "Sắp hầu",
    "Upcoming"
  ],
  [
    "Đã góp ",
    "Contributed "
  ],
  [
    "Thử lại",
    "Retry"
  ],
  [
    "Kết Nối",
    "Connect"
  ],
  [
    "Cài Đặt",
    "Install"
  ],
  [
    "Làm mới",
    "Refresh"
  ],
  [
    "Bạn trả",
    "You pay"
  ],
  [
    "4. Xong",
    "4. Done"
  ],
  [
    "· Đơn #",
    "· Order #"
  ],
  [
    "Nữ mệnh",
    "Female (Yin)"
  ],
  [
    "Nữ Mệnh",
    "Female (Yin)"
  ],
  [
    "tuổi mụ",
    "lunar age"
  ],
  [
    "Nữ giới",
    "Female"
  ],
  [
    "Mặc thử",
    "Preview"
  ],
  [
    "[Thuận]",
    "[Favorable]"
  ],
  [
    "Giờ Sửu",
    "Chou Hour (Ox)"
  ],
  [
    "Giờ Dần",
    "Yin Hour (Tiger)"
  ],
  [
    "Giờ Mão",
    "Mao Hour (Rabbit)"
  ],
  [
    "Giờ Ngọ",
    "Wu Hour (Horse)"
  ],
  [
    "Giờ Mùi",
    "Wei Hour (Goat)"
  ],
  [
    "Giờ Dậu",
    "You Hour (Rooster)"
  ],
  [
    "Giờ Hợi",
    "Hai Hour (Pig)"
  ],
  [
    "vừa đến",
    "just arrived"
  ],
  [
    "Bói Quẻ",
    "Divination"
  ],
  [
    "Thẻ Bài",
    "Cards"
  ],
  [
    "Âm Cảnh",
    "Soundscape"
  ],
  [
    "Đồng Tu",
    "Pilgrims"
  ],
  [
    "Thỉnh \"",
    "Buy \""
  ],
  [
    "từ giá ",
    "from Stage "
  ],
  [
    "Đi chậm",
    "Walk slowly"
  ],
  [
    "ĐỒNG TU",
    "PILGRIMS"
  ],
  [
    "Hôm nay",
    "Today"
  ],
  [
    "Lại gần",
    "Walk Closer"
  ],
  [
    "Lễ phẩm",
    "Offering"
  ],
  [
    "đang đi",
    "walking"
  ],
  [
    "Quan Âm",
    "Guanyin"
  ],
  [
    "Trí Tuệ",
    "Wisdom"
  ],
  [
    "Mạc Phủ",
    "Shogunate"
  ],
  [
    "Trà Đạo",
    "Way of Tea"
  ],
  [
    "Vườn Đá",
    "Rock Garden"
  ],
  [
    "Mộc Bản",
    "Woodblocks"
  ],
  [
    "Tháp Đá",
    "Stone Pagoda"
  ],
  [
    "Tào Khê",
    "Jogye"
  ],
  [
    "ĐẠI CÁT",
    "GREAT FORTUNE"
  ],
  [
    "(Nhuận)",
    "(Leap)"
  ],
  [
    "Chưa rõ",
    "Unknown"
  ],
  [
    "Thái Âm",
    "Thai Am (Moon Star)"
  ],
  [
    "Mộc Đức",
    "Moc Duc (Wood Virtue Star)"
  ],
  [
    "Vân Hán",
    "Van Han (Fire Star)"
  ],
  [
    "Ngày Tu",
    "Streak"
  ],
  [
    "Ban đêm",
    "Night"
  ],
  [
    "Chưa có",
    "None"
  ],
  [
    "Xin Xăm",
    "Fortune"
  ],
  [
    "Rằm · ",
    "Full Moon · "
  ],
  [
    "Lễ vật",
    "Offering"
  ],
  [
    "Tất Cả",
    "All"
  ],
  [
    "Bậc IV",
    "Tier IV"
  ],
  [
    "Bậc II",
    "Tier II"
  ],
  [
    "Thở ra",
    "Exhale"
  ],
  [
    "Đã mở:",
    "Revealed:"
  ],
  [
    "BẬT ÂM",
    "UNMUTE"
  ],
  [
    "Thở Ra",
    "Exhale"
  ],
  [
    "4. Lỗi",
    "4. Error"
  ],
  [
    "có sẵn",
    "available"
  ],
  [
    "Giờ Tý",
    "Zi Hour (Rat)"
  ],
  [
    "Giờ Tỵ",
    "Si Hour (Snake)"
  ],
  [
    "Sen nở",
    "Lotus bloom"
  ],
  [
    "đã tới",
    "arrived"
  ],
  [
    "Mở cửa",
    "Open door"
  ],
  [
    "Thường",
    "Common"
  ],
  [
    "Nạp MC",
    "Top Up MC"
  ],
  [
    "Tâm An",
    "Serenity"
  ],
  [
    "Yên Tử",
    "Yen Tu"
  ],
  [
    "Cầu An",
    "Peace Prayer"
  ],
  [
    "Vô Ngã",
    "Non-Self"
  ],
  [
    "Gốm Sứ",
    "Porcelain"
  ],
  [
    "An Lạc",
    "Peace"
  ],
  [
    "Hải Ấn",
    "Ocean Mudra"
  ],
  [
    "Thổ Tú",
    "Tho Tu (Earth Star)"
  ],
  [
    "La Hầu",
    "La Hau (Rahu Star)"
  ],
  [
    "Thẻ số",
    "Stick #"
  ],
  [
    "Nghịch",
    "Challenging"
  ],
  [
    "Đồ họa",
    "Graphics"
  ],
  [
    "Độ cao",
    "Altitude"
  ],
  [
    "Bản đồ",
    "Map"
  ],
  [
    "Hồ Sen",
    "Lotus Pond"
  ],
  [
    "Phím 1",
    "Key 1"
  ],
  [
    "Phím 2",
    "Key 2"
  ],
  [
    "Phím 3",
    "Key 3"
  ],
  [
    "Ấn Độ",
    "India"
  ],
  [
    "Cổ Tự",
    "Temple"
  ],
  [
    "Bậc I",
    "Tier I"
  ],
  [
    "Đã Có",
    "Owned"
  ],
  [
    "TỔNG:",
    "MASTER:"
  ],
  [
    "· Năm",
    "· Year of"
  ],
  [
    "Thiền",
    "Meditation"
  ],
  [
    "Chuột",
    "Mouse"
  ],
  [
    "+ Nạp",
    "+ Top Up"
  ],
  [
    "Gỗ Cổ",
    "Ancient Timber"
  ],
  [
    "Từ Bi",
    "Compassion"
  ],
  [
    "Kế Đô",
    "Ke Do (Ketu Star)"
  ],
  [
    "Thuận",
    "Favorable"
  ],
  [
    "Đóng",
    "Close"
  ],
  [
    "Ngắt",
    "Disconnect"
  ],
  [
    "Quà:",
    "Reward:"
  ],
  [
    "(Có:",
    "(Owned:"
  ],
  [
    "Nhảy",
    "Jump"
  ],
  [
    "hoặc",
    "or"
  ],
  [
    "Bước",
    "Step"
  ],
  [
    "Phút",
    "Min"
  ],
  [
    "Giây",
    "Sec"
  ],
  [
    "giây",
    "sec"
  ],
  [
    "ngày",
    "days"
  ],
  [
    "lượt",
    "times"
  ],
  [
    "Lượt",
    "Run"
  ],
  [
    "Chào",
    "Greet"
  ],
  [
    "Mở (",
    "Open ("
  ],
  [
    "MỨC:",
    "TIER:"
  ],
  [
    "BÌNH",
    "BALANCED"
  ],
  [
    "Bình",
    "Balanced"
  ],
  [
    "Khảm",
    "Kan (Water)"
  ],
  [
    "Khôn",
    "Kun (Earth)"
  ],
  [
    "Chấn",
    "Zhen (Thunder)"
  ],
  [
    "Đoài",
    "Dui (Lake)"
  ],
  [
    "Thủy",
    "Water"
  ],
  [
    "Cao:",
    "Alt:"
  ],
  [
    " ÂL",
    " Lunar"
  ],
  [
    "BẠN",
    "YOU"
  ],
  [
    "GIÁ",
    "STAGE"
  ],
  [
    "Giá",
    "Stage"
  ],
  [
    "Giờ",
    "Hr"
  ],
  [
    "Thẻ",
    "Cards"
  ],
  [
    "thẻ",
    "cards"
  ],
  [
    "Còn",
    "Left"
  ],
  [
    "Gởi",
    "Send"
  ],
  [
    "Gửi",
    "Send"
  ],
  [
    "Hủy",
    "Cancel"
  ],
  [
    "Nam",
    "Male"
  ],
  [
    "Lỗi",
    "Error"
  ],
  [
    "Bắc",
    "N"
  ],
  [
    "CÁT",
    "AUSPICIOUS"
  ],
  [
    "Cát",
    "Auspicious"
  ],
  [
    "Tốn",
    "Xun (Wind)"
  ],
  [
    "Càn",
    "Qian (Heaven)"
  ],
  [
    "Cấn",
    "Gen (Mountain)"
  ],
  [
    "Mộc",
    "Wood"
  ],
  [
    "Hỏa",
    "Fire"
  ],
  [
    "Thổ",
    "Earth"
  ],
  [
    "Mở",
    "Open"
  ],
  [
    "Nữ",
    "Female"
  ]
]

const VI_CHAR_RE = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i
const NO_DIACRITIC_VI = new Set(['Nam', 'Chao', 'Loa'])

function hasVietnamese(input: string): boolean {
  if (!input) return false
  if (VI_CHAR_RE.test(input)) return true
  return NO_DIACRITIC_VI.has(input.trim())
}

const origTextMap = new WeakMap<Text, string>()
const lastEnTextMap = new WeakMap<Text, string>()
const origAttrMap = new WeakMap<Element, Record<string, string>>()
const lastEnAttrMap = new WeakMap<Element, Record<string, string>>()

const ATTRS = ['title', 'placeholder', 'aria-label', 'label', 'alt'] as const

export function translateViToEn(input: string): string {
  if (!input || !hasVietnamese(input)) return input
  let out = input
  for (const [vi, en] of PHRASE_PAIRS) {
    if (out.includes(vi)) {
      out = out.split(vi).join(en)
    }
  }
  return out
}

function processTextNode(node: Text, isEn: boolean) {
  const cur = node.data
  if (!cur || !cur.trim()) return

  if (isEn) {
    const knownEn = lastEnTextMap.get(node)
    if (cur === knownEn) return
    if (!hasVietnamese(cur)) return
    origTextMap.set(node, cur)
    const en = translateViToEn(cur)
    lastEnTextMap.set(node, en)
    if (node.data !== en) node.data = en
  } else {
    const knownEn = lastEnTextMap.get(node)
    const orig = origTextMap.get(node)
    if (orig !== undefined && cur === knownEn) {
      node.data = orig
    }
  }
}

function processElementAttrs(el: Element, isEn: boolean) {
  let origs = origAttrMap.get(el)
  let lastEns = lastEnAttrMap.get(el)
  for (const attr of ATTRS) {
    const val = el.getAttribute(attr)
    if (!val || !val.trim()) continue
    if (isEn) {
      if (lastEns && val === lastEns[attr]) continue
      if (!hasVietnamese(val)) continue
      if (!origs) {
        origs = {}
        origAttrMap.set(el, origs)
      }
      if (!lastEns) {
        lastEns = {}
        lastEnAttrMap.set(el, lastEns)
      }
      origs[attr] = val
      const en = translateViToEn(val)
      lastEns[attr] = en
      if (val !== en) el.setAttribute(attr, en)
    } else {
      if (origs && lastEns && val === lastEns[attr] && origs[attr] !== undefined) {
        el.setAttribute(attr, origs[attr]!)
      }
    }
  }
}

function walkSubtree(root: Node, isEn: boolean) {
  if (root.nodeType === Node.TEXT_NODE) {
    processTextNode(root as Text, isEn)
    return
  }
  if (root.nodeType !== Node.ELEMENT_NODE) return
  const el = root as Element
  const tag = el.tagName
  if (tag === 'SCRIPT' || tag === 'STYLE') return

  processElementAttrs(el, isEn)
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT)
  let current: Node | null = walker.nextNode()
  while (current) {
    if (current.nodeType === Node.TEXT_NODE) {
      processTextNode(current as Text, isEn)
    } else if (current.nodeType === Node.ELEMENT_NODE) {
      processElementAttrs(current as Element, isEn)
    }
    current = walker.nextNode()
  }
}

let initialized = false

export function initDomTranslator() {
  if (initialized || typeof window === 'undefined' || typeof document === 'undefined') return
  initialized = true

  let applying = false
  const applyAll = () => {
    if (applying || !document.body) return
    applying = true
    try {
      walkSubtree(document.body, currentLocale.value === 'en')
    } finally {
      applying = false
    }
  }

  watch(
    currentLocale,
    () => {
      applyAll()
      void nextTick(() => {
        applyAll()
        if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
          window.requestAnimationFrame(() => applyAll())
        }
      })
    },
    { flush: 'post', immediate: true }
  )

  const observer = new MutationObserver((mutations) => {
    if (applying || currentLocale.value !== 'en') return
    applying = true
    try {
      for (const m of mutations) {
        if (m.type === 'characterData' && m.target.nodeType === Node.TEXT_NODE) {
          processTextNode(m.target as Text, true)
        } else if (m.type === 'attributes' && m.target.nodeType === Node.ELEMENT_NODE) {
          processElementAttrs(m.target as Element, true)
        } else if (m.type === 'childList') {
          m.addedNodes.forEach((n) => walkSubtree(n, true))
        }
      }
    } finally {
      applying = false
    }
  })

  const observeOpts: MutationObserverInit = {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ['title', 'placeholder', 'aria-label', 'label', 'alt']
  }

  if (document.body) {
    observer.observe(document.body, observeOpts)
  } else {
    window.addEventListener(
      'DOMContentLoaded',
      () => {
        applyAll()
        observer.observe(document.body, observeOpts)
      },
      { once: true }
    )
  }
}
