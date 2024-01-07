import { AppsV1Api, KubeConfig } from "@kubernetes/client-node"
import { getEnvVars } from "./get-env-vars"

export const createClient = () => {
  const env = getEnvVars()

  const kubeconfig = new KubeConfig()
  kubeconfig.loadFromDefault()

  const client = kubeconfig.makeApiClient(AppsV1Api)
  client.basePath = env.K8S_BASE_URL ?? client.basePath

  return {
    client,
    env,
  }
}
