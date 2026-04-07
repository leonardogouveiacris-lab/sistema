import React, { useState, useEffect } from 'react';
import { X, HardDrive, AlertCircle, CheckCircle } from 'lucide-react';

const PRESET_LIMITS = [100, 200, 350, 500, 750, 1024];

interface Props {
  isOpen: boolean;
  onClose: () => void;
  currentLimitMb: number;
  updating: boolean;
  onUpdate: (mb: number) => Promise<void>;
}

const UploadLimitModal: React.FC<Props> = ({
  isOpen,
  onClose,
  currentLimitMb,
  updating,
  onUpdate,
}) => {
  const [inputValue, setInputValue] = useState(String(currentLimitMb));
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setInputValue(String(currentLimitMb));
      setError(null);
      setSuccess(false);
    }
  }, [isOpen, currentLimitMb]);

  if (!isOpen) return null;

  const parsedValue = parseInt(inputValue, 10);
  const isValid = !isNaN(parsedValue) && parsedValue >= 1 && parsedValue <= 1024;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;
    setError(null);
    try {
      await onUpdate(parsedValue);
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 1200);
    } catch {
      setError('Erro ao atualizar o limite. Tente novamente.');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
              <HardDrive size={16} className="text-blue-600" />
            </div>
            <h2 className="text-base font-semibold text-gray-900">Limite de Upload</h2>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
          <p className="text-sm text-gray-500">
            Define o tamanho máximo permitido para upload de arquivos PDF. O valor e sincronizado
            automaticamente com o Supabase Storage.
          </p>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Limite atual: <span className="text-blue-600 font-semibold">{currentLimitMb} MB</span>
            </label>
            <div className="flex items-center space-x-3">
              <input
                type="number"
                value={inputValue}
                onChange={(e) => {
                  setInputValue(e.target.value);
                  setError(null);
                  setSuccess(false);
                }}
                min={1}
                max={1024}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Ex: 500"
              />
              <span className="text-sm text-gray-500 font-medium shrink-0">MB</span>
            </div>
            {!isValid && inputValue !== '' && (
              <p className="text-xs text-red-600">Informe um valor entre 1 e 1024 MB.</p>
            )}
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Valores sugeridos</p>
            <div className="flex flex-wrap gap-2">
              {PRESET_LIMITS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => {
                    setInputValue(String(preset));
                    setError(null);
                    setSuccess(false);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    parsedValue === preset
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {preset >= 1024 ? '1 GB' : `${preset} MB`}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="flex items-center space-x-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle size={14} className="text-red-500 shrink-0" />
              <p className="text-xs text-red-700">{error}</p>
            </div>
          )}

          {success && (
            <div className="flex items-center space-x-2 p-3 bg-green-50 border border-green-200 rounded-lg">
              <CheckCircle size={14} className="text-green-500 shrink-0" />
              <p className="text-xs text-green-700">Limite atualizado com sucesso!</p>
            </div>
          )}

          <div className="flex justify-end space-x-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={updating}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!isValid || updating || parsedValue === currentLimitMb}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {updating ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UploadLimitModal;
