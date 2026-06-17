import { Link } from 'react-router-dom'
import { RefreshCw, AlertCircle, ChevronRight, ArrowUpRight, ArrowDownRight, Settings, Users, GitBranch, Database, MessageSquare } from 'lucide-react'
import { useDashboard } from '../hooks'
import { useAuth } from '../contexts/AuthContext'

const VIOLET = '#8b5cf6'
const FUCHSIA = '#d946ef'

// Smooth SVG sparkline
function Sparkline({ data, color = VIOLET, h = 24, w = 72 }) {
  if (!data || data.length < 2) return null
  const max = Math.max(...data, 1), min = Math.min(...data, 0), range = max - min || 1
  const pts = data.map((v, i) => ({ x: (i / (data.length - 1)) * w, y: h - ((v - min) / range) * (h - 4) - 2 }))
  const d = pts.map((p, i) => i === 0 ? `M ${p.x} ${p.y}` : `C ${(pts[i-1].x+p.x)/2} ${pts[i-1].y}, ${(pts[i-1].x+p.x)/2} ${p.y}, ${p.x} ${p.y}`).join(' ')
  return <svg width={w} height={h}><path d={d} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" /></svg>
}

// Smooth SVG area chart (violet→fuchsia)
function AreaChart({ data, h = 150 }) {
  if (!data || data.length < 2) return <p className="text-sm text-gray-300 text-center py-10">Necesita mas datos para mostrar tendencia</p>
  const vals = data.map(d => d.conversations), max = Math.max(...vals, 1)
  const pts = vals.map((v, i) => ({ x: (i / (vals.length - 1)) * 100, y: 100 - (v / max) * 90 - 5 }))
  const line = pts.map((p, i) => i === 0 ? `M ${p.x} ${p.y}` : `C ${(pts[i-1].x+p.x)/2} ${pts[i-1].y}, ${(pts[i-1].x+p.x)/2} ${p.y}, ${p.x} ${p.y}`).join(' ')
  return (
    <div>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ height: h }} className="w-full">
        <defs>
          <linearGradient id="ag" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={VIOLET} stopOpacity="0.18" /><stop offset="100%" stopColor={VIOLET} stopOpacity="0" /></linearGradient>
          <linearGradient id="agl" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor={VIOLET} /><stop offset="100%" stopColor={FUCHSIA} /></linearGradient>
        </defs>
        <path d={`${line} L 100 100 L 0 100 Z`} fill="url(#ag)" />
        <path d={line} fill="none" stroke="url(#agl)" strokeWidth="1.5" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        <circle cx={pts[pts.length-1].x} cy={pts[pts.length-1].y} r="2.5" fill={FUCHSIA} vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="flex justify-between text-[10px] text-gray-400 mt-1"><span>{data[0]?.day}</span><span>Hoy</span></div>
    </div>
  )
}

