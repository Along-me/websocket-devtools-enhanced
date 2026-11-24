const keys = ["Find", "Replace", "next", "previous", "all", "match case", "regexp", "by word", "replace", "replace all", "close", "current match", "on line", "Go to line", "go", "Selection deleted", "replaced match on line $", "replaced $ matches"];
const translations = {
  "zh-cn": ["查找", "替换", "下一个", "上一个", "全部", "区分大小写", "正则表达式", "全词匹配", "替换", "全部替换", "关闭", "当前匹配", "所在行", "跳转到行", "跳转", "已删除选区", "已替换第 $ 行的匹配项", "已替换 $ 处匹配"],
  "zh-tw": ["尋找", "取代", "下一個", "上一個", "全部", "區分大小寫", "正規表示式", "全詞比對", "取代", "全部取代", "關閉", "目前比對", "所在行", "跳至行", "跳轉", "已刪除選取範圍", "已取代第 $ 行的比對項", "已取代 $ 處比對"],
  ja: ["検索", "置換", "次へ", "前へ", "すべて", "大文字小文字を区別", "正規表現", "単語単位", "置換", "すべて置換", "閉じる", "現在の一致", "行", "行へ移動", "移動", "選択を削除", "$ 行の一致を置換", "$ 件を置換"],
  ko: ["찾기", "바꾸기", "다음", "이전", "모두", "대소문자 구분", "정규식", "단어 단위", "바꾸기", "모두 바꾸기", "닫기", "현재 일치", "행", "행 이동", "이동", "선택 삭제", "$ 행 일치 바꿈", "$ 개 바꿈"],
  de: ["Suchen", "Ersetzen", "weiter", "zurück", "alle", "Groß-/Kleinschreibung", "Regulärer Ausdruck", "Ganze Wörter", "ersetzen", "alle ersetzen", "schließen", "Aktueller Treffer", "in Zeile", "Gehe zu Zeile", "los", "Auswahl gelöscht", "Treffer in Zeile $ ersetzt", "$ Treffer ersetzt"],
  fr: ["Rechercher", "Remplacer", "suivant", "précédent", "tous", "Respecter la casse", "Expression régulière", "Mot entier", "remplacer", "tout remplacer", "fermer", "Résultat actuel", "à la ligne", "Aller à la ligne", "aller", "Sélection supprimée", "Résultat remplacé à la ligne $", "$ résultats remplacés"],
};
export function editorPhrases(language) {
  return translations[language] ? Object.fromEntries(keys.map((key, index) => [key, translations[language][index]])) : {};
}
