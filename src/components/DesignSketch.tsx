import React, { useState } from 'react';
import { X, ChevronLeft, ChevronRight, CreditCard as Edit2, Trash2, FileText, Calendar, Clock, Scale, BookOpen, MessageSquare, ArrowRight, CheckCircle2, XCircle, AlertCircle, Info, Gavel, Coins, File } from 'lucide-react';

type SketchTab = 'modal-v1' | 'modal-v2' | 'modal-v3';
type LancamentoType = 'decisao' | 'verba' | 'documento';

export default function DesignSketch() {
  const [activeTab, setActiveTab] = useState<SketchTab>('modal-v1');
  const [lancamentoType, setLancamentoType] = useState<LancamentoType>('decisao');

  const tabs: { id: SketchTab; label: string }[] = [
    { id: 'modal-v1', label: 'Alternativa A — Painel lateral' },
    { id: 'modal-v2', label: 'Alternativa B — Duas colunas' },
    { id: 'modal-v3', label: 'Alternativa C — Header colorido' },
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
              Modal de Visualização de Lançamentos
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

        {activeTab === 'modal-v1' && <ModalV1 type={lancamentoType} />}
        {activeTab === 'modal-v2' && <ModalV2 type={lancamentoType} />}
        {activeTab === 'modal-v3' && <ModalV3 type={lancamentoType} />}
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
  'Deferida': 'bg-green-100 text-green-800 border-green-300',
  'Indeferida': 'bg-red-100 text-red-800 border-red-300',
};

const SITUACAO_ICONS: Record<string, React.ReactNode> = {
  'Parcialmente Procedente': <AlertCircle size={13} />,
  'Deferida': <CheckCircle2 size={13} />,
  'Indeferida': <XCircle size={13} />,
};

const TYPE_CONFIG = {
  decisao: { color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200', badge: 'bg-blue-100 text-blue-700', solid: 'bg-blue-600', icon: <Gavel size={14} /> },
  verba: { color: 'text-green-700', bg: 'bg-green-50', border: 'border-green-200', badge: 'bg-green-100 text-green-700', solid: 'bg-green-600', icon: <Coins size={14} /> },
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
    verba: 'from-green-600 to-green-700',
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
