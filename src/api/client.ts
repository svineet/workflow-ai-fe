import axios, { AxiosInstance, AxiosRequestConfig } from 'axios'
import { API_BASE_URL } from './config'
import { Graph, WorkflowCreate, WorkflowUpdate, WorkflowResponse, RunCreate, RunResponse, LogEntry } from './types'

export class ApiClient {
  private http: AxiosInstance

  constructor(baseURL: string = API_BASE_URL, config?: AxiosRequestConfig) {
    this.http = axios.create({ baseURL, ...(config || {}) })
  }

  async healthz() {
    const { data } = await this.http.get<{ ok: boolean }>('/healthz')
    return data
  }

  async listWorkflows() {
    const { data } = await this.http.get<Array<Pick<WorkflowResponse, 'id' | 'name' | 'webhook_slug' | 'created_at'>>>('/workflows')
    return data
  }

  async deleteWorkflow(workflowId: number) {
    const { data } = await this.http.delete<{ deleted: boolean }>(`/workflows/${workflowId}`)
    return data
  }

  async listRuns() {
    const { data } = await this.http.get<Array<Pick<RunResponse, 'id' | 'workflow_id' | 'status' | 'started_at' | 'finished_at'>>>('/runs')
    return data
  }

  async createWorkflow(body: WorkflowCreate) {
    const { data } = await this.http.post<{ id: number }>('/workflows', body)
    return data
  }

  async getWorkflow(workflowId: number) {
    const { data } = await this.http.get<WorkflowResponse>(`/workflows/${workflowId}`)
    return data
  }

  async updateWorkflow(workflowId: number, body: WorkflowUpdate) {
    const { data } = await this.http.put<{ updated: boolean }>(`/workflows/${workflowId}`, body)
    return data
  }

  async validateGraph(graph: Graph) {
    const { data } = await this.http.post<{ valid: boolean }>(`/validate-graph`, { graph })
    return data
  }

  async startRun(workflowId: number, body?: RunCreate) {
    const { data } = await this.http.post<{ id: number }>(`/workflows/${workflowId}/run`, body || {})
    return data
  }

  async getRun(runId: number) {
    const { data } = await this.http.get<RunResponse>(`/runs/${runId}`)
    return data
  }

  async getRunLogs(runId: number) {
    const { data } = await this.http.get<LogEntry[]>(`/runs/${runId}/logs`)
    return data
  }

  async triggerWebhook(slug: string, payload: Record<string, unknown>) {
    const { data } = await this.http.post<{ id: number }>(`/hooks/${slug}`, { payload })
    return data
  }

  async getBlocks() {
    const { data } = await this.http.get<{ blocks: string[] }>(`/blocks`)
    return data
  }

  async getBlockSpecs() {
    const { data } = await this.http.get<{ blocks: Record<string, unknown> }>(`/block-specs`)
    return data
  }
}

export const apiClient = new ApiClient() 