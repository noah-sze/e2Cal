// ============================================================================
// e2Cal 權威領域雙語別名庫 (Authoritative Multilingual & Fitness Slang Registry)
// 涵蓋飲食兩岸三地異名同物對照表、健身動作權威縮寫與黑話
// 純前端記憶體靜態常數索引，零 DB 存儲開銷，體積嚴控 < 30KB
// ============================================================================

import { DEFAULT_EXERCISE_IDS } from '@/services/db/defaultExercises';

// ----------------------------------------------------------------------------
// 1. 食物名稱同義詞對照群組 (Food Synonym Groups)
// 確保使用者輸入組內任何一個名稱（如紅薯、番薯），皆可精準穿透檢索到官方權威數據庫中的叫法（如地瓜、甘薯、Sweet Potato）
// ----------------------------------------------------------------------------
export const FOOD_SYNONYM_GROUPS: readonly (readonly string[])[] = [
  ['番茄', '牛番茄', '西紅柿', '洋柿子', '蕃茄', '柑仔蜜', 'tomato', 'tomatoes'],
  ['小番茄', '聖女果', '櫻桃番茄', '小西紅柿', '聖女番茄', 'cherry tomato'],
  ['馬鈴薯', '土豆', '洋芋', '地蛋', '薯仔', 'potato', 'potatoes', 'spud'],
  ['花椰菜', '白花菜', '白花椰菜', '菜花', '花菜', '椰菜花', 'cauliflower'],
  ['青花菜', '西藍花', '西蘭花', '綠花椰', '綠花椰菜', '綠花菜', '花西蘭', 'fsl', 'xlh', 'broccoli'],
  ['鮭魚', '三文魚', '大西洋鮭', '大西洋鮭魚', '撒蒙魚', 'salmon'],
  ['酪梨', '牛油果', '鱷梨', '油梨', '樟梨', 'avocado'],
  ['奇異果', '綠奇異果', '獼猴桃', '藤梨', '陽桃', 'kiwi', 'kiwifruit'],
  ['黃金奇異果', '金奇異果', '黃金獼猴桃', 'golden kiwi'],
  ['高麗菜', '捲心菜', '包菜', '圓白菜', '甘藍', '椰菜', 'cabbage'],
  ['鮪魚', '金槍魚', '黃鰭鮪魚', '吞拿魚', '金槍', '黃鰭金槍魚', 'tuna'],
  ['鳳梨', '菠蘿', '黃梨', 'pineapple'],
  ['柳橙', '橙子', '柳丁', '甜橙', '香橙', 'orange'],
  ['奇亞籽', '芡歐鼠尾草籽', '奇雅子', 'chia seeds', 'chia'],
  ['燕麥片', '大燕麥片', '純麥片', '麥片', '燕麥', 'oats', 'oatmeal', 'rolled oats'],
  ['燕麥米', '燕麥粒', '全燕麥', 'oat groats'],
  ['希臘優格', '希臘酸奶', '脫乳清酸奶', '脱乳清酸奶', '希臘式優格', '希臘式酸奶', 'greek yogurt'],
  ['茅屋乳酪', '茅屋起司', '茅屋芝士', '鄉村奶酪', '鄉村起司', 'cottage cheese'],
  ['地瓜', '黃金地瓜', '紅薯', '番薯', '山芋', '白薯', 'sweet potato', 'yam'],
  ['紫地瓜', '紫薯', '紫心番薯', 'purple sweet potato'],
  ['青椒', '綠青椒', '菜椒', 'green bell pepper'],
  ['紅甜椒', '彩椒', '紅椒', '甜椒', '柿子椒', 'red bell pepper'],
  ['黃甜椒', '彩椒', '黃椒', '甜椒', 'yellow bell pepper'],
  ['杏鮑菇', '刺芹側耳', '雪茸', '鳳尾菇', 'king oyster mushroom'],
  ['菠菜', '菠菱菜', '赤根菜', '波斯草', 'spinach'],
  ['蘿蔓', '羅蔓', '羅蔓生菜', '長葉萵苣', 'romaine', 'romaine lettuce'],
  ['結球萵苣', '美生菜', '生菜', '包心生菜', '圓生菜', 'iceberg lettuce'],
  ['油麥菜', '大陸妹', '葉用萵苣', 'A菜', 'ａ菜', 'a菜', '鵝仔菜', '妹仔菜', 'youmai', 'youmaicai'],
  ['蘆筍', '綠蘆筍', '龍鬚菜', '露筍', '石刁柏', 'asparagus'],
  ['白蘆筍', 'white asparagus'],
  ['櫛瓜', '西葫蘆', '翠玉瓜', '美洲南瓜', '角瓜', '筍瓜', 'zucchini', 'courgette'],
  ['西葫蘆', '西葫蘆瓜', 'chinese squash'],
  ['洋菇', '白蘑菇', '雙孢蘑菇', '蘑菇', '洋蕈', 'button mushroom', 'mushroom', 'champignon'],
  ['玉米', '玉米粒', '甜玉米', 'corn', 'sweet corn'],
  ['四季豆', '敏豆', '菜豆', '豆角', '雲豆', '刀豆', 'green beans', 'snap beans'],
  ['豇豆', '長豆', '長豆角', 'yardlong bean'],
  ['毛豆', '毛豆仁', '枝豆', '菜用大豆', '綠大豆', 'edamame'],
  ['鱈魚', '大西洋鱈', '黑線鱈', '鱈狹鱈', '帶骨鱈魚', '鱈魚切片', 'cod', 'codfish'],
  ['鱈魚排', '鱈魚片', '無刺鱈魚排', '無刺鱈魚片', '去骨鱈魚', 'cod fillet'],
  ['鯖魚', '青花魚', '鯖', '青佔魚', '挪威鯖魚', 'mackerel'],
  ['鮁魚', '藍點馬鮫', '馬鮫魚', 'spanish mackerel'],
  ['鯛魚片', '台灣鯛', '吳郭魚', '羅非魚', 'tilapia fillet', 'tilapia'],
  ['真鯛', '加吉魚', '銅盆魚', '紅鯛', '黑鯛', 'red seabream', 'sea bream', 'snapper'],
  ['鱸魚', '花鱸', '海鱸', '七星鱸', '金目鱸', '日本花鱸', '全魚鱸魚', 'sea bass', 'perch'],
  ['鱸魚排', '鱸魚片', '無刺鱸魚排', '無刺鱸魚片', '金目鱸魚排', 'sea bass fillet'],
  ['蝦仁', '鮮蝦', '蝦肉', '海蝦仁', '白蝦仁', 'shrimp', 'prawn'],
  ['草蝦', '黑虎蝦', '草蝦仁', 'black tiger prawn'],
  ['泰國蝦', '羅氏沼蝦', '大頭蝦', 'giant freshwater prawn'],
  ['干貝', '扇貝', '帶子', '瑤柱', '元貝', 'scallops', 'scallop'],
  ['蛤蜊', '文蛤', '蛤子', '蚧', '蛤仔', '花蛤', '白蛤', 'clam', 'clams'],
  ['海瓜子', '花蛤', 'short-necked clam'],
  ['牡蠣', '生蠔', '蚵仔', '海蠣', '蠣白', 'oyster', 'oysters'],
  ['魷魚', '花枝', '烏賊', '墨魚', '魷魚鬚', '透抽', 'squid', 'calamari'],
  ['軟絲', '大尾魷', 'bigfin reef squid'],
  ['花枝', '墨魚', '烏賊', 'cuttlefish'],
  ['章魚', '八爪魚', '八帶', '鮞', 'octopus'],
  ['雞胸肉', '雞胸', '雞肉', '去皮雞胸', '雞胸肉生', 'chicken breast', 'chicken'],
  ['雞里肌', '雞柳', '雞小胸', 'chicken tenderloin'],
  ['去皮雞腿', '去皮雞腿肉', '雞腿', '雞腿肉', '去皮去骨雞腿', '去骨雞腿排', '雞扒肉', 'chicken thigh', 'skinless chicken thigh'],
  ['帶皮雞腿', '帶皮雞腿肉', '雞腿帶皮', '雞腿肉帶皮', '帶皮雞腿排', 'chicken thigh with skin'],
  ['去皮鴨腿', '去皮鴨腿肉', '鴨腿', '鴨腿肉', '去皮去骨鴨腿', '去骨鴨腿', 'duck leg skinless', 'skinless duck leg'],
  ['帶皮鴨腿', '帶皮鴨腿肉', '鴨腿帶皮', '鴨腿肉帶皮', '鴨腿', 'duck leg with skin'],
  ['牛菲力', '牛里脊', '菲力', '菲力牛排', '牛柳', '牛柳肉', 'tenderloin', 'filet mignon'],
  ['牛板腱', '嫩肩里肌', '板腱', '牡蠣肉', '三叉肉', '板腱牛排', 'flat iron', 'blade steak'],
  ['牛腱肉', '牛腱', '牛腱子', '牛腱心', '腱子肉', 'beef shank'],
  ['豬里肌', '豬里脊', '豬大排', '里肌肉', '腰內肉', '純瘦肉', '豬柳', 'pork loin', 'pork tenderloin'],
  ['腰內肉', '小里肌', '豬小里肌', 'pork fillet'],
  ['豬後腿肉', '瘦豬肉', '腿肉', '後腿瘦肉', 'pork leg lean', 'pork ham'],
  ['豬前腿瘦肉', '前腿肉', 'pork front leg'],
  ['鷹嘴豆', '雞豆', '雪蓮子', '桃爾豆', '馬豆', 'chickpeas', 'garbanzo'],
  ['豆腐', '板豆腐', '老豆腐', '水豆腐', 'firm tofu', 'tofu', 'bean curd'],
  ['嫩豆腐', '絹豆腐', '水豆腐', 'silken tofu'],
  ['內酯豆腐', '盒裝嫩豆腐', 'lactone tofu'],
  ['豆干', '大豆干', '白豆干', 'dried tofu'],
  ['豆漿', '無糖豆漿', '豆奶', '大豆漿', 'soy milk', 'soymilk'],
  ['杏仁', '杏仁果', '巴旦木', '美國大杏仁', '扁桃仁', 'almonds', 'almond'],
  ['巴旦木', '新疆巴旦木', 'badanmu'],
  ['核桃', '核桃仁', '胡桃', '胡桃仁', '羌桃', 'walnuts', 'walnut'],
  ['花生', '花生仁', '落花生', '長生果', '地豆', 'peanuts', 'peanut'],
  ['空心菜', '蕹菜', '藤藤菜', '通菜', '竹葉菜', '空筒菜', 'water spinach', 'ong choy'],
  ['大白菜', '白菜', '結球白菜', '包心白菜', '黃芽菜', '膠州白菜', 'chinese cabbage', 'napa cabbage'],
  ['娃娃菜', '小白菜芯', '微型白菜', 'baby napa cabbage'],
  ['青江菜', '江門白菜', '上海青', '油菜', '小油菜', '青菜', '黑油菜', '湯匙菜', 'bok choy', 'pak choi'],
  ['白肉火龍果', '白火龍果', '火龍果', '白心火龍果', '白心火龙果', '火龙果', '仙蜜果', 'white pitaya', 'dragon fruit'],
  ['紅肉火龍果', '紅火龍果', '紅心火龍果', '紅龍果', '红肉火龙果', '红心火龙果', '红龙果', 'red pitaya'],
  ['百香果', '熱情果', '西番蓮', '雞蛋果', '西番果', '百香', 'passion fruit', 'passionfruit'],
  ['葡萄柚', '西柚', '紅葡萄柚', '粉紅葡萄柚', '朱欒', 'grapefruit'],
  ['紅心柚', '紅肉蜜柚', '紅柚', '血柚', '紅心葡萄柚', 'red pomelo'],
  ['沙田柚', '白柚', '文旦', '文旦柚', '柚子', '蜜柚', 'pomelo'],
  ['沃柑', '沃柑橘', '沃桔', '晚熟柑橘', 'wogan', 'mandarin'],
  ['冬棗', '鮮棗', '凍棗', '冬枣', '鲜枣', '沾化冬棗', 'winter jujube', 'fresh jujube'],
  ['羊角蜜甜瓜', '羊角蜜', '羊角脆', '脆瓜', '香瓜', '甜瓜', 'crisp melon'],
  ['葡萄', '紅葡萄', '綠葡萄', '提子', '紅提', '巨峰', 'grape', 'grapes'],
  ['橘子', '椪柑', '柑橘', '柑仔', '蜜柑', '蘆柑', 'mandarin', 'tangerine'],
  ['陽光玫瑰葡萄', '陽光玫瑰', '香印青提', '晴王', '晴王葡萄', '青提', '綠葡萄', 'shine muscat'],
  ['巨峰葡萄', '巨峰', '黑葡萄', '紫葡萄', 'kyoho grape'],
  ['皮皮蝦', '皮皮蝦肉', '瀨尿蝦', '攋尿蝦', '蝦爬子', '螳螂蝦', '蝦蛄', '爬蝦', 'mantis shrimp'],
  ['基圍蝦', '沙蝦', '刀額新對蝦', '基围虾', 'sand shrimp'],
  ['青蝦', '河蝦', '日本沼蝦', '青虾', '河虾', 'river shrimp'],
  ['武昌魚', '鯿魚', '鲂魚', '團頭魴', '鳊鱼', 'wuchang bream'],
  ['鰻魚', '日本鰻', '白鱔', '鰻鱺', '白鳝', 'eel', 'freshwater eel'],
  ['沙丁魚', '沙丁', '沙甸魚', 'sardine', 'sardines'],
  ['巴沙魚', '巴沙魚柳', '多利魚', '龍利魚柳', '博氏巨鯰', '鯰魚柳', 'basa fillet', 'basa'],
  ['金針菇', '樸菇', '冬菇', '構菌', '凍菌', '金菇', 'enoki', 'enoki mushroom'],
  ['木耳', '黑木耳', '雲耳', '光木耳', '黑菜', 'wood ear', 'black fungus'],
  ['蓮藕', '藕', '蓮菜', '荷藕', 'lotus root'],
  ['山藥', '淮山', '山藥蛋', '薯蕷', '山薯', 'yam', 'chinese yam'],
  ['芋頭', '芋艿', '芋仔', '大薯', '毛芋', 'taro'],
  ['苦瓜', '涼瓜', '癩葡萄', '錦荔枝', 'bitter melon', 'bitter gourd'],
  ['絲瓜', '勝瓜', '菜瓜', '天羅', 'luffa', 'loofah'],
  ['冬瓜', '枕瓜', '白瓜', '東瓜', 'winter melon'],
  ['佛手瓜', '合手瓜', '隼人瓜', '拳頭瓜', 'chayote'],
  ['龍鬚菜', '佛手瓜苗', '淮山藤', 'chayote shoots'],
  ['豬蹄', '豬腳', '豬手', '蹄膀', '豬肘', '豬蹄爪', 'pork trotters', 'pig feet'],
  ['牛腩', '牛腩肉', '牛胸腹肉', '牛腩塊', 'beef flank', 'beef brisket'],
  ['松阪豬', '松坂豬', '松阪肉', '松坂肉', '雪花肉', '豬頸肉', '黃金六兩', 'pork neck', 'pork jowl'],
  ['萵筍', '嫩莖萵苣', '萵筍苔', '萵苣筍', '青筍', '萵菜', 'celtuce', 'stem lettuce'],
  ['蒜黃', '蒜黃菜', '黃蒜', '軟化蒜苗', 'yellow garlic chives'],
  ['韭菜', '起陽草', '草鐘乳', '長生韭', 'chinese chives'],
  ['韭菜花', '韭菜苔', '韭花', 'chive flower'],
  ['蒜苗', '青蒜', '大蒜苗', 'green garlic'],
  ['蒜苔', '蒜薹', '蒜毫', 'garlic scapes'],
  ['芭樂', '番石榴', '拔仔', '吉卜', 'guava'],
  ['紅心芭樂', '紅心番石榴', '紅肉芭樂', '紅芭樂', 'red guava'],
  ['釋迦', '番荔枝', '佛頭果', 'sugar apple', 'sweetsop'],
  ['蓮霧', '爪哇蒲桃', '水蓊', 'wax apple', 'bell fruit'],
  ['木瓜', '萬壽果', '番木瓜', '石瓜', 'papaya'],
  ['香蕉', '弓蕉', '芭蕉', '金蕉', '甘蕉', 'banana'],
  ['芒果', '愛文芒果', '金煌芒果', '檨仔', 'mango'],
];

