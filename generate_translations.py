import json
from pathlib import Path

LANGUAGES = ['en', 'fr', 'es', 'de', 'pt']
DATA_FILE = Path('translations_data.json')


def load_entries():
    if not DATA_FILE.exists():
        raise FileNotFoundError('translations_data.json not found')
    return json.loads(DATA_FILE.read_text(encoding='utf-8'))


def escape_js(value: str) -> str:
    return value.replace('\\', '\\\\').replace("'", "\\'")


def build_translations_js(entries):
    content_lines = ["(function(){", "  const DEFAULT_LANGUAGE = 'es';", "  const TRANSLATIONS = {"]
    for lang in LANGUAGES:
        content_lines.append(f"    '{lang}': {{")
        for entry in entries:
            key = escape_js(entry['key'])
            value = escape_js(entry[lang])
            content_lines.append(f"      '{key}': '{value}',")
        content_lines.append("    },")
    manager_lines = [
        "  };",
        "  const TRANSLATION_KEYS = new Set(Object.keys(TRANSLATIONS.en));",
        "  const textNodes = [];",
        "  const attrNodes = [];",
        "  let manualTextTargets = [];",
        "  let manualAttrTargets = [];",
        "  let currentLanguage = localStorage.getItem('preferredLanguage') || DEFAULT_LANGUAGE;",
        "  const normalize = (value) => (value || '').replace(/\\s+/g, ' ').trim();",
        "  function getTranslation(lang, key) {",
        "    const normalized = normalize(key);",
        "    const dict = TRANSLATIONS[lang] || {};",
        "    if (Object.prototype.hasOwnProperty.call(dict, normalized)) return dict[normalized];",
        "    if (Object.prototype.hasOwnProperty.call(TRANSLATIONS.en, normalized)) return TRANSLATIONS.en[normalized];",
        "    return key;",
        "  }",
        "  function translate(key, vars) {",
        "    let text = getTranslation(currentLanguage, key);",
        "    if (vars) {",
        "      Object.entries(vars).forEach(([k, v]) => {",
        "        text = text.replace(new RegExp('\\{' + k + '\\}', 'g'), v);",
        "      });",
        "    }",
        "    return text;",
        "  }",
        "  function scanTargets(root = document.body) {",
        "    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);",
        "    let node;",
        "    while ((node = walker.nextNode())) {",
        "      const key = normalize(node.textContent);",
        "      if (!key || !TRANSLATION_KEYS.has(key)) continue;",
        "      textNodes.push({ node, key });",
        "    }",
        "    ['placeholder', 'title', 'aria-label', 'alt'].forEach(attr => {",
        "      root.querySelectorAll(`[${attr}]`).forEach(el => {",
        "        const value = normalize(el.getAttribute(attr));",
        "        if (!value || !TRANSLATION_KEYS.has(value)) return;",
        "        attrNodes.push({ el, attr, key: value });",
        "      });",
        "    });",
        "  }",
        "  function isNodeConnected(node) {",
        "    if (!node) return false;",
        "    if (node.isConnected !== undefined) return node.isConnected;",
        "    return !!(document.body && document.body.contains(node));",
        "  }",
        "",
        "  function cleanupManualTargets() {",
        "    manualTextTargets = manualTextTargets.filter(({ node }) => isNodeConnected(node));",
        "    manualAttrTargets = manualAttrTargets.filter(({ el }) => isNodeConnected(el));",
        "  }",
        "",
        "  function refreshTargets(root = document.body) {",
        "    textNodes.length = 0;",
        "    attrNodes.length = 0;",
        "    scanTargets(root);",
        "    cleanupManualTargets();",
        "    manualTextTargets.forEach(target => { textNodes.push(target); });",
        "    manualAttrTargets.forEach(target => { attrNodes.push(target); });",
        "  }",
        "",
        "  function applyManualTargets() {",
        "    cleanupManualTargets();",
        "    manualTextTargets.forEach(({ node, key, formatter, vars }) => {",
        "      if (!node) return;",
        "      const translated = translate(key, vars);",
        "      node.textContent = formatter ? formatter(translated) : translated;",
        "    });",
        "    manualAttrTargets.forEach(({ el, attr, key, formatter, vars }) => {",
        "      if (!el) return;",
        "      const translated = translate(key, vars);",
        "      el.setAttribute(attr, formatter ? formatter(translated) : translated);",
        "    });",
        "  }",
        "  function applyLanguage(lang) {",
        "    currentLanguage = lang || DEFAULT_LANGUAGE;",
        "    localStorage.setItem('preferredLanguage', currentLanguage);",
        "    document.documentElement.lang = currentLanguage;",
        "    refreshTargets();",
        "    textNodes.forEach(({ node, key, formatter, vars }) => {",
        "      if (!node) return;",
        "      const translated = translate(key, vars);",
        "      node.textContent = formatter ? formatter(translated) : translated;",
        "    });",
        "    attrNodes.forEach(({ el, attr, key, formatter, vars }) => {",
        "      if (!el) return;",
        "      const translated = translate(key, vars);",
        "      el.setAttribute(attr, formatter ? formatter(translated) : translated);",
        "    });",
        "    applyManualTargets();",
        "    document.title = getTranslation(currentLanguage, 'Tomos Bot');",
        "    const select = document.getElementById('languageSelect');",
        "    if (select && select.value !== currentLanguage) select.value = currentLanguage;",
        "  }",
        "  window.translationManager = {",
        "    init() { applyLanguage(currentLanguage); },",
        "    applyLanguage,",
        "    translate,",
        "    getCurrentLanguage: () => currentLanguage,",
        "    collectTargets: refreshTargets,",
        "    normalize,",
        "    register(node, key, target = 'text', options = {}) {",
        "      if (!node || !key) return;",
        "      let targetType = target;",
        "      let opts = options;",
        "      if (typeof target === 'object' && target !== null) {",
        "        opts = target;",
        "        targetType = 'text';",
        "      }",
        "      if (typeof targetType !== 'string' || !targetType) targetType = 'text';",
        "      const normalizedKey = normalize(key);",
        "      if (!normalizedKey) return;",
        "      const formatter = typeof opts.formatter === 'function' ? opts.formatter : null;",
        "      const vars = opts.vars || undefined;",
        "      if (targetType === 'text' || targetType === 'textContent') {",
        "        const existing = manualTextTargets.find(entry => entry.node === node);",
        "        if (existing) {",
        "          existing.key = normalizedKey;",
        "          existing.formatter = formatter;",
        "          existing.vars = vars;",
        "        } else {",
        "          manualTextTargets.push({ node, key: normalizedKey, formatter, vars });",
        "        }",
        "        const translated = translate(normalizedKey, vars);",
        "        node.textContent = formatter ? formatter(translated) : translated;",
        "      } else {",
        "        const attr = targetType;",
        "        const existing = manualAttrTargets.find(entry => entry.el === node && entry.attr === attr);",
        "        if (existing) {",
        "          existing.key = normalizedKey;",
        "          existing.formatter = formatter;",
        "          existing.vars = vars;",
        "        } else {",
        "          manualAttrTargets.push({ el: node, attr, key: normalizedKey, formatter, vars });",
        "        }",
        "        const translated = translate(normalizedKey, vars);",
        "        node.setAttribute(attr, formatter ? formatter(translated) : translated);",
        "      }",
        "    },",
        "    applyManualTargets",
        "  };",
        "})();",
    ]
    content_lines.extend(manager_lines)
    return '\n'.join(content_lines) + '\n'


def main():
    entries = load_entries()
    output = build_translations_js(entries)
    Path('translations.js').write_text(output, encoding='utf-8')


if __name__ == '__main__':
    main()
