/**
 * Configuração e inicialização do cliente Supabase
 * 
 * Este arquivo contém a configuração central do Supabase para toda a aplicação.
 * O cliente é inicializado aqui e exportado para uso em outros módulos.
 */

import { createClient } from '@supabase/supabase-js';
import { Database } from '../types/database';
import logger from '../utils/logger';
import { Info, AlertCircle } from 'lucide-react';

// URL do projeto Supabase (deve ser configurado nas variáveis de ambiente)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

// Chave pública do Supabase (anon key - pode ser exposta no frontend)
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * Validação das variáveis de ambiente necessárias
 */
const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey);

if (!isSupabaseConfigured) {
  const missingVars = [];
  if (!supabaseUrl) missingVars.push('VITE_SUPABASE_URL');
  if (!supabaseAnonKey) missingVars.push('VITE_SUPABASE_ANON_KEY');
  
  logger.warn(
    `Variáveis de ambiente do Supabase não configuradas: ${missingVars.join(', ')}. Sistema funcionará em modo local.`,
    'supabase-config',
    { missingVars }
  );
}

/**
 * Cliente Supabase configurado com tipagem TypeScript
 * 
 * Se as variáveis não estiverem configuradas, retorna null
 * Os hooks irão detectar isso e usar localStorage como fallback
 */
export const supabase = isSupabaseConfigured 
  ? createClient<Database>(supabaseUrl, supabaseAnonKey, {
      auth: {
        // Configurações de autenticação
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true
      },
      // Configurações globais do cliente
      global: {
        headers: {
          'X-Client-Info': 'sistema-verbas-trabalhistas@1.0.0'
        }
      }
    })
  : null;

/**
 * Indica se o Supabase está configurado e disponível
 */
export const isSupabaseAvailable = isSupabaseConfigured;

/**
 * Função utilitária para testar a conexão com o Supabase
 * 
 * @returns Promise<boolean> - true se a conexão foi bem-sucedida
 */
export const testSupabaseConnection = async (): Promise<boolean> => {
  if (!supabase) {
    logger.info('Supabase não configurado - usando armazenamento local', 'supabase-config');
    return false;
  }

  try {
    logger.info('Testando conexão com Supabase...', 'supabase-config');
    
    // Testa a conexão básica com Supabase fazendo uma consulta simples com timeout
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Timeout na conexão')), 10000);
    });
    
    const queryPromise = supabase.from('processes').select('count').limit(1);
    
    const { error } = await Promise.race([queryPromise, timeoutPromise]) as any;
    
    if (error) {
      // Se as tabelas não existem, não é um erro de conectividade
      if (error.code === 'PGRST205') {
        logger.warn(
          'Supabase conectado, mas tabelas não encontradas. Execute o script SQL de migração.',
          'supabase-config',
          { errorCode: error.code, message: error.message }
        );
        return false;
      }
      
      logger.error(
        'Erro ao conectar com Supabase',
        error,
        'supabase-config',
        { errorCode: error.code, errorMessage: error.message }
      );
      return false;
    }
    
    logger.success('Conexão com Supabase estabelecida com sucesso', 'supabase-config');
    return true;
  } catch (error) {
    // Trata especificamente erros de rede/conectividade
    if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
      logger.warn(
        'Falha de conectividade com Supabase - verifique suas credenciais e conexão de rede',
        'supabase-config'
      );
    } else {
      logger.errorWithException(
        'Falha crítica na conexão com Supabase',
        error as Error,
        'supabase-config'
      );
    }
    return false;
  }
};

/**
 * Componente para exibir mensagem de configuração do Supabase
 */
export const SupabaseConfigMessage = () => {
  if (isSupabaseAvailable) return null;
  
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
      <div className="flex items-start space-x-3">
        <Info size={14} className="text-blue-600 mt-1 flex-shrink-0" />
        <div>
          <h3 className="text-sm font-medium text-blue-900 mb-1">
            Sistema em Modo Local
          </h3>
          <p className="text-blue-800 text-sm mb-3">
            O sistema está funcionando com armazenamento local. Para usar armazenamento em nuvem:
          </p>
          <ol className="text-blue-800 text-sm space-y-1 list-decimal list-inside">
            <li>Clique em "Connect to Supabase" no canto superior direito</li>
            <li>Ou configure manualmente o arquivo .env com suas credenciais</li>
          </ol>
          <p className="text-xs text-blue-600 mt-2">
            Seus dados estão sendo salvos localmente no navegador.
          </p>
        </div>
      </div>
    </div>
  );
};

/**
 * Componente para exibir mensagem de erro de conexão
 */
export const SupabaseConnectionError = ({ error }: { error: string }) => {
  return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
      <div className="flex items-start space-x-3">
        <AlertCircle size={14} className="text-red-600 mt-1 flex-shrink-0" />
        <div>
          <h3 className="text-sm font-medium text-red-900 mb-1">
            Erro de Conexão com Supabase
          </h3>
          <p className="text-red-800 text-sm mb-3">
            {error}
          </p>
          <div className="text-red-800 text-sm space-y-1">
            <p><strong>Possíveis soluções:</strong></p>
            <ul className="list-disc list-inside ml-4 space-y-1">
              <li>Verifique se as credenciais no arquivo .env estão corretas</li>
              <li>Confirme se seu projeto Supabase existe e está ativo</li>
              <li>Execute o script SQL de migração no Supabase SQL Editor</li>
              <li>Clique em "Connect to Supabase" para reconfigurar</li>
            </ul>
          </div>
          <p className="text-xs text-red-600 mt-2">
            O sistema voltará ao modo local até que a conexão seja restabelecida.
          </p>
        </div>
      </div>
    </div>
  );
};

export default supabase;
