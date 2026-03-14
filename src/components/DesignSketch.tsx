import React, { useState } from 'react';
import { Save, X, Trash2, CreditCard as Edit2, Eye, FileText, Link2, Circle, Clock, CheckCircle2, Calendar, Loader2, ChevronDown, AlertTriangle, BookOpen, Scale, RotateCcw, Check } from 'lucide-react';

type SketchTab = 'decisao-modal' | 'verba-modal' | 'cards';
type ViewMode = 'atual' | 'proposto';

export default function DesignSketch() {
  const [activeTab, setActiveTab] = useState<SketchTab>('decisao-modal');
  const [viewMode, setViewMode] = useState<ViewMode>('proposto');

  const tabs: { id: SketchTab; label: string }[] = [
    { id: 'decisao-modal', label: 'Modal — Decisao' },
    { id: 'verba-modal', label: 'Modal — Verba' },
    { id: 'cards', label: 'Cards da Sidebar' },
  ];

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
        <div className="max-w-6xl mx-auto px-6 flex gap-0">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === t.id ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {activeTab === 'decisao-modal' && (
          viewMode === 'atual' ? <DecisaoModalAtual /> : <DecisaoModalProposto />
        )}
        {activeTab === 'verba-modal' && (
          viewMode === 'atual' ? <VerbaModalAtual /> : <VerbaModalProposto />
        )}
        {activeTab === 'cards' && (
          viewMode === 'atual' ? <CardsAtuais /> : <CardsPropostos />
        )}
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">{children}</p>
  );
}

function FakeDropdown({ label, value, required }: { label: string; value: string; required?: boolean }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}{required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <div className="relative w-full border border-gray-300 rounded-md">
        <div className="w-full px-3 py-2 text-left bg-white flex items-center justify-between text-sm text-gray-900">
          <span>{value}</span>
          <ChevronDown size={14} className="text-gray-400" />
        </div>
      </div>
    </div>
  );
}

function FakeInput({ label, value, required }: { label: string; value: string; required?: boolean }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}{required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <input
        readOnly
        value={value}
        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 bg-white focus:outline-none"
      />
    </div>
  );
}

