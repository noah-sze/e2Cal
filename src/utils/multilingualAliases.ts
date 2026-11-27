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
  ['去皮雞腿', '去皮雞腿肉', '去皮去骨雞腿', '去骨雞腿排', 'skinless chicken thigh', 'skinless chicken leg'],
  ['雞腿', '棒棒腿', '全腿', '雞腿排', '雞腿肉', '雞大腿', '小雞腿', '雞扒肉', 'drumstick', 'chicken thigh', 'chicken leg'],
  ['帶皮雞腿', '帶皮雞腿肉', '雞腿帶皮', '雞腿肉帶皮', '帶皮雞腿排', 'chicken thigh with skin'],
  ['去皮', '僅肉', '純肉', 'skinless', 'meat only', '皮なし'],
  ['帶皮', '連皮', '含皮', 'with skin', 'meat and skin', '皮つき'],
  ['去骨', '無骨', 'boneless'],
  ['帶骨', '含骨', 'bone-in'],
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

  // 蛋奶與乳製品
  ['雞蛋', '水煮蛋', '全蛋', '雞卵', 'egg', 'eggs', 'whole egg'],
  ['蛋白', '雞蛋白', '蛋清', 'egg white', 'egg whites'],
  ['蛋黃', '雞蛋黃', 'egg yolk'],
  ['牛奶', '鮮奶', '全脂鮮奶', '純牛奶', '鮮牛奶', 'milk', 'whole milk'],
  ['脫脂奶', '脫脂牛奶', '零脂牛奶', 'skim milk', 'nonfat milk'],
  ['起司', '芝士', '奶酪', '乳酪', '乾酪', 'cheese', 'cheddar'],
  ['莫札瑞拉起司', '馬蘇里拉芝士', '莫札瑞拉', '馬蘇里拉', 'mozzarella'],
  ['帕瑪森起司', '帕瑪森芝士', '帕爾瑪乾酪', 'parmesan'],
  ['優格', '酸奶', '原味優格', '原味酸奶', 'yogurt', 'yoghurt'],
  ['乳清蛋白', '蛋白粉', '乳清', '分離乳清', 'whey protein', 'whey'],
  ['奶油', '黃油', '牛油', '無鹽奶油', '無鹽黃油', 'butter', 'unsalted butter'],
  ['鮮奶油', '淡奶油', '動物性鮮奶油', 'heavy cream', 'whipping cream'],

  // 穀物雜糧與麵食
  ['白米', '大米', '白飯', '米飯', '梗米', '蓬萊米', 'white rice', 'rice'],
  ['糙米', '玄米', '糙米飯', 'brown rice'],
  ['紫米', '黑米', '血糯米', '黑糯米', 'black rice', 'purple rice'],
  ['藜麥', '印第安麥', '三色藜麥', 'quinoa'],
  ['小米', '粟米', '黃金小米', 'millet'],
  ['玉米筍', '珍珠筍', '小玉米', 'baby corn'],
  ['義大利麵', '意大利麵', '意麵', '通心粉', '義大利直麵', 'pasta', 'spaghetti', 'macaroni'],
  ['烏龍麵', '烏冬面', '烏冬麵', 'udon'],
  ['蕎麥麵', '蕎麥涼麵', 'soba', 'buckwheat noodles'],
  ['全麥麵包', '全麥吐司', '全麥方包', 'whole wheat bread', 'wholemeal bread'],
  ['白吐司', '吐司', '方包', '白麵包', 'white bread', 'toast'],
  ['貝果', '百吉餅', '貝果麵包', 'bagel'],

  // 水果與漿果
  ['藍莓', '藍梅', '山桑子', 'blueberry', 'blueberries'],
  ['草莓', '士多啤梨', '洋莓', 'strawberry', 'strawberries'],
  ['覆盆子', '樹莓', '木莓', '紅莓', 'raspberry', 'raspberries'],
  ['黑莓', '露莓', 'blackberry', 'blackberries'],
  ['蔓越莓', '小紅莓', '酸果蔓', 'cranberry', 'cranberries'],
  ['櫻桃', '車厘子', '大櫻桃', 'cherry', 'cherries'],
  ['水蜜桃', '桃子', '蜜桃', '白桃', 'peach', 'peaches'],
  ['西瓜', '紅西瓜', '大西瓜', 'watermelon'],
  ['哈密瓜', '網紋瓜', '洋香瓜', '蜜瓜', 'cantaloupe', 'melon'],
  ['椰子', '椰肉', '椰子肉', '老椰子', 'coconut'],
  ['無花果', '映日果', '天仙果', 'fig', 'figs'],
  ['榴槤', '榴蓮', '貓山王', 'durian'],
  ['山竹', '莽吉柿', '鳳果', 'mangosteen'],
  ['荔枝', '玉荷包', '黑葉荔枝', 'lychee', 'litchi'],
  ['龍眼', '桂圓', '福圓', 'longan'],

  // 堅果種子與食用油
  ['腰果', '檟如樹果', 'cashew', 'cashews'],
  ['開心果', '阿月渾子', '無名子', 'pistachio', 'pistachios'],
  ['夏威夷果', '澳洲堅果', '夏威夷豆', '火山豆', 'macadamia'],
  ['南瓜子', '南瓜籽', '白瓜子', 'pumpkin seeds', 'pepitas'],
  ['葵花籽', '葵花子', '向日葵籽', 'sunflower seeds'],
  ['亞麻籽', '胡麻籽', '亞麻仁籽', 'flaxseed', 'flax seeds'],
  ['芝麻', '黑芝麻', '白芝麻', '胡麻', 'sesame', 'sesame seeds'],
  ['橄欖油', '特級初榨橄欖油', '冷壓橄欖油', 'olive oil', 'evoo'],
  ['酪梨油', '牛油果油', '鱷梨油', 'avocado oil'],
  ['椰子油', '冷壓初榨椰子油', 'coconut oil'],
  ['花生醬', '無糖花生醬', '顆粒花生醬', 'peanut butter'],
  ['杏仁醬', '巴旦木醬', 'almond butter'],

  // 肉類與植物蛋白
  ['沙朗牛排', '西冷牛排', '沙朗', '西冷', 'sirloin', 'sirloin steak'],
  ['肋眼牛排', '肉眼牛排', '肋眼', '肉眼', 'ribeye', 'rib eye'],
  ['牛絞肉', '牛肉餡', '牛肉糜', '牛絞', 'ground beef', 'minced beef'],
  ['豬絞肉', '豬肉餡', '豬肉糜', '肉末', 'ground pork', 'minced pork'],
  ['培根', '煙肉', '煙燻培根', 'bacon'],
  ['火腿', '火腿片', '煙燻火腿', 'ham'],
  ['天貝', '丹貝', '印尼天貝', 'tempeh'],
  ['納豆', '日本納豆', 'natto'],

  // 飲品與調味品
  ['美式咖啡', '黑咖啡', '冰美式', '熱美式', 'americano', 'black coffee'],
  ['拿鐵', '鮮奶咖啡', '拿鐵咖啡', 'latte', 'caffe latte'],
  ['抹茶', '抹茶粉', '綠茶粉', 'matcha'],
  ['醬油', '生抽', '老抽', '薄鹽醬油', '鰹魚醬油', 'soy sauce'],
  ['味醂', '味霖', '甜料酒', 'mirin'],
  ['味噌', '面豉', '日本味噌', 'miso'],
  ['蜂蜜', '純蜂蜜', '龍眼蜜', '百花蜜', 'honey'],
  ['楓糖漿', '楓糖', 'maple syrup'],
  ['赤藻糖醇', '赤蘚糖醇', '代糖', '零卡糖', 'erythritol'],
  ['羅漢果糖', '羅漢果甜苷', 'monk fruit'],

  // 海產蟹貝魚類
  ['龍蝦', '波士頓龍蝦', '美洲螯龍蝦', 'lobster'],
  ['螃蟹', '梭子蟹', '大閘蟹', '花蟹', '紅蟳', 'crab'],
  ['鮑魚', '九孔', '九孔鮑', 'abalone'],
  ['秋刀魚', '竹刀魚', 'saury', 'pacific saury'],
  ['虱目魚', '國姓魚', '海草魚', 'milkfish'],
  ['石斑魚', '石斑', '青斑', '龍膽石斑', 'grouper'],
  ['午仔魚', '馬友魚', '四指馬鮁', 'threadfin'],
  ['白帶魚', '帶魚', '油帶', 'hairtail', 'beltfish'],
  ['吻仔魚', '白飯魚', '魩仔魚', '銀魚仔', 'whitebait'],

  // 蔬菜根莖菇類
  ['香菇', '冬菇', '花菇', '北菇', '椎茸', 'shiitake', 'shiitake mushroom'],
  ['秀珍菇', '平菇', '鳳尾菇', '側耳', 'oyster mushroom'],
  ['鴻喜菇', '蟹味菇', '真姬菇', '白玉菇', '美白菇', 'shimeji', 'shimeji mushroom'],
  ['竹筍', '冬筍', '春筍', '綠竹筍', '麻竹筍', 'bamboo shoots'],
  ['茭白筍', '美人腿', '高筍', 'water bamboo'],
  ['牛蒡', '東洋參', '大力子', 'burdock', 'burdock root'],
  ['白蘿蔔', '菜頭', '蘿蔔', '大白蘿蔔', 'daikon', 'white radish'],
  ['紅蘿蔔', '胡蘿蔔', '甘筍', '紅菜頭', 'carrot', 'carrots'],
  ['洋蔥', '紫洋蔥', '黃洋蔥', '球蔥', 'onion', 'red onion'],
  ['大蒜', '蒜頭', '蒜瓣', '獨頭蒜', 'garlic'],
  ['生薑', '老薑', '嫩薑', '薑母', 'ginger'],
  ['青蔥', '香蔥', '大蔥', '珠蔥', 'scallion', 'green onion', 'spring onion'],
  ['香菜', '芫荽', '胡荽', '鹽須', 'cilantro', 'coriander'],
  ['九層塔', '羅勒', '甜羅勒', '金不換', 'basil', 'sweet basil'],
  ['地瓜葉', '番薯葉', '甘薯葉', '紅薯葉', 'sweet potato leaves'],
  ['抱子甘藍', '高麗菜嬰', '球芽甘藍', '小包菜', 'brussels sprouts'],
  ['羽衣甘藍', '無頭甘藍', '綠葉甘藍', 'kale'],
  ['芝麻葉', '火箭菜', '瓢兒菜', 'arugula', 'rocket'],
  ['甜菜根', '紅菜頭', '紫菜頭', 'beetroot', 'beet'],
  ['秋葵', '羊角豆', '黃秋葵', '毛茄', 'okra'],
  ['茄子', '矮瓜', '長茄', '紫茄', 'eggplant', 'aubergine'],
  ['南瓜', '栗子南瓜', '金瓜', '東洋南瓜', 'pumpkin', 'kabocha'],

  // 雜糧豆類與烘焙粉類
  ['薏仁', '薏米', '紅薏仁', '大薏仁', '洋薏米', 'barley', "job's tears"],
  ['紅豆', '相思豆', '赤小豆', 'red bean', 'azuki', 'adzuki bean'],
  ['綠豆', '青小豆', 'mung bean'],
  ['黑豆', '烏豆', '黑大豆', 'black bean', 'black soybean'],
  ['黃豆', '大豆', '黃大豆', 'soybean', 'soybeans'],
  ['玉米澱粉', '太白粉', '生粉', '玉米粉', '粟粉', 'cornstarch', 'corn starch'],
  ['地瓜粉', '木薯粉', '樹薯粉', '番薯粉', 'tapioca starch'],
  ['麵粉', '高筋麵粉', '中筋麵粉', '低筋麵粉', '全麥麵粉', 'flour', 'wheat flour'],
  ['可可粉', '無糖可可粉', '純可可粉', 'cocoa powder'],
  ['黑巧克力', '純黑巧克力', '黑朱古力', 'dark chocolate'],

  // 禽畜部位與內臟
  ['雞翅', '雞翼', '二節翅', '三節翅', '翅中', 'chicken wing', 'chicken wings'],
  ['雞爪', '鳳爪', '雞腳', 'chicken feet'],
  ['雞胗', '雞腎', '雞肫', 'chicken gizzard'],
  ['雞肝', 'chicken liver'],
  ['豬肝', '豬潤', 'pork liver'],
  ['豬肚', '豬胃', 'pork stomach'],
  ['牛肚', '金錢肚', '毛肚', '牛百葉', 'beef tripe'],
  ['牛舌', 'beef tongue'],
  ['牛尾', 'oxtail'],
  ['羊排', '羊小排', '法式羊排', 'lamb chop', 'lamb chops'],
  ['羊肉', '羊腿肉', '羊肩肉', 'lamb', 'mutton'],
  ['鴨胸', '櫻桃鴨胸', '鴨胸肉', 'duck breast'],

  // 烹調方式與狀態詞
  ['水煮', '川燙', '汆燙', '白灼', '水焯', 'boiled'],
  ['清蒸', '隔水蒸', '蒸熟', 'steamed'],
  ['香煎', '乾煎', '少油煎', '平底鍋煎', 'pan-fried', 'pan seared'],
  ['烘烤', '燒烤', '烤箱烤', '炭烤', 'baked', 'roasted'],
  ['氣炸', '空氣炸', '氣炸鍋', 'air-fried', 'air fried'],
  ['煙燻', '燻製', '煙熏', 'smoked'],
  ['生鮮', '未烹調', '生肉', 'raw'],
  ['無加糖', '無糖', '無蔗糖', '零糖', 'unsweetened', 'sugar free'],
  ['低脂', '減脂', '低脂肪', 'low fat', 'low-fat'],

  // 肉類部位與禽畜補充
  ['牛小排', '無骨牛小排', '帶骨牛小排', 'short rib', 'short ribs'],
  ['翼板牛排', '翼板', '牛肩胛心', 'chuck flap', 'denver steak'],
  ['牛肋條', '肋條', '牛腩條', 'beef finger', 'rib finger'],
  ['牛五花', '雪花牛', '肥牛', '牛培根', 'beef belly', 'short plate'],
  ['和牛', '日本和牛', '澳洲和牛', 'wagyu'],
  ['五花肉', '三層肉', '豬五花', '帶皮五花肉', 'pork belly'],
  ['梅花豬', '梅花肉', '豬梅花', '豬上肩肉', 'pork shoulder', 'pork collar'],
  ['豬排', '里肌豬排', '帶骨豬排', 'pork chop', 'pork chops'],
  ['豬血', '鴨血', '米血糕', 'blood curd'],
  ['雞心', 'chicken heart'],
  ['雞軟骨', '膝軟骨', '雞脆骨', 'chicken cartilage'],
  ['火雞肉', '火雞胸肉', '火雞胸', 'turkey', 'turkey breast'],
  ['鵝肉', '燒鵝', '鹽水鵝', 'goose'],

  // 海鮮水產與海藻類補充
  ['鮭魚肚', '三文魚腩', '鮭魚腩', 'salmon belly'],
  ['鱈場蟹', '帝王蟹', 'king crab'],
  ['松葉蟹', '楚蟹', '雪蟹', 'snow crab'],
  ['透抽', '中卷', '小卷', '鎖管', 'neritic squid'],
  ['海參', '刺參', '海鼠', 'sea cucumber'],
  ['海膽', '馬糞海膽', 'sea urchin', 'uni'],
  ['蟹味棒', '蟹肉棒', '蟳味棒', '魚板', 'imitation crab', 'surimi'],
  ['海帶', '昆布', '海帶結', 'kelp', 'kombu'],
  ['紫菜', '海苔', '壽司海苔', '烤海苔', 'nori', 'laver'],
  ['海帶芽', '裙帶菜', '嫩海帶芽', 'wakame'],

  // 豆製品與素食蛋白補充
  ['豆皮', '腐竹', '腐皮', '生豆包', '湯葉', 'yuba', 'tofu skin'],
  ['百頁豆腐', '千頁豆腐', '素雞', 'vegetarian tofu'],
  ['油豆腐', '豆卜', '炸豆腐', 'fried tofu puff'],
  ['凍豆腐', '冰豆腐', 'frozen tofu'],
  ['麵筋', '烤麩', '麵腸', 'wheat gluten', 'seitan'],

  // 麵包糕點與米麵雜糧補充
  ['可頌', '牛角麵包', '牛角包', '羊角包', 'croissant'],
  ['法棍', '法國麵包', '歐式麵包', '酸種麵包', 'baguette', 'sourdough'],
  ['漢堡包', '漢堡麵包', 'burger bun'],
  ['鬆餅', '美式鬆餅', '班戟', 'pancake', 'pancakes'],
  ['格子鬆餅', '華夫餅', '比利時鬆餅', 'waffle', 'waffles'],
  ['司康', '英式鬆餅', 'scone'],
  ['瑪芬', '馬芬', '杯子蛋糕', 'muffin'],
  ['米粉', '炊粉', '米線', '米苔目', 'rice noodles'],
  ['冬粉', '粉絲', '寬粉', '綠豆粉絲', '龍口粉絲', 'glass noodles', 'vermicelli'],
  ['粄條', '粿條', '河粉', '沙河粉', 'flat rice noodles'],
  ['麵線', '白麵線', '紅麵線', '掛麵', '素麵', 'misua', 'somen'],
  ['拉麵', '日式拉麵', 'ramen'],
  ['玉米片', '早餐穀片', 'cornflakes', 'corn flakes'],
  ['蓮子', '白蓮子', '紅蓮子', 'lotus seed', 'lotus seeds'],
  ['菱角', '水菱', 'water caltrop'],
  ['栗子', '板栗', '甘栗', '糖炒栗子', 'chestnut', 'chestnuts'],
  ['荸薺', '馬蹄', '地栗', 'water chestnut'],
  ['粉圓', '珍珠', '波霸', '黑糖珍珠', 'tapioca pearls', 'boba'],

  // 蔬菜與菌菇補充
  ['青花筍', '甜青花菜', '青花菜苗', 'broccolini'],
  ['芥藍', '芥蘭', '白花芥藍', 'chinese broccoli', 'gai lan'],
  ['油菜花', '菜心', '廣東菜心', 'choy sum'],
  ['茼蒿', '春菊', '打某菜', 'garland chrysanthemum'],
  ['皇宮菜', '落葵', '木耳菜', 'malabar spinach'],
  ['水蓮', '野蓮', '龍骨瓣莕菜', 'white water snowflake'],
  ['莧菜', '紅莧菜', '白莧菜', 'amaranth'],
  ['紫甘藍', '紫高麗菜', '紅甘藍', '紫包菜', 'red cabbage'],
  ['甜豆', '荷蘭豆', '豌豆莢', '青豆仁', 'snow peas', 'sugar snap peas'],
  ['皇帝豆', '萊馬豆', '大白豆', 'lima bean'],
  ['瓠瓜', '蒲瓜', '扁蒲', '葫蘆瓜', 'calabash', 'bottle gourd'],
  ['芹菜', '西洋芹', '西芹', '土芹菜', 'celery'],
  ['大頭菜', '結頭菜', '苤藍', 'kohlrabi'],
  ['猴頭菇', '猴頭菌', 'lions mane', "lion's mane"],
  ['松茸', '松口蘑', 'matsutake'],
  ['牛肝菌', '美味牛肝菌', 'porcini'],

  // 鮮果與乾果補充
  ['蘋果', '富士蘋果', '青蘋果', '紅蘋果', 'apple', 'apples'],
  ['水梨', '梨子', '雪梨', '豐水梨', '高接梨', 'pear', 'pears'],
  ['蜜棗', '印度棗', '青棗', '棗子', 'indian jujube'],
  ['楊桃', '五斂子', 'starfruit', 'carambola'],
  ['枇杷', '盧橘', 'loquat'],
  ['柿子', '甜柿', '牛心柿', '軟柿', 'persimmon'],
  ['石榴', '紅石榴', 'pomegranate'],
  ['桑葚', '桑椹', '桑果', 'mulberry'],
  ['椰棗', '中東椰棗', '伊拉克蜜棗', 'dates', 'medjool date'],
  ['葡萄乾', '提子乾', '黑葡萄乾', 'raisins', 'raisin'],
  ['蔓越莓乾', '小紅莓乾', 'dried cranberries'],
  ['無花果乾', 'dried figs'],

  // 植物奶、起司與茶飲補充
  ['杏仁奶', '杏仁飲', '無糖杏仁奶', 'almond milk'],
  ['燕麥奶', '燕麥飲', 'oat milk'],
  ['椰奶', '椰漿', '純椰漿', 'coconut milk'],
  ['奶油乳酪', '奶油奶酪', '忌廉芝士', 'cream cheese'],
  ['瑞可塔起司', '里考塔芝士', 'ricotta', 'ricotta cheese'],
  ['菲達起司', '羊奶起司', '費塔奶酪', 'feta', 'feta cheese'],
  ['酸奶油', '酸忌廉', 'sour cream'],
  ['優酪乳', '發酵乳', '飲用優格', 'kefir', 'drinking yogurt'],
  ['烏龍茶', '青茶', '凍頂烏龍', '高山茶', 'oolong tea'],
  ['紅茶', '錫蘭紅茶', '阿薩姆紅茶', 'black tea'],
  ['綠茶', '日式綠茶', '煎茶', '無糖綠茶', 'green tea'],
  ['普洱茶', '熟普', '生普', 'pu-erh tea'],
  ['氣泡水', '蘇打水', '礦泉氣泡水', 'sparkling water', 'soda water'],
  ['椰子水', '椰青水', '100%椰子水', 'coconut water'],

  // 醬料與香料補充
  ['番茄醬', '茄汁', '蕃茄醬', 'ketchup', 'tomato ketchup'],
  ['美乃滋', '蛋黃醬', '沙拉醬', '沙律醬', 'mayonnaise', 'mayo'],
  ['胡麻醬', '芝麻醬', '中東芝麻醬', '麻醬', 'sesame dressing', 'tahini'],
  ['沙茶醬', '牛頭牌沙茶醬', 'shacha sauce'],
  ['豆瓣醬', '辣豆瓣醬', '郫縣豆瓣醬', 'doubanjiang'],
  ['蠔油', '鮮味蠔油', 'oyster sauce'],
  ['魚露', '魚醬', 'fish sauce'],
  ['烏醋', '黑醋', '陳醋', '鎮江香醋', 'black vinegar'],
  ['蘋果醋', '有機蘋果醋', 'apple cider vinegar', 'acv'],
  ['白醋', '米醋', '壽司醋', 'rice vinegar'],
  ['辣椒醬', '甜辣醬', '是拉差', 'sriracha', 'chili sauce'],
  ['黑胡椒', '白胡椒', '胡椒粉', 'black pepper', 'pepper'],
  ['薑黃', '薑黃粉', '鬱金粉', 'turmeric'],
  ['肉桂', '肉桂粉', '錫蘭肉桂', 'cinnamon'],
  ['迷迭香', 'rosemary'],
  ['百里香', 'thyme'],
  ['奧勒岡', '牛至', '披薩草', 'oregano'],

  // 純天然蔬菜、野菜與香草
  ['小白菜', '青白菜', '不結球白菜', 'baby bok choy'],
  ['芥菜', '大芥菜', '刈菜', '長年菜', 'mustard greens'],
  ['西洋菜', '豆瓣菜', '水田芥', 'watercress'],
  ['山葵', '綠山葵', 'wasabi'],
  ['牛皮菜', '菾菜', '君達菜', '甜菜葉', 'swiss chard'],
  ['過貓', '過溝菜蕨', '蕨菜', 'vegetable fern'],
  ['山蘇', '鳥巢蕨', "bird's nest fern"],
  ['馬齒莧', '豬母乳', '長命菜', 'purslane'],
  ['紫蘇', '紫蘇葉', '白蘇', '紅紫蘇', 'perilla', 'shiso'],
  ['薄荷', '薄荷葉', 'mint', 'peppermint'],
  ['蒔蘿', '洋茴香', 'dill'],
  ['茴香', '小茴香', '球莖茴香', 'fennel', 'fennel bulb'],
  ['韭黃', '黃韭', 'yellow chives'],
  ['紅蔥頭', '珠蔥', '紅蔥', 'shallot', 'shallots'],
  ['大蔥', '京蔥', '大葱', 'leek', 'welsh onion'],
  ['朝鮮薊', '洋薊', 'artichoke'],
  ['辣根', '山葵根', 'horseradish'],
  ['蕪菁', '蔓菁', '盤菜', '大頭蕪菁', 'turnip'],
  ['歐防風', '歐洲蘿蔔', '防風草', 'parsnip'],
  ['食用大黃', '大黃莖', 'rhubarb'],

  // 純天然瓜果、豆莢、全穀與根莖
  ['大黃瓜', '刺瓜', '胡瓜', '黃瓜', 'cucumber'],
  ['小黃瓜', '花胡瓜', '青瓜', '水果黃瓜', 'persian cucumber', 'mini cucumber'],
  ['葛根', '粉葛', 'kudzu root'],
  ['慈姑', '茨菇', '白地栗', 'arrowhead'],
  ['樹豆', '木豆', 'pigeon pea'],
  ['蠶豆', '胡豆', '羅漢豆', 'fava bean', 'broad bean'],
  ['扁豆', '蛾眉豆', '鵲豆', 'hyacinth bean'],
  ['蕎麥', '甜蕎', '苦蕎', 'buckwheat'],
  ['高粱', '蜀黍', '紅高粱', 'sorghum'],
  ['黑麥', '裸麥', 'rye'],
  ['大麥', '大麥仁', '洋薏仁', 'pearl barley'],
  ['斯佩爾特小麥', 'spelt'],
  ['苔麩', '畫眉草', 'teff'],

  // 純天然菌菇與藻類
  ['舞菇', '灰樹花', '舞茸', 'maitake'],
  ['滑菇', '滑子菇', '珍珠菇', 'nameko'],
  ['雞腿菇', '毛頭鬼傘', 'shaggy ink cap'],
  ['竹笙', '竹蓀', 'bamboo fungus'],
  ['松露', '黑松露', '白松露', 'truffle'],
  ['白木耳', '銀耳', '雪耳', 'snow fungus', 'tremella'],
  ['羊肚菌', '羊肚菇', 'morel'],
  ['雞油菌', '杏菌', 'chanterelle'],
  ['巴西蘑菇', '姬松茸', 'agaricus blazei'],
  ['海蘊', '水雲', '沖繩海蘊', 'mozuku'],

  // 純天然水果與漿果
  ['黑醋栗', '黑加侖', 'blackcurrant'],
  ['紅醋栗', '紅加侖', 'redcurrant'],
  ['黃金莓', '燈籠果', '醋栗', 'cape gooseberry', 'gooseberry'],
  ['接骨木莓', 'elderberry'],
  ['沙棘', '醋柳果', 'sea buckthorn'],
  ['油桃', '桃駁李', '甜桃', 'nectarine'],
  ['黃桃', '蟠桃', 'flat peach', 'yellow peach'],
  ['杏桃', '杏子', '黃杏', 'apricot'],
  ['青梅', '梅子', '梅果', 'japanese apricot'],
  ['山楂', '山裡紅', '紅果', 'hawthorn'],
  ['金桔', '金橘', '金棗', 'kumquat'],
  ['檸檬', '黃檸檬', '香水檸檬', 'lemon'],
  ['萊姆', '青檸檬', '綠檸檬', '無籽檸檬', 'lime'],
  ['血橙', '紅橙', 'blood orange'],
  ['波羅蜜', '菠蘿蜜', '木波羅', 'jackfruit'],
  ['紅毛丹', '毛荔枝', 'rambutan'],
  ['蛇皮果', 'salak'],
  ['羅望子', '酸角', '酸豆', 'tamarind'],
  ['刺番荔枝', '紅毛榴槤', 'soursop'],

  // 純天然野生/養殖魚貝海鮮
  ['旗魚', '劍魚', '芭蕉旗魚', '白皮旗魚', 'swordfish', 'marlin'],
  ['鬼頭刀', '鱰魚', '飛烏虎', 'mahi mahi'],
  ['土魠魚', '馬加鰆', '康氏馬加鰆', 'king mackerel'],
  ['香魚', '鮎魚', 'sweetfish', 'ayu'],
  ['比目魚', '扁魚', '鰈魚', '牙鮃', 'flounder', 'halibut', 'sole'],
  ['多寶魚', '大菱鮃', 'turbot'],
  ['紅甘', '紅魽', '章雄魚', 'amberjack'],
  ['青甘', '鰤魚', '寒鰤', 'yellowtail', 'hamachi'],
  ['竹筴魚', '巴攏', '池魚', 'horse mackerel', 'aji'],
  ['鯷魚', '鳳尾魚', 'anchovy'],
  ['柳葉魚', '喜相逢', '多春魚', 'capelin', 'shishamo'],
  ['白鯧', '銀鯧', '昌魚', 'pomfret'],
  ['金線魚', '紅衫魚', 'threadfin bream'],
  ['海鱺', '軍曹魚', 'cobia'],
  ['烏魚', '鯔魚', 'grey mullet'],
  ['鯽魚', '河鯽', 'crucian carp'],
  ['草魚', '鯇魚', 'grass carp'],
  ['鰱魚', '大頭鰱', '胖頭魚', '花鰱', 'silver carp', 'bighead carp'],
  ['黃魚', '大黃魚', '小黃魚', '黃花魚', 'yellow croaker'],
  ['泥鰍', 'loach'],
  ['田雞', '牛蛙', '青蛙腿', 'frog legs'],
  ['竹蟶', '蟶子', 'razor clam'],
  ['北寄貝', '姥貝', 'surf clam'],
  ['象拔蚌', 'geoduck'],
  ['明蝦', '斑節蝦', '大明蝦', '對蝦', 'tiger prawn', 'kuruma prawn'],
  ['甜蝦', '北極甜蝦', 'sweet shrimp'],
  ['櫻花蝦', 'sakura shrimp'],

  // 純天然堅果種子與原肉
  ['榛果', '榛子', '美國榛果', 'hazelnut', 'hazelnuts'],
  ['碧根果', '長壽果', '美國山核桃', '胡桃仁', 'pecan', 'pecans'],
  ['松子', '松仁', '紅松子', 'pine nut', 'pine nuts'],
  ['巴西堅果', '巴西豆', 'brazil nut'],
  ['白果', '銀杏果', 'ginkgo nut'],
  ['大麻籽', '火麻仁', 'hemp seeds'],
  ['罌粟籽', 'poppy seeds'],
  ['乳鴿', '鴿肉', 'squab', 'pigeon'],
  ['兔肉', 'rabbit meat'],
  ['鹿肉', 'venison'],
  ['野豬肉', '山豬肉', 'wild boar'],
  ['豬頰肉', '嘴邊肉', '菊花肉', 'pork cheek'],
  ['牛頰肉', 'beef cheek'],

  // 純天然禽畜精細原肉部位與蛋類
  ['紐約客牛排', '紐約客', '前腰脊肉', 'new york strip', 'strip steak'],
  ['丁骨牛排', 't骨牛排', 't-bone', 't bone steak'],
  ['老饕牛排', '上蓋肉', '肋眼上蓋', 'ribeye cap'],
  ['牛橫膈膜', '牛肝連', 'skirt steak', 'hanger steak'],
  ['牛肩肉', '牛梅花', 'chuck roast', 'beef chuck'],
  ['牛臀肉', '後腿股肉', 'rump steak', 'round steak'],
  ['牛骨', '牛大骨', '牛筒骨', 'beef bone'],
  ['二層肉', '離緣肉', '老鼠肉', '僧帽肌', 'pork cap'],
  ['豬肝連', '隔間肉', '豬橫膈膜', 'pork skirt'],
  ['豬尾', '豬尾巴', 'pork tail'],
  ['豬耳', '豬耳朵', 'pork ear'],
  ['羊膝', '羊小腿', 'lamb shank'],
  ['羊肩', 'lamb shoulder'],
  ['羊腿', 'leg of lamb'],
  ['法式羊肋排', 'rack of lamb'],
  ['鴨舌', 'duck tongue'],
  ['鴨胗', '鴨腎', 'duck gizzard'],
  ['鴨掌', 'duck feet'],
  ['鵝肝', '鴨肝', '肥肝', 'foie gras', 'duck liver', 'goose liver'],
  ['鵪鶉', '鶉肉', 'quail'],
  ['鵪鶉蛋', '鳥蛋', 'quail egg', 'quail eggs'],
  ['鴨蛋', '生鴨蛋', 'duck egg', 'duck eggs'],
  ['烏骨雞', '烏雞', '竹絲雞', 'silkie chicken'],

  // 純天然魚貝水產與甲殼頭足類
  ['赤鯮', '黃背牙鯛', 'yellowback seabream'],
  ['黑鮪魚', '藍鰭金槍魚', '黑鮪', 'bluefin tuna'],
  ['馬頭魚', '方頭魚', '甘鯛', 'tilefish'],
  ['石狗公', '笠子魚', 'scorpionfish'],
  ['紅條', '七星斑', '東星斑', 'leopard coral grouper'],
  ['肉魚', '瓜仔魚', '刺鯧', 'butterfish'],
  ['四破魚', '藍圓鰺', '巴攏仔', 'round scad'],
  ['飛魚', '飛烏', 'flying fish'],
  ['曼波魚', '翻車魚', 'ocean sunfish'],
  ['魟魚', '魔鬼魚', '魴魚', 'skate', 'stingray'],
  ['河豚', '河魨', 'pufferfish', 'fugu'],
  ['鯰魚', '土虱', '塘虱', 'catfish'],
  ['烏鱧', '黑魚', '雷魚', '鱧魚', 'snakehead'],
  ['黃鱔', '鱔魚', '田鰻', 'asian swamp eel'],
  ['海鰻', '虎鰻', '星鰻', '穴子', 'conger eel'],
  ['旭蟹', '蛙形蟹', '海臭蟲', 'spanner crab'],
  ['麵包蟹', '黃金蟹', 'brown crab'],
  ['泥蟹', '沙公', '沙母', '青蟹', 'mud crab'],
  ['三點蟹', '紅星梭子蟹', '花蟹', 'swimming crab'],
  ['血蚶', '螄蚶', '銀蚶', 'blood cockle'],
  ['淡菜', '貽貝', '青口', '孔雀蛤', 'mussel', 'mussels'],
  ['海螺', '鳳螺', '響螺', 'conch', 'whelk'],
  ['龜足', '佛手貝', '鵝頸藤壺', 'gooseneck barnacle'],
  ['海蜇', '水母', '海蜇皮', 'jellyfish'],

  // 純天然芽菜、香辛料、野生蔬果與花草
  ['苜蓿芽', '紫花苜蓿', 'alfalfa sprouts'],
  ['綠豆芽', '豆芽菜', '銀芽', 'mung bean sprouts'],
  ['黃豆芽', '大豆芽', 'soybean sprouts'],
  ['豌豆苗', '豆苗', '大豆苗', 'pea shoots'],
  ['蘿蔔嬰', '蘿蔔苗', 'radish sprouts'],
  ['青花菜苗', '西蘭花苗', 'broccoli sprouts'],
  ['香椿', '香椿芽', '紅椿', 'toon shoots'],
  ['枸杞葉', '天精草', '枸杞菜', 'goji leaves'],
  ['山苦瓜', '野苦瓜', '小苦瓜', 'wild bitter gourd'],
  ['火參果', '刺角瓜', '非洲角瓜', 'kiwano'],
  ['仙桃', '蛋黃果', 'canistel'],
  ['人心果', '吳鳳柿', 'sapodilla'],
  ['神秘果', 'miracle fruit'],
  ['樹番茄', 'tamarillo'],
  ['朝天椒', '小米辣', '鳥眼椒', "bird's eye chili"],
  ['墨西哥辣椒', '哈拉佩紐', 'jalapeno'],
  ['糯米椒', '青龍椒', '甘長辣椒', 'shishito pepper'],
  ['嘉寶果', '樹葡萄', 'jabuticaba'],
  ['仙人掌果', 'prickly pear'],
  ['紅棗', '乾紅棗', '大棗', 'red dates', 'jujube'],
  ['黑棗', '君遷子', 'black dates'],
  ['枸杞', '紅枸杞', '黑枸杞', '枸杞子', 'goji berry', 'wolfberry'],
  ['洛神花', '玫瑰茄', '洛神葵', 'hibiscus', 'roselle'],

  // 純天然全穀、植物籽實與豆類
  ['紅藜', '台灣藜', '紅藜麥', 'red quinoa'],
  ['野米', '菰米', '茭白米', 'wild rice'],
  ['小麥胚芽', 'wheat germ'],
  ['燕麥麩', '燕麥麩皮', 'oat bran'],
  ['紫蘇籽', '蘇子', 'perilla seeds'],
  ['羽扇豆', '魯賓豆', 'lupin beans'],
  ['斑豆', '花豆', '大紅豆', 'pinto beans'],
  ['紅腰豆', '紅芸豆', '大紅腰豆', 'kidney beans', 'red kidney beans'],
  ['白腰豆', '白芸豆', '白鳳豆', 'cannellini beans', 'white kidney beans'],
  ['黑眼豆', '眉豆', '米豆', 'black-eyed peas'],
  ['木薯', '樹薯', '木薯塊根', 'cassava'],

  // 純天然野菜、山菜與水生蔬菜
  ['刺蔥', '食茱萸', 'ailanthus prickly ash'],
  ['假蒟', '假荖葉', 'wild betel leaf'],
  ['魚腥草', '折耳根', '蕺菜', 'houttuynia'],
  ['蒲公英葉', 'dandelion greens'],
  ['紅鳳菜', '紫背菜', '血皮菜', '紅菜', 'gynura'],
  ['芡實', '雞頭米', 'fox nut', 'euryale ferox'],
  ['蓴菜', '水葵', '馬蹄草', 'watershield'],
  ['蒲菜', '香蒲', 'cattail shoots'],
  ['水芹', '楚葵', '野芹菜', 'water dropwort'],
  ['苦苣', '苦菊', '菊苣', 'chicory', 'endive', 'radicchio'],
  ['荷葉', '蓮葉', 'lotus leaf'],
  ['艾草', '艾葉', '蘄艾', 'mugwort'],

  // 純天然辛香根莖、香草與原粒香料
  ['南薑', '良薑', '高良薑', 'galangal'],
  ['香茅', '檸檬草', '檸檬香茅', 'lemongrass'],
  ['馬蜂橙葉', '卡菲爾萊姆葉', '檸檬葉', 'kaffir lime leaves'],
  ['月桂葉', '香葉', 'bay leaf', 'bay leaves'],
  ['鼠尾草', '洋蘇草', 'sage'],
  ['馬郁蘭', '甘牛至', 'marjoram'],
  ['龍蒿', '茵陳蒿', 'tarragon'],
  ['八角', '大料', '八角茴香', 'star anise'],
  ['花椒', '青花椒', '紅花椒', '大紅袍花椒', 'sichuan pepper'],
  ['丁香', '公丁香', 'clove', 'cloves'],
  ['豆蔻', '白豆蔻', '綠豆蔻', '草果', 'cardamom'],
  ['肉豆蔻', '玉果', 'nutmeg'],
  ['孜然', '小茴香籽', '馬芹', 'cumin', 'cumin seeds'],
  ['芫荽籽', '香菜籽', 'coriander seeds'],
  ['芥末籽', '黃芥末籽', '黑芥末籽', 'mustard seeds'],
  ['葫蘆巴', '香豆子', 'fenugreek'],
  ['番紅花', '藏紅花', '西紅花', 'saffron'],
  ['香草莢', '香草豆莢', 'vanilla bean'],

  // 純天然特殊原魚、貝藻與水產
  ['圓鱈', '銀鱈', '智利海鱸', 'patagonian toothfish', 'chilean sea bass'],
  ['黑鱈', '裸蓋魚', '銀鱈魚', 'sablefish', 'black cod'],
  ['扁鱈', '格陵蘭比目魚', '大西洋比目魚', 'greenland halibut'],
  ['虹鱒', '鱒魚', '七彩鱒', 'trout', 'rainbow trout'],
  ['紅點鮭', '北極紅點鮭', 'arctic char'],
  ['鱸鰻', '花鰻鱺', '白鰻', 'marbled eel'],
  ['沙梭', '沙鮻', '沙腸仔', 'japanese whiting'],
  ['黃雞魚', '雞魚', '三線磯鱸', 'grunt'],
  ['紅目鰱', '大眼鯛', '嚴公仔', 'bigeye'],
  ['花身雞魚', '花身仔', '斑吾', 'terapon'],
  ['剝皮魚', '單棘魨', '剝皮竹', 'filefish'],
  ['鮟鱇魚', '燈籠魚', '蛤蟆魚', 'monkfish'],
  ['秋姑魚', '鬚鯛', '紅鬚魚', 'goatfish'],
  ['海葡萄', '長莖葡萄蕨藻', '綠色魚子醬', 'sea grapes', 'umibudo'],
  ['石蓴', '孔石蓴', '海萵苣', 'sea lettuce'],
  ['蠑螺', '角蠑螺', 'turban shell'],
  ['鱉', '甲魚', '水魚', '團魚', 'softshell turtle'],

  // 純天然超級莓果、原生果實、可可與豆類
  ['油柑', '餘甘子', '庵摩勒', 'amla', 'indian gooseberry'],
  ['羅漢果', '漢果', '神仙果', 'luo han guo'],
  ['黃皮果', '黃皮', '油梅', 'wampee'],
  ['楊梅', '山楊梅', '白楊梅', 'waxberry', 'bayberry'],
  ['酸櫻桃', '酸車厘子', 'tart cherry', 'sour cherry'],
  ['越橘', '紅豆越橘', 'lingonberry'],
  ['香櫞', '枸櫞', 'citron'],
  ['卡姆果', 'camu camu'],
  ['巴西莓', '阿薩伊果', 'acai', 'acai berry'],
  ['馬基莓', '智利酒果', 'maqui berry'],
  ['諾麗果', '海巴戟天', 'noni'],
  ['麵包果', '麵包樹果', 'breadfruit'],
  ['生可可豆', '可可碎粒', '可可豆', 'cacao nibs', 'cacao bean'],
  ['小扁豆', '兵豆', '紅扁豆', '綠扁豆', '黑扁豆', 'lentil', 'lentils'],

  // 純天然水果品種與藥食同源根莖
  ['人參果', '香瓜梨', 'pepino melon'],
  ['恐龍蛋', '紅肉李', '黃肉李', '杏李', 'pluot'],
  ['沙糖橘', '砂糖橘', '貢柑', '皇帝柑', '南豐蜜橘'],
  ['茂谷柑', '桶柑', '年柑', '海梨柑', 'murcott', 'tankan'],
  ['黑樹莓', 'black raspberry'],
  ['博伊森莓', 'boysenberry'],
  ['雲莓', 'cloudberry'],
  ['鮮百合', '百合鱗莖', '蘭州百合', 'lily bulb'],
  ['天麻', 'gastrodia'],
  ['黃耆', '黃芪', '北耆', 'astragalus'],
  ['當歸', 'angelica root'],
  ['黨參', '党參', 'codonopsis'],
  ['紫山藥', '紫玉淮山', '大薯', 'purple yam', 'ube'],
  ['節瓜', '毛瓜', '小冬瓜', 'hairy gourd'],
  ['角瓜', '澎湖絲瓜', '十稜絲瓜', 'angled luffa'],
  ['豆薯', '沙葛', '涼薯', '芒光', 'jicama'],
  ['草菇', '蘭花菇', '稻草菇', 'straw mushroom'],
  ['茶樹菇', '柳松菇', '柱狀田頭菇', 'agrocybe'],
  ['珊瑚菇', '黃金菇', '榆黃蘑', 'golden oyster mushroom'],
  ['蟲草花', '北蟲草', '蛹蟲草', 'cordyceps flower'],
  ['雞肉絲菇', '雞樅菌', '蟻巢傘', 'termite mushroom'],
  ['紅菜苔', '紫菜苔', 'purple flowering stalk'],

  // 純天然原魚卵、海產蝦蟹與原肉臟器
  ['魚卵', '魚子', '鮭魚卵', '飛魚卵', 'fish roe', 'ikura', 'tobiko'],
  ['蟹黃', '蟹膏', 'crab roe'],
  ['海鞘', '海菠蘿', 'sea squirt', 'hoya'],
  ['沙蟲', '方格星蟲', 'peanut worm'],
  ['軟殼蛤', '海螂', 'soft-shell clam'],
  ['青龍蝦', '花龍蝦', '錦繡龍蝦', 'spiny lobster'],
  ['琵琶蝦', '扇蝦', '旭蝦', 'slipper lobster'],
  ['牡丹蝦', 'spot prawn'],
  ['白蝦', '南美白對蝦', '白對蝦', 'whiteleg shrimp', 'vannamei'],
  ['牛筋', '牛蹄筋', 'beef tendon'],
  ['豬蹄筋', '豬筋', 'pork tendon'],
  ['牛心', 'beef heart'],
  ['豬心', 'pork heart'],
  ['豬腰', '豬腎', 'pork kidney'],
  ['牛腰', 'beef kidney'],
  ['牛黃喉', '黃喉', 'beef aorta'],
  ['豬大腸', '肥腸', '大腸頭', 'pork large intestine'],
  ['豬小腸', '粉腸', 'pork small intestine'],
  ['花膠', '魚肚', '魚鰾', 'fish maw'],

  // 純天然冷壓植物油脂與種子油
  ['苦茶油', '山茶花油', '茶籽油', 'camellia oil'],
  ['亞麻仁油', '亞麻籽油', 'flaxseed oil'],
  ['紫蘇油', '紫蘇籽油', 'perilla oil'],
  ['核桃油', 'walnut oil'],
  ['芝麻油', '黑麻油', '白麻油', '香油', 'sesame oil'],
  ['花生油', 'peanut oil'],
  ['芥花油', '菜籽油', 'canola oil', 'rapeseed oil'],
  ['葵花籽油', '葵花油', 'sunflower oil'],
  ['葡萄籽油', 'grapeseed oil'],
  ['玄米油', '米糠油', 'rice bran oil'],
  ['南瓜籽油', 'pumpkin seed oil'],
  ['大麻籽油', 'hemp seed oil'],
  ['紅花籽油', 'safflower oil'],
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

  // 31. 補齊剩餘預設動作別名 (100% 覆蓋 DEFAULT_EXERCISE_IDS)
  [DEFAULT_EXERCISE_IDS.decline_barbell_bench_press]: [
    '下斜槓鈴臥推', '下斜臥推', '下斜平推', 'decline bench', 'decline barbell press',
  ],
  [DEFAULT_EXERCISE_IDS.incline_dumbbell_press]: [
    '上斜啞鈴臥推', '上斜啞鈴推胸', '啞鈴上斜推', 'incline db press', 'incline dumbbell press',
  ],
  [DEFAULT_EXERCISE_IDS.decline_dumbbell_press]: [
    '下斜啞鈴臥推', '下斜啞鈴推胸', 'decline db press', 'decline dumbbell press',
  ],
  [DEFAULT_EXERCISE_IDS.smith_machine_bench_press]: [
    '史密斯臥推', '史密斯平板臥推', '史密斯推胸', 'smith bench', 'smith bench press',
  ],
  [DEFAULT_EXERCISE_IDS.smith_machine_incline_bench_press]: [
    '史密斯上斜臥推', '史密斯上斜推胸', 'smith incline bench', 'smith incline press',
  ],
  [DEFAULT_EXERCISE_IDS.seated_chest_press_machine]: [
    '坐姿推胸機', '機械推胸', '器械推胸', '推胸機', 'chest press machine', 'machine chest press',
  ],
  [DEFAULT_EXERCISE_IDS.incline_chest_press_machine]: [
    '上斜推胸機', '器械上斜推胸', 'incline chest press machine',
  ],
  [DEFAULT_EXERCISE_IDS.pec_deck_fly]: [
    '蝴蝶機夾胸', '蝴蝶機', '機械夾胸', '器械夾胸', '坐姿夾胸', 'pec deck', 'pec fly', 'butterfly',
  ],
  [DEFAULT_EXERCISE_IDS.cable_fly]: [
    '滑輪夾胸', '龍門架夾胸', '繩索夾胸', '繩索飛鳥', '高位夾胸', 'cable fly', 'cable crossover',
  ],
  [DEFAULT_EXERCISE_IDS.low_cable_crossover]: [
    '低位滑輪夾胸', '低位繩索夾胸', '下胸夾胸', 'low cable fly', 'low cable crossover',
  ],
  [DEFAULT_EXERCISE_IDS.pushups]: [
    '俯臥撐', '伏地挺身', '掌上壓', 'pushup', 'push-up', 'pushups', 'push ups',
  ],
  [DEFAULT_EXERCISE_IDS.chest_supported_tbar_row]: [
    '胸支撐 t 桿划船', 't 桿划船', 't桿划船', '俯臥划船', 't-bar row', 't bar row', 'chest supported row',
  ],
  [DEFAULT_EXERCISE_IDS.straight_arm_cable_pulldown]: [
    '直臂滑輪下壓', '直臂下壓', '直臂下拉', '繩索直臂下壓', 'straight arm pulldown', 'lat pullover',
  ],
  [DEFAULT_EXERCISE_IDS.barbell_shrug]: [
    '槓鈴聳肩', '聳肩', 'barbell shrug', 'bb shrug', 'shrugs',
  ],
  [DEFAULT_EXERCISE_IDS.dumbbell_shrug]: [
    '啞鈴聳肩', 'dumbbell shrug', 'db shrug',
  ],
  [DEFAULT_EXERCISE_IDS.hyperextension]: [
    '山羊挺身', '羅馬椅挺身', '背屈伸', '下背伸展', 'hyperextension', 'back extension',
  ],
  [DEFAULT_EXERCISE_IDS.arnold_press]: [
    '阿諾德推舉', '阿諾推舉', '阿諾德肩推', '阿諾肩推', '阿諾', 'arnold press', 'arnold',
  ],
  [DEFAULT_EXERCISE_IDS.smith_machine_shoulder_press]: [
    '史密斯肩推', '史密斯推舉', 'smith shoulder press', 'smith ohp',
  ],
  [DEFAULT_EXERCISE_IDS.machine_lateral_raise]: [
    '機械側平舉', '器械側平舉', '坐姿側平舉機', 'machine lateral raise',
  ],
  [DEFAULT_EXERCISE_IDS.dumbbell_front_raise]: [
    '啞鈴前平舉', '前平舉', 'front raise', 'db front raise',
  ],
  [DEFAULT_EXERCISE_IDS.bent_over_dumbbell_rear_delt_fly]: [
    '俯身啞鈴反向飛鳥', '俯身飛鳥', '啞鈴後束飛鳥', '後束飛鳥', 'rear delt fly', 'bent over fly',
  ],
  [DEFAULT_EXERCISE_IDS.reverse_pec_deck_fly]: [
    '反向蝴蝶機', '反蝴蝶機', '器械後束飛鳥', '蝴蝶機後束', 'reverse pec deck', 'reverse fly',
  ],
  [DEFAULT_EXERCISE_IDS.incline_dumbbell_curl]: [
    '上斜啞鈴彎舉', '上斜彎舉', 'incline curl', 'incline db curl',
  ],
  [DEFAULT_EXERCISE_IDS.preacher_curl]: [
    '牧師椅彎舉', '斜托彎舉', '托臂彎舉', '牧師凳彎舉', 'preacher curl', 'scott curl',
  ],
  [DEFAULT_EXERCISE_IDS.cable_biceps_curl]: [
    '滑輪二頭彎舉', '繩索彎舉', '滑輪彎舉', 'cable curl', 'cable bicep curl',
  ],
  [DEFAULT_EXERCISE_IDS.concentration_curl]: [
    '集中彎舉', '專注彎舉', '單臂集中彎舉', 'concentration curl',
  ],
  [DEFAULT_EXERCISE_IDS.barbell_wrist_curl]: [
    '槓鈴腕彎舉', '正握腕彎舉', '前臂彎舉', 'wrist curl', 'barbell wrist curl',
  ],
  [DEFAULT_EXERCISE_IDS.barbell_reverse_wrist_curl]: [
    '槓鈴反握腕彎舉', '反握腕彎舉', '反向腕彎舉', 'reverse wrist curl',
  ],
  [DEFAULT_EXERCISE_IDS.overhead_dumbbell_triceps_extension]: [
    '啞鈴頸後臂屈伸', '頸後臂屈伸', '過頂臂屈伸', '啞鈴過頂伸展', 'overhead triceps extension', 'db overhead extension',
  ],
  [DEFAULT_EXERCISE_IDS.cable_overhead_triceps_extension]: [
    '繩索過頂臂屈伸', '滑輪頸後臂屈伸', '繩索頸後臂屈伸', 'cable overhead extension',
  ],
  [DEFAULT_EXERCISE_IDS.close_grip_bench_press]: [
    '窄距槓鈴臥推', '窄距臥推', '窄握臥推', 'close grip bench', 'cgbp', 'close-grip bench press',
  ],
  [DEFAULT_EXERCISE_IDS.smith_machine_squat]: [
    '史密斯深蹲', '史密斯蹲', 'smith squat', 'smith machine squat',
  ],
  [DEFAULT_EXERCISE_IDS.hack_squat]: [
    '哈克深蹲', '哈克機', '哈克深蹲機', 'hack squat',
  ],
  [DEFAULT_EXERCISE_IDS.standing_calf_raise]: [
    '站姿提踵', '提踵', '小腿提踵', 'standing calf raise', 'calf raise',
  ],
  [DEFAULT_EXERCISE_IDS.seated_calf_raise]: [
    '坐姿提踵', '坐姿小腿提踵', 'seated calf raise',
  ],
  [DEFAULT_EXERCISE_IDS.cable_glute_kickback]: [
    '滑輪後踢', '繩索後踢', '繩索踢臀', '臀部後踢', 'glute kickback', 'cable kickback',
  ],
  [DEFAULT_EXERCISE_IDS.hip_abduction_machine]: [
    '髖外展機', '坐姿髖外展', '大腿外展機', '外展機', 'hip abduction', 'abductor machine',
  ],
  [DEFAULT_EXERCISE_IDS.good_morning]: [
    '早安式體前屈', '早安式', '早安躬身', '槓鈴早安', 'good morning', 'good mornings',
  ],
  [DEFAULT_EXERCISE_IDS.hanging_leg_raise]: [
    '懸垂舉腿', '懸吊抬腿', '單槓舉腿', '吊槓抬腿', 'hanging leg raise', 'hlr',
  ],
  [DEFAULT_EXERCISE_IDS.abdominal_crunch]: [
    '仰臥捲腹', '捲腹', '腹肌捲腹', 'crunch', 'crunches', 'abdominal crunch',
  ],
  [DEFAULT_EXERCISE_IDS.cable_crunch]: [
    '繩索捲腹', '跪姿繩索捲腹', '滑輪捲腹', '跪姿捲腹', 'cable crunch', 'kneeling cable crunch',
  ],
  [DEFAULT_EXERCISE_IDS.russian_twist]: [
    '俄羅斯轉體', '俄式轉體', '轉體', 'russian twist',
  ],
};

