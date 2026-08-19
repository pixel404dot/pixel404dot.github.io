window.KANA = (() => {
  const FIRST5 = ["a", "ka", "sa", "ta", "na"];
  const BASIC = ["a", "ka", "sa", "ta", "na", "ha", "ma", "ya", "ra", "wa"];
  const DAKUTEN = ["ga", "za", "da", "ba", "pa"];
  const YOON = [
    "kya", "sha", "cha", "nya", "hya", "mya", "rya", "gya", "ja", "bya", "pya",
  ];
  const PAIRS = {
    a: [["あ", "ア", "a"], ["い", "イ", "i"], ["う", "ウ", "u"], ["え", "エ", "e"], ["お", "オ", "o"]],
    ka: [["か", "カ", "ka"], ["き", "キ", "ki"], ["く", "ク", "ku"], ["け", "ケ", "ke"], ["こ", "コ", "ko"]],
    sa: [["さ", "サ", "sa"], ["し", "シ", "shi", ["si"]], ["す", "ス", "su"], ["せ", "セ", "se"], ["そ", "ソ", "so"]],
    ta: [["た", "タ", "ta"], ["ち", "チ", "chi", ["ti"]], ["つ", "ツ", "tsu", ["tu"]], ["て", "テ", "te"], ["と", "ト", "to"]],
    na: [["な", "ナ", "na"], ["に", "ニ", "ni"], ["ぬ", "ヌ", "nu"], ["ね", "ネ", "ne"], ["の", "ノ", "no"]],
    ha: [["は", "ハ", "ha"], ["ひ", "ヒ", "hi"], ["ふ", "フ", "fu", ["hu"]], ["へ", "ヘ", "he"], ["ほ", "ホ", "ho"]],
    ma: [["ま", "マ", "ma"], ["み", "ミ", "mi"], ["む", "ム", "mu"], ["め", "メ", "me"], ["も", "モ", "mo"]],
    ya: [["や", "ヤ", "ya"], ["ゆ", "ユ", "yu"], ["よ", "ヨ", "yo"]],
    ra: [["ら", "ラ", "ra"], ["り", "リ", "ri"], ["る", "ル", "ru"], ["れ", "レ", "re"], ["ろ", "ロ", "ro"]],
    wa: [["わ", "ワ", "wa"], ["を", "ヲ", "wo", ["o"]], ["ん", "ン", "n", ["nn"]]],
    ga: [["が", "ガ", "ga"], ["ぎ", "ギ", "gi"], ["ぐ", "グ", "gu"], ["げ", "ゲ", "ge"], ["ご", "ゴ", "go"]],
    za: [["ざ", "ザ", "za"], ["じ", "ジ", "ji", ["zi"]], ["ず", "ズ", "zu"], ["ぜ", "ゼ", "ze"], ["ぞ", "ゾ", "zo"]],
    da: [["だ", "ダ", "da"], ["ぢ", "ヂ", "ji", ["di", "dzi", "dji"]], ["づ", "ヅ", "zu", ["du", "dzu"]], ["で", "デ", "de"], ["ど", "ド", "do"]],
    ba: [["ば", "バ", "ba"], ["び", "ビ", "bi"], ["ぶ", "ブ", "bu"], ["べ", "ベ", "be"], ["ぼ", "ボ", "bo"]],
    pa: [["ぱ", "パ", "pa"], ["ぴ", "ピ", "pi"], ["ぷ", "プ", "pu"], ["ぺ", "ペ", "pe"], ["ぽ", "ポ", "po"]],
    kya: [["きゃ", "キャ", "kya"], ["きゅ", "キュ", "kyu"], ["きょ", "キョ", "kyo"]],
    sha: [["しゃ", "シャ", "sha", ["sya"]], ["しゅ", "シュ", "shu", ["syu"]], ["しょ", "ショ", "sho", ["syo"]]],
    cha: [["ちゃ", "チャ", "cha", ["tya"]], ["ちゅ", "チュ", "chu", ["tyu"]], ["ちょ", "チョ", "cho", ["tyo"]]],
    nya: [["にゃ", "ニャ", "nya"], ["にゅ", "ニュ", "nyu"], ["にょ", "ニョ", "nyo"]],
    hya: [["ひゃ", "ヒャ", "hya"], ["ひゅ", "ヒュ", "hyu"], ["ひょ", "ヒョ", "hyo"]],
    mya: [["みゃ", "ミャ", "mya"], ["みゅ", "ミュ", "myu"], ["みょ", "ミョ", "myo"]],
    rya: [["りゃ", "リャ", "rya"], ["りゅ", "リュ", "ryu"], ["りょ", "リョ", "ryo"]],
    gya: [["ぎゃ", "ギャ", "gya"], ["ぎゅ", "ギュ", "gyu"], ["ぎょ", "ギョ", "gyo"]],
    ja: [["じゃ", "ジャ", "ja", ["jya", "zya"]], ["じゅ", "ジュ", "ju", ["jyu", "zyu"]], ["じょ", "ジョ", "jo", ["jyo", "zyo"]]],
    bya: [["びゃ", "ビャ", "bya"], ["びゅ", "ビュ", "byu"], ["びょ", "ビョ", "byo"]],
    pya: [["ぴゃ", "ピャ", "pya"], ["ぴゅ", "ピュ", "pyu"], ["ぴょ", "ピョ", "pyo"]],
  };
  const META = [
    ["a", "A line", "basic"], ["ka", "Ka line", "basic"], ["sa", "Sa line", "basic"],
    ["ta", "Ta line", "basic"], ["na", "Na line", "basic"], ["ha", "Ha line", "basic"],
    ["ma", "Ma line", "basic"], ["ya", "Ya line", "basic"], ["ra", "Ra line", "basic"],
    ["wa", "Wa line", "basic"], ["ga", "Ga line", "dakuten"], ["za", "Za line", "dakuten"],
    ["da", "Da line", "dakuten"], ["ba", "Ba line", "dakuten"], ["pa", "Pa line", "dakuten"],
    ["kya", "Kya", "yoon"], ["sha", "Sha", "yoon"], ["cha", "Cha", "yoon"],
    ["nya", "Nya", "yoon"], ["hya", "Hya", "yoon"], ["mya", "Mya", "yoon"],
    ["rya", "Rya", "yoon"], ["gya", "Gya", "yoon"], ["ja", "Ja", "yoon"],
    ["bya", "Bya", "yoon"], ["pya", "Pya", "yoon"],
  ];
  const ROWS = META.map(([id, label, group]) => ({
    id, label, group,
    hira: PAIRS[id].map((p) => p[0]).join(""),
    kata: PAIRS[id].map((p) => p[1]).join(""),
    readings: PAIRS[id].map((p) => p[2]),
  }));
  function glyphs(script, rows) {
    const out = [];
    for (const row of rows) {
      for (const [hira, kata, romaji, alts = []] of PAIRS[row] || []) {
        out.push({
          kana: script === "katakana" ? kata : hira,
          romaji, alts, row, script,
        });
      }
    }
    return out;
  }
  function pool(script, rows) {
    if (script === "mixed") return [...glyphs("hiragana", rows), ...glyphs("katakana", rows)];
    return glyphs(script, rows);
  }
  function matchRomaji(g, input) {
    const v = String(input).toLowerCase().trim().replace(/[\s\-']/g, "");
    return v === g.romaji || g.alts.includes(v);
  }
  return { FIRST5, BASIC, DAKUTEN, YOON, ROWS, PAIRS, pool, matchRomaji };
})();
