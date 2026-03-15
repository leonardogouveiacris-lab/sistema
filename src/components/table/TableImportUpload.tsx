import React, { useCallback, useRef, useState } from 'react';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle, X } from 'lucide-react';
import { parseTableFile } from '../../utils/tableParser';
import type { ParsedTableData } from '../../types/ProcessTable';

interface TableImportUploadProps {
  onConfirm: (parsed: ParsedTableData, tableName: string) => Promise<void>;
  onCancel?: () => void;
  isReplacing?: boolean;
  importing?: boolean;
  namePrefix?: string;
}

export function TableImportUpload({
  onConfirm,
  onCancel,
  isReplacing = false,
  importing = false,
  namePrefix,
}: TableImportUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ parsed: ParsedTableData; fileName: string } | null>(null);
  const [tableName, setTableName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(async (file: File) => {
    setParseError(null);
    setPreview(null);

    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      setParseError('Arquivo muito grande. O limite é 10 MB.');
      return;
    }

    try {
      const parsed = await parseTableFile(file);
      if (parsed.headers.length === 0) {
        setParseError('O arquivo está vazio ou não contém cabeçalhos válidos.');
        return;
      }

      const baseName = file.name.replace(/\.(xlsx|xls|csv)$/i, '');
      const defaultName = namePrefix ? `${namePrefix} - Holerites` : baseName;
      setTableName(defaultName);
      setPreview({ parsed, fileName: file.name });
    } catch (err) {
      setParseError((err as Error).message);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  const handleConfirm = useCallback(async () => {
    if (!preview) return;
    const name = tableName.trim() || preview.fileName.replace(/\.(xlsx|xls|csv)$/i, '');
    await onConfirm(preview.parsed, name);
  }, [preview, tableName, onConfirm]);

  const handleClear = () => {
    setPreview(null);
    setParseError(null);
    setTableName('');
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className="flex flex-col gap-5">
      {!preview ? (
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={`
            relative border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center gap-4
            cursor-pointer transition-all duration-200 select-none
            ${isDragging
              ? 'border-blue-500 bg-blue-50 scale-[1.01]'
              : 'border-slate-300 bg-slate-50 hover:border-blue-400 hover:bg-blue-50/40'
            }
          `}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileChange}
            className="hidden"
          />
          <div className={`p-4 rounded-full transition-colors ${isDragging ? 'bg-blue-100' : 'bg-slate-100'}`}>
            <Upload size={28} className={isDragging ? 'text-blue-500' : 'text-slate-400'} />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-slate-700">
              {isDragging ? 'Solte o arquivo aqui' : 'Arraste e solte ou clique para selecionar'}
            </p>
            <p className="text-xs text-slate-500 mt-1">Suporta arquivos .xlsx, .xls e .csv (máx. 10 MB)</p>
          </div>
        </div>
      ) : (
        <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
          <div className="flex items-start gap-3 p-4 bg-emerald-50 border-b border-emerald-100">
            <CheckCircle size={18} className="text-emerald-500 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-emerald-800">Arquivo carregado com sucesso</p>
              <p className="text-xs text-emerald-600 mt-0.5 truncate">{preview.fileName}</p>
            </div>
            <button
              onClick={handleClear}
              className="p-1 rounded hover:bg-emerald-100 text-emerald-600 transition-colors"
            >
              <X size={15} />
            </button>
          </div>

          <div className="p-4 flex gap-6">
            <Stat label="Colunas" value={preview.parsed.headers.length} icon={<FileSpreadsheet size={15} className="text-blue-500" />} />
            <Stat label="Linhas" value={preview.parsed.rows.length} icon={<FileSpreadsheet size={15} className="text-slate-400" />} />
          </div>

          <div className="px-4 pb-4 flex flex-col gap-1.5">
            <label className="text-xs font-medium text-slate-600">Nome da tabela</label>
            <input
              type="text"
              value={tableName}
              onChange={(e) => setTableName(e.target.value)}
              placeholder="Ex: Folha de Pagamento 2024"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 placeholder-slate-400
                         focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
          </div>

          <div className="px-4 pb-4">
            <p className="text-xs font-medium text-slate-500 mb-2">Colunas detectadas:</p>
            <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto">
              {preview.parsed.headers.map((h, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 rounded text-xs text-slate-600"
                >
                  <span className="font-mono font-semibold text-blue-600">
                    {String.fromCharCode(65 + i)}
                  </span>
                  <span className="truncate max-w-[100px]" title={h}>{h || '(sem nome)'}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {parseError && (
        <div className="flex items-start gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle size={15} className="text-red-500 mt-0.5 shrink-0" />
          <p className="text-xs text-red-700">{parseError}</p>
        </div>
      )}

      {isReplacing && !preview && (
        <div className="flex items-start gap-2 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg">
          <AlertCircle size={15} className="text-amber-500 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-700">
            Substituir a tabela atual apagará todos os dados importados anteriormente, incluindo colunas de fórmula.
          </p>
        </div>
      )}

      <div className="flex gap-3 justify-end">
        {onCancel && (
          <button
            onClick={onCancel}
            disabled={importing}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100
                       rounded-lg transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
        )}
        <button
          onClick={handleConfirm}
          disabled={!preview || importing}
          className="px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700
                     rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed
                     flex items-center gap-2"
        >
          {importing ? (
            <>
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Importando...
            </>
          ) : (
            <>
              <Upload size={15} />
              {isReplacing ? 'Substituir tabela' : 'Importar tabela'}
            </>
          )}
        </button>
      </div>
    </div>
  );
}

function Stat({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      {icon}
      <div>
        <p className="text-lg font-bold text-slate-800 leading-none">{value}</p>
        <p className="text-xs text-slate-500">{label}</p>
      </div>
    </div>
  );
}