// ----------------------------------------------------------------------------
// 3. 快取查找優化 (O(1) Map Lookup)
// ----------------------------------------------------------------------------
const EMPTY_ALIASES: readonly string[] = Object.freeze([]);
const ID_TO_ALIASES_MAP = new Map<string, readonly string[]>();
const NAME_TO_ALIASES_MAP = new Map<string, readonly string[]>();
let SORTED_FOOD_SYNONYM_KEYS: readonly string[] = [];
const COMPOUND_ALIAS_CACHE = new Map<string, readonly string[]>();
const COMPOUND_SPLIT_CACHE = new Map<string, readonly string[]>();
const MAX_COMPOUND_CACHE_SIZE = 256;

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
  const keysSet = new Set<string>();
  for (const group of groups) {
    const cleanList = Object.freeze(Array.from(new Set(group.map((a) => a.trim().toLowerCase()))));
    for (const item of group) {
      const cleanItem = item.trim().toLowerCase();
      if (cleanItem.length >= 2) {
        keysSet.add(cleanItem);
      }
      if (!NAME_TO_ALIASES_MAP.has(cleanItem)) {
        NAME_TO_ALIASES_MAP.set(cleanItem, cleanList);
      } else {
        const existing = NAME_TO_ALIASES_MAP.get(cleanItem)!;
        const merged = Object.freeze(Array.from(new Set([...existing, ...cleanList])));
        NAME_TO_ALIASES_MAP.set(cleanItem, merged);
      }
    }
  }
  // 依字元長度由長到短排序，確保「牛油果」等長詞優先於「牛油」被匹配
  SORTED_FOOD_SYNONYM_KEYS = Object.freeze(
    Array.from(keysSet).sort((a, b) => b.length - a.length)
  );
}