export const FOOD_ALIASES_REGISTRY: Record<string, readonly string[]> = {};

export const EXERCISE_ALIASES_REGISTRY: Record<string, readonly string[]> = {
  // 1. 槓鈴臥推 / BP / Bench Press / Bench
  [DEFAULT_EXERCISE_IDS.bench_press]: [
    '槓鈴臥推', '臥推', '平面臥推', '槓鈴平推', '平胸臥推',
    'bp', 'bench press', 'bench', 'barbell bench', 'barbell bench press',
  ],

  // 2. 啞鈴臥推 / DB Bench / Dumbbell Press
  [DEFAULT_EXERCISE_IDS.dumbbell_bench_press]: [
    '啞鈴臥推', '啞鈴平推', '啞鈴推胸',
    'db bench', 'dumbbell bench press', 'dumbbell press', 'dbbp', 'db press',
  ],

  // 3. 上斜槓鈴臥推 / Incline Bench / Incline Press
  [DEFAULT_EXERCISE_IDS.incline_barbell_bench_press]: [
    '上斜槓鈴臥推', '上斜推', '上斜臥推', '槓鈴上斜臥推',
    'incline bench', 'incline press', 'incline bp', 'incline barbell bench press',
  ],

  // 4. 槓鈴深蹲 / Squat / Back Squat / 深蹲
  [DEFAULT_EXERCISE_IDS.barbell_squat]: [
    '槓鈴深蹲', '深蹲', '後蹲', '背蹲', '槓蹲',
    'squat', 'back squat', 'barbell squat', 'bs',
  ],

  // 5. 前蹲舉 / Front Squat / FS
  [DEFAULT_EXERCISE_IDS.barbell_front_squat]: [
    '前蹲舉', '前蹲', '槓鈴前蹲', '槓鈴前深蹲',
    'front squat', 'fs', 'barbell front squat',
  ],

  // 6. 羅馬尼亞硬舉 / RDL / Romanian Deadlift
  [DEFAULT_EXERCISE_IDS.romanian_deadlift]: [
    '羅馬尼亞硬舉', '羅馬尼亞', '直腿硬舉', '直腿硬拉', '羅馬尼亞硬拉',
    'rdl', 'romanian deadlift', 'barbell rdl',
  ],
  [DEFAULT_EXERCISE_IDS.dumbbell_romanian_deadlift]: [
    '啞鈴羅馬尼亞硬舉', '啞鈴羅馬尼亞', '啞鈴直腿硬舉',
    'db rdl', 'dumbbell rdl', 'dumbbell romanian deadlift',
  ],

  // 7. 傳統硬舉 / DL / Deadlift / 硬拉
  [DEFAULT_EXERCISE_IDS.deadlift]: [
    '傳統硬舉', '硬舉', '傳統硬拉', '硬拉',
    'dl', 'deadlift', 'conventional deadlift',
  ],

  // 8. 相撲硬舉 / Sumo Deadlift
  [DEFAULT_EXERCISE_IDS.sumo_deadlift]: [
    '相撲硬舉', '相撲硬拉', '相撲',
    'sumo dl', 'sumo deadlift',
  ],

  // 9. 站姿槓鈴肩推 / 站姿槓鈴推舉 / OHP / Overhead Press / 軍事推舉 / 肩推
  [DEFAULT_EXERCISE_IDS.standing_overhead_press]: [
    '站姿槓鈴推舉', '站姿槓鈴肩推', '站姿肩推', '肩推', '軍事推舉', '站推', '槓鈴肩推',
    'ohp', 'overhead press', 'military press', 'standing shoulder press',
  ],

  // 10. 啞鈴肩推 / DB Shoulder Press / DB OHP
  [DEFAULT_EXERCISE_IDS.seated_dumbbell_overhead_press]: [
    '坐姿啞鈴推舉', '啞鈴肩推', '坐姿肩推', '啞鈴推舉', '啞鈴坐姿肩推',
    'db shoulder press', 'db ohp', 'db press', 'dumbbell shoulder press',
  ],
  [DEFAULT_EXERCISE_IDS.seated_barbell_overhead_press]: [
    '坐姿槓鈴推舉', '坐姿槓鈴肩推', 'seated barbell press',
  ],

  // 11. 引體向上 / Pull Up / Chin Up
  [DEFAULT_EXERCISE_IDS.pullups]: [
    '引體向上', '正握引體', '引體',
    'pull up', 'pullup', 'pull-up', 'pullups',
  ],
  [DEFAULT_EXERCISE_IDS.chinups]: [
    '反握引體向上', '反握引體', '正手引體',
    'chin up', 'chinup', 'chin-up', 'chinups',
  ],

  // 12. 滑輪下拉 / Lat Pulldown / 高位下拉
  [DEFAULT_EXERCISE_IDS.lat_pulldown]: [
    '滑輪下拉', '高位下拉', '下拉', '滑輪寬下拉',
    'lat pulldown', 'pulldown', 'cable pulldown',
  ],
  [DEFAULT_EXERCISE_IDS.close_grip_lat_pulldown]: [
    '窄握滑輪下拉', '窄握高位下拉', 'close grip lat pulldown',
  ],

  // 13. 俯身槓鈴划船 / BB Row / Barbell Row / 划船
  [DEFAULT_EXERCISE_IDS.barbell_row]: [
    '俯身槓鈴划船', '槓鈴划船', '划船', '俯身划船', '槓划',
    'bb row', 'barbell row', 'bent-over row', 'bent over row', 'barbell bent-over row',
  ],
  [DEFAULT_EXERCISE_IDS.pendlay_row]: [
    '潘德雷划船', '彭德利划船', 'pendlay row',
  ],

  // 14. 單臂啞鈴划船 / One-arm DB Row / DB Row
  [DEFAULT_EXERCISE_IDS.one_arm_dumbbell_row]: [
    '單臂啞鈴划船', '啞鈴划船', '單手划船', '單臂划船',
    'one-arm db row', 'db row', 'single arm db row', 'dumbbell row',
  ],

  // 15. 滑輪坐姿划船 / Cable Seated Row
  [DEFAULT_EXERCISE_IDS.seated_cable_row]: [
    '滑輪坐姿划船', '坐姿划船', '水平划船', '滑輪划船',
    'cable seated row', 'seated cable row', 'cable row', 'seated row',
  ],

  // 16. 啞鈴側平舉 / Lateral Raise / 側飛鳥
  [DEFAULT_EXERCISE_IDS.dumbbell_lateral_raise]: [
    '啞鈴側平舉', '側平舉', '側飛鳥', '飛鳥', '啞鈴側飛',
    'lateral raise', 'lat raise', 'side raise', 'side lateral raise',
  ],
  [DEFAULT_EXERCISE_IDS.cable_lateral_raise]: [
    '滑輪側平舉', '繩索側平舉', 'cable lateral raise',
  ],

  // 17. 雙槓屈臂伸 / Dips
  [DEFAULT_EXERCISE_IDS.dips]: [
    '雙槓屈臂伸', '雙槓臂屈伸', '雙槓撐體', '雙槓推', '屈臂伸',
    'dips', 'chest dips', 'tricep dips', 'dip',
  ],
  [DEFAULT_EXERCISE_IDS.bench_dips]: [
    '仰臥臂屈伸', '長凳雙槓屈臂伸', 'bench dips',
  ],

  // 18. 槓鈴二頭彎舉 / BB Curl
  [DEFAULT_EXERCISE_IDS.barbell_curl]: [
    '槓鈴二頭彎舉', '槓鈴彎舉', '二頭彎舉', '彎舉',
    'bb curl', 'barbell curl', 'barbell bicep curl',
  ],
  [DEFAULT_EXERCISE_IDS.ez_bar_curl]: [
    'ez槓二頭彎舉', '曲桿彎舉', 'ez bar curl',
  ],

  // 19. 啞鈴二頭彎舉 / DB Curl
  [DEFAULT_EXERCISE_IDS.dumbbell_curl]: [
    '啞鈴二頭彎舉', '啞鈴彎舉', '二頭啞鈴彎舉',
    'db curl', 'dumbbell curl', 'dumbbell bicep curl',
  ],

  // 20. 啞鈴錘式彎舉 / Hammer Curl / DB Hammer Curl
  [DEFAULT_EXERCISE_IDS.dumbbell_hammer_curl]: [
    '啞鈴錘式彎舉', '錘式彎舉', '鐵錘彎舉', '槌式彎舉', '錘式', '槌式',
    'hammer curl', 'db hammer curl', 'dumbbell hammer curl',
  ],

  // 21. 滑輪三頭下壓 / Triceps Pushdown
  [DEFAULT_EXERCISE_IDS.triceps_pushdown]: [
    '滑輪三頭下壓', '繩索三頭下壓', '繩索下壓', '滑輪下壓', '三頭下壓',
    'triceps pushdown', 'cable pushdown', 'pushdown',
  ],
  [DEFAULT_EXERCISE_IDS.rope_triceps_pushdown]: [
    '繩索三頭下壓', '繩索下壓', 'rope triceps pushdown',
  ],

  // 22. 仰臥三頭臂屈伸 / Skull Crusher / 法式推舉
  [DEFAULT_EXERCISE_IDS.lying_triceps_extension]: [
    '仰臥三頭臂屈伸', '仰臥槓鈴臂屈伸', '法式推舉', '碎頭者', '三頭臂屈伸',
    'skull crusher', 'skullcrusher', 'french press', 'lying triceps extension',
  ],

  // 23. 機械腿推機 / Leg Press / 倒蹬機 / 腿推
  [DEFAULT_EXERCISE_IDS.leg_press]: [
    '機械腿推機', '腿推機', '倒蹬機', '腿推', '腿推舉', '倒蹬',
    'leg press', '45 degree leg press',
  ],

  // 24. 坐姿腿伸展機 / Leg Extension / 腿伸展
  [DEFAULT_EXERCISE_IDS.leg_extension]: [
    '坐姿腿伸展機', '腿伸展', '踢腿機', '伸腿機', '腿屈伸',
    'leg extension', 'quad extension',
  ],

  // 25. 俯臥腿彎舉 / Leg Curl
  [DEFAULT_EXERCISE_IDS.leg_curl]: [
    '俯臥腿彎舉', '勾腿機', '勾腿', '腿彎曲', '腿彎舉',
    'leg curl', 'lying leg curl', 'hamstring curl',
  ],
  [DEFAULT_EXERCISE_IDS.seated_leg_curl]: [
    '坐姿腿彎舉', '坐姿勾腿', 'seated leg curl',
  ],

  // 26. 槓鈴臀推 / Hip Thrust
  [DEFAULT_EXERCISE_IDS.barbell_hip_thrust]: [
    '槓鈴臀推', '臀橋', '臀推', '臀衝',
    'hip thrust', 'barbell hip thrust',
  ],
  [DEFAULT_EXERCISE_IDS.smith_machine_hip_thrust]: [
    '史密斯臀推', 'smith hip thrust',
  ],

  // 27. 保加利亞分腿蹲 / BSS / Bulgarian Split Squat
  [DEFAULT_EXERCISE_IDS.bulgarian_split_squat]: [
    '保加利亞分腿蹲', '保加利亞', '保加利亞單腿蹲',
    'bss', 'bulgarian split squat', 'split squat',
  ],

  // 28. 啞鈴箭步蹲 / 啞鈴弓箭步蹲 / Lunge
  [DEFAULT_EXERCISE_IDS.dumbbell_walking_lunges]: [
    '啞鈴弓箭步蹲', '啞鈴箭步蹲', '箭步蹲', '跨步蹲', '弓步蹲', '行進箭步蹲',
    'lunge', 'walking lunge', 'db lunge', 'lunges',
  ],

  // 29. 繩索面拉 / 面拉 / Face Pull
  [DEFAULT_EXERCISE_IDS.cable_face_pull]: [
    '繩索面拉', '面拉', '臉拉', '面部拉引',
    'face pull', 'cable face pull', 'facepull',
  ],

  // 30. 健腹輪 / Ab Wheel / Ab Roller
  [DEFAULT_EXERCISE_IDS.ab_wheel_rollout]: [
    '健腹輪', '腹肌輪', '滾輪', '滾腹輪',
    'ab wheel', 'ab roller', 'ab wheel rollout',
  ],
};

