import {
  DatasourceMetadataDto,
  ExecutionOutput,
  IntegrationError,
  RawRequest,
  WorkflowActionConfiguration,
  WorkflowDatasourceConfiguration
} from '@superblocksteam/shared';
import { BasePlugin, formatExecutionOutput, PluginExecutionProps } from '@superblocksteam/shared-backend';
import { isEmpty } from 'lodash';

export default class WorkflowPlugin extends BasePlugin {
  async execute({
    context,
    datasourceConfiguration,
    actionConfiguration,
    files,
    agentCredentials,
    recursionContext,
    environment,
    relayDelegate
  }: PluginExecutionProps): Promise<ExecutionOutput> {
    const loopStartIdx = recursionContext.executedWorkflowsPath.findIndex((workflow) => workflow.id === actionConfiguration.workflow);
    if (loopStartIdx >= 0) {
      throw new IntegrationError(
        `Cycle detected when executing workflow: ${recursionContext.executedWorkflowsPath
          .slice(loopStartIdx)
          .map((workflow) => workflow.name)
          .join(' -> ')} -> ${recursionContext.executedWorkflowsPath[loopStartIdx].name}. Workflows cannot be cyclical.`
      );
    }

    const body = {};
    Object.entries(actionConfiguration.custom ?? {}).forEach(([key, property]) => {
      let val: unknown;
      try {
        val = JSON.parse(property.value);
      } catch (err) {
        val = property.value;
      }
      body[property.key] = val;
    });
    if (isEmpty(actionConfiguration.workflow)) {
      throw new IntegrationError('No workflow selected, a workflow is required for workflow steps');
    }

    const res = await this.pluginConfiguration.workflowFetchAndExecuteFunc({
      apiId: actionConfiguration.workflow,
      isPublished: true,
      environment,
      executionParams: [{ key: 'body', value: body }],
      agentCredentials,
      files: [],
      recursionContext,
      isWorkflow: true,
      relayDelegate
    });
    const ret = new ExecutionOutput();
    ret.output = formatExecutionOutput(res);
    return ret;
  }

  getRequest(actionConfiguration: WorkflowActionConfiguration): RawRequest {
    return '';
  }

  dynamicProperties(): string[] {
    return ['custom'];
  }

  async metadata(datasourceConfiguration: WorkflowDatasourceConfiguration): Promise<DatasourceMetadataDto> {
    return {};
  }

  async test(datasourceConfiguration: WorkflowDatasourceConfiguration): Promise<void> {
    return;
  }
}