registerAliases(EXERCISE_ALIASES_REGISTRY);
registerSynonymGroups(FOOD_SYNONYM_GROUPS);

/**
 * 複合詞子串同義詞展開（最長詞優先 + 結果快取）：
 * 當輸入如「烤三文魚」、「紅薯泥」等未完全相等於單一詞鍵的複合詞時，
 * 找出其中包含的最長食物同義詞鍵並替換展開為等效查詢別名。
 */
export function expandCompoundFoodQueryAliases(query: string): readonly string[] {
  const clean = query.trim().toLowerCase();
  if (clean.length < 3) return EMPTY_ALIASES;

  const cached = COMPOUND_ALIAS_CACHE.get(clean);
  if (cached) return cached;

  const matchedKey = SORTED_FOOD_SYNONYM_KEYS.find((k) => {
    if (k.length >= clean.length) return false;
    // 純 ASCII 單詞需以空白/邊界隔開，避免英文短詞誤截單字內部（例如 rice 截到 price）
    if (/^[a-z0-9\s-]+$/.test(k)) {
      const idx = clean.indexOf(k);
      if (idx === -1) return false;
      const before = idx > 0 ? clean[idx - 1] : ' ';
      const after = idx + k.length < clean.length ? clean[idx + k.length] : ' ';
      return !/[a-z0-9]/.test(before) && !/[a-z0-9]/.test(after);
    }
    return clean.includes(k);
  });

  if (!matchedKey) {
    if (COMPOUND_ALIAS_CACHE.size >= MAX_COMPOUND_CACHE_SIZE) {
      COMPOUND_ALIAS_CACHE.clear();
    }
    COMPOUND_ALIAS_CACHE.set(clean, EMPTY_ALIASES);
    return EMPTY_ALIASES;
  }

  const groupAliases = NAME_TO_ALIASES_MAP.get(matchedKey) ?? EMPTY_ALIASES;
  const expanded = new Set<string>();
  for (const alias of groupAliases) {
    if (alias !== matchedKey) {
      expanded.add(clean.replace(matchedKey, alias));
    }
  }

  const result = expanded.size > 0 ? Object.freeze(Array.from(expanded)) : EMPTY_ALIASES;
  if (COMPOUND_ALIAS_CACHE.size >= MAX_COMPOUND_CACHE_SIZE) {
    COMPOUND_ALIAS_CACHE.clear();
  }
  COMPOUND_ALIAS_CACHE.set(clean, result);
  return result;
}