function FakeRichText({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="block text-sm font-medium text-gray-700">{label}</label>
        <button className="inline-flex items-center space-x-1 px-2 py-1 text-xs font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded hover:bg-blue-100">
          <span>↗ Expandir</span>
        </button>
      </div>
      <div className="border border-gray-300 rounded-md">
        <div className="flex items-center gap-2 px-3 py-1.5 border-b border-gray-200 bg-gray-50">
          <span className="text-xs font-bold text-gray-600">B</span>
          <span className="text-xs italic text-gray-600">I</span>
          <span className="text-xs underline text-gray-600">U</span>
        </div>
        <div className="px-3 py-2 min-h-[72px] text-sm text-gray-500 italic">
          {value || 'Clique para editar...'}
        </div>
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
      <SectionLabel>Modal de Edição — Decisão (Versão Atual)</SectionLabel>
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
      <SectionLabel>Modal de Edição — Decisão (Versão Proposta)</SectionLabel>

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
                <input
                  readOnly
                  value="326"
                  className="w-20 px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 bg-white text-center"
                />
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
                <p className="text-xs text-red-600 mt-0.5">Esta ação não pode ser desfeita. Lançamentos de verbas vinculados a esta decisão também serão afetados.</p>
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="px-3 py-1.5 text-xs font-medium text-red-700 bg-white border border-red-300 rounded-md hover:bg-red-50"
                  >
                    Cancelar
                  </button>
                  <button className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 rounded-md hover:bg-red-700">
                    Sim, excluir
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <div className="px-6 pb-6 flex items-center justify-between gap-3">
          <button
            onClick={() => setShowDeleteConfirm(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-md border transition-colors ${showDeleteConfirm ? 'bg-red-50 border-red-200 text-red-700' : 'text-red-500 border-red-200 hover:bg-red-50'}`}
          >
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

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 w-full max-w-2xl text-sm">
        <p className="font-semibold text-blue-800 mb-2">O que mudou neste modal:</p>
        <ul className="text-blue-700 space-y-1 text-xs list-disc list-inside">
          <li>Header com ícone, badge colorido da situação e subtítulo contextual</li>
          <li>Campo "Página Vinculada" agora editável diretamente no formulário</li>
          <li>Botão de excluir no footer (esquerda) com confirmação inline — sem popup separado</li>
          <li>Timestamps de criação e atualização visíveis no rodapé do formulário</li>
          <li>Layout 2 colunas para tipo + situação (mais compacto e legível)</li>
          <li>Bordas e cantos arredondados levemente mais suaves (rounded-xl)</li>
        </ul>
      </div>
    </div>
  );
}

function VerbaModalAtual() {
  return (
    <div className="flex flex-col items-center">
      <SectionLabel>Modal de Edição — Verba (Versão Atual)</SectionLabel>
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

  const situacaoColor = 'bg-green-100 text-green-800 border-green-300';

  return (
    <div className="flex flex-col items-center gap-4">
      <SectionLabel>Modal de Edição — Verba (Versão Proposta)</SectionLabel>

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
                    <input
                      value={newTipoName}
                      onChange={e => setNewTipoName(e.target.value)}
                      className="text-sm font-bold text-gray-900 border-b-2 border-blue-500 bg-transparent focus:outline-none pb-0.5"
                      style={{ width: `${newTipoName.length + 2}ch` }}
                    />
                    <button onClick={() => setIsRenamingTipo(false)} className="p-1 text-green-600 hover:bg-green-50 rounded">
                      <Check size={14} />
                    </button>
                    <button onClick={() => { setIsRenamingTipo(false); setNewTipoName('Justiça Gratuita'); }} className="p-1 text-gray-400 hover:bg-gray-100 rounded">
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 mb-0.5">
                    <h2 className="text-base font-bold text-gray-900">{newTipoName}</h2>
                    <button onClick={() => setIsRenamingTipo(true)} className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Renomear tipo">
                      <Edit2 size={12} />
                    </button>
                  </div>
                )}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${situacaoColor}`}>Deferida</span>
                  <span className="text-xs text-gray-400">·</span>
                  <span className="text-xs text-gray-500">00f32b1 — Sentença</span>
                  <span className="text-xs text-gray-400">·</span>
                  <span className="text-xs text-gray-500">p. 376</span>
                </div>
              </div>
            </div>
            <button className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {isRenamingTipo && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700">
              Renomear atualizará <strong>todos os lançamentos</strong> com o tipo "{newTipoName}" neste processo.
            </div>
          )}

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
              <div
                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${checkCalculista ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-200 hover:border-gray-300'}`}
                onClick={() => setCheckCalculista(v => !v)}
              >
                <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 transition-colors ${checkCalculista ? 'bg-blue-600' : 'border-2 border-gray-300'}`}>
                  {checkCalculista && <Check size={12} className="text-white" />}
                </div>
                <div>
                  <p className={`text-sm font-medium ${checkCalculista ? 'text-blue-800' : 'text-gray-700'}`}>Calculista</p>
                  {checkCalculista
                    ? <p className="text-xs text-blue-500">Verificado em 11/03 09:05</p>
                    : <p className="text-xs text-gray-400">Aguardando verificação</p>
                  }
                </div>
              </div>

              <div
                className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${checkCalculista ? 'cursor-pointer' : 'opacity-50 cursor-not-allowed'} ${checkRevisor ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200 hover:border-gray-300'}`}
                onClick={() => checkCalculista && setCheckRevisor(v => !v)}
                title={!checkCalculista ? 'Requer aprovação do Calculista primeiro' : ''}
              >
                <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 transition-colors ${checkRevisor ? 'bg-green-600' : 'border-2 border-gray-300'}`}>
                  {checkRevisor && <Check size={12} className="text-white" />}
                </div>
                <div>
                  <p className={`text-sm font-medium ${checkRevisor ? 'text-green-800' : 'text-gray-700'}`}>Revisor</p>
                  {checkRevisor
                    ? <p className="text-xs text-green-500">Verificado em 11/03 10:40</p>
                    : <p className="text-xs text-gray-400">{checkCalculista ? 'Aguardando revisão' : 'Requer calculista'}</p>
                  }
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
                <p className="text-xs text-red-600 mt-0.5">Verba: Justiça Gratuita · Decisão: 00f32b1. Esta ação não pode ser desfeita.</p>
                <div className="flex gap-2 mt-3">
                  <button onClick={() => setShowDeleteConfirm(false)} className="px-3 py-1.5 text-xs font-medium text-red-700 bg-white border border-red-300 rounded-md hover:bg-red-50">Cancelar</button>
                  <button className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 rounded-md hover:bg-red-700">Sim, excluir</button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="px-6 pb-6 flex items-center justify-between gap-3">
          <button
            onClick={() => setShowDeleteConfirm(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-md border transition-colors ${showDeleteConfirm ? 'bg-red-50 border-red-200 text-red-700' : 'text-red-500 border-red-200 hover:bg-red-50'}`}
          >
            <Trash2 size={14} /> Excluir
          </button>
          <div className="flex gap-2">
            <button className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">Cancelar</button>
            <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 shadow-sm">
              <Save size={15} /> Salvar Alterações
            </button>
          </div>
        </div>
      </div>

      <div className="bg-green-50 border border-green-200 rounded-lg p-4 w-full max-w-4xl text-sm">
        <p className="font-semibold text-green-800 mb-2">O que mudou neste modal:</p>
        <ul className="text-green-700 space-y-1 text-xs list-disc list-inside">
          <li>Renomear tipo agora é feito inline no header (clique no lápis) — sem trocar o modo do formulário inteiro</li>
          <li>Seção de Checklist com toggles visuais de Calculista e Revisor, incluindo timestamps</li>
          <li>Revisor desabilitado até Calculista ser marcado (regra de negócio visível na UI)</li>
          <li>Página vinculada editável diretamente no formulário</li>
          <li>Badge colorido da situação e subtítulo com decisão e página no header</li>
          <li>Botão de excluir no footer com confirmação inline</li>
        </ul>
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

  const cycleStatus = () => {
    setStatus(s => s === 'pendente' ? 'calculado' : s === 'calculado' ? 'concluido' : 'pendente');
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-6">
        <div>
          <SectionLabel>Card de Decisão (Proposto)</SectionLabel>
          <div className="border border-gray-200 bg-white rounded-lg overflow-hidden shadow-sm transition-shadow hover:shadow-md">
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
                  <button
                    onClick={() => setDecisionDeleteState(s => s === 'idle' ? 'confirming' : 'idle')}
                    className={`p-1.5 rounded-md transition-colors ${decisionDeleteState === 'confirming' ? 'text-red-600 bg-red-100' : 'text-red-400 hover:text-red-600 hover:bg-red-50'}`}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>

            {decisionDeleteState === 'confirming' && (
              <div className="mx-3 mb-3 p-2.5 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-xs font-medium text-red-800 mb-2">Excluir "fc2473d"?</p>
                <div className="flex gap-2">
                  <button onClick={() => setDecisionDeleteState('idle')} className="flex-1 py-1 text-xs font-medium text-gray-600 bg-white border border-gray-300 rounded hover:bg-gray-50">Cancelar</button>
                  <button className="flex-1 py-1 text-xs font-medium text-white bg-red-600 rounded hover:bg-red-700">Excluir</button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div>
          <SectionLabel>Card de Verba (Proposto)</SectionLabel>
          <div className="border border-gray-200 bg-white rounded-lg overflow-hidden shadow-sm transition-shadow hover:shadow-md">
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
                    <button
                      onClick={cycleStatus}
                      className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium border rounded-full transition-all cursor-pointer ${cfg.classes}`}
                      title="Clique para avançar status"
                    >
                      <StatusIcon size={11} className={cfg.iconClass} />
                      {cfg.label}
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors"><Eye size={14} /></button>
                  <button className="p-1.5 text-green-400 hover:text-green-600 hover:bg-green-50 rounded-md transition-colors"><Edit2 size={14} /></button>
                  <button
                    onClick={() => setVerbaDeleteState(s => s === 'idle' ? 'confirming' : 'idle')}
                    className={`p-1.5 rounded-md transition-colors ${verbaDeleteState === 'confirming' ? 'text-red-600 bg-red-100' : 'text-red-400 hover:text-red-600 hover:bg-red-50'}`}
                  >
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
                  <button onClick={() => setVerbaDeleteState('idle')} className="flex-1 py-1 text-xs font-medium text-gray-600 bg-white border border-gray-300 rounded hover:bg-gray-50">Cancelar</button>
                  <button className="flex-1 py-1 text-xs font-medium text-white bg-red-600 rounded hover:bg-red-700">Excluir</button>
                </div>
              </div>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-2">Dica: clique no pill de status para ciclar entre Pendente → Calculado → Concluido</p>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm">
        <p className="font-semibold text-amber-800 mb-2">O que mudou nos cards:</p>
        <ul className="text-amber-700 space-y-1 text-xs list-disc list-inside">
          <li>Lixeira agora abre confirmação inline no próprio card — sem excluir imediatamente</li>
          <li>Status pill arredondado (rounded-full) com transição visual mais polida</li>
          <li>Clique no pill de status do card cicla o status (Pendente → Calculado → Concluido)</li>
          <li>Sombra sutil ao hover para indicar interatividade</li>
          <li>Badges de situação com rounded-full para diferenciar visualmente de outras tags</li>
        </ul>
      </div>
    </div>
  );
}