export default function Dashboard() {
  const { stats, hotLeads, campaigns, trend, alerts, systemStatus, loading, refreshing, refresh } = useDashboard()
  const { perfilActivo } = useAuth()

  const s = stats || {}
  const humanMode = s.contacts?.human_mode || 0
  const funnel = s.funnel || {}
  const funnelEntries = Object.entries(funnel).sort((a, b) => a[1].orden - b[1].orden)
  const funnelTotal = funnelEntries.reduce((sum, [, v]) => sum + v.count, 0) || 1
  const ai = s.ai || {}
  const totalAiActions = (ai.datos_guardados || 0) + (ai.pasos_avanzados || 0)
  const sparkConvs = (trend || []).map(d => d.conversations)
  const today = new Date()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-gray-900">Reportes</h1>
            {perfilActivo && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-violet-50 border border-violet-100 text-violet-700 text-xs font-semibold">
                <span className="text-sm leading-none">{perfilActivo.emoji || '📱'}</span>
                {perfilActivo.nombre}
              </span>
            )}
          </div>
          <p className="text-gray-400 mt-0.5 text-sm capitalize">{today.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={refresh} disabled={refreshing} className="p-2 text-gray-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-full text-sm">
            <Dot on={systemStatus.agent.status === 'online'} label="IA" />
            <span className="text-gray-300">|</span>
            <Dot on={systemStatus.whatsapp.status === 'online'} label="WhatsApp" />
          </div>
        </div>
      </div>

      {/* Modo Humano */}
      {humanMode > 0 && (
        <Link to="/conversations" className="flex items-center gap-4 p-4 bg-amber-50 border border-amber-200 rounded-2xl hover:shadow-sm transition-shadow">
          <div className="p-2 bg-amber-100 rounded-xl"><AlertCircle className="h-5 w-5 text-amber-600" /></div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-900">{humanMode} {humanMode === 1 ? 'cliente requiere' : 'clientes requieren'} atencion</p>
            {alerts?.length > 0 && <p className="text-xs text-amber-700 mt-0.5">{alerts.slice(0, 2).map(a => `${a.nombre} (${a.esperando})`).join(' · ')}</p>}
          </div>
          <ChevronRight className="h-5 w-5 text-amber-400" />
        </Link>
      )}

      {/* Row 1: KPIs principales */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPI label="Nuevos leads" value={s.contacts?.new_today || 0} sub={`${s.contacts?.new_week || 0} esta semana`} sparkData={(trend||[]).map(d=>d.new_contacts)} sparkColor={FUCHSIA} link="/contactos" loading={loading} />
        <KPI label="Mensajes hoy" value={s.messages?.today || 0} trend={(s.messages?.today||0)-(s.messages?.yesterday||0)} sparkData={sparkConvs} sparkColor={VIOLET} link="/conversations" loading={loading} />
        <KPI label="Acciones IA" value={totalAiActions} sub="esta semana" loading={loading} />
        <KPI label="Base total" value={s.contacts?.total || 0} sub={`${s.contacts?.con_datos || 0} con datos capturados`} link="/contactos" loading={loading} />
      </div>

      {/* Row 2: Rendimiento IA */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wide">Rendimiento del agente (7 dias)</h3>
          <Link to="/agent" className="text-xs text-violet-600 hover:text-fuchsia-600 font-medium flex items-center gap-1"><Settings className="h-3 w-3" /> Configurar</Link>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <AIMetric icon={MessageSquare} label="Respuestas" value={ai.responses_week || 0} total={ai.user_msgs_week || 0} desc="de mensajes respondidos" />
          <AIMetric icon={Database} label="Datos capturados" value={ai.datos_guardados || 0} color="text-emerald-600" />
          <AIMetric icon={GitBranch} label="Pasos avanzados" value={ai.pasos_avanzados || 0} color="text-violet-600" />
          <AIMetric icon={Users} label="Transferencias" value={ai.transferencias || 0} color="text-amber-600" desc="a modo humano" />
        </div>
      </div>

      {/* Row 3: Camino del cliente */}
      {funnelEntries.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wide">El camino del cliente</h3>
            <Link to="/agent" className="text-xs text-violet-600 hover:text-fuchsia-600 font-medium flex items-center gap-1"><Settings className="h-3 w-3" /> Configurar</Link>
          </div>
          <div className="grid grid-cols-4 gap-3">
            {funnelEntries.map(([key, step], i) => {
              const pct = Math.round((step.count / funnelTotal) * 100)
              // Escala violet→fuchsia segun la etapa
              const t = funnelEntries.length > 1 ? i / (funnelEntries.length - 1) : 0
              const hasContacts = step.count > 0
              return (
                <div
                  key={key}
                  className={`rounded-xl p-4 text-center ${hasContacts ? 'text-white' : 'bg-gray-50 text-gray-400'}`}
                  style={hasContacts ? { background: `linear-gradient(135deg, ${mix(VIOLET, FUCHSIA, t)}, ${mix(VIOLET, FUCHSIA, Math.min(t + 0.18, 1))})` } : undefined}
                >
                  <p className={`text-2xl font-bold ${hasContacts ? '' : 'text-gray-300'}`}>{step.count}</p>
                  <p className={`text-xs mt-1 ${hasContacts ? 'text-white/80' : 'text-gray-400'}`}>{step.titulo}</p>
                  {pct > 0 && <p className={`text-[10px] mt-0.5 ${hasContacts ? 'text-white/60' : ''}`}>{pct}%</p>}
                </div>
              )
            })}
          </div>
          {funnelEntries.length >= 2 && funnelEntries[0][1].count > 0 && (
            <div className="mt-4 pt-3 border-t border-gray-100 text-xs text-gray-500">
              <span className="font-medium text-gray-700">Prediccion: </span>
              {(() => {
                const first = funnelEntries[0][1].count
                const last = funnelEntries[funnelEntries.length - 1][1].count
                const convRate = first > 0 ? Math.round((last / first) * 100) : 0
                const inMiddle = funnelEntries.slice(1, -1).reduce((s, [,v]) => s + v.count, 0)
                return `${convRate}% de conversion total. ${inMiddle} leads en proceso que pueden avanzar.`
              })()}
            </div>
          )}
        </div>
      )}

      {/* Row 4: Grafico + Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 p-5">
          <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">Tendencia de actividad</h3>
          <AreaChart data={trend} />
        </div>

        <div className="space-y-4">
          {hotLeads?.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">Leads con mayor potencial</h3>
              <div className="space-y-2">
                {hotLeads.slice(0, 5).map((lead, i) => (
                  <Link to="/contactos" key={i} className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-violet-50 -mx-2">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0 ${
                      lead.lead_score >= 70 ? 'bg-gradient-to-br from-violet-500 to-fuchsia-500' : lead.lead_score >= 50 ? 'bg-violet-500' : 'bg-violet-300'
                    }`}>{lead.lead_score}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{lead.nombre}</p>
                      <p className="text-[10px] text-gray-400">{lead.paso_funnel || 'Sin paso'}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {(s.campaigns?.total > 0 || campaigns?.activas?.length > 0) && (
            <Link to="/campanas" className="block bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-sm transition-shadow">
              <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">Campanas</h3>
              {campaigns?.activas?.length > 0 ? (
                campaigns.activas.map((c, i) => (
                  <div key={i} className="mb-2">
                    <div className="flex justify-between text-xs mb-1"><span className="font-medium text-gray-700">{c.nombre}</span><span className="text-violet-600">{c.enviados}/{c.total}</span></div>
                    <div className="h-1.5 bg-gray-100 rounded-full"><div className="h-1.5 bg-gradient-to-r from-violet-500 to-fuchsia-500 rounded-full transition-all" style={{ width: `${c.total ? (c.enviados/c.total)*100 : 0}%` }} /></div>
                  </div>
                ))
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div className="text-center"><p className="text-xl font-bold text-gray-900">{s.campaigns?.completadas || 0}</p><p className="text-[10px] text-gray-400">Completadas</p></div>
                  <div className="text-center"><p className="text-xl font-bold text-gray-900">{s.campaigns?.total || 0}</p><p className="text-[10px] text-gray-400">Total</p></div>
                </div>
              )}
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}

// Interpola entre dos colores hex (t: 0..1)
function mix(a, b, t) {
  const ah = a.replace('#', ''), bh = b.replace('#', '')
  const ar = parseInt(ah.slice(0,2),16), ag = parseInt(ah.slice(2,4),16), ab = parseInt(ah.slice(4,6),16)
  const br = parseInt(bh.slice(0,2),16), bg = parseInt(bh.slice(2,4),16), bb = parseInt(bh.slice(4,6),16)
  const r = Math.round(ar + (br-ar)*t), g = Math.round(ag + (bg-ag)*t), bl = Math.round(ab + (bb-ab)*t)
  return `rgb(${r},${g},${bl})`
}

function KPI({ label, value, trend, sub, sparkData, sparkColor, link, loading }) {
  const inner = (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 hover:border-violet-200 hover:shadow-sm transition-all">
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">{label}</p>
      <div className="flex items-end justify-between mt-2">
        <div>
          {loading ? <div className="h-9 w-14 bg-gray-100 rounded animate-pulse" /> : <p className="text-3xl font-bold text-gray-900">{typeof value === 'number' ? value.toLocaleString() : value}</p>}
          <div className="flex items-center gap-2 mt-0.5 h-4">
            {trend !== undefined && trend !== 0 && <span className={`inline-flex items-center gap-0.5 text-[11px] font-medium ${trend > 0 ? 'text-emerald-600' : 'text-red-500'}`}>{trend > 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}{Math.abs(trend)}</span>}
            {sub && <span className="text-[11px] text-gray-400">{sub}</span>}
          </div>
        </div>
        {sparkData?.length > 1 && <Sparkline data={sparkData} color={sparkColor} />}
      </div>
    </div>
  )
  return link ? <Link to={link}>{inner}</Link> : inner
}

function AIMetric({ icon: Icon, label, value, total, desc, color = 'text-violet-600' }) {
  return (
    <div className="text-center">
      <Icon className={`h-5 w-5 mx-auto mb-1.5 ${color}`} />
      <p className="text-xl font-bold text-gray-900">{value}</p>
      <p className="text-[10px] text-gray-500 mt-0.5">{label}</p>
      {total > 0 && <p className="text-[10px] text-gray-400">{Math.round((value/total)*100)}% {desc}</p>}
      {!total && desc && <p className="text-[10px] text-gray-400">{desc}</p>}
    </div>
  )
}

function Dot({ on, label }) {
  return <span className={`inline-flex items-center gap-1.5 text-sm font-medium ${on ? 'text-violet-700' : 'text-gray-500'}`}><span className={`h-2 w-2 rounded-full ${on ? 'bg-violet-500 animate-pulse' : 'bg-gray-400'}`} />{label}</span>
}
