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

    const frame = document.createElement("iframe");
    frame.id = "chatWidgetFrame";
    frame.src = iframeSrc;
    frame.allow = "clipboard-write; clipboard-read";
    document.body.append(btn, frame);

    // 🔄 Comunicación con el iframe
    let ready = false, got = false, currentPosition = 'right';

    const applyWidgetPosition = (position) => {
      const normalized = (position || '').toString().trim().toLowerCase();
      const valid = ['left', 'center', 'right'];
      const finalPos = valid.includes(normalized) ? normalized : 'right';
      currentPosition = finalPos;
      btn.dataset.position = finalPos;
      frame.dataset.position = finalPos;
    };

    applyWidgetPosition(currentPosition);

    window.addEventListener("message", (e) => {
      if (!e.origin.includes("tomos.bot")) return;
      const d = e.data || {};

      switch (d.action) {

        case "chatReady":
          ready = true;
          frame.contentWindow.postMessage({ action: "getChatButtonIcon" }, "*");
            frame.contentWindow.postMessage({ action: "getChatButtonStatus" }, "*"); // ← añadir esta línea

          break;

        case "chatButtonIcon":
          btn.innerHTML = ""; // limpiar contenido previo
          btn.setAttribute("data-loaded", d.imageUrl || "");

          // 🟣 Aplicar border-radius dinámico al botón principal
          if (typeof d.radius !== "undefined") {
            btn.style.borderRadius = d.radius + "%";
          }

          // 🔹 Si llega una imagen personalizada desde el chat
// 🔹 Si llega una imagen personalizada desde el chat
if (d.imageUrl) {
  const img = document.createElement("img");
  img.src = d.imageUrl;
  img.alt = "chat icon";
  img.style.width = "28px";
  img.style.height = "28px";
  img.style.objectFit = "contain";

  // ❌ No aplicamos border-radius a la imagen, solo al botón
  btn.appendChild(img);
}

          // 🔹 Si llega un SVG de fallback
          else if (d.svg?.includes("<svg")) {
            const svg = new DOMParser()
              .parseFromString(d.svg, "image/svg+xml")
              .querySelector("svg");
            if (svg) {
              svg.setAttribute("width", "28");
              svg.setAttribute("height", "28");
              btn.appendChild(svg);
            }
          }

          // Mostrar el botón
          break;

        case "chatButtonStatus":
          got = true;
          btn.style.display = d.visible === false ? "none" : "flex";
          if (d.visible === false) frame.style.display = "none";
          break;

        case "updateChatButtonColor":
          if (d.color) btn.style.backgroundColor = d.color;
          break;

        case "updateWidgetPosition":
          applyWidgetPosition(d.position);
          break;

        case "closeChatWindow":
          frame.style.display = "none";
          break;
      }
    });

    // 🖱️ Clic en el botón → abrir o cerrar el chat
    btn.onclick = () => {
      const open = frame.style.display === "block";
      frame.style.display = open ? "none" : "block";
      if (!open) {
        const openFn = () =>
          frame.contentWindow.postMessage({ action: "openChatWindow" }, "*");
        ready
          ? openFn()
          : (() => {
              const i = setInterval(() => {
                if (ready) {
                  clearInterval(i);
                  openFn();
                }
              }, 50);
            })();
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
