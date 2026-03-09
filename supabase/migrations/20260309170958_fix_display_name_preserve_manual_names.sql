/*
  # Hotfix: Preservar display_name manual em process_documents

  ## Problema
  Ao deletar um documento "do meio", a trigger de reordenacao atualiza
  sequence_order dos documentos posteriores. A funcao antiga recalculava
  display_name nesses updates, sobrescrevendo nomes manuais por "Atualizacao N".

  ## Solucao
  A funcao agora so gera nome automatico quando display_name vier nulo ou vazio.
  Nomes manuais sao preservados em qualquer situacao (inclusive reordenacao).

  ## Mudancas
  - Funcao `set_process_document_display_name`: removida logica que recalculava
    nome ao mudar sequence_order/date_reference
*/

CREATE OR REPLACE FUNCTION set_process_document_display_name()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.display_name IS NULL OR length(TRIM(BOTH FROM NEW.display_name)) = 0 THEN
    NEW.display_name := generate_document_display_name(
      NEW.sequence_order,
      NEW.date_reference
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
