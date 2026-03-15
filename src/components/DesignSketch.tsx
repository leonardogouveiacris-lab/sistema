import React, { useState } from 'react';
import { X, ChevronLeft, ChevronRight, CreditCard as Edit2, Trash2, FileText, Calendar, Clock, Scale, BookOpen, MessageSquare, ArrowRight, CheckCircle2, XCircle, AlertCircle, Info, Gavel, Coins, File, Search, Plus, Eye, Folder, FolderOpen, BarChart3, ArrowLeft, MoreVertical, ChevronDown, ChevronUp, Table as TableIcon, FileUp, Tag, Hash, User, Building2, StickyNote, Shield, TrendingUp, Layers, Download, Filter, Star } from 'lucide-react';

type SketchTab = 'modal-v1' | 'modal-v2' | 'modal-v3' | 'lista-processos' | 'processo' | 'relatorio';
type LancamentoType = 'decisao' | 'verba' | 'documento';

export default function DesignSketch() {
  const [activeTab, setActiveTab] = useState<SketchTab>('modal-v1');
  const [lancamentoType, setLancamentoType] = useState<LancamentoType>('decisao');

  const groups: { label: string; tabs: { id: SketchTab; label: string }[] }[] = [
    {
      label: 'Modal de Lançamentos',
      tabs: [
        { id: 'modal-v1', label: 'Alt. A — Painel lateral' },
        { id: 'modal-v2', label: 'Alt. B — Duas colunas' },
        { id: 'modal-v3', label: 'Alt. C — Header colorido' },
      ]
    },
    {
      label: 'Telas Principais',
      tabs: [
        { id: 'lista-processos', label: 'Lista de Processos' },
        { id: 'processo', label: 'Processo' },
        { id: 'relatorio', label: 'Relatório' },
      ]
    }
  ];

  const isModalTab = ['modal-v1', 'modal-v2', 'modal-v3'].includes(activeTab);

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
          <div className="flex items-center gap-0 flex-wrap">
            {groups.map((group, gi) => (
              <React.Fragment key={gi}>
                {gi > 0 && <div className="w-px h-5 bg-gray-200 mx-2 self-center" />}
                <span className="text-xs text-gray-400 font-medium pr-3 py-3 whitespace-nowrap">
                  {group.label}
                </span>
                {group.tabs.map(t => (
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
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {isModalTab && (
          <div className="mb-5 flex items-center gap-4">
            <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5 text-sm text-blue-700">
              <span className="font-semibold">Contexto:</span>
              <span>Modal de visualização dos detalhes de um lançamento (Decisão, Verba ou Documento).</span>
            </div>
            <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg p-1">
              <button
                onClick={() => setLancamentoType('decisao')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${lancamentoType === 'decisao' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-gray-700'}`}
              >
                <Gavel size={12} /> Decisão
              </button>
              <button
                onClick={() => setLancamentoType('verba')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${lancamentoType === 'verba' ? 'bg-green-600 text-white' : 'text-gray-500 hover:text-gray-700'}`}
              >
                <Coins size={12} /> Verba
              </button>
              <button
                onClick={() => setLancamentoType('documento')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${lancamentoType === 'documento' ? 'bg-orange-500 text-white' : 'text-gray-500 hover:text-gray-700'}`}
              >
                <File size={12} /> Documento
              </button>
            </div>
          </div>
        )}

        {activeTab === 'modal-v1' && <ModalV1 type={lancamentoType} />}
        {activeTab === 'modal-v2' && <ModalV2 type={lancamentoType} />}
        {activeTab === 'modal-v3' && <ModalV3 type={lancamentoType} />}
        {activeTab === 'lista-processos' && <SketchListaProcessos />}
        {activeTab === 'processo' && <SketchProcesso />}
        {activeTab === 'relatorio' && <SketchRelatorio />}
      </div>
    </div>
  );
}

const MOCK = {
  decisao: {
    tipo: 'Sentença',
    pagina: 326,
    titulo: 'Prescrição Quinquenal',
    situacao: 'Parcialmente Procedente',
    observacoes: '<span class="lancamento-ref-chip" data-type="decisao">◈ Prescrição Quinquenal · Deferida p.328</span> Apurado conforme cálculo pericial. Valor base R$ 12.430,00 com incidência de FGTS.',
    criado: '14/03/2026, 17:04',
    atualizado: '14/03/2026, 18:42',
  },
  verba: {
    tipo: 'Justiça Gratuita',
    pagina: 376,
    titulo: 'Horas Extras — Sentença',
    situacao: 'Deferida',
    fundamentacao: 'Conforme <span class="lancamento-ref-chip" data-type="decisao">◈ Prescrição Quinquenal p.326</span> e cálculos periciais homologados, o valor apurado totalizou R$ 48.320,15.',
    comentarios: 'Verificar índice de correção aplicado. Confirmar base de cálculo com <span class="lancamento-ref-chip" data-type="verba">⬡ Horas Extras p.376</span>.',
    criado: '10/03/2026, 14:30',
    atualizado: '11/03/2026, 09:22',
  },
  documento: {
    tipo: 'Petição',
    pagina: 12,
    titulo: 'Petição Inicial',
    situacao: null,
    comentarios: 'Petição protocolada em 05/01/2026 com pedido de tutela antecipada. Verificar documentos anexos nas páginas seguintes. <span class="lancamento-ref-chip" data-type="documento">⬜ Procuração p.14</span> já indexada.',
    criado: '05/01/2026, 10:14',
    atualizado: '10/03/2026, 16:42',
  },
};

const SITUACAO_COLORS: Record<string, string> = {
  'Parcialmente Procedente': 'bg-yellow-100 text-yellow-800 border-yellow-300',
  'Deferida': 'bg-emerald-100 text-emerald-800 border-emerald-300',
  'Indeferida': 'bg-red-100 text-red-800 border-red-300',
};

const SITUACAO_ICONS: Record<string, React.ReactNode> = {
  'Parcialmente Procedente': <AlertCircle size={13} />,
  'Deferida': <CheckCircle2 size={13} />,
  'Indeferida': <XCircle size={13} />,
};

const TYPE_CONFIG = {
  decisao: { color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200', badge: 'bg-blue-100 text-blue-700', solid: 'bg-blue-600', icon: <Gavel size={14} /> },
  verba: { color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', badge: 'bg-emerald-100 text-emerald-700', solid: 'bg-emerald-600', icon: <Coins size={14} /> },
  documento: { color: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200', badge: 'bg-orange-100 text-orange-700', solid: 'bg-orange-500', icon: <File size={14} /> },
};

function RichText({ html }: { html: string }) {
  return (
    <div
      className="text-sm text-gray-700 leading-relaxed"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function PageBadge({ page, type, onClick }: { page: number; type: LancamentoType; onClick?: () => void }) {
  const cfg = TYPE_CONFIG[type];
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full ${cfg.badge} ${cfg.border} border hover:brightness-95 transition-all`}
    >
      <FileText size={11} />
      Página {page}
    </button>
  );
}

function NavFooter({ type }: { type: LancamentoType }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <button className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-gray-600 bg-white hover:bg-gray-50 border border-gray-200 rounded-lg transition-colors">
          <ChevronLeft size={15} /> Anterior
        </button>
        <button className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-gray-600 bg-white hover:bg-gray-50 border border-gray-200 rounded-lg transition-colors">
          Próximo <ChevronRight size={15} />
        </button>
      </div>
      <div className="flex items-center gap-2">
        <button className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors">
          <Edit2 size={14} /> Editar
        </button>
        <button className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors">
          <Trash2 size={14} /> Excluir
        </button>
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">{children}</p>
  );
}

function Timestamps({ criado, atualizado }: { criado: string; atualizado: string }) {
  return (
    <div className="flex items-center gap-4 text-xs text-gray-400">
      <span className="flex items-center gap-1"><Calendar size={11} /> <span className="text-gray-500 font-medium">Criado</span> {criado}</span>
      <span className="flex items-center gap-1"><Clock size={11} /> <span className="text-gray-500 font-medium">Atualizado</span> {atualizado}</span>
    </div>
  );
}

function NoteCard({ variant, title, notes, pros, contras }: {
  variant: 'blue' | 'green' | 'amber';
  title: string;
  notes: string[];
  pros: string;
  contras: string;
}) {
  const colors = {
    blue: { wrap: 'bg-blue-50 border-blue-200', title: 'text-blue-900', text: 'text-blue-800', sub: 'text-blue-700', divider: 'border-blue-200' },
    green: { wrap: 'bg-green-50 border-green-200', title: 'text-green-900', text: 'text-green-800', sub: 'text-green-700', divider: 'border-green-200' },
    amber: { wrap: 'bg-amber-50 border-amber-200', title: 'text-amber-900', text: 'text-amber-800', sub: 'text-amber-700', divider: 'border-amber-200' },
  }[variant];

  return (
    <div className={`border rounded-xl p-5 max-w-xs flex-shrink-0 ${colors.wrap}`}>
      <p className={`font-bold mb-3 ${colors.title}`}>{title}</p>
      <ul className={`space-y-2 text-xs list-disc list-inside ${colors.text}`}>
        {notes.map((n, i) => <li key={i}>{n}</li>)}
      </ul>
      <div className={`mt-3 pt-3 border-t ${colors.divider}`}>
        <p className={`text-xs font-semibold mb-1 ${colors.sub}`}>Prós</p>
        <p className={`text-xs ${colors.sub}`}>{pros}</p>
        <p className={`text-xs font-semibold mt-2 mb-1 ${colors.sub}`}>Contras</p>
        <p className={`text-xs ${colors.sub}`}>{contras}</p>
      </div>
    </div>
  );
}

function ModalV1({ type }: { type: LancamentoType }) {
  const mock = MOCK[type] as any;
  const cfg = TYPE_CONFIG[type];

  return (
    <div className="flex gap-8 items-start">
      <div className="flex flex-col gap-4 flex-1">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Alternativa A — Painel lateral deslizante (slide-in)</p>

        <div className="relative rounded-xl overflow-hidden shadow-lg border border-gray-200" style={{ height: 520 }}>
          <div className="absolute inset-0 bg-gray-300 flex items-center justify-center">
            <div className="text-center">
              <FileText size={32} className="text-gray-400 mx-auto mb-2" />
              <p className="text-xs text-gray-500 font-medium">PDF Viewer visível ao fundo</p>
              <p className="text-xs text-gray-400">O painel desliza por cima sem ocluir completamente</p>
            </div>
          </div>

          <div
            className="absolute right-0 top-0 bottom-0 bg-white shadow-2xl flex flex-col border-l border-gray-200"
            style={{ width: 420 }}
          >
            <div className={`flex items-start justify-between px-5 pt-4 pb-3 border-b border-gray-100 ${cfg.bg}`}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className={`flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border ${cfg.badge} ${cfg.border}`}>
                    {cfg.icon} {mock.tipo}
                  </span>
                  {mock.pagina && <PageBadge page={mock.pagina} type={type} />}
                </div>
                <h2 className="text-base font-bold text-gray-900 leading-tight">{mock.titulo}</h2>
                {mock.situacao && (
                  <div className="mt-2">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg border ${SITUACAO_COLORS[mock.situacao]}`}>
                      {SITUACAO_ICONS[mock.situacao]} {mock.situacao}
                    </span>
                  </div>
                )}
              </div>
              <button className="ml-3 p-1.5 text-gray-400 hover:text-gray-600 hover:bg-white/70 rounded-lg transition-colors flex-shrink-0">
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {mock.observacoes && (
                <div>
                  <SectionLabel>Observações</SectionLabel>
                  <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
                    <RichText html={mock.observacoes} />
                  </div>
                </div>
              )}
              {mock.fundamentacao && (
                <div>
                  <SectionLabel>Fundamentação</SectionLabel>
                  <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
                    <RichText html={mock.fundamentacao} />
                  </div>
                </div>
              )}
              {mock.comentarios && (
                <div>
                  <SectionLabel>Comentários</SectionLabel>
                  <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
                    <RichText html={mock.comentarios} />
                  </div>
                </div>
              )}
              <div className="pt-1">
                <Timestamps criado={mock.criado} atualizado={mock.atualizado} />
              </div>
            </div>

            <div className="px-5 py-3 border-t border-gray-100 bg-gray-50">
              <NavFooter type={type} />
            </div>
          </div>
        </div>
      </div>

      <NoteCard
        variant="blue"
        title="Alternativa A"
        notes={[
          'Painel deslizante da direita — PDF permanece visível ao fundo',
          'Largura fixa de ~420px, deixando o PDF respirar à esquerda',
          'Header colorido por tipo (azul / verde / laranja) identifica contexto imediatamente',
          'Badge de tipo + badge de página no header — acesso rápido ao go-to',
          'Chips de referência visíveis no conteúdo como tags reais',
          'Fechar com X ou clicando no fundo (backdrop transparente)',
        ]}
        pros="Mantém o PDF visível, ideal para consulta simultânea. Transição natural para edição."
        contras="Em telas pequenas, o painel pode ocupar quase toda a largura."
      />
    </div>
  );
}

function ModalV2({ type }: { type: LancamentoType }) {
  const mock = MOCK[type] as any;
  const cfg = TYPE_CONFIG[type];

  return (
    <div className="flex gap-8 items-start">
      <div className="flex flex-col gap-4 flex-1">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Alternativa B — Modal centralizado com sidebar de metadados</p>

        <div className="bg-black/40 rounded-xl flex items-center justify-center p-6" style={{ minHeight: 520 }}>
          <div className="bg-white rounded-xl shadow-2xl w-full overflow-hidden flex flex-col" style={{ maxWidth: 720, maxHeight: 480 }}>
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className={`w-2 h-2 rounded-full ${cfg.solid}`} />
                <span className="text-sm font-bold text-gray-900">{mock.titulo}</span>
                {mock.situacao && (
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full border ${SITUACAO_COLORS[mock.situacao]}`}>
                    {SITUACAO_ICONS[mock.situacao]} {mock.situacao}
                  </span>
                )}
              </div>
              <button className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                <X size={17} />
              </button>
            </div>

            <div className="flex flex-1 overflow-hidden">
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 border-r border-gray-100">
                {mock.observacoes && (
                  <div>
                    <SectionLabel>Observações</SectionLabel>
                    <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
                      <RichText html={mock.observacoes} />
                    </div>
                  </div>
                )}
                {mock.fundamentacao && (
                  <div>
                    <SectionLabel>Fundamentação</SectionLabel>
                    <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
                      <RichText html={mock.fundamentacao} />
                    </div>
                  </div>
                )}
                {mock.comentarios && (
                  <div>
                    <SectionLabel>Comentários</SectionLabel>
                    <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
                      <RichText html={mock.comentarios} />
                    </div>
                  </div>
                )}
              </div>

              <div className="w-44 flex-shrink-0 px-4 py-4 space-y-4 bg-gray-50/60">
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Tipo</p>
                  <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg border ${cfg.badge} ${cfg.border}`}>
                    {cfg.icon} {mock.tipo}
                  </span>
                </div>

                {mock.pagina && (
                  <div>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Página</p>
                    <button className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg border ${cfg.badge} ${cfg.border} hover:brightness-95 transition-all w-full`}>
                      <FileText size={11} /> p.{mock.pagina} <ArrowRight size={10} className="ml-auto" />
                    </button>
                  </div>
                )}

                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Criado em</p>
                  <p className="text-xs text-gray-600 leading-relaxed">{mock.criado}</p>
                </div>

                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Atualizado</p>
                  <p className="text-xs text-gray-600 leading-relaxed">{mock.atualizado}</p>
                </div>
              </div>
            </div>

            <div className="px-5 py-3 border-t border-gray-100">
              <NavFooter type={type} />
            </div>
          </div>
        </div>
      </div>

      <NoteCard
        variant="green"
        title="Alternativa B"
        notes={[
          'Modal centralizado com backdrop escuro — foco total no conteúdo',
          'Coluna direita com metadados: tipo, página, datas — sem poluir a área principal',
          'Botão de página na sidebar com seta indica que é navegável (go-to)',
          'Título + indicador de cor + badge de situação no header limpo',
          'Área de conteúdo esquerda full-scroll sem interferência dos metadados',
          'Compacto — tamanho controlado, sem desperdiçar espaço vertical',
        ]}
        pros="Separação clara entre conteúdo e metadados. Muito legível e organizado."
        contras="Coluna lateral estreita pode apertar em tipos com muitos metadados."
      />
    </div>
  );
}

function ModalV3({ type }: { type: LancamentoType }) {
  const mock = MOCK[type] as any;
  const cfg = TYPE_CONFIG[type];

  const headerGradients = {
    decisao: 'from-blue-600 to-blue-700',
    verba: 'from-emerald-600 to-emerald-700',
    documento: 'from-orange-500 to-orange-600',
  };

  return (
    <div className="flex gap-8 items-start">
      <div className="flex flex-col gap-4 flex-1">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Alternativa C — Modal com header colorido por tipo e navegação integrada</p>

        <div className="bg-black/40 rounded-xl flex items-center justify-center p-6" style={{ minHeight: 520 }}>
          <div className="bg-white rounded-xl shadow-2xl w-full overflow-hidden flex flex-col" style={{ maxWidth: 660, maxHeight: 500 }}>
            <div className={`bg-gradient-to-br ${headerGradients[type]} px-5 pt-4 pb-5`}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="bg-white/20 rounded-lg p-1.5">
                    {type === 'decisao' && <Gavel size={16} className="text-white" />}
                    {type === 'verba' && <Coins size={16} className="text-white" />}
                    {type === 'documento' && <File size={16} className="text-white" />}
                  </div>
                  <div>
                    <p className="text-white/70 text-xs font-medium">{mock.tipo}</p>
                    <h2 className="text-white font-bold text-base leading-tight">{mock.titulo}</h2>
                  </div>
                </div>
                <button className="p-1.5 text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
                  <X size={18} />
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {mock.situacao && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full bg-white/20 text-white border border-white/30 backdrop-blur-sm">
                      {SITUACAO_ICONS[mock.situacao]} {mock.situacao}
                    </span>
                  )}
                  {mock.pagina && (
                    <button className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full bg-white/20 text-white border border-white/30 hover:bg-white/30 transition-colors">
                      <FileText size={11} /> p.{mock.pagina} <ArrowRight size={10} />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  <button className="flex items-center gap-0.5 px-2.5 py-1 text-xs font-medium rounded-lg bg-white/15 text-white hover:bg-white/25 transition-colors">
                    <ChevronLeft size={13} /> Anterior
                  </button>
                  <button className="flex items-center gap-0.5 px-2.5 py-1 text-xs font-medium rounded-lg bg-white/15 text-white hover:bg-white/25 transition-colors">
                    Próximo <ChevronRight size={13} />
                  </button>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {mock.observacoes && (
                <div>
                  <SectionLabel>Observações</SectionLabel>
                  <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
                    <RichText html={mock.observacoes} />
                  </div>
                </div>
              )}
              {mock.fundamentacao && (
                <div>
                  <SectionLabel>Fundamentação</SectionLabel>
                  <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
                    <RichText html={mock.fundamentacao} />
                  </div>
                </div>
              )}
              {mock.comentarios && (
                <div>
                  <SectionLabel>Comentários</SectionLabel>
                  <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
                    <RichText html={mock.comentarios} />
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between pt-1">
                <Timestamps criado={mock.criado} atualizado={mock.atualizado} />
              </div>
            </div>

            <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/60">
              <div className="flex items-center justify-end gap-2">
                <button className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors">
                  <Edit2 size={14} /> Editar
                </button>
                <button className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors">
                  <Trash2 size={14} /> Excluir
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <NoteCard
        variant="amber"
        title="Alternativa C"
        notes={[
          'Header com gradiente colorido por tipo — identidade visual imediata',
          'Navegação anterior/próximo integrada no header — acesso sem scroll',
          'Badge de situação e badge de página sobre o header — agrupados com o título',
          'Footer simplificado: apenas Editar e Excluir (navegação saiu pro header)',
          'Ícone do tipo destacado com fundo translúcido no header',
          'Chips de referência aparecem naturalmente no conteúdo',
        ]}
        pros="Visual impactante e diferenciado por tipo. Navegação e metadados juntos no topo."
        contras="Header colorido pode parecer pesado em listas longas com muitas cores diferentes."
      />
    </div>
  );
}

const STATUS_BADGE = {
  pendente: 'bg-gray-100 text-gray-600 border-gray-200',
  em_andamento: 'bg-amber-100 text-amber-700 border-amber-200',
  concluido: 'bg-emerald-100 text-emerald-700 border-emerald-200',
};

const STATUS_LABEL = {
  pendente: 'Pendente',
  em_andamento: 'Em Andamento',
  concluido: 'Concluído',
};

const MOCK_PROCESSOS = [
  {
    id: '1',
    numero: '0001234-55.2023.5.15.0001',
    reclamante: 'Maria Aparecida Santos',
    reclamada: 'Construtora Norte S/A',
    observacoes: 'Ação de horas extras e FGTS. Sentença proferida, aguardando recurso ordinário.',
    status: 'em_andamento' as const,
    verbas: 8,
    decisoes: 3,
    criado: '12/01/2023',
  },
  {
    id: '2',
    numero: '0002891-10.2022.5.15.0012',
    reclamante: 'João Carlos Ferreira',
    reclamada: 'Supermercado Bom Preço Ltda',
    observacoes: '',
    status: 'concluido' as const,
    verbas: 12,
    decisoes: 5,
    criado: '03/07/2022',
  },
  {
    id: '3',
    numero: '0000421-77.2024.5.15.0003',
    reclamante: 'Ana Paula de Oliveira',
    reclamada: 'Tech Solutions Informática Ltda',
    observacoes: 'Rescisão indireta. Documentos pendentes de juntada.',
    status: 'pendente' as const,
    verbas: 4,
    decisoes: 1,
    criado: '20/02/2024',
  },
  {
    id: '4',
    numero: '0003172-44.2021.5.15.0008',
    reclamante: 'Roberto Luiz Mendes',
    reclamada: 'Transportadora Veloz Express S/A',
    observacoes: '',
    status: 'concluido' as const,
    verbas: 15,
    decisoes: 7,
    criado: '15/11/2021',
  },
];

function SketchListaProcessos() {
  const [search, setSearch] = useState('');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Redesign — Lista de Processos</p>
          <p className="text-xs text-gray-400 mt-0.5">Prévia estática com dados mockados</p>
        </div>
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700">
          <AlertCircle size={12} />
          Esboço visual — não funcional
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 pt-6 pb-5 border-b border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Processos</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                <span className="font-semibold text-gray-700">4</span> processos cadastrados
              </p>
            </div>
            <button className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm">
              <Plus size={16} />
              Novo Processo
            </button>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex-1 relative">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar por número, parte autora ou ré..."
                className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
              />
            </div>
            <div className="flex items-center gap-1 bg-gray-50 border border-gray-200 rounded-xl p-1">
              {(['pendente', 'em_andamento', 'concluido'] as const).map(s => (
                <button key={s} className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-500 hover:bg-white hover:text-gray-700 hover:shadow-sm transition-all">
                  {STATUS_LABEL[s]}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="divide-y divide-gray-100">
          {MOCK_PROCESSOS.map((p, i) => (
            <div key={p.id} className="flex items-stretch group hover:bg-blue-50/30 transition-colors">
              <div className="w-1 flex-shrink-0 rounded-none" style={{ background: p.status === 'concluido' ? '#10b981' : p.status === 'em_andamento' ? '#f59e0b' : '#d1d5db' }} />

              <div className="flex-1 px-5 py-4 min-w-0">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2.5 mb-1.5">
                      <span className="font-mono text-sm font-bold text-gray-900 truncate">
                        {p.numero}
                      </span>
                      <span className={`flex-shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full border ${STATUS_BADGE[p.status]}`}>
                        {STATUS_LABEL[p.status]}
                      </span>
                    </div>

                    <div className="flex items-center gap-4 text-xs text-gray-500 mb-2">
                      <span className="flex items-center gap-1.5 min-w-0">
                        <User size={11} className="flex-shrink-0 text-blue-400" />
                        <span className="font-medium text-gray-700 truncate">{p.reclamante}</span>
                      </span>
                      <span className="text-gray-300">vs.</span>
                      <span className="flex items-center gap-1.5 min-w-0">
                        <Building2 size={11} className="flex-shrink-0 text-slate-400" />
                        <span className="truncate">{p.reclamada}</span>
                      </span>
                    </div>

                    {p.observacoes && (
                      <p className="text-xs text-gray-400 line-clamp-1 leading-relaxed">
                        {p.observacoes}
                      </p>
                    )}
                  </div>

                  <div className="flex-shrink-0 flex flex-col items-end gap-3">
                    <div className="flex items-center gap-3 text-xs text-gray-400">
                      <span className="flex items-center gap-1">
                        <Gavel size={11} className="text-blue-400" />
                        <span className="font-semibold text-gray-600">{p.decisoes}</span> dec.
                      </span>
                      <span className="flex items-center gap-1">
                        <Scale size={11} className="text-emerald-400" />
                        <span className="font-semibold text-gray-600">{p.verbas}</span> verbas
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">{p.criado}</span>
                      <button className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-blue-600 text-gray-600 hover:text-white text-xs font-semibold border border-gray-200 hover:border-blue-600 rounded-lg transition-all shadow-sm">
                        <Eye size={12} />
                        Acessar
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between">
          <p className="text-xs text-gray-400">Exibindo 4 de 4 processos</p>
          <div className="flex items-center gap-1">
            <button className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-white border border-transparent hover:border-gray-200 transition-all">
              <ChevronLeft size={15} />
            </button>
            <button className="w-8 h-8 flex items-center justify-center rounded-lg bg-blue-600 text-white text-xs font-bold shadow-sm">1</button>
            <button className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-white border border-transparent hover:border-gray-200 transition-all">
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      </div>

      <div className="flex gap-3 text-xs text-gray-500 bg-white border border-gray-200 rounded-xl p-4">
        <Info size={14} className="text-blue-500 flex-shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold text-gray-700">Mudanças neste redesign:</p>
          <ul className="list-disc list-inside space-y-0.5 text-gray-500">
            <li>Barra lateral colorida por status substituiu o ícone de pasta</li>
            <li>Número do processo em <span className="font-mono">font-mono</span> para leitura mais clara</li>
            <li>Partes autora/ré inline com ícones distintos, em vez de labels separadas</li>
            <li>Contadores de decisões e verbas visíveis diretamente no card</li>
            <li>Filtro por status integrado à barra de busca (sem modal separado)</li>
            <li>Paginação numérica no rodapé em vez de "Carregar mais"</li>
            <li>Botão "Acessar" com hover que vira azul sólido para indicar ação primária</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

const PROCESSO_MOCK = {
  numero: '0001234-55.2023.5.15.0001',
  reclamante: 'Maria Aparecida Santos',
  reclamada: 'Construtora Norte S/A',
  status: 'em_andamento' as const,
  criado: '12/01/2023',
  atualizado: '14/03/2026',
  observacoes: 'Ação de horas extras e FGTS. Sentença proferida, aguardando recurso ordinário.',
};

function SketchProcesso() {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ info: true });

  const toggle = (key: string) => setExpanded(prev => ({ ...prev, [key]: !prev[key] }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Redesign — Processo (Detalhes)</p>
          <p className="text-xs text-gray-400 mt-0.5">Prévia estática com dados mockados</p>
        </div>
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700">
          <AlertCircle size={12} />
          Esboço visual — não funcional
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <button className="flex items-center gap-1 hover:text-blue-600 transition-colors font-medium">
            <Folder size={14} />
            Processos
          </button>
          <ChevronRight size={13} className="text-gray-300" />
          <span className="font-mono text-gray-700 font-semibold text-xs bg-gray-100 px-2 py-0.5 rounded-md">
            {PROCESSO_MOCK.numero}
          </span>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-100">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-2">
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${STATUS_BADGE[PROCESSO_MOCK.status]}`}>
                    {STATUS_LABEL[PROCESSO_MOCK.status]}
                  </span>
                  <span className="text-xs text-gray-400">Criado em {PROCESSO_MOCK.criado}</span>
                  <span className="text-xs text-gray-400">· Atualizado {PROCESSO_MOCK.atualizado}</span>
                </div>
                <h2 className="font-mono text-lg font-bold text-gray-900 leading-tight mb-3">
                  {PROCESSO_MOCK.numero}
                </h2>
                <div className="grid grid-cols-2 gap-x-8 gap-y-2">
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-0.5">Parte Autora</p>
                    <div className="flex items-center gap-1.5">
                      <User size={13} className="text-blue-400 flex-shrink-0" />
                      <span className="text-sm font-semibold text-gray-800">{PROCESSO_MOCK.reclamante}</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-0.5">Parte Ré</p>
                    <div className="flex items-center gap-1.5">
                      <Building2 size={13} className="text-slate-400 flex-shrink-0" />
                      <span className="text-sm font-medium text-gray-700">{PROCESSO_MOCK.reclamada}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 bg-white hover:bg-gray-50 border border-gray-200 rounded-xl transition-colors">
                  <ArrowLeft size={14} />
                  Voltar
                </button>
                <button className="w-9 h-9 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 border border-gray-200 rounded-xl transition-colors">
                  <MoreVertical size={16} />
                </button>
              </div>
            </div>

            {PROCESSO_MOCK.observacoes && (
              <div className="mt-3 flex items-start gap-2 px-3 py-2.5 bg-slate-50 rounded-xl border border-slate-200">
                <StickyNote size={13} className="text-slate-400 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-slate-600 leading-relaxed">{PROCESSO_MOCK.observacoes}</p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-4 divide-x divide-gray-100 border-b border-gray-100">
            {[
              { icon: <FileUp size={15} className="text-slate-500" />, label: 'Documentos PDF', value: '2 arquivos', sub: 'Clique para gerenciar' },
              { icon: <TableIcon size={15} className="text-slate-500" />, label: 'Tabela de Dados', value: 'Planilha importada', sub: 'Excel / CSV' },
              { icon: <Gavel size={15} className="text-blue-500" />, label: 'Decisões', value: '3 lançamentos', sub: 'Ver no relatório' },
              { icon: <Scale size={15} className="text-emerald-500" />, label: 'Verbas', value: '8 verbas', sub: '5 deferidas' },
            ].map((item, i) => (
              <button key={i} className="flex flex-col items-start gap-1.5 px-5 py-4 hover:bg-gray-50 transition-colors text-left group">
                <div className="flex items-center gap-2">
                  {item.icon}
                  <span className="text-xs font-semibold text-gray-500 group-hover:text-gray-700">{item.label}</span>
                </div>
                <span className="text-sm font-bold text-gray-900">{item.value}</span>
                <span className="text-xs text-gray-400">{item.sub}</span>
              </button>
            ))}
          </div>

          <div>
            {[
              {
                key: 'info',
                icon: <Info size={14} className="text-blue-500" />,
                label: 'Informações Básicas',
                color: 'text-blue-600',
                content: (
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { label: 'Número do Processo', value: PROCESSO_MOCK.numero, mono: true },
                      { label: 'Data de Criação', value: PROCESSO_MOCK.criado },
                      { label: 'Parte Autora', value: PROCESSO_MOCK.reclamante },
                      { label: 'Parte Ré', value: PROCESSO_MOCK.reclamada },
                    ].map((f, i) => (
                      <div key={i}>
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">{f.label}</p>
                        <p className={`text-sm text-gray-800 font-medium ${f.mono ? 'font-mono' : ''}`}>{f.value}</p>
                      </div>
                    ))}
                    <div className="col-span-2">
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Observações Gerais</p>
                      <p className="text-sm text-gray-600 leading-relaxed">{PROCESSO_MOCK.observacoes}</p>
                    </div>
                  </div>
                )
              },
              {
                key: 'decisoes',
                icon: <Gavel size={14} className="text-blue-500" />,
                label: 'Decisões Judiciais',
                color: 'text-blue-600',
                content: (
                  <div className="space-y-2">
                    {[
                      { tipo: 'Sentença', pagina: 326, situacao: 'Parcialmente Procedente', obs: 'Prescrição quinquenal reconhecida.' },
                      { tipo: 'Acórdão', pagina: 512, situacao: 'Deferida', obs: 'Confirmada em grau recursal.' },
                      { tipo: 'Despacho', pagina: 80, situacao: 'Indeferida', obs: 'Tutela de urgência negada.' },
                    ].map((d, i) => (
                      <div key={i} className="flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-xl border border-gray-200 hover:border-blue-200 transition-colors">
                        <span className="text-xs font-semibold text-blue-700 bg-blue-100 border border-blue-200 px-2 py-0.5 rounded-full">{d.tipo}</span>
                        <span className="text-xs text-gray-500 font-mono">p.{d.pagina}</span>
                        <span className={`text-xs font-semibold flex-1 ${d.situacao === 'Deferida' ? 'text-emerald-700' : d.situacao === 'Indeferida' ? 'text-red-700' : 'text-amber-700'}`}>{d.situacao}</span>
                        <span className="text-xs text-gray-400 truncate max-w-xs">{d.obs}</span>
                      </div>
                    ))}
                  </div>
                )
              },
              {
                key: 'verbas',
                icon: <Scale size={14} className="text-emerald-500" />,
                label: 'Verbas',
                color: 'text-emerald-600',
                content: (
                  <div className="space-y-2">
                    {[
                      { tipo: 'Horas Extras', situacao: 'Deferida', lancamentos: 3 },
                      { tipo: 'FGTS', situacao: 'Deferida', lancamentos: 2 },
                      { tipo: 'Multa 477', situacao: 'Indeferida', lancamentos: 1 },
                      { tipo: 'Aviso Prévio', situacao: 'Parcialmente Procedente', lancamentos: 2 },
                    ].map((v, i) => (
                      <div key={i} className="flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-xl border border-gray-200 hover:border-emerald-200 transition-colors">
                        <Scale size={13} className="text-emerald-400 flex-shrink-0" />
                        <span className="text-sm font-semibold text-gray-800 flex-1">{v.tipo}</span>
                        <span className="text-xs text-gray-400">{v.lancamentos} lanç.</span>
                        <span className={`text-xs font-semibold ${v.situacao === 'Deferida' ? 'text-emerald-700' : v.situacao === 'Indeferida' ? 'text-red-700' : 'text-amber-700'}`}>{v.situacao}</span>
                      </div>
                    ))}
                  </div>
                )
              }
            ].map(section => (
              <div key={section.key} className="border-t border-gray-100 first:border-t-0">
                <button
                  onClick={() => toggle(section.key)}
                  className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    {section.icon}
                    <span className={`text-sm font-semibold ${section.color}`}>{section.label}</span>
                  </div>
                  {expanded[section.key] ? <ChevronUp size={15} className="text-gray-400" /> : <ChevronDown size={15} className="text-gray-400" />}
                </button>
                {expanded[section.key] && (
                  <div className="px-6 pb-5">
                    {section.content}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-3 text-xs text-gray-500 bg-white border border-gray-200 rounded-xl p-4">
          <Info size={14} className="text-blue-500 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold text-gray-700">Mudanças neste redesign:</p>
            <ul className="list-disc list-inside space-y-0.5 text-gray-500">
              <li>Breadcrumb no topo substitui o título genérico "Detalhes do Processo"</li>
              <li>Partes autora/ré em grid lado a lado, com número em destaque font-mono</li>
              <li>Alerta de remoção movido para menu "..." — não ocupa espaço permanente</li>
              <li>Painel de resumo (4 cards) logo abaixo do header: PDFs, Tabela, Decisões, Verbas</li>
              <li>Seções colapsáveis com chevron — informações básicas, decisões e verbas inline</li>
              <li>Hierarquia visual clara: processo → seções, sem multiple cards soltos</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function SketchRelatorio() {
  const [expandedVerbas, setExpandedVerbas] = useState<Record<string, boolean>>({ 'horas-extras': true });

  const toggleVerba = (key: string) => setExpandedVerbas(prev => ({ ...prev, [key]: !prev[key] }));

  const DECISOES = [
    { tipo: 'Sentença', pagina: 326, situacao: 'Parcialmente Procedente', obs: 'Prescrição quinquenal reconhecida. Período apurado: 5 anos.' },
    { tipo: 'Acórdão', pagina: 512, situacao: 'Deferida', obs: 'Confirmada em grau recursal. FGTS integralmente deferido.' },
    { tipo: 'Despacho', pagina: 80, situacao: 'Indeferida', obs: 'Tutela de urgência negada na fase inicial.' },
  ];

  const DOCUMENTOS = [
    { tipo: 'Petição Inicial', pagina: 12, comentario: 'Protocolo em 05/01/2023. Pedidos: horas extras, FGTS, multa 477.' },
    { tipo: 'Contestação', pagina: 44, comentario: 'Alegação de inexistência de horas extras. Cartões de ponto juntados.' },
    { tipo: 'Laudo Pericial', pagina: 210, comentario: 'Apurado total de R$ 48.320,15. Base de cálculo homologada.' },
  ];

  const VERBAS = [
    {
      key: 'horas-extras',
      tipo: 'Horas Extras',
      situacaoFinal: 'Deferida',
      lancamentos: [
        { decisaoRef: 'Sentença p.326', pagina: 145, situacao: 'Deferida', fundamentacao: 'Jornada apurada pelo perito. 2h/dia por 5 anos.' },
        { decisaoRef: 'Acórdão p.512', pagina: 520, situacao: 'Deferida', fundamentacao: 'Mantida em sede recursal.' },
        { decisaoRef: 'Sentença p.326', pagina: 330, situacao: 'Parcialmente Procedente', fundamentacao: 'Reflexos em DSR parcialmente reconhecidos.' },
      ]
    },
    {
      key: 'fgts',
      tipo: 'FGTS + Multa 40%',
      situacaoFinal: 'Deferida',
      lancamentos: [
        { decisaoRef: 'Acórdão p.512', pagina: 516, situacao: 'Deferida', fundamentacao: 'Depósitos insuficientes. Diferença apurada: R$ 12.430,00.' },
        { decisaoRef: 'Sentença p.326', pagina: 328, situacao: 'Deferida', fundamentacao: 'Multa rescisória deferida integralmente.' },
      ]
    },
    {
      key: 'multa-477',
      tipo: 'Multa Art. 477',
      situacaoFinal: 'Indeferida',
      lancamentos: [
        { decisaoRef: 'Sentença p.326', pagina: 342, situacao: 'Indeferida', fundamentacao: 'Verba salarial paga no prazo legal.' },
      ]
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Redesign — Relatório de Liquidação</p>
          <p className="text-xs text-gray-400 mt-0.5">Prévia estática com dados mockados</p>
        </div>
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700">
          <AlertCircle size={12} />
          Esboço visual — não funcional
        </div>
      </div>

      <div className="bg-slate-800 rounded-2xl overflow-hidden shadow-lg">
        <div className="px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <BarChart3 size={16} className="text-slate-400" />
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Relatório de Liquidação</span>
              </div>
              <h2 className="font-mono text-xl font-bold text-white">0001234-55.2023.5.15.0001</h2>
              <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
                <span className="flex items-center gap-1.5"><User size={11} className="text-slate-500" /> Maria Aparecida Santos</span>
                <span className="text-slate-600">vs.</span>
                <span className="flex items-center gap-1.5"><Building2 size={11} className="text-slate-500" /> Construtora Norte S/A</span>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button className="flex items-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white text-sm font-semibold rounded-xl transition-colors border border-white/10">
                <Download size={15} />
                Exportar PDF
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 mt-4">
            {[
              { label: 'Decisões', count: 3, color: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
              { label: 'Documentos', count: 3, color: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
              { label: 'Verbas', count: 3, color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
            ].map(pill => (
              <button key={pill.label} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors hover:brightness-110 ${pill.color}`}>
                {pill.label}
                <span className="bg-white/20 px-1.5 py-0.5 rounded-full text-xs">{pill.count}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-3.5 bg-blue-50 border-b border-blue-100">
            <div className="p-1.5 bg-blue-600 rounded-lg">
              <Gavel size={14} className="text-white" />
            </div>
            <h3 className="text-sm font-bold text-blue-900">Decisões Judiciais</h3>
            <span className="ml-auto text-xs font-semibold text-blue-600 bg-blue-100 border border-blue-200 px-2 py-0.5 rounded-full">3</span>
          </div>
          <div className="divide-y divide-gray-50">
            {DECISOES.map((d, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 transition-colors group">
                <span className="text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-full flex-shrink-0">{d.tipo}</span>
                <span className="text-xs font-mono text-gray-400 flex-shrink-0">p.{d.pagina}</span>
                <span className={`text-xs font-bold flex-shrink-0 ${d.situacao === 'Deferida' ? 'text-emerald-700' : d.situacao === 'Indeferida' ? 'text-red-700' : 'text-amber-700'}`}>
                  {d.situacao}
                </span>
                <span className="text-xs text-gray-500 flex-1 min-w-0 truncate">{d.obs}</span>
                <button className="opacity-0 group-hover:opacity-100 text-xs text-gray-400 hover:text-blue-600 transition-all flex items-center gap-1">
                  <FileText size={11} /> Ver PDF
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-3.5 bg-amber-50 border-b border-amber-100">
            <div className="p-1.5 bg-amber-500 rounded-lg">
              <File size={14} className="text-white" />
            </div>
            <h3 className="text-sm font-bold text-amber-900">Lançamentos de Documentos</h3>
            <span className="ml-auto text-xs font-semibold text-amber-600 bg-amber-100 border border-amber-200 px-2 py-0.5 rounded-full">3</span>
          </div>
          <div className="divide-y divide-gray-50">
            {DOCUMENTOS.map((d, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 transition-colors group">
                <span className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full flex-shrink-0">{d.tipo}</span>
                <span className="text-xs font-mono text-gray-400 flex-shrink-0">p.{d.pagina}</span>
                <span className="text-xs text-gray-500 flex-1 min-w-0 truncate">{d.comentario}</span>
                <button className="opacity-0 group-hover:opacity-100 text-xs text-gray-400 hover:text-amber-600 transition-all flex items-center gap-1">
                  <FileText size={11} /> Ver PDF
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-3.5 bg-emerald-50 border-b border-emerald-100">
            <div className="p-1.5 bg-emerald-600 rounded-lg">
              <Scale size={14} className="text-white" />
            </div>
            <h3 className="text-sm font-bold text-emerald-900">Verbas</h3>
            <span className="ml-auto text-xs font-semibold text-emerald-600 bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded-full">3</span>
          </div>
          <div className="divide-y divide-gray-100">
            {VERBAS.map(v => (
              <div key={v.key}>
                <button
                  onClick={() => toggleVerba(v.key)}
                  className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50 transition-colors text-left"
                >
                  <Scale size={14} className="text-emerald-500 flex-shrink-0" />
                  <span className="flex-1 text-sm font-semibold text-gray-800">{v.tipo}</span>
                  <span className="text-xs text-gray-400">{v.lancamentos.length} lançamentos</span>
                  <span className={`text-xs font-bold ml-2 ${v.situacaoFinal === 'Deferida' ? 'text-emerald-700' : v.situacaoFinal === 'Indeferida' ? 'text-red-700' : 'text-amber-700'}`}>
                    {v.situacaoFinal}
                  </span>
                  {expandedVerbas[v.key]
                    ? <ChevronUp size={14} className="text-gray-400 ml-1 flex-shrink-0" />
                    : <ChevronDown size={14} className="text-gray-400 ml-1 flex-shrink-0" />
                  }
                </button>
                {expandedVerbas[v.key] && (
                  <div className="pb-3 px-5">
                    <div className="border border-gray-100 rounded-xl overflow-hidden">
                      {v.lancamentos.map((l, li) => (
                        <div key={li} className={`px-4 py-3 text-xs ${li > 0 ? 'border-t border-gray-100' : ''} bg-gray-50/50`}>
                          <div className="flex items-center gap-3 mb-1.5">
                            <span className="text-gray-400 font-mono">p.{l.pagina}</span>
                            <span className="text-blue-600 font-semibold">{l.decisaoRef}</span>
                            <span className={`font-bold ml-auto ${l.situacao === 'Deferida' ? 'text-emerald-700' : l.situacao === 'Indeferida' ? 'text-red-700' : 'text-amber-700'}`}>
                              {l.situacao}
                            </span>
                          </div>
                          <p className="text-gray-500 leading-relaxed">{l.fundamentacao}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex gap-3 text-xs text-gray-500 bg-white border border-gray-200 rounded-xl p-4">
        <Info size={14} className="text-blue-500 flex-shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold text-gray-700">Mudanças neste redesign:</p>
          <ul className="list-disc list-inside space-y-0.5 text-gray-500">
            <li>Header escuro com número do processo em destaque e partes inline</li>
            <li>Pills de navegação por seção (Decisões, Documentos, Verbas) no header</li>
            <li>Cada seção com card proprio, header colorido por categoria e contador</li>
            <li>Decisões e documentos como linhas de tabela compactas (em vez de cards grandes)</li>
            <li>Botão "Ver PDF" aparece no hover da linha — acesso rápido sem poluição visual</li>
            <li>Verbas como acordeão: linha de resumo clicável com lançamentos aninhados</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
