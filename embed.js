(() => {
  const FIREBASE_DB_URL = "https://timbre-c9547-default-rtdb.europe-west1.firebasedatabase.app";

  const normalizeOrigin = (value) => {
    if (!value) return "";
    try {
      const url = new URL(value);
      return url.origin;
    } catch (err) {
      return "";
    }
  };

  const toOriginList = (val) => {
    if (Array.isArray(val)) return val.map(normalizeOrigin).filter(Boolean);
    if (val && typeof val === "object") return Object.values(val).map(normalizeOrigin).filter(Boolean);
    if (typeof val === "string") return [normalizeOrigin(val)].filter(Boolean);
    return [];
  };

  async function fetchWelcomeConfig(empresa, botId) {
    const safeEmpresa = encodeURIComponent(empresa || "");
    const safeBot = encodeURIComponent(botId || "default");
    const candidatePaths = [
      `empresas/${safeEmpresa}/config/bots/${safeBot}/config/chatWelcome`,
      `empresas/${safeEmpresa}/bots/${safeBot}/config/chatWelcome`,
      `${safeEmpresa}/bots/${safeBot}/config/chatWelcome`
    ];

    for (const path of candidatePaths) {
      const url = `${FIREBASE_DB_URL}/${path}.json`;
      try {
        const res = await fetch(url);
        if (!res.ok) continue;
        const data = await res.json();
        if (data && typeof data === "object") return data;
      } catch (err) {
        console.warn("No se pudo cargar el mensaje de bienvenida", err);
      }
    }

    return null;
  }

  async function fetchAllowedOrigins(empresa, botId) {
    const safeEmpresa = encodeURIComponent(empresa || "");
    const safeBot = encodeURIComponent(botId || "default");
    const candidatePaths = [
      `empresas/${safeEmpresa}/config/bots/${safeBot}/config/allowedUrls`,
      `empresas/${safeEmpresa}/bots/${safeBot}/config/allowedUrls`,
      `${safeEmpresa}/bots/${safeBot}/config/allowedUrls`
    ];

    for (const path of candidatePaths) {
      const url = `${FIREBASE_DB_URL}/${path}.json`;
      try {
        const res = await fetch(url);
        if (!res.ok) continue;
        const data = await res.json();
        const origins = toOriginList(data);
        if (origins.length) return origins;
      } catch (err) {
        console.warn("No se pudieron cargar las URLs permitidas", err);
      }
    }

    return [];
  }

  const main = async () => {
    const script = document.currentScript;
    let scriptUrl = null;
    let pageUrl = null;
    try {
      scriptUrl = script?.src ? new URL(script.src, window.location.href) : null;
    } catch (err) {
      scriptUrl = null;
    }
    try {
      pageUrl = new URL(window.location.href);
    } catch (err) {
      pageUrl = null;
    }

    const empresaAttr = (
      script?.dataset?.empresa ||
      scriptUrl?.searchParams.get("empresa") ||
      pageUrl?.searchParams.get("empresa") ||
      "Boletum"
    ).trim();
    const botAttr = (
      script?.dataset?.bot ||
      scriptUrl?.searchParams.get("bot") ||
      pageUrl?.searchParams.get("bot") ||
      ""
    ).trim();
    const empresa = empresaAttr || "Boletum";
    const botId = botAttr || "default";
    const params = new URLSearchParams({ empresa });
    if (botAttr) params.set("bot", botAttr);
    const iframeSrc = `https://tomos.bot/chat.html?${params.toString()}`;

    const pageOrigin = pageUrl?.origin || window.location.origin;
    const allowedOrigins = await fetchAllowedOrigins(empresa, botAttr);
    if (allowedOrigins.length && pageOrigin) {
      if (!allowedOrigins.includes(pageOrigin)) {
        console.warn("El chat está bloqueado para este sitio.", pageOrigin);
        return;
      }
    }

    // 💅 Estilos del widget
    const style = document.createElement("style");
    style.textContent = `
    #chatWidgetBtn {
      position: fixed; bottom: 24px; left: auto; right: 24px; z-index: 99999;
      --widget-horizontal-translate: 0;
      background: #111; color: #fff; border: none;
      border-radius: 50%; /* valor por defecto, se sobrescribe dinámicamente */
      width: 60px; height: 60px; display: none; align-items: center;
      justify-content: center; cursor: pointer;
      box-shadow: 0 4px 8px rgba(0,0,0,0.25);
      transition: transform .25s ease, box-shadow .25s ease, border-radius .25s ease;
      transform: translateX(var(--widget-horizontal-translate));
    }
    #chatWidgetBtn[data-position="left"] {
      left: 24px;
      right: auto;
      --widget-horizontal-translate: 0;
    }
    #chatWidgetBtn[data-position="center"] {
      left: 50%;
      right: auto;
      --widget-horizontal-translate: -50%;
    }
    #chatWidgetBtn[data-position="right"] {
      right: 24px;
      left: auto;
      --widget-horizontal-translate: 0;
    }
    #chatWidgetBtn:hover {
      transform: translateX(var(--widget-horizontal-translate)) scale(1.05);
      box-shadow: 0 6px 14px rgba(0,0,0,0.3);
    }
        #chatWidgetBtn::after {
    content: "";
    position: absolute;
    bottom: 0px;
    right: -2px;
    width: 13px;
    height: 13px;
    background: #2ecc71;
    border-radius: 50%;
    border: 2px solid #ffffff;
    display: block;
    }

#chatWidgetBubble {
  position: fixed;
  bottom: 96px;
  left: auto;
  right: 24px;
  --widget-bubble-translate: 0;
  background: #ffffff;
  color: #1f2937;
  border-radius: 16px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.18);
  padding: 12px 12px 12px 14px;
  display: none;
  gap: 10px;
  align-items: flex-start;
  cursor: pointer;
  z-index: 99999;
  max-width: 320px;
  transform: translateX(var(--widget-bubble-translate));
}

#chatWidgetBubble[data-position="left"] {
  left: 24px;
  right: auto;
  --widget-bubble-translate: 0;
}

#chatWidgetBubble[data-position="center"] {
  left: 50%;
  right: auto;
  --widget-bubble-translate: -50%;
}

#chatWidgetBubble[data-position="right"] {
  right: 24px;
  left: auto;
  --widget-bubble-translate: 0;
}

#chatWidgetBubble::after {
  content: "";
  position: absolute;
  bottom: -6px;
  right: 28px;
  width: 14px;
  height: 14px;
  background: #ffffff;
  transform: rotate(45deg);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.12);
}

#chatWidgetBubble[data-position="left"]::after {
  left: 28px;
  right: auto;
}

#chatWidgetBubble[data-position="center"]::after {
  left: 50%;
  right: auto;
  transform: translateX(-50%) rotate(45deg);
}

#chatWidgetBubbleMessage {
  font-size: 14px;
  line-height: 1.4;
  margin-right: 6px;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

#chatWidgetBubbleClose {
  background: #eef0f2;
  border: none;
  color: #6b7280;
  border-radius: 50%;
  width: 22px;
  height: 22px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 12px;
  margin-top: 2px;
  flex-shrink: 0;
}

#chatWidgetFrame {
  position: fixed;
  bottom: 90px;
  left: auto;
  right: auto;
  width: 420px;
  max-height: calc(100vh - 110px);
  height: 90vh;
  border: none;
  border-radius: 18px;
  box-shadow: 0 6px 24px rgba(0,0,0,0.2);
  display: none;
  z-index: 99999;
  overflow: hidden;
  transform: translateX(var(--widget-frame-translate));
}


    #chatWidgetFrame[data-position="left"] {
      left: 24px;
      right: auto;
      --widget-frame-translate: 0;
    }
    #chatWidgetFrame[data-position="center"] {
      left: 50%;
      right: auto;
      --widget-frame-translate: -50%;
    }
    #chatWidgetFrame[data-position="right"] {
      right: 24px;
      left: auto;
      --widget-frame-translate: 0;
    }
    @media (max-width:640px){
      #chatWidgetFrame,
      #chatWidgetFrame[data-position="left"],
      #chatWidgetFrame[data-position="center"],
      #chatWidgetFrame[data-position="right"]{
        width:100%;height:100%;bottom:0;left:0;right:0;border-radius:0;
        --widget-frame-translate:0;transform:none;
      }
    }
  `;
    document.head.appendChild(style);

    // 🧩 Crear elementos
    const btn = document.createElement("button");
    btn.id = "chatWidgetBtn";
    btn.innerHTML = "💬";

    const cloneIconNodes = (nodes) => Array.from(nodes || []).map((n) => n.cloneNode(true));
    const applyIconNodes = (nodes) => {
      btn.innerHTML = "";
      nodes.forEach((n) => btn.appendChild(n.cloneNode(true)));
    };

    const createCloseIconNode = () => {
      const close = document.createElement("span");
      close.textContent = "×";
      close.style.fontSize = "32px";
      close.style.lineHeight = "1";
      close.style.color = "#666";
      return close;
    };

    let defaultIconNodes = cloneIconNodes(btn.childNodes);
    let showingCloseIcon = false;

    const setDefaultIconNodes = (nodes) => {
      defaultIconNodes = cloneIconNodes(nodes);
      if (!showingCloseIcon) {
        applyIconNodes(defaultIconNodes);
      }
    };

    const showCloseIcon = () => {
      if (showingCloseIcon) return;
      const currentIcon = cloneIconNodes(btn.childNodes);
      if (currentIcon.length) defaultIconNodes = currentIcon;
      applyIconNodes([createCloseIconNode()]);
      showingCloseIcon = true;
    };

    const restoreDefaultIcon = () => {
      if (!showingCloseIcon) return;
      applyIconNodes(defaultIconNodes);
      showingCloseIcon = false;
    };

    const bubble = document.createElement("div");
    bubble.id = "chatWidgetBubble";
    const bubbleMessage = document.createElement("div");
    bubbleMessage.id = "chatWidgetBubbleMessage";
    const bubbleClose = document.createElement("button");
    bubbleClose.id = "chatWidgetBubbleClose";
    bubbleClose.setAttribute("aria-label", "Cerrar mensaje");
    bubbleClose.textContent = "×";
    bubble.append(bubbleMessage, bubbleClose);

    const frame = document.createElement("iframe");
    frame.id = "chatWidgetFrame";
    frame.src = iframeSrc;
    frame.allow = "clipboard-write; clipboard-read";
    document.body.append(btn, bubble, frame);

    // 🔄 Comunicación con el iframe
    let ready = false, got = false, currentPosition = 'right', welcomeBubbleDismissed = false;
    let welcomeText = "";

    const hideBubble = (permanent = false) => {
      bubble.style.display = "none";
      if (permanent) welcomeBubbleDismissed = true;
    };

    const applyWidgetPosition = (position) => {
      const normalized = (position || '').toString().trim().toLowerCase();
      const valid = ['left', 'center', 'right'];
      const finalPos = valid.includes(normalized) ? normalized : 'right';
      currentPosition = finalPos;
      btn.dataset.position = finalPos;
      frame.dataset.position = finalPos;
      bubble.dataset.position = finalPos;
    };

    const maybeShowBubble = () => {
      if (!welcomeText || welcomeBubbleDismissed) return;
      if (btn.style.display === "none") return;
      bubbleMessage.textContent = welcomeText;
      bubble.style.display = "flex";
      bubble.dataset.position = currentPosition;
    };

    const openChat = () => {
      hideBubble(true);
      frame.style.display = "block";
      showCloseIcon();
      const openFn = () => frame.contentWindow.postMessage({ action: "openChatWindow" }, "*");
      if (ready) {
        openFn();
      } else {
        const i = setInterval(() => {
          if (ready) {
            clearInterval(i);
            openFn();
          }
        }, 50);
      }
    };

    const closeChat = () => {
      frame.style.display = "none";
      restoreDefaultIcon();
    };

    applyWidgetPosition(currentPosition);

    const welcomeConfig = await fetchWelcomeConfig(empresa, botId);
    if (welcomeConfig?.enabled && welcomeConfig?.text) {
      welcomeText = (welcomeConfig.text || "").toString().trim();
      maybeShowBubble();
    }

    bubbleClose.addEventListener("click", (e) => {
      e.stopPropagation();
      hideBubble(true);
    });

    bubble.addEventListener("click", (e) => {
      if (e.target.closest && e.target.closest('#chatWidgetBubbleClose')) return;
      openChat();
    });

    window.addEventListener("message", (e) => {
      if (!e.origin.includes("tomos.bot")) return;
      const d = e.data || {};

      switch (d.action) {

        case "chatReady":
          ready = true;
          frame.contentWindow.postMessage({ action: "getChatButtonIcon" }, "*");
            frame.contentWindow.postMessage({ action: "getChatButtonStatus" }, "*"); // ← añadir esta línea

          break;

        case "chatButtonIcon": {
          btn.setAttribute("data-loaded", d.imageUrl || "");

          // 🟣 Aplicar border-radius dinámico al botón principal
          if (typeof d.radius !== "undefined") {
            btn.style.borderRadius = d.radius + "%";
          }

          const iconNodes = [];

          // 🔹 Si llega un SVG personalizado
          if (d.svg?.includes("<svg")) {
            const svg = new DOMParser()
              .parseFromString(d.svg, "image/svg+xml")
              .querySelector("svg");
            if (svg) {
              svg.setAttribute("width", "28");
              svg.setAttribute("height", "28");
              iconNodes.push(svg);
            }
          }

          // 🔹 Si llega una imagen personalizada desde el chat
          if (!iconNodes.length && d.imageUrl) {
            const img = document.createElement("img");
            img.src = d.imageUrl;
            img.alt = "chat icon";
            img.style.width = "28px";
            img.style.height = "28px";
            img.style.objectFit = "contain";
            iconNodes.push(img);
          }

          // 🔸 Fallback al ícono por defecto si no viene nada
          if (!iconNodes.length) {
            const span = document.createElement("span");
            span.textContent = "💬";
            iconNodes.push(span);
          }

          setDefaultIconNodes(iconNodes);
          break;
        }

        case "chatButtonStatus":
          got = true;
          btn.style.display = d.visible === false ? "none" : "flex";
          if (d.visible === false) {
            frame.style.display = "none";
            restoreDefaultIcon();
            hideBubble();
          } else {
            maybeShowBubble();
          }
          break;

        case "updateChatButtonColor":
          if (d.color) btn.style.backgroundColor = d.color;
          break;

        case "updateWidgetPosition":
          applyWidgetPosition(d.position);
          break;

        case "closeChatWindow":
          closeChat();
          break;
      }
    });

    // 🖱️ Clic en el botón → abrir o cerrar el chat
    btn.onclick = () => {
      const open = frame.style.display === "block";
      if (open) {
        closeChat();
      } else {
        openChat();
      }
    };

    // ⏳ Solicitar estado e ícono periódicamente hasta que responda
    const ping = setInterval(() => {
      if (got) { clearInterval(ping); return; }
      try {
        frame.contentWindow.postMessage({ action: "getChatButtonStatus" }, "*");
        frame.contentWindow.postMessage({ action: "getChatButtonIcon" }, "*");
      } catch {}
    }, 800);
    setTimeout(() => clearInterval(ping), 6000);
  };

  main();
})();