/**
 * 將無空格複合飲食查詢詞拆分為兩個獨立子詞（例如「氣炸雞胸」→ ['雞胸', '氣炸']、「無糖豆漿」→ ['豆漿', '無糖']），
 * 讓第 6 層多詞比對能跨語言自由組合匹配。
 */
export function splitCompoundFoodTokens(query: string): readonly string[] {
  const clean = query.trim().toLowerCase();
  if (clean.length < 4 || /[\s_+,-]/.test(clean)) return EMPTY_ALIASES;

  const cached = COMPOUND_SPLIT_CACHE.get(clean);
  if (cached) return cached;

  const matchedKey = SORTED_FOOD_SYNONYM_KEYS.find((k) => {
    if (k.length >= clean.length) return false;
    if (/^[a-z0-9\s-]+$/.test(k)) return false;
    return clean.includes(k);
  });

  let result = EMPTY_ALIASES;
  if (matchedKey) {
    const idx = clean.indexOf(matchedKey);
    const before = clean.slice(0, idx).trim();
    const after = clean.slice(idx + matchedKey.length).trim();
    const parts = [before, matchedKey, after].filter(Boolean);
    if (parts.length >= 2 && parts.every((p) => p.length >= 2)) {
      result = Object.freeze(parts);
    }
  }

  if (COMPOUND_SPLIT_CACHE.size >= MAX_COMPOUND_CACHE_SIZE) {
    COMPOUND_SPLIT_CACHE.clear();
  }
  COMPOUND_SPLIT_CACHE.set(clean, result);
  return result;
}

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
