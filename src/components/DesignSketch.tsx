import React, { useState } from 'react';
import {
  Save, X, Trash2, CreditCard as Edit2, Eye, FileText, Link2,
  Circle, Clock, CheckCircle2, Calendar, ChevronDown, AlertTriangle,
  BookOpen, Scale, Check, ArrowLeft, MoreVertical, Plus, ChevronRight,
  Layers, MoreHorizontal, ZapOff, Zap, ChevronsRight
} from 'lucide-react';

type SketchTab = 'lancamento-buttons-v1' | 'lancamento-buttons-v2' | 'lancamento-buttons-v3';

const SIDEBAR_WIDTH = 360;

export default function DesignSketch() {
  const [activeTab, setActiveTab] = useState<SketchTab>('lancamento-buttons-v1');

  const tabs: { id: SketchTab; label: string }[] = [
    { id: 'lancamento-buttons-v1', label: 'Alternativa A — Pill row' },
    { id: 'lancamento-buttons-v2', label: 'Alternativa B — Icon rail' },
    { id: 'lancamento-buttons-v3', label: 'Alternativa C — Contextual footer' },
  ];

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-white border-b border-gray-200 px-6 py-4 shadow-sm">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-lg font-bold text-gray-900">Esboço de Redesign</h1>
          <p className="text-xs text-gray-500 mt-0.5">Prévia visual — nenhum componente real foi alterado</p>
        </div>
      </div>

      <div className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex items-center gap-0">
            <span className="text-xs text-gray-400 font-medium pr-3 border-r border-gray-200 mr-1 py-3 whitespace-nowrap">
              Botões de Lançamento na Sidebar
            </span>
            {tabs.map(t => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === t.id
                    ? 'border-blue-600 text-blue-700'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="mb-4 flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5 text-sm text-blue-700">
          <span className="font-semibold">Contexto:</span>
          <span>Botões que aparecem na coluna lateral do PDF Viewer para criar novos lançamentos de Decisão, Verba e Documento. Largura {SIDEBAR_WIDTH}px.</span>
        </div>

        {activeTab === 'lancamento-buttons-v1' && <LancamentoButtonsV1 />}
        {activeTab === 'lancamento-buttons-v2' && <LancamentoButtonsV2 />}
        {activeTab === 'lancamento-buttons-v3' && <LancamentoButtonsV3 />}
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">{children}</p>
  );
}

function SidebarShell({ children, width = SIDEBAR_WIDTH }: { children: React.ReactNode; width?: number }) {
  return (
    <div className="flex flex-col items-center">
      <p className="text-xs text-gray-400 mb-2">Simulação da coluna lateral — largura {width}px</p>
      <div className="bg-gray-200 rounded-xl p-2 shadow-inner" style={{ width: width + 32 }}>
        <div className="bg-white rounded-lg overflow-hidden shadow-md flex flex-col" style={{ width, minHeight: 520 }}>
          {children}
        </div>
      </div>
    </div>
  );
}

function FakeCardDecisao() {
  return (
    <div className="border border-gray-200 bg-white rounded-lg overflow-hidden">
      <div className="px-3 pt-2.5 pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium text-blue-700 bg-blue-100 rounded">
                <FileText size={9} /> p.326
              </span>
              <span className="text-xs text-gray-400">Sentença</span>
            </div>
            <p className="text-sm font-semibold text-gray-900 truncate">fc2473d</p>
            <div className="mt-1"><span className="text-xs font-medium px-1.5 py-0.5 bg-yellow-100 text-yellow-800 border border-yellow-300 rounded">Parcialmente Procedente</span></div>
          </div>
          <div className="flex items-center gap-0.5 opacity-60">
            <button className="p-1.5 text-gray-400 hover:bg-gray-100 rounded"><Eye size={12} /></button>
            <button className="p-1.5 text-blue-400 hover:bg-blue-50 rounded"><Edit2 size={12} /></button>
            <button className="p-1.5 text-red-400 hover:bg-red-50 rounded"><Trash2 size={12} /></button>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 px-3 pt-1.5 pb-1 text-xs text-gray-400 border-t border-gray-100 bg-gray-50">
        <span className="flex items-center gap-1"><Calendar size={10} />10/03/26, 14:22</span>
        <span className="flex items-center gap-1"><Clock size={10} />11/03/26, 09:05</span>
      </div>
    </div>
  );
}

function FakeCardVerba() {
  return (
    <div className="border border-gray-200 bg-white rounded-lg overflow-hidden">
      <div className="px-3 pt-2.5 pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium text-green-700 bg-green-100 rounded">
                <Link2 size={9} /> p.376
              </span>
              <span className="text-xs text-gray-400">Justiça Gratuita</span>
            </div>
            <p className="text-sm font-semibold text-gray-900 truncate">00f32b1 — Sentença</p>
            <div className="mt-1 flex items-center gap-2">
              <span className="text-xs font-medium px-1.5 py-0.5 bg-green-100 text-green-800 border border-green-300 rounded">Deferida</span>
              <span className="flex items-center gap-1 text-xs px-1.5 py-0.5 border rounded bg-blue-100 text-blue-700 border-blue-300">
                <Clock size={9} /> Calculado
              </span>
            </div>
          </div>
          <div className="flex items-center gap-0.5 opacity-60">
            <button className="p-1.5 text-gray-400 hover:bg-gray-100 rounded"><Eye size={12} /></button>
            <button className="p-1.5 text-green-400 hover:bg-green-50 rounded"><Edit2 size={12} /></button>
            <button className="p-1.5 text-red-400 hover:bg-red-50 rounded"><Trash2 size={12} /></button>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 px-3 pt-1.5 pb-1 text-xs text-gray-400 border-t border-gray-100 bg-gray-50">
        <span className="flex items-center gap-1"><Calendar size={10} />10/03/26, 14:30</span>
        <span className="flex items-center gap-1"><Clock size={10} />11/03/26, 09:22</span>
      </div>
    </div>
  );
}

function FakeCardDoc() {
  return (
    <div className="border border-gray-200 bg-white rounded-lg overflow-hidden">
      <div className="px-3 pt-2.5 pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium text-orange-700 bg-orange-100 rounded">
                <FileText size={9} /> p.12
              </span>
            </div>
            <p className="text-sm font-semibold text-gray-900 truncate">Petição Inicial</p>
            <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">Petição protocolada em 05/01/2026 com pedido de tutela...</p>
          </div>
          <div className="flex items-center gap-0.5 opacity-60">
            <button className="p-1.5 text-orange-400 hover:bg-orange-50 rounded"><Edit2 size={12} /></button>
            <button className="p-1.5 text-red-400 hover:bg-red-50 rounded"><Trash2 size={12} /></button>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 px-3 pt-1.5 pb-1 text-xs text-gray-400 border-t border-gray-100 bg-orange-50/60">
        <span className="flex items-center gap-1"><Calendar size={10} />05/01/26, 10:14</span>
        <span className="flex items-center gap-1"><Clock size={10} />10/03/26, 16:42</span>
      </div>
    </div>
  );
}

function FakeSidebarHeader({ tab }: { tab: 'decisoes' | 'verbas' | 'docs' }) {
  const tabs = [
    { id: 'decisoes', label: 'Decisões', count: 6, color: 'text-blue-600 border-b-2 border-blue-600' },
    { id: 'verbas', label: 'Verbas', count: 20, color: 'text-green-600 border-b-2 border-green-600' },
    { id: 'docs', label: 'Docs', count: 11, color: 'text-orange-600 border-b-2 border-orange-600' },
  ];
  return (
    <div className="flex border-b border-gray-200 bg-white">
      {tabs.map(t => (
        <button
          key={t.id}
          className={`flex-1 py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5 ${
            t.id === tab ? t.color : 'text-gray-400'
          }`}
        >
          {t.label}
          <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
            t.id === tab ? 'bg-gray-100 text-gray-700' : 'bg-gray-100 text-gray-400'
          }`}>{t.count}</span>
        </button>
      ))}
    </div>
  );
}

function LancamentoButtonsV1() {
  const [activeExample, setActiveExample] = useState<'decisoes' | 'verbas' | 'docs'>('decisoes');

  return (
    <div className="flex gap-8 items-start">
      <div className="flex flex-col gap-4">
        <SectionLabel>Alternativa A — Pill row com ícone + label</SectionLabel>
        <div className="flex gap-3 mb-2">
          {(['decisoes', 'verbas', 'docs'] as const).map(t => (
            <button
              key={t}
              onClick={() => setActiveExample(t)}
              className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                activeExample === t ? 'bg-gray-800 text-white border-gray-800' : 'text-gray-500 border-gray-300 hover:border-gray-500'
              }`}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        <SidebarShell>
          <FakeSidebarHeader tab={activeExample} />

          {activeExample === 'decisoes' && (
            <>
              <div className="px-3 pt-3 pb-2">
                <button className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg border-2 border-dashed border-blue-300 text-blue-600 hover:bg-blue-50 hover:border-blue-400 transition-all text-sm font-medium">
                  <Plus size={14} />
                  Nova Decisão
                </button>
              </div>
              <div className="px-3 pb-2">
                <input readOnly placeholder="Buscar decisões..." className="w-full text-xs px-2.5 py-1.5 border border-gray-200 rounded-md text-gray-400 bg-gray-50" />
              </div>
              <div className="px-3 pb-3 space-y-2">
                <FakeCardDecisao />
                <FakeCardDecisao />
              </div>
            </>
          )}

          {activeExample === 'verbas' && (
            <>
              <div className="px-3 pt-3 pb-2">
                <div className="flex gap-2">
                  <button className="flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg border-2 border-dashed border-green-300 text-green-600 hover:bg-green-50 hover:border-green-400 transition-all text-xs font-medium">
                    <Plus size={12} />
                    Nova Verba
                  </button>
                  <button className="flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg border-2 border-dashed border-green-200 text-green-500 hover:bg-green-50 hover:border-green-300 transition-all text-xs font-medium">
                    <Plus size={12} />
                    Novo Lançamento
                  </button>
                </div>
              </div>
              <div className="px-3 pb-2">
                <input readOnly placeholder="Buscar verbas..." className="w-full text-xs px-2.5 py-1.5 border border-gray-200 rounded-md text-gray-400 bg-gray-50" />
              </div>
              <div className="px-3 pb-3 space-y-2">
                <FakeCardVerba />
                <FakeCardVerba />
              </div>
            </>
          )}

          {activeExample === 'docs' && (
            <>
              <div className="px-3 pt-3 pb-2">
                <button className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg border-2 border-dashed border-orange-300 text-orange-600 hover:bg-orange-50 hover:border-orange-400 transition-all text-sm font-medium">
                  <Plus size={14} />
                  Novo Documento
                </button>
              </div>
              <div className="px-3 pb-2">
                <input readOnly placeholder="Buscar documentos..." className="w-full text-xs px-2.5 py-1.5 border border-gray-200 rounded-md text-gray-400 bg-gray-50" />
              </div>
              <div className="px-3 pb-3 space-y-2">
                <FakeCardDoc />
                <FakeCardDoc />
              </div>
            </>
          )}
        </SidebarShell>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 max-w-xs text-sm flex-shrink-0">
        <p className="font-bold text-blue-900 mb-3">Alternativa A</p>
        <ul className="text-blue-800 space-y-2 text-xs list-disc list-inside">
          <li>Botão largo com borda tracejada — padrão "drop zone" reconhecível</li>
          <li>Cor herdada do contexto: azul (decisões), verde (verbas), laranja (docs)</li>
          <li>Em Verbas, dois botões menores lado a lado para diferenciar "Verba" de "Lançamento"</li>
          <li>Posicionado entre a tab bar e o campo de busca — local de fácil acesso</li>
          <li>Hover sutil com preenchimento do fundo — feedbacks claros sem peso visual</li>
        </ul>
        <div className="mt-3 pt-3 border-t border-blue-200">
          <p className="text-xs font-semibold text-blue-700 mb-1">Prós</p>
          <p className="text-xs text-blue-700">Ocupa pouco espaço, visualmente intuitivo, reutiliza linguagem de "adicionar item".</p>
          <p className="text-xs font-semibold text-blue-700 mt-2 mb-1">Contras</p>
          <p className="text-xs text-blue-700">Em Verbas, dois botões podem gerar dúvida sobre a diferença entre os dois.</p>
        </div>
      </div>
    </div>
  );
}

function LancamentoButtonsV2() {
  const [activeExample, setActiveExample] = useState<'decisoes' | 'verbas' | 'docs'>('verbas');

  return (
    <div className="flex gap-8 items-start">
      <div className="flex flex-col gap-4">
        <SectionLabel>Alternativa B — Icon rail compacto no topo</SectionLabel>
        <div className="flex gap-3 mb-2">
          {(['decisoes', 'verbas', 'docs'] as const).map(t => (
            <button
              key={t}
              onClick={() => setActiveExample(t)}
              className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                activeExample === t ? 'bg-gray-800 text-white border-gray-800' : 'text-gray-500 border-gray-300 hover:border-gray-500'
              }`}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        <SidebarShell>
          <FakeSidebarHeader tab={activeExample} />

          {activeExample === 'decisoes' && (
            <>
              <div className="px-3 pt-2.5 pb-2 flex items-center gap-2">
                <input readOnly placeholder="Buscar decisões..." className="flex-1 text-xs px-2.5 py-1.5 border border-gray-200 rounded-md text-gray-400 bg-gray-50" />
                <button className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs font-medium transition-colors flex-shrink-0">
                  <Plus size={12} />
                  <span>Decisão</span>
                </button>
              </div>
              <div className="px-3 pb-3 space-y-2">
                <FakeCardDecisao />
                <FakeCardDecisao />
              </div>
            </>
          )}

          {activeExample === 'verbas' && (
            <>
              <div className="px-3 pt-2.5 pb-2 flex items-center gap-2">
                <input readOnly placeholder="Buscar verbas..." className="flex-1 text-xs px-2.5 py-1.5 border border-gray-200 rounded-md text-gray-400 bg-gray-50" />
                <div className="flex gap-1 flex-shrink-0">
                  <button className="flex items-center gap-1 px-2 py-1.5 bg-white hover:bg-green-50 border border-green-300 text-green-700 rounded-md text-xs font-medium transition-colors" title="Nova Verba">
                    <Layers size={11} />
                    <span>Verba</span>
                  </button>
                  <button className="flex items-center gap-1 px-2 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-md text-xs font-medium transition-colors" title="Novo Lançamento">
                    <Plus size={11} />
                    <span>Lançamento</span>
                  </button>
                </div>
              </div>
              <div className="px-3 pb-3 space-y-2">
                <FakeCardVerba />
                <FakeCardVerba />
              </div>
            </>
          )}

          {activeExample === 'docs' && (
            <>
              <div className="px-3 pt-2.5 pb-2 flex items-center gap-2">
                <input readOnly placeholder="Buscar documentos..." className="flex-1 text-xs px-2.5 py-1.5 border border-gray-200 rounded-md text-gray-400 bg-gray-50" />
                <button className="flex items-center gap-1 px-2.5 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-md text-xs font-medium transition-colors flex-shrink-0">
                  <Plus size={12} />
                  <span>Documento</span>
                </button>
              </div>
              <div className="px-3 pb-3 space-y-2">
                <FakeCardDoc />
                <FakeCardDoc />
              </div>
            </>
          )}
        </SidebarShell>
      </div>

      <div className="bg-green-50 border border-green-200 rounded-xl p-5 max-w-xs text-sm flex-shrink-0">
        <p className="font-bold text-green-900 mb-3">Alternativa B</p>
        <ul className="text-green-800 space-y-2 text-xs list-disc list-inside">
          <li>Botão inline ao lado do campo de busca — sem linha extra, layout bem compacto</li>
          <li>Em Verbas: botão outline "Verba" + botão sólido "Lançamento" com hierarquia clara</li>
          <li>Cor sólida indica ação primária — sem ambiguidade</li>
          <li>Altura total preservada: toda linha é busca + ação numa única faixa</li>
          <li>Tooltip reforça a ação nos botões curtos</li>
        </ul>
        <div className="mt-3 pt-3 border-t border-green-200">
          <p className="text-xs font-semibold text-green-700 mb-1">Prós</p>
          <p className="text-xs text-green-700">Muito compacto, não "rouba" espaço vertical, padrão usado em tabelas e toolbars.</p>
          <p className="text-xs font-semibold text-green-700 mt-2 mb-1">Contras</p>
          <p className="text-xs text-green-700">Botão "Lançamento" pode ficar apertado em telas menores; label pode precisar de truncamento.</p>
        </div>
      </div>
    </div>
  );
}

function LancamentoButtonsV3() {
  const [activeExample, setActiveExample] = useState<'decisoes' | 'verbas' | 'docs'>('docs');
  const [expandedMenu, setExpandedMenu] = useState(false);

  return (
    <div className="flex gap-8 items-start">
      <div className="flex flex-col gap-4">
        <SectionLabel>Alternativa C — Footer fixo com FAB contextual</SectionLabel>
        <div className="flex gap-3 mb-2">
          {(['decisoes', 'verbas', 'docs'] as const).map(t => (
            <button
              key={t}
              onClick={() => { setActiveExample(t); setExpandedMenu(false); }}
              className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                activeExample === t ? 'bg-gray-800 text-white border-gray-800' : 'text-gray-500 border-gray-300 hover:border-gray-500'
              }`}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        <SidebarShell>
          <FakeSidebarHeader tab={activeExample} />

          {activeExample === 'decisoes' && (
            <>
              <div className="px-3 pt-2.5 pb-2">
                <input readOnly placeholder="Buscar decisões..." className="w-full text-xs px-2.5 py-1.5 border border-gray-200 rounded-md text-gray-400 bg-gray-50" />
              </div>
              <div className="px-3 pb-3 space-y-2 flex-1">
                <FakeCardDecisao />
                <FakeCardDecisao />
              </div>
              <div className="border-t border-gray-100 px-3 py-2.5 bg-gray-50">
                <button className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors text-sm font-medium shadow-sm">
                  <Plus size={14} />
                  Nova Decisão
                </button>
              </div>
            </>
          )}

          {activeExample === 'verbas' && (
            <>
              <div className="px-3 pt-2.5 pb-2">
                <input readOnly placeholder="Buscar verbas..." className="w-full text-xs px-2.5 py-1.5 border border-gray-200 rounded-md text-gray-400 bg-gray-50" />
              </div>
              <div className="px-3 pb-3 space-y-2 flex-1">
                <FakeCardVerba />
                <FakeCardVerba />
              </div>
              <div className="border-t border-gray-100 px-3 py-2.5 bg-gray-50">
                {expandedMenu && (
                  <div className="mb-2 space-y-1.5">
                    <button className="w-full flex items-center gap-2 py-1.5 px-3 rounded-lg bg-white border border-green-200 text-green-700 hover:bg-green-50 text-xs font-medium transition-colors">
                      <Layers size={12} />
                      Nova Verba (tipo)
                    </button>
                    <button className="w-full flex items-center gap-2 py-1.5 px-3 rounded-lg bg-green-600 text-white hover:bg-green-700 text-xs font-medium transition-colors shadow-sm">
                      <Plus size={12} />
                      Novo Lançamento
                    </button>
                  </div>
                )}
                <button
                  onClick={() => setExpandedMenu(v => !v)}
                  className={`w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg transition-colors text-sm font-medium shadow-sm ${
                    expandedMenu
                      ? 'bg-gray-200 text-gray-700'
                      : 'bg-green-600 hover:bg-green-700 text-white'
                  }`}
                >
                  <Plus size={14} className={`transition-transform ${expandedMenu ? 'rotate-45' : ''}`} />
                  {expandedMenu ? 'Fechar' : 'Novo Lançamento'}
                </button>
              </div>
            </>
          )}

          {activeExample === 'docs' && (
            <>
              <div className="px-3 pt-2.5 pb-2">
                <input readOnly placeholder="Buscar documentos..." className="w-full text-xs px-2.5 py-1.5 border border-gray-200 rounded-md text-gray-400 bg-gray-50" />
              </div>
              <div className="px-3 pb-3 space-y-2 flex-1">
                <FakeCardDoc />
                <FakeCardDoc />
              </div>
              <div className="border-t border-gray-100 px-3 py-2.5 bg-gray-50">
                <button className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-orange-500 hover:bg-orange-600 text-white transition-colors text-sm font-medium shadow-sm">
                  <Plus size={14} />
                  Novo Documento
                </button>
              </div>
            </>
          )}
        </SidebarShell>
        {activeExample === 'verbas' && (
          <p className="text-xs text-gray-400 text-center">Clique em "Novo Lançamento" para ver o menu expandido</p>
        )}
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 max-w-xs text-sm flex-shrink-0">
        <p className="font-bold text-amber-900 mb-3">Alternativa C</p>
        <ul className="text-amber-800 space-y-2 text-xs list-disc list-inside">
          <li>Botão primário ancorado no rodapé — sempre visível sem scrollar</li>
          <li>Em Verbas: botão principal abre mini-menu acima com "Nova Verba" e "Novo Lançamento"</li>
          <li>Lista não compete com o botão — área de conteúdo limpa</li>
          <li>Padrão FAB (Floating Action Button) familiar em apps mobile</li>
          <li>Ícone "+" rotaciona 45° quando aberto para indicar "fechar"</li>
        </ul>
        <div className="mt-3 pt-3 border-t border-amber-200">
          <p className="text-xs font-semibold text-amber-700 mb-1">Prós</p>
          <p className="text-xs text-amber-700">Ação sempre acessível, hierarquia visual clara, lida bem com múltiplas ações (Verbas).</p>
          <p className="text-xs font-semibold text-amber-700 mt-2 mb-1">Contras</p>
          <p className="text-xs text-amber-700">Ocupa uma faixa fixa no rodapé, reduzindo levemente a área de lista.</p>
        </div>
      </div>
    </div>
  );
}
