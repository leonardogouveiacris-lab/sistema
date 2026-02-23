import { LogMetadata } from './logger';

export interface FlowContextInput {
  flowId?: string;
  entityType: string;
  entityId?: string;
  action: string;
  source: string;
}

export const generateFlowId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `flow-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

export const createFlowContext = (input: FlowContextInput): LogMetadata => ({
  flowId: input.flowId || generateFlowId(),
  entityType: input.entityType,
  entityId: input.entityId,
  action: input.action,
  source: input.source
});
