import React, { useState } from 'react';
import { Save, X, Trash2, CreditCard as Edit2, Eye, FileText, Link2, Circle, Clock, CheckCircle2, Calendar, ChevronDown, AlertTriangle, BookOpen, Scale, Check, ArrowLeft, MoreVertical } from 'lucide-react';

type SketchTab =
  | 'decisao-modal'
  | 'verba-modal'
  | 'cards'
  | 'documento-modal'
  | 'documento-cards'
  | 'sidebar-decisao'
  | 'sidebar-verba'
  | 'sidebar-documento';

type ViewMode = 'atual' | 'proposto';

const SIDEBAR_WIDTH = 360;

export default function DesignSketch() {
  const [activeTab, setActiveTab] = useState<SketchTab>('sidebar-decisao');
  const [viewMode, setViewMode] = useState<ViewMode>('proposto');

  const tabGroups = [
    {
      label: 'Formulários na Sidebar',
      tabs: [
        { id: 'sidebar-decisao' as SketchTab, label: 'Sidebar — Decisão' },
        { id: 'sidebar-verba' as SketchTab, label: 'Sidebar — Verba' },
        { id: 'sidebar-documento' as SketchTab, label: 'Sidebar — Documento' },
      ],
    },
    {
      label: 'Modais Overlay (Visualização)',
      tabs: [
        { id: 'decisao-modal' as SketchTab, label: 'Modal — Decisão' },
        { id: 'verba-modal' as SketchTab, label: 'Modal — Verba' },
        { id: 'documento-modal' as SketchTab, label: 'Modal — Documento' },
      ],
    },
    {
      label: 'Cards',
      tabs: [
        { id: 'cards' as SketchTab, label: 'Cards — Decisão/Verba' },
        { id: 'documento-cards' as SketchTab, label: 'Cards — Documento' },
      ],
    },
  ];

  const sidebarTabs: SketchTab[] = ['sidebar-decisao', 'sidebar-verba', 'sidebar-documento'];
  const isSidebarTab = sidebarTabs.includes(activeTab);

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-white border-b border-gray-200 px-6 py-4 shadow-sm">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-900">Esboço de Redesign</h1>
            <p className="text-xs text-gray-500 mt-0.5">Prévia visual — nenhum componente real foi alterado</p>
          </div>
          <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('atual')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === 'atual' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Atual
            </button>
            <button
              onClick={() => setViewMode('proposto')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === 'proposto' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Proposto
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6">
          {tabGroups.map(group => (
            <div key={group.label} className="flex items-center gap-0">
              <span className="text-xs text-gray-400 font-medium pr-3 border-r border-gray-200 mr-1 py-3 whitespace-nowrap">{group.label}</span>
              {group.tabs.map(t => (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === t.id ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                  {t.label}
                </button>
              ))}
              <div className="flex-1 border-b-2 border-transparent" />
            </div>
          ))}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {isSidebarTab && (
          <div className="mb-4 flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5 text-sm text-blue-700">
            <span className="font-semibold">Contexto:</span>
            <span>Estas telas são formulários inline que aparecem <em>dentro da coluna lateral</em> do PDF Viewer (largura {SIDEBAR_WIDTH}px). Não são modais flutuantes.</span>
          </div>
        )}

        {activeTab === 'decisao-modal' && (viewMode === 'atual' ? <DecisaoModalAtual /> : <DecisaoModalProposto />)}
        {activeTab === 'verba-modal' && (viewMode === 'atual' ? <VerbaModalAtual /> : <VerbaModalProposto />)}
        {activeTab === 'cards' && (viewMode === 'atual' ? <CardsAtuais /> : <CardsPropostos />)}
        {activeTab === 'documento-modal' && (viewMode === 'atual' ? <DocumentoModalAtual /> : <DocumentoModalProposto />)}
        {activeTab === 'documento-cards' && (viewMode === 'atual' ? <DocumentoCardsAtuais /> : <DocumentoCardsPropostos />)}
        {activeTab === 'sidebar-decisao' && (viewMode === 'atual' ? <SidebarDecisaoAtual /> : <SidebarDecisaoProposto />)}
        {activeTab === 'sidebar-verba' && (viewMode === 'atual' ? <SidebarVerbaAtual /> : <SidebarVerbaProposto />)}
        {activeTab === 'sidebar-documento' && (viewMode === 'atual' ? <SidebarDocumentoAtual /> : <SidebarDocumentoProposto />)}
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
      <p className="text-xs text-gray-400 mb-2">
        Simulação da coluna lateral — largura {width}px
      </p>
      <div
        className="bg-gray-200 rounded-xl p-2 shadow-inner"
        style={{ width: width + 32 }}
      >
        <div
          className="bg-white rounded-lg overflow-hidden shadow-md flex flex-col"
          style={{ width, minHeight: 480 }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

function FakeDropdown({ label, value, required, small }: { label: string; value: string; required?: boolean; small?: boolean }) {
  return (
    <div>
      <label className={`block font-medium text-gray-700 mb-1 ${small ? 'text-xs' : 'text-sm'}`}>
        {label}{required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <div className="relative w-full border border-gray-300 rounded-md">
        <div className={`w-full px-2.5 bg-white flex items-center justify-between text-gray-900 ${small ? 'py-1.5 text-xs' : 'py-2 text-sm'}`}>
          <span>{value}</span>
          <ChevronDown size={12} className="text-gray-400 flex-shrink-0" />
        </div>
      </div>
    </div>
  );
}

function FakeInput({ label, value, required, small, center }: { label: string; value: string; required?: boolean; small?: boolean; center?: boolean }) {
  return (
    <div>
      <label className={`block font-medium text-gray-700 mb-1 ${small ? 'text-xs' : 'text-sm'}`}>
        {label}{required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <input
        readOnly
        value={value}
        className={`w-full px-2.5 border border-gray-300 rounded-md text-gray-900 bg-white focus:outline-none ${small ? 'py-1.5 text-xs' : 'py-2 text-sm'} ${center ? 'text-center' : ''}`}
      />
    </div>
  );
}

function FakeRichText({ label, value, small }: { label: string; value?: string; small?: boolean }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className={`block font-medium text-gray-700 ${small ? 'text-xs' : 'text-sm'}`}>{label}</label>
        <button className={`inline-flex items-center px-1.5 py-0.5 font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded hover:bg-blue-100 ${small ? 'text-xs' : 'text-xs'}`}>
          ↗ Expandir
        </button>
      </div>
      <div className="border border-gray-300 rounded-md">
        <div className="flex items-center gap-2 px-2.5 py-1 border-b border-gray-200 bg-gray-50">
          <span className="text-xs font-bold text-gray-500">B</span>
          <span className="text-xs italic text-gray-500">I</span>
          <span className="text-xs underline text-gray-500">U</span>
        </div>
        <div className={`px-2.5 py-2 text-gray-500 italic ${small ? 'min-h-[56px] text-xs' : 'min-h-[64px] text-sm'}`}>
          {value || 'Clique para editar...'}
        </div>
      </div>
    </div>
  );
}

function SidebarDecisaoAtual() {
  return (
    <div className="flex flex-col items-center gap-4">
      <SectionLabel>Formulário Inline de Decisão na Sidebar (Versão Atual)</SectionLabel>
      <SidebarShell>
        <div className="px-3 py-3 border-b border-gray-200 flex items-center justify-between bg-gray-50">
          <div className="flex items-center gap-2">
            <Scale size={15} className="text-blue-600" />
            <h3 className="text-sm font-semibold text-gray-900">Editar Decisão</h3>
          </div>
          <button className="p-1 text-gray-400 hover:text-gray-600"><X size={14} /></button>
        </div>

        <div className="p-3 space-y-3 flex-1 overflow-y-auto">
          <FakeDropdown label="Tipo de Decisão" value="Sentença" required small />
          <FakeInput label="ID da Decisão" value="fc2473d" required small />
          <FakeDropdown label="Situação" value="Parcialmente Procedente" required small />
          <FakeRichText label="Observações" small />
          <div className="pt-2 border-t border-gray-200 text-xs text-gray-400">
            ID: <span className="font-mono">fc2473d-uuid</span> · Criado: 10/03/2026
          </div>
        </div>

        <div className="px-3 py-3 border-t border-gray-200 bg-gray-50 flex justify-end gap-2">
          <button className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md">Cancelar</button>
          <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-md">
            <Save size={12} /> Salvar
          </button>
        </div>
      </SidebarShell>

      <div className="bg-gray-50 border border-dashed border-gray-300 rounded-lg p-4 text-xs text-gray-500 max-w-sm text-center">
        Campos empilhados em coluna única. Sem header contextual, sem timestamps separados, sem confirmação de exclusão inline, sem badge de situação.
      </div>
    </div>
  );
}

function SidebarDecisaoProposto() {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [situacao] = useState('Parcialmente Procedente');

  const situacaoColor: Record<string, string> = {
    'Procedente': 'bg-green-100 text-green-800 border-green-300',
    'Improcedente': 'bg-red-100 text-red-800 border-red-300',
    'Parcialmente Procedente': 'bg-yellow-100 text-yellow-800 border-yellow-300',
    'Deferido': 'bg-blue-100 text-blue-800 border-blue-300',
  };
  const badgeClass = situacaoColor[situacao] || 'bg-gray-100 text-gray-700 border-gray-300';

  return (
    <div className="flex flex-col items-center gap-4">
      <SectionLabel>Formulário Inline de Decisão na Sidebar (Versão Proposta)</SectionLabel>
      <SidebarShell>
        <div className="px-3 py-2.5 border-b border-gray-100 bg-gray-50 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <button className="p-1 text-gray-400 hover:text-gray-600 rounded flex-shrink-0">
              <ArrowLeft size={13} />
            </button>
            <div className="flex items-center gap-1.5 min-w-0">
              <div className="p-1.5 bg-blue-100 rounded flex-shrink-0">
                <Scale size={12} className="text-blue-600" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-sm font-bold text-gray-900 truncate">fc2473d</span>
                  <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full border flex-shrink-0 ${badgeClass}`}>{situacao}</span>
                </div>
                <p className="text-xs text-gray-400 truncate">Sentença · p. 326</p>
              </div>
            </div>
          </div>
          <button className="p-1 text-gray-400 hover:text-gray-600 rounded flex-shrink-0">
            <X size={13} />
          </button>
        </div>

        <div className="p-3 space-y-2.5 flex-1 overflow-y-auto">
          <FakeDropdown label="Tipo de Decisão" value="Sentença" required small />
          <FakeDropdown label="Situação" value="Parcialmente Procedente" required small />
          <FakeInput label="ID da Decisão" value="fc2473d" required small />

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Página Vinculada</label>
            <div className="flex items-center gap-2">
              <input readOnly value="326" className="w-16 px-2 py-1.5 border border-gray-300 rounded-md text-xs text-center bg-white" />
              <span className="text-xs text-gray-400">de 830</span>
            </div>
          </div>

          <FakeRichText label="Observações" small />

          <div className="pt-2 border-t border-gray-100 flex items-center gap-3 text-xs text-gray-400">
            <div className="flex items-center gap-1"><Calendar size={10} /> 10/03/2026</div>
            <div className="flex items-center gap-1"><Clock size={10} /> 11/03/2026</div>
          </div>
        </div>

        {showDeleteConfirm && (
          <div className="mx-3 mb-2 p-2.5 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertTriangle size={13} className="text-red-500 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-xs font-medium text-red-800">Excluir "fc2473d"?</p>
                <p className="text-xs text-red-600 mt-0.5">Lançamentos vinculados serão afetados. Não pode ser desfeito.</p>
                <div className="flex gap-1.5 mt-2">
                  <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 py-1 text-xs font-medium text-red-700 bg-white border border-red-300 rounded">Cancelar</button>
                  <button className="flex-1 py-1 text-xs font-medium text-white bg-red-600 rounded">Excluir</button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="px-3 py-2.5 border-t border-gray-100 flex items-center justify-between gap-2">
          <button
            onClick={() => setShowDeleteConfirm(v => !v)}
            className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md border transition-colors ${showDeleteConfirm ? 'bg-red-50 border-red-200 text-red-700' : 'text-red-500 border-red-200 hover:bg-red-50'}`}
          >
            <Trash2 size={12} /> Excluir
          </button>
          <div className="flex gap-1.5">
            <button className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md">Cancelar</button>
            <button className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-md shadow-sm">
              <Save size={11} /> Salvar
            </button>
          </div>
        </div>
      </SidebarShell>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 max-w-sm text-sm">
        <p className="font-semibold text-blue-800 mb-2">Adaptações para a sidebar:</p>
        <ul className="text-blue-700 space-y-1 text-xs list-disc list-inside">
          <li>Botão "voltar" (←) no header substitui o X — retorna à lista</li>
          <li>Header compacto com ícone pequeno, ID, badge e subtítulo em linha</li>
          <li>Todos os campos em coluna única — sem grids de 2 colunas</li>
          <li>Fontes e paddings reduzidos (text-xs, py-1.5) para caber na largura estreita</li>
          <li>Confirmação de exclusão inline no próprio painel</li>
          <li>Timestamps compactos em linha única no rodapé do formulário</li>
        </ul>
      </div>
    </div>
  );
}

function SidebarVerbaAtual() {
  return (
    <div className="flex flex-col items-center gap-4">
      <SectionLabel>Formulário Inline de Verba na Sidebar (Versão Atual)</SectionLabel>
      <SidebarShell>
        <div className="px-3 py-3 border-b border-gray-200 flex items-center justify-between bg-gray-50">
          <div className="flex items-center gap-2">
            <BookOpen size={15} className="text-green-700" />
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Editar Lançamento</h3>
              <p className="text-xs text-gray-500">Justiça Gratuita</p>
            </div>
          </div>
          <button className="p-1 text-gray-400 hover:text-gray-600"><X size={14} /></button>
        </div>

        <div className="p-3 space-y-3 flex-1 overflow-y-auto">
          <FakeDropdown label="Decisão Vinculada" value="00f32b1 - Sentença" required small />
          <FakeDropdown label="Situação" value="Deferida" required small />
          <FakeRichText label="Fundamentação" value={`"Concedo ao (à) reclamante os benefícios..."`} small />
          <FakeRichText label="Comentários" small />
          <div className="pt-2 border-t border-gray-200 text-xs text-gray-400">
            Criado: 10/03/2026
          </div>
        </div>

        <div className="px-3 py-3 border-t border-gray-200 bg-gray-50 flex justify-end gap-2">
          <button className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md">Cancelar</button>
          <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-green-600 rounded-md">
            <Save size={12} /> Salvar
          </button>
        </div>
      </SidebarShell>

      <div className="bg-gray-50 border border-dashed border-gray-300 rounded-lg p-4 text-xs text-gray-500 max-w-sm text-center">
        Sem checklist de Calculista/Revisor, sem página vinculada editável, sem confirmação de exclusão inline, sem opção de renomear tipo.
      </div>
    </div>
  );
}

function SidebarVerbaProposto() {
  const [checkCalculista, setCheckCalculista] = useState(true);
  const [checkRevisor, setCheckRevisor] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isRenamingTipo, setIsRenamingTipo] = useState(false);
  const [newTipoName, setNewTipoName] = useState('Justiça Gratuita');

  return (
    <div className="flex flex-col items-center gap-4">
      <SectionLabel>Formulário Inline de Verba na Sidebar (Versão Proposta)</SectionLabel>
      <SidebarShell>
        <div className="px-3 py-2.5 border-b border-gray-100 bg-gray-50 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <button className="p-1 text-gray-400 hover:text-gray-600 rounded flex-shrink-0">
              <ArrowLeft size={13} />
            </button>
            <div className="flex items-center gap-1.5 min-w-0">
              <div className="p-1.5 bg-green-100 rounded flex-shrink-0">
                <BookOpen size={12} className="text-green-700" />
              </div>
              <div className="min-w-0">
                {isRenamingTipo ? (
                  <div className="flex items-center gap-1 mb-0.5">
                    <input
                      value={newTipoName}
                      onChange={e => setNewTipoName(e.target.value)}
                      className="text-xs font-bold text-gray-900 border-b border-blue-500 bg-transparent focus:outline-none"
                      style={{ width: `${newTipoName.length + 2}ch` }}
                    />
                    <button onClick={() => setIsRenamingTipo(false)} className="p-0.5 text-green-600"><Check size={11} /></button>
                    <button onClick={() => { setIsRenamingTipo(false); setNewTipoName('Justiça Gratuita'); }} className="p-0.5 text-gray-400"><X size={11} /></button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 mb-0.5">
                    <span className="text-sm font-bold text-gray-900 truncate">{newTipoName}</span>
                    <button onClick={() => setIsRenamingTipo(true)} className="p-0.5 text-gray-400 hover:text-blue-600 flex-shrink-0">
                      <Edit2 size={10} />
                    </button>
                  </div>
                )}
                <div className="flex items-center gap-1 flex-wrap">
                  <span className="text-xs font-medium px-1.5 py-0.5 rounded-full border bg-green-100 text-green-800 border-green-300">Deferida</span>
                  <span className="text-xs text-gray-400">· 00f32b1 · p.376</span>
                </div>
              </div>
            </div>
          </div>
          <button className="p-1 text-gray-400 hover:text-gray-600 rounded flex-shrink-0"><X size={13} /></button>
        </div>

        <div className="p-3 space-y-2.5 flex-1 overflow-y-auto">
          {isRenamingTipo && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-2.5 py-2 text-xs text-blue-700">
              Renomear atualizará <strong>todos os lançamentos</strong> com este tipo.
            </div>
          )}

          <FakeDropdown label="Decisão Vinculada" value="00f32b1 - Sentença" required small />
          <FakeDropdown label="Situação" value="Deferida" required small />

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Página Vinculada</label>
            <div className="flex items-center gap-2">
              <input readOnly value="376" className="w-14 px-2 py-1.5 border border-gray-300 rounded-md text-xs text-center bg-white" />
              <span className="text-xs text-gray-400">de 1090</span>
            </div>
          </div>

          <div className="border border-gray-200 rounded-lg p-2.5 bg-gray-50">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Checklist de Aprovação</p>
            <div className="space-y-1.5">
              <div
                className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-all ${checkCalculista ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-200'}`}
                onClick={() => setCheckCalculista(v => !v)}
              >
                <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 transition-colors ${checkCalculista ? 'bg-blue-600' : 'border-2 border-gray-300'}`}>
                  {checkCalculista && <Check size={9} className="text-white" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-medium ${checkCalculista ? 'text-blue-800' : 'text-gray-700'}`}>Calculista</p>
                  <p className="text-xs text-gray-400">{checkCalculista ? 'Verificado em 11/03 09:05' : 'Aguardando'}</p>
                </div>
              </div>

              <div
                className={`flex items-center gap-2 p-2 rounded-lg border transition-all ${checkCalculista ? 'cursor-pointer' : 'opacity-50 cursor-not-allowed'} ${checkRevisor ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'}`}
                onClick={() => checkCalculista && setCheckRevisor(v => !v)}
              >
                <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 transition-colors ${checkRevisor ? 'bg-green-600' : 'border-2 border-gray-300'}`}>
                  {checkRevisor && <Check size={9} className="text-white" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-medium ${checkRevisor ? 'text-green-800' : 'text-gray-700'}`}>Revisor</p>
                  <p className="text-xs text-gray-400">{checkRevisor ? 'Verificado em 11/03 10:40' : checkCalculista ? 'Aguardando revisão' : 'Requer calculista'}</p>
                </div>
              </div>
            </div>
          </div>

          <FakeRichText label="Fundamentação" value={`"Concedo ao (à) reclamante os benefícios..."`} small />
          <FakeRichText label="Comentários" small />

          <div className="pt-2 border-t border-gray-100 flex items-center gap-3 text-xs text-gray-400">
            <div className="flex items-center gap-1"><Calendar size={10} /> 10/03/2026</div>
            <div className="flex items-center gap-1"><Clock size={10} /> 11/03/2026</div>
          </div>
        </div>

        {showDeleteConfirm && (
          <div className="mx-3 mb-2 p-2.5 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertTriangle size={13} className="text-red-500 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-xs font-medium text-red-800">Excluir este lançamento?</p>
                <p className="text-xs text-red-600 mt-0.5">Justiça Gratuita · 00f32b1. Não pode ser desfeito.</p>
                <div className="flex gap-1.5 mt-2">
                  <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 py-1 text-xs font-medium text-red-700 bg-white border border-red-300 rounded">Cancelar</button>
                  <button className="flex-1 py-1 text-xs font-medium text-white bg-red-600 rounded">Excluir</button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="px-3 py-2.5 border-t border-gray-100 flex items-center justify-between gap-2">
          <button
            onClick={() => setShowDeleteConfirm(v => !v)}
            className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md border transition-colors ${showDeleteConfirm ? 'bg-red-50 border-red-200 text-red-700' : 'text-red-500 border-red-200 hover:bg-red-50'}`}
          >
            <Trash2 size={12} /> Excluir
          </button>
          <div className="flex gap-1.5">
            <button className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md">Cancelar</button>
            <button className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-green-600 rounded-md shadow-sm">
              <Save size={11} /> Salvar
            </button>
          </div>
        </div>
      </SidebarShell>

      <div className="bg-green-50 border border-green-200 rounded-lg p-4 max-w-sm text-sm">
        <p className="font-semibold text-green-800 mb-2">Adaptações para a sidebar:</p>
        <ul className="text-green-700 space-y-1 text-xs list-disc list-inside">
          <li>Checklist em coluna única (vertical) — sem grid de 2 colunas</li>
          <li>Renomear tipo inline no header — clique no lápis ao lado do nome</li>
          <li>Página vinculada como campo separado logo abaixo de Situação</li>
          <li>Header compacto com botão voltar, ícone pequeno e metadados em uma linha</li>
          <li>Todos os campos em coluna única, paddings e fontes reduzidos</li>
          <li>Confirmação de exclusão inline dentro do próprio painel</li>
        </ul>
      </div>
    </div>
  );
}

function SidebarDocumentoAtual() {
  return (
    <div className="flex flex-col items-center gap-4">
      <SectionLabel>Formulário Inline de Documento na Sidebar (Versão Atual)</SectionLabel>
      <SidebarShell>
        <div className="px-3 py-3 border-b border-gray-200 flex items-center justify-between bg-gray-50">
          <div className="flex items-center gap-2">
            <FileText size={15} className="text-orange-600" />
            <h3 className="text-sm font-semibold text-gray-900">Editar Documento</h3>
          </div>
          <button className="p-1 text-gray-400 hover:text-gray-600"><X size={14} /></button>
        </div>

        <div className="p-3 space-y-3 flex-1 overflow-y-auto">
          <FakeDropdown label="Tipo de Documento" value="Petição Inicial" required small />
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Página Vinculada</label>
            <input readOnly value="12" className="w-24 px-2.5 py-1.5 border border-gray-300 rounded-md text-xs bg-white" />
          </div>
          <FakeRichText label="Comentários" value="Petição protocolada em 05/01/2026..." small />
        </div>

        <div className="px-3 py-3 border-t border-gray-200 bg-gray-50 flex justify-end gap-2">
          <button className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md">Cancelar</button>
          <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-md">
            <Save size={12} /> Atualizar
          </button>
        </div>
      </SidebarShell>

      <div className="bg-gray-50 border border-dashed border-gray-300 rounded-lg p-4 text-xs text-gray-500 max-w-sm text-center">
        Sem badge de tipo, sem timestamps, sem total de páginas contextual, sem confirmação de exclusão inline.
      </div>
    </div>
  );
}

function SidebarDocumentoProposto() {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const tipo = 'Petição Inicial';

  const tipoDocumentoColors: Record<string, string> = {
    'Petição Inicial': 'bg-blue-100 text-blue-800 border-blue-300',
    'Contestação': 'bg-red-100 text-red-800 border-red-300',
    'Laudo Pericial': 'bg-amber-100 text-amber-800 border-amber-300',
    'Sentença': 'bg-sky-100 text-sky-800 border-sky-300',
  };
  const badgeClass = tipoDocumentoColors[tipo] || 'bg-gray-100 text-gray-700 border-gray-300';

  return (
    <div className="flex flex-col items-center gap-4">
      <SectionLabel>Formulário Inline de Documento na Sidebar (Versão Proposta)</SectionLabel>
      <SidebarShell>
        <div className="px-3 py-2.5 border-b border-gray-100 bg-gray-50 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <button className="p-1 text-gray-400 hover:text-gray-600 rounded flex-shrink-0">
              <ArrowLeft size={13} />
            </button>
            <div className="flex items-center gap-1.5 min-w-0">
              <div className="p-1.5 bg-orange-100 rounded flex-shrink-0">
                <FileText size={12} className="text-orange-600" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                  <span className="text-sm font-bold text-gray-900 truncate">Editar Documento</span>
                  <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full border flex-shrink-0 ${badgeClass}`}>{tipo}</span>
                </div>
                <p className="text-xs text-gray-400">p. 12 · Criado 05/01/2026</p>
              </div>
            </div>
          </div>
          <button className="p-1 text-gray-400 hover:text-gray-600 rounded flex-shrink-0"><X size={13} /></button>
        </div>

        <div className="p-3 space-y-2.5 flex-1 overflow-y-auto">
          <FakeDropdown label="Tipo de Documento" value="Petição Inicial" required small />

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Página Vinculada</label>
            <div className="flex items-center gap-2">
              <input readOnly value="12" className="w-14 px-2 py-1.5 border border-gray-300 rounded-md text-xs text-center bg-white" />
              <span className="text-xs text-gray-400">de 830</span>
            </div>
          </div>

          <FakeRichText label="Comentários" value="Petição protocolada em 05/01/2026 com pedido de tutela de urgência..." small />

          <div className="pt-2 border-t border-gray-100 flex items-center gap-3 text-xs text-gray-400">
            <div className="flex items-center gap-1"><Calendar size={10} /> 05/01/2026</div>
            <div className="flex items-center gap-1"><Clock size={10} /> 10/03/2026</div>
          </div>
        </div>

        {showDeleteConfirm && (
          <div className="mx-3 mb-2 p-2.5 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertTriangle size={13} className="text-red-500 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-xs font-medium text-red-800">Excluir "Petição Inicial"?</p>
                <p className="text-xs text-red-600 mt-0.5">Documento da p. 12. Não pode ser desfeito.</p>
                <div className="flex gap-1.5 mt-2">
                  <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 py-1 text-xs font-medium text-red-700 bg-white border border-red-300 rounded">Cancelar</button>
                  <button className="flex-1 py-1 text-xs font-medium text-white bg-red-600 rounded">Excluir</button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="px-3 py-2.5 border-t border-gray-100 flex items-center justify-between gap-2">
          <button
            onClick={() => setShowDeleteConfirm(v => !v)}
            className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md border transition-colors ${showDeleteConfirm ? 'bg-red-50 border-red-200 text-red-700' : 'text-red-500 border-red-200 hover:bg-red-50'}`}
          >
            <Trash2 size={12} /> Excluir
          </button>
          <div className="flex gap-1.5">
            <button className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md">Cancelar</button>
            <button className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-orange-600 rounded-md shadow-sm">
              <Save size={11} /> Salvar
            </button>
          </div>
        </div>
      </SidebarShell>

      <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 max-w-sm text-sm">
        <p className="font-semibold text-orange-800 mb-2">Adaptações para a sidebar:</p>
        <ul className="text-orange-700 space-y-1 text-xs list-disc list-inside">
          <li>Header com botão voltar, ícone, badge do tipo e página/data em linha</li>
          <li>Página vinculada com total contextual ("de 830")</li>
          <li>Timestamps compactos de criação e atualização no rodapé</li>
          <li>Confirmação de exclusão inline no próprio painel</li>
          <li>Botão salvar laranja consistente com a identidade visual do Documento</li>
          <li>Todos os campos em coluna única, paddings reduzidos para a largura estreita</li>
        </ul>
      </div>
    </div>
  );
}

function AuditRow({ id, date }: { id: string; date: string }) {
  return (
    <div className="pt-4 border-t border-gray-200 grid grid-cols-2 gap-4 text-xs text-gray-500">
      <div><span className="font-medium text-gray-600">ID:</span> <span className="font-mono">{id}</span></div>
      <div><span className="font-medium text-gray-600">Criado em:</span> {date}</div>
    </div>
  );
}

function DecisaoModalAtual() {
  return (
    <div className="flex flex-col items-center">
      <SectionLabel>Modal de Visualização — Decisão (Versão Atual)</SectionLabel>
      <div className="bg-white rounded-lg border border-gray-200 shadow-lg w-full max-w-2xl">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Editar Decisão</h2>
            <p className="text-sm text-gray-600 mt-1">Modifique as informações da decisão "fc2473d"</p>
          </div>
          <button className="p-2 text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <FakeDropdown label="Tipo de Decisão" value="Sentença" required />
            <FakeInput label="ID da Decisão" value="fc2473d" required />
            <FakeDropdown label="Situação" value="Parcialmente Procedente" required />
          </div>
          <FakeRichText label="Observações" />
          <AuditRow id="fc2473d-uuid" date="10/03/2026 14:22" />
        </div>
        <div className="p-6 border-t border-gray-200 bg-gray-50 rounded-b-lg flex justify-end gap-3">
          <button className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50">Cancelar</button>
          <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700">
            <Save size={16} /> Salvar Alterações
          </button>
        </div>
      </div>
    </div>
  );
}

function DecisaoModalProposto() {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [situacao] = useState('Parcialmente Procedente');

  const situacaoColor: Record<string, string> = {
    'Procedente': 'bg-green-100 text-green-800 border-green-300',
    'Improcedente': 'bg-red-100 text-red-800 border-red-300',
    'Parcialmente Procedente': 'bg-yellow-100 text-yellow-800 border-yellow-300',
    'Deferido': 'bg-blue-100 text-blue-800 border-blue-300',
  };
  const badgeClass = situacaoColor[situacao] || 'bg-gray-100 text-gray-700 border-gray-300';

  return (
    <div className="flex flex-col items-center gap-4">
      <SectionLabel>Modal de Visualização — Decisão (Versão Proposta)</SectionLabel>

      <div className="bg-white rounded-xl border border-gray-200 shadow-lg w-full max-w-2xl overflow-hidden">
        <div className="px-6 pt-5 pb-4 border-b border-gray-100 bg-gray-50">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 p-2 bg-blue-100 rounded-lg">
                <Scale size={18} className="text-blue-600" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base font-bold text-gray-900">fc2473d</h2>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${badgeClass}`}>{situacao}</span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">Sentença · Vinculada à p. 326</p>
              </div>
            </div>
            <button className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors">
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FakeDropdown label="Tipo de Decisão" value="Sentença" required />
            <FakeDropdown label="Situação" value="Parcialmente Procedente" required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FakeInput label="ID da Decisão" value="fc2473d" required />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Página Vinculada</label>
              <div className="flex items-center gap-2">
                <input readOnly value="326" className="w-20 px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 bg-white text-center" />
                <span className="text-sm text-gray-400">de 830</span>
              </div>
            </div>
          </div>
          <FakeRichText label="Observações" />
          <div className="pt-4 border-t border-gray-100 grid grid-cols-2 gap-4 text-xs text-gray-400">
            <div className="flex items-center gap-1.5"><Calendar size={11} /> Criado: 10/03/2026 14:22</div>
            <div className="flex items-center gap-1.5"><Clock size={11} /> Atualizado: 11/03/2026 09:05</div>
          </div>
        </div>

        {showDeleteConfirm ? (
          <div className="mx-6 mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertTriangle size={16} className="text-red-500 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-red-800">Excluir decisão "fc2473d"?</p>
                <p className="text-xs text-red-600 mt-0.5">Esta ação não pode ser desfeita.</p>
                <div className="flex gap-2 mt-3">
                  <button onClick={() => setShowDeleteConfirm(false)} className="px-3 py-1.5 text-xs font-medium text-red-700 bg-white border border-red-300 rounded-md">Cancelar</button>
                  <button className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 rounded-md">Sim, excluir</button>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <div className="px-6 pb-6 flex items-center justify-between gap-3">
          <button onClick={() => setShowDeleteConfirm(v => !v)} className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-md border transition-colors ${showDeleteConfirm ? 'bg-red-50 border-red-200 text-red-700' : 'text-red-500 border-red-200 hover:bg-red-50'}`}>
            <Trash2 size={14} /> Excluir
          </button>
          <div className="flex gap-2">
            <button className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">Cancelar</button>
            <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-sm">
              <Save size={15} /> Salvar Alterações
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function VerbaModalAtual() {
  return (
    <div className="flex flex-col items-center">
      <SectionLabel>Modal de Visualização — Verba (Versão Atual)</SectionLabel>
      <div className="bg-white rounded-lg border border-gray-200 shadow-lg w-full max-w-4xl">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Editar Lançamento</h2>
            <p className="text-sm text-gray-600 mt-1">
              Verba: <span className="font-medium">Justiça Gratuita</span> · Lançamento: <span className="font-medium">00f32b1 - Sentença</span>
            </p>
          </div>
          <button className="p-2 text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FakeDropdown label="Decisão Vinculada" value="00f32b1 - Sentença" required />
            <FakeDropdown label="Situação" value="Deferida" required />
          </div>
          <FakeRichText label="Fundamentação" value={`[...] "Concedo ao (à) reclamante os benefícios da justiça gratuita..."`} />
          <FakeRichText label="Comentários" />
          <AuditRow id="lancamento-uuid" date="10/03/2026 14:30" />
        </div>
        <div className="p-6 border-t border-gray-200 bg-gray-50 rounded-b-lg flex justify-end gap-3">
          <button className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md">Cancelar</button>
          <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md">
            <Save size={16} /> Salvar Alterações
          </button>
        </div>
      </div>
    </div>
  );
}

function VerbaModalProposto() {
  const [checkCalculista, setCheckCalculista] = useState(true);
  const [checkRevisor, setCheckRevisor] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isRenamingTipo, setIsRenamingTipo] = useState(false);
  const [newTipoName, setNewTipoName] = useState('Justiça Gratuita');

  return (
    <div className="flex flex-col items-center gap-4">
      <SectionLabel>Modal de Visualização — Verba (Versão Proposta)</SectionLabel>

      <div className="bg-white rounded-xl border border-gray-200 shadow-lg w-full max-w-4xl overflow-hidden">
        <div className="px-6 pt-5 pb-4 border-b border-gray-100 bg-gray-50">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 p-2 bg-green-100 rounded-lg">
                <BookOpen size={18} className="text-green-700" />
              </div>
              <div>
                {isRenamingTipo ? (
                  <div className="flex items-center gap-2 mb-1">
                    <input value={newTipoName} onChange={e => setNewTipoName(e.target.value)} className="text-sm font-bold text-gray-900 border-b-2 border-blue-500 bg-transparent focus:outline-none pb-0.5" style={{ width: `${newTipoName.length + 2}ch` }} />
                    <button onClick={() => setIsRenamingTipo(false)} className="p-1 text-green-600 hover:bg-green-50 rounded"><Check size={14} /></button>
                    <button onClick={() => { setIsRenamingTipo(false); setNewTipoName('Justiça Gratuita'); }} className="p-1 text-gray-400 hover:bg-gray-100 rounded"><X size={14} /></button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 mb-0.5">
                    <h2 className="text-base font-bold text-gray-900">{newTipoName}</h2>
                    <button onClick={() => setIsRenamingTipo(true)} className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"><Edit2 size={12} /></button>
                  </div>
                )}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full border bg-green-100 text-green-800 border-green-300">Deferida</span>
                  <span className="text-xs text-gray-400">·</span>
                  <span className="text-xs text-gray-500">00f32b1 — Sentença</span>
                  <span className="text-xs text-gray-400">·</span>
                  <span className="text-xs text-gray-500">p. 376</span>
                </div>
              </div>
            </div>
            <button className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"><X size={16} /></button>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FakeDropdown label="Decisão Vinculada" value="00f32b1 - Sentença" required />
            <div className="grid grid-cols-2 gap-3">
              <FakeDropdown label="Situação" value="Deferida" required />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Página Vinculada</label>
                <div className="flex items-center gap-2">
                  <input readOnly value="376" className="w-16 px-2 py-2 border border-gray-300 rounded-md text-sm text-center bg-white" />
                  <span className="text-xs text-gray-400">de 1090</span>
                </div>
              </div>
            </div>
          </div>

          <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Checklist de Aprovação</p>
            <div className="grid grid-cols-2 gap-4">
              <div className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${checkCalculista ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-200'}`} onClick={() => setCheckCalculista(v => !v)}>
                <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 ${checkCalculista ? 'bg-blue-600' : 'border-2 border-gray-300'}`}>
                  {checkCalculista && <Check size={12} className="text-white" />}
                </div>
                <div>
                  <p className={`text-sm font-medium ${checkCalculista ? 'text-blue-800' : 'text-gray-700'}`}>Calculista</p>
                  <p className="text-xs text-gray-400">{checkCalculista ? 'Verificado em 11/03 09:05' : 'Aguardando'}</p>
                </div>
              </div>
              <div className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${checkCalculista ? 'cursor-pointer' : 'opacity-50 cursor-not-allowed'} ${checkRevisor ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'}`} onClick={() => checkCalculista && setCheckRevisor(v => !v)}>
                <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 ${checkRevisor ? 'bg-green-600' : 'border-2 border-gray-300'}`}>
                  {checkRevisor && <Check size={12} className="text-white" />}
                </div>
                <div>
                  <p className={`text-sm font-medium ${checkRevisor ? 'text-green-800' : 'text-gray-700'}`}>Revisor</p>
                  <p className="text-xs text-gray-400">{checkRevisor ? 'Verificado' : checkCalculista ? 'Aguardando' : 'Requer calculista'}</p>
                </div>
              </div>
            </div>
          </div>

          <FakeRichText label="Fundamentação" value={`[...] "Concedo ao (à) reclamante os benefícios da justiça gratuita..."`} />
          <FakeRichText label="Comentários" />

          <div className="pt-2 grid grid-cols-2 gap-4 text-xs text-gray-400 border-t border-gray-100">
            <div className="flex items-center gap-1.5"><Calendar size={11} /> Criado: 10/03/2026 14:30</div>
            <div className="flex items-center gap-1.5"><Clock size={11} /> Atualizado: 11/03/2026 09:05</div>
          </div>
        </div>

        {showDeleteConfirm && (
          <div className="mx-6 mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertTriangle size={16} className="text-red-500 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-red-800">Excluir este lançamento?</p>
                <p className="text-xs text-red-600 mt-0.5">Não pode ser desfeito.</p>
                <div className="flex gap-2 mt-3">
                  <button onClick={() => setShowDeleteConfirm(false)} className="px-3 py-1.5 text-xs font-medium text-red-700 bg-white border border-red-300 rounded-md">Cancelar</button>
                  <button className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 rounded-md">Sim, excluir</button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="px-6 pb-6 flex items-center justify-between gap-3">
          <button onClick={() => setShowDeleteConfirm(v => !v)} className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-md border transition-colors ${showDeleteConfirm ? 'bg-red-50 border-red-200 text-red-700' : 'text-red-500 border-red-200 hover:bg-red-50'}`}>
            <Trash2 size={14} /> Excluir
          </button>
          <div className="flex gap-2">
            <button className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg">Cancelar</button>
            <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg shadow-sm">
              <Save size={15} /> Salvar Alterações
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CardsAtuais() {
  return (
    <div className="grid grid-cols-2 gap-6">
      <div>
        <SectionLabel>Card de Decisão (Atual)</SectionLabel>
        <div className="border border-gray-200 bg-white rounded-lg p-3 group">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <span className="flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-blue-700 bg-blue-100 rounded-md">
                  <FileText size={11} /> p.326
                </span>
                <span className="text-xs text-gray-500">Sentença</span>
              </div>
              <h4 className="font-semibold text-gray-900 text-sm">fc2473d</h4>
              <div className="mt-1.5">
                <span className="text-xs font-medium px-1.5 py-0.5 bg-yellow-100 text-yellow-800 border border-yellow-300 rounded">Parcialmente Procedente</span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md"><Eye size={14} /></button>
              <button className="p-1.5 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded-md"><Edit2 size={14} /></button>
              <button className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-md"><Trash2 size={14} /></button>
            </div>
          </div>
        </div>
      </div>

      <div>
        <SectionLabel>Card de Verba (Atual)</SectionLabel>
        <div className="border border-gray-200 bg-white rounded-lg p-3 group">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-green-700 bg-green-100 rounded-md">
                  <Link2 size={11} /> p.376
                </span>
                <span className="text-xs text-gray-500 font-medium truncate">Justiça Gratuita</span>
              </div>
              <h4 className="font-semibold text-gray-900 text-sm truncate">00f32b1 - Sentença</h4>
              <div className="mt-1.5 flex items-center gap-2">
                <span className="text-xs font-medium px-1.5 py-0.5 bg-green-100 text-green-800 border border-green-300 rounded">Deferida</span>
                <button className="flex items-center gap-1 px-2 py-0.5 text-xs border rounded bg-blue-100 text-blue-700 border-blue-300">
                  <Clock size={10} /> Calculado
                </button>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md"><Eye size={14} /></button>
              <button className="p-1.5 text-green-500 hover:text-green-700 hover:bg-green-50 rounded-md"><Edit2 size={14} /></button>
              <button className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-md"><Trash2 size={14} /></button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CardsPropostos() {
  const [decisionDeleteState, setDecisionDeleteState] = useState<'idle' | 'confirming'>('idle');
  const [verbaDeleteState, setVerbaDeleteState] = useState<'idle' | 'confirming'>('idle');
  const [status, setStatus] = useState<'pendente' | 'calculado' | 'concluido'>('calculado');

  const statusConfig = {
    pendente: { icon: Circle, label: 'Pendente', classes: 'bg-gray-100 text-gray-700 border-gray-300', iconClass: 'text-gray-500' },
    calculado: { icon: Clock, label: 'Calculado', classes: 'bg-blue-100 text-blue-700 border-blue-300', iconClass: 'text-blue-600' },
    concluido: { icon: CheckCircle2, label: 'Concluido', classes: 'bg-green-100 text-green-700 border-green-300', iconClass: 'text-green-600' },
  };
  const cfg = statusConfig[status];
  const StatusIcon = cfg.icon;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-6">
        <div>
          <SectionLabel>Card de Decisão (Proposto)</SectionLabel>
          <div className="border border-gray-200 bg-white rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow">
            <div className="p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span className="flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-blue-700 bg-blue-100 rounded-md">
                      <FileText size={11} /> p.326
                    </span>
                    <span className="text-xs text-gray-400">Sentença</span>
                  </div>
                  <h4 className="font-semibold text-gray-900 text-sm">fc2473d</h4>
                  <div className="mt-1.5">
                    <span className="text-xs font-medium px-1.5 py-0.5 bg-yellow-100 text-yellow-800 border border-yellow-300 rounded-full">Parcialmente Procedente</span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors"><Eye size={14} /></button>
                  <button className="p-1.5 text-blue-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"><Edit2 size={14} /></button>
                  <button onClick={() => setDecisionDeleteState(s => s === 'idle' ? 'confirming' : 'idle')} className={`p-1.5 rounded-md transition-colors ${decisionDeleteState === 'confirming' ? 'text-red-600 bg-red-100' : 'text-red-400 hover:text-red-600 hover:bg-red-50'}`}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
            {decisionDeleteState === 'confirming' && (
              <div className="mx-3 mb-3 p-2.5 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-xs font-medium text-red-800 mb-2">Excluir "fc2473d"?</p>
                <div className="flex gap-2">
                  <button onClick={() => setDecisionDeleteState('idle')} className="flex-1 py-1 text-xs font-medium text-gray-600 bg-white border border-gray-300 rounded">Cancelar</button>
                  <button className="flex-1 py-1 text-xs font-medium text-white bg-red-600 rounded">Excluir</button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div>
          <SectionLabel>Card de Verba (Proposto)</SectionLabel>
          <div className="border border-gray-200 bg-white rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow">
            <div className="p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-green-700 bg-green-100 rounded-md">
                      <Link2 size={11} /> p.376
                    </span>
                    <span className="text-xs text-gray-400 font-medium truncate">Justiça Gratuita</span>
                  </div>
                  <h4 className="font-semibold text-gray-900 text-sm truncate">00f32b1 - Sentença</h4>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-xs font-medium px-1.5 py-0.5 bg-green-100 text-green-800 border border-green-300 rounded-full">Deferida</span>
                    <button onClick={() => setStatus(s => s === 'pendente' ? 'calculado' : s === 'calculado' ? 'concluido' : 'pendente')} className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium border rounded-full transition-all cursor-pointer ${cfg.classes}`}>
                      <StatusIcon size={11} className={cfg.iconClass} />
                      {cfg.label}
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors"><Eye size={14} /></button>
                  <button className="p-1.5 text-green-400 hover:text-green-600 hover:bg-green-50 rounded-md transition-colors"><Edit2 size={14} /></button>
                  <button onClick={() => setVerbaDeleteState(s => s === 'idle' ? 'confirming' : 'idle')} className={`p-1.5 rounded-md transition-colors ${verbaDeleteState === 'confirming' ? 'text-red-600 bg-red-100' : 'text-red-400 hover:text-red-600 hover:bg-red-50'}`}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
            {verbaDeleteState === 'confirming' && (
              <div className="mx-3 mb-3 p-2.5 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-xs font-medium text-red-800 mb-0.5">Excluir este lançamento?</p>
                <p className="text-xs text-red-500 mb-2">Justiça Gratuita · 00f32b1</p>
                <div className="flex gap-2">
                  <button onClick={() => setVerbaDeleteState('idle')} className="flex-1 py-1 text-xs font-medium text-gray-600 bg-white border border-gray-300 rounded">Cancelar</button>
                  <button className="flex-1 py-1 text-xs font-medium text-white bg-red-600 rounded">Excluir</button>
                </div>
              </div>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-2">Dica: clique no pill de status para ciclar Pendente → Calculado → Concluido</p>
        </div>
      </div>
    </div>
  );
}

const tipoDocumentoColors: Record<string, string> = {
  'Petição Inicial': 'bg-blue-100 text-blue-800 border-blue-300',
  'Contestação': 'bg-red-100 text-red-800 border-red-300',
  'Réplica': 'bg-teal-100 text-teal-800 border-teal-300',
  'Laudo Pericial': 'bg-amber-100 text-amber-800 border-amber-300',
  'Recurso': 'bg-yellow-100 text-yellow-800 border-yellow-300',
  'Contrato': 'bg-orange-100 text-orange-800 border-orange-300',
  'Sentença': 'bg-sky-100 text-sky-800 border-sky-300',
  'Acordo': 'bg-green-100 text-green-800 border-green-300',
};

function getTipoColor(tipo: string) {
  return tipoDocumentoColors[tipo] || 'bg-gray-100 text-gray-700 border-gray-300';
}

function DocumentoModalAtual() {
  return (
    <div className="flex flex-col items-center">
      <SectionLabel>Formulário de Documento — Visualização Atual (Inline)</SectionLabel>
      <div className="w-full max-w-2xl space-y-4">
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <FileText size={18} className="text-orange-600" />
              <h3 className="text-base font-semibold text-gray-900">Editar Documento</h3>
            </div>
            <button className="p-1.5 text-gray-400 hover:text-gray-600 rounded"><X size={16} /></button>
          </div>
          <div className="space-y-4">
            <FakeDropdown label="Tipo de Documento" value="Petição Inicial" required />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Página Vinculada</label>
              <input readOnly value="12" className="w-32 px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 bg-white" />
            </div>
            <FakeRichText label="Comentários" value="Petição protocolada em 05/01/2026..." />
          </div>
          <div className="mt-5 flex justify-end gap-3">
            <button className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md">Cancelar</button>
            <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md">
              <Save size={15} /> Atualizar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DocumentoModalProposto() {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const tipo = 'Petição Inicial';
  const badgeClass = getTipoColor(tipo);

  return (
    <div className="flex flex-col items-center gap-4">
      <SectionLabel>Formulário de Documento — Versão Proposta (Modal de Detalhes)</SectionLabel>

      <div className="bg-white rounded-xl border border-gray-200 shadow-lg w-full max-w-2xl overflow-hidden">
        <div className="px-6 pt-5 pb-4 border-b border-gray-100 bg-gray-50">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 p-2 bg-orange-100 rounded-lg">
                <FileText size={18} className="text-orange-600" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base font-bold text-gray-900">Editar Documento</h2>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${badgeClass}`}>{tipo}</span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">Vinculado à p. 12 · Criado em 05/01/2026</p>
              </div>
            </div>
            <button className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"><X size={16} /></button>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <FakeDropdown label="Tipo de Documento" value="Petição Inicial" required />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Página Vinculada</label>
            <div className="flex items-center gap-2">
              <input readOnly value="12" className="w-20 px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 bg-white text-center" />
              <span className="text-sm text-gray-400">de 830</span>
            </div>
          </div>
          <FakeRichText label="Comentários" value="Petição protocolada em 05/01/2026 com pedido de tutela de urgência..." />
          <div className="pt-4 border-t border-gray-100 grid grid-cols-2 gap-4 text-xs text-gray-400">
            <div className="flex items-center gap-1.5"><Calendar size={11} /> Criado: 05/01/2026 10:14</div>
            <div className="flex items-center gap-1.5"><Clock size={11} /> Atualizado: 10/03/2026 16:42</div>
          </div>
        </div>

        {showDeleteConfirm && (
          <div className="mx-6 mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertTriangle size={16} className="text-red-500 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-red-800">Excluir "Petição Inicial"?</p>
                <p className="text-xs text-red-600 mt-0.5">Esta ação não pode ser desfeita.</p>
                <div className="flex gap-2 mt-3">
                  <button onClick={() => setShowDeleteConfirm(false)} className="px-3 py-1.5 text-xs font-medium text-red-700 bg-white border border-red-300 rounded-md">Cancelar</button>
                  <button className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 rounded-md">Sim, excluir</button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="px-6 pb-6 flex items-center justify-between gap-3">
          <button onClick={() => setShowDeleteConfirm(v => !v)} className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-md border transition-colors ${showDeleteConfirm ? 'bg-red-50 border-red-200 text-red-700' : 'text-red-500 border-red-200 hover:bg-red-50'}`}>
            <Trash2 size={14} /> Excluir
          </button>
          <div className="flex gap-2">
            <button className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg">Cancelar</button>
            <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-orange-600 rounded-lg shadow-sm">
              <Save size={15} /> Salvar Alterações
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DocumentoCardsAtuais() {
  return (
    <div className="flex flex-col items-center gap-4">
      <SectionLabel>Cards de Documento (Versão Atual)</SectionLabel>
      <div className="w-full max-w-2xl space-y-2">
        {[
          { tipo: 'Petição Inicial', pagina: 12, comentario: 'Petição protocolada em 05/01/2026 com pedido de tutela de urgência...', data: '05/01/2026' },
          { tipo: 'Contestação', pagina: 87, comentario: null, data: '20/01/2026' },
          { tipo: 'Laudo Pericial', pagina: 210, comentario: 'Perito nomeado: Dr. José Santos. Prazo: 30 dias.', data: '15/02/2026' },
        ].map((doc, i) => (
          <div key={i} className="border border-gray-200 bg-white rounded-lg p-3 hover:border-orange-300 hover:bg-orange-50 transition-colors group">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2 flex-1 min-w-0">
                <FileText size={16} className="text-orange-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm text-gray-900">{doc.tipo}</span>
                    <span className="px-1.5 py-0.5 text-xs font-medium bg-orange-100 text-orange-700 rounded">p.{doc.pagina}</span>
                  </div>
                  {doc.comentario && <p className="text-xs text-gray-500 italic mt-1 line-clamp-2">{doc.comentario}</p>}
                  <p className="text-xs text-gray-400 mt-1">Criado: {doc.data}</p>
                </div>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button className="p-1.5 text-orange-500 hover:text-orange-700 hover:bg-orange-100 rounded-md"><Edit2 size={13} /></button>
                <button className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-md"><Trash2 size={13} /></button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DocumentoCardsPropostos() {
  const [deleteState, setDeleteState] = useState<Record<number, 'idle' | 'confirming'>>({ 0: 'idle', 1: 'idle', 2: 'idle' });

  const docs = [
    { tipo: 'Petição Inicial', pagina: 12, comentario: 'Petição protocolada em 05/01/2026 com pedido de tutela de urgência.', data: '05/01/2026', atualizado: null },
    { tipo: 'Contestação', pagina: 87, comentario: null, data: '20/01/2026', atualizado: '22/01/2026' },
    { tipo: 'Laudo Pericial', pagina: 210, comentario: 'Perito nomeado: Dr. José Santos. Prazo: 30 dias.', data: '15/02/2026', atualizado: null },
  ];

  return (
    <div className="flex flex-col items-center gap-4">
      <SectionLabel>Cards de Documento (Versão Proposta)</SectionLabel>
      <div className="w-full max-w-2xl space-y-2">
        {docs.map((doc, i) => {
          const badgeClass = getTipoColor(doc.tipo);
          const isConfirming = deleteState[i] === 'confirming';
          return (
            <div key={i} className={`bg-white rounded-lg border overflow-hidden shadow-sm hover:shadow-md transition-all ${isConfirming ? 'border-red-200' : 'border-gray-200'}`}>
              <div className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2.5 flex-1 min-w-0">
                    <div className="mt-0.5 p-1.5 bg-orange-50 rounded-md flex-shrink-0">
                      <FileText size={13} className="text-orange-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${badgeClass}`}>{doc.tipo}</span>
                        <span className="px-2 py-0.5 text-xs font-medium bg-orange-100 text-orange-700 rounded-full">p.{doc.pagina}</span>
                      </div>
                      {doc.comentario && <p className="text-xs text-gray-500 italic line-clamp-2">{doc.comentario}</p>}
                      <div className="flex items-center gap-3 mt-1.5">
                        <span className="flex items-center gap-1 text-xs text-gray-400"><Calendar size={10} /> {doc.data}</span>
                        {doc.atualizado && <span className="flex items-center gap-1 text-xs text-gray-400"><Clock size={10} /> {doc.atualizado}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button className="p-1.5 text-orange-400 hover:text-orange-600 hover:bg-orange-50 rounded-md transition-colors"><Edit2 size={13} /></button>
                    <button onClick={() => setDeleteState(s => ({ ...s, [i]: s[i] === 'idle' ? 'confirming' : 'idle' }))} className={`p-1.5 rounded-md transition-colors ${isConfirming ? 'text-red-600 bg-red-100' : 'text-red-400 hover:text-red-600 hover:bg-red-50'}`}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
              {isConfirming && (
                <div className="mx-3 mb-3 p-2.5 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-xs font-medium text-red-800 mb-0.5">Excluir "{doc.tipo}"?</p>
                  <p className="text-xs text-red-500 mb-2">p.{doc.pagina} · Não pode ser desfeito.</p>
                  <div className="flex gap-2">
                    <button onClick={() => setDeleteState(s => ({ ...s, [i]: 'idle' }))} className="flex-1 py-1 text-xs font-medium text-gray-600 bg-white border border-gray-300 rounded">Cancelar</button>
                    <button className="flex-1 py-1 text-xs font-medium text-white bg-red-600 rounded">Excluir</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