// ----------------------------------------------------------------------------
// 3. 快取查找優化 (O(1) Map Lookup)
// ----------------------------------------------------------------------------
const EMPTY_ALIASES: readonly string[] = Object.freeze([]);
const ID_TO_ALIASES_MAP = new Map<string, readonly string[]>();
const NAME_TO_ALIASES_MAP = new Map<string, readonly string[]>();

function registerAliases(registry: Record<string, readonly string[]>): void {
  for (const [id, aliases] of Object.entries(registry)) {
    const cleanList = Object.freeze(Array.from(new Set(aliases.map((a) => a.trim().toLowerCase()))));
    ID_TO_ALIASES_MAP.set(id, cleanList);

    for (const alias of aliases) {
      const cleanAlias = alias.trim().toLowerCase();
      if (!NAME_TO_ALIASES_MAP.has(cleanAlias)) {
        NAME_TO_ALIASES_MAP.set(cleanAlias, cleanList);
      } else {
        const existing = NAME_TO_ALIASES_MAP.get(cleanAlias)!;
        const merged = Object.freeze(Array.from(new Set([...existing, ...cleanList])));
        NAME_TO_ALIASES_MAP.set(cleanAlias, merged);
      }
    }
  }
}

function registerSynonymGroups(groups: readonly (readonly string[])[]): void {
  for (const group of groups) {
    const cleanList = Object.freeze(Array.from(new Set(group.map((a) => a.trim().toLowerCase()))));
    for (const item of group) {
      const cleanItem = item.trim().toLowerCase();
      if (!NAME_TO_ALIASES_MAP.has(cleanItem)) {
        NAME_TO_ALIASES_MAP.set(cleanItem, cleanList);
      } else {
        const existing = NAME_TO_ALIASES_MAP.get(cleanItem)!;
        const merged = Object.freeze(Array.from(new Set([...existing, ...cleanList])));
        NAME_TO_ALIASES_MAP.set(cleanItem, merged);
      }
    }
  }
}

registerAliases(EXERCISE_ALIASES_REGISTRY);
registerSynonymGroups(FOOD_SYNONYM_GROUPS);

/**
 * 查詢目標實體對應的所有同義詞與權威別名
 * 支援透過標準動作 ID 查詢，亦支援透過名稱（如「紅薯」、「土豆」、「臥推」）查詢
 * O(1) 極速快取查找，零重複記憶體配置
 */
export function getAliasesForTarget(id?: string, name?: string): readonly string[] {
  if (id) {
    const list = ID_TO_ALIASES_MAP.get(id);
    if (list) return list;
  }

  if (name) {
    const cleanName = name.trim().toLowerCase();
    const list = NAME_TO_ALIASES_MAP.get(cleanName);
    if (list) return list;
  }

  return EMPTY_ALIASES;
}
