import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import './Landing.css'

export default function Landing() {
  const rootRef = useRef(null)

  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    const REDUCE = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const SCRIPTS = [
      {
        em: '💇', name: 'Estética Lumière', tel: '+52 1 55 ···· 0142 · en línea',
        msgs: [
          { who: 'them', t: 'Hola! tienen lugar para corte y color hoy?' },
          { who: 'us', t: '¡Hola! 😊 Hoy tengo a las 4:00 y 6:30 pm. ¿Cuál te queda?' },
          { who: 'them', t: 'la de 6:30 porfa' },
          { who: 'us', t: 'Perfecto, te aparté las 6:30. ¿Me confirmas tu nombre para la cita?' },
        ],
      },
      {
        em: '🔧', name: 'Taller RPM', tel: '+52 1 33 ···· 8890 · en línea',
        msgs: [
          { who: 'them', t: 'cuanto sale una afinación para un jetta 2018?' },
          { who: 'us', t: 'La afinación mayor para tu Jetta va en $2,400 e incluye bujías y filtros. ¿Quieres agendar?' },
          { who: 'them', t: 'y cuanto tardan' },
          { who: 'us', t: 'Mismo día: lo dejas en la mañana y a las 5 está listo. Te aviso por aquí 🚗' },
        ],
      },
      {
        em: '🏠', name: 'Inmobiliaria Sur', tel: '+52 1 81 ···· 2207 · en línea',
        msgs: [
          { who: 'them', t: 'vi el depto de 2 recámaras, sigue disponible?' },
          { who: 'us', t: '¡Sí! Sigue disponible, $14,500/mes. ¿Te late agendar una visita esta semana?' },
          { who: 'them', t: 'necesito algo urgente, me pueden llamar?' },
          { who: 'handoff', t: 'Conectando con un asesor humano…' },
          { who: 'us', t: 'Claro, ahora mismo te comunico con Diana, una de nuestras asesoras 📞' },
        ],
      },
    ]

    const chat = root.querySelector('#chat')
    const phAv = root.querySelector('#ph-av')
    const phName = root.querySelector('#ph-name')
    const phTel = root.querySelector('#ph-tel')
    const chips = [...root.querySelectorAll('#profiles .chip')]

    let current = 0
    let timer = null
    let rotation = null

    function bubbleEl(m) {
      if (m.who === 'handoff') {
        const d = document.createElement('div')
        d.className = 'handoff'
        d.textContent = '⚡ ' + m.t
        return d
      }
      const d = document.createElement('div')
      d.className = 'bubble ' + (m.who === 'them' ? 'them' : 'us')
      const tag = document.createElement('span')
      tag.className = 'tag'
      tag.textContent = m.who === 'them' ? 'CLIENTE' : 'AGENTE WTX'
      d.appendChild(tag)
      d.appendChild(document.createTextNode(m.t))
      return d
    }

    function typingEl() {
      const d = document.createElement('div')
      d.className = 'typing'
      d.innerHTML = '<span></span><span></span><span></span>'
      return d
    }

    function playScript(i) {
      clearTimeout(timer)
      const s = SCRIPTS[i]
      if (phAv) phAv.textContent = s.em
      if (phName) phName.textContent = s.name
      if (phTel) phTel.textContent = s.tel
      if (chat) chat.innerHTML = ''
      if (REDUCE) {
        s.msgs.forEach((m) => chat && chat.appendChild(bubbleEl(m)))
        return
      }
      let idx = 0
      const step = () => {
        if (idx >= s.msgs.length) {
          timer = setTimeout(() => playScript(i), 2600)
          return
        }
        const m = s.msgs[idx]
        if (m.who === 'them' || m.who === 'handoff') {
          chat && chat.appendChild(bubbleEl(m))
          idx++
          timer = setTimeout(step, 900)
        } else {
          const t = typingEl()
          chat && chat.appendChild(t)
          timer = setTimeout(() => {
            t.remove()
            chat && chat.appendChild(bubbleEl(m))
            idx++
            timer = setTimeout(step, 1100)
          }, 1200)
        }
      }
      step()
    }

    function select(i, fromUser) {
      current = i
      chips.forEach((c, ci) => c.setAttribute('aria-selected', ci === i ? 'true' : 'false'))
      playScript(i)
      if (fromUser) {
        clearInterval(rotation)
        startRotation()
      }
    }

    function startRotation() {
      if (REDUCE) return
      rotation = setInterval(() => select((current + 1) % SCRIPTS.length, false), 9000)
    }

    const chipHandlers = chips.map((c) => {
      const handler = () => select(+c.dataset.i, true)
      c.addEventListener('click', handler)
      return { c, handler }
    })

    select(0, false)
    startRotation()

    // Multi-number card stack
    const NUMS = [
      { em: '💇', name: 'Estética Lumière', tel: '+52 1 55 ···· 0142', a: '38', b: '4' },
      { em: '🔧', name: 'Taller RPM', tel: '+52 1 33 ···· 8890', a: '112', b: '9' },
      { em: '🏠', name: 'Inmobiliaria Sur', tel: '+52 1 81 ···· 2207', a: '67', b: '6' },
    ]
    const stack = root.querySelector('#stack')
    if (stack) {
      stack.innerHTML = ''
      NUMS.forEach((n) => {
        const c = document.createElement('div')
        c.className = 'card-num'
        c.innerHTML = `<div class="em">${n.em}</div><div class="name">${n.name}</div><div class="tel">${n.tel}</div>
          <div class="row"><div><b class="grad-text">${n.a}</b><small>CHATS HOY</small></div>
          <div><b class="grad-text">${n.b}</b><small>LEADS NUEVOS</small></div>
          <div><b style="color:var(--wa)">●</b><small>CONECTADO</small></div></div>`
        stack.appendChild(c)
      })
    }
    const numCards = stack ? [...stack.children] : []
    function layout(active) {
      numCards.forEach((c, i) => {
        const d = (i - active + NUMS.length) % NUMS.length
        c.style.zIndex = 10 - d
        c.style.top = d * 28 + 'px'
        c.style.left = d * 5 + '%'
        c.style.transform = `scale(${1 - d * 0.05})`
        c.style.opacity = d > 2 ? 0 : 1 - d * 0.16
      })
    }
    let act = 0
    let stackInterval = null
    if (numCards.length) {
      layout(0)
      if (!REDUCE) {
        stackInterval = setInterval(() => {
          act = (act + 1) % NUMS.length
          layout(act)
        }, 2600)
      }
    }

    // Scroll reveal
    const io = new IntersectionObserver(
      (es) => {
        es.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('in')
            io.unobserve(e.target)
          }
        })
      },
      { threshold: 0.15 }
    )
    root.querySelectorAll('.reveal').forEach((el) => io.observe(el))

    return () => {
      clearTimeout(timer)
      clearInterval(rotation)
      if (stackInterval) clearInterval(stackInterval)
      chipHandlers.forEach(({ c, handler }) => c.removeEventListener('click', handler))
      io.disconnect()
    }
  }, [])

  return (
    <div className="landing-root" ref={rootRef}>
      <nav>
        <div className="wrap nav-in">
          <div className="logo"><span className="mark"></span>WTX</div>
          <div className="nav-links">
            <a href="#como">Cómo funciona</a>
            <a href="#numeros">Multi-número</a>
            <a href="#features">Funciones</a>
            <Link to="/login">Entrar</Link>
            <Link to="/register" className="btn btn-brand">Empezar gratis</Link>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <header className="hero">
        <div className="wrap hero-grid">
          <div>
            <span className="eyebrow"><span className="pulse"></span><b>Agente de WhatsApp con IA</b></span>
            <h1>Tu WhatsApp responde solo <span className="g">y suena como tú</span>.</h1>
            <p className="lead">Conecta todos tus números a un agente que atiende a tus clientes 24/7, en español, y te avisa cuando una conversación necesita manos humanas.</p>
            <div className="cta-row">
              <Link to="/register" className="btn btn-brand">Conectar mi WhatsApp</Link>
              <a href="#como" className="btn btn-ghost">Ver cómo funciona</a>
            </div>
            <p className="cta-note">SIN TARJETA · LISTO EN MINUTOS · CANCELA CUANDO QUIERAS</p>
          </div>

          <div className="stage">
            <div className="profiles" id="profiles" role="tablist" aria-label="Elige un negocio">
              <button className="chip" role="tab" aria-selected="true" data-i="0"><span className="em">💇</span>Estética Lumière</button>
              <button className="chip" role="tab" aria-selected="false" data-i="1"><span className="em">🔧</span>Taller RPM</button>
              <button className="chip" role="tab" aria-selected="false" data-i="2"><span className="em">🏠</span>Inmobiliaria Sur</button>
            </div>
            <div className="phone">
              <div className="phone-top">
                <div className="avatar" id="ph-av">💇</div>
                <div className="who"><span id="ph-name">Estética Lumière</span><small id="ph-tel">+52 1 55 ···· 0142 · en línea</small></div>
              </div>
              <div className="chat" id="chat" aria-live="polite"></div>
            </div>
          </div>
        </div>
      </header>

      {/* TICKER */}
      <div className="ticker" aria-hidden="true">
        <div className="ticker-in" id="ticker">
          <span><b>0</b> mensajes sin responder <span className="pip">◆</span></span>
          <span>responde en <b>&lt; 3 s</b> <span className="pip">◆</span></span>
          <span><b>24/7</b> sin descanso <span className="pip">◆</span></span>
          <span><b>∞</b> números, una cuenta <span className="pip">◆</span></span>
          <span>en <b>español</b> de verdad <span className="pip">◆</span></span>
          <span>handoff a <b>humano</b> cuando hace falta <span className="pip">◆</span></span>
        </div>
      </div>

      {/* PROBLEM */}
      <section>
        <div className="wrap">
          <div className="sec-head reveal">
            <span className="mono">El costo de tardar</span>
            <h2>Cada mensaje sin contestar es un cliente que ya le escribió a otro.</h2>
            <p>El 90% de la gente espera respuesta en minutos. Tú duermes, comes y atiendes el local. Tu WhatsApp, no debería.</p>
          </div>
          <div className="miss reveal">
            <div><div className="num">5 h</div><div className="lbl">tarda en promedio un negocio en responder un mensaje fuera de horario.</div></div>
            <div><div className="num">42%</div><div className="lbl">de los clientes se va con quien le contesta primero, no con el más barato.</div></div>
            <div><div className="num">$0</div><div className="lbl">cuesta un lead que entró a las 11 p.m. y nadie vio hasta mañana. Cuesta la venta.</div></div>
          </div>
        </div>
      </section>

      {/* HOW */}
      <section className="how" id="como">
        <div className="wrap">
          <div className="sec-head reveal">
            <span className="mono">De cero a respondiendo</span>
            <h2>Tres pasos. Después se cuida solo.</h2>
          </div>
          <div className="steps reveal">
            <div className="step"><div className="idx">01</div>
              <div><h3>Conecta tu número</h3><p>Escaneas un código QR con tu WhatsApp, como cuando abres WhatsApp Web. Sin cambiar de número, sin apps raras. ¿Tienes varios? Conéctalos todos.</p></div></div>
            <div className="step"><div className="idx">02</div>
              <div><h3>Dile cómo atiende tu negocio</h3><p>Le cuentas a qué te dedicas, tus precios y tu tono. El agente arma su personalidad y aprende de tu base de conocimiento. Cada número con la suya.</p></div></div>
            <div className="step"><div className="idx">03</div>
              <div><h3>Responde, califica y te avisa</h3><p>Contesta dudas, guarda los datos del cliente, lo mueve por tu embudo y, si la cosa se pone seria, te pasa la conversación al instante.</p></div></div>
          </div>
        </div>
      </section>

      {/* MULTI-NUMBER (signature) */}
      <section id="numeros">
        <div className="wrap switch-demo">
          <div className="reveal">
            <span className="mono" style={{ color: 'var(--fuchsia)', display: 'block', marginBottom: '1rem' }}>Lo que nadie más hace bien</span>
            <h2>Todos tus números. <span className="grad-text">Un solo lugar.</span></h2>
            <p style={{ color: 'var(--muted)', marginTop: '1rem', fontSize: '1.08rem' }}>Cada número es un perfil con su propio agente, sus clientes y sus conversaciones — aislados de verdad. Cambias entre ellos como cambias de cuenta en Stripe: un clic y estás en otro negocio.</p>
            <div className="cta-row" style={{ marginTop: '1.8rem' }}><Link to="/register" className="btn btn-brand">Crear mi primer perfil</Link></div>
          </div>
          <div className="stack" id="stack" aria-hidden="true"></div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features">
        <div className="wrap">
          <div className="sec-head reveal">
            <span className="mono">Todo lo que necesita un negocio que vende por chat</span>
            <h2>No es un bot de respuestas. Es tu equipo de atención.</h2>
          </div>
          <div className="feat">
            <div className="card span reveal">
              <div className="ic">🧠</div>
              <h3>Agente con IA que entiende, no que repite</h3>
              <p>Conversa en español natural, recuerda lo que ya hablaste con cada cliente y decide qué hacer en cada mensaje. Sin menús, sin "marca 1 para ventas".</p>
            </div>
            <div className="card reveal"><div className="ic">👥</div><h3>CRM con lead scoring</h3><p>Cada contacto se guarda, se etiqueta y se califica solo según cómo conversa.</p></div>
            <div className="card reveal"><div className="ic">📣</div><h3>Campañas masivas</h3><p>Manda mensajes a tu base con tu ritmo, personalizados, y mide quién respondió.</p></div>
            <div className="card reveal"><div className="ic">🤝</div><h3>Modo humano</h3><p>Cuando el cliente se frustra o pide a una persona, el agente se hace a un lado y te avisa.</p></div>
            <div className="card reveal"><div className="ic">🪜</div><h3>Embudo de ventas</h3><p>Define los pasos de tu proceso y deja que el agente lleve a cada cliente por ellos.</p></div>
            <div className="card reveal"><div className="ic">📚</div><h3>Base de conocimiento</h3><p>Carga tus precios, políticas y respuestas. El agente las usa para contestar bien.</p></div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="final" id="empezar">
        <div className="wrap">
          <div className="box reveal">
            <div className="grain"></div>
            <span className="mono">Empieza hoy</span>
            <h2 style={{ marginTop: '1rem' }}>Deja que tu WhatsApp trabaje mientras tú vives.</h2>
            <p>Conecta tu primer número en minutos y mira al agente responder a tu primer cliente esta misma noche.</p>
            <Link to="/register" className="btn btn-brand">Empezar gratis →</Link>
          </div>
        </div>
      </section>

      <footer>
        <div className="wrap foot">
          <div className="logo"><span className="mark"></span>WTX</div>
          <div className="mono">Hecho para negocios que venden por WhatsApp · LATAM</div>
        </div>
      </footer>
    </div>
  )
}
